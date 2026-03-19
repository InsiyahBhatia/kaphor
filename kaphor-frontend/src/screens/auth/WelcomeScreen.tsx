import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, radius } from '../../theme';
import { KaphorImage } from '../../components/KaphorImage';
import { useAuthStore } from '../../store/authStore';

export function WelcomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  return (
    <Animated.View style={styles.container} entering={FadeIn.duration(700)}>
      <KaphorImage
        uri="https://res.cloudinary.com/demo/image/upload/v1720000000/kaphor_editorial_hero.jpg"
        style={styles.hero}
        contentFit="cover"
      />
      <View style={styles.overlay} />
      <View style={styles.content}>
        <Text style={styles.logotype}>KAPHOR</Text>
        <Text style={styles.tagline}>Redefining the Garment Lifecycle</Text>
        {user && <Text style={styles.welcomeBack}>Welcome back, {user.displayName ?? user.email}</Text>}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)/')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryLabel}>Explore Collection</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/auth/register')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryLabel}>Start Your Cycle</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  hero: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 6, 9, 0.78)',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: 'flex-end',
  },
  logotype: {
    fontFamily: typography.headings,
    fontSize: 42,
    letterSpacing: 6,
    color: colors.textPrimary,
  },
  tagline: {
    fontFamily: typography.body,
    fontSize: 16,
    color: colors.textSecond,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  welcomeBack: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.crimson,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: typography.body,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.textPrimary,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: typography.body,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.gold,
  },
});

export default WelcomeScreen;

