import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../../../src/services/api';
import { colors, typography } from '../../../src/theme';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { hapticFeedback } from '../../../src/utils/haptics';
import {
  HandwrittenNote,
  EditorialIcon,
} from '../../../src/components/editorial/IllustrationLayer';
import { promptPhotoSelection } from '../../../src/utils/imagePicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface AgentActionLog {
  tool: string;
  description: string;
  count?: number;
}

export interface AgentCard {
  id: string;
  title: string;
  brand: string;
  price: number;
  rentalPriceDay?: number;
  listingType: 'BUY' | 'RENTAL' | 'ACCESSORY_SWAP';
  imageUrl: string;
  images?: string[];
  image?: string;
  condition: string;
  category: string;
  source: 'WARDROBE' | 'CATALOG';
  actionType: 'RENT' | 'SWAP' | 'BUY' | 'VIEW';
  actionUrl: string;
  actionLabel: string;
  badge?: string;
}

export interface AgentOutfitItem {
  slot: 'TOP' | 'BOTTOM' | 'OUTERWEAR' | 'ACCESSORY' | 'FOOTWEAR' | 'ACCENT';
  garment: AgentCard;
  isFromWardrobe: boolean;
  stylingNote?: string;
}

export interface AgentOutfitLook {
  title: string;
  vibe: string;
  occasion: string;
  editorialNote: string;
  items: AgentOutfitItem[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  actionsExecuted?: AgentActionLog[];
  cards?: AgentCard[];
  outfitLook?: AgentOutfitLook;
  suggestedFollowUps?: string[];
}

const QUICK_COMMANDS = [
  { label: 'Find an outfit for an event', prompt: 'Show me outfit ideas from the app for an evening dinner or party.' },
  { label: 'Rent under ₹1,000/day', prompt: 'Find pieces on the app available to rent under ₹1,000 per day.' },
  { label: 'Explore fair swaps', prompt: 'Find accessories on the app available to swap fairly.' },
  { label: 'Trending party looks', prompt: 'Show me trending party dresses and evening wear on the app.' },
  { label: 'Casual everyday styles', prompt: 'Show me comfortable, stylish everyday tops and denims.' },
];

function renderFormattedAgentText(text: string) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <Text
          key={idx}
          style={{
            fontFamily: typography.monoBold || typography.body,
            fontWeight: '700',
            color: colors.charcoal,
          }}
        >
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

export default function ShopAIChatScreen({ fallbackPath = '/(tabs)/shop' }: { fallbackPath?: string } = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { garmentId, initialMessage } = useLocalSearchParams<{ garmentId?: string; initialMessage?: string }>();
  useBackHandler(fallbackPath);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: "Hi! I'm KaPhor AI, your personal shopping and style assistant.\n\nTell me what you're looking for, an occasion you're dressing for, or your budget, and I'll find matching pieces from the app archive for you. What would you like to explore today?",
      suggestedFollowUps: [
        'Find an outfit for an event',
        'Find a rental under ₹1,000/day',
        'Trending party looks',
        'Casual everyday styles',
      ],
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const initialSentRef = useRef(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (initialMessage && !initialSentRef.current) {
      initialSentRef.current = true;
      handleSendPrompt(initialMessage);
    }
  }, [initialMessage]);

  const pickImage = async () => {
    promptPhotoSelection('Attach Garment Photo', (res) => {
      setImageUri(res.uri);
    });
  };

  const handleSendPrompt = async (promptToSend: string, imageToSend?: string | null) => {
    const trimmed = promptToSend.trim();
    if ((!trimmed && !imageToSend) || loading) return;

    hapticFeedback.light();

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed || 'Visual Styling Query',
      image: imageToSend || undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setImageUri(null);
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);

