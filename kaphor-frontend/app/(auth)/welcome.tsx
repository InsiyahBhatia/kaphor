import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../../src/theme';
import { LegalModal } from '../../src/components/legal/LegalModal';

export default function WelcomeScreen() {
  const router = useRouter();
  const [legalVisible, setLegalVisible] = useState(false);
  const [legalDocId, setLegalDocId] = useState('terms-and-conditions');

  const openLegal = (docId: string) => {
    setLegalDocId(docId);
    setLegalVisible(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=2080&auto=format&fit=crop' }} 
        style={styles.background}
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.logo}>KAPHOR</Text>
            <Text style={styles.subtitle}>CIRCULAR LUXURY HERITAGE</Text>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.button}
              onPress={() => router.push('/(auth)/register' as any)}
            >
              <Text style={styles.buttonText}>GET STARTED</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => router.push('/(auth)/login' as any)}
            >
              <Text style={styles.secondaryButtonText}>I ALREADY HAVE AN ACCOUNT</Text>
            </TouchableOpacity>

            <View style={styles.legalNotice}>
              <Text style={styles.legalNoticeText}>
                By continuing, you agree to KaPhor's{' '}
                <Text style={styles.legalNoticeLink} onPress={() => openLegal('terms-and-conditions')}>
                  Terms of Service
                </Text>
                {' & '}
                <Text style={styles.legalNoticeLink} onPress={() => openLegal('privacy-policy')}>
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>
          </View>
        </View>
      </ImageBackground>

      <LegalModal
        visible={legalVisible}
        onClose={() => setLegalVisible(false)}
        initialDocId={legalDocId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 100,
    alignItems: 'center',
  },
  logo: {
    fontSize: 57,
    fontFamily: 'BebasNeue_400Regular',
    color: colors.textPrimary,
    letterSpacing: 10,
  },
  subtitle: {
    fontSize: 15.5,
    color: colors.crimson,
    letterSpacing: 4,
    marginTop: 12,
    fontWeight: '800',
  },
  footer: {
    marginBottom: 60,
  },
  button: {
    backgroundColor: colors.crimson,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: colors.white,
    fontSize: 19.5,
    fontWeight: '800',
    letterSpacing: 2,
  },
  secondaryButton: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(155, 27, 48, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  secondaryButtonText: {
    color: colors.crimson,
    fontSize: 18,
    letterSpacing: 1,
    fontWeight: '700',
  },
  legalNotice: {
    marginTop: 18,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  legalNoticeText: {
    fontSize: 14.5,
    color: 'rgba(0, 0, 0, 0.65)',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '500',
  },
  legalNoticeLink: {
    color: colors.crimson,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
