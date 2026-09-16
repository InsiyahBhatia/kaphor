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
  Image,
  Alert,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../src/services/api';
import { colors, typography } from '../../../src/theme';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { hapticFeedback } from '../../../src/utils/haptics';

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

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useBackHandler('/(tabs)/circular');

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: "Hi! I'm KaPhor AI, your personal shopping and style helper.\n\nTell me what you're looking for, an event you're dressing for, or your budget, and I'll find the best pieces on the app for you. What would you like to see today?",
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
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const pickImage = async () => {
    Alert.alert('Attach Garment Photo', 'Select an outfit photo or garment for the agent to inspect:', [
      {
        text: 'Take Photo',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.85,
            });
            if (!result.canceled && result.assets && result.assets[0]) {
              setImageUri(result.assets[0].uri);
            }
          } catch { }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.85,
            });
            if (!result.canceled && result.assets && result.assets[0]) {
              setImageUri(result.assets[0].uri);
            }
          } catch { }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSendPrompt = async (promptToSend: string, imageToSend?: string | null) => {
    const trimmed = promptToSend.trim();
    if ((!trimmed && !imageToSend) || loading) return;

    hapticFeedback.light();

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      image: imageToSend || undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setImageUri(null);
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);

    try {
      const payload: any = {
        message: trimmed || 'Inspect this photo and recommend matching pieces from my closet or archive.',
      };
      if (imageToSend) {
        payload.image = imageToSend;
      }

      const res = await api.post('/ai/chat', payload);
      const resData = res?.data?.data || res?.data || {};

      const replyText = resData.reply || resData.text || resData.message || 'I have analyzed your request and prepared these recommendations.';

      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        actionsExecuted: resData.actionsExecuted || [],
        cards: resData.cards || resData.products || [],
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
          onPress={() => safeBack('/(tabs)/studio')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.charcoal} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>KAPHOR STYLIST AGENT</Text>
          <View style={styles.agentStatusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>AUTONOMOUS STYLIST · ONLINE</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.wardrobeQuickBtn}
          onPress={() => router.push('/(tabs)/profile/wardrobe')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="shirt-outline" size={20} color={colors.charcoal} />
        </TouchableOpacity>
      </View>

      {/* Quick Agent Commands Bar */}
      <View style={styles.quickCommandsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickCommandsContent}
        >
          {QUICK_COMMANDS.map((cmd, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.quickChip}
              onPress={() => handleSendPrompt(cmd.prompt)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText}>{cmd.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Chat Messages Stream */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          if (isUser) {
            return (
              <View key={msg.id} style={styles.userBubbleWrapper}>
                <View style={styles.userBubble}>
                  {msg.image && (
                    <Image source={{ uri: msg.image }} style={styles.userMsgImage} />
                  )}
                  {Boolean(msg.content) && (
                    <Text style={styles.userBubbleText}>{msg.content}</Text>
                  )}
                </View>
              </View>
            );
          }

          // Assistant / Agent Message
          return (
            <View key={msg.id} style={styles.agentBubbleWrapper}>
              <View style={styles.agentBubbleHeader}>
                <View style={styles.agentIconCircle}>
                  <Ionicons name="sparkles" size={13} color={colors.cream} />
                </View>
                <Text style={styles.agentHeaderName}>KAPHOR STYLIST AGENT</Text>
              </View>

              <View style={styles.agentCardBody}>
                {/* 1. Agent Tool Execution Badges */}
                {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                  <View style={styles.agentActionsBox}>
                    <Text style={styles.actionsBoxHeader}>WHAT I FOUND IN THE APP</Text>
                    {msg.actionsExecuted.map((act, idx) => (
                      <View key={idx} style={styles.actionItemRow}>
                        <Ionicons name="checkmark-circle" size={13} color="#2E7D32" />
                        <Text style={styles.actionItemText}>{act.description}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* 2. Editorial Stylist Narrative */}
                {Boolean(msg.content) && (
                  <Text style={styles.agentNarrativeText}>{msg.content}</Text>
                )}

                {/* 3. Curated Outfit Lookbook Widget */}
                {msg.outfitLook && msg.outfitLook.items && (
                  <View style={styles.outfitWidgetContainer}>
                    <View style={styles.outfitWidgetHeader}>
                      <Ionicons name="color-wand-outline" size={16} color={colors.crimson} />
                      <Text style={styles.outfitWidgetTitle}>{msg.outfitLook.title.toUpperCase()}</Text>
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
                              uri={item.garment.imageUrl}
                              style={styles.outfitThumbImg}
                              contentFit="cover"
                            />
                            <View style={[
                              styles.outfitSourceBadge,
                              item.isFromWardrobe ? styles.sourceWardrobe : styles.sourceArchive
                            ]}>
                              <Text style={styles.outfitSourceText}>
                                {item.isFromWardrobe ? 'YOUR CLOSET' : item.garment.listingType}
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
                      <Text style={styles.outfitEditorialNote}>{msg.outfitLook.editorialNote}</Text>
                    )}
                  </View>
                )}

                {/* 4. Interactive Garment Action Cards Carousel */}
                {msg.cards && msg.cards.length > 0 && (
                  <View style={styles.cardsCarouselContainer}>
                    <Text style={styles.cardsSectionLabel}>CURATED PIECES FOR YOU</Text>
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
                              uri={card.imageUrl || (card as any).images?.[0] || (card as any).image || ''}
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
                      >
                        <Text style={styles.followUpChipText}>{promptText}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.agentBubbleWrapper}>
            <View style={styles.agentBubbleHeader}>
              <View style={styles.agentIconCircle}>
                <Ionicons name="sparkles" size={13} color={colors.cream} />
              </View>
              <Text style={styles.agentHeaderName}>AGENT REASONING...</Text>
            </View>
            <View style={[styles.agentCardBody, styles.loadingCardBody]}>
              <ActivityIndicator size="small" color={colors.charcoal} />
              <Text style={styles.loadingStatusText}>
                Inspecting digital wardrobe & running circular styling tools...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View
        style={[
          styles.inputContainer,
          {
            paddingBottom: isKeyboardVisible
              ? 8
              : Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8),
          },
        ]}
      >
        {imageUri && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
              <Ionicons name="close-circle" size={22} color={colors.charcoal} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={pickImage}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="camera-outline" size={22} color={colors.charcoal} />
          </TouchableOpacity>

          <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask KaPhor AI: outfit, rental, swap..."
              placeholderTextColor="rgba(30,31,34,0.4)"
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
  headerTitle: {
    color: colors.charcoal,
    fontSize: 15,
    fontFamily: typography.mono,
    fontWeight: '900',
    letterSpacing: 2,
  },
  agentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E7D32',
  },
  statusText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
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
    backgroundColor: '#F7F5EE',
  },
  quickCommandsContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
  },
  quickChipText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.charcoal,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 24 },

  userBubbleWrapper: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    marginBottom: 16,
  },
  userBubble: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 2,
  },
  userMsgImage: {
    width: 160,
    height: 200,
    borderRadius: 10,
    marginBottom: 8,
  },
  userBubbleText: {
    color: colors.cream,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
  },

  agentBubbleWrapper: {
    alignSelf: 'flex-start',
    width: '100%',
    marginBottom: 20,
  },
  agentBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  agentIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentHeaderName: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1.5,
  },

  agentCardBody: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 3,
  },
  loadingCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  loadingStatusText: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.charcoal,
    flex: 1,
  },

  agentActionsBox: {
    backgroundColor: '#F1F8E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    padding: 10,
    marginBottom: 12,
    borderRadius: 4,
  },
  actionsBoxHeader: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: '#2E7D32',
    letterSpacing: 1,
    marginBottom: 6,
  },
  actionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  actionItemText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: '#1B5E20',
    flex: 1,
  },

  agentNarrativeText: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.charcoal,
    lineHeight: 22,
  },

  outfitWidgetContainer: {
    marginTop: 14,
    backgroundColor: '#FAF9F6',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 12,
  },
  outfitWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  outfitWidgetTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1.2,
  },
  outfitVibeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 10,
  },
  outfitPiecesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  outfitPieceCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
    padding: 6,
  },
  outfitThumbWrapper: {
    width: '100%',
    height: 80,
    position: 'relative',
    marginBottom: 6,
  },
  outfitThumbImg: {
    width: '100%',
    height: '100%',
  },
  outfitSourceBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  sourceWardrobe: {
    backgroundColor: '#1B5E20',
  },
  sourceArchive: {
    backgroundColor: colors.crimson,
  },
  outfitSourceText: {
    fontFamily: typography.mono,
    fontSize: 7,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  outfitPieceTitle: {
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: '700',
    color: colors.charcoal,
  },
  outfitPieceRole: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 2,
  },
  outfitEditorialNote: {
    fontFamily: typography.body,
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.charcoal,
    lineHeight: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.08)',
    paddingTop: 8,
  },

  cardsCarouselContainer: {
    marginTop: 14,
  },
  cardsSectionLabel: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  cardsCarouselContent: {
    gap: 10,
    paddingRight: 10,
  },
  garmentActionCard: {
    width: 170,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    overflow: 'hidden',
  },
  cardImageWrapper: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(30,31,34,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
  },
  cardBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  cardInfo: {
    padding: 8,
  },
  cardBrand: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.red,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontFamily: typography.headings,
    fontSize: 13,
    color: colors.charcoal,
    marginTop: 2,
  },
  cardPrice: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
    marginTop: 4,
    marginBottom: 8,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.charcoal,
    paddingVertical: 7,
  },
  actionBtnRent: {
    backgroundColor: colors.crimson,
  },
  actionBtnSwap: {
    backgroundColor: colors.copper,
  },
  cardActionBtnText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 1,
  },

  followUpsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.08)',
    paddingTop: 10,
  },
  followUpChip: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  followUpChipText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.charcoal,
    fontWeight: '700',
  },

  inputContainer: {
    borderTopWidth: 1.5,
    borderTopColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  imagePreviewContainer: {
    position: 'relative',
    paddingLeft: 16,
    paddingTop: 12,
    marginBottom: -4,
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    left: 64,
    backgroundColor: colors.white,
    borderRadius: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 22,
    paddingHorizontal: 16,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: 'center',
  },
  inputWrapperFocused: {
    borderColor: colors.charcoal,
    backgroundColor: '#FFFDF9',
  },
  textInput: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 18,
    maxHeight: 110,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  sendBtnActive: {
    backgroundColor: colors.charcoal,
  },
  sendBtnDisabled: {
    backgroundColor: '#EBE8DF',
    borderColor: '#D4CEBF',
  },
});
