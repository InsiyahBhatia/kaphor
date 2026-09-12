import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../src/services/api';
import { colors, typography } from '../../../src/theme';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useBackHandler('/(tabs)/circular');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Namaste! I'm your Kaphor style advisor. Ask me about styling, fabric care, sustainable fashion, or how to mix heritage pieces with modern looks." },
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
    Alert.alert('Attach Photo', 'Select image source for style advice', [
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
          } catch {}
        },
      },
      {
        text: 'Choose from Gallery',
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
          } catch {}
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/studio')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
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

      {/* Proper Text Box Above Keyboard */}
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
            <Ionicons name="camera" size={20} color={colors.charcoal} />
          </TouchableOpacity>

          <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask about styling, fabric care..."
              placeholderTextColor="rgba(30,31,34,0.4)"
              value={input}
              onChangeText={setInput}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
              multiline
              maxLength={1000}
            />
          </View>

          <TouchableOpacity 
            style={[
              styles.sendBtn, 
              (!input.trim() && !imageUri) || loading ? styles.sendBtnDisabled : styles.sendBtnActive
            ]} 
            onPress={sendMessage} 
            disabled={(!input.trim() && !imageUri) || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons 
                name="arrow-up" 
                size={20} 
                color={(!input.trim() && !imageUri) ? colors.textMuted : colors.white} 
              />
            )}
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
  inputContainer: { 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(30,31,34,0.08)', 
    backgroundColor: '#FAF9F6' 
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
    borderRadius: 8, 
    borderWidth: 1.5, 
    borderColor: 'rgba(30,31,34,0.15)' 
  },
  removeImageBtn: { 
    position: 'absolute', 
    top: 4, 
    left: 64,
    backgroundColor: colors.white,
    borderRadius: 12,
  },
  inputBar: { 
    flexDirection: 'row', 
    alignItems: 'flex-end',
    paddingHorizontal: 12, 
    paddingTop: 8,
    gap: 8 
  },
  attachBtn: { 
    width: 42, 
    height: 42, 
    borderRadius: 21,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: 'rgba(30,31,34,0.12)',
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
  textInput: { 
    fontFamily: typography.mono,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 18,
    maxHeight: 110,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    textAlignVertical: 'center',
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
});
