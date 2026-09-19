import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Dimensions,
  Keyboard,
  Animated,
  PanResponder,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../src/theme';
import { KaphorImage, normalizeImageUri } from '../../src/components/KaphorImage';
import { VerifiedBadge } from '../../src/components/common/VerifiedBadge';
import { ConversationChatLoading } from '../../src/components/common/CardLoadingScreen';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  messageService,
  ConversationDetailResponse,
  DirectMessageItem,
  ConversationGarment,
} from '../../src/services/messageService';
import { useAuth } from '../../src/context/AuthContext';
import { getSocket, connectSocket } from '../../src/services/socket';
import { safeBack, useBackHandler } from '../../src/utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticFeedback } from '../../src/utils/haptics';
import { useNotificationStore } from '../../src/store/notificationStore';
import { swapService } from '../../src/services/swapService';
import { navigateToLiveSwapStage } from '../../src/utils/swapNavigation';
import type { SwapTransaction } from '../../src/types/swap';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '👏'];

export interface QuotedReplyInfo {
  id: string;
  senderName: string;
  content: string;
}

export function formatReplyContent(content: string, replyTo: QuotedReplyInfo | null): string {
  if (!replyTo) return content;
  const sanitizedText = (replyTo.content || '📷 Photo').replace(/[\r\n|\]]+/g, ' ').slice(0, 70);
  const sanitizedSender = (replyTo.senderName || 'User').replace(/[\r\n|\]]+/g, ' ').slice(0, 30);
  return `[[REPLY:${replyTo.id}|${sanitizedSender}|${sanitizedText}]]${content}`;
}

export function parseReplyContent(rawContent: string): { replyTo: QuotedReplyInfo | null; text: string } {
  if (!rawContent || typeof rawContent !== 'string') {
    return { replyTo: null, text: '' };
  }
  const match = rawContent.match(/^\[\[REPLY:([^|]+)\|([^|]+)\|([^\]]*)\]\](.*)$/s);
  if (match) {
    const [, id, senderName, quotedText, remainingText] = match;
    return {
      replyTo: {
        id,
        senderName,
        content: quotedText,
      },
      text: remainingText,
    };
  }
  return { replyTo: null, text: rawContent };
}

interface SwipeableMessageBubbleProps {
  children: React.ReactNode;
  onSwipeReply: () => void;
  isMine: boolean;
}

