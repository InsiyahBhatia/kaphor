import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Platform, Keyboard } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme';

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

  // Enforce 5 tabs with Circular in the center
  const mainTabs = ['index', 'shop/index', 'circular/index', 'cart', 'profile'];

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {state.routes.filter(route => mainTabs.includes(route.name)).map((route) => {
        const isFocused = state.index === state.routes.findIndex(r => r.key === route.key);

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const getTabConfig = (name: string) => {
          switch (name) {
            case 'index': return { label: 'HOME', icon: 'home-sharp' as any };
            case 'shop/index': return { label: 'SHOP', icon: 'bag-handle-sharp' as any };
            case 'circular/index': return { label: 'CIRCULAR', icon: 'infinite-sharp' as any };
            case 'swap/index': return { label: 'SWAP', icon: 'swap-horizontal-sharp' as any };
            case 'cart': return { label: 'CART', icon: 'cart-sharp' as any };
            case 'profile': return { label: 'PROFILE', icon: 'person-sharp' as any };
            default: return { label: name.toUpperCase(), icon: 'ellipse-sharp' as any };
          }
        };



        const config = getTabConfig(route.name);
        const color = isFocused ? colors.crimson : colors.textMuted;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
          >
            <Ionicons name={config.icon} size={20} color={color} style={styles.tabIcon} />
            <Text style={[styles.tabLabel, { color }]}>{config.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.charcoal,
    paddingTop: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
    elevation: 0,
    shadowOpacity: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabIcon: {
    marginBottom: 1,
  },
  tabLabel: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
