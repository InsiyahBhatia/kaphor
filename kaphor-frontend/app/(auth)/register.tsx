import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { colors, typography } from '../../src/theme';
import { useGoogleAuth } from '../../src/hooks/useGoogleAuth';
import { safeBack, useBackHandler } from '../../src/utils/navigation';
import { LegalModal } from '../../src/components/legal/LegalModal';
import { Spinner } from '../../src/components/common/Loader';
import { KaphorMark } from '../../src/components/common/KaphorLogo';
import { Squiggle } from '../../src/components/common/HandText';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useBackHandler('/(auth)/welcome');
  const { signUp, isLoading } = useAuth();
  const { loginWithGoogle, isGoogleLoading } = useGoogleAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalDocId, setLegalDocId] = useState('terms-and-conditions');

  const openLegal = (docId: string = 'terms-and-conditions') => {
    setLegalDocId(docId);
    setLegalModalVisible(true);
  };

  const getPasswordStrength = (pass: string) => {
    if (pass.length === 0) return null;
    if (pass.length < 10) return { label: 'Too short (min 10)', color: colors.rose };
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNum = /[0-9]/.test(pass);
    const hasSpecial = /[@$!%*?&]/.test(pass);
    if (hasUpper && hasLower && hasNum && hasSpecial) return { label: 'STRONG', color: colors.forest };
    const missing: string[] = [];
    if (!hasUpper) missing.push('uppercase');
    if (!hasLower) missing.push('lowercase');
    if (!hasNum) missing.push('number');
    if (!hasSpecial) missing.push('special (@$!%*?&)');
    return { label: `NEEDS: ${missing.join(', ')}`, color: colors.gold };
  };

  const strength = getPasswordStrength(password);

  const handleRegister = async () => {
    if (!email || !password || !displayName || !username) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!agreeToTerms) {
      Alert.alert(
        'Terms & Conditions Required',
        'Please review and agree to KaPhor\'s Terms & Conditions and Privacy Policy to create your account.',
        [
          { text: 'Review Terms', onPress: () => openLegal('terms-and-conditions') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    try {
      await signUp({ email, password, displayName, username });
      router.replace('/(auth)/style-quiz');
    } catch (error: any) {
      const data = error?.response?.data;
      const apiErrors = data?.errors ?? data?.details;
      if (apiErrors && Array.isArray(apiErrors) && apiErrors.length > 0) {
        const msg = apiErrors.map((e: any) => `${e.message}`).join('\n');
        Alert.alert('Validation Error', msg);
      } else if (data?.message) {
        Alert.alert('Registration Failed', data.message);
      } else {
        Alert.alert('Registration Failed', 'Could not create account. Please try again.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    if (!agreeToTerms) {
      Alert.alert(
        'Terms & Conditions Required',
        'Please review and agree to KaPhor\'s Terms & Conditions and Privacy Policy before signing up with Google.',
        [
          { text: 'Review Terms', onPress: () => openLegal('terms-and-conditions') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    const ok = await loginWithGoogle();
    if (ok) router.replace('/(auth)/style-quiz');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView 
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 24) + 40 }
        ]} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        {/* Top Navigation Row */}
        <View style={styles.topBar}>
          <TouchableOpacity 
            accessibilityRole="button" 
            accessibilityLabel="Go back" 
            style={styles.backBtn} 
            onPress={() => safeBack('/(auth)/welcome')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.ink} />
          </TouchableOpacity>

          <View style={styles.brandRow}>
            <KaphorMark size={28} />
            <Text style={styles.brandName}>KAPHOR</Text>
          </View>

          <View style={styles.topSpacer} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Join KaPhor</Text>
          <Squiggle width={90} />
          <Text style={styles.subtitle}>begin your circular fashion journey</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>DISPLAY NAME</Text>
            <TextInput 
              accessibilityLabel="Display name" 
              placeholder="e.g. Insiyah" 
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>USERNAME</Text>
            <TextInput 
              accessibilityLabel="Username" 
              placeholder="yourhandle" 
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput 
              accessibilityLabel="Email" 
              placeholder="name@example.com" 
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <TextInput 
              accessibilityLabel="Password" 
              placeholder="••••••••••••" 
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {strength && (
              <Text style={[styles.strengthText, { color: strength.color }]}>
                PASSWORD STRENGTH: {strength.label}
              </Text>
            )}
          </View>

          {/* Terms & Privacy Consent Checkbox */}
          <View style={styles.termsConsentCard}>
            <TouchableOpacity 
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} 
              accessibilityRole="button" 
              accessibilityLabel="Agree to terms"
              style={styles.checkboxTouch}
              onPress={() => setAgreeToTerms(!agreeToTerms)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkboxBox, agreeToTerms && styles.checkboxBoxActive]}>
                {agreeToTerms && <Ionicons name="checkmark" size={13} color={colors.white} />}
              </View>
            </TouchableOpacity>
            <View style={styles.termsTextWrap}>
              <Text style={styles.termsText}>
                I confirm I am 18+ and agree to KaPhor's{' '}
                <Text style={styles.termsLink} onPress={() => openLegal('terms-and-conditions')}>
                  Terms of Use
                </Text>
                {', '}
                <Text style={styles.termsLink} onPress={() => openLegal('privacy-policy')}>
                  Privacy Policy
                </Text>
                {' & '}
                <Text style={styles.termsLink} onPress={() => openLegal('community-policy')}>
                  Community Standards
                </Text>
                .
              </Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Create account"
          >
            {isLoading ? (
              <Spinner color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity 
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={isLoading || isGoogleLoading}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            {isGoogleLoading ? (
              <Spinner color={colors.ink} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.ink} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
          
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Reusable Legal Modal */}
      <LegalModal
        visible={legalModalVisible}
        onClose={() => setLegalModalVisible(false)}
        initialDocId={legalDocId}
        onAccept={() => setAgreeToTerms(true)}
        showAcceptButton={!agreeToTerms}
        acceptButtonText="Accept & continue"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  inner: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: typography.headings,
    fontSize: 32,
    lineHeight: 38,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: typography.tagline,
    fontSize: 20,
    color: colors.rose,
    marginTop: 6,
    textAlign: 'center',
    includeFontPadding: false,
  },
  form: {
    gap: 14,
  },
  inputContainer: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: typography.condensed,
    fontSize: 13,
    letterSpacing: 1.5,
    color: colors.inkSoft,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 15,
    paddingHorizontal: 16,
    backgroundColor: colors.paperLight,
  },
  strengthText: {
    fontFamily: typography.condensed,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 2,
  },
  termsConsentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.paperLight,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 12,
    marginTop: 2,
  },
  checkboxTouch: {
    paddingTop: 2,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    backgroundColor: colors.rose,
    borderColor: colors.rose,
  },
  termsTextWrap: {
    flex: 1,
  },
  termsText: {
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecond,
  },
  termsLink: {
    fontFamily: typography.bodyBold,
    color: colors.rose,
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: colors.rose,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: colors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: colors.white,
    fontFamily: typography.bodyBold,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    color: colors.textMuted,
    paddingHorizontal: 12,
    fontFamily: typography.handwritten,
    fontSize: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    height: 54,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  googleButtonText: {
    color: colors.ink,
    fontFamily: typography.bodyBold,
    fontSize: 15,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textSecond,
  },
  footerLink: {
    fontFamily: typography.bodyBold,
    fontSize: 14,
    color: colors.rose,
    textDecorationLine: 'underline',
  },
});
