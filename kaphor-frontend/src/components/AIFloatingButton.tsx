import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Keyboard, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SolarIcon } from './common/SolarIcon';
import { useRouter } from 'expo-router';
import { colors, typography } from '../theme';
import { EditorialIcon, EditorialIconName } from './editorial/EditorialIcon';

const INK_GRADIENT = [colors.ink, colors.ink] as const;
const FAB_GRADIENT = [colors.rose, colors.rose] as const;

interface MenuItem {
  label: string;
  sublabel: string;
  icon: EditorialIconName;
  route: string;
  accent: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: 'AI STYLIST',
    sublabel: 'Style ideas and care tips',
    icon: 'sparkle',
    route: '/(tabs)/shop/ai-chat',
    accent: colors.goldDark,
  },
  {
    label: 'CONDITION CHECK',
    sublabel: 'Check wear and damage',
    icon: 'search',
    route: '/(tabs)/circular/condition-check',
    accent: colors.crimson,
  },
  {
    label: 'UPCYCLE',
    sublabel: 'Transform pieces yourself',
    icon: 'scissors',
    route: '/(tabs)/circular/upcycle',
    accent: colors.goldDark,
  },
  {
    label: 'REPAIR & REFRESH',
    sublabel: 'Mend, revive & refresh',
    icon: 'thread',
    route: '/(tabs)/studio/repair-refresh',
    accent: colors.emerald,
  },
  {
    label: 'RECYCLING CENTERS',
    sublabel: 'Certified textile drop-off hubs',
    icon: 'recycle',
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
              colors={INK_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.menuHeadBar}
            />
            <EditorialIcon name="sparkle" size={15} />
            <Text style={styles.menuTitle}>CIRCULAR TOOLS</Text>
          </View>

          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.menuItem}
              onPress={() => navigate(item.route)}
              activeOpacity={0.85}
            >
              <View style={[styles.menuIconWrap, { borderColor: item.accent + '35', backgroundColor: colors.paperLight }]}>
                <EditorialIcon name={item.icon} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemLabel}>{item.label}</Text>
                <Text style={styles.menuItemSub}>{item.sublabel}</Text>
              </View>
              <SolarIcon name="chevron-forward" size={14} color={colors.textMuted} />
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
          colors={FAB_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabBody}
        >
          <EditorialIcon
            name={open ? 'close' : 'sparkle'}
            size={open ? 26 : 30}
            tintColor={colors.white}
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
    backgroundColor: colors.overlay,
  },
  fabShell: {
    position: 'absolute',
    bottom: 78,
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.rose,
    padding: 3,
    shadowColor: colors.crimsonDark,
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
    bottom: 150,
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
    backgroundColor: colors.paperLight,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 15,
    color: colors.goldDark,
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
    width: 36,
    height: 36,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  menuItemLabel: {
    fontFamily: typography.bodyBold,
    fontSize: 14,
    color: colors.ink,
    letterSpacing: 0.4,
  },
  menuItemSub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 0,
  },
});