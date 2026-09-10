import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../theme';
import { connectSocket, getSocket } from '../../services/socket';
import { useAuthStore } from '../../store/authStore';
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
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  };

  const showToast = (payload: ToastPayload) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(payload);

    translateY.setValue(-120);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        bounciness: 6,
        speed: 12,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after 4.5 seconds
    timerRef.current = setTimeout(() => {
      dismiss();
    }, 4500);
  };

  useEffect(() => {
    const socket = connectSocket() || getSocket();
    if (!socket) return;

    const handleNewNotification = (notif: any) => {
      if (notif && notif.title) {
        showToast({
          id: notif.id || `notif_${Date.now()}`,
          type: notif.type || 'SYSTEM',
          title: notif.title,
          body: notif.body || '',
          data: notif.data,
        });
      }
    };

    const handleNewDirectMessage = (data: any) => {
      if (data && data.message) {
        const senderName = data.message.sender?.displayName || 'Direct Message';
        showToast({
          id: data.message.id || `msg_${Date.now()}`,
          type: 'DIRECT_MESSAGE',
          title: `💬 ${senderName}`,
          body: data.message.content || 'Sent you an image',
          data: { conversationId: data.conversationId },
        });
      }
    };

    socket.on('new_notification', handleNewNotification);
    socket.on('new_direct_message', handleNewDirectMessage);

    return () => {
      socket.off('new_notification', handleNewNotification);
      socket.off('new_direct_message', handleNewDirectMessage);
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
        router.push(`/(tabs)/swap/shipping?swapId=${data.swapId}` as any);
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
      if (data.rentalId) {
        router.push(`/rental/${data.rentalId}` as any);
      } else {
        router.push('/(tabs)/rental' as any);
      }
      return;
    }

    // Default to notifications index
    router.push('/(tabs)/notifications' as any);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'DIRECT_MESSAGE':
        return 'chatbubble-ellipses';
      case 'SWAP_REQUEST':
      case 'SWAP_ACCEPTED':
      case 'SWAP_SHIPPED':
      case 'SWAP_COMPLETED':
        return 'swap-horizontal';
      case 'ORDER_PAID':
      case 'ORDER_SHIPPED':
      case 'ORDER_DELIVERED':
        return 'bag-check';
      case 'RENTAL_RESERVED':
      case 'RENTAL_ACTIVE':
        return 'calendar';
      default:
        return 'notifications';
    }
  };

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
    >
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.88}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={getIcon(toast.type) as any} size={20} color={colors.cream} />
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {toast.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {toast.body}
          </Text>
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    elevation: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1F22',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8C6D3B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  body: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: '#CCC',
    lineHeight: 14,
  },
  closeBtn: {
    padding: 4,
  },
});
