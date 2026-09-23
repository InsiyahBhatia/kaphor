import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Keyboard, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, typography } from '../theme';
import { AIStar } from './AIStar';

const EMBER_GRADIENT = ['#E4714A', '#C81E2C'] as const;
const INK_GRADIENT = ['#242424', '#141414'] as const;

interface MenuItem {
  label: string;
  sublabel: string;
  icon: string;
  route: string;
  accent: string;
  star?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: 'AI STYLIST',
    sublabel: 'Style curation & care chat',
    icon: 'sparkles-sharp',
    route: '/(tabs)/shop/ai-chat',
    accent: colors.terracotta,
    star: true,
  },
  {
    label: 'CONDITION CHECK',
    sublabel: 'GLIE wear & tear scan',
    icon: 'scan-sharp',
    route: '/(tabs)/circular/condition-check',
    accent: colors.crimson,
  },
  {
    label: 'UPCYCLE',
    sublabel: 'Transform pieces yourself',
    icon: 'cut-sharp',
    route: '/(tabs)/circular/upcycle',
    accent: colors.goldDark,
  },
  {
    label: 'REPAIR & REFRESH',
    sublabel: 'Mend, revive & refresh',
    icon: 'color-palette-sharp',
    route: '/(tabs)/studio/repair-refresh',
    accent: colors.emerald,
  },
  {
    label: 'RECYCLING CENTERS',
    sublabel: 'Certified textile drop-off hubs',
    icon: 'leaf-sharp',
    route: '/(tabs)/circular/recycling-centers',
    accent: colors.emerald,
  },
];

export const AIFloatingButton: React.FC = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const navigate = (route: string) => {
    setOpen(false);
    router.push(route);
  };

  if (isKeyboardVisible) {
    return null;
  }

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {open && (
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
      )}

      {open && (
        <View style={styles.menu}>
          <View style={styles.menuHead}>
            <LinearGradient
              colors={EMBER_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.menuHeadBar}
            />
            <AIStar size={13} color={colors.terracotta} />
            <Text style={styles.menuTitle}>CIRCULAR TOOLS</Text>
          </View>

          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.menuItem}
              onPress={() => navigate(item.route)}
              activeOpacity={0.85}
            >
              <View style={[styles.menuIconWrap, { borderColor: item.accent, backgroundColor: item.star ? item.accent : colors.bg }]}>
                {item.star ? (
                  <AIStar size={15} color={colors.white} />
                ) : (
                  <Ionicons name={item.icon as any} size={15} color={item.star ? colors.white : item.accent} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemLabel}>{item.label}</Text>
                <Text style={styles.menuItemSub}>{item.sublabel}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.92}
        accessibilityRole="button"
        accessibilityLabel="Open circular tools"
        style={styles.fabShell}
      >
        <LinearGradient
          colors={open ? INK_GRADIENT : EMBER_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabBody}
        >
          <Ionicons
            name="sparkles-sharp"
            size={open ? 24 : 28}
            color={open ? '#F4E7C3' : '#FFFFFF'}
          />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  fabShell: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.ink,
    padding: 3,
    shadowColor: '#5C0B12',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  fabBody: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    bottom: 176,
    right: 16,
    width: 258,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 2,
    shadowColor: colors.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  menuHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDF8F2',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuHeadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  menuTitle: {
    fontFamily: typography.monoBold,
    fontSize: 14.5,
    color: colors.goldDark,
    letterSpacing: 1.2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
    backgroundColor: colors.bg,
  },
  menuItemLabel: {
    fontFamily: typography.headings,
    fontSize: 20.5,
    color: colors.ink,
    letterSpacing: 0.8,
  },
  menuItemSub: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    color: colors.textMuted,
    marginTop: 1,
  },
});