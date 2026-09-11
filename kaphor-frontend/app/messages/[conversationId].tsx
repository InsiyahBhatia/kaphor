import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../src/theme';
import { KaphorImage } from '../../src/components/KaphorImage';
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
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const partnerTypingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadConversation = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await messageService.getConversationMessages(conversationId);
      setDetail(data);
      setMessages(data.messages);
    } catch (e: any) {
      console.error('Failed to load conversation', e);
      Alert.alert('Error', 'Could not open conversation', [
        { text: 'Go Back', onPress: () => safeBack('/(tabs)/messages') },
      ]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

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
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
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

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant photo access to share images in chat.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
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

  const handleSend = async () => {
    const text = inputText.trim();
    const hasImage = !!selectedImage;
    if ((!text && !hasImage) || !conversationId || sending) return;

    const imgToSend = selectedImage;
    setInputText('');
    setSelectedImage(null);
    setSending(true);

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
      content: text || '📷 Photo',
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

      const result = await messageService.sendMessage(conversationId, text, finalImgUrl);
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
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
          onPress={() => {
            if (garment.listingType === 'RENTAL') {
              router.push(`/(tabs)/rental/${garment.id}` as any);
            } else if (garment.listingType === 'ACCESSORY_SWAP') {
              router.push(`/(tabs)/swap/${garment.id}` as any);
            } else {
              router.push(`/(tabs)/shop/${garment.id}` as any);
            }
          }}
          activeOpacity={0.85}
        >
          {garment.image && (
            <KaphorImage uri={garment.image} style={styles.garmentBarThumb} contentFit="cover" />
          )}
          <View style={styles.garmentBarInfo}>
            <Text style={styles.garmentBarBrand}>{garment.brand?.toUpperCase()}</Text>
            <Text style={styles.garmentBarTitle} numberOfLines={1}>
              {garment.title}
            </Text>
            {garment.price != null && (
              <Text style={styles.garmentBarPrice}>₹{(garment.price / 100).toLocaleString('en-IN')}</Text>
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
          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => router.push(`/(tabs)/swap/${garment.id}` as any)}
          >
            <Ionicons name="swap-horizontal" size={12} color={colors.charcoal} />
            <Text style={styles.quickChipText}>REQUEST ACCESSORY SWAP</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const isMine = item.senderId === user?.id;
          const showDateDivider =
            index === 0 ||
            new Date(item.createdAt).toDateString() !==
              new Date(messages[index - 1]?.createdAt).toDateString();

          const dateLabel =
            new Date(item.createdAt).toDateString() === new Date().toDateString()
              ? 'TODAY'
              : new Date(item.createdAt).toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                }).toUpperCase();

          return (
            <View>
              {showDateDivider && (
                <View style={styles.dateDivider}>
                  <Text style={styles.dateDividerText}>{dateLabel}</Text>
                </View>
              )}

              <View
                style={[
                  styles.bubbleWrapper,
                  isMine ? styles.myBubbleWrapper : styles.theirBubbleWrapper,
                ]}
              >
                <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
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

                  {item.content && item.content !== '📷 Photo' && (
                    <Text
                      style={[
                        styles.bubbleText,
                        isMine ? styles.myBubbleText : styles.theirBubbleText,
                      ]}
                    >
                      {item.content}
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
                        size={12}
                        color={item.readAt ? '#C9A84C' : colors.cream}
                        style={{ marginLeft: 3 }}
                      />
                    )}
                  </View>
                </View>
              </View>
            </View>
          );
        }}
      />

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
          <Image source={{ uri: selectedImage }} style={styles.imagePreviewThumb} />
          <Text style={styles.imagePreviewText}>Image attached</Text>
          <TouchableOpacity
            style={styles.removeImageBtn}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close-circle" size={20} color={colors.red} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.attachBtn} onPress={pickImage} activeOpacity={0.7}>
          <Ionicons name="image-outline" size={22} color={colors.charcoal} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Type a message or discuss terms..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={handleInputChange}
          multiline
          maxLength={4000}
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!inputText.trim() && !selectedImage) || sending ? styles.sendBtnDisabled : undefined,
          ]}
          onPress={handleSend}
          disabled={(!inputText.trim() && !selectedImage) || sending}
        >
          {sending ? (
            <ActivityIndicator color={colors.cream} size="small" />
          ) : (
            <Ionicons name="arrow-up" size={20} color={colors.cream} />
          )}
        </TouchableOpacity>
      </View>

      {/* Full-Screen Image Viewer Modal */}
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
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          {viewingImage && (
            <Image
              source={{ uri: viewingImage }}
              style={styles.fullImageView}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
  dateDividerText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.textMuted,
    backgroundColor: '#EBE8DF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
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
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1.5,
    borderTopColor: colors.charcoal,
    gap: 8,
  },
  attachBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.charcoal,
    maxHeight: 100,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
    borderRadius: 6,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
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
});
