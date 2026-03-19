import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>
      {state.routes.filter(route => {
        const mainTabs = ['index', 'shop/index', 'social/index', 'profile'];
        return mainTabs.includes(route.name);
      }).map((route, index) => {
        const { options } = descriptors[route.key];
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


        const getLabel = (name: string) => {
          switch (name) {
            case 'index': return 'HOME';
            case 'shop/index': return 'SHOP';
            case 'social/index': return 'SOCIAL';
            case 'profile': return 'PROFILE';
            default: return name.toUpperCase();
          }
        };

        const iconName = options.tabBarIcon ? (options.tabBarIcon as any)({ focused: isFocused, color: isFocused ? '#C9A84C' : '#6B5C52' }).props.name : 'help-circle-outline';

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
          >
            <Ionicons name={iconName} size={24} color={isFocused ? '#C9A84C' : '#6B5C52'} />
            <Text style={[styles.tabLabel, { color: isFocused ? '#C9A84C' : '#6B5C52' }]}>
              {getLabel(route.name)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1A0C10',
    borderTopWidth: 1,
    borderTopColor: 'rgba(201, 168, 76, 0.1)',
    height: Platform.OS === 'ios' ? 88 : 70,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 9,
    marginTop: 4,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