function SwipeableMessageBubble({ children, onSwipeReply, isMine }: SwipeableMessageBubbleProps) {
  const panX = useRef(new Animated.Value(0)).current;
  const hasTriggeredHaptic = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          const translation = Math.min(gestureState.dx * 0.55, 60);
          panX.setValue(translation);
          if (translation > 36 && !hasTriggeredHaptic.current) {
            hasTriggeredHaptic.current = true;
            hapticFeedback.light();
          } else if (translation <= 36) {
            hasTriggeredHaptic.current = false;
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx * 0.55 > 36) {
          onSwipeReply();
        }
        hasTriggeredHaptic.current = false;
        Animated.spring(panX, {
          toValue: 0,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        hasTriggeredHaptic.current = false;
        Animated.spring(panX, {
          toValue: 0,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      <Animated.View
        style={[
          styles.swipeReplyIconWrap,
          {
            opacity: panX.interpolate({
              inputRange: [0, 20, 36],
              outputRange: [0, 0.4, 1],
              extrapolate: 'clamp',
            }),
            transform: [
              {
                scale: panX.interpolate({
                  inputRange: [0, 20, 36],
                  outputRange: [0.5, 0.8, 1.1],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.swipeReplyCircle}>
          <Ionicons name="arrow-undo" size={14} color={colors.charcoal} />
        </View>
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [{ translateX: panX }],
          width: '100%',
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export default function DirectChatScreen() {
  const insets = useSafeAreaInsets();
  const { conversationId, swapId: swapIdParam } = useLocalSearchParams<{ conversationId: string; swapId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  useBackHandler('/(tabs)/messages');

  const [detail, setDetail] = useState<ConversationDetailResponse | null>(null);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const setActiveConversationId = useNotificationStore((s) => s.setActiveConversationId);

  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
    }
    return () => {
      setActiveConversationId(null);
    };
  }, [conversationId, setActiveConversationId]);

  // Separate reactions from normal message bubbles and map by messageId
  const { displayMessages, reactionsByMessageId } = useMemo(() => {
    const reactionsMap: Record<string, { emoji: string; count: number; userReacted: boolean }[]> = {};
    const visibleMsgs: DirectMessageItem[] = [];

    const seenIds = new Set<string>();

    for (const msg of messages) {
      if (msg.content && msg.content.startsWith('[[REACTION:')) {
        const match = msg.content.match(/^\[\[REACTION:([^|]+)\|(.+)\]\]$/);
        if (match) {
          const targetId = match[1];
          const emoji = match[2];
          const isFromMe = msg.senderId === user?.id;

          if (!reactionsMap[targetId]) {
            reactionsMap[targetId] = [];
          }
          const existing = reactionsMap[targetId].find((r) => r.emoji === emoji);
          if (existing) {
            existing.count += 1;
            if (isFromMe) existing.userReacted = true;
          } else {
            reactionsMap[targetId].push({
              emoji,
              count: 1,
              userReacted: isFromMe,
            });
          }
        }
      } else {
        // Prevent duplicate message rendering & flicker
        if (seenIds.has(msg.id)) continue;
        seenIds.add(msg.id);

        // If a temp optimistic message exists but the confirmed real message is already present, skip the temp message
        if (msg.id.startsWith('temp-')) {
          const hasRealCounterpart = visibleMsgs.some(
            (vm) => !vm.id.startsWith('temp-') && vm.senderId === msg.senderId && vm.content === msg.content
          );
          if (hasRealCounterpart) continue;
        }

        visibleMsgs.push(msg);
      }
    }

    return { displayMessages: visibleMsgs, reactionsByMessageId: reactionsMap };
  }, [messages, user?.id]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<QuotedReplyInfo | null>(null);
  const [actionMessage, setActionMessage] = useState<DirectMessageItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isInputFocused, setInputFocused] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [swapDetails, setSwapDetails] = useState<SwapTransaction | null>(null);
  const [modalGarment, setModalGarment] = useState<ConversationGarment | null>(null);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [selectedActiveGarment, setSelectedActiveGarment] = useState<ConversationGarment | null>(null);
  const [showTransactionsHub, setShowTransactionsHub] = useState(false);
  const [activeGarmentsTab, setActiveGarmentsTab] = useState<'counterparty' | 'seller'>('counterparty');

  const isExplicitSale =
    (detail?.conversation as any)?.type === 'SALE' ||
    detail?.conversation?.garment?.listingType === 'SALE' ||
    Boolean(detail?.conversation?.order?.id);

  const swapId = !isExplicitSale
    ? (swapIdParam || ((detail?.conversation as any)?.type === 'SWAP' || detail?.conversation?.garment?.listingType === 'SWAP' || detail?.conversation?.garment?.listingType === 'ACCESSORY_SWAP' ? detail?.conversation?.swap?.id : null))
    : null;

  useEffect(() => {
    if (!swapId) return;
    let isMounted = true;
    (async () => {
      try {
        const sw = await swapService.getSwapById(swapId);
        if (isMounted) setSwapDetails(sw);
      } catch (err) {
        console.warn('Could not load swap details in chat:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [swapId]);

  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const partnerTypingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    hapticFeedback.light();
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  const handleStartReply = (item: DirectMessageItem) => {
    const isMine = item.senderId === user?.id;
    const senderName = isMine ? 'You' : (item.sender?.displayName || detail?.conversation.otherUser.displayName || 'Partner');
    const parsed = parseReplyContent(item.content);
    setReplyingTo({
      id: item.id,
      senderName,
      content: parsed.text || (item.imageUrl ? '📷 Photo' : ''),
    });
    setActionMessage(null);
    hapticFeedback.selection();
  };

  const scrollToMessage = (messageId: string) => {
    const targetIdx = messages.findIndex((m) => m.id === messageId);
    if (targetIdx >= 0) {
      try {
        flatListRef.current?.scrollToIndex({ index: targetIdx, animated: true, viewPosition: 0.5 });
        hapticFeedback.light();
      } catch {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    }
  };

  // Keyboard awareness listener
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const cacheChatKey = `@kaphor_chat_${conversationId}`;

  // Load offline cached messages immediately on mount
  useEffect(() => {
    if (!conversationId) return;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheChatKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.detail) setDetail(parsed.detail);
          if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            setMessages(parsed.messages);
            setLoading(false);
          }
        }
      } catch {}
    })();
  }, [conversationId]);

  const loadConversation = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await messageService.getConversationMessages(conversationId);
      setDetail(data);
      setMessages(data.messages);
      useNotificationStore.getState().fetchUnreadMessageCount();
      // Persist to offline cache
      AsyncStorage.setItem(cacheChatKey, JSON.stringify({ detail: data, messages: data.messages })).catch(() => {});
    } catch (e: any) {
      console.error('Failed to load conversation', e);
      if (messages.length === 0) {
        Alert.alert('Error', 'Could not open conversation', [
          { text: 'Go Back', onPress: () => safeBack('/(tabs)/messages') },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, messages.length]);

  useEffect(() => {
    loadConversation();

    // Connect socket and join conversation room with auto-rejoin on connect
    const socket = connectSocket() || getSocket();
    if (socket && conversationId) {
      const joinRoom = () => {
        socket.emit('join:conversation', conversationId);
      };

      if (socket.connected) {
        joinRoom();
      }
      socket.on('connect', joinRoom);

      const messageHandler = (payload: any) => {
        const newMsg: DirectMessageItem = payload?.message || payload;
        if (newMsg && newMsg.conversationId === conversationId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;

            // If sent by current user, replace matching optimistic temp message to avoid duplicate flickering
            if (newMsg.senderId === user?.id) {
              const tempIdx = prev.findIndex(
                (m) => m.id.startsWith('temp-') && m.senderId === user?.id && m.content === newMsg.content
              );
              if (tempIdx !== -1) {
                const updated = [...prev];
                updated[tempIdx] = newMsg;
                return updated;
              }
            }

            return [...prev, newMsg];
          });
          setIsPartnerTyping(false);
          setShowScrollBottom((isScrolled) => {
            if (isScrolled) {
              setUnreadWhileScrolled((c) => c + 1);
            } else {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
            return isScrolled;
          });
        }
      };

      const typingHandler = (data: any) => {
        if (data.conversationId === conversationId && data.userId !== user?.id) {
          setIsPartnerTyping(true);
          if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
          partnerTypingTimerRef.current = setTimeout(() => {
            setIsPartnerTyping(false);
          }, 3000);
        }
      };

      const stopTypingHandler = (data: any) => {
        if (data.conversationId === conversationId && data.userId !== user?.id) {
          setIsPartnerTyping(false);
        }
      };

      socket.on('direct_message', messageHandler);
      socket.on('new_direct_message', messageHandler);
      socket.on('user_typing', typingHandler);
      socket.on('user_stop_typing', stopTypingHandler);

      return () => {
        socket.emit('leave:conversation', conversationId);
        socket.off('connect', joinRoom);
        socket.off('direct_message', messageHandler);
        socket.off('new_direct_message', messageHandler);
        socket.off('user_typing', typingHandler);
        socket.off('user_stop_typing', stopTypingHandler);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
      };
    }
  }, [conversationId, loadConversation, user?.id]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom > 180) {
      setShowScrollBottom(true);
    } else {
      setShowScrollBottom(false);
      setUnreadWhileScrolled(0);
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);

    const socket = getSocket();
    if (socket && conversationId && user?.id) {
      socket.emit('typing', {
        conversationId,
        userId: user.id,
        displayName: user.displayName,
      });

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socket.emit('stop_typing', { conversationId, userId: user.id });
      }, 1500);
    }
  };

  const openCameraDirectly = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant camera access to capture photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        hapticFeedback.light();
      }
    } catch {
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const pickImage = async () => {
    Alert.alert('Attach Content', 'Choose attachment', [
      {
        text: 'Take Photo',
        onPress: openCameraDirectly,
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Please grant photo access to share images in chat.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.85,
            });
            if (!result.canceled && result.assets && result.assets[0]) {
              setSelectedImage(result.assets[0].uri);
              hapticFeedback.light();
            }
          } catch {
            Alert.alert('Error', 'Failed to pick image');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadPhotoBase64 = async (uri: string): Promise<string> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      return `data:image/jpeg;base64,${base64}`;
    } catch {
      return uri;
    }
  };

  const sendCustomMessage = async (content: string, imgUri?: string) => {
    if (!conversationId || sending) return;
    setSending(true);
    hapticFeedback.light();

    const tempMsg: DirectMessageItem = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: user?.id || '',
      recipientId: detail?.conversation.otherUser.id || '',
      content: content || '📷 Photo',
      imageUrl: imgUri,
      isFlagged: false,
      readAt: null,
      createdAt: new Date().toISOString(),
      sender: {
        id: user?.id || '',
        displayName: user?.displayName || 'Me',
        username: user?.username || 'me',
        avatar: (user as any)?.avatar || (user as any)?.avatarUrl || null,
      },
    };

    setMessages((prev) => [...prev, tempMsg]);
    if (!content.startsWith('[[REACTION:')) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }

    try {
      let finalImgUrl: string | undefined = undefined;
      if (imgUri) {
        finalImgUrl = await uploadPhotoBase64(imgUri);
      }
      const result = await messageService.sendMessage(conversationId, content, finalImgUrl);
      setMessages((prev) => {
        const alreadyHasReal = prev.some((m) => m.id === result.data.id);
        if (alreadyHasReal) {
          return prev.filter((m) => m.id !== tempMsg.id);
        }
        return prev.map((m) => (m.id === tempMsg.id ? result.data : m));
      });
    } catch (e: any) {
      Alert.alert('Failed to send', e?.response?.data?.message || 'Could not send message');
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleSendReaction = (emoji: string) => {
    if (!actionMessage) return;
    hapticFeedback.medium();
    const targetId = actionMessage.id;
    setActionMessage(null);
    const reactionToken = `[[REACTION:${targetId}|${emoji}]]`;
    sendCustomMessage(reactionToken);
  };

  const handleToggleReaction = (targetId: string, emoji: string) => {
    hapticFeedback.light();
    const reactionToken = `[[REACTION:${targetId}|${emoji}]]`;
    sendCustomMessage(reactionToken);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    const hasImage = !!selectedImage;
    if ((!text && !hasImage) || !conversationId || sending) return;

    hapticFeedback.light();
    const imgToSend = selectedImage;
    const activeReply = replyingTo;
    setInputText('');
    setSelectedImage(null);
    setReplyingTo(null);
    setSending(true);

    const finalContent = formatReplyContent(text, activeReply);

    const socket = getSocket();
    if (socket && conversationId && user?.id) {
      socket.emit('stop_typing', { conversationId, userId: user.id });
    }

    // Optimistic message
    const tempMsg: DirectMessageItem = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: user?.id || '',
      recipientId: detail?.conversation.otherUser.id || '',
      content: finalContent || '📷 Photo',
      imageUrl: imgToSend,
      isFlagged: false,
      readAt: null,
      createdAt: new Date().toISOString(),
      sender: {
        id: user?.id || '',
        displayName: user?.displayName || 'Me',
        username: user?.username || 'me',
        avatar: (user as any)?.avatar || (user as any)?.avatarUrl || null,
      },
    };

    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      let finalImgUrl: string | undefined = undefined;
      if (imgToSend) {
        finalImgUrl = await uploadPhotoBase64(imgToSend);
      }

      const result = await messageService.sendMessage(conversationId, finalContent, finalImgUrl);
      // Replace optimistic message with actual DB message (or remove temp if socket already added it)
      setMessages((prev) => {
        const alreadyHasReal = prev.some((m) => m.id === result.data.id);
        if (alreadyHasReal) {
          return prev.filter((m) => m.id !== tempMsg.id);
        }
        return prev.map((m) => (m.id === tempMsg.id ? result.data : m));
      });

      if (result.warning) {
        Alert.alert('Safety Alert', result.warning);
      }
    } catch (e: any) {
      Alert.alert('Failed to send', e?.response?.data?.message || 'Could not send message');
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleReport = () => {
    const otherUser = detail?.conversation.otherUser;
    if (!otherUser) return;

    Alert.alert(
      'Report User',
      `Submit a trust & safety report against @${otherUser.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Off-Platform Scam / Phishing',
          style: 'destructive',
          onPress: () => submitReport('Suspected Off-Platform Payment Scam'),
        },
        {
          text: 'Harassment or Inappropriate Content',
          style: 'destructive',
          onPress: () => submitReport('Inappropriate communication or harassment'),
        },
        {
          text: 'Counterfeit / Item Misrepresentation',
          style: 'destructive',
          onPress: () => submitReport('Suspected counterfeit or fake listing'),
        },
      ]
    );
  };

  const submitReport = async (reason: string) => {
    const otherUser = detail?.conversation.otherUser;
    if (!otherUser) return;
    try {
      await messageService.reportUser(otherUser.id, reason, 'Reported via direct message thread');
      Alert.alert('Report Submitted', 'Our trust & safety team will review this user.');
    } catch {
      Alert.alert('Report Received', 'Thank you for reporting. Our moderation team has been notified.');
    }
  };

  const handleDeleteConversation = () => {
    if (!conversationId) return;
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to permanently delete this conversation and all its messages? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await messageService.deleteConversation(conversationId);
              safeBack('/(tabs)/messages');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Could not delete conversation.');
            }
          },
        },
      ]
    );
  };

  const garment = detail?.conversation.garment;
  const other = detail?.conversation.otherUser;
  const order = detail?.conversation.order;
  const rental = detail?.conversation.rental;
  const counterpartyGarments = detail?.conversation?.counterpartyGarments || [];
  const sellerGarments = detail?.conversation?.sellerGarments || [];

  const availableGarmentsList: ConversationGarment[] = useMemo(() => {
    if (activeGarmentsTab === 'seller' && sellerGarments.length > 0) {
      return sellerGarments;
    }
    if (counterpartyGarments.length > 0) {
      return counterpartyGarments;
    }
    return sellerGarments;
  }, [activeGarmentsTab, sellerGarments, counterpartyGarments]);

  const handleLinkGarment = async (targetGarment: ConversationGarment | null) => {
    if (!conversationId) return;
    try {
      hapticFeedback.medium();
      const res = await messageService.linkGarment(conversationId, targetGarment ? targetGarment.id : null);
      setSelectedActiveGarment(res.garment);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              conversation: {
                ...prev.conversation,
                garment: res.garment,
              },
            }
          : null
      );
      if (targetGarment) {
        showToast(`Linked "${targetGarment.title}" to this chat!`);
      } else {
        showToast('Active piece unlinked from chat');
      }
    } catch (err) {
      showToast('Could not link piece to chat');
    }
  };

  const effectiveGarment = selectedActiveGarment || garment;
  const isMyGarment = Boolean(
    effectiveGarment &&
      (effectiveGarment.sellerId === user?.id ||
        (effectiveGarment as any).seller?.id === user?.id ||
        (effectiveGarment as any).userId === user?.id)
  );

  const isRentalInquiry = useMemo(() => {
    if (rental) return true;
    if (garment?.listingType === 'RENTAL' || (garment?.rentalPriceDay && Number(garment.rentalPriceDay) > 0)) return true;
    return displayMessages.some((m) =>
      /\b(rent|rents|rental|rentals|renting|rented|lease|leasing|leased|lender|deposit|borrow)\b/i.test(m.content || '')
    );
  }, [rental, garment, displayMessages]);

  const isSwapInquiry = useMemo(() => {
    if (order || garment?.listingType === 'SALE') return false;
    if (swapId || swapDetails) return true;
    if (garment?.listingType === 'ACCESSORY_SWAP' || garment?.listingType === 'SWAP') return true;
    return displayMessages.some((m) =>
      /\b(swap|swaps|swapping|swapped|trade|trading|trades|traded)\b/i.test(m.content || '')
    );
  }, [order, swapId, swapDetails, garment, displayMessages]);

  const getGarmentMode = useCallback(
    (targetGarment: ConversationGarment | null | undefined) => {
      if (order || targetGarment?.listingType === 'SALE') return 'BUY';
      if (!targetGarment) return 'BUY';
      if (
        targetGarment.listingType === 'RENTAL' ||
        (targetGarment.rentalPriceDay && Number(targetGarment.rentalPriceDay) > 0) ||
        rental ||
        isRentalInquiry
      ) {
        return 'RENT';
      }
      if (
        targetGarment.listingType === 'ACCESSORY_SWAP' ||
        targetGarment.listingType === 'SWAP' ||
        swapId ||
        swapDetails ||
        isSwapInquiry
      ) {
        return 'SWAP';
      }
      return 'BUY';
    },
    [order, rental, isRentalInquiry, swapId, swapDetails, isSwapInquiry]
  );

  const garmentMode = getGarmentMode(effectiveGarment);

  const handleNavigateToProduct = (targetGarment: any) => {
    if (!targetGarment?.id) return;
    const isRental =
      targetGarment.listingType === 'RENTAL' ||
      (targetGarment.rentalPriceDay && Number(targetGarment.rentalPriceDay) > 0);
    const isSwap =
      targetGarment.listingType === 'ACCESSORY_SWAP' ||
      targetGarment.listingType === 'SWAP';

    if (isRental) {
      router.push(`/(tabs)/rental/${targetGarment.id}` as any);
    } else if (isSwap) {
      router.push(`/(tabs)/swap/${targetGarment.id}` as any);
    } else {
      router.push(`/(tabs)/shop/${targetGarment.id}` as any);
    }
  };

  const handleOpenTransactionsHub = () => {
    setShowTransactionsHub(true);
    hapticFeedback.light();
  };

  const formatHandle = (u?: { username?: string | null; displayName?: string | null }) => {
    if (!u) return 'member';
    if (u.username && !u.username.startsWith('user_')) return u.username;
    if (u.displayName && !u.displayName.startsWith('user_')) return u.displayName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    return 'member';
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/messages')} 
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.charcoal} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerUserInfo}
          onPress={() => other?.id && router.push(`/(tabs)/shop/seller/${other.id}` as any)}
          activeOpacity={0.7}
        >
          <KaphorImage uri={other?.avatar || ''} style={styles.headerAvatar} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {other?.displayName}
              </Text>
              {other?.isVerified && <VerifiedBadge size="compact" />}
            </View>
            <Text style={styles.headerHandle}>
              {isPartnerTyping ? 'typing...' : `@${formatHandle(other)} • View Profile`}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          <TouchableOpacity 
            style={styles.profileBtn} 
            onPress={handleOpenTransactionsHub}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Ionicons name="cube-outline" size={20} color={colors.charcoal} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.profileBtn} 
            onPress={() => other?.id && router.push(`/(tabs)/shop/seller/${other.id}` as any)}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Ionicons name="person-circle-outline" size={24} color={colors.charcoal} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.reportBtn} onPress={handleReport} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            <Ionicons name="shield-outline" size={18} color={colors.charcoal} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.reportBtn} 
            onPress={handleDeleteConversation} 
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityLabel="Delete Conversation"
          >
            <Ionicons name="trash-outline" size={18} color={colors.red || '#C1413A'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Swap Items Images & Ongoing Transaction Coordination Card */}
      {swapId && (
        <TouchableOpacity
          style={styles.swapCoordinationBar}
          onPress={() => navigateToLiveSwapStage(router, swapDetails || swapId, user?.id)}
          activeOpacity={0.88}
        >
          {/* Top Banner Row */}
          <View style={styles.swapHeaderRow}>
            <View style={styles.swapHeaderBadge}>
              <Ionicons name="swap-horizontal" size={12} color={colors.white} />
              <Text style={styles.swapHeaderBadgeText}>SWAP #{swapId.slice(0, 8).toUpperCase()}</Text>
            </View>
            <View style={[
              styles.swapStageStatusPill,
              swapDetails?.status === 'COMPLETED' ? { backgroundColor: '#1E3B2F' } :
              swapDetails?.status === 'SHIPPED' || swapDetails?.status === 'BOTH_SHIPPED' ? { backgroundColor: '#8C6D3B' } :
              { backgroundColor: '#3A3A3C' }
            ]}>
              <Text style={styles.swapStageStatusText}>
                {swapDetails?.status ? swapDetails.status.replace(/_/g, ' ') : 'ACTIVE TRADE'}
              </Text>
            </View>
          </View>

          {/* Dual Items Preview Row (Offered <-> Wanted) */}
          <View style={styles.swapItemsRow}>
            {/* Offered Item */}
            <View style={styles.swapItemCol}>
              <View style={styles.swapThumbWrap}>
                {swapDetails?.offeredGarment?.images?.[0] || swapDetails?.garmentOffered?.images?.[0] ? (
                  <Image
                    source={{ uri: swapDetails.offeredGarment?.images?.[0] || swapDetails.garmentOffered?.images?.[0] }}
                    style={styles.swapThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.swapThumb, styles.swapThumbPlaceholder]}>
                    <Ionicons name="shirt-outline" size={18} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.swapRoleTagOffered}>
                  <Text style={styles.swapRoleTagText}>OFFERED</Text>
                </View>
              </View>
              <Text style={styles.swapItemTitle} numberOfLines={1}>
                {swapDetails?.offeredGarment?.title || swapDetails?.garmentOffered?.title || 'Offered Item'}
              </Text>
              <Text style={styles.swapItemPrice}>
                ₹{((swapDetails?.offeredGarment?.price ?? swapDetails?.garmentOffered?.price) != null)
                  ? Number(swapDetails?.offeredGarment?.price ?? swapDetails?.garmentOffered?.price).toLocaleString()
                  : '—'}
              </Text>
            </View>

            {/* Central Trade Icon */}
            <View style={styles.swapCenterIndicator}>
              <View style={styles.swapExchangeCircle}>
                <Ionicons name="swap-horizontal" size={14} color={colors.charcoal} />
              </View>
              <Text style={styles.swapCenterHint}>VIEW STAGE →</Text>
            </View>

            {/* Wanted Item */}
            <View style={styles.swapItemCol}>
              <View style={styles.swapThumbWrap}>
                {swapDetails?.wantedGarment?.images?.[0] || swapDetails?.garmentWanted?.images?.[0] ? (
                  <Image
                    source={{ uri: swapDetails.wantedGarment?.images?.[0] || swapDetails.garmentWanted?.images?.[0] }}
                    style={styles.swapThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.swapThumb, styles.swapThumbPlaceholder]}>
                    <Ionicons name="sparkles-outline" size={18} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.swapRoleTagWanted}>
                  <Text style={styles.swapRoleTagText}>WANTED</Text>
                </View>
              </View>
              <Text style={styles.swapItemTitle} numberOfLines={1}>
                {swapDetails?.wantedGarment?.title || swapDetails?.garmentWanted?.title || 'Wanted Item'}
              </Text>
              <Text style={styles.swapItemPrice}>
                ₹{((swapDetails?.wantedGarment?.price ?? swapDetails?.garmentWanted?.price) != null)
                  ? Number(swapDetails?.wantedGarment?.price ?? swapDetails?.garmentWanted?.price).toLocaleString()
                  : '—'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Active Order Coordination Bar (if an order is linked to this thread) */}
      {order && (
        <View style={styles.orderCoordinationBar}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
            onPress={() => router.push(`/(tabs)/shop/orders/${order.id}` as any)}
            activeOpacity={0.8}
          >
            <View style={styles.orderIconBox}>
              <Ionicons name="cube" size={16} color={colors.cream} />
            </View>
            <View style={styles.orderCoordinationInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.orderCoordinationTitle}>ORDER #{order.id.slice(0, 8).toUpperCase()}</Text>
                <View style={styles.orderStatusChip}>
                  <Text style={styles.orderStatusChipText}>{order.status}</Text>
                </View>
              </View>
              <Text style={styles.orderCoordinationSub} numberOfLines={1}>
                ₹{Math.round(order.totalAmount).toLocaleString('en-IN')} · Active Order
              </Text>
            </View>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {(effectiveGarment || garment)?.id && (
              <TouchableOpacity
                style={[styles.viewOrderBtn, { backgroundColor: '#EDE8DD', borderWidth: 1, borderColor: colors.charcoal }]}
                onPress={() => setModalGarment((effectiveGarment || garment) ?? null)}
                activeOpacity={0.8}
              >
                <Text style={[styles.viewOrderText, { color: colors.charcoal }]}>VIEW ITEM</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.viewOrderBtn}
              onPress={() => router.push(`/(tabs)/shop/orders/${order.id}` as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewOrderText}>TRACK →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Active Rental Lease Coordination Bar (if a rental lease is active) */}
      {rental && (
        <View style={styles.rentalCoordinationBar}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
            onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
            activeOpacity={0.8}
          >
            <View style={styles.rentalIconBox}>
              <Ionicons name="calendar" size={16} color={colors.cream} />
            </View>
            <View style={styles.rentalCoordinationInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.rentalCoordinationTitle}>RENTAL #{rental.id.slice(0, 8).toUpperCase()}</Text>
                <View style={styles.rentalStatusChip}>
                  <Text style={styles.rentalStatusChipText}>{rental.status?.replace(/_/g, ' ') || 'ACTIVE'}</Text>
                </View>
              </View>
              <Text style={styles.rentalCoordinationSub} numberOfLines={1}>
                ₹{Math.round(rental.totalPrice ?? rental.totalAmount ?? 0).toLocaleString('en-IN')} · Active Lease Agreement
              </Text>
            </View>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {(effectiveGarment || garment)?.id && (
              <TouchableOpacity
                style={[styles.viewOrderBtn, { backgroundColor: '#EDE8DD', borderWidth: 1, borderColor: colors.charcoal }]}
                onPress={() => setModalGarment((effectiveGarment || garment) ?? null)}
                activeOpacity={0.8}
              >
                <Text style={[styles.viewOrderText, { color: colors.charcoal }]}>PIECE</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.viewOrderBtn, { backgroundColor: colors.forest || '#1E3B2F' }]}
              onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewOrderText}>LEASE →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Context Banner: Garment Detail Card vs Wardrobe Strip vs Direct Coordination */}
      {effectiveGarment && !swapDetails ? (
        <View style={styles.garmentDetailCard}>
          <TouchableOpacity
            style={styles.garmentCardLeft}
            onPress={() => setModalGarment(effectiveGarment)}
            activeOpacity={0.8}
          >
            {(effectiveGarment.image || effectiveGarment.images?.[0]) && (
              <View style={styles.garmentCardThumbWrapper}>
                <KaphorImage
                  uri={effectiveGarment.image || effectiveGarment.images?.[0] || ''}
                  style={styles.garmentCardThumb}
                  contentFit="cover"
                />
                <View style={styles.garmentCardZoomIcon}>
                  <Ionicons name="expand" size={10} color={colors.cream} />
                </View>
              </View>
            )}

            <View style={styles.garmentCardMain}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.garmentCardBrand}>
                  {effectiveGarment.brand?.toUpperCase() || 'KAPHOR ARCHIVE'}
                </Text>
                <View
                  style={[
                    styles.intentModeBadge,
                    garmentMode === 'RENT'
                      ? { backgroundColor: '#F3E8FF', borderColor: '#8B5CF6' }
                      : garmentMode === 'SWAP'
                      ? { backgroundColor: '#FEF3C7', borderColor: '#D97706' }
                      : { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
                  ]}
                >
                  <Text
                    style={[
                      styles.intentModeBadgeText,
                      { color: garmentMode === 'RENT' ? '#6B21A8' : garmentMode === 'SWAP' ? '#92400E' : '#065F46' },
                    ]}
                  >
                    {isMyGarment
                      ? garmentMode === 'RENT'
                        ? 'LENDING'
                        : garmentMode === 'SWAP'
                        ? 'YOUR SWAP'
                        : 'SELLING'
                      : garmentMode === 'RENT'
                      ? 'RENTING'
                      : garmentMode === 'SWAP'
                      ? 'SWAPPING'
                      : 'BUYING'}
                  </Text>
                </View>
              </View>

              <Text style={styles.garmentCardTitle} numberOfLines={1}>
                {effectiveGarment.title}
              </Text>

              {/* Specs & Pricing Line */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <Text style={styles.garmentCardPrice}>
                  {garmentMode === 'RENT'
                    ? `₹${Math.round(effectiveGarment.rentalPriceDay || effectiveGarment.price || 0).toLocaleString('en-IN')}/day`
                    : garmentMode === 'SWAP'
                    ? 'Swap Piece'
                    : `₹${Math.round(effectiveGarment.price || 0).toLocaleString('en-IN')}`}
                </Text>
                {effectiveGarment.size ? (
                  <View style={styles.specMiniPill}>
                    <Text style={styles.specMiniPillText}>SIZE {effectiveGarment.size.toUpperCase()}</Text>
                  </View>
                ) : null}
                {effectiveGarment.condition ? (
                  <View style={styles.specMiniPill}>
                    <Text style={styles.specMiniPillText}>{effectiveGarment.condition.toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>

          {/* Card Action Buttons */}
          <View style={styles.garmentCardActions}>
            <TouchableOpacity
              style={styles.garmentDetailsBtn}
              onPress={() => setModalGarment(effectiveGarment)}
              activeOpacity={0.8}
            >
              <Ionicons name="information-circle-outline" size={13} color={colors.charcoal} />
              <Text style={styles.garmentDetailsBtnText}>DETAILS</Text>
            </TouchableOpacity>

            {isMyGarment ? (
              <TouchableOpacity
                style={[styles.garmentActionBtn, { backgroundColor: colors.charcoal }]}
                onPress={() => router.push(`/(tabs)/shop/edit/${effectiveGarment.id}` as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.garmentActionBtnText}>EDIT</Text>
              </TouchableOpacity>
            ) : garmentMode === 'RENT' ? (
              <TouchableOpacity
                style={[styles.garmentActionBtn, { backgroundColor: '#6B46C1' }]}
                onPress={() => router.push(`/(tabs)/rental/${effectiveGarment.id}` as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.garmentActionBtnText}>RENT →</Text>
              </TouchableOpacity>
            ) : garmentMode === 'SWAP' ? (
              <TouchableOpacity
                style={[styles.garmentActionBtn, { backgroundColor: '#8C6D3B' }]}
                onPress={() => router.push(`/(tabs)/swap/${effectiveGarment.id}` as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.garmentActionBtnText}>SWAP →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.garmentActionBtn, { backgroundColor: colors.forest || '#1E3B2F' }]}
                onPress={() => router.push(`/(tabs)/shop/${effectiveGarment.id}` as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.garmentActionBtnText}>BUY →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (counterpartyGarments.length > 0 || sellerGarments.length > 0) ? (
        /* Wardrobe Strip (when no garment is pre-linked, displays seller/atelier pieces for selection) */
        <View style={styles.wardrobeStripContainer}>
          <View style={styles.wardrobeStripHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Ionicons name="shirt-outline" size={13} color={colors.charcoal} />
              {counterpartyGarments.length > 0 && sellerGarments.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setActiveGarmentsTab('counterparty')}
                    style={[
                      styles.wardrobeTabMini,
                      activeGarmentsTab === 'counterparty' && styles.wardrobeTabMiniActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.wardrobeTabMiniText,
                        activeGarmentsTab === 'counterparty' && styles.wardrobeTabMiniTextActive,
                      ]}
                    >
                      {other?.displayName ? `${other.displayName.toUpperCase()}'S` : 'SELLER'} ({counterpartyGarments.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setActiveGarmentsTab('seller')}
                    style={[
                      styles.wardrobeTabMini,
                      activeGarmentsTab === 'seller' && styles.wardrobeTabMiniActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.wardrobeTabMiniText,
                        activeGarmentsTab === 'seller' && styles.wardrobeTabMiniTextActive,
                      ]}
                    >
                      YOUR ATELIER ({sellerGarments.length})
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.wardrobeStripTitle} numberOfLines={1}>
                  {counterpartyGarments.length > 0
                    ? (other?.displayName ? `${other.displayName.toUpperCase()}'S PIECES (${counterpartyGarments.length})` : 'SELLER WARDROBE')
                    : `YOUR ATELIER PIECES (${sellerGarments.length})`}
                </Text>
              )}
            </View>
            <Text style={styles.wardrobeStripSubtitle}>Tap to link to chat</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.wardrobeStripScroll}
          >
            {availableGarmentsList.map((cg: ConversationGarment) => {
              const cgMode = getGarmentMode(cg);
              const isLinked = false;
              return (
                <View
                  key={cg.id}
                  style={styles.wardrobeStripCard}
                >
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}
                    onPress={() => setModalGarment(cg)}
                    activeOpacity={0.8}
                  >
                    <KaphorImage
                      uri={cg.image || cg.images?.[0] || ''}
                      style={styles.wardrobeStripThumb}
                      contentFit="cover"
                    />
                    <View style={styles.wardrobeStripCardBody}>
                      <Text style={styles.wardrobeStripCardBrand} numberOfLines={1}>
                        {cg.brand?.toUpperCase() || 'ARCHIVE'}
                      </Text>
                      <Text style={styles.wardrobeStripCardTitle} numberOfLines={1}>
                        {cg.title}
                      </Text>
                      <Text style={styles.wardrobeStripCardPrice}>
                        {cgMode === 'RENT'
                          ? `₹${Math.round(cg.rentalPriceDay || cg.price || 0)}/d`
                          : cgMode === 'SWAP'
                          ? 'SWAP'
                          : `₹${Math.round(cg.price || 0)}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.wardrobeStripLinkBtn,
                      isLinked && { backgroundColor: '#1E3B2F' },
                    ]}
                    onPress={() => handleLinkGarment(cg)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name={isLinked ? 'checkmark' : 'link'} size={11} color={colors.white} />
                    <Text style={styles.wardrobeStripLinkBtnText}>{isLinked ? 'LINKED' : 'LINK'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : !order && !rental ? (
        isRentalInquiry ? (
          <View style={[styles.rentalCoordinationBar, { backgroundColor: '#F9F6FE', borderBottomColor: '#6B46C1' }]}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
              onPress={() => router.push('/(tabs)/rental' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.rentalIconBox, { backgroundColor: '#6B46C1' }]}>
                <Ionicons name="calendar" size={16} color={colors.cream} />
              </View>
              <View style={styles.rentalCoordinationInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.rentalCoordinationTitle}>RENTAL INQUIRY & LEASING</Text>
                  <View style={[styles.rentalStatusChip, { backgroundColor: 'rgba(107,70,193,0.15)' }]}>
                    <Text style={[styles.rentalStatusChipText, { color: '#6B46C1' }]}>RENT</Text>
                  </View>
                </View>
                <Text style={styles.rentalCoordinationSub} numberOfLines={1}>
                  Direct rental negotiation, fittings & reservations
                </Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.viewOrderBtn, { backgroundColor: '#EDE8DD', borderWidth: 1, borderColor: colors.charcoal }]}
                onPress={() => router.push('/(tabs)/rental?tab=my' as any)}
                activeOpacity={0.8}
              >
                <Text style={[styles.viewOrderText, { color: colors.charcoal }]}>LEASES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewOrderBtn, { backgroundColor: '#6B46C1' }]}
                onPress={() => router.push('/(tabs)/rental' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewOrderText}>RENTALS →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : isSwapInquiry ? (
          <View style={[styles.rentalCoordinationBar, { backgroundColor: '#FAF7EE', borderBottomColor: '#8C6D3B' }]}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
              onPress={() => router.push('/(tabs)/swap' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.rentalIconBox, { backgroundColor: '#8C6D3B' }]}>
                <Ionicons name="swap-horizontal" size={16} color={colors.cream} />
              </View>
              <View style={styles.rentalCoordinationInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.rentalCoordinationTitle}>SWAP & TRADE INQUIRY</Text>
                  <View style={[styles.rentalStatusChip, { backgroundColor: 'rgba(140,109,59,0.15)' }]}>
                    <Text style={[styles.rentalStatusChipText, { color: '#8C6D3B' }]}>SWAP</Text>
                  </View>
                </View>
                <Text style={styles.rentalCoordinationSub} numberOfLines={1}>
                  Circular wardrobe exchange & item trades
                </Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.viewOrderBtn, { backgroundColor: '#EDE8DD', borderWidth: 1, borderColor: colors.charcoal }]}
                onPress={() => router.push('/(tabs)/orders?tab=swaps' as any)}
                activeOpacity={0.8}
              >
                <Text style={[styles.viewOrderText, { color: colors.charcoal }]}>TRADES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewOrderBtn, { backgroundColor: '#8C6D3B' }]}
                onPress={() => router.push('/(tabs)/swap' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewOrderText}>VAULT →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.directSellerBar}>
            <View style={styles.directIconCircle}>
              <Ionicons name="storefront" size={16} color={colors.forest || '#2D5A27'} />
            </View>
            <View style={styles.directSellerInfo}>
              <Text style={styles.directSellerTitle}>DIRECT ATELIER CHAT</Text>
              <Text style={styles.directSellerSub} numberOfLines={1}>
                Direct negotiation, custom styling & closet deals
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.viewOrderBtn, { backgroundColor: '#EDE8DD', borderWidth: 1, borderColor: colors.charcoal }]}
                onPress={() => router.push('/(tabs)/orders' as any)}
                activeOpacity={0.8}
              >
                <Text style={[styles.viewOrderText, { color: colors.charcoal }]}>ORDERS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewClosetBtn}
                onPress={() => other?.id && router.push(`/(tabs)/shop/seller/${other.id}` as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewClosetText}>CLOSET →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      ) : null}

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={displayMessages}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={null}
        onContentSizeChange={() => {
          if (!showScrollBottom) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const isMine = item.senderId === user?.id;
          const parsed = parseReplyContent(item.content || '');

          const prevMsg = index > 0 ? displayMessages[index - 1] : null;
          const nextMsg = index < displayMessages.length - 1 ? displayMessages[index + 1] : null;

          const showDateDivider =
            index === 0 ||
            new Date(item.createdAt).toDateString() !==
              new Date(displayMessages[index - 1]?.createdAt).toDateString();

          const isSameSenderAsPrev =
            !showDateDivider &&
            prevMsg &&
            prevMsg.senderId === item.senderId &&
            Math.abs(new Date(item.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 120000;

          const isSameSenderAsNext =
            nextMsg &&
            nextMsg.senderId === item.senderId &&
            Math.abs(new Date(nextMsg.createdAt).getTime() - new Date(item.createdAt).getTime()) < 120000 &&
            new Date(nextMsg.createdAt).toDateString() === new Date(item.createdAt).toDateString();

          const itemDate = new Date(item.createdAt);
          const today = new Date();
          const yesterday = new Date();
          yesterday.setDate(today.getDate() - 1);

          let dateLabel = itemDate.toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }).toUpperCase();

          if (itemDate.toDateString() === today.toDateString()) {
            dateLabel = 'TODAY';
          } else if (itemDate.toDateString() === yesterday.toDateString()) {
            dateLabel = 'YESTERDAY';
          }

          const dynamicBubbleCorners = isMine
            ? {
                borderTopLeftRadius: 16,
                borderBottomLeftRadius: 16,
                borderTopRightRadius: isSameSenderAsPrev ? 16 : 4,
                borderBottomRightRadius: isSameSenderAsNext ? 16 : 4,
                marginBottom: isSameSenderAsNext ? 3 : 10,
              }
            : {
                borderTopRightRadius: 16,
                borderBottomRightRadius: 16,
                borderTopLeftRadius: isSameSenderAsPrev ? 16 : 4,
                borderBottomLeftRadius: isSameSenderAsNext ? 16 : 4,
                marginBottom: isSameSenderAsNext ? 3 : 10,
              };

          return (
            <View>
              {showDateDivider && (
                <View style={styles.dateDivider}>
                  <View style={styles.dateDividerPill}>
                    <Text style={styles.dateDividerText}>{dateLabel}</Text>
                  </View>
                </View>
              )}

              <SwipeableMessageBubble
                onSwipeReply={() => handleStartReply(item)}
                isMine={isMine}
              >
                <View
                  style={[
                    styles.bubbleWrapper,
                    isMine ? styles.myBubbleWrapper : styles.theirBubbleWrapper,
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.bubble,
                      isMine ? styles.myBubble : styles.theirBubble,
                      dynamicBubbleCorners,
                    ]}
                    onLongPress={() => {
                      setActionMessage(item);
                      hapticFeedback.medium();
                    }}
                    activeOpacity={0.92}
                    delayLongPress={220}
                  >
                    {/* WhatsApp-Style Quoted Message Header */}
                    {parsed.replyTo && (
                      <TouchableOpacity
                        style={[
                          styles.quoteContainer,
                          isMine ? styles.myQuoteContainer : styles.theirQuoteContainer,
                        ]}
                        onPress={() => scrollToMessage(parsed.replyTo!.id)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.quoteAccentBar,
                            isMine ? styles.myQuoteAccent : styles.theirQuoteAccent,
                          ]}
                        />
                        <View style={styles.quoteContent}>
                          <Text
                            style={[
                              styles.quoteSender,
                              isMine ? styles.myQuoteSender : styles.theirQuoteSender,
                            ]}
                            numberOfLines={1}
                          >
                            {parsed.replyTo.senderName}
                          </Text>
                          <Text
                            style={[
                              styles.quoteText,
                              isMine ? styles.myQuoteText : styles.theirQuoteText,
                            ]}
                            numberOfLines={2}
                          >
                            {parsed.replyTo.content}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* In-Message Product Snippet */}
                    {(() => {
                      const text = parsed.text || '';
                      const isRentalMsg = text.includes('[RENTAL RESERVATION]') || text.includes('[RENTAL APPROVED]');
                      const isSwapMsg = text.includes('[SWAP PROPOSAL]');

                      let displayGarment = effectiveGarment;

                      if (isRentalMsg) {
                        const titleMatch = text.match(/rental request for "([^"]+)"/i) || text.match(/dates for "([^"]+)"/i);
                        if (titleMatch && titleMatch[1]) {
                          const targetTitle = titleMatch[1].trim().toLowerCase();
                          const allAvailable: any[] = [
                            ...(detail?.conversation?.sellerGarments || []),
                            ...(detail?.conversation?.counterpartyGarments || []),
                            (detail?.conversation as any)?.rental?.garment,
                            garment,
                          ].filter(Boolean);
                          const matched = allAvailable.find((g: any) =>
                            g.title?.trim().toLowerCase() === targetTitle ||
                            targetTitle.includes(g.title?.trim().toLowerCase()) ||
                            g.title?.trim().toLowerCase().includes(targetTitle)
                          );
                          displayGarment = matched || ((detail?.conversation as any)?.rental?.garment?.title?.toLowerCase().includes(targetTitle) ? (detail?.conversation as any)?.rental?.garment : null);
                        } else if ((detail?.conversation as any)?.rental?.garment) {
                          displayGarment = (detail?.conversation as any)?.rental?.garment;
                        }
                      } else if (isSwapMsg) {
                        displayGarment = null;
                      } else {
                        const shouldShowSnippet = (
                          index === 0 ||
                          /\b(rent|rental|lease|swap|trade|buy|order|price|this|dress|piece|item|garment|jacket|shirt|pant|size)\b/i.test(text)
                        );
                        if (!shouldShowSnippet) displayGarment = null;
                      }

                      if (!displayGarment) return null;

                      return (
                        <TouchableOpacity
                          style={[
                            styles.inBubbleProductSnippet,
                            isMine ? styles.inBubbleSnippetMine : styles.inBubbleSnippetTheir,
                          ]}
                          onPress={() => setModalGarment(displayGarment)}
                          activeOpacity={0.88}
                        >
                          <KaphorImage
                            uri={displayGarment.image || displayGarment.images?.[0] || ''}
                            style={styles.inBubbleSnippetThumb}
                            contentFit="cover"
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.inBubbleSnippetBrand,
                                isMine ? { color: '#EAE6DB' } : { color: colors.copper },
                              ]}
                              numberOfLines={1}
                            >
                              {displayGarment.brand?.toUpperCase() || 'ARCHIVE'}
                            </Text>
                            <Text
                              style={[
                                styles.inBubbleSnippetTitle,
                                isMine ? { color: colors.white } : { color: colors.charcoal },
                              ]}
                              numberOfLines={1}
                            >
                              {displayGarment.title}
                            </Text>
                            <Text
                              style={[
                                styles.inBubbleSnippetPrice,
                                isMine ? { color: '#C9A84C' } : { color: colors.charcoal },
                              ]}
                            >
                              {isRentalMsg || displayGarment.rentalPriceDay
                                ? `₹${Math.round(displayGarment.rentalPriceDay || displayGarment.price || 0)}/day (Rent)`
                                : displayGarment.listingType === 'ACCESSORY_SWAP'
                                ? 'Swap Piece'
                                : `₹${Math.round(displayGarment.price || 0)}`}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.inBubbleSnippetBtn,
                              isMine
                                ? { backgroundColor: 'rgba(255,255,255,0.2)' }
                                : { backgroundColor: colors.charcoal },
                            ]}
                          >
                            <Text
                              style={[
                                styles.inBubbleSnippetBtnText,
                                isMine ? { color: colors.white } : { color: colors.cream },
                              ]}
                            >
                              DETAILS
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })()}

                    {item.imageUrl && (
                      <TouchableOpacity
                        onPress={() => setViewingImage(item.imageUrl || null)}
                        activeOpacity={0.9}
                      >
                        <KaphorImage
                          uri={item.imageUrl}
                          style={styles.bubbleImage}
                          contentFit="cover"
                        />
                      </TouchableOpacity>
                    )}

                    {parsed.text && parsed.text !== '📷 Photo' && (
                      <Text
                        style={[
                          styles.bubbleText,
                          isMine ? styles.myBubbleText : styles.theirBubbleText,
                        ]}
                      >
                        {parsed.text}
                      </Text>
                    )}

                    {/* Quick interactive transaction button if message is a swap proposal */}
                    {Boolean(parsed.text && parsed.text.includes('[SWAP PROPOSAL]')) && (
                      <TouchableOpacity
                        style={[
                          styles.chatTransactionActionBtn,
                          isMine
                            ? { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)' }
                            : { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
                        ]}
                        onPress={() => router.push(swapId ? `/(tabs)/swap/details?swapId=${swapId}` as any : '/(tabs)/orders?tab=swaps' as any)}
                        activeOpacity={0.88}
                      >
                        <Ionicons name="swap-horizontal" size={13} color={isMine ? colors.white : colors.cream} />
                        <Text style={[styles.chatTransactionActionText, isMine ? { color: colors.white } : { color: colors.cream }]}>
                          {isMine ? 'VIEW SWAP DETAILS ➔' : 'REVIEW & RESPOND TO SWAP ➔'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Quick interactive transaction button if message is a rental request or approval */}
                    {Boolean(parsed.text && (parsed.text.includes('[RENTAL RESERVATION]') || parsed.text.includes('[RENTAL APPROVED]'))) && (
                      <TouchableOpacity
                        style={[
                          styles.chatTransactionActionBtn,
                          parsed.text?.includes('[RENTAL APPROVED]')
                            ? { backgroundColor: colors.forest || '#2A7B4C', borderColor: colors.forest || '#2A7B4C' }
                            : isMine
                            ? { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)' }
                            : { backgroundColor: '#B45309', borderColor: '#B45309' },
                        ]}
                        onPress={() => {
                          const rentalIdMatch = parsed.text?.match(/Lease ID:\s*([a-zA-Z0-9_-]+)/);
                          const targetRentalId = rentalIdMatch
                            ? rentalIdMatch[1]
                            : ((detail?.conversation as any)?.rental?.id || (detail?.conversation as any)?.rentalId);
                          if (targetRentalId) {
                            router.push(`/(tabs)/rental/lease/${targetRentalId}` as any);
                          } else {
                            router.push('/(tabs)/rental?tab=my' as any);
                          }
                        }}
                        activeOpacity={0.88}
                      >
                        <Ionicons
                          name={parsed.text?.includes('[RENTAL APPROVED]') ? 'card-outline' : 'calendar-outline'}
                          size={13}
                          color={colors.white}
                        />
                        <Text style={[styles.chatTransactionActionText, { color: colors.white }]}>
                          {parsed.text?.includes('[RENTAL APPROVED]')
                            ? (isMine ? 'VIEW LEASE DOSSIER ➔' : 'PROCEED TO PAYMENT ➔')
                            : (isMine ? 'VIEW RENTAL DOSSIER ➔' : 'REVIEW & APPROVE DATES ➔')}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {item.isFlagged && (
                      <View style={styles.flaggedWarning}>
                        <Ionicons name="warning" size={12} color={colors.red} />
                        <Text style={styles.flaggedWarningText}>
                          Potential off-platform payment detected
                        </Text>
                      </View>
                    )}

                    {/* Integrated WhatsApp-Style Timestamp & Double Checkmarks */}
                    <View style={styles.timeRow}>
                      <Text
                        style={[
                          styles.timeText,
                          isMine ? styles.myTimeText : styles.theirTimeText,
                        ]}
                      >
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      {isMine && (
                        <Ionicons
                          name={item.readAt ? 'checkmark-done' : 'checkmark'}
                          size={13}
                          color={item.readAt ? '#C9A84C' : 'rgba(247,244,235,0.7)'}
                          style={{ marginLeft: 3 }}
                        />
                      )}
                    </View>

                    {/* Instagram/WhatsApp-Style Anchored Reaction Badges */}
                    {reactionsByMessageId[item.id] && reactionsByMessageId[item.id].length > 0 && (
                      <View style={[styles.reactionBadgeContainer, isMine ? styles.reactionBadgeMine : styles.reactionBadgeTheir]}>
                        {reactionsByMessageId[item.id].map((r: { emoji: string; count: number; userReacted: boolean }, rIdx: number) => (
                          <TouchableOpacity
                            key={rIdx}
                            style={[
                              styles.reactionBadgePill,
                              r.userReacted && styles.reactionBadgePillActive,
                            ]}
                            onPress={() => handleToggleReaction(item.id, r.emoji)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.reactionBadgeEmoji}>{r.emoji}</Text>
                            {r.count > 1 && (
                              <Text style={[styles.reactionBadgeCount, r.userReacted && styles.reactionBadgeCountActive]}>
                                {r.count}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </SwipeableMessageBubble>
            </View>
          );
        }}
      />

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottom && (
        <TouchableOpacity
          style={[
            styles.floatingScrollBtn,
            {
              bottom: isKeyboardVisible
                ? (Platform.OS === 'ios' ? 76 : 70)
                : Math.max(insets.bottom + 12, Platform.OS === 'android' ? 32 : 20) + 55,
            },
          ]}
          onPress={() => {
            hapticFeedback.light();
            flatListRef.current?.scrollToEnd({ animated: true });
            setShowScrollBottom(false);
            setUnreadWhileScrolled(0);
          }}
          activeOpacity={0.88}
        >
          <Ionicons name="chevron-down" size={20} color={colors.charcoal} />
          {unreadWhileScrolled > 0 && (
            <View style={styles.floatingScrollBadge}>
              <Text style={styles.floatingScrollBadgeText}>{unreadWhileScrolled}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Typing Indicator */}
      {isPartnerTyping && (
        <View style={styles.typingWrap}>
          <Text style={styles.typingText}>
            {other?.displayName || 'Partner'} is typing...
          </Text>
        </View>
      )}

      {/* Selected Image Preview Bar */}
      {selectedImage && (
        <View style={styles.imagePreviewBar}>
          <KaphorImage uri={selectedImage} style={styles.imagePreviewThumb} contentFit="cover" />
          <Text style={styles.imagePreviewText}>Image attached</Text>
          <TouchableOpacity
            style={styles.removeImageBtn}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close-circle" size={20} color={colors.red} />
          </TouchableOpacity>
        </View>
      )}

      {/* Replying Preview Bar */}
      {replyingTo && (
        <View style={styles.replyPreviewBar}>
          <View style={styles.replyBarAccent} />
          <View style={styles.replyBarContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="arrow-undo" size={12} color={colors.forest || '#2D5A27'} />
              <Text style={styles.replyBarSender}>Replying to {replyingTo.senderName}</Text>
            </View>
            <Text style={styles.replyBarText} numberOfLines={1}>
              {replyingTo.content}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cancelReplyBtn}
            onPress={() => setReplyingTo(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Proper Modern Pill Input Bar */}
      <View
        style={[
          styles.inputContainer,
          {
            paddingBottom: isKeyboardVisible
              ? (Platform.OS === 'ios' ? 8 : 8)
              : Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={pickImage}
          activeOpacity={0.75}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="add" size={24} color={colors.charcoal} />
        </TouchableOpacity>

        <View style={[styles.inputWrapper, isInputFocused && styles.inputWrapperFocused]}>
          <TextInput
            style={styles.input}
            placeholder={replyingTo ? `Replying to ${replyingTo.senderName}...` : "Message..."}
            placeholderTextColor="rgba(30,31,34,0.4)"
            value={inputText}
            onChangeText={handleInputChange}
            onFocus={() => {
              setInputFocused(true);
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
            }}
            onBlur={() => setInputFocused(false)}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            style={styles.cameraQuickBtn}
            onPress={openCameraDirectly}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="camera" size={20} color={isInputFocused ? colors.charcoal : colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!inputText.trim() && !selectedImage) || sending ? styles.sendBtnDisabled : styles.sendBtnActive,
          ]}
          onPress={handleSend}
          disabled={(!inputText.trim() && !selectedImage) || sending}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator color={colors.cream} size="small" />
          ) : (
            <Ionicons
              name="arrow-up"
              size={20}
              color={(!inputText.trim() && !selectedImage) ? colors.textMuted : colors.cream}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Full-Screen Zoomable Image Viewer Modal */}
      <Modal
        visible={!!viewingImage}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingImage(null)}
        statusBarTranslucent
      >
        <View style={styles.fullImageModal}>
          <TouchableOpacity
            style={styles.closeFullImageBtn}
            onPress={() => setViewingImage(null)}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.zoomInstructionWrap}>
            <Ionicons name="scan-outline" size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.zoomInstructionText}>PINCH TO ZOOM</Text>
          </View>

          {viewingImage && (
            <ScrollView
              style={{ flex: 1, width: '100%' }}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
              maximumZoomScale={5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <KaphorImage
                uri={viewingImage}
                style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }}
                contentFit="contain"
                fallbackIcon="image-outline"
              />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Message Action Sheet Modal with WhatsApp-Style Quick Emoji Bar */}
      <Modal
        visible={!!actionMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMessage(null)}
      >
        <TouchableOpacity
          style={styles.actionModalBackdrop}
          activeOpacity={1}
          onPress={() => setActionMessage(null)}
        >
          <View style={styles.actionModalSheet}>
            {/* WhatsApp Floating Reaction Bar */}
            <View style={styles.reactionBarContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.reactionBarScroll}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionEmojiBtn}
                    onPress={() => handleSendReaction(emoji)}
                    activeOpacity={0.65}
                  >
                    <Text style={styles.reactionEmojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.actionModalHeader}>
              <Text style={styles.actionModalTitle}>MESSAGE ACTIONS</Text>
            </View>

            <TouchableOpacity
              style={styles.actionModalItem}
              onPress={() => actionMessage && handleStartReply(actionMessage)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#EBF3ED' }]}>
                <Ionicons name="arrow-undo" size={16} color={colors.forest || '#2D5A27'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionItemTitle}>Reply to Message</Text>
                <Text style={styles.actionItemSub}>Quote this message in your reply</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionModalItem}
              onPress={() => {
                if (actionMessage) {
                  const parsed = parseReplyContent(actionMessage.content);
                  const textToCopy = parsed.text || (actionMessage.imageUrl ? 'Photo attachment' : '');
                  setInputText(textToCopy);
                  setActionMessage(null);
                  showToast('Text copied into message input!');
                }
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#F5F0E8' }]}>
                <Ionicons name="copy-outline" size={16} color={colors.charcoal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionItemTitle}>Copy Text</Text>
                <Text style={styles.actionItemSub}>Copy content into input box</Text>
              </View>
            </TouchableOpacity>

            {actionMessage?.imageUrl && (
              <TouchableOpacity
                style={styles.actionModalItem}
                onPress={() => {
                  setViewingImage(actionMessage.imageUrl || null);
                  setActionMessage(null);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconBox, { backgroundColor: '#E8EFF9' }]}>
                  <Ionicons name="expand-outline" size={16} color={colors.navy || '#1E3A8A'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionItemTitle}>View Photo</Text>
                  <Text style={styles.actionItemSub}>Full-screen pinch & zoom</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionModalCancel}
              onPress={() => setActionMessage(null)}
            >
              <Text style={styles.actionModalCancelText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* In-Chat Garment Dossier Modal */}
      <Modal
        visible={!!modalGarment}
        transparent
        animationType="slide"
        onRequestClose={() => setModalGarment(null)}
      >
        <View style={styles.garmentModalOverlay}>
          <TouchableOpacity
            style={styles.garmentModalBackdrop}
            activeOpacity={1}
            onPress={() => setModalGarment(null)}
          />
          <View style={[styles.garmentModalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            {/* Modal Header */}
            <View style={styles.garmentModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shirt-outline" size={16} color={colors.charcoal} />
                <Text style={styles.garmentModalHeaderTitle}>GARMENT DOSSIER & TERMS</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalGarment(null)}
                style={styles.garmentModalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={colors.charcoal} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.garmentModalBody}>
              {/* Product Images Gallery */}
              {modalGarment && (
                <View style={styles.garmentModalGallery}>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={(e) => {
                      const offset = e.nativeEvent.contentOffset.x;
                      const cardWidth = SCREEN_WIDTH - 40;
                      if (cardWidth > 0) {
                        const idx = Math.round(offset / cardWidth);
                        setModalImageIndex(idx);
                      }
                    }}
                    scrollEventThrottle={16}
                  >
                    {(modalGarment.images && modalGarment.images.length > 0
                      ? modalGarment.images
                      : [modalGarment.image || '']
                    )
                      .filter(Boolean)
                      .map((imgUri: string, idx: number) => (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.95}
                          onPress={() => setViewingImage(imgUri)}
                          style={{ width: SCREEN_WIDTH - 40, height: 260 }}
                        >
                          <KaphorImage
                            uri={imgUri}
                            style={styles.garmentModalLargeImage}
                            contentFit="cover"
                          />
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                  {(modalGarment.images?.length || 0) > 1 && (
                    <View style={styles.galleryIndicatorRow}>
                      {modalGarment.images?.map((_: any, idx: number) => (
                        <View
                          key={idx}
                          style={[
                            styles.galleryDot,
                            idx === modalImageIndex ? styles.galleryDotActive : null,
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Transaction Mode Banner */}
              {modalGarment &&
                (() => {
                  const mode = getGarmentMode(modalGarment);
                  const isMine =
                    modalGarment.sellerId === user?.id ||
                    (modalGarment as any).seller?.id === user?.id ||
                    (modalGarment as any).userId === user?.id;
                  return (
                    <View
                      style={[
                        styles.garmentModeBanner,
                        mode === 'RENT'
                          ? { backgroundColor: '#F3E8FF', borderColor: '#8B5CF6' }
                          : mode === 'SWAP'
                          ? { backgroundColor: '#FEF3C7', borderColor: '#D97706' }
                          : { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
                      ]}
                    >
                      <Ionicons
                        name={
                          mode === 'RENT'
                            ? 'calendar-outline'
                            : mode === 'SWAP'
                            ? 'swap-horizontal'
                            : 'pricetag-outline'
                        }
                        size={18}
                        color={mode === 'RENT' ? '#6B21A8' : mode === 'SWAP' ? '#92400E' : '#065F46'}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.garmentModeBannerTitle,
                            {
                              color:
                                mode === 'RENT' ? '#6B21A8' : mode === 'SWAP' ? '#92400E' : '#065F46',
                            },
                          ]}
                        >
                          {isMine
                            ? `YOUR LISTED PIECE (${mode === 'RENT' ? 'RENTAL' : mode === 'SWAP' ? 'SWAP' : 'FOR SALE'})`
                            : mode === 'RENT'
                            ? `RENTING FROM @${formatHandle(other).toUpperCase()}`
                            : mode === 'SWAP'
                            ? `SWAPPING WITH @${formatHandle(other).toUpperCase()}`
                            : `BUYING FROM @${formatHandle(other).toUpperCase()}`}
                        </Text>
                        <Text style={styles.garmentModeBannerSub}>
                          {mode === 'RENT'
                            ? 'Available for short-term lease & events. Fully covered under Kaphor Damage Protection.'
                            : mode === 'SWAP'
                            ? 'Circular wardrobe trade piece. Direct courier exchange with authenticity audit.'
                            : 'Direct purchase item. Dispatched with buyer protection & tracked courier.'}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

              {/* Title & Brand & Financials */}
              {modalGarment && (
                <View style={styles.garmentModalTitleSection}>
                  <Text style={styles.garmentModalBrand}>
                    {modalGarment.brand?.toUpperCase() || 'KAPHOR ARCHIVE'}
                  </Text>
                  <Text style={styles.garmentModalTitle}>{modalGarment.title}</Text>

                  <View style={styles.garmentModalPricingRow}>
                    {getGarmentMode(modalGarment) === 'RENT' ? (
                      <View>
                        <Text style={styles.garmentModalPrice}>
                          ₹
                          {modalGarment.rentalPriceDay
                            ? Math.round(modalGarment.rentalPriceDay).toLocaleString('en-IN')
                            : modalGarment.price}
                          <Text style={styles.garmentModalPriceUnit}> / DAY</Text>
                        </Text>
                        {modalGarment.rentalPriceWeek ? (
                          <Text style={styles.garmentModalSecondaryPrice}>
                            ₹{Math.round(modalGarment.rentalPriceWeek).toLocaleString('en-IN')} / week
                          </Text>
                        ) : null}
                      </View>
                    ) : getGarmentMode(modalGarment) === 'SWAP' ? (
                      <View>
                        <Text style={styles.garmentModalPrice}>SWAP VAULT PIECE</Text>
                        <Text style={styles.garmentModalSecondaryPrice}>
                          Estimated Valuation: ₹{modalGarment.price?.toLocaleString('en-IN') || 'Negotiable'}
                        </Text>
                      </View>
                    ) : (
                      <View>
                        <Text style={styles.garmentModalPrice}>
                          ₹
                          {modalGarment.price
                            ? Math.round(modalGarment.price).toLocaleString('en-IN')
                            : 'Contact Seller'}
                        </Text>
                        <Text style={styles.garmentModalSecondaryPrice}>
                          Free standard dispatch & inspection
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Specifications Grid */}
              {modalGarment && (
                <View style={styles.garmentSpecsGrid}>
                  <View style={styles.garmentSpecBox}>
                    <Text style={styles.garmentSpecLabel}>SIZE</Text>
                    <Text style={styles.garmentSpecValue}>{modalGarment.size || 'One Size'}</Text>
                  </View>
                  <View style={styles.garmentSpecBox}>
                    <Text style={styles.garmentSpecLabel}>CONDITION</Text>
                    <Text style={styles.garmentSpecValue}>{modalGarment.condition || 'Pristine'}</Text>
                  </View>
                  <View style={styles.garmentSpecBox}>
                    <Text style={styles.garmentSpecLabel}>CATEGORY</Text>
                    <Text style={styles.garmentSpecValue}>{modalGarment.category || 'Apparel'}</Text>
                  </View>
                  <View style={styles.garmentSpecBox}>
                    <Text style={styles.garmentSpecLabel}>AUTHENTICITY</Text>
                    <Text style={[styles.garmentSpecValue, { color: colors.forest || '#166534' }]}>
                      VERIFIED
                    </Text>
                  </View>
                </View>
              )}

              {/* Description & Curator Notes */}
              {modalGarment && (
                <View style={styles.garmentModalDescSection}>
                  <Text style={styles.garmentModalSectionHeading}>DESCRIPTION & FIT NOTES</Text>
                  <Text style={styles.garmentModalDescText}>
                    {modalGarment.description ||
                      'Authentic archival piece curated from private collector wardrobe. Hand-inspected and verified for craftsmanship.'}
                  </Text>
                </View>
              )}

              {/* In-Chat Action Buttons */}
              {modalGarment &&
                (() => {
                  const mode = getGarmentMode(modalGarment);
                  const isMine =
                    modalGarment.sellerId === user?.id ||
                    (modalGarment as any).seller?.id === user?.id ||
                    (modalGarment as any).userId === user?.id;
                  return (
                    <View style={styles.garmentModalActions}>
                      {isMine ? (
                        <TouchableOpacity
                          style={[styles.garmentModalPrimaryBtn, { backgroundColor: colors.charcoal }]}
                          onPress={() => {
                            setModalGarment(null);
                            router.push(`/(tabs)/shop/edit/${modalGarment.id}` as any);
                          }}
                        >
                          <Ionicons name="create-outline" size={16} color={colors.cream} />
                          <Text style={styles.garmentModalPrimaryBtnText}>EDIT LISTING</Text>
                        </TouchableOpacity>
                      ) : mode === 'RENT' ? (
                        <TouchableOpacity
                          style={[styles.garmentModalPrimaryBtn, { backgroundColor: '#6B46C1' }]}
                          onPress={() => {
                            setModalGarment(null);
                            router.push(`/(tabs)/rental/${modalGarment.id}` as any);
                          }}
                        >
                          <Ionicons name="calendar" size={16} color={colors.cream} />
                          <Text style={styles.garmentModalPrimaryBtnText}>BOOK / RESERVE DATES</Text>
                        </TouchableOpacity>
                      ) : mode === 'SWAP' ? (
                        <TouchableOpacity
                          style={[styles.garmentModalPrimaryBtn, { backgroundColor: '#8C6D3B' }]}
                          onPress={() => {
                            setModalGarment(null);
                            router.push(`/(tabs)/swap/${modalGarment.id}` as any);
                          }}
                        >
                          <Ionicons name="swap-horizontal" size={16} color={colors.cream} />
                          <Text style={styles.garmentModalPrimaryBtnText}>PROPOSE SWAP PROPOSAL</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.garmentModalPrimaryBtn, { backgroundColor: colors.forest || '#1E3B2F' }]}
                          onPress={() => {
                            setModalGarment(null);
                            router.push(`/(tabs)/shop/${modalGarment.id}` as any);
                          }}
                        >
                          <Ionicons name="bag-check-outline" size={16} color={colors.cream} />
                          <Text style={styles.garmentModalPrimaryBtnText}>BUY NOW / CHECKOUT</Text>
                        </TouchableOpacity>
                      )}

                      {/* Secondary Action: Inquire in chat */}
                      <TouchableOpacity
                        style={styles.garmentModalSecondaryBtn}
                        onPress={() => {
                          setSelectedActiveGarment(modalGarment);
                          const prompt = `Hi @${other?.displayName || 'there'}, discussing the ${modalGarment.brand ? modalGarment.brand + ' ' : ''}${modalGarment.title} (Size: ${modalGarment.size || 'Free'}): `;
                          setInputText(prompt);
                          setModalGarment(null);
                          showToast('Piece attached to message input!');
                        }}
                      >
                        <Ionicons
                          name="chatbubble-ellipses-outline"
                          size={16}
                          color={colors.charcoal}
                        />
                        <Text style={styles.garmentModalSecondaryBtnText}>
                          DISCUSS THIS PIECE IN CHAT
                        </Text>
                      </TouchableOpacity>

                      {/* Anchor / Link this piece as the conversation's active transaction piece */}
                      <TouchableOpacity
                        style={[
                          styles.garmentModalSecondaryBtn,
                          {
                            backgroundColor: effectiveGarment?.id === modalGarment.id ? '#EBF3ED' : '#FAF7EE',
                            borderColor: effectiveGarment?.id === modalGarment.id ? '#1E3B2F' : '#C9A84C',
                            borderWidth: 1,
                          },
                        ]}
                        onPress={() => {
                          handleLinkGarment(modalGarment);
                          setModalGarment(null);
                        }}
                      >
                        <Ionicons
                          name={effectiveGarment?.id === modalGarment.id ? 'checkmark-circle' : 'link'}
                          size={16}
                          color={effectiveGarment?.id === modalGarment.id ? '#1E3B2F' : colors.charcoal}
                        />
                        <Text
                          style={[
                            styles.garmentModalSecondaryBtnText,
                            effectiveGarment?.id === modalGarment.id && { color: '#1E3B2F' },
                          ]}
                        >
                          {effectiveGarment?.id === modalGarment.id
                            ? 'ACTIVE TRANSACTION PIECE IN CHAT ✓'
                            : 'LINK AS ACTIVE CHAT PIECE'}
                        </Text>
                      </TouchableOpacity>

                      {/* Full Product Page Navigation */}
                      <TouchableOpacity
                        style={styles.garmentModalLinkBtn}
                        onPress={() => {
                          setModalGarment(null);
                          handleNavigateToProduct(modalGarment);
                        }}
                      >
                        <Text style={styles.garmentModalLinkText}>Open Full Standalone Page ↗</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Transactions & Products Hub Modal (Box Button Hub) */}
      <Modal
        visible={showTransactionsHub}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTransactionsHub(false)}
      >
        <View style={styles.garmentModalOverlay}>
          <TouchableOpacity
            style={styles.garmentModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowTransactionsHub(false)}
          />
          <View style={[styles.garmentModalSheet, { maxHeight: '85%', paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            {/* Modal Header */}
            <View style={styles.garmentModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="cube" size={18} color={colors.charcoal} />
                <Text style={styles.garmentModalHeaderTitle}>PRODUCTS & TRANSACTIONS HUB</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowTransactionsHub(false)}
                style={styles.garmentModalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={colors.charcoal} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16 }}>
              {/* 1. Currently Linked Active Product */}
              <View style={styles.hubSection}>
                <Text style={styles.hubSectionLabel}>ACTIVE CONVERSATION PIECE</Text>
                {effectiveGarment ? (
                  <View style={styles.hubGarmentCard}>
                    <KaphorImage
                      uri={effectiveGarment.image || effectiveGarment.images?.[0] || ''}
                      style={styles.hubGarmentThumb}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hubGarmentBrand}>{effectiveGarment.brand?.toUpperCase() || 'ARCHIVE'}</Text>
                      <Text style={styles.hubGarmentTitle} numberOfLines={1}>{effectiveGarment.title}</Text>
                      <Text style={styles.hubGarmentPrice}>
                        {garmentMode === 'RENT'
                          ? `₹${Math.round(effectiveGarment.rentalPriceDay || effectiveGarment.price || 0)} / day (Rental)`
                          : garmentMode === 'SWAP'
                          ? 'Swap Piece'
                          : `₹${Math.round(effectiveGarment.price || 0)} (For Sale)`}
                      </Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      <TouchableOpacity
                        style={styles.hubActionMiniBtn}
                        onPress={() => {
                          setShowTransactionsHub(false);
                          setModalGarment(effectiveGarment);
                        }}
                      >
                        <Text style={styles.hubActionMiniText}>VIEW</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.hubActionMiniBtn, { backgroundColor: '#FBEBEB', borderColor: '#DC2626' }]}
                        onPress={() => {
                          handleLinkGarment(null);
                        }}
                      >
                        <Text style={[styles.hubActionMiniText, { color: '#DC2626' }]}>UNLINK</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.hubEmptyCard}>
                    <Ionicons name="shirt-outline" size={22} color={colors.textMuted} />
                    <Text style={styles.hubEmptyText}>
                      No item is currently anchored to this conversation. Select a piece below to link it.
                    </Text>
                  </View>
                )}
              </View>

              {/* 2. Available Pieces to Link (Counterparty & Seller Pieces) */}
              {(counterpartyGarments.length > 0 || sellerGarments.length > 0) && (
                <View style={styles.hubSection}>
                  <Text style={styles.hubSectionLabel}>AVAILABLE PIECES FOR THIS CHAT</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    {counterpartyGarments.length > 0 && (
                      <TouchableOpacity
                        style={[
                          styles.hubTabPill,
                          activeGarmentsTab === 'counterparty' && styles.hubTabPillActive,
                        ]}
                        onPress={() => setActiveGarmentsTab('counterparty')}
                      >
                        <Text
                          style={[
                            styles.hubTabPillText,
                            activeGarmentsTab === 'counterparty' && styles.hubTabPillTextActive,
                          ]}
                        >
                          {other?.displayName ? `${other.displayName.toUpperCase()}'S` : 'SELLER'} ({counterpartyGarments.length})
                        </Text>
                      </TouchableOpacity>
                    )}
                    {sellerGarments.length > 0 && (
                      <TouchableOpacity
                        style={[
                          styles.hubTabPill,
                          activeGarmentsTab === 'seller' && styles.hubTabPillActive,
                        ]}
                        onPress={() => setActiveGarmentsTab('seller')}
                      >
                        <Text
                          style={[
                            styles.hubTabPillText,
                            activeGarmentsTab === 'seller' && styles.hubTabPillTextActive,
                          ]}
                        >
                          YOUR ATELIER ({sellerGarments.length})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {availableGarmentsList.map((g: ConversationGarment) => {
                      const isLinked = Boolean(effectiveGarment && effectiveGarment.id === g.id);
                      return (
                        <View key={g.id} style={styles.hubGarmentPillCard}>
                          <KaphorImage
                            uri={g.image || g.images?.[0] || ''}
                            style={styles.hubGarmentPillThumb}
                            contentFit="cover"
                          />
                          <Text style={styles.hubGarmentPillTitle} numberOfLines={1}>
                            {g.title}
                          </Text>
                          <Text style={styles.hubGarmentPillPrice}>
                            ₹{Math.round(g.rentalPriceDay || g.price || 0)}
                            {g.rentalPriceDay ? '/d' : ''}
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.hubGarmentPillBtn,
                              isLinked && { backgroundColor: '#1E3B2F' },
                            ]}
                            onPress={() => {
                              handleLinkGarment(g);
                            }}
                          >
                            <Text style={styles.hubGarmentPillBtnText}>
                              {isLinked ? 'LINKED ✓' : 'LINK TO CHAT'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 3. Transaction Portals & Fast Jumps */}
              <View style={styles.hubSection}>
                <Text style={styles.hubSectionLabel}>QUICK NAVIGATION PORTALS</Text>
                
                <TouchableOpacity
                  style={styles.hubLinkItem}
                  onPress={() => {
                    setShowTransactionsHub(false);
                    router.push('/(tabs)/rental' as any);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.hubLinkIcon, { backgroundColor: '#F3E8FF' }]}>
                    <Ionicons name="calendar-outline" size={16} color="#6B21A8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hubLinkTitle}>Browse Rental Pieces</Text>
                    <Text style={styles.hubLinkSub}>Explore designer pieces available for rent</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.hubLinkItem}
                  onPress={() => {
                    setShowTransactionsHub(false);
                    router.push('/(tabs)/rental?tab=my' as any);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.hubLinkIcon, { backgroundColor: '#EBF3ED' }]}>
                    <Ionicons name="document-text-outline" size={16} color={colors.forest || '#1E3B2F'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hubLinkTitle}>My Active Leases & Returns</Text>
                    <Text style={styles.hubLinkSub}>Track current rentals, end dates & returns</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.hubLinkItem}
                  onPress={() => {
                    setShowTransactionsHub(false);
                    router.push('/(tabs)/orders' as any);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.hubLinkIcon, { backgroundColor: '#F5F0E8' }]}>
                    <Ionicons name="bag-check-outline" size={16} color={colors.charcoal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hubLinkTitle}>My Orders & Purchases</Text>
                    <Text style={styles.hubLinkSub}>Track deliveries, payments & past receipts</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.hubLinkItem}
                  onPress={() => {
                    setShowTransactionsHub(false);
                    router.push('/(tabs)/orders?tab=swaps' as any);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.hubLinkIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="swap-horizontal" size={16} color="#92400E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hubLinkTitle}>Swap Deals & Trade Vault</Text>
                    <Text style={styles.hubLinkSub}>Manage circular wardrobe proposals</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                {other?.id && (
                  <TouchableOpacity
                    style={styles.hubLinkItem}
                    onPress={() => {
                      setShowTransactionsHub(false);
                      router.push(`/(tabs)/shop/seller/${other.id}` as any);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.hubLinkIcon, { backgroundColor: '#E8EFF9' }]}>
                      <Ionicons name="storefront-outline" size={16} color="#1E3A8A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hubLinkTitle}>
                        {other.displayName ? `${other.displayName}'s Wardrobe` : 'Seller Profile'}
                      </Text>
                      <Text style={styles.hubLinkSub}>Browse all items in seller's public archive</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Floating In-App Toast */}
      {toastMessage && (
        <View style={[styles.toastContainer, { top: Math.max(insets.top + 50, 70) }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.cream} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  headerName: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.charcoal,
  },
  headerHandle: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileBtn: {
    padding: 4,
  },
  reportBtn: {
    padding: 4,
  },
  garmentDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(30,31,34,0.12)',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  garmentCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  garmentCardThumbWrapper: {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  garmentCardThumb: {
    width: '100%',
    height: '100%',
  },
  garmentCardZoomIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(30,31,34,0.7)',
    borderRadius: 3,
    padding: 2,
  },
  garmentCardMain: {
    flex: 1,
  },
  garmentCardBrand: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.copper,
    letterSpacing: 0.5,
  },
  intentModeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 1,
  },
  intentModeBadgeText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  garmentCardTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
    marginTop: 1,
  },
  garmentCardPrice: {
    fontFamily: typography.mono,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.charcoal,
  },
  specMiniPill: {
    backgroundColor: '#F1EFEA',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  specMiniPillText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '800',
    color: colors.textMuted,
  },
  garmentCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  garmentDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 6,
    backgroundColor: '#F1EFEA',
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.3)',
    borderRadius: 3,
  },
  garmentDetailsBtnText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.4,
  },
  garmentActionBtn: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentActionBtnText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  wardrobeStripContainer: {
    backgroundColor: '#FAF7EE',
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(140,109,59,0.2)',
  },
  wardrobeStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  wardrobeStripTitle: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  wardrobeStripSubtitle: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    color: colors.textMuted,
  },
  wardrobeStripScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  wardrobeStripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
    gap: 8,
    minWidth: 140,
    maxWidth: 180,
  },
  wardrobeStripThumb: {
    width: 38,
    height: 38,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  wardrobeStripCardBody: {
    flex: 1,
  },
  wardrobeStripCardBrand: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: colors.copper,
  },
  wardrobeStripCardTitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.charcoal,
  },
  wardrobeStripCardPrice: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.charcoal,
    marginTop: 1,
  },
  swapCoordinationBar: {
    backgroundColor: '#FAF7EE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#C9A84C',
  },
  swapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  swapHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  swapHeaderBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.6,
  },
  swapStageStatusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 3,
  },
  swapStageStatusText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.6,
  },
  swapItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2DEC9',
  },
  swapItemCol: {
    flex: 1,
    alignItems: 'center',
  },
  swapThumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#F0EAE1',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
    position: 'relative',
  },
  swapThumb: {
    width: '100%',
    height: '100%',
  },
  swapThumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EAE6DB',
  },
  swapRoleTagOffered: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(30, 59, 47, 0.85)',
    paddingVertical: 1,
    alignItems: 'center',
  },
  swapRoleTagWanted: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(140, 109, 59, 0.85)',
    paddingVertical: 1,
    alignItems: 'center',
  },
  swapRoleTagText: {
    fontFamily: typography.mono,
    fontSize: 6.5,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.5,
  },
  swapItemTitle: {
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: '700',
    color: colors.charcoal,
    textAlign: 'center',
    width: '100%',
  },
  swapItemPrice: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.crimson,
    marginTop: 1,
  },
  swapCenterIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  swapExchangeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FAF7EE',
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  swapCenterHint: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: '#8C6D3B',
    letterSpacing: 0.5,
  },
  orderCoordinationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F4EB',
    padding: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.forest,
    gap: 10,
  },
  orderIconBox: {
    width: 34,
    height: 34,
    borderRadius: 4,
    backgroundColor: colors.forest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderCoordinationInfo: {
    flex: 1,
  },
  orderCoordinationTitle: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  orderStatusChip: {
    backgroundColor: 'rgba(40,54,24,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  orderStatusChipText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: colors.forest,
    letterSpacing: 0.5,
  },
  orderCoordinationSub: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  rentalCoordinationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F8F5',
    padding: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.forest,
    gap: 10,
  },
  rentalIconBox: {
    width: 34,
    height: 34,
    borderRadius: 4,
    backgroundColor: colors.forest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rentalCoordinationInfo: {
    flex: 1,
  },
  rentalCoordinationTitle: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  rentalStatusChip: {
    backgroundColor: colors.forest,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  rentalStatusChipText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  rentalCoordinationSub: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  viewOrderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.charcoal,
  },
  viewOrderText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  directSellerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
    gap: 10,
  },
  directIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(45,90,39,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45,90,39,0.2)',
  },
  directSellerInfo: {
    flex: 1,
  },
  directSellerTitle: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.forest || '#2D5A27',
    letterSpacing: 0.5,
  },
  directSellerSub: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    marginTop: 1,
  },
  viewClosetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.charcoal,
  },
  viewClosetText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  safetyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30,59,47,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,59,47,0.1)',
  },
  safetyNoticeText: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.forest,
    fontWeight: '700',
  },
  quickChipsWrapper: {
    backgroundColor: '#FAF9F6',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.08)',
  },
  quickChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  quickChipText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    color: colors.charcoal,
  },
  garmentModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  garmentModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  garmentModalSheet: {
    backgroundColor: '#FAF9F6',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: SCREEN_HEIGHT * 0.88,
    borderTopWidth: 2,
    borderColor: colors.charcoal,
    overflow: 'hidden',
  },
  garmentModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
  },
  garmentModalHeaderTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  garmentModalCloseBtn: {
    padding: 4,
  },
  garmentModalBody: {
    padding: 16,
    gap: 14,
  },
  garmentModalGallery: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  garmentModalLargeImage: {
    width: '100%',
    height: '100%',
  },
  galleryIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: 'rgba(30,31,34,0.05)',
  },
  galleryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(30,31,34,0.25)',
  },
  galleryDotActive: {
    width: 14,
    backgroundColor: colors.charcoal,
  },
  garmentModeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  garmentModeBannerTitle: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  garmentModeBannerSub: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.charcoal,
    lineHeight: 12,
  },
  garmentModalTitleSection: {
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.1)',
  },
  garmentModalBrand: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.copper,
    letterSpacing: 0.6,
  },
  garmentModalTitle: {
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '900',
    color: colors.charcoal,
    marginVertical: 4,
  },
  garmentModalPricingRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.08)',
  },
  garmentModalPrice: {
    fontFamily: typography.mono,
    fontSize: 16,
    fontWeight: '900',
    color: colors.charcoal,
  },
  garmentModalPriceUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  garmentModalSecondaryPrice: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  garmentSpecsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  garmentSpecBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.white,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.1)',
  },
  garmentSpecLabel: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  garmentSpecValue: {
    fontFamily: typography.mono,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.charcoal,
    marginTop: 2,
  },
  garmentModalDescSection: {
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.1)',
  },
  garmentModalSectionHeading: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  garmentModalDescText: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    color: colors.charcoal,
    lineHeight: 15,
  },
  garmentModalActions: {
    gap: 8,
    marginTop: 6,
  },
  garmentModalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 6,
  },
  garmentModalPrimaryBtnText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.8,
  },
  garmentModalSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  garmentModalSecondaryBtnText: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.6,
  },
  garmentModalLinkBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  garmentModalLinkText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  dateDivider: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateDividerPill: {
    backgroundColor: '#EBE8DF',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 1.5,
    elevation: 1,
  },
  dateDividerText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleWrapper: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  myBubbleWrapper: {
    justifyContent: 'flex-end',
  },
  theirBubbleWrapper: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    padding: 12,
  },
  myBubble: {
    backgroundColor: colors.charcoal,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  theirBubble: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  bubbleImage: {
    width: 210,
    height: 160,
    borderRadius: 6,
    marginBottom: 6,
  },
  bubbleText: {
    fontFamily: typography.mono,
    fontSize: 11,
    lineHeight: 16,
  },
  myBubbleText: {
    color: colors.cream,
  },
  theirBubbleText: {
    color: colors.charcoal,
  },
  flaggedWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(196,30,58,0.1)',
    padding: 4,
    marginTop: 6,
    borderRadius: 4,
  },
  flaggedWarningText: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.red,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeText: {
    fontFamily: typography.mono,
    fontSize: 8,
  },
  myTimeText: {
    color: 'rgba(247,244,235,0.6)',
  },
  theirTimeText: {
    color: colors.textMuted,
  },
  typingWrap: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  typingText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  imagePreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EBE8DF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.1)',
    gap: 10,
  },
  imagePreviewThumb: {
    width: 36,
    height: 36,
    borderRadius: 4,
  },
  imagePreviewText: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.charcoal,
  },
  removeImageBtn: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#FAF9F6',
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.08)',
    gap: 8,
  },
  attachBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: 'rgba(30,31,34,0.12)',
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: 'rgba(30,31,34,0.14)',
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 44,
    maxHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  inputWrapperFocused: {
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOpacity: 0.1,
  },
  input: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 18,
    maxHeight: 110,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingRight: 6,
    textAlignVertical: 'center',
  },
  cameraQuickBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendBtnActive: {
    backgroundColor: colors.charcoal,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: '#EBE8DF',
    shadowOpacity: 0,
    elevation: 0,
  },
  fullImageModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  closeFullImageBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageView: {
    width: '100%',
    height: '85%',
  },
  roleBadgePill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  sellerPill: {
    backgroundColor: 'rgba(196,112,79,0.15)',
  },
  buyerPill: {
    backgroundColor: 'rgba(40,54,24,0.12)',
  },
  roleBadgePillText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  zoomInstructionWrap: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 10,
  },
  zoomInstructionText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
  },
  // WhatsApp-style Quote Container inside Bubble
  quoteContainer: {
    flexDirection: 'row',
    borderRadius: 6,
    marginBottom: 6,
    overflow: 'hidden',
  },
  myQuoteContainer: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  theirQuoteContainer: {
    backgroundColor: 'rgba(30,31,34,0.06)',
  },
  quoteAccentBar: {
    width: 3.5,
  },
  myQuoteAccent: {
    backgroundColor: '#C9A84C',
  },
  theirQuoteAccent: {
    backgroundColor: colors.forest || '#2D5A27',
  },
  quoteContent: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  quoteSender: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  myQuoteSender: {
    color: '#C9A84C',
  },
  theirQuoteSender: {
    color: colors.forest || '#2D5A27',
  },
  quoteText: {
    fontFamily: typography.mono,
    fontSize: 8,
    lineHeight: 12,
  },
  myQuoteText: {
    color: 'rgba(247,244,235,0.75)',
  },
  theirQuoteText: {
    color: colors.textMuted,
  },
  // Reply Preview Bar above Input Box
  replyPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F0E6',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.12)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: 'rgba(30,31,34,0.08)',
    borderRightColor: 'rgba(30,31,34,0.08)',
    marginHorizontal: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  replyBarAccent: {
    width: 3,
    height: '100%',
    backgroundColor: colors.forest || '#2D5A27',
    borderRadius: 2,
  },
  replyBarContent: {
    flex: 1,
  },
  replyBarSender: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.forest || '#2D5A27',
    letterSpacing: 0.5,
  },
  replyBarText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.charcoal,
    marginTop: 1,
  },
  cancelReplyBtn: {
    padding: 4,
  },
  // Message Actions Modal Sheet
  actionModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionModalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
  },
  actionModalHeader: {
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
  },
  actionModalTitle: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  actionModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.06)',
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionItemTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
  },
  actionItemSub: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    marginTop: 1,
  },
  actionModalCancel: {
    marginTop: 14,
    paddingVertical: 12,
    backgroundColor: '#F5F0E8',
    borderRadius: 8,
    alignItems: 'center',
  },
  actionModalCancelText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  // Swipe to reply styles
  swipeContainer: {
    position: 'relative',
    width: '100%',
  },
  swipeReplyIconWrap: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  swipeReplyCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBF3ED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45,90,39,0.2)',
  },
  // Floating Scroll to Bottom
  floatingScrollBtn: {
    position: 'absolute',
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    zIndex: 50,
  },
  floatingScrollBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.forest || '#2D5A27',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  floatingScrollBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.cream,
  },
  // Reaction Bar
  reactionBarContainer: {
    backgroundColor: '#F5F0E8',
    borderRadius: 28,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 16,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  reactionBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  reactionEmojiBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reactionEmojiText: {
    fontSize: 22,
  },
  // Instagram / WhatsApp Reaction Badges
  reactionBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: -8,
    marginBottom: 4,
    zIndex: 10,
  },
  reactionBadgeMine: {
    alignSelf: 'flex-end',
    marginRight: 6,
  },
  reactionBadgeTheir: {
    alignSelf: 'flex-start',
    marginLeft: 6,
  },
  reactionBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(30,31,34,0.14)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  reactionBadgePillActive: {
    backgroundColor: '#FAF5EA',
    borderColor: colors.charcoal,
  },
  reactionBadgeEmoji: {
    fontSize: 12,
  },
  reactionBadgeCount: {
    fontSize: 9.5,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.textMuted,
    marginLeft: 3,
  },
  reactionBadgeCountActive: {
    color: colors.charcoal,
  },
  // Toast
  toastContainer: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 999,
  },
  toastText: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  // Wardrobe strip tabs & link button
  wardrobeTabMini: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#EAE6DB',
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
  },
  wardrobeTabMiniActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  wardrobeTabMiniText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.4,
  },
  wardrobeTabMiniTextActive: {
    color: colors.cream,
  },
  wardrobeStripLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 3,
    alignSelf: 'center',
  },
  wardrobeStripLinkBtnText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.4,
  },
  // In-Message Deal Card (ListHeaderComponent)
  inMessageDealCard: {
    backgroundColor: colors.white,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(30,31,34,0.15)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  inMessageDealTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2DEC9',
  },
  inMessageDealModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 3,
  },
  inMessageDealModeText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.5,
  },
  inMessageDealUnlinkText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.copper,
  },
  inMessageDealContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
  },
  inMessageDealThumb: {
    width: 44,
    height: 44,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  inMessageDealBrand: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.copper,
  },
  inMessageDealTitle: {
    fontFamily: typography.mono,
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.charcoal,
    marginTop: 1,
  },
  inMessageDealPrice: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.forest || '#1E3B2F',
    marginTop: 2,
  },
  inMessageDealAction: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#EDE8DD',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  inMessageDealActionText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.4,
  },
  inMessageSellerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FAF7EE',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2DEC9',
  },
  inMessageSellerBannerText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.charcoal,
  },
  // In-Bubble Product Snippet
  inBubbleProductSnippet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  inBubbleSnippetMine: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  inBubbleSnippetTheir: {
    backgroundColor: '#F7F4EB',
    borderWidth: 1,
    borderColor: '#E2DEC9',
  },
  inBubbleSnippetThumb: {
    width: 40,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.2)',
  },
  inBubbleSnippetBrand: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
  },
  inBubbleSnippetTitle: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    marginTop: 1,
  },
  inBubbleSnippetPrice: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
  },
  inBubbleSnippetBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 3,
  },
  inBubbleSnippetBtnText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  // Transactions Hub Modal Styles
  hubSection: {
    gap: 8,
  },
  hubSectionLabel: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  hubGarmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    gap: 10,
  },
  hubGarmentThumb: {
    width: 48,
    height: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  hubGarmentBrand: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.copper,
  },
  hubGarmentTitle: {
    fontFamily: typography.mono,
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.charcoal,
  },
  hubGarmentPrice: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.forest || '#1E3B2F',
    marginTop: 2,
  },
  hubActionMiniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 3,
    backgroundColor: '#EDE8DD',
    borderWidth: 1,
    borderColor: colors.charcoal,
    alignItems: 'center',
  },
  hubActionMiniText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.charcoal,
  },
  hubEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F2EA',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2DEC9',
  },
  hubEmptyText: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    lineHeight: 14,
  },
  hubTabPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: '#EAE6DB',
    borderWidth: 1,
    borderColor: '#D4CFC2',
  },
  hubTabPillActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  hubTabPillText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.charcoal,
  },
  hubTabPillTextActive: {
    color: colors.cream,
  },
  hubGarmentPillCard: {
    width: 130,
    backgroundColor: colors.white,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2DEC9',
    alignItems: 'center',
  },
  hubGarmentPillThumb: {
    width: 60,
    height: 60,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
    marginBottom: 6,
  },
  hubGarmentPillTitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.charcoal,
    textAlign: 'center',
    width: '100%',
  },
  hubGarmentPillPrice: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.forest || '#1E3B2F',
    marginTop: 2,
    marginBottom: 6,
  },
  hubGarmentPillBtn: {
    width: '100%',
    paddingVertical: 5,
    backgroundColor: colors.charcoal,
    borderRadius: 3,
    alignItems: 'center',
  },
  hubGarmentPillBtnText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: colors.cream,
  },
  hubLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE8DD',
  },
  hubLinkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubLinkTitle: {
    fontFamily: typography.mono,
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.charcoal,
  },
  hubLinkSub: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    marginTop: 1,
  },
  chatTransactionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 4,
  },
  chatTransactionActionText: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
