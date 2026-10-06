import React, { useEffect, useState, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';
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
import { SolarIcon } from '../../src/components/common/SolarIcon';
import { colors, typography } from '../../src/theme';
import { KaphorImage, normalizeImageUri } from '../../src/components/KaphorImage';
import { VerifiedBadge } from '../../src/components/common/VerifiedBadge';
import { ConversationChatLoading } from '../../src/components/common/CardLoadingScreen';
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
import { peek, remember, hydrate } from '../../src/utils/swrCache';
import { getConversationSeed } from '../../src/store/listStore';
import { hapticFeedback } from '../../src/utils/haptics';
import { useNotificationStore } from '../../src/store/notificationStore';
import { swapService } from '../../src/services/swapService';
import { navigateToLiveSwapStage } from '../../src/utils/swapNavigation';
import type { SwapTransaction } from '../../src/types/swap';
import { Spinner } from '../../src/components/common/Loader';
import { getErrorMessage } from '../../src/utils/errors';

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
          <SolarIcon name="arrow-undo" size={14} color={colors.charcoal} />
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

export interface ComposerHandle {
  setText: (t: string) => void;
  getText: () => string;
}

interface ComposerBarProps {
  replyingTo: QuotedReplyInfo | null;
  hasImage: boolean;
  sending: boolean;
  isKeyboardVisible: boolean;
  bottomInset: number;
  onTyping: () => void;
  onSend: () => void;
  onPickImage: () => void;
  onCamera: () => void;
  onFocusScroll: () => void;
}

const ATTACH_HIT = { top: 6, bottom: 6, left: 6, right: 6 };
const SEND_HIT = { top: 10, bottom: 10, left: 10, right: 10 };

/** Owns the text state so typing only re-renders this bar, not the whole chat screen. */
const ComposerBar = React.memo(
  React.forwardRef<ComposerHandle, ComposerBarProps>(function ComposerBar(props, ref) {
    const { replyingTo, hasImage, sending, isKeyboardVisible, bottomInset, onTyping, onSend, onPickImage, onCamera, onFocusScroll } = props;
    const [text, setText] = useState('');
    const [focused, setFocused] = useState(false);
    const textRef = useRef('');
    React.useImperativeHandle(
      ref,
      () => ({
        setText: (t: string) => {
          textRef.current = t;
          setText(t);
        },
        getText: () => textRef.current,
      }),
      []
    );
    const handleChange = useCallback(
      (t: string) => {
        textRef.current = t;
        setText(t);
        onTyping();
      },
      [onTyping]
    );
    const canSend = (!!text.trim() || hasImage) && !sending;
    return (
      <View
        style={[
          styles.inputContainer,
          { paddingBottom: isKeyboardVisible ? 8 : Math.max(bottomInset, Platform.OS === 'android' ? 12 : 8) },
        ]}
      >
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add"
          style={styles.attachBtn}
          onPress={onPickImage}
          activeOpacity={0.75}
          hitSlop={ATTACH_HIT}
        >
          <SolarIcon name="add" size={24} color={colors.charcoal} />
        </TouchableOpacity>

        <View style={[styles.inputWrapper, focused && styles.inputWrapperFocused]}>
          <TextInput accessibilityLabel="Type a message"
            style={styles.input}
            placeholder={replyingTo ? `Replying to ${replyingTo.senderName}...` : 'Message...'}
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={handleChange}
            onFocus={() => {
              setFocused(true);
              onFocusScroll();
            }}
            onBlur={() => setFocused(false)}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Take photo"
            style={styles.cameraQuickBtn}
            onPress={onCamera}
            activeOpacity={0.7}
            hitSlop={ATTACH_HIT}
          >
            <SolarIcon name="camera" size={20} color={focused ? colors.charcoal : colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Arrow up" hitSlop={SEND_HIT}
          style={[styles.sendBtn, canSend ? styles.sendBtnActive : styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!canSend}
          activeOpacity={0.85}
        >
          {sending ? (
            <Spinner color={colors.cream} size="small" />
          ) : (
            <SolarIcon name="arrow-up" size={20} color={canSend ? colors.cream : colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>
    );
  })
);


interface ChatRowActions {
  startReply: (m: DirectMessageItem) => void;
  longPress: (m: DirectMessageItem) => void;
  scrollTo: (id: string) => void;
  openGarment: (g: ConversationGarment) => void;
  viewImage: (uri: string | null) => void;
  toggleReaction: (targetId: string, emoji: string) => void;
  push: (path: string) => void;
}

type ReactionList = { emoji: string; count: number; userReacted: boolean }[];

interface ChatRowModel {
  item: DirectMessageItem;
  isFirst: boolean;
  showDateDivider: boolean;
  dateLabel: string;
  isSameSenderAsPrev: boolean;
  isSameSenderAsNext: boolean;
  isMine: boolean;
  reactions?: ReactionList;
  reactionsSig: string;
}

interface ChatMessageRowProps {
  row: ChatRowModel;
  effectiveGarment: ConversationGarment | null | undefined;
  conversation: ConversationDetailResponse['conversation'] | undefined;
  swapId: string | null | undefined;
  actions: ChatRowActions;
}

const chatRowKey = (row: ChatRowModel) => row.item.id;

function chatRowPropsEqual(a: ChatMessageRowProps, b: ChatMessageRowProps) {
  const x = a.row;
  const y = b.row;
  return (
    x.item.id === y.item.id &&
    x.item.content === y.item.content &&
    x.item.readAt === y.item.readAt &&
    x.item.imageUrl === y.item.imageUrl &&
    x.item.isFlagged === y.item.isFlagged &&
    (x.item as any).updatedAt === (y.item as any).updatedAt &&
    x.isFirst === y.isFirst &&
    x.showDateDivider === y.showDateDivider &&
    x.dateLabel === y.dateLabel &&
    x.isSameSenderAsPrev === y.isSameSenderAsPrev &&
    x.isSameSenderAsNext === y.isSameSenderAsNext &&
    x.isMine === y.isMine &&
    x.reactionsSig === y.reactionsSig &&
    a.effectiveGarment === b.effectiveGarment &&
    a.conversation === b.conversation &&
    a.swapId === b.swapId &&
    a.actions === b.actions
  );
}

/** One chat bubble (with date separator, product snippet, image, transaction buttons, reactions). */
const ChatMessageRow = React.memo(function ChatMessageRow({
  row,
  effectiveGarment,
  conversation,
  swapId,
  actions,
}: ChatMessageRowProps) {
  const { item, isFirst, showDateDivider, dateLabel, isSameSenderAsPrev, isSameSenderAsNext, isMine, reactions } = row;
  const garment = conversation?.garment;
  const parsed = parseReplyContent(item.content || '');
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
                onSwipeReply={() => actions.startReply(item)}
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
                    onLongPress={() => actions.longPress(item)}
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
                        onPress={() => actions.scrollTo(parsed.replyTo!.id)}
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
                            ...(conversation?.sellerGarments || []),
                            ...(conversation?.counterpartyGarments || []),
                            (conversation as any)?.rental?.garment,
                            garment,
                          ].filter(Boolean);
                          const matched = allAvailable.find((g: any) =>
                            g.title?.trim().toLowerCase() === targetTitle ||
                            targetTitle.includes(g.title?.trim().toLowerCase()) ||
                            g.title?.trim().toLowerCase().includes(targetTitle)
                          );
                          displayGarment = matched || ((conversation as any)?.rental?.garment?.title?.toLowerCase().includes(targetTitle) ? (conversation as any)?.rental?.garment : null);
                        } else if ((conversation as any)?.rental?.garment) {
                          displayGarment = (conversation as any)?.rental?.garment;
                        }
                      } else if (isSwapMsg) {
                        displayGarment = null;
                      } else {
                        const shouldShowSnippet = (
                          isFirst ||
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
                          onPress={() => actions.openGarment(displayGarment)}
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
                                isMine ? { color: colors.paperDark } : { color: colors.copper },
                              ]}
                              numberOfLines={1}
                            >
                              {displayGarment.brand?.toUpperCase() || 'KAPHOR'}
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
                                isMine ? { color: colors.gold } : { color: colors.charcoal },
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
                                ? { backgroundColor: colors.overlayLight }
                                : { backgroundColor: colors.charcoal },
                            ]}
                          >
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
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
                        onPress={() => actions.viewImage(item.imageUrl || null)}
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
                            ? { backgroundColor: colors.borderLight, borderColor: colors.borderLight }
                            : { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
                        ]}
                        onPress={() => actions.push(swapId ? `/(tabs)/swap/details?swapId=${swapId}` : '/(tabs)/orders?tab=swaps')}
                        activeOpacity={0.88}
                      >
                        <SolarIcon name="swap-horizontal" size={13} color={isMine ? colors.white : colors.cream} />
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
                            ? { backgroundColor: colors.forest || colors.forest, borderColor: colors.forest || colors.forest }
                            : isMine
                            ? { backgroundColor: colors.borderLight, borderColor: colors.borderLight }
                            : { backgroundColor: colors.orange, borderColor: colors.orange },
                        ]}
                        onPress={() => {
                          const rentalIdMatch = parsed.text?.match(/Lease ID:\s*([a-zA-Z0-9_-]+)/);
                          const targetRentalId = rentalIdMatch
                            ? rentalIdMatch[1]
                            : ((conversation as any)?.rental?.id || (conversation as any)?.rentalId);
                          if (targetRentalId) {
                            actions.push(`/(tabs)/rental/lease/${targetRentalId}`);
                          } else {
                            actions.push('/(tabs)/rental?tab=my');
                          }
                        }}
                        activeOpacity={0.88}
                      >
                        <SolarIcon
                          name={parsed.text?.includes('[RENTAL APPROVED]') ? 'card-outline' : 'calendar-outline'}
                          size={13}
                          color={colors.white}
                        />
                        <Text style={[styles.chatTransactionActionText, { color: colors.white }]}>
                          {parsed.text?.includes('[RENTAL APPROVED]')
                            ? (isMine ? 'VIEW LEASE DETAILS ➔' : 'PROCEED TO PAYMENT ➔')
                            : (isMine ? 'VIEW RENTAL DETAILS ➔' : 'REVIEW & APPROVE DATES ➔')}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {item.isFlagged && (
                      <View style={styles.flaggedWarning}>
                        <SolarIcon name="warning" size={12} color={colors.red} />
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
                        <SolarIcon
                          name={item.readAt ? 'checkmark-done' : 'checkmark'}
                          size={13}
                          color={item.readAt ? colors.gold : colors.goldDark}
                          style={{ marginLeft: 3 }}
                        />
                      )}
                    </View>

                    {/* Instagram/WhatsApp-Style Anchored Reaction Badges */}
                    {reactions && reactions.length > 0 && (
                      <View style={[styles.reactionBadgeContainer, isMine ? styles.reactionBadgeMine : styles.reactionBadgeTheir]}>
                        {reactions.map((r: { emoji: string; count: number; userReacted: boolean }, rIdx: number) => (
                          <TouchableOpacity
                            key={rIdx}
                            style={[
                              styles.reactionBadgePill,
                              r.userReacted && styles.reactionBadgePillActive,
                            ]}
                            onPress={() => actions.toggleReaction(item.id, r.emoji)}
                            activeOpacity={0.8}
                          >
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.reactionBadgeEmoji}>{r.emoji}</Text>
                            {r.count > 1 && (
                              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.reactionBadgeCount, r.userReacted && styles.reactionBadgeCountActive]}>
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
}, chatRowPropsEqual);

function createTypingBus() {
  let value = false;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (v: boolean) => {
      if (v === value) return;
      value = v;
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
type TypingBus = ReturnType<typeof createTypingBus>;

const HeaderHandleText = React.memo(function HeaderHandleText({ bus, handle }: { bus: TypingBus; handle: string }) {
  const typing = useSyncExternalStore(bus.subscribe, bus.get, bus.get);
  return <>{typing ? 'typing...' : `@${handle} • View Profile`}</>;
});

const TypingBanner = React.memo(function TypingBanner({ bus, name }: { bus: TypingBus; name: string }) {
  const typing = useSyncExternalStore(bus.subscribe, bus.get, bus.get);
  if (!typing) return null;
  return (
    <View style={styles.typingWrap}>
      <Text style={styles.typingText}>{name} is typing...</Text>
    </View>
  );
});

const MAINTAIN_VISIBLE_POSITION = { minIndexForVisible: 1, autoscrollToTopThreshold: 80 };

export default function DirectChatScreen() {
  const insets = useSafeAreaInsets();
  const { conversationId, swapId: swapIdParam } = useLocalSearchParams<{ conversationId: string; swapId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  useBackHandler('/(tabs)/messages');

  // Paint instantly: memory cache first, otherwise the inbox row (header) while messages load
  const cacheChatKey = `chat:${conversationId}`;
  const cachedChat = useRef(peek<any>(cacheChatKey)).current;
  const seedConv = useRef(getConversationSeed(conversationId)).current;
  const [detail, setDetail] = useState<ConversationDetailResponse | null>(
    () => cachedChat?.detail ?? (seedConv ? ({ conversation: seedConv as any, messages: [] } as ConversationDetailResponse) : null)
  );
  const [messages, setMessages] = useState<DirectMessageItem[]>(() => cachedChat?.messages ?? []);
  const setActiveConversationId = useNotificationStore((s) => s.setActiveConversationId);

  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
    }
    return () => {
      setActiveConversationId(null);
    };
  }, [conversationId, setActiveConversationId]);

  // Cap rendered history; older messages load on demand
  const [historyLimit, setHistoryLimit] = useState(100);
  const loadEarlier = useCallback(() => setHistoryLimit((n) => n + 100), []);

  // Separate reactions from normal message bubbles and map by messageId
  const { displayMessages, reactionsByMessageId, hasEarlier } = useMemo(() => {
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

    const capped = visibleMsgs.length > historyLimit ? visibleMsgs.slice(-historyLimit) : visibleMsgs;
    return { displayMessages: capped, reactionsByMessageId: reactionsMap, hasEarlier: visibleMsgs.length > capped.length };
  }, [messages, user?.id, historyLimit]);
  const composerRef = useRef<ComposerHandle>(null);
  const setInputText = useCallback((t: string) => composerRef.current?.setText(t), []);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<QuotedReplyInfo | null>(null);
  const [actionMessage, setActionMessage] = useState<DirectMessageItem | null>(null);
  const [loading, setLoading] = useState(!(cachedChat?.messages?.length > 0));
  const [sending, setSending] = useState(false);
  // Typing state lives outside React state so only the two tiny subscribers re-render
  const typingBus = useRef(createTypingBus()).current;
  const isScrolledRef = useRef(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
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
  // List is inverted: offset 0 is the newest message
  const scrollToLatest = useCallback((animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);
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
    const targetIdx = listData.findIndex((r) => r.item.id === messageId);
    if (targetIdx >= 0) {
      try {
        flatListRef.current?.scrollToIndex({ index: targetIdx, animated: true, viewPosition: 0.5 });
        hapticFeedback.light();
      } catch {
        scrollToLatest(true);
      }
    }
  };

  // Keyboard awareness listener
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => scrollToLatest(true), 100);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);


  // Load offline cached messages immediately on mount
  useEffect(() => {
    if (!conversationId) return;
    (async () => {
      try {
        const parsed = await hydrate<any>(cacheChatKey);
        if (parsed) {
          if (parsed.detail) setDetail((d) => d ?? parsed.detail);
          if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            setMessages((m) => (m.length === 0 ? parsed.messages : m));
            setLoading(false);
          }
        }
      } catch {}
    })();
  }, [conversationId]);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Persist the latest messages (debounced) only when the list changes, never per keystroke
  useEffect(() => {
    if (!conversationId || !detail || messages.length === 0) return;
    const t = setTimeout(() => {
      const persistable = messages.filter((m) => !m.id.startsWith('temp-')).slice(-100);
      if (persistable.length === 0) return;
      remember(cacheChatKey, { detail: { ...detail, messages: [] }, messages: persistable });
    }, 1200);
    return () => clearTimeout(t);
  }, [messages, detail, conversationId, cacheChatKey]);

  const loadConversation = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await messageService.getConversationMessages(conversationId);
      setDetail(data);
      setMessages(data.messages);
      useNotificationStore.getState().fetchUnreadMessageCount();
      // Persist to offline cache
    } catch (e: any) {
      console.error('Failed to load conversation', e);
      if (messagesRef.current.length === 0) {
        Alert.alert('Error', 'Could not open conversation', [
          { text: 'Go Back', onPress: () => safeBack('/(tabs)/messages') },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, cacheChatKey]);

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
          typingBus.set(false);
          if (isScrolledRef.current) {
            setUnreadWhileScrolled((c) => c + 1);
          } else {
            setTimeout(() => scrollToLatest(true), 100);
          }
        }
      };

      const typingHandler = (data: any) => {
        if (data.conversationId === conversationId && data.userId !== user?.id) {
          typingBus.set(true);
          if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
          partnerTypingTimerRef.current = setTimeout(() => {
            typingBus.set(false);
          }, 3000);
        }
      };

      const stopTypingHandler = (data: any) => {
        if (data.conversationId === conversationId && data.userId !== user?.id) {
          typingBus.set(false);
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

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Inverted list: distance from the newest message is the raw offset
    const distanceFromBottom = event.nativeEvent.contentOffset.y;
    const scrolled = distanceFromBottom > 180;
    if (scrolled === isScrolledRef.current) return;
    isScrolledRef.current = scrolled;
    setShowScrollBottom(scrolled);
    if (!scrolled) setUnreadWhileScrolled(0);
  }, []);

  const handleInputChange = useCallback(() => {

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
  }, [conversationId, user?.id, user?.displayName]);

  const openCameraDirectly = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
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
            const ImagePicker = await import('expo-image-picker');
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
      const FileSystem = await import('expo-file-system/legacy');
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
      setTimeout(() => scrollToLatest(true), 100);
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
    const text = (composerRef.current?.getText() ?? '').trim();
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
    setTimeout(() => scrollToLatest(true), 100);

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
              Alert.alert('Error', getErrorMessage(err, 'Could not delete conversation.'));
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

  // Row view-models, newest first (the list is inverted)
  const listData = useMemo<ChatRowModel[]>(() => {
    const n = displayMessages.length;
    const out: ChatRowModel[] = new Array(n);
    const today = new Date();
    const todayStr = today.toDateString();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    const yesterdayStr = yest.toDateString();
    const dayStrs: string[] = new Array(n);
    const times: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const d = new Date(displayMessages[i].createdAt);
      dayStrs[i] = d.toDateString();
      times[i] = d.getTime();
    }
    for (let i = 0; i < n; i++) {
      const item = displayMessages[i];
      const showDateDivider = i === 0 || dayStrs[i] !== dayStrs[i - 1];
      const isSameSenderAsPrev =
        !showDateDivider &&
        i > 0 &&
        displayMessages[i - 1].senderId === item.senderId &&
        Math.abs(times[i] - times[i - 1]) < 120000;
      const isSameSenderAsNext =
        i < n - 1 &&
        displayMessages[i + 1].senderId === item.senderId &&
        Math.abs(times[i + 1] - times[i]) < 120000 &&
        dayStrs[i + 1] === dayStrs[i];
      let dateLabel = new Date(item.createdAt)
        .toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
        .toUpperCase();
      if (dayStrs[i] === todayStr) dateLabel = 'TODAY';
      else if (dayStrs[i] === yesterdayStr) dateLabel = 'YESTERDAY';
      const reactions = reactionsByMessageId[item.id];
      out[n - 1 - i] = {
        item,
        isFirst: i === 0,
        showDateDivider,
        dateLabel,
        isSameSenderAsPrev,
        isSameSenderAsNext,
        isMine: item.senderId === user?.id,
        reactions,
        reactionsSig: reactions ? reactions.map((r) => r.emoji + ':' + r.count + ':' + (r.userReacted ? 1 : 0)).join('|') : '',
      };
    }
    return out;
  }, [displayMessages, reactionsByMessageId, user?.id]);

  // Always-current handlers behind a stable object so memoized rows never re-render for them
  const latestHandlers = useRef({ startReply: handleStartReply, scrollTo: scrollToMessage, toggleReaction: handleToggleReaction });
  latestHandlers.current = { startReply: handleStartReply, scrollTo: scrollToMessage, toggleReaction: handleToggleReaction };
  const rowActions = useMemo<ChatRowActions>(
    () => ({
      startReply: (m) => latestHandlers.current.startReply(m),
      scrollTo: (id) => latestHandlers.current.scrollTo(id),
      toggleReaction: (id, e) => latestHandlers.current.toggleReaction(id, e),
      longPress: (m) => {
        setActionMessage(m);
        hapticFeedback.medium();
      },
      openGarment: (g) => setModalGarment(g),
      viewImage: (uri) => setViewingImage(uri),
      push: (path) => router.push(path as any),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const conversationForRows = detail?.conversation;
  const renderRow = useCallback(
    ({ item }: { item: ChatRowModel }) => (
      <ChatMessageRow
        row={item}
        effectiveGarment={effectiveGarment}
        conversation={conversationForRows}
        swapId={swapId}
        actions={rowActions}
      />
    ),
    [effectiveGarment, conversationForRows, swapId, rowActions]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" 
          onPress={() => safeBack('/(tabs)/messages')} 
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <SolarIcon name="chevron-back" size={24} color={colors.charcoal} />
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
              <HeaderHandleText bus={typingBus} handle={formatHandle(other)} />
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cube" 
            style={styles.profileBtn} 
            onPress={handleOpenTransactionsHub}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <SolarIcon name="cube-outline" size={20} color={colors.charcoal} />
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Person circle" 
            style={styles.profileBtn} 
            onPress={() => other?.id && router.push(`/(tabs)/shop/seller/${other.id}` as any)}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <SolarIcon name="person-circle-outline" size={24} color={colors.charcoal} />
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Shield" style={styles.reportBtn} onPress={handleReport} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            <SolarIcon name="shield-outline" size={18} color={colors.charcoal} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.reportBtn} 
            onPress={handleDeleteConversation} 
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityLabel="Delete Conversation"
          >
            <SolarIcon name="trash-outline" size={18} color={colors.red || colors.rose} />
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
              <SolarIcon name="swap-horizontal" size={12} color={colors.white} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.swapHeaderBadgeText}>SWAP #{swapId.slice(0, 8).toUpperCase()}</Text>
            </View>
            <View style={[
              styles.swapStageStatusPill,
              swapDetails?.status === 'COMPLETED' ? { backgroundColor: colors.emeraldDark } :
              swapDetails?.status === 'SHIPPED' || swapDetails?.status === 'BOTH_SHIPPED' ? { backgroundColor: colors.goldDark } :
              { backgroundColor: colors.inkSoft }
            ]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.swapStageStatusText}>
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
                  <KaphorImage
                    uri={swapDetails.offeredGarment?.images?.[0] || swapDetails.garmentOffered?.images?.[0]}
                    style={styles.swapThumb as any}
                    width={80}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.swapThumb, styles.swapThumbPlaceholder]}>
                    <SolarIcon name="shirt-outline" size={18} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.swapRoleTagOffered}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.swapRoleTagText}>OFFERED</Text>
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
                <SolarIcon name="swap-horizontal" size={14} color={colors.charcoal} />
              </View>
              <Text style={styles.swapCenterHint}>VIEW STAGE →</Text>
            </View>

            {/* Wanted Item */}
            <View style={styles.swapItemCol}>
              <View style={styles.swapThumbWrap}>
                {swapDetails?.wantedGarment?.images?.[0] || swapDetails?.garmentWanted?.images?.[0] ? (
                  <KaphorImage
                    uri={swapDetails.wantedGarment?.images?.[0] || swapDetails.garmentWanted?.images?.[0]}
                    style={styles.swapThumb as any}
                    width={80}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.swapThumb, styles.swapThumbPlaceholder]}>
                    <SolarIcon name="sparkles-outline" size={18} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.swapRoleTagWanted}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.swapRoleTagText}>WANTED</Text>
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
              <SolarIcon name="cube" size={16} color={colors.cream} />
            </View>
            <View style={styles.orderCoordinationInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.orderCoordinationTitle}>ORDER #{order.id.slice(0, 8).toUpperCase()}</Text>
                <View style={styles.orderStatusChip}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.orderStatusChipText}>{order.status}</Text>
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
                style={[styles.viewOrderBtn, { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.charcoal }]}
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
              <SolarIcon name="calendar" size={16} color={colors.cream} />
            </View>
            <View style={styles.rentalCoordinationInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.rentalCoordinationTitle}>RENTAL #{rental.id.slice(0, 8).toUpperCase()}</Text>
                <View style={styles.rentalStatusChip}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.rentalStatusChipText}>{rental.status?.replace(/_/g, ' ') || 'ACTIVE'}</Text>
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
                style={[styles.viewOrderBtn, { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.charcoal }]}
                onPress={() => setModalGarment((effectiveGarment || garment) ?? null)}
                activeOpacity={0.8}
              >
                <Text style={[styles.viewOrderText, { color: colors.charcoal }]}>PIECE</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.viewOrderBtn, { backgroundColor: colors.forest || colors.emeraldDark }]}
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
                  <SolarIcon name="expand" size={10} color={colors.cream} />
                </View>
              </View>
            )}

            <View style={styles.garmentCardMain}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.garmentCardBrand}>
                  {effectiveGarment.brand?.toUpperCase() || 'KAPHOR'}
                </Text>
                <View
                  style={[
                    styles.intentModeBadge,
                    garmentMode === 'RENT'
                      ? { backgroundColor: colors.paperDark, borderColor: colors.ink }
                      : garmentMode === 'SWAP'
                      ? { backgroundColor: colors.paperDark, borderColor: colors.orange }
                      : { backgroundColor: colors.emeraldLight, borderColor: colors.forest },
                  ]}
                >
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                    style={[
                      styles.intentModeBadgeText,
                      { color: garmentMode === 'RENT' ? colors.ink : garmentMode === 'SWAP' ? colors.terracottaDark : colors.forest },
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
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.specMiniPillText}>SIZE {effectiveGarment.size.toUpperCase()}</Text>
                  </View>
                ) : null}
                {effectiveGarment.condition ? (
                  <View style={styles.specMiniPill}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.specMiniPillText}>{effectiveGarment.condition.toUpperCase()}</Text>
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
              <SolarIcon name="information-circle-outline" size={13} color={colors.charcoal} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.garmentDetailsBtnText}>DETAILS</Text>
            </TouchableOpacity>

            {isMyGarment ? (
              <TouchableOpacity
                style={[styles.garmentActionBtn, { backgroundColor: colors.charcoal }]}
                onPress={() => router.push(`/(tabs)/shop/edit/${effectiveGarment.id}` as any)}
                activeOpacity={0.8}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.garmentActionBtnText}>EDIT</Text>
              </TouchableOpacity>
            ) : garmentMode === 'RENT' ? (
              <TouchableOpacity
                style={[styles.garmentActionBtn, { backgroundColor: colors.ink }]}
                onPress={() => router.push(`/(tabs)/rental/${effectiveGarment.id}` as any)}
                activeOpacity={0.8}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.garmentActionBtnText}>RENT →</Text>
              </TouchableOpacity>
            ) : garmentMode === 'SWAP' ? (
              <TouchableOpacity
                style={[styles.garmentActionBtn, { backgroundColor: colors.goldDark }]}
                onPress={() => router.push(`/(tabs)/swap/${effectiveGarment.id}` as any)}
                activeOpacity={0.8}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.garmentActionBtnText}>SWAP →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.garmentActionBtn, { backgroundColor: colors.forest || colors.emeraldDark }]}
                onPress={() => router.push(`/(tabs)/shop/${effectiveGarment.id}` as any)}
                activeOpacity={0.8}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.garmentActionBtnText}>BUY →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (counterpartyGarments.length > 0 || sellerGarments.length > 0) ? (
        /* Wardrobe Strip (when no garment is pre-linked, displays seller/atelier pieces for selection) */
        <View style={styles.wardrobeStripContainer}>
          <View style={styles.wardrobeStripHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <SolarIcon name="shirt-outline" size={13} color={colors.charcoal} />
              {counterpartyGarments.length > 0 && sellerGarments.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setActiveGarmentsTab('counterparty')}
                    style={[
                      styles.wardrobeTabMini,
                      activeGarmentsTab === 'counterparty' && styles.wardrobeTabMiniActive,
                    ]}
                  >
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
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
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                      style={[
                        styles.wardrobeTabMiniText,
                        activeGarmentsTab === 'seller' && styles.wardrobeTabMiniTextActive,
                      ]}
                    >
                      YOUR ITEMS ({sellerGarments.length})
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.wardrobeStripTitle} numberOfLines={1}>
                  {counterpartyGarments.length > 0
                    ? (other?.displayName ? `${other.displayName.toUpperCase()}'S PIECES (${counterpartyGarments.length})` : 'SELLER WARDROBE')
                    : `YOUR ITEMS (${sellerGarments.length})`}
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
                        {cg.brand?.toUpperCase() || 'KAPHOR'}
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
                      isLinked && { backgroundColor: colors.emeraldDark },
                    ]}
                    onPress={() => handleLinkGarment(cg)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <SolarIcon name={isLinked ? 'checkmark' : 'link'} size={11} color={colors.white} />
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.wardrobeStripLinkBtnText}>{isLinked ? 'LINKED' : 'LINK'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : !order && !rental ? (
        isRentalInquiry ? (
          <View style={[styles.rentalCoordinationBar, { backgroundColor: colors.paperDark, borderBottomColor: colors.paperDark }]}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
              onPress={() => router.push('/(tabs)/rental' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.rentalIconBox, { backgroundColor: colors.ink }]}>
                <SolarIcon name="calendar" size={16} color={colors.cream} />
              </View>
              <View style={styles.rentalCoordinationInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.rentalCoordinationTitle}>RENTAL INQUIRY & LEASING</Text>
                  <View style={[styles.rentalStatusChip, { backgroundColor: colors.overlayLight }]}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.rentalStatusChipText, { color: colors.ink }]}>RENT</Text>
                  </View>
                </View>
                <Text style={styles.rentalCoordinationSub} numberOfLines={1}>
                  Direct rental negotiation, fittings & reservations
                </Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.viewOrderBtn, { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.charcoal }]}
                onPress={() => router.push('/(tabs)/rental?tab=my' as any)}
                activeOpacity={0.8}
              >
                <Text style={[styles.viewOrderText, { color: colors.charcoal }]}>LEASES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewOrderBtn, { backgroundColor: colors.ink }]}
                onPress={() => router.push('/(tabs)/rental' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewOrderText}>RENTALS →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : isSwapInquiry ? (
          <View style={[styles.rentalCoordinationBar, { backgroundColor: colors.paperLight, borderBottomColor: colors.goldDark }]}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
              onPress={() => router.push('/(tabs)/swap' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.rentalIconBox, { backgroundColor: colors.goldDark }]}>
                <SolarIcon name="swap-horizontal" size={16} color={colors.cream} />
              </View>
              <View style={styles.rentalCoordinationInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.rentalCoordinationTitle}>SWAP & TRADE INQUIRY</Text>
                  <View style={[styles.rentalStatusChip, { backgroundColor: colors.goldLight }]}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.rentalStatusChipText, { color: colors.goldDark }]}>SWAP</Text>
                  </View>
                </View>
                <Text style={styles.rentalCoordinationSub} numberOfLines={1}>
                  Circular wardrobe exchange & item trades
                </Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.viewOrderBtn, { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.charcoal }]}
                onPress={() => router.push('/(tabs)/orders?tab=swaps' as any)}
                activeOpacity={0.8}
              >
                <Text style={[styles.viewOrderText, { color: colors.charcoal }]}>TRADES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewOrderBtn, { backgroundColor: colors.goldDark }]}
                onPress={() => router.push('/(tabs)/swap' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewOrderText}>SAVED →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.directSellerBar}>
            <View style={styles.directIconCircle}>
              <SolarIcon name="storefront" size={16} color={colors.forest || colors.inkSoft} />
            </View>
            <View style={styles.directSellerInfo}>
              <Text style={styles.directSellerTitle}>DIRECT CHAT</Text>
              <Text style={styles.directSellerSub} numberOfLines={1}>
                Direct negotiation, custom styling & closet deals
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.viewOrderBtn, { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.charcoal }]}
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

      {/* Message List: skeleton only on first load with nothing cached */}
      {loading && messages.length === 0 ? (
        <ConversationChatLoading />
      ) : (
      <FlatList
        ref={flatListRef}
        data={listData}
        keyExtractor={chatRowKey}
        renderItem={renderRow}
        inverted
        style={{ flex: 1 }}
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={handleScroll}
        scrollEventThrottle={64}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={9}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        maintainVisibleContentPosition={MAINTAIN_VISIBLE_POSITION}
        onEndReached={hasEarlier ? loadEarlier : undefined}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          hasEarlier ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Load earlier messages" onPress={loadEarlier} style={{ alignSelf: 'center', paddingVertical: 10 }}>
              <Text style={{ fontFamily: typography.mono, fontSize: 11, color: colors.textMuted }}>LOAD EARLIER MESSAGES</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      )}

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
            scrollToLatest(true);
            isScrolledRef.current = false;
            setShowScrollBottom(false);
            setUnreadWhileScrolled(0);
          }}
          activeOpacity={0.88}
        >
          <SolarIcon name="chevron-down" size={20} color={colors.charcoal} />
          {unreadWhileScrolled > 0 && (
            <View style={styles.floatingScrollBadge}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.floatingScrollBadgeText}>{unreadWhileScrolled}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Typing Indicator */}
      <TypingBanner bus={typingBus} name={other?.displayName || 'Partner'} />

      {/* Selected Image Preview Bar */}
      {selectedImage && (
        <View style={styles.imagePreviewBar}>
          <KaphorImage uri={selectedImage} style={styles.imagePreviewThumb} contentFit="cover" />
          <Text style={styles.imagePreviewText}>Image attached</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.removeImageBtn}
            onPress={() => setSelectedImage(null)}
          >
            <SolarIcon name="close-circle" size={20} color={colors.red} />
          </TouchableOpacity>
        </View>
      )}

      {/* Replying Preview Bar */}
      {replyingTo && (
        <View style={styles.replyPreviewBar}>
          <View style={styles.replyBarAccent} />
          <View style={styles.replyBarContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <SolarIcon name="arrow-undo" size={12} color={colors.forest || colors.inkSoft} />
              <Text style={styles.replyBarSender}>Replying to {replyingTo.senderName}</Text>
            </View>
            <Text style={styles.replyBarText} numberOfLines={1}>
              {replyingTo.content}
            </Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
            style={styles.cancelReplyBtn}
            onPress={() => setReplyingTo(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <SolarIcon name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Pill input bar (input state isolated in ComposerBar) */}
      <ComposerBar
        ref={composerRef}
        replyingTo={replyingTo}
        hasImage={!!selectedImage}
        sending={sending}
        isKeyboardVisible={isKeyboardVisible}
        bottomInset={insets.bottom}
        onTyping={handleInputChange}
        onSend={handleSend}
        onPickImage={pickImage}
        onCamera={openCameraDirectly}
        onFocusScroll={() => setTimeout(() => scrollToLatest(true), 150)}
      />

      {/* Full-Screen Zoomable Image Viewer Modal */}
      <Modal
        visible={!!viewingImage}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingImage(null)}
        statusBarTranslucent
      >
        <View style={styles.fullImageModal}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
            style={styles.closeFullImageBtn}
            onPress={() => setViewingImage(null)}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <SolarIcon name="close" size={28} color={colors.white} />
          </TouchableOpacity>

          <View style={styles.zoomInstructionWrap}>
            <SolarIcon name="scan-outline" size={12} color={colors.paperGlass} />
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
              <View style={[styles.actionIconBox, { backgroundColor: colors.emeraldLight }]}>
                <SolarIcon name="arrow-undo" size={16} color={colors.forest || colors.inkSoft} />
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
              <View style={[styles.actionIconBox, { backgroundColor: colors.paper }]}>
                <SolarIcon name="copy-outline" size={16} color={colors.charcoal} />
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
                <View style={[styles.actionIconBox, { backgroundColor: colors.paperDark }]}>
                  <SolarIcon name="expand-outline" size={16} color={colors.navy || colors.ink} />
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
                <SolarIcon name="shirt-outline" size={16} color={colors.charcoal} />
                <Text style={styles.garmentModalHeaderTitle}>ITEM DETAILS & TERMS</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
                onPress={() => setModalGarment(null)}
                style={styles.garmentModalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <SolarIcon name="close" size={20} color={colors.charcoal} />
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
                          ? { backgroundColor: colors.paperDark, borderColor: colors.ink }
                          : mode === 'SWAP'
                          ? { backgroundColor: colors.paperDark, borderColor: colors.orange }
                          : { backgroundColor: colors.emeraldLight, borderColor: colors.forest },
                      ]}
                    >
                      <SolarIcon
                        name={
                          mode === 'RENT'
                            ? 'calendar-outline'
                            : mode === 'SWAP'
                            ? 'swap-horizontal'
                            : 'pricetag-outline'
                        }
                        size={18}
                        color={mode === 'RENT' ? colors.ink : mode === 'SWAP' ? colors.terracottaDark : colors.forest}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.garmentModeBannerTitle,
                            {
                              color:
                                mode === 'RENT' ? colors.ink : mode === 'SWAP' ? colors.terracottaDark : colors.forest,
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
                            ? 'Swap item. Sent by delivery and checked first.'
                            : 'Buy now. Shipped with buyer protection and tracking.'}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

              {/* Title & Brand & Financials */}
              {modalGarment && (
                <View style={styles.garmentModalTitleSection}>
                  <Text style={styles.garmentModalBrand}>
                    {modalGarment.brand?.toUpperCase() || 'KAPHOR'}
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
                        <Text style={styles.garmentModalPrice}>SWAP ITEM</Text>
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
                          Free standard shipping & check
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
                    <Text style={[styles.garmentSpecValue, { color: colors.forest || colors.forest }]}>
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
                      'Pre-owned piece, checked by hand.'}
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
                          <SolarIcon name="create-outline" size={16} color={colors.cream} />
                          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.garmentModalPrimaryBtnText}>EDIT LISTING</Text>
                        </TouchableOpacity>
                      ) : mode === 'RENT' ? (
                        <TouchableOpacity
                          style={[styles.garmentModalPrimaryBtn, { backgroundColor: colors.ink }]}
                          onPress={() => {
                            setModalGarment(null);
                            router.push(`/(tabs)/rental/${modalGarment.id}` as any);
                          }}
                        >
                          <SolarIcon name="calendar" size={16} color={colors.cream} />
                          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.garmentModalPrimaryBtnText}>BOOK / RESERVE DATES</Text>
                        </TouchableOpacity>
                      ) : mode === 'SWAP' ? (
                        <TouchableOpacity
                          style={[styles.garmentModalPrimaryBtn, { backgroundColor: colors.goldDark }]}
                          onPress={() => {
                            setModalGarment(null);
                            router.push(`/(tabs)/swap/${modalGarment.id}` as any);
                          }}
                        >
                          <SolarIcon name="swap-horizontal" size={16} color={colors.cream} />
                          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.garmentModalPrimaryBtnText}>PROPOSE SWAP PROPOSAL</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.garmentModalPrimaryBtn, { backgroundColor: colors.forest || colors.emeraldDark }]}
                          onPress={() => {
                            setModalGarment(null);
                            router.push(`/(tabs)/shop/${modalGarment.id}` as any);
                          }}
                        >
                          <SolarIcon name="bag-check-outline" size={16} color={colors.cream} />
                          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.garmentModalPrimaryBtnText}>BUY NOW / CHECKOUT</Text>
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
                        <SolarIcon
                          name="chatbubble-ellipses-outline"
                          size={16}
                          color={colors.charcoal}
                        />
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.garmentModalSecondaryBtnText}>
                          DISCUSS THIS PIECE IN CHAT
                        </Text>
                      </TouchableOpacity>

                      {/* Anchor / Link this piece as the conversation's active transaction piece */}
                      <TouchableOpacity
                        style={[
                          styles.garmentModalSecondaryBtn,
                          {
                            backgroundColor: effectiveGarment?.id === modalGarment.id ? colors.emeraldLight : colors.paperLight,
                            borderColor: effectiveGarment?.id === modalGarment.id ? colors.emeraldDark : colors.gold,
                            borderWidth: 1,
                          },
                        ]}
                        onPress={() => {
                          handleLinkGarment(modalGarment);
                          setModalGarment(null);
                        }}
                      >
                        <SolarIcon
                          name={effectiveGarment?.id === modalGarment.id ? 'checkmark-circle' : 'link'}
                          size={16}
                          color={effectiveGarment?.id === modalGarment.id ? colors.emeraldDark : colors.charcoal}
                        />
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                          style={[
                            styles.garmentModalSecondaryBtnText,
                            effectiveGarment?.id === modalGarment.id && { color: colors.emeraldDark },
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
                <SolarIcon name="cube" size={18} color={colors.charcoal} />
                <Text style={styles.garmentModalHeaderTitle}>PRODUCTS & TRANSACTIONS HUB</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
                onPress={() => setShowTransactionsHub(false)}
                style={styles.garmentModalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <SolarIcon name="close" size={20} color={colors.charcoal} />
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
                      <Text style={styles.hubGarmentBrand}>{effectiveGarment.brand?.toUpperCase() || 'KAPHOR'}</Text>
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
                        style={[styles.hubActionMiniBtn, { backgroundColor: colors.crimsonLight, borderColor: colors.rose }]}
                        onPress={() => {
                          handleLinkGarment(null);
                        }}
                      >
                        <Text style={[styles.hubActionMiniText, { color: colors.rose }]}>UNLINK</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.hubEmptyCard}>
                    <SolarIcon name="shirt-outline" size={22} color={colors.textMuted} />
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
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
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
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                          style={[
                            styles.hubTabPillText,
                            activeGarmentsTab === 'seller' && styles.hubTabPillTextActive,
                          ]}
                        >
                          YOUR ITEMS ({sellerGarments.length})
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
                          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.hubGarmentPillPrice}>
                            ₹{Math.round(g.rentalPriceDay || g.price || 0)}
                            {g.rentalPriceDay ? '/d' : ''}
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.hubGarmentPillBtn,
                              isLinked && { backgroundColor: colors.emeraldDark },
                            ]}
                            onPress={() => {
                              handleLinkGarment(g);
                            }}
                          >
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.hubGarmentPillBtnText}>
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
                  <View style={[styles.hubLinkIcon, { backgroundColor: colors.paperDark }]}>
                    <SolarIcon name="calendar-outline" size={16} color={colors.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hubLinkTitle}>Browse Rental Pieces</Text>
                    <Text style={styles.hubLinkSub}>Explore designer pieces available for rent</Text>
                  </View>
                  <SolarIcon name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.hubLinkItem}
                  onPress={() => {
                    setShowTransactionsHub(false);
                    router.push('/(tabs)/rental?tab=my' as any);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.hubLinkIcon, { backgroundColor: colors.emeraldLight }]}>
                    <SolarIcon name="document-text-outline" size={16} color={colors.forest || colors.emeraldDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hubLinkTitle}>My Active Leases & Returns</Text>
                    <Text style={styles.hubLinkSub}>Track current rentals, end dates & returns</Text>
                  </View>
                  <SolarIcon name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.hubLinkItem}
                  onPress={() => {
                    setShowTransactionsHub(false);
                    router.push('/(tabs)/orders' as any);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.hubLinkIcon, { backgroundColor: colors.paper }]}>
                    <SolarIcon name="bag-check-outline" size={16} color={colors.charcoal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hubLinkTitle}>My Orders & Purchases</Text>
                    <Text style={styles.hubLinkSub}>Track deliveries, payments & past receipts</Text>
                  </View>
                  <SolarIcon name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.hubLinkItem}
                  onPress={() => {
                    setShowTransactionsHub(false);
                    router.push('/(tabs)/orders?tab=swaps' as any);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.hubLinkIcon, { backgroundColor: colors.paperDark }]}>
                    <SolarIcon name="swap-horizontal" size={16} color={colors.terracottaDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hubLinkTitle}>Swap deals</Text>
                    <Text style={styles.hubLinkSub}>Manage circular wardrobe proposals</Text>
                  </View>
                  <SolarIcon name="chevron-forward" size={16} color={colors.textMuted} />
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
                    <View style={[styles.hubLinkIcon, { backgroundColor: colors.paperDark }]}>
                      <SolarIcon name="storefront-outline" size={16} color={colors.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hubLinkTitle}>
                        {other.displayName ? `${other.displayName}'s Wardrobe` : 'Seller Profile'}
                      </Text>
                      <Text style={styles.hubLinkSub}>Browse all items from this seller</Text>
                    </View>
                    <SolarIcon name="chevron-forward" size={16} color={colors.textMuted} />
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
          <SolarIcon name="checkmark-circle" size={16} color={colors.cream} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paperLight,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 15,
    color: colors.charcoal,
  },
  headerHandle: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
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
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.overlayLight,
    gap: 10,
    shadowColor: colors.ink,
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
    backgroundColor: colors.overlay,
    borderRadius: 3,
    padding: 2,
  },
  garmentCardMain: {
    flex: 1,
  },
  garmentCardBrand: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.copper,
  },
  intentModeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 1,
  },
  intentModeBadgeText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
  },
  garmentCardTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
    marginTop: 1,
  },
  garmentCardPrice: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
  },
  specMiniPill: {
    backgroundColor: colors.paper,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  specMiniPillText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
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
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    borderRadius: 3,
  },
  garmentDetailsBtnText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.charcoal,
  },
  garmentActionBtn: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentActionBtnText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.cream,
  },
  wardrobeStripContainer: {
    backgroundColor: colors.paperLight,
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.goldLight,
  },
  wardrobeStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  wardrobeStripTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
  },
  wardrobeStripSubtitle: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
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
    borderColor: colors.overlayLight,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.copper,
  },
  wardrobeStripCardTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.charcoal,
  },
  wardrobeStripCardPrice: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    marginTop: 1,
  },
  swapCoordinationBar: {
    backgroundColor: colors.paperLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.gold,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.white,
  },
  swapStageStatusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 3,
  },
  swapStageStatusText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.white,
  },
  swapItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.paperDark,
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
    backgroundColor: colors.paper,
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
    backgroundColor: colors.paperDark,
  },
  swapRoleTagOffered: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.emeraldDark,
    paddingVertical: 1,
    alignItems: 'center',
  },
  swapRoleTagWanted: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.goldDark,
    paddingVertical: 1,
    alignItems: 'center',
  },
  swapRoleTagText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 10,
    color: colors.white,
  },
  swapItemTitle: {
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: '700',
    color: colors.charcoal,
    textAlign: 'center',
    width: '100%',
  },
  swapItemPrice: {
    fontFamily: typography.mono,
    fontSize: 11,
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
    backgroundColor: colors.paperLight,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  swapCenterHint: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.goldDark,
  },
  orderCoordinationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperLight,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
  },
  orderStatusChip: {
    backgroundColor: colors.emeraldLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  orderStatusChipText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.forest,
  },
  orderCoordinationSub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  rentalCoordinationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperLight,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
  },
  rentalStatusChip: {
    backgroundColor: colors.forest,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  rentalStatusChipText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.cream,
  },
  rentalCoordinationSub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
  },
  directSellerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
    gap: 10,
  },
  directIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.emeraldLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.emeraldLight,
  },
  directSellerInfo: {
    flex: 1,
  },
  directSellerTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.forest || colors.inkSoft,
  },
  directSellerSub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
  },
  safetyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: colors.emeraldLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.emeraldLight,
  },
  safetyNoticeText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.forest,
  },
  quickChipsWrapper: {
    backgroundColor: colors.paperLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.charcoal,
  },
  garmentModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  garmentModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  garmentModalSheet: {
    backgroundColor: colors.paperLight,
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
    borderBottomColor: colors.overlayLight,
  },
  garmentModalHeaderTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 15,
    color: colors.charcoal,
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
    backgroundColor: colors.overlayLight,
  },
  galleryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.overlayLight,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    marginBottom: 2,
  },
  garmentModeBannerSub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 18,
  },
  garmentModalTitleSection: {
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  garmentModalBrand: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.copper,
  },
  garmentModalTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 15,
    color: colors.charcoal,
    marginVertical: 4,
  },
  garmentModalPricingRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
  },
  garmentModalPrice: {
    fontFamily: typography.mono,
    fontSize: 16,
    fontWeight: '900',
    color: colors.charcoal,
  },
  garmentModalPriceUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
      fontFamily: typography.bodyBold,
  },
  garmentModalSecondaryPrice: {
    fontFamily: typography.mono,
    fontSize: 11,
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
    borderColor: colors.overlayLight,
  },
  garmentSpecLabel: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.textMuted,
  },
  garmentSpecValue: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
    marginTop: 2,
  },
  garmentModalDescSection: {
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  garmentModalSectionHeading: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
  },
  garmentModalDescText: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.charcoal,
    lineHeight: 18,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.cream,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
  },
  garmentModalLinkBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  garmentModalLinkText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  dateDivider: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateDividerPill: {
    backgroundColor: colors.paper,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 1.5,
    elevation: 1,
  },
  dateDividerText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.textMuted,
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
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 14,
    lineHeight: 20,
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
    backgroundColor: colors.crimsonLight,
    padding: 4,
    marginTop: 6,
    borderRadius: 4,
  },
  flaggedWarningText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.red,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 11,
  },
  myTimeText: {
    color: colors.goldDark,
  },
  theirTimeText: {
    color: colors.textMuted,
  },
  typingWrap: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  typingText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  imagePreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
    gap: 10,
  },
  imagePreviewThumb: {
    width: 36,
    height: 36,
    borderRadius: 4,
  },
  imagePreviewText: {
    flex: 1,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
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
    backgroundColor: colors.paperLight,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
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
    borderColor: colors.overlayLight,
    marginBottom: 2,
    shadowColor: colors.ink,
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
    borderColor: colors.overlayLight,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 44,
    maxHeight: 120,
    shadowColor: colors.ink,
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
    fontFamily: typography.body,
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
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: colors.paper,
    shadowOpacity: 0,
    elevation: 0,
  },
  fullImageModal: {
    flex: 1,
    backgroundColor: colors.ink,
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
    backgroundColor: colors.overlayLight,
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
    backgroundColor: colors.terracottaLight,
  },
  buyerPill: {
    backgroundColor: colors.emeraldLight,
  },
  roleBadgePillText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 10,
    color: colors.charcoal,
  },
  zoomInstructionWrap: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.overlay,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    zIndex: 10,
  },
  zoomInstructionText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.paperGlass,
  },
  // WhatsApp-style Quote Container inside Bubble
  quoteContainer: {
    flexDirection: 'row',
    borderRadius: 6,
    marginBottom: 6,
    overflow: 'hidden',
  },
  myQuoteContainer: {
    backgroundColor: colors.overlayLight,
  },
  theirQuoteContainer: {
    backgroundColor: colors.overlayLight,
  },
  quoteAccentBar: {
    width: 3.5,
  },
  myQuoteAccent: {
    backgroundColor: colors.gold,
  },
  theirQuoteAccent: {
    backgroundColor: colors.forest || colors.inkSoft,
  },
  quoteContent: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  quoteSender: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    marginBottom: 1,
  },
  myQuoteSender: {
    color: colors.gold,
  },
  theirQuoteSender: {
    color: colors.forest || colors.inkSoft,
  },
  quoteText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
    lineHeight: 18,
  },
  myQuoteText: {
    color: colors.goldDark,
  },
  theirQuoteText: {
    color: colors.textMuted,
  },
  // Reply Preview Bar above Input Box
  replyPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: colors.overlayLight,
    borderRightColor: colors.overlayLight,
    marginHorizontal: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  replyBarAccent: {
    width: 3,
    height: '100%',
    backgroundColor: colors.forest || colors.inkSoft,
    borderRadius: 2,
  },
  replyBarContent: {
    flex: 1,
  },
  replyBarSender: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.forest || colors.inkSoft,
  },
  replyBarText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.charcoal,
    marginTop: 1,
  },
  cancelReplyBtn: {
    padding: 4,
  },
  // Message Actions Modal Sheet
  actionModalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
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
    borderBottomColor: colors.overlayLight,
  },
  actionModalTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.textMuted,
  },
  actionModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionItemTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
  },
  actionItemSub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  actionModalCancel: {
    marginTop: 14,
    paddingVertical: 12,
    backgroundColor: colors.paper,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionModalCancelText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
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
    backgroundColor: colors.emeraldLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.emeraldLight,
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
    shadowColor: colors.ink,
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
    backgroundColor: colors.forest || colors.inkSoft,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 10,
    color: colors.cream,
  },
  // Reaction Bar
  reactionBarContainer: {
    backgroundColor: colors.paper,
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
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reactionEmojiText: {
    fontSize: 22,
      fontFamily: typography.body,
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
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.overlayLight,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  reactionBadgePillActive: {
    backgroundColor: colors.paperLight,
    borderColor: colors.charcoal,
  },
  reactionBadgeEmoji: {
    fontSize: 12,
      fontFamily: typography.body,
  },
  reactionBadgeCount: {
    fontSize: 11,
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
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 999,
  },
  toastText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.cream,
  },
  // Wardrobe strip tabs & link button
  wardrobeTabMini: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.paperDark,
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  wardrobeTabMiniActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  wardrobeTabMiniText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.charcoal,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.white,
  },
  // In-Message Deal Card (ListHeaderComponent)
  inMessageDealCard: {
    backgroundColor: colors.white,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.overlayLight,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  inMessageDealTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paperLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.white,
  },
  inMessageDealUnlinkText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.copper,
  },
  inMessageDealTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
    marginTop: 1,
  },
  inMessageDealPrice: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.forest || colors.emeraldDark,
    marginTop: 2,
  },
  inMessageDealAction: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.paper,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  inMessageDealActionText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.charcoal,
  },
  inMessageSellerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.paperLight,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.paperDark,
  },
  inMessageSellerBannerText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
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
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  inBubbleSnippetTheir: {
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.paperDark,
  },
  inBubbleSnippetThumb: {
    width: 40,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  inBubbleSnippetBrand: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
  },
  inBubbleSnippetTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    marginTop: 1,
  },
  inBubbleSnippetPrice: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
  },
  inBubbleSnippetBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 3,
  },
  inBubbleSnippetBtnText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
  },
  // Transactions Hub Modal Styles
  hubSection: {
    gap: 8,
  },
  hubSectionLabel: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.textMuted,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.copper,
  },
  hubGarmentTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
  },
  hubGarmentPrice: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.forest || colors.emeraldDark,
    marginTop: 2,
  },
  hubActionMiniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 3,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.charcoal,
    alignItems: 'center',
  },
  hubActionMiniText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
  },
  hubEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.paper,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.paperDark,
  },
  hubEmptyText: {
    flex: 1,
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 21,
  },
  hubTabPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: colors.paperDark,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  hubTabPillActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  hubTabPillText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
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
    borderColor: colors.paperDark,
    alignItems: 'center',
  },
  hubGarmentPillThumb: {
    width: 60,
    height: 60,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    marginBottom: 6,
  },
  hubGarmentPillTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
    textAlign: 'center',
    width: '100%',
  },
  hubGarmentPillPrice: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.forest || colors.emeraldDark,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.cream,
  },
  hubLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.paper,
  },
  hubLinkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubLinkTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
  },
  hubLinkSub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 14,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
  },
});
