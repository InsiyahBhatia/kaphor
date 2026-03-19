import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email) { Alert.alert('Error', 'Please enter your email.'); return; }
    setSending(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to send reset email.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="mail-outline" size={64} color="#C9A84C" />
          <Text style={styles.title}>CHECK YOUR EMAIL</Text>
          <Text style={styles.subtitle}>We've sent a password reset link to {email}</Text>
          <TouchableOpacity style={styles.mainBtn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.mainBtnText}>BACK TO LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="white" />
      </TouchableOpacity>
      <View style={styles.center}>
        <Ionicons name="lock-open-outline" size={48} color="#C9A84C" />
        <Text style={styles.title}>FORGOT PASSWORD</Text>
        <Text style={styles.subtitle}>Enter your email and we'll send you a reset link</Text>
        <TextInput
          style={styles.input}
          placeholder="EMAIL ADDRESS"
          placeholderTextColor="#6B5C52"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.mainBtn} onPress={handleSend} disabled={sending}>
          {sending ? <ActivityIndicator color="#1A0C10" /> : <Text style={styles.mainBtnText}>SEND RESET LINK</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0C10', padding: 24 },
  backBtn: { marginTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  title: { fontSize: 28, fontFamily: 'CormorantGaramond_700Bold', color: '#C9A84C', textAlign: 'center' },
  subtitle: { color: '#6B5C52', fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
  input: { width: '100%', height: 56, borderWidth: 1, borderColor: '#3A2C30', borderRadius: 8, paddingHorizontal: 16, color: 'white', fontSize: 14, letterSpacing: 1 },
  mainBtn: { width: '100%', height: 56, backgroundColor: '#C9A84C', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  mainBtnText: { color: '#1A0C10', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
});
