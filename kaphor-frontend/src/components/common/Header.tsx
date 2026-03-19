import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, typography, spacing } from '../../theme';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  unreadCount?: number;
  showLogo?: boolean;
}

export function Header({ title, showBack, unreadCount = 0, showLogo = false }: HeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {showBack ? (
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {showLogo ? (
        <Text style={styles.logo}>KAPHOR</Text>
      ) : (
        <Text style={styles.title}>{title?.toUpperCase()}</Text>
      )}

      <View style={styles.right}>
        <Pressable onPress={() => router.push('/notifications')} style={styles.iconBtn}>
          <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
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
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  left: { width: 44 },
  right: { width: 44, alignItems: 'flex-end' },
  iconBtn: { padding: 4, position: 'relative' },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.headings,
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
  },
  logo: {
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
