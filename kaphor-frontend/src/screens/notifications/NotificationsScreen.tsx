import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, 
  ActivityIndicator, RefreshControl, Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { colors, typography, spacing, radius } from '../../theme';

const { width } = Dimensions.get('window');

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: any;
  isRead: boolean;
  createdAt: string;
}

// ─── Mock Data (until backend is fully hooked up) ─────────────────────────────
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'ORDER_STATUS',
    title: 'Order Confirmed',
    body: 'Your order #ORD-1234 has been confirmed by the seller.',
    data: { orderId: 'ORD-1234' },
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'CHAT_MESSAGE',
    title: 'New Message from @nadiav',
    body: '"Is the vintage silk sari still available?"',
    data: { chatId: 'chat_567' },
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  {
    id: '3',
    type: 'LIFECYCLE_UPDATE',
    title: 'Item Cleaned',
    body: 'Your blazer has finished the professional cleaning cycle.',
    data: { garmentId: 'g_890' },
    isRead: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
  },
  {
    id: '4',
    type: 'SWAP_REQUEST',
    title: 'New Swap Offer',
    body: '@oria wants to swap their clutch for your Mojaris.',
    data: { swapId: 'swap_222' },
    isRead: true,
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
  },
];

const getIcon = (type: string) => {
  switch (type) {
    case 'ORDER_STATUS': return <Ionicons name="cart-outline" size={20} color={colors.gold} />;
    case 'CHAT_MESSAGE': return <Ionicons name="chatbubble-outline" size={20} color={colors.gold} />;
    case 'LIFECYCLE_UPDATE': return <MaterialCommunityIcons name="recycle" size={20} color={colors.gold} />;
    case 'SWAP_REQUEST': return <MaterialCommunityIcons name="swap-horizontal" size={20} color={colors.gold} />;
    default: return <Ionicons name="notifications-outline" size={20} color={colors.gold} />;
  }
};

const groupNotifications = (notifications: Notification[]) => {
  const groups: { [key: string]: Notification[] } = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };

  notifications.forEach(notif => {
    const date = new Date(notif.createdAt);
    if (isToday(date)) groups.Today.push(notif);
    else if (isYesterday(date)) groups.Yesterday.push(notif);
    else groups.Earlier.push(notif);
  });

  return Object.keys(groups)
    .filter(key => groups[key].length > 0)
    .map(key => ({ title: key, data: groups[key] }));
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1000));
    setRefreshing(false);
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handlePress = (notif: Notification) => {
    // Mark as read locally
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    
    // Logic to navigate based on type
    if (notif.type === 'CHAT_MESSAGE') router.push(`/messages/${notif.data.chatId}`);
    else if (notif.type === 'ORDER_STATUS') router.push(`/orders/${notif.data.orderId}`);
    else if (notif.type === 'SWAP_REQUEST') router.push(`/swaps/${notif.data.swapId}`);
  };

  const sections = groupNotifications(notifications);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>NOTIFICATIONS</Text>
        <Pressable onPress={markAllRead} style={styles.readAllBtn}>
          <Text style={styles.readAllText}>MARK ALL READ</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyText}>Nothing here yet.</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.title}
          renderItem={({ item }) => (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{item.title.toUpperCase()}</Text>
              </View>
              {item.data.map(notif => (
                <Pressable 
                  key={notif.id} 
                  style={[styles.notifRow, !notif.isRead && styles.unreadRow]}
                  onPress={() => handlePress(notif)}
                >
                  <View style={styles.iconContainer}>
                    {getIcon(notif.type)}
                  </View>
                  <View style={styles.content}>
                    <Text style={[styles.notifTitle, !notif.isRead && styles.boldText]}>{notif.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                    <Text style={styles.notifTime}>{format(new Date(notif.createdAt), 'h:mm a')}</Text>
                  </View>
                  {!notif.isRead && <View style={styles.unreadDot} />}
                </Pressable>
              ))}
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: spacing.md, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border,
    backgroundColor: colors.bg
  },
  backBtn: { width: 44 },
  headerTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 18, letterSpacing: 2 },
  readAllBtn: { },
  readAllText: { color: colors.gold, fontFamily: typography.mono, fontSize: 10, fontWeight: 'bold' },

  listContent: { paddingBottom: spacing.xxl },

  sectionHeader: { 
    paddingHorizontal: spacing.md, 
    paddingVertical: spacing.sm, 
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  sectionTitle: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1.5 },

  notifRow: { 
    flexDirection: 'row', 
    padding: spacing.md, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border,
    alignItems: 'center'
  },
  unreadRow: { backgroundColor: 'rgba(196,160,109,0.05)' },
  iconContainer: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: colors.bgCard, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  content: { flex: 1 },
  notifTitle: { color: colors.textPrimary, fontFamily: typography.body, fontSize: 14, marginBottom: 2 },
  boldText: { fontWeight: 'bold' },
  notifBody: { color: colors.textSecond, fontFamily: typography.body, fontSize: 13, lineHeight: 18 },
  notifTime: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginLeft: spacing.sm },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: colors.textMuted, fontFamily: typography.body, fontSize: 16, marginTop: 16 }
});
