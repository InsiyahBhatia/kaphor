import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SolarIcon } from '../../src/components/common/SolarIcon';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/services/api';
import { colors, typography } from '../../src/theme';
import { Loader } from '../../src/components/common/Loader';
import { getErrorMessage } from '../../src/utils/errors';
import { KaphorMark } from '../../src/components/common/KaphorLogo';
import { Squiggle } from '../../src/components/common/HandText';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
          getErrorMessage(err, 'Verification link is invalid or expired. Please request a new one.')
        );
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 24) + 16 }]}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <KaphorMark size={32} />
          <Text style={styles.brandName}>KAPHOR</Text>
        </View>
      </View>

      <View style={styles.center}>
        {loading ? (
          <>
            <Loader compact variant="checkout" message="" />
            <Text style={styles.title}>Verifying email</Text>
            <Squiggle width={90} />
            <Text style={styles.subtitle}>Securing your KaPhor designer circular account...</Text>
          </>
        ) : success ? (
          <>
            <View style={[styles.iconCircle, { backgroundColor: colors.emeraldLight, borderColor: colors.forest }]}>
              <SolarIcon name="checkmark-done-circle-outline" size={44} color={colors.forest} />
            </View>
            <Text style={styles.title}>Email verified</Text>
            <Squiggle width={90} />
            <Text style={styles.subtitle}>
              Your email has been successfully confirmed. You're ready to explore sustainable circular fashion.
            </Text>
            <TouchableOpacity
              style={styles.mainBtn}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Continue to sign in"
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.mainBtnText}>Continue to Sign In</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.iconCircle, { backgroundColor: colors.crimsonLight, borderColor: colors.rose }]}>
              <SolarIcon name="alert-circle-outline" size={44} color={colors.rose} />
            </View>
            <Text style={styles.title}>Verification failed</Text>
            <Squiggle width={90} />
            <Text style={styles.subtitle}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.mainBtn}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.mainBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.paper, 
    paddingHorizontal: 24,
  },
  topBar: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    fontFamily: typography.condensed,
    fontSize: 24,
    letterSpacing: 5,
    color: colors.ink,
    includeFontPadding: false,
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
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
    paddingHorizontal: 20,
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
    marginTop: 16,
  },
  mainBtnText: {
    color: colors.white,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
