import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, isLoading } = useAuth();
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
    // Placeholder logic since actual OAuth requires valid client IDs and certificates
    Alert.alert('Google Sign-In', 'Google Auth requires valid Firebase configuration. This is a placeholder that normally would retrieve an ID token and call signInWithGoogle(idToken).');
  };

  return (
    <View style={styles.container}>
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
          <Text style={{ color: '#C9A84C', fontSize: 12, letterSpacing: 1 }}>FORGOT PASSWORD?</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
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
          disabled={isLoading}
        >
          <Ionicons name="logo-google" size={20} color="white" />
          <Text style={styles.googleButtonText}>CONTINUE WITH GOOGLE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0C10',
    padding: 24,
  },
  header: {
    marginTop: 80,
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
