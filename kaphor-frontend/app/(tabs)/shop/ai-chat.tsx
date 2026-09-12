import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../../../src/theme';
import { useAuth } from '../../../src/context/AuthContext';
import api from '../../../src/services/api';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';

export default function AIChatScreen() {
    const { garmentId, initialMessage } = useLocalSearchParams<{ garmentId?: string; initialMessage?: string }>();
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    useBackHandler('/(tabs)/shop');
    
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
    const [inputText, setInputText] = useState('');
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

    const handleSendMessage = async (text: string) => {
        if (!text.trim() || loading) return;
        
        const userMsg = { role: 'user' as const, content: text };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLoading(true);

        try {
            const { data } = await api.post('/ai/chat', {
                message: text,
                garmentId,
                conversationId,
                stream: false
            });

            if (data.conversationId) setConversationId(data.conversationId);
            
            // Typewriter effect for premium feel
            const fullText = data.text;
            let currentText = '';
            
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            for (let i = 0; i < fullText.length; i++) {
                currentText += fullText[i];
                setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1] = { role: 'assistant', content: currentText };
                    return next;
                });
                // Faster at start, slower as it goes
                await new Promise(r => setTimeout(r, 15)); 
            }
        } catch (error) {
            console.error('Chat error', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
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
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => safeBack('/(tabs)/shop')}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Ionicons name="close" size={28} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>KAPHOR AI ASSISTANT</Text>
                <TouchableOpacity onPress={() => setMessages([])}>
                    <Ionicons name="refresh" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </View>

            <ScrollView 
                ref={scrollViewRef}
                style={styles.chatContainer}
                contentContainerStyle={{ padding: 20 }}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
                {messages.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="sparkles" size={48} color={colors.crimson} style={{ marginBottom: 16 }} />
                        <Text style={styles.emptyTitle}>Ask anything about this garment</Text>
                        <Text style={styles.emptySub}>Fit, material, styling advice, or sustainability background.</Text>
                    </View>
                )}
                {messages.map((m, i) => (
                    <View key={i} style={[styles.messageBubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                        <Text style={[styles.messageText, m.role === 'user' ? styles.userText : styles.aiText]}>
                            {m.content}
                        </Text>
                    </View>
                ))}
                {loading && messages[messages.length-1]?.role === 'user' && (
                    <ActivityIndicator size="small" color={colors.crimson} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
                )}
            </ScrollView>

            {/* Proper Luxury Input Box */}
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
                <View style={[styles.inputWrapper, isInputFocused && styles.inputWrapperFocused]}>
                    <TextInput
                        style={styles.input}
                        placeholder="Ask about sizing, styling, fabric care..."
                        placeholderTextColor="rgba(30,31,34,0.4)"
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
                        !inputText.trim() || loading ? styles.sendButtonDisabled : styles.sendButtonActive
                    ]} 
                    onPress={() => handleSendMessage(inputText)}
                    disabled={!inputText.trim() || loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                        <Ionicons 
                            name="arrow-up" 
                            size={20} 
                            color={!inputText.trim() ? colors.textMuted : colors.white} 
                        />
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { paddingTop: 24, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bgCard, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { color: colors.crimson, fontSize: 13, fontFamily: 'BebasNeue_400Regular', letterSpacing: 2 },
    chatContainer: { flex: 1 },
    messageBubble: { maxWidth: '85%', padding: 14, borderRadius: 16, marginBottom: 16 },
    userBubble: { alignSelf: 'flex-end', backgroundColor: colors.crimson },
    aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
    messageText: { fontSize: 15, lineHeight: 22 },
    userText: { color: colors.white, fontWeight: '500' },
    aiText: { color: colors.textPrimary },
    inputArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingTop: 8,
        backgroundColor: '#FAF9F6',
        borderTopWidth: 1,
        borderTopColor: 'rgba(30,31,34,0.08)',
        gap: 8,
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: colors.white,
        borderWidth: 1.5,
        borderColor: 'rgba(30,31,34,0.14)',
        borderRadius: 22,
        paddingHorizontal: 16,
        minHeight: 44,
        maxHeight: 120,
        justifyContent: 'center',
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 3,
    },
    sendButtonDisabled: {
        backgroundColor: '#EBE8DF',
        shadowOpacity: 0,
        elevation: 0,
    },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyTitle: { color: colors.textPrimary, fontSize: 20, fontFamily: 'BebasNeue_400Regular', marginBottom: 8 },
    emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
