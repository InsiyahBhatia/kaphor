import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, spacing, typography, radius } from '../../theme';
import api, { persistTokens } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface RegisterResponse {
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

type StrengthLevel = 'weak' | 'medium' | 'strong';

function evaluateStrength(password: string): StrengthLevel {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (password.length >= 12) score += 1;

  if (score <= 1) return 'weak';
  if (score === 2) return 'medium';
  return 'strong';
}

export function RegisterScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusField, setFocusField] = useState<'displayName' | 'email' | 'username' | 'password' | null>(null);

  const strength = useMemo(() => evaluateStrength(password), [password]);

  const strengthLabel = useMemo(() => {
    if (!password) return '';
    if (strength === 'weak') return 'Weak';
    if (strength === 'medium') return 'Medium';
    return 'Strong';
  }, [password, strength]);

  const strengthColor = useMemo(() => {
    if (!password) return colors.border;
    if (strength === 'weak') return colors.error;
    if (strength === 'medium') return colors.warning;
    return colors.success;
  }, [password, strength]);

  const canSubmit =
    displayName.trim().length >= 2 &&
    email.trim().length > 0 &&
    username.trim().length >= 3 &&
    password.length >= 8 &&
    acceptTerms &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await api.post<RegisterResponse>('/auth/register', {
        displayName: displayName.trim(),
        email: email.trim(),
        username: username.trim(),
        password,
      });
      const { user, accessToken, refreshToken } = response.data.data;
      setAuth(user, accessToken);
      await persistTokens(accessToken, refreshToken);
      router.replace('/style-quiz');
    } catch (err: unknown) {
      setError('We could not create your account. Please review your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={styles.container} entering={FadeIn.duration(500)}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.logo}>KAPHOR</Text>
          <Text style={styles.heading}>Create your account</Text>
          <Text style={styles.subheading}>Curate, circulate, and track your impact.</Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Display name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name on Kaphor"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  focusField === 'displayName' && styles.inputFocused,
                ]}
                onFocus={() => setFocusField('displayName')}
                onBlur={() => setFocusField((field) => (field === 'displayName' ? null : field))}
              />
            </View>

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
              <Text style={styles.label}>Username</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="minimalist_energy"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  focusField === 'username' && styles.inputFocused,
                ]}
                onFocus={() => setFocusField('username')}
                onBlur={() => setFocusField((field) => (field === 'username' ? null : field))}
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
              <View style={styles.strengthRow}>
                <View style={[styles.strengthBar, { backgroundColor: strengthColor }]} />
                <Text style={styles.strengthLabel}>{strengthLabel}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAcceptTerms((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]} />
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>.
              </Text>
            </TouchableOpacity>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={styles.primaryLabel}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity
              onPress={() => router.push('/auth/login')}
              activeOpacity={0.85}
            >
              <Text style={styles.linkText}>Sign in</Text>
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
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
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
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  strengthBar: {
    height: 4,
    borderRadius: radius.full,
    flex: 1,
  },
  strengthLabel: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.textSecond,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  checkboxChecked: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  termsText: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textSecond,
  },
  termsLink: {
    color: colors.gold,
  },
  error: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.sm,
  },
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.crimson,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: colors.crimsonDark,
    opacity: 0.6,
  },
  primaryLabel: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 1,
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

export default RegisterScreen;

