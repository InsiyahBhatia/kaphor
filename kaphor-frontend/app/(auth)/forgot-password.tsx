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
import { useRouter } from 'expo-router';
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useBackHandler('/(auth)/login');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email.');
      return;
    }
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
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <View style={styles.iconCircle}>
            <SolarIcon name="mail-outline" size={44} color={colors.rose} />
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Squiggle width={90} />
          <Text style={styles.subtitle}>
            We've sent a password reset link to{'\n'}
            <Text style={{ fontFamily: typography.bodyBold, color: colors.ink }}>{email}</Text>
          </Text>
          <TouchableOpacity 
            style={styles.mainBtn} 
            onPress={() => router.replace('/(auth)/login')}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
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
            <SolarIcon name="lock-open-outline" size={40} color={colors.rose} />
          </View>
          <Text style={styles.title}>Forgot password</Text>
          <Squiggle width={80} />
          <Text style={styles.subtitle}>
            Enter your email and we'll send you an editorial recovery link
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
            <TextInput 
              accessibilityLabel="Email address"
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity 
            style={[styles.mainBtn, sending && styles.btnDisabled]} 
            onPress={handleSend} 
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel="Send reset link"
          >
            {sending ? <Spinner color={colors.white} /> : <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.mainBtnText}>Send Reset Link</Text>}
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
    marginBottom: 24,
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
    gap: 16,
    marginVertical: 20,
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
    marginTop: 8,
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
