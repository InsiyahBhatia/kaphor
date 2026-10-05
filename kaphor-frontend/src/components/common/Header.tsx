import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SolarIcon } from './SolarIcon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';
import { useNotificationStore } from '../../store/notificationStore';
import { safeBack, useBackHandler } from '../../utils/navigation';
import { EditorialIcon } from '../editorial/IllustrationLayer';
import { KaphorLogo } from './KaphorLogo';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  fallbackPath?: string;
  unreadCount?: number;
  showLogo?: boolean;
  rightElement?: React.ReactNode;
}

export function Header({
  title,
  subtitle,
  showBack,
  onBack,
  fallbackPath,
  unreadCount: propUnreadCount,
  showLogo = false,
  rightElement,
}: HeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notifUnread = useNotificationStore((s) => s.unreadCount);
  const unreadMessageCount = useNotificationStore((s) => s.unreadMessageCount);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const fetchUnreadMessageCount = useNotificationStore((s) => s.fetchUnreadMessageCount);

  useEffect(() => {
    fetchUnreadCount();
    fetchUnreadMessageCount();
  }, [fetchUnreadCount, fetchUnreadMessageCount]);

  const activeMessageUnread = propUnreadCount !== undefined ? propUnreadCount : unreadMessageCount;

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
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" 
            onPress={handleBack} 
            style={styles.iconBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <SolarIcon name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Add" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} 
            onPress={() => router.push({ 
              pathname: '/shop/sell', 
              params: { 
                fresh: Date.now().toString(),
                prefillImage: '',
                prefillCategory: '',
                prefillTitle: '',
                prefillDescription: '',
                prefillBrand: '',
                prefillCondition: '',
                prefillFabric: '',
                prefillColor: '',
                prefillStyle: '',
                prefillListingType: '',
              } 
            } as any)} 
            style={styles.iconBtn}
          >
            <SolarIcon name="add-outline" size={28} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>

      {showLogo ? (
        <Pressable 
          onPress={() => router.replace('/(tabs)' as any)} 
          hitSlop={8}
          style={styles.logoContainer}
          accessibilityRole="button"
          accessibilityLabel="Go to home"
        >
          <KaphorLogo size={28} />
        </Pressable>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.title}>{title}</Text>
          {!!subtitle && (
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.subtitle}>{subtitle}</Text>
          )}
        </View>
      )}

      <View style={styles.right}>
        {rightElement ? rightElement : (
          <>
            <Pressable
              onPress={() => router.push('/(tabs)/notifications' as any)}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <EditorialIcon name="bell" size={23} />
              {notifUnread > 0 && (
                <View style={[styles.badge, styles.notifBadge]}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.badgeText}>{notifUnread > 9 ? '9+' : notifUnread}</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.push('/messages')}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <EditorialIcon name="mail" size={28} />
              {activeMessageUnread > 0 && (
                <View style={styles.badge}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.badgeText}>{activeMessageUnread > 9 ? '9+' : activeMessageUnread}</Text>
                </View>
              )}
            </Pressable>
          </>
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
  left: { minWidth: 80, flexDirection: 'row', alignItems: 'center' },
  right: { minWidth: 80, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },

  iconBtn: { padding: 4, position: 'relative' },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.headings,
    fontSize: 22,
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 22,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.handwritten,
    fontSize: 13,
    letterSpacing: 0.2,
    marginTop: 0,
    textAlign: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.crimson,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  notifBadge: {
    backgroundColor: colors.crimson,
  },
  badgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: 'bold',
  },
});
