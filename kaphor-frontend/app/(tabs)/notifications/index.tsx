import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { notificationService } from '../../../src/services/notificationService';

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
      case 'ORDER_CONFIRMED': return 'checkmark-circle';
      case 'LIKE': return 'heart';
      case 'COMMENT': return 'chatbubble';
      case 'FOLLOW': return 'person-add';
      default: return 'notifications';
    }
  };

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
        <ActivityIndicator size="large" color="#C9A84C" style={{ marginTop: 60 }} />
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={48} color="#3A2C30" />
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
                <Ionicons name={getIcon(n.type) as any} size={20} color={n.isRead ? '#6B5C52' : '#C9A84C'} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, !n.isRead && styles.cardTitleUnread]} numberOfLines={2}>
                  {n.message || n.type}
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
  container: { flex: 1, backgroundColor: '#1A0C10' },
  content: { padding: 24, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 40, marginBottom: 24 },
  title: { fontSize: 28, fontFamily: 'CormorantGaramond_700Bold', color: '#C9A84C' },
  subtitle: { fontSize: 14, color: '#6B5C52', marginTop: 4 },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', marginTop: 4 },
  markAllText: { color: '#C9A84C', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  emptyState: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { color: '#3A2C30', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  list: { gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#2A1C20', borderRadius: 12, gap: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,0.05)' },
  cardUnread: { borderColor: 'rgba(201,168,76,0.2)', backgroundColor: '#2E1E22' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(107,92,82,0.15)', justifyContent: 'center', alignItems: 'center' },
  iconCircleUnread: { backgroundColor: 'rgba(201,168,76,0.12)' },
  cardContent: { flex: 1 },
  cardTitle: { color: '#6B5C52', fontSize: 14 },
  cardTitleUnread: { color: 'white', fontWeight: '600' },
  cardTime: { color: '#3A2C30', fontSize: 11, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C9A84C' },
});
