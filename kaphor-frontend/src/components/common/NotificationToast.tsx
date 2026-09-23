import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '../../theme';
import { connectSocket, getSocket } from '../../services/socket';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ToastPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
}

export function NotificationToast() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const preferences = useNotificationStore((s) => s.preferences);
  const loadPreferences = useNotificationStore((s) => s.loadPreferences);
  const addRealtimeNotification = useNotificationStore((s) => s.addRealtimeNotification);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);

  const [toast, setToast] = useState<ToastPayload | null>(null);

  const translateY = useRef(new Animated.Value(-160)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -160,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy < -6 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -25 || gestureState.vy < -0.5) {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const showToast = (payload: ToastPayload) => {
    // Check user preference
    const currentPrefs = useNotificationStore.getState().preferences;
    if (!currentPrefs.banners) return;

    const t = payload.type || '';
    if (t.startsWith('SWAP_') && !currentPrefs.swaps) return;
    if (t.startsWith('ORDER_') && !currentPrefs.orders) return;
    if (t.startsWith('RENTAL_') && !currentPrefs.orders) return;
    if (t === 'DIRECT_MESSAGE' && !currentPrefs.messages) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(payload);

    // Haptic feedback
    if (currentPrefs.haptics) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    translateY.setValue(-140);
    opacity.setValue(0);
    progressAnim.setValue(1);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        bounciness: 6,
        speed: 13,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 2200,
        useNativeDriver: false,
      }),
    ]).start();

    // Auto dismiss after 2.2 seconds to prevent screen chaos
    timerRef.current = setTimeout(() => {
      dismiss();
    }, 2200);
  };

  useEffect(() => {
    let activeSocket = connectSocket() || getSocket();

    const handleNewNotification = (notif: any) => {
      if (notif && notif.title) {
        const payload: ToastPayload = {
          id: notif.id || `notif_${Date.now()}`,
          type: notif.type || 'SYSTEM',
          title: notif.title,
          body: notif.body || '',
          data: notif.data,
        };

        addRealtimeNotification({
          id: payload.id,
          userId: notif.userId || userId || '',
          type: payload.type,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          isRead: false,
          createdAt: notif.createdAt || new Date().toISOString(),
        });

        showToast(payload);
      }
    };

    const handleNewDirectMessage = (data: any) => {
      if (data && data.message) {
        const activeConvId = useNotificationStore.getState().activeConversationId;
        const msgConvId = data.conversationId || data.message.conversationId;

        // Suppress toast if user is actively in this conversation thread
        if (activeConvId && activeConvId === msgConvId) {
          return;
        }

        // Suppress toast for emoji reactions
        if (data.message.content?.startsWith('[[REACTION:')) {
          return;
        }

        const senderName = data.message.sender?.displayName || 'Direct Message';
        const payload: ToastPayload = {
          id: data.message.id || `msg_${Date.now()}`,
          type: 'DIRECT_MESSAGE',
          title: `💬 ${senderName}`,
          body: data.message.content || 'Sent you an image',
          data: { conversationId: msgConvId },
        };

        showToast(payload);
      }
      useNotificationStore.getState().fetchUnreadMessageCount();
    };

    const handleUnreadCountUpdated = (data: any) => {
      if (typeof data?.unreadCount === 'number') {
        useNotificationStore.setState({ unreadCount: data.unreadCount });
      }
    };

    const handleUnreadMessagesCountUpdated = (data: any) => {
      if (typeof data?.unreadCount === 'number') {
        useNotificationStore.getState().setUnreadMessageCount(data.unreadCount);
      }
    };

    const attach = (s: any) => {
      s.on('new_notification', handleNewNotification);
      s.on('new_direct_message', handleNewDirectMessage);
      s.on('unread_count_updated', handleUnreadCountUpdated);
      s.on('unread_messages_count_updated', handleUnreadMessagesCountUpdated);
    };

    if (activeSocket) {
      attach(activeSocket);
    }

    const interval = setInterval(() => {
      const s = connectSocket() || getSocket();
      if (s && s !== activeSocket) {
        activeSocket = s;
        attach(activeSocket);
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      if (activeSocket) {
        activeSocket.off('new_notification', handleNewNotification);
        activeSocket.off('new_direct_message', handleNewDirectMessage);
        activeSocket.off('unread_count_updated', handleUnreadCountUpdated);
        activeSocket.off('unread_messages_count_updated', handleUnreadMessagesCountUpdated);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [userId]);

  if (!toast) return null;

  const handlePress = () => {
    dismiss();
    const type = toast.type;
    const data = toast.data || {};

    if (type === 'DIRECT_MESSAGE' && data.conversationId) {
      router.push(`/messages/${data.conversationId}` as any);
      return;
    }

    if (type.startsWith('SWAP_')) {
      if (data.swapId) {
        if (type === 'SWAP_SHIPPED' || type === 'SWAP_DELIVERED') {
          router.push(`/(tabs)/swap/shipping?swapId=${data.swapId}` as any);
        } else if (type === 'SWAP_AGREEMENT') {
          router.push(`/(tabs)/swap/agreement?swapId=${data.swapId}` as any);
        } else {
          router.push(`/(tabs)/swap/details?swapId=${data.swapId}` as any);
        }
      } else {
        router.push('/(tabs)/swap' as any);
      }
      return;
    }

    if (type.startsWith('ORDER_')) {
      if (data.orderId) {
        router.push(`/(tabs)/shop/orders/${data.orderId}` as any);
      } else {
        router.push('/(tabs)/shop/orders' as any);
      }
      return;
    }

    if (type.startsWith('RENTAL_')) {
      if (data.garmentId) {
        router.push(`/(tabs)/rental/${data.garmentId}` as any);
      } else {
        router.push('/(tabs)/rental?tab=my' as any);
      }
      return;
    }

    // Default to notifications index
    router.push('/(tabs)/notifications' as any);
  };

  const getCategoryInfo = (type: string) => {
    if (type === 'DIRECT_MESSAGE') {
      return { icon: 'chatbubble-ellipses', label: 'MESSAGE', color: '#38A169', bg: 'rgba(56,161,105,0.2)' };
    }
    if (type.startsWith('SWAP_')) {
      return { icon: 'swap-horizontal', label: 'SWAP', color: '#C9A84C', bg: 'rgba(201,168,76,0.2)' };
    }
    if (type.startsWith('ORDER_')) {
      return { icon: 'bag-check', label: 'ORDER', color: '#2B6CB0', bg: 'rgba(43,108,176,0.2)' };
    }
    if (type.startsWith('RENTAL_')) {
      return { icon: 'calendar', label: 'RENTAL', color: '#805AD5', bg: 'rgba(128,90,213,0.2)' };
    }
    return { icon: 'notifications', label: 'ALERT', color: '#C41E3A', bg: 'rgba(196,30,58,0.2)' };
  };

  const catInfo = getCategoryInfo(toast.type);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + (Platform.OS === 'ios' ? 8 : 16),
          transform: [{ translateY }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.92}
      >
        <View style={[styles.iconWrap, { backgroundColor: catInfo.bg }]}>
          <Ionicons name={catInfo.icon as any} size={20} color={catInfo.color} />
        </View>

        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <View style={[styles.badgePill, { borderColor: catInfo.color }]}>
              <Text style={[styles.badgeText, { color: catInfo.color }]}>{catInfo.label}</Text>
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {toast.title}
            </Text>
          </View>
          <Text style={styles.body} numberOfLines={2}>
            {toast.body}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={dismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Bottom Countdown Progress Bar */}
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 99999,
    elevation: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1F22',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgePill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
    flex: 1,
  },
  body: {
    fontFamily: typography.mono,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 14,
  },
  closeBtn: {
    padding: 6,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2.5,
    backgroundColor: '#C9A84C',
  },
});
