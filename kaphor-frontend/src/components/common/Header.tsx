import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  unreadCount?: number;
  showLogo?: boolean;
  rightElement?: React.ReactNode;
}

export function Header({ title, showBack, onBack, unreadCount = 0, showLogo = false, rightElement }: HeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>


      <View style={styles.left}>
        {showBack ? (
          <Pressable onPress={() => { if (onBack) onBack(); else router.back(); }} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/shop/sell')} style={styles.iconBtn}>
            <Ionicons name="add-outline" size={28} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>

      {showLogo ? (
        <Text style={styles.logo}>KAPHOR</Text>
      ) : (
        <Text style={styles.title}>{title?.toUpperCase()}</Text>
      )}

      <View style={styles.right}>
        {rightElement ? rightElement : (
          <Pressable onPress={() => router.push('/shop/orders')} style={styles.iconBtn}>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  left: { width: 80 },
  right: { width: 80, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },

  iconBtn: { padding: 4, position: 'relative' },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.headings,
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
  },
  logo: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.headings,
    fontSize: 22,
    letterSpacing: 4,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.crimson,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  badgeText: {
    color: 'white',
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: 'bold',
  },
});