    try {
      let base64Image: string | undefined = undefined;
      if (imageToSend) {
        try {
          const base64 = await FileSystem.readAsStringAsync(imageToSend, { encoding: 'base64' });
          base64Image = `data:image/jpeg;base64,${base64}`;
        } catch {
          base64Image = imageToSend;
        }
      }

      const payload: any = {
        message: trimmed || 'Inspect this photo and recommend matching pieces from the app catalog.',
        garmentId,
        conversationId,
      };
      if (base64Image) {
        payload.image = base64Image;
      }

      const res = await api.post('/ai/chat', payload);
      const resData = res?.data?.data || res?.data || {};

      if (resData.conversationId) {
        setConversationId(resData.conversationId);
      }

      const replyText = resData.reply || resData.text || resData.message || 'I have found matching pieces on the app for your style.';

      // Normalize cards / products to guarantee images and URLs are populated
      const rawCards = resData.cards || resData.products || [];
      const normalizedCards: AgentCard[] = rawCards.map((c: any) => ({
        ...c,
        imageUrl: c.imageUrl || c.images?.[0] || c.image || '',
        price: c.price || 0,
        brand: c.brand || 'KAPHOR ARCHIVE',
        title: c.title || 'Curated Garment',
        actionUrl: c.actionUrl || `/(tabs)/shop/${c.id}`,
        actionLabel: c.actionLabel || (c.listingType === 'RENTAL' ? 'REQUEST RENTAL' : c.listingType === 'ACCESSORY_SWAP' ? 'REQUEST SWAP' : 'BUY PIECE'),
        badge: c.badge || (c.listingType === 'RENTAL' ? `RENT ₹${c.rentalPriceDay || 299}/DAY` : c.listingType === 'ACCESSORY_SWAP' ? 'PEER SWAP' : `BUY ₹${c.price || 999}`),
      }));

      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        actionsExecuted: resData.actionsExecuted || [],
        cards: normalizedCards,
        outfitLook: resData.outfitLook,
        suggestedFollowUps: resData.suggestedFollowUps || [],
      };

