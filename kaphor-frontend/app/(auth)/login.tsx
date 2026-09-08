import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';
import { useGoogleAuth } from '../../src/hooks/useGoogleAuth';
import { safeBack } from '../../src/utils/navigation';

export default function LoginScreen() {
  const router = useRouter();
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
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.backBtn} 
        onPress={() => safeBack('/(auth)/welcome')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Enter your credentials to continue</Text>
      </View>

      <View style={styles.form}>
        <TextInput 
          placeholder="EMAIL" 
          placeholderTextColor="#6B5C52"
          style={styles.input}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput 
          placeholder="PASSWORD" 
          placeholderTextColor="#6B5C52"
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: 4 }} onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={{ color: colors.gold, fontSize: 12, letterSpacing: 1, fontWeight: '700' }}>FORGOT PASSWORD?</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>LOGIN</Text>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
  },
  backBtn: {
    marginTop: 36,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  header: {
    marginTop: 20,
    marginBottom: 40,
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
