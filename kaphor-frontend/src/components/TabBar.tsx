import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Platform, Keyboard } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialIcon } from './editorial/EditorialIcon';
import { EditorialIconName } from './editorial/EditorialAssets';
import { colors, typography } from '../theme';
import { hapticFeedback } from '../utils/haptics';

export const TabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
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

  const currentRoute = state.routes[state.index];
  const currentOptions = descriptors[currentRoute?.key]?.options;

  // Hide TabBar when keyboard is visible or when tabBarStyle has display: 'none'
  if (isKeyboardVisible || (currentOptions?.tabBarStyle as any)?.display === 'none') {
    return null;
  }

  const mainTabs = ['index', 'shop/index', 'swap/index', 'profile', 'rental/index'];

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.filter(route => mainTabs.includes(route.name)).map((route) => {
        const isFocused = state.index === state.routes.findIndex(r => r.key === route.key);

        const onPress = () => {
          hapticFeedback.light();
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const getTabConfig = (name: string): { label: string; icon: EditorialIconName } => {
          switch (name) {
            case 'index': return { label: 'Home', icon: 'home' };
            case 'shop/index': return { label: 'Shop', icon: 'bag' };
            case 'swap/index': return { label: 'Swap', icon: 'swap' };
            case 'profile': return { label: 'Profile', icon: 'profile' };
            case 'rental/index': return { label: 'Rent', icon: 'rental' };
            default: return { label: name.toUpperCase(), icon: 'sparkle' };
          }
        };

        const config = getTabConfig(route.name);
        const textColor = isFocused ? colors.rose : colors.textMuted;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.75}
          >
            <View style={{ opacity: isFocused ? 1 : 0.65, transform: [{ scale: isFocused ? 1.06 : 0.95 }] }}>
              <EditorialIcon
                name={config.icon}
                size={32}
                style={styles.tabIcon}
              />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabLabel, { color: textColor }]}>
              {config.label}
            </Text>
            {isFocused && <View style={styles.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderTopWidth: 1.5,
    borderTopColor: colors.ink,
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
    elevation: 0,
    shadowOpacity: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 2,
    position: 'relative',
  },
  tabIcon: {
    marginBottom: 2,
  },
  tabLabel: {
    fontFamily: typography.bodyMedium,
    includeFontPadding: false,
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.rose,
    marginTop: 3,
  },
});
