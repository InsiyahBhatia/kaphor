import { Tabs, usePathname } from 'expo-router';
import { TabBar } from '../../src/components/TabBar';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AIFloatingButton } from '../../src/components/AIFloatingButton';

// Routes where the floating AI hub is not needed (the destination screens themselves)
const FLOATING_HUB_HIDE_PATH = [
  'ai-stylist',
  'ai-chat',
  'condition-check',
  'upcycle',
  'repair-refresh',
  'studio/chat',
  'recycling-centers',
];

export default function TabLayout() {
  const pathname = usePathname();
  const showFloatingHub = !FLOATING_HUB_HIDE_PATH.some((p) => pathname.includes(p));

  return (
    <View style={{ flex: 1 }}>
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
          name="swap/index"
          options={{
            title: 'Swap',
            tabBarIcon: ({ color }) => <Ionicons name="swap-horizontal-outline" size={24} color={color} />,
          }}
        />
        <Tabs.Screen name="circular/index" options={{ href: null }} />
        <Tabs.Screen name="cart" options={{ href: null }} />
        <Tabs.Screen
          name="rental/index"
          options={{
            title: 'Rental',
            tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
          }}
        />

        <Tabs.Screen name="rental/[id]" options={{ href: null }} />
        <Tabs.Screen name="rental/reserve" options={{ href: null }} />
        <Tabs.Screen name="rental/payment" options={{ href: null }} />
        <Tabs.Screen name="swap/[id]" options={{ href: null }} />
        <Tabs.Screen name="swap/details" options={{ href: null }} />
        <Tabs.Screen name="swap/agreement" options={{ href: null }} />
        <Tabs.Screen name="swap/shipping" options={{ href: null }} />
        <Tabs.Screen name="circular/condition-check" options={{ href: null }} />
        <Tabs.Screen name="circular/upcycle" options={{ href: null }} />
        <Tabs.Screen name="circular/recycling-centers" options={{ href: null }} />
        <Tabs.Screen name="impact/index" options={{ href: null }} />
        <Tabs.Screen name="impact/report" options={{ href: null }} />
        <Tabs.Screen name="studio/index" options={{ href: null }} />
        <Tabs.Screen name="studio/bespoke" options={{ href: null }} />
        <Tabs.Screen name="studio/chat" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="studio/upcycle" options={{ href: null }} />
        <Tabs.Screen name="studio/repair-refresh" options={{ href: null }} />
        <Tabs.Screen name="shop/[id]" options={{ href: null }} />
        <Tabs.Screen name="shop/edit/[id]" options={{ href: null }} />
        <Tabs.Screen name="shop/sell" options={{ href: null }} />
        <Tabs.Screen name="shop/cart" options={{ href: null }} />
        <Tabs.Screen name="shop/payment-history" options={{ href: null }} />
        <Tabs.Screen name="shop/ai-chat" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="shop/order-confirmed" options={{ href: null }} />
        <Tabs.Screen name="shop/checkout/delivery" options={{ href: null }} />
        <Tabs.Screen name="shop/checkout/[orderId]" options={{ href: null }} />
        <Tabs.Screen name="shop/orders/index" options={{ href: null }} />
        <Tabs.Screen name="shop/orders/[orderId]" options={{ href: null }} />
        <Tabs.Screen name="shop/seller/[userId]" options={{ href: null }} />
        <Tabs.Screen name="orders/index" options={{ href: null }} />
        <Tabs.Screen name="notifications/index" options={{ href: null }} />
        <Tabs.Screen name="messages" options={{ href: null }} />
        <Tabs.Screen name="profile/wardrobe" options={{ href: null }} />
        <Tabs.Screen name="rental/lease/[id]" options={{ href: null }} />
      </Tabs>

      {showFloatingHub && <AIFloatingButton />}
    </View>
  );
}