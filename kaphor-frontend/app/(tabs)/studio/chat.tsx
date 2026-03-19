import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Namaste! I'm your Kaphor style advisor. Ask me about styling, fabric care, sustainable fashion, or how to mix heritage pieces with modern looks." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/ai/chat', { message: userMsg.content });
      const reply = data?.data?.reply || data?.data?.message || 'I couldn\'t process that. Try again!';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I couldn\'t connect. Please try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>STYLE ADVISOR</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView ref={scrollRef} style={styles.chatArea} contentContainerStyle={styles.chatContent}>
        {messages.map((msg, i) => (
          <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            {msg.role === 'assistant' && <Ionicons name="sparkles" size={14} color="#C9A84C" style={{ marginBottom: 4 }} />}
            <Text style={[styles.bubbleText, msg.role === 'user' && styles.userBubbleText]}>{msg.content}</Text>
          </View>
        ))}
        {loading && (
          <View style={[styles.bubble, styles.aiBubble]}>
            <ActivityIndicator size="small" color="#C9A84C" />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask about styling, fabric care..."
          placeholderTextColor="#6B5C52"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity style={[styles.sendBtn, !input.trim() && { opacity: 0.4 }]} onPress={sendMessage} disabled={!input.trim() || loading}>
          <Ionicons name="send" size={20} color="#1A0C10" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0C10' },
  header: { paddingTop: 60, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#3A2C30', paddingBottom: 16 },
  headerTitle: { color: '#C9A84C', fontSize: 16, fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 2 },
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 20 },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: 16, marginBottom: 12 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#2A1C20', borderBottomLeftRadius: 4 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#C9A84C', borderBottomRightRadius: 4 },
  bubbleText: { color: '#E0D6C8', fontSize: 14, lineHeight: 22 },
  userBubbleText: { color: '#1A0C10' },
  inputBar: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#3A2C30', gap: 12, alignItems: 'center' },
  textInput: { flex: 1, height: 48, backgroundColor: '#2A1C20', borderRadius: 24, paddingHorizontal: 20, color: 'white', fontSize: 14 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#C9A84C', justifyContent: 'center', alignItems: 'center' },
});
