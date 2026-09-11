import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import {
  messageService,
  ConversationDetailResponse,
  DirectMessageItem,
} from '../../src/services/messageService';
import { useAuth } from '../../src/context/AuthContext';
import { getSocket, connectSocket } from '../../src/services/socket';
import { safeBack, useBackHandler } from '../../src/utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticFeedback } from '../../src/utils/haptics';

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
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  useBackHandler('/(tabs)/messages');

  const [detail, setDetail] = useState<ConversationDetailResponse | null>(null);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<QuotedReplyInfo | null>(null);
  const [actionMessage, setActionMessage] = useState<DirectMessageItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      let finalImgUrl: string | undefined = undefined;
      if (imgUri) {
        finalImgUrl = await uploadPhotoBase64(imgUri);
      }
      const result = await messageService.sendMessage(conversationId, content, finalImgUrl);
      setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? result.data : m)));
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
    const quoted = parseReplyContent(actionMessage.content);
    const isMine = actionMessage.senderId === user?.id;
    const senderName = isMine ? 'You' : (actionMessage.sender?.displayName || detail?.conversation.otherUser.displayName || 'Partner');
    const replySnippet = quoted.text || (actionMessage.imageUrl ? '📷 Photo' : 'message');
    const reactionText = `${emoji}`;
    setActionMessage(null);
    const finalContent = `[[REPLY:${actionMessage.id}|${senderName}|${replySnippet}]]${reactionText}`;
    sendCustomMessage(finalContent);
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
      // Replace optimistic message with actual DB message
      setMessages((prev) =>
        prev.map((m) => (m.id === tempMsg.id ? result.data : m))
      );

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

  const garment = detail?.conversation.garment;
  const other = detail?.conversation.otherUser;
  const order = detail?.conversation.order;

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.charcoal} />
      </View>
    );
  }

  const isMyGarment = !!garment && (garment.sellerId === user?.id || (garment as any).seller?.id === user?.id);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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
              {isPartnerTyping ? 'typing...' : `@${other?.username || 'user'} • View Profile`}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
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
        </View>
      </View>

      {/* Active Order Coordination Bar (if an order is linked to this thread) */}
      {order && (
        <TouchableOpacity
          style={styles.orderCoordinationBar}
          onPress={() => router.push(`/(tabs)/shop/orders/${order.id}` as any)}
          activeOpacity={0.85}
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
              ₹{(order.totalAmount / 100).toLocaleString('en-IN')} · Tap to view tracking & details
            </Text>
          </View>
          <View style={styles.viewOrderBtn}>
            <Text style={styles.viewOrderText}>TRACK →</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Context Banner: Garment Inquiry vs Direct Seller Chat */}
      {garment && !order ? (
        <TouchableOpacity
          style={styles.garmentBar}
          onPress={() => router.push(`/(tabs)/shop/${garment.id}` as any)}
          activeOpacity={0.85}
        >
          {garment.image && (
            <KaphorImage uri={garment.image} style={styles.garmentBarThumb} contentFit="cover" />
          )}
          <View style={styles.garmentBarInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.garmentBarBrand}>{garment.brand?.toUpperCase() || 'KAPHOR ARCHIVE'}</Text>
              <View style={[styles.roleBadgePill, isMyGarment ? styles.sellerPill : styles.buyerPill]}>
                <Text style={styles.roleBadgePillText}>{isMyGarment ? 'YOUR ITEM' : 'INQUIRING'}</Text>
              </View>
            </View>
            <Text style={styles.garmentBarTitle} numberOfLines={1}>
              {garment.title}
            </Text>
            {garment.price != null && (
              <Text style={styles.garmentBarPrice}>
                ₹{(garment.price / 100).toLocaleString('en-IN')}
                {garment.listingType === 'RENTAL' ? ' / day' : ''}
              </Text>
            )}
          </View>
          <View style={styles.viewListingBtn}>
            <Text style={styles.viewListingText}>VIEW</Text>
          </View>
        </TouchableOpacity>
      ) : !garment && !order ? (
        <TouchableOpacity
          style={styles.directSellerBar}
          onPress={() => other?.id && router.push(`/(tabs)/shop/seller/${other.id}` as any)}
          activeOpacity={0.85}
        >
          <View style={styles.directIconCircle}>
            <Ionicons name="storefront" size={16} color={colors.forest || '#2D5A27'} />
          </View>
          <View style={styles.directSellerInfo}>
            <Text style={styles.directSellerTitle}>DIRECT SELLER CHAT</Text>
            <Text style={styles.directSellerSub} numberOfLines={1}>
              Direct negotiation, custom styling & closet deals
            </Text>
          </View>
          <View style={styles.viewClosetBtn}>
            <Text style={styles.viewClosetText}>CLOSET →</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Safety Notice */}
      <View style={styles.safetyNotice}>
        <Ionicons name="lock-closed" size={11} color={colors.forest} />
        <Text style={styles.safetyNoticeText}>
          Kaphor Trust Shield: Keep transactions in-app for buyer & seller protection.
        </Text>
      </View>

      {/* Quick Deal Assist Chips */}
      {garment && (
        <View style={styles.quickChipsContainer}>
          {isMyGarment ? (
            <>
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => router.push(`/(tabs)/shop/edit/${garment.id}` as any)}
              >
                <Ionicons name="create-outline" size={12} color={colors.charcoal} />
                <Text style={styles.quickChipText}>EDIT YOUR LISTING</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => router.push(`/(tabs)/shop/${garment.id}` as any)}
              >
                <Ionicons name="eye-outline" size={12} color={colors.charcoal} />
                <Text style={styles.quickChipText}>VIEW LIVE DOSSIER</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {garment.listingType === 'ACCESSORY_SWAP' && (
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => router.push(`/(tabs)/swap/${garment.id}` as any)}
                >
                  <Ionicons name="swap-horizontal" size={12} color={colors.charcoal} />
                  <Text style={styles.quickChipText}>PROPOSE SWAP EXCHANGE</Text>
                </TouchableOpacity>
              )}
              {garment.listingType === 'RENTAL' && (
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => router.push({
                    pathname: '/(tabs)/rental/reserve',
                    params: { garmentId: garment.id, dayRate: String(garment.price || 0) },
                  } as any)}
                >
                  <Ionicons name="calendar-outline" size={12} color={colors.charcoal} />
                  <Text style={styles.quickChipText}>BOOK RENTAL</Text>
                </TouchableOpacity>
              )}
              {garment.listingType !== 'ACCESSORY_SWAP' && (
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => router.push(`/(tabs)/shop/${garment.id}` as any)}
                >
                  <Ionicons name="bag-check-outline" size={12} color={colors.charcoal} />
                  <Text style={styles.quickChipText}>BUY ITEM</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          if (!showScrollBottom) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const isMine = item.senderId === user?.id;
          const parsed = parseReplyContent(item.content || '');

          const prevMsg = index > 0 ? messages[index - 1] : null;
          const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;

          const showDateDivider =
            index === 0 ||
            new Date(item.createdAt).toDateString() !==
              new Date(messages[index - 1]?.createdAt).toDateString();

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
              <Ionicons name="arrow-undo" size={11} color={colors.forest || '#2D5A27'} />
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

      {/* WhatsApp-Style Modern Pill Input Bar */}
      <View
        style={[
          styles.inputContainer,
          {
            paddingBottom: isKeyboardVisible
              ? (Platform.OS === 'ios' ? 8 : 10)
              : Math.max(insets.bottom + 8, Platform.OS === 'android' ? 24 : 14),
          },
        ]}
      >
        <TouchableOpacity style={styles.attachBtn} onPress={pickImage} activeOpacity={0.75}>
          <Ionicons name="add" size={24} color={colors.charcoal} />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder={replyingTo ? `Replying to ${replyingTo.senderName}...` : "Message..."}
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            style={styles.cameraQuickBtn}
            onPress={openCameraDirectly}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!inputText.trim() && !selectedImage) || sending ? styles.sendBtnDisabled : undefined,
          ]}
          onPress={handleSend}
          disabled={(!inputText.trim() && !selectedImage) || sending}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator color={colors.cream} size="small" />
          ) : (
            <Ionicons name="arrow-up" size={20} color={colors.cream} />
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
  garmentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
    gap: 10,
  },
  garmentBarThumb: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  garmentBarInfo: {
    flex: 1,
  },
  garmentBarBrand: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    color: colors.copper,
  },
  garmentBarTitle: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
  },
  garmentBarPrice: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.charcoal,
    marginTop: 2,
  },
  viewListingBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.charcoal,
  },
  viewListingText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
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
  quickChipsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#FAF9F6',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.08)',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderTopWidth: 1.5,
    borderTopColor: colors.charcoal,
    gap: 8,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F0E8',
    marginBottom: 2,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
    borderRadius: 22,
    paddingHorizontal: 12,
    minHeight: 42,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 12.5,
    color: colors.charcoal,
    maxHeight: 110,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    paddingRight: 6,
  },
  cameraQuickBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    opacity: 0.35,
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
    backgroundColor: '#FAF9F6',
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.1)',
    paddingHorizontal: 14,
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
});
