import { Tabs } from 'expo-router';
import { TabBar } from '../../src/components/TabBar';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs 
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop/index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color }) => <Ionicons name="bag-handle-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="circular/index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="social/index"
        options={{
          title: 'Social',
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen name="rental/index" options={{ href: null }} />
      <Tabs.Screen name="rental/[id]" options={{ href: null }} />
      <Tabs.Screen name="rental/reserve" options={{ href: null }} />
      <Tabs.Screen name="swap/index" options={{ href: null }} />
      <Tabs.Screen name="swap/[id]" options={{ href: null }} />
      <Tabs.Screen name="swap/[wantedId]" options={{ href: null }} />
      <Tabs.Screen name="impact/index" options={{ href: null }} />
      <Tabs.Screen name="impact/report" options={{ href: null }} />
      <Tabs.Screen name="studio/index" options={{ href: null }} />
      <Tabs.Screen name="studio/bespoke" options={{ href: null }} />
      <Tabs.Screen name="studio/chat" options={{ href: null }} />
      <Tabs.Screen name="studio/upcycle" options={{ href: null }} />
      <Tabs.Screen name="social/create" options={{ href: null }} />
      <Tabs.Screen name="shop/[id]" options={{ href: null }} />
      <Tabs.Screen name="shop/sell" options={{ href: null }} />
      <Tabs.Screen name="shop/order-confirmed" options={{ href: null }} />
      <Tabs.Screen name="shop/checkout/[orderId]" options={{ href: null }} />
      <Tabs.Screen name="circular/condition-check" options={{ href: null }} />
      <Tabs.Screen name="notifications/index" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  circularButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#9B1B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
});
