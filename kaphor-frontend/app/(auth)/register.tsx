import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';
import { useGoogleAuth } from '../../src/hooks/useGoogleAuth';
import { safeBack, useBackHandler } from '../../src/utils/navigation';
import { LegalModal } from '../../src/components/legal/LegalModal';

export default function RegisterScreen() {
  const router = useRouter();
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
    if (pass.length < 10) return { label: 'TOO SHORT (MIN 10)', color: '#9B1B30' };
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNum = /[0-9]/.test(pass);
    const hasSpecial = /[@$!%*?&]/.test(pass);
    if (hasUpper && hasLower && hasNum && hasSpecial) return { label: 'STRONG', color: '#4CAF50' };
    const missing: string[] = [];
    if (!hasUpper) missing.push('uppercase');
    if (!hasLower) missing.push('lowercase');
    if (!hasNum) missing.push('number');
    if (!hasSpecial) missing.push('special (@$!%*?&)');
    return { label: `NEEDS: ${missing.join(', ')}`, color: '#C9A84C' };
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
      // Backend returns field errors as `errors` (legacy) or `details` (zod validate())
      const apiErrors = data?.errors ?? data?.details;
      if (apiErrors && Array.isArray(apiErrors) && apiErrors.length > 0) {
        const msg = apiErrors.map((e: any) => `${e.field}: ${e.message}`).join('\n');
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
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.inner} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => safeBack('/(auth)/welcome')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.title}>Join Kaphor</Text>
          <Text style={styles.subtitle}>Begin your circular luxury journey</Text>
        </View>

      <View style={styles.form}>
        <TextInput 
          placeholder="DISLAY NAME (E.G. INSIYAH)" 
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextInput 
          placeholder="USERNAME" 
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput 
          placeholder="EMAIL" 
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <View>
          <TextInput 
            placeholder="PASSWORD" 
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
            style={styles.checkboxTouch}
            onPress={() => setAgreeToTerms(!agreeToTerms)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkboxBox, agreeToTerms && styles.checkboxBoxActive]}>
              {agreeToTerms && <Ionicons name="checkmark" size={14} color={colors.white} />}
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
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity 
          style={styles.googleButton}
          onPress={handleGoogleLogin}
          disabled={isLoading || isGoogleLoading}
        >
          {isGoogleLoading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
              <Text style={styles.googleButtonText}>CONTINUE WITH GOOGLE</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerLink}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.footerText}>ALREADY HAVE AN ACCOUNT? LOGIN</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

      {/* Reusable Legal Modal */}
      <LegalModal
        visible={legalModalVisible}
        onClose={() => setLegalModalVisible(false)}
        initialDocId={legalDocId}
        onAccept={() => setAgreeToTerms(true)}
        showAcceptButton={!agreeToTerms}
        acceptButtonText="ACCEPT & CONTINUE"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inner: {
    padding: 24,
    paddingBottom: 180,
  },
  backBtn: {
    marginTop: 20,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  header: {
    marginTop: 10,
    marginBottom: 30,
  },
  title: {
    fontSize: 40,
    fontFamily: 'BebasNeue_400Regular',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecond,
    marginTop: 8,
    lineHeight: 22,
  },
  form: {
    gap: 20,
    paddingBottom: 40,
  },
  input: {
    height: 60,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.bgCard,
  },
  termsConsentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.bgCard,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    marginTop: 4,
  },
  checkboxTouch: {
    paddingTop: 2,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    backgroundColor: colors.crimson,
    borderColor: colors.crimson,
  },
  termsTextWrap: {
    flex: 1,
  },
  termsText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecond,
  },
  termsLink: {
    color: colors.crimson,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: colors.crimson,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  footerLink: {
    marginTop: 16,
    alignItems: 'center',
    padding: 8,
  },
  footerText: {
    color: colors.textSecond,
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '700',
  },
  strengthText: {
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 4,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    height: 56,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
