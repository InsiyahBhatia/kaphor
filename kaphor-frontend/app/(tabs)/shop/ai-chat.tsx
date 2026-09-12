import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Image, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, typography } from '../../../src/theme';
import { useAuth } from '../../../src/context/AuthContext';
import api from '../../../src/services/api';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';

interface ChatProduct {
    id: string;
    title: string;
    brand?: string;
    price?: number | null;
    rentalPriceDay?: number | null;
    images?: string[];
    category?: string;
    listingType?: string;
}

interface MessageItem {
    role: 'user' | 'assistant';
    content: string;
    image?: string;
    products?: ChatProduct[];
}

export default function AIChatScreen() {
    const { garmentId, initialMessage } = useLocalSearchParams<{ garmentId?: string; initialMessage?: string }>();
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    useBackHandler('/(tabs)/shop');
    
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [inputText, setInputText] = useState('');
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setIsKeyboardVisible(true));
        const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsKeyboardVisible(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        if (initialMessage) {
            handleSendMessage(initialMessage);
        }
    }, []);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission required', 'Grant photo gallery permissions to ask AI about your outfit.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
            setSelectedPhoto(result.assets[0].uri);
        }
    };

    const handleSendMessage = async (text: string) => {
        if ((!text.trim() && !selectedPhoto) || loading) return;
        
        const photoToSend = selectedPhoto;
        const userMsg: MessageItem = { 
            role: 'user', 
            content: text.trim() || '📷 Visual Styling Query',
            image: photoToSend || undefined
        };

        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setSelectedPhoto(null);
        setLoading(true);

        try {
            let base64Image: string | undefined = undefined;
            if (photoToSend) {
                const base64 = await FileSystem.readAsStringAsync(photoToSend, { encoding: 'base64' });
                base64Image = `data:image/jpeg;base64,${base64}`;
            }

            const { data } = await api.post('/ai/chat', {
                message: text.trim(),
                image: base64Image,
                garmentId,
                conversationId,
                stream: false
            });

            if (data.conversationId) setConversationId(data.conversationId);
            
            const fullText = data.text;
            const returnedProducts: ChatProduct[] = Array.isArray(data.products) ? data.products : [];
            let currentText = '';
            
            setMessages(prev => [...prev, { role: 'assistant', content: '', products: returnedProducts }]);

            for (let i = 0; i < fullText.length; i++) {
                currentText += fullText[i];
                setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1] = { 
                        role: 'assistant', 
                        content: currentText, 
                        products: returnedProducts 
                    };
                    return next;
                });
                await new Promise(r => setTimeout(r, 12)); 
            }
        } catch (error) {
            console.error('Chat error', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an issue connecting with the styling catalog. Please try again.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
                <TouchableOpacity 
                    onPress={() => safeBack('/(tabs)/shop')}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Ionicons name="close" size={26} color={colors.charcoal} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                    <Text style={styles.headerTitle}>AI SHOPPING AGENT</Text>
                    <Text style={styles.headerSub}>DISCOVER // PAIR // ARCHIVE</Text>
                </View>
                <TouchableOpacity onPress={() => setMessages([])} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name="refresh-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </View>

            <ScrollView 
                ref={scrollViewRef}
                style={styles.chatContainer}
                contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
                {messages.length === 0 && (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="sparkles" size={36} color={colors.crimson} />
                        </View>
                        <Text style={styles.emptyTitle}>KAPHOR SHOPPING AGENT</Text>
                        <Text style={styles.emptySub}>
                            Ask for outfit recommendations, find matching jewelry or bags, or upload a photo to find similar pieces in the catalog.
                        </Text>

                        {/* Quick Prompts */}
                        <View style={styles.quickPrompts}>
                            <TouchableOpacity 
                                style={styles.promptChip}
                                onPress={() => handleSendMessage('Recommend statement ethnic pieces for a wedding')}
                            >
                                <Ionicons name="flash-outline" size={14} color={colors.charcoal} />
                                <Text style={styles.promptChipText}>Statement ethnic pieces</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.promptChip}
                                onPress={() => handleSendMessage('Find minimalist luxury handbags and accessories')}
                            >
                                <Ionicons name="search-outline" size={14} color={colors.charcoal} />
                                <Text style={styles.promptChipText}>Minimalist bags & accessories</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.promptChip}
                                onPress={pickImage}
                            >
                                <Ionicons name="camera-outline" size={14} color={colors.crimson} />
                                <Text style={[styles.promptChipText, { color: colors.crimson, fontWeight: '700' }]}>Match from my photo</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {messages.map((m, i) => (
                    <View key={i} style={[styles.messageWrapper, m.role === 'user' ? styles.userWrapper : styles.aiWrapper]}>
                        <View style={[styles.messageBubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                            {m.image && (
                                <Image source={{ uri: m.image }} style={styles.bubbleUploadedImage} />
                            )}
                            <Text style={[styles.messageText, m.role === 'user' ? styles.userText : styles.aiText]}>
                                {m.content}
                            </Text>
                        </View>

                        {/* Interactive Catalog Product Recommendations */}
                        {m.products && m.products.length > 0 && (
                            <View style={styles.productsContainer}>
                                <Text style={styles.productsSectionTitle}>MATCHING IN-APP PIECES</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsRow}>
                                    {m.products.map((prod) => (
                                        <TouchableOpacity
                                            key={prod.id}
                                            style={styles.productCard}
                                            onPress={() => router.push(`/(tabs)/shop/${prod.id}` as any)}
                                            activeOpacity={0.88}
                                        >
                                            {prod.images && prod.images[0] ? (
                                                <Image source={{ uri: prod.images[0] }} style={styles.prodThumb} />
                                            ) : (
                                                <View style={[styles.prodThumb, styles.prodThumbPlaceholder]}>
                                                    <Ionicons name="shirt-outline" size={24} color={colors.textMuted} />
                                                </View>
                                            )}
                                            <View style={styles.prodInfo}>
                                                <Text style={styles.prodBrand} numberOfLines={1}>
                                                    {(prod.brand || 'KAPHOR ARCHIVE').toUpperCase()}
                                                </Text>
                                                <Text style={styles.prodTitle} numberOfLines={1}>
                                                    {prod.title}
                                                </Text>
                                                <Text style={styles.prodPrice}>
                                                    {prod.listingType === 'RENTAL' 
                                                        ? `₹${prod.rentalPriceDay || 299}/day` 
                                                        : `₹${prod.price || 999}`}
                                                </Text>
                                                <View style={styles.viewBadge}>
                                                    <Text style={styles.viewBadgeText}>VIEW ITEM →</Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                ))}

                {loading && messages[messages.length - 1]?.role === 'user' && (
                    <View style={styles.aiLoadingBox}>
                        <ActivityIndicator size="small" color={colors.crimson} />
                        <Text style={styles.aiLoadingText}>AI Shopping Agent is searching the catalog...</Text>
                    </View>
                )}
            </ScrollView>

            {/* Photo Attachment Preview */}
            {selectedPhoto && (
                <View style={styles.attachedPhotoBar}>
                    <Image source={{ uri: selectedPhoto }} style={styles.attachedThumb} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.attachedTitle}>Photo attached for styling analysis</Text>
                        <Text style={styles.attachedSub}>Ask about matchings, sizing, or circular value</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedPhoto(null)} style={styles.removePhotoBtn}>
                        <Ionicons name="close-circle" size={22} color={colors.charcoal} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Input Bar */}
            <View
                style={[
                    styles.inputArea,
                    {
                        paddingBottom: isKeyboardVisible
                            ? 8
                            : Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8),
                    },
                ]}
            >
                <TouchableOpacity 
                    style={styles.photoAttachBtn} 
                    onPress={pickImage}
                    activeOpacity={0.8}
                >
                    <Ionicons name="camera-outline" size={22} color={colors.charcoal} />
                </TouchableOpacity>

                <View style={[styles.inputWrapper, isInputFocused && styles.inputWrapperFocused]}>
                    <TextInput
                        style={styles.input}
                        placeholder={selectedPhoto ? "Ask anything about this piece..." : "Ask styling, fabrics, or find garments..."}
                        placeholderTextColor="rgba(30,31,34,0.45)"
                        value={inputText}
                        onChangeText={setInputText}
                        onFocus={() => {
                            setIsInputFocused(true);
                            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
                        }}
                        onBlur={() => setIsInputFocused(false)}
                        onSubmitEditing={() => handleSendMessage(inputText)}
                        multiline
                        maxLength={1000}
                    />
                </View>
                <TouchableOpacity 
                    style={[
                        styles.sendButton, 
                        (!inputText.trim() && !selectedPhoto) || loading ? styles.sendButtonDisabled : styles.sendButtonActive
                    ]} 
                    onPress={() => handleSendMessage(inputText)}
                    disabled={(!inputText.trim() && !selectedPhoto) || loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                        <Ionicons 
                            name="arrow-up" 
                            size={20} 
                            color={(!inputText.trim() && !selectedPhoto) ? colors.textMuted : colors.white} 
                        />
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { 
        paddingHorizontal: 20, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: colors.bgCard, 
        paddingBottom: 14, 
        borderBottomWidth: 1.5, 
        borderBottomColor: colors.border 
    },
    headerTitle: { color: colors.charcoal, fontSize: 16, fontFamily: 'BebasNeue_400Regular', letterSpacing: 1.5 },
    headerSub: { color: colors.textMuted, fontSize: 9, fontFamily: typography.mono, letterSpacing: 1 },
    chatContainer: { flex: 1 },
    messageWrapper: { marginBottom: 16 },
    userWrapper: { alignItems: 'flex-end' },
    aiWrapper: { alignItems: 'flex-start' },
    messageBubble: { maxWidth: '85%', padding: 14, borderRadius: 12 },
    userBubble: { 
        backgroundColor: colors.charcoal,
        borderTopRightRadius: 2,
    },
    aiBubble: { 
        backgroundColor: colors.bgCard, 
        borderWidth: 1.5, 
        borderColor: colors.border,
        borderTopLeftRadius: 2,
    },
    messageText: { fontSize: 14, lineHeight: 21, fontFamily: typography.mono },
    userText: { color: colors.white },
    aiText: { color: colors.textPrimary },
    bubbleUploadedImage: {
        width: 190,
        height: 190,
        borderRadius: 8,
        marginBottom: 10,
    },
    productsContainer: {
        marginTop: 10,
        width: '100%',
    },
    productsSectionTitle: {
        fontSize: 10,
        fontFamily: typography.mono,
        fontWeight: '800',
        color: colors.textMuted,
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4,
    },
    productsRow: {
        flexDirection: 'row',
        gap: 12,
        paddingLeft: 4,
        paddingRight: 16,
    },
    productCard: {
        width: 148,
        backgroundColor: colors.white,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    prodThumb: {
        width: '100%',
        height: 140,
        backgroundColor: '#EBE8DF',
    },
    prodThumbPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    prodInfo: {
        padding: 8,
    },
    prodBrand: {
        fontSize: 9,
        fontFamily: typography.mono,
        fontWeight: '800',
        color: colors.textMuted,
        letterSpacing: 0.5,
    },
    prodTitle: {
        fontSize: 12,
        fontFamily: typography.mono,
        color: colors.charcoal,
        marginTop: 2,
        fontWeight: '600',
    },
    prodPrice: {
        fontSize: 11,
        fontFamily: typography.mono,
        fontWeight: '800',
        color: colors.crimson,
        marginTop: 4,
    },
    viewBadge: {
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 4,
        paddingVertical: 3,
        alignItems: 'center',
        marginTop: 6,
    },
    viewBadgeText: {
        fontSize: 9,
        fontFamily: typography.mono,
        fontWeight: '800',
        color: colors.charcoal,
    },
    aiLoadingBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
    },
    aiLoadingText: {
        fontSize: 12,
        fontFamily: typography.mono,
        color: colors.textMuted,
    },
    attachedPhotoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFECE6',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    attachedThumb: {
        width: 42,
        height: 42,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.charcoal,
    },
    attachedTitle: {
        fontSize: 11,
        fontFamily: typography.mono,
        fontWeight: '700',
        color: colors.charcoal,
    },
    attachedSub: {
        fontSize: 9,
        fontFamily: typography.mono,
        color: colors.textMuted,
    },
    removePhotoBtn: {
        padding: 4,
    },
    inputArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingTop: 8,
        backgroundColor: '#FAF9F6',
        borderTopWidth: 1.5,
        borderTopColor: colors.border,
        gap: 8,
    },
    photoAttachBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#EBE8DF',
        marginBottom: 2,
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: colors.white,
        borderWidth: 1.5,
        borderColor: 'rgba(30,31,34,0.18)',
        borderRadius: 22,
        paddingHorizontal: 16,
        minHeight: 44,
        maxHeight: 120,
        justifyContent: 'center',
    },
    inputWrapperFocused: {
        borderColor: colors.charcoal,
    },
    input: {
        fontFamily: typography.mono,
        fontSize: 13,
        color: colors.charcoal,
        lineHeight: 18,
        maxHeight: 110,
        paddingVertical: Platform.OS === 'ios' ? 10 : 8,
        textAlignVertical: 'center',
    },
    sendButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    sendButtonActive: {
        backgroundColor: colors.charcoal,
    },
    sendButtonDisabled: {
        backgroundColor: '#EBE8DF',
    },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40, paddingHorizontal: 20 },
    emptyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F3EFE6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: colors.border,
    },
    emptyTitle: { color: colors.charcoal, fontSize: 18, fontFamily: 'BebasNeue_400Regular', letterSpacing: 1.5, marginBottom: 8 },
    emptySub: { color: colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18, fontFamily: typography.mono },
    quickPrompts: {
        marginTop: 24,
        width: '100%',
        gap: 8,
    },
    promptChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.white,
        borderWidth: 1.5,
        borderColor: colors.border,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
    },
    promptChipText: {
        fontSize: 12,
        fontFamily: typography.mono,
        color: colors.charcoal,
    },
});
