import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { GoogleLogo } from '../../src/components/common/GoogleLogo';
import { SolarIcon } from '../../src/components/common/SolarIcon';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { colors, typography } from '../../src/theme';
import { useGoogleAuth } from '../../src/hooks/useGoogleAuth';
import { safeBack, useBackHandler } from '../../src/utils/navigation';
import { Spinner } from '../../src/components/common/Loader';
import { KaphorMark } from '../../src/components/common/KaphorLogo';
import { Squiggle } from '../../src/components/common/HandText';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useBackHandler('/(auth)/welcome');
  const { signIn, isLoading } = useAuth();
  const { loginWithGoogle, isGoogleLoading } = useGoogleAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Login Failed', 'Invalid credentials');
    }
  };

  const handleGoogleLogin = async () => {
    const ok = await loginWithGoogle();
    if (ok) router.replace('/(tabs)');
  };

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
        {/* Top Navigation Row */}
        <View style={styles.topBar}>
          <TouchableOpacity 
            accessibilityRole="button" 
            accessibilityLabel="Go back" 
            style={styles.backBtn} 
            onPress={() => safeBack('/(auth)/welcome')}
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

        {/* Editorial Muse Woman Illustration & Greeting */}
        <View style={styles.museHeroWrap}>
          <ExpoImage
            source={require('../../assets/editorial/fashion/muse_hero.png')}
            style={styles.museImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            accessibilityLabel="A stylish woman in a flowing pink dress with a big bow"
          />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Squiggle width={90} />
          <Text style={styles.subtitle}>your circular wardrobe awaits</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
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
            <View style={styles.passwordLabelRow}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TouchableOpacity 
                onPress={() => router.push('/(auth)/forgot-password')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
            <TextInput 
              accessibilityLabel="Password" 
              placeholder="••••••••••••" 
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            {isLoading ? (
              <Spinner color={colors.white} />
            ) : (
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.buttonText}>Sign In</Text>
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
                <GoogleLogo size={18} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to KaPhor? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register' as any)}>
              <Text style={styles.footerLink}>Create an account</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 8,
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
  museHeroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 190,
    marginVertical: 8,
  },
  museImage: {
    width: '100%',
    height: 190,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
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
    gap: 16,
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
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontFamily: typography.handSemi,
    fontSize: 16,
    color: colors.rose,
    textDecorationLine: 'underline',
    includeFontPadding: false,
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
    marginVertical: 14,
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
    marginTop: 12,
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
