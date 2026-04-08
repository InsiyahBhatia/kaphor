import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { notificationService } from '../../../src/services/notificationService';
import { colors } from '../../../src/theme';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationService.getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'SWAP_REQUEST': return 'swap-horizontal';
      case 'ORDER_PAID': return 'wallet';
      case 'ORDER_SHIPPED': return 'airplane';
      case 'ORDER_DELIVERED': return 'briefcase';
      case 'PEER_REVIEW': return 'star';
      case 'LIKE': return 'heart';
      case 'COMMENT': return 'chatbubble';
      case 'FOLLOW': return 'person-add';
      default: return 'notifications';
    }
  };

  const activeColor = colors.crimson;
  const inactiveColor = colors.textMuted;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Stay updated on your activity</Text>
        </View>
        {notifications.some((n) => !n.isRead) && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>MARK ALL READ</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.crimson} style={{ marginTop: 60 }} />
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>NO NOTIFICATIONS YET</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {notifications.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.card, !n.isRead && styles.cardUnread]}
              onPress={() => handleMarkRead(n.id)}
            >
              <View style={[styles.iconCircle, !n.isRead && styles.iconCircleUnread]}>
                <Ionicons name={getIcon(n.type) as any} size={20} color={n.isRead ? inactiveColor : activeColor} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, !n.isRead && styles.cardTitleUnread]} numberOfLines={1}>
                  {n.title || n.type}
                </Text>
                <Text style={styles.cardBody} numberOfLines={2}>
                  {n.body}
                </Text>
                <Text style={styles.cardTime}>
                  {new Date(n.createdAt).toLocaleDateString()}
                </Text>
              </View>
              {!n.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 40, marginBottom: 24 },
  title: { fontSize: 32, fontFamily: 'BebasNeue_400Regular', color: colors.textPrimary },
  subtitle: { fontSize: 16, color: colors.textSecond, marginTop: 4, fontWeight: '500' },
  markAllBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: 4, backgroundColor: colors.bgCard },
  markAllText: { color: colors.textPrimary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  emptyState: { alignItems: 'center', marginTop: 100, gap: 16 },
  emptyText: { color: colors.textMuted, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  list: { gap: 12 },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: colors.bg, 
    borderRadius: 20, 
    gap: 16, 
    borderWidth: 1, 
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardUnread: { 
    borderColor: colors.crimson, 
    backgroundColor: 'rgba(155, 27, 48, 0.02)',
    borderWidth: 1.5,
  },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  iconCircleUnread: { backgroundColor: colors.white, borderColor: 'rgba(155, 27, 48, 0.2)' },
  cardContent: { flex: 1 },
  cardTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  cardTitleUnread: { color: colors.crimson },
  cardBody: { color: colors.textSecond, fontSize: 13, lineHeight: 18, marginTop: 4 },
  cardTime: { color: colors.textMuted, fontSize: 11, marginTop: 8, fontWeight: '500' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.crimson },
});