      setMessages((prev) => [...prev, agentMsg]);
      hapticFeedback.success();
    } catch (err: any) {
      console.warn('Agent request failed', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'I encountered an issue connecting to the styling engine. Please verify your connection and try again.',
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    }
  };

  const handleCardAction = (card: AgentCard) => {
    hapticFeedback.medium();
    if (card.actionUrl) {
      router.push(card.actionUrl as any);
    } else {
      router.push(`/(tabs)/shop/${card.id}` as any);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity
          onPress={() => safeBack(fallbackPath)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.charcoal} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerDeckEyebrow}>THE DECK</Text>
          <Text style={styles.headerTitle}>AI STYLIST</Text>
        </View>

        <TouchableOpacity
          style={styles.wardrobeQuickBtn}
          onPress={() => router.push('/(tabs)/shop' as any)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <EditorialIcon name="shop" size={20} />
        </TouchableOpacity>
      </View>

      {/* Quick Prompts Bar */}
      <View style={styles.quickCommandsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickCommandsScroll}
        >
          {QUICK_COMMANDS.map((cmd, i) => (
            <TouchableOpacity
              key={i}
              style={styles.quickCommandChip}
              onPress={() => handleSendPrompt(cmd.prompt)}
              activeOpacity={0.75}
            >
              <Ionicons name="sparkles" size={12} color={colors.charcoal} style={{ marginRight: 5 }} />
              <Text style={styles.quickCommandText}>{cmd.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Chat Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageScroll}
        contentContainerStyle={[
          styles.messageContent,
          { paddingBottom: isKeyboardVisible ? 20 : 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {messages.map((msg) => (
          <View key={msg.id} style={styles.messageContainer}>
            {msg.role === 'user' ? (
              <View style={styles.userBubbleWrapper}>
                {msg.image && (
                  <View style={styles.attachedImagePreview}>
                    <KaphorImage
                      uri={msg.image}
                      style={styles.userAttachedImg}
                      contentFit="cover"
                    />
                  </View>
                )}
                <View style={styles.userBubble}>
                  <Text style={styles.userBubbleText}>{msg.content}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.agentMessageWrapper}>
                {/* 1. Tool execution action logs */}
                {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                  <View style={styles.actionExecutionLogs}>
                    {msg.actionsExecuted.map((act, aIdx) => (
                      <View key={aIdx} style={styles.actionLogPill}>
                        <Ionicons name="checkmark-circle" size={13} color="#2E7D32" />
                        <Text style={styles.actionLogText}>{act.description}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* 2. Main Assistant Speech Bubble */}
                <View style={styles.agentBubble}>
                  <Text style={styles.agentBubbleText}>{renderFormattedAgentText(msg.content)}</Text>
                </View>

                {/* 3. Synthesized Outfit Look Card */}
                {msg.outfitLook && msg.outfitLook.items && msg.outfitLook.items.length > 0 && (
                  <View style={styles.outfitLookCard}>
                    <View style={styles.outfitHeaderRow}>
                      <View style={styles.outfitTagPill}>
                        <Ionicons name="sparkles" size={11} color={colors.cream} />
                        <Text style={styles.outfitTagText}>AI SYNTHESIZED LOOK</Text>
                      </View>
                      <Text style={styles.outfitLookTitle}>{msg.outfitLook.title}</Text>
                    </View>
                    <Text style={styles.outfitVibeText}>{msg.outfitLook.vibe} · {msg.outfitLook.occasion}</Text>

                    <View style={styles.outfitPiecesRow}>
                      {msg.outfitLook.items.map((item, pIdx) => (
                        <TouchableOpacity
                          key={pIdx}
                          style={styles.outfitPieceCard}
                          activeOpacity={0.8}
                          onPress={() => handleCardAction(item.garment)}
                        >
                          <View style={styles.outfitThumbWrapper}>
                            <KaphorImage
                              uri={item.garment.imageUrl || item.garment.images?.[0] || ''}
                              style={styles.outfitThumbImg}
                              contentFit="cover"
                            />
                            <View style={[
                              styles.outfitSourceBadge,
                              item.isFromWardrobe ? styles.sourceWardrobe : styles.sourceArchive
                            ]}>
                              <Text style={styles.outfitSourceText}>
                                {item.isFromWardrobe ? 'YOUR CLOSET' : (item.garment.listingType === 'ACCESSORY_SWAP' ? 'SWAP' : (item.garment.listingType || 'ARCHIVE'))}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.outfitPieceTitle} numberOfLines={1}>
                            {item.garment.title}
                          </Text>
                          <Text style={styles.outfitPieceRole}>
                            {item.slot}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {Boolean(msg.outfitLook.editorialNote) && (
                      <HandwrittenNote hasTape style={styles.deckNote}>
                        "{msg.outfitLook.editorialNote}"
                      </HandwrittenNote>
                    )}
                  </View>
                )}

                {/* 4. Interactive Garment Action Cards Carousel */}
                {msg.cards && msg.cards.length > 0 && (
                  <View style={styles.cardsCarouselContainer}>
                    <Text style={styles.cardsSectionLabel}>MATCHING PIECES FROM THE APP</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.cardsCarouselContent}
                    >
                      {msg.cards.map((card) => (
                        <TouchableOpacity
                          key={card.id}
                          style={styles.garmentActionCard}
                          activeOpacity={0.88}
                          onPress={() => handleCardAction(card)}
                        >
                          <View style={styles.cardImageWrapper}>
                            <KaphorImage
                              uri={card.imageUrl || card.images?.[0] || ''}
                              brand={card.brand}
                              category={card.category}
                              style={styles.cardImage}
                              contentFit="cover"
                            />
                            {Boolean(card.badge) && (
                              <View style={styles.cardBadge}>
                                <Text style={styles.cardBadgeText}>{card.badge}</Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.cardInfo}>
                            <Text style={styles.cardBrand}>{card.brand.toUpperCase()}</Text>
                            <Text style={styles.cardTitle} numberOfLines={1}>{card.title}</Text>
                            <Text style={styles.cardPrice}>
                              {card.rentalPriceDay ? `₹${card.rentalPriceDay.toLocaleString()}/day` : `₹${card.price.toLocaleString()}`}
                            </Text>

                            <TouchableOpacity
                              style={[
                                styles.cardActionBtn,
                                card.actionType === 'RENT' && styles.actionBtnRent,
                                card.actionType === 'SWAP' && styles.actionBtnSwap,
                              ]}
                              onPress={() => handleCardAction(card)}
                            >
                              <Text style={styles.cardActionBtnText}>{card.actionLabel}</Text>
                              <Ionicons name="arrow-forward" size={12} color={colors.cream} />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* 5. Suggested Follow-up Chips */}
                {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                  <View style={styles.followUpsRow}>
                    {msg.suggestedFollowUps.map((promptText, fIdx) => (
                      <TouchableOpacity
                        key={fIdx}
                        style={styles.followUpChip}
                        onPress={() => handleSendPrompt(promptText)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.followUpText}>"{promptText}"</Text>
                        <Ionicons name="arrow-forward" size={12} color={colors.charcoal} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        ))}

        {loading && (
          <View style={styles.loadingBubble}>
            <ActivityIndicator color={colors.charcoal} size="small" />
            <Text style={styles.loadingText}>KaPhor AI is analyzing style and finding matching pieces...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input Dock */}
      <View
        style={[
          styles.inputContainer,
          {
            paddingBottom: isKeyboardVisible
              ? 10
              : Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10),
          },
        ]}
      >
        {imageUri && (
          <View style={styles.imagePreviewBar}>
            <KaphorImage uri={imageUri} style={styles.attachedPreviewThumb} contentFit="cover" />
            <Text style={styles.imageAttachedText} numberOfLines={1}>Photo attached for styling analysis</Text>
            <TouchableOpacity onPress={() => setImageUri(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.charcoal} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={pickImage}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <EditorialIcon name="camera" size={22} tintColor={colors.charcoal} />
          </TouchableOpacity>

          <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
            <TextInput
              style={styles.textInput}
              placeholder="> QUERY_DATABASE // Ask KaPhor Stylist..."
              placeholderTextColor="rgba(30,31,34,0.45)"
              value={input}
              onChangeText={setInput}
              onFocus={() => {
                setIsFocused(true);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
              }}
              onBlur={() => setIsFocused(false)}
              onSubmitEditing={() => handleSendPrompt(input, imageUri)}
              returnKeyType="send"
              multiline
              maxLength={1000}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() && !imageUri) || loading ? styles.sendBtnDisabled : styles.sendBtnActive,
            ]}
            onPress={() => handleSendPrompt(input, imageUri)}
            disabled={(!input.trim() && !imageUri) || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.cream} size="small" />
            ) : (
              <Ionicons
                name="arrow-up"
                size={20}
                color={!input.trim() && !imageUri ? colors.textMuted : colors.cream}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: colors.charcoal,
    paddingBottom: 14,
    backgroundColor: colors.cream,
  },
  headerCenter: { alignItems: 'center' },
  headerDeckEyebrow: {
    fontFamily: typography.monoBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.gold,
    marginBottom: 2,
  },
  headerTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontFamily: typography.headings,
    letterSpacing: 2,
  },
  deckNote: {
    marginTop: 8,
    marginBottom: 4,
    alignSelf: 'stretch',
  },
  wardrobeQuickBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },

  quickCommandsBar: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  quickCommandsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  quickCommandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
  },
  quickCommandText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
    fontWeight: '600',
  },

  messageScroll: { flex: 1 },
  messageContent: { padding: 16, gap: 18 },
  messageContainer: { width: '100%' },

  userBubbleWrapper: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    alignItems: 'flex-end',
    gap: 6,
  },
  attachedImagePreview: {
    width: 140,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  userAttachedImg: { width: '100%', height: '100%' },
  userBubble: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  userBubbleText: {
    color: colors.cream,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
  },

  agentMessageWrapper: {
    alignSelf: 'flex-start',
    width: '100%',
    gap: 12,
  },
  actionExecutionLogs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  actionLogPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(46, 125, 50, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.25)',
  },
  actionLogText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: '#2E7D32',
    fontWeight: '700',
  },

  agentBubble: {
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    maxWidth: '92%',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  agentBubbleText: {
    color: colors.charcoal,
    fontFamily: typography.body,
    fontSize: 14.5,
    lineHeight: 22,
  },

  outfitLookCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 14,
    width: '100%',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  outfitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  outfitTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  outfitTagText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  outfitLookTitle: {
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.charcoal,
    flex: 1,
  },
  outfitVibeText: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 12,
  },
  outfitPiecesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  outfitPieceCard: {
    flex: 1,
    alignItems: 'center',
  },
  outfitThumbWrapper: {
    width: '100%',
    aspectRatio: 0.85,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.bgMuted,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.1)',
  },
  outfitThumbImg: { width: '100%', height: '100%' },
  outfitSourceBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  sourceWardrobe: { backgroundColor: '#2E7D32' },
  sourceArchive: { backgroundColor: colors.charcoal },
  outfitSourceText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '800',
  },
  outfitPieceTitle: {
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: '600',
    color: colors.charcoal,
    marginTop: 4,
    textAlign: 'center',
  },
  outfitPieceRole: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  outfitEditorialNote: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
    fontStyle: 'italic',
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.08)',
    paddingTop: 8,
    marginTop: 4,
  },

  cardsCarouselContainer: {
    width: '100%',
    marginTop: 4,
  },
  cardsSectionLabel: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  cardsCarouselContent: {
    gap: 12,
    paddingRight: 16,
  },
  garmentActionCard: {
    width: SCREEN_WIDTH * 0.52,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    overflow: 'hidden',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardImageWrapper: {
    width: '100%',
    aspectRatio: 0.95,
    backgroundColor: colors.bgMuted,
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  cardBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  cardBadgeText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardInfo: {
    padding: 10,
    gap: 3,
  },
  cardBrand: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.charcoal,
  },
  cardPrice: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '800',
    color: colors.charcoal,
    marginVertical: 2,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.charcoal,
    paddingVertical: 7,
    borderRadius: 6,
    marginTop: 4,
  },
  actionBtnRent: { backgroundColor: colors.copper },
  actionBtnSwap: { backgroundColor: colors.forest },
  cardActionBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  followUpsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  followUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.18)',
  },
  followUpText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
    fontWeight: '500',
  },

  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
    alignSelf: 'flex-start',
  },
  loadingText: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.textMuted,
  },

  inputContainer: {
    backgroundColor: colors.white,
    borderTopWidth: 1.5,
    borderTopColor: colors.charcoal,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  imagePreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  attachedPreviewThumb: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  imageAttachedText: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cameraBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.bgMuted,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
    minHeight: 40,
    maxHeight: 100,
    justifyContent: 'center',
  },
  inputWrapperFocused: {
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  textInput: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.charcoal,
    maxHeight: 90,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnActive: {
    backgroundColor: colors.charcoal,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(30,31,34,0.2)',
  },
});
