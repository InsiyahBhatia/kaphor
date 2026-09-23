import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { colors } from '../../src/theme';
import { safeBack, useBackHandler } from '../../src/utils/navigation';

export default function ResetPasswordScreen() {
  const router = useRouter();
  useBackHandler('/(auth)/login');
  const { token: urlToken } = useLocalSearchParams<{ token?: string }>();

  const [token, setToken] = useState(urlToken || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (!token.trim()) {
      Alert.alert('Required', 'Password reset token is missing. Please use the link sent to your email.');
      return;
    }
    if (!password) {
      Alert.alert('Required', 'Please enter a new password.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token: token.trim(),
        password,
      });
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to reset password. The link may have expired.';
      Alert.alert('Reset Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark-circle-outline" size={56} color={colors.forest} />
          </View>
          <Text style={styles.title}>PASSWORD RESET</Text>
          <Text style={styles.subtitle}>
            Your password has been successfully updated. You can now log in with your new credentials.
          </Text>
          <TouchableOpacity
            style={styles.mainBtn}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.mainBtnText}>GO TO LOGIN</Text>
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
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => safeBack('/(auth)/login')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Ionicons name="key-outline" size={40} color={colors.crimson} />
        </View>
        <Text style={styles.title}>RESET PASSWORD</Text>
        <Text style={styles.subtitle}>
          Enter your new password below to secure your KaPhor account.
        </Text>

        {!urlToken && (
          <TextInput
            style={styles.input}
            placeholder="RESET TOKEN"
            placeholderTextColor="#6B5C52"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
          />
        )}

        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.passwordInput}
            placeholder="NEW PASSWORD"
            placeholderTextColor="#6B5C52"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeBtn}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="CONFIRM NEW PASSWORD"
          placeholderTextColor="#6B5C52"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.mainBtn}
          onPress={handleReset}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.mainBtnText}>UPDATE PASSWORD</Text>
          )}
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: 24, paddingBottom: 160, flexGrow: 1 },
  backBtn: { marginTop: 36, width: 44, height: 44, justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(155, 35, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 37,
    fontFamily: 'BebasNeue_400Regular',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 18.5,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    fontWeight: '500',
  },
  input: {
    width: '100%',
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 18,
    color: colors.textPrimary,
    fontSize: 18.5,
    letterSpacing: 0.5,
    backgroundColor: colors.bgCard,
  },
  passwordWrapper: {
    width: '100%',
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    paddingHorizontal: 18,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    color: colors.textPrimary,
    fontSize: 18.5,
    letterSpacing: 0.5,
  },
  eyeBtn: {
    padding: 8,
  },
  mainBtn: {
    width: '100%',
    height: 56,
    backgroundColor: colors.crimson,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  mainBtnText: {
    color: colors.white,
    fontSize: 18.5,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
