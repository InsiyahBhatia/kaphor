import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');

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

    try {
      await signUp({ email, password, displayName, username });
      router.replace('/(auth)/style-quiz');
    } catch (error: any) {
      const apiErrors = error?.response?.data?.errors;
      if (apiErrors && Array.isArray(apiErrors)) {
        const msg = apiErrors.map((e: any) => `${e.field}: ${e.message}`).join('\n');
        Alert.alert('Validation Error', msg);
      } else {
        Alert.alert('Registration Failed', 'Could not create account. Please try again.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    // Placeholder logic since actual OAuth requires valid client IDs and certificates
    Alert.alert('Google Sign-In', 'Google Auth requires valid Firebase configuration. This is a placeholder that normally would retrieve an ID token and call signInWithGoogle(idToken).');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Join Kaphor</Text>
        <Text style={styles.subtitle}>Begin your circular luxury journey</Text>
      </View>

      <View style={styles.form}>
        <TextInput 
          placeholder="DISLAY NAME (E.G. INSIYAH)" 
          placeholderTextColor="#6B5C52"
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextInput 
          placeholder="USERNAME" 
          placeholderTextColor="#6B5C52"
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput 
          placeholder="EMAIL" 
          placeholderTextColor="#6B5C52"
          style={styles.input}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <View>
          <TextInput 
            placeholder="PASSWORD" 
            placeholderTextColor="#6B5C52"
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

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
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
          disabled={isLoading}
        >
          <Ionicons name="logo-google" size={20} color="white" />
          <Text style={styles.googleButtonText}>CONTINUE WITH GOOGLE</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerLink}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.footerText}>ALREADY HAVE AN ACCOUNT? LOGIN</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0C10',
    padding: 24,
  },
  header: {
    marginTop: 60,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontFamily: 'CormorantGaramond_700Bold',
    color: '#C9A84C',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B5C52',
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  input: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#6B5C52',
    color: 'white',
    fontSize: 16,
    paddingHorizontal: 8,
  },
  button: {
    backgroundColor: '#9B1B30',
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
  },
  footerLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    color: '#D4AF37',
    fontSize: 12,
    letterSpacing: 1,
  },
  strengthText: {
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 4,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#3A2C30',
  },
  dividerText: {
    color: '#6B5C52',
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: '700',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    height: 56,
    borderRadius: 8,
    gap: 12,
  },
  googleButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    paddingTop: 2, // optical alignment
  },
});
