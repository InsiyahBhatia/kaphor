import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { colors } from '../../src/theme';

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
          <Ionicons name="mail-outline" size={64} color={colors.crimson} />
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
        <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.center}>
        <Ionicons name="lock-open-outline" size={48} color={colors.crimson} />
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
          {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.mainBtnText}>SEND RESET LINK</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  backBtn: { marginTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  title: { fontSize: 32, fontFamily: 'BebasNeue_400Regular', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontSize: 16, textAlign: 'center', lineHeight: 24, paddingHorizontal: 20, fontWeight: '500' },
  input: { width: '100%', height: 60, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 20, color: colors.textPrimary, fontSize: 15, letterSpacing: 1, backgroundColor: colors.bgCard },
  mainBtn: { 
    width: '100%', 
    height: 60, 
    backgroundColor: colors.crimson, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mainBtnText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
});
