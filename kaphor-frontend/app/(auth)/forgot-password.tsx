import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { colors } from '../../src/theme';
import { safeBack, useBackHandler } from '../../src/utils/navigation';
import { Spinner } from '../../src/components/common/Loader';
import { getErrorMessage } from '../../src/utils/errors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  useBackHandler('/(auth)/login');
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
      Alert.alert('Error', getErrorMessage(err, 'Failed to send reset email.'));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="mail-outline" size={64} color={colors.crimson} />
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>We've sent a password reset link to {email}</Text>
          <TouchableOpacity style={styles.mainBtn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.mainBtnText}>Back to login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" 
          style={styles.backBtn} 
          onPress={() => safeBack('/(auth)/login')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.center}>
          <Ionicons name="lock-open-outline" size={48} color={colors.crimson} />
          <Text style={styles.title}>Forgot password</Text>
          <Text style={styles.subtitle}>Enter your email and we'll send you a reset link</Text>
          <TextInput accessibilityLabel="Email address"
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.mainBtn} onPress={handleSend} disabled={sending}>
            {sending ? <Spinner color={colors.white} /> : <Text style={styles.mainBtnText}>Send reset link</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: 24, paddingBottom: 160, flexGrow: 1, justifyContent: 'space-between' },
  backBtn: { marginTop: 36, width: 44, height: 44, justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, marginVertical: 20 },
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

