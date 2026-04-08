import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../src/services/api';
import { colors } from '../../../src/theme';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

export default function AIChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Namaste! I'm your Kaphor style advisor. Ask me about styling, fabric care, sustainable fashion, or how to mix heritage pieces with modern looks." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !imageUri) || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim(), image: imageUri || undefined };
    setMessages((prev) => [...prev, userMsg]);
    
    // Prevent empty string from crashing backend
    const contentToSend = input.trim() || 'Can you analyze this image for style advice?';
    
    setInput('');
    setImageUri(null);
    setLoading(true);

    try {
      const { data } = await api.post('/ai/chat', { message: contentToSend, imageUrl: userMsg.image });
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
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>STYLE ADVISOR</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView ref={scrollRef} style={styles.chatArea} contentContainerStyle={styles.chatContent}>
        {messages.map((msg, i) => (
          <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            {msg.role === 'assistant' && <Ionicons name="sparkles" size={14} color={colors.crimson} style={{ marginBottom: 4 }} />}
            {msg.image && <Image source={{ uri: msg.image }} style={styles.msgImage} />}
            {msg.content ? <Text style={[styles.bubbleText, msg.role === 'user' && styles.userBubbleText]}>{msg.content}</Text> : null}
          </View>
        ))}
        {loading && (
          <View style={[styles.bubble, styles.aiBubble]}>
            <ActivityIndicator size="small" color={colors.crimson} />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        {imageUri && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
              <Ionicons name="close-circle" size={24} color={colors.charcoal} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
            <Ionicons name="camera-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Ask about styling, fabric care..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity style={[styles.sendBtn, (!input.trim() && !imageUri) && { opacity: 0.4 }]} onPress={sendMessage} disabled={(!input.trim() && !imageUri) || loading}>
            <Ionicons name="send" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 24, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 16 },
  headerTitle: { color: colors.crimson, fontSize: 16, fontFamily: 'BebasNeue_400Regular', letterSpacing: 2 },
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 20 },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: 16, marginBottom: 12 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.bgCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.crimson, borderBottomRightRadius: 4 },
  bubbleText: { color: colors.textPrimary, fontSize: 14, lineHeight: 22 },
  userBubbleText: { color: colors.white },
  msgImage: { width: 140, height: 180, borderRadius: 8, marginBottom: 8 },
  inputContainer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bgCard },
  imagePreviewContainer: { position: 'relative', paddingLeft: 16, paddingTop: 16 },
  imagePreview: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  removeImageBtn: { position: 'absolute', top: 4, left: 66 },
  inputBar: { flexDirection: 'row', padding: 16, gap: 12, alignItems: 'center' },
  attachBtn: { width: 40, height: 48, justifyContent: 'center', alignItems: 'center' },
  textInput: { flex: 1, height: 48, backgroundColor: colors.bgCard, borderRadius: 24, paddingHorizontal: 20, color: colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.crimson, justifyContent: 'center', alignItems: 'center' },
});
