import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../../theme';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  hideNav?: boolean;
}

const ADMIN_NAV = [
  { label: 'OVERVIEW', route: '/(admin)' },
  { label: 'ORDERS', route: '/(admin)/orders' },
  { label: 'LISTINGS', route: '/(admin)/listings' },
  { label: 'USERS', route: '/(admin)/users' },
  { label: 'QUEUES', route: '/(admin)/queues' },
  { label: 'AUDIT', route: '/(admin)/audit' },
];

export default function AdminTopBar({
  title,
  subtitle,
  onBack,
  onRefresh,
  refreshing,
  hideNav = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  const isCurrent = (targetRoute: string) => {
    if (targetRoute === '/(admin)') {
      return pathname === '/(admin)' || pathname === '/(admin)/index' || pathname === '/admin';
    }
    return pathname.includes(targetRoute.replace('/(admin)/', ''));
  };

  return (
    <View style={[styles.wrapper, { paddingTop: Math.max(insets.top + 8, 44) }]}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.ink} />
        </TouchableOpacity>

        <View style={styles.titleCol}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle.toUpperCase()}
            </Text>
          ) : null}
        </View>

        {onRefresh && (
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            disabled={refreshing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={refreshing ? 'hourglass-outline' : 'refresh'}
              size={18}
              color={colors.white}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Admin Module Navigation Strip */}
      {!hideNav && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.navStrip}
        >
          {ADMIN_NAV.map((nav) => {
            const active = isCurrent(nav.route);
            return (
              <TouchableOpacity
                key={nav.route}
                style={[styles.navChip, active && styles.navChipActive]}
                onPress={() => {
                  if (!active) router.push(nav.route as any);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.navChipText, active && styles.navChipTextActive]}>
                  {nav.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.cream,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  topRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: 1.5,
    lineHeight: 24,
  },
  subtitle: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    letterSpacing: 1.8,
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 2,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  navChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
  navChipActive: {
    backgroundColor: colors.ink,
  },
  navChipText: {
    fontFamily: typography.monoBold,
    fontSize: 9,
    color: colors.ink,
    letterSpacing: 0.8,
  },
  navChipTextActive: {
    color: colors.cream,
  },
});