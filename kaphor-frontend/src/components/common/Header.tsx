import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';

import { safeBack, useBackHandler } from '../../utils/navigation';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  fallbackPath?: string;
  unreadCount?: number;
  showLogo?: boolean;
  rightElement?: React.ReactNode;
}

export function Header({
  title,
  showBack,
  onBack,
  fallbackPath,
  unreadCount = 0,
  showLogo = false,
  rightElement,
}: HeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // If this header has a back button, wire up hardware back press
  useBackHandler(
    fallbackPath,
    showBack ? (onBack ? () => { onBack(); return true; } : null) : () => false
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      safeBack(fallbackPath);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top + 8, 24), paddingBottom: 14 }]}>
      <View style={styles.left}>
        {showBack ? (
          <Pressable 
            onPress={handleBack} 
            style={styles.iconBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/shop/sell')} style={styles.iconBtn}>
            <Ionicons name="add-outline" size={28} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>

      {showLogo ? (
        <Pressable onPress={() => router.replace('/(tabs)' as any)} hitSlop={8}>
          <Text style={styles.logo}>KAPHOR</Text>
        </Pressable>
      ) : (
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>{title?.toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.right}>
        {rightElement ? rightElement : (
          <Pressable onPress={() => router.push('/messages')} style={styles.iconBtn}>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
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
