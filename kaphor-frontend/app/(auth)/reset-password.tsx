import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SolarIcon } from '../../src/components/common/SolarIcon';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/services/api';
import { colors, typography } from '../../src/theme';
import { safeBack, useBackHandler } from '../../src/utils/navigation';
import { Spinner } from '../../src/components/common/Loader';
import { getErrorMessage } from '../../src/utils/errors';
import { KaphorMark } from '../../src/components/common/KaphorLogo';
import { Squiggle } from '../../src/components/common/HandText';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      const msg = getErrorMessage(err, 'Failed to reset password. The link may have expired.');
      Alert.alert('Reset Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <View style={[styles.iconCircle, { backgroundColor: colors.emeraldLight, borderColor: colors.forest }]}>
            <SolarIcon name="checkmark-circle-outline" size={44} color={colors.forest} />
          </View>
          <Text style={styles.title}>Password reset</Text>
          <Squiggle width={90} />
          <Text style={styles.subtitle}>
            Your password has been successfully updated. You can now log in with your new credentials.
          </Text>
          <TouchableOpacity
            style={styles.mainBtn}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go to sign in"
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.mainBtnText}>Back to Sign In</Text>
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
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 24) + 40 }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        <View style={styles.topBar}>
          <TouchableOpacity 
            accessibilityRole="button" 
            accessibilityLabel="Go back"
            style={styles.backBtn}
            onPress={() => safeBack('/(auth)/login')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <SolarIcon name="chevron-back" size={26} color={colors.ink} />
          </TouchableOpacity>

          <View style={styles.brandRow}>
            <KaphorMark size={28} />
            <Text style={styles.brandName}>KAPHOR</Text>
          </View>

          <View style={styles.topSpacer} />
        </View>

        <View style={styles.center}>
          <View style={styles.iconCircle}>
            <SolarIcon name="key-outline" size={40} color={colors.rose} />
          </View>
          <Text style={styles.title}>Reset password</Text>
          <Squiggle width={90} />
          <Text style={styles.subtitle}>
            Enter your new password below to secure your KaPhor account.
          </Text>

          {!urlToken && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>RESET TOKEN</Text>
              <TextInput 
                accessibilityLabel="Reset token"
                style={styles.input}
                placeholder="Paste reset token"
                placeholderTextColor={colors.textMuted}
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>NEW PASSWORD</Text>
            <View style={styles.passwordWrapper}>
              <TextInput 
                accessibilityLabel="New password"
                style={styles.passwordInput}
                placeholder="New password (min 8 chars)"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity 
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} 
                accessibilityRole="button" 
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <SolarIcon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>CONFIRM NEW PASSWORD</Text>
            <TextInput 
              accessibilityLabel="Confirm new password"
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.mainBtn, loading && styles.btnDisabled]}
            onPress={handleReset}
            disabled={loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Update password"
          >
            {loading ? (
              <Spinner color={colors.white} />
            ) : (
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.mainBtnText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scrollContent: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandName: {
    fontFamily: typography.condensed,
    fontSize: 22,
    letterSpacing: 4,
    color: colors.ink,
    includeFontPadding: false,
  },
  topSpacer: {
    width: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    marginVertical: 16,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.paperLight,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: typography.headings,
    fontSize: 32,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecond,
    fontFamily: typography.body,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  inputContainer: {
    width: '100%',
    gap: 6,
  },
  inputLabel: {
    fontFamily: typography.condensed,
    fontSize: 13,
    letterSpacing: 1.5,
    color: colors.inkSoft,
  },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 15,
    backgroundColor: colors.paperLight,
  },
  passwordWrapper: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperLight,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 15,
  },
  eyeBtn: {
    padding: 6,
  },
  mainBtn: {
    width: '100%',
    height: 54,
    backgroundColor: colors.rose,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 8,
  },
  mainBtnText: {
    color: colors.white,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
