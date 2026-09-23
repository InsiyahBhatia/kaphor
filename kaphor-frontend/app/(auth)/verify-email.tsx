import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { colors } from '../../src/theme';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorMessage('Verification token missing. Please use the link sent to your email.');
      return;
    }

    const verify = async () => {
      try {
        await api.get(`/auth/verify-email/${token}`);
        setSuccess(true);
      } catch (err: any) {
        setErrorMessage(
          err?.response?.data?.message ||
            'Verification link is invalid or expired. Please request a new one.'
        );
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        {loading ? (
          <>
            <ActivityIndicator size="large" color={colors.crimson} />
            <Text style={styles.title}>VERIFYING EMAIL</Text>
            <Text style={styles.subtitle}>Securing your KaPhor luxury circular account...</Text>
          </>
        ) : success ? (
          <>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(56, 142, 60, 0.1)' }]}>
              <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.forest} />
            </View>
            <Text style={styles.title}>EMAIL VERIFIED</Text>
            <Text style={styles.subtitle}>
              Your email has been successfully confirmed. You're ready to explore sustainable luxury.
            </Text>
            <TouchableOpacity
              style={styles.mainBtn}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.85}
            >
              <Text style={styles.mainBtnText}>CONTINUE TO LOGIN</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(211, 47, 47, 0.1)' }]}>
              <Ionicons name="alert-circle-outline" size={56} color={colors.crimson} />
            </View>
            <Text style={styles.title}>VERIFICATION FAILED</Text>
            <Text style={styles.subtitle}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.mainBtn}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.85}
            >
              <Text style={styles.mainBtnText}>BACK TO LOGIN</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 37,
    fontFamily: 'BebasNeue_400Regular',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 18.5,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    fontWeight: '500',
  },
  mainBtn: {
    width: '100%',
    height: 56,
    backgroundColor: colors.crimson,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 16,
  },
  mainBtnText: {
    color: colors.white,
    fontSize: 18.5,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
