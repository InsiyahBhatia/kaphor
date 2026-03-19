import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, spacing, typography, radius } from '../../theme';
import api, { persistTokens } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface LoginResponse {
  data: {
    user: {
      id: string;
      email: string;
      username?: string;
      displayName?: string;
      role: string;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusField, setFocusField] = useState<'email' | 'password' | null>(null);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await api.post<LoginResponse>('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = response.data.data;
      setAuth(user, accessToken);
      await persistTokens(accessToken, refreshToken);
      router.replace('/(tabs)/');
    } catch (err: unknown) {
      setError('We could not sign you in. Please check your email and password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={styles.gradientBg} entering={FadeIn.duration(500)}>
        <View style={styles.crimsonLayer} />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.logo}>KAPHOR</Text>
          <Text style={styles.heading}>Sign In</Text>
          <Text style={styles.subheading}>Enter your credentials to continue your cycle.</Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  focusField === 'email' && styles.inputFocused,
                ]}
                onFocus={() => setFocusField('email')}
                onBlur={() => setFocusField((field) => (field === 'email' ? null : field))}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  focusField === 'password' && styles.inputFocused,
                ]}
                onFocus={() => setFocusField('password')}
                onBlur={() => setFocusField((field) => (field === 'password' ? null : field))}
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={styles.primaryLabel}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotWrapper}
              onPress={() => {}}
              activeOpacity={0.8}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to Kaphor?</Text>
            <TouchableOpacity
              onPress={() => router.push('/auth/register')}
              activeOpacity={0.85}
            >
              <Text style={styles.linkText}>Start your cycle</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  gradientBg: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  crimsonLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    justifyContent: 'center',
  },
  logo: {
    fontFamily: typography.headings,
    fontSize: 28,
    letterSpacing: 5,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  heading: {
    fontFamily: typography.headings,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subheading: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textSecond,
    marginBottom: spacing.lg,
  },
  form: {
    marginTop: spacing.sm,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textSecond,
    marginBottom: spacing.xs,
  },
  input: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inputFocused: {
    borderBottomColor: colors.crimson,
  },
  error: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.crimson,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  forgotWrapper: {
    marginTop: spacing.sm,
    alignItems: 'flex-end',
  },
  forgotText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textSecond,
  },
  footerRow: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  linkText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.gold,
  },
});

export default LoginScreen;

