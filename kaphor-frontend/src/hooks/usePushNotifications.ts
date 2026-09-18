import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { registerForPushNotificationsAsync } from '../services/pushNotificationService';

export function usePushNotifications() {
  const { user } = useAuth();
  const router = useRouter();
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!user) return;

    // Register push token and Android channels when authenticated
    registerForPushNotificationsAsync();

    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
      try {
        const data = response.notification.request.content.data;
        if (!data) return;

        if (data.url) {
          router.push(data.url as any);
        } else if (data.conversationId) {
          router.push(`/messages/${data.conversationId}` as any);
        } else if (data.orderId) {
          router.push(`/(tabs)/shop/orders/${data.orderId}` as any);
        } else if (data.swapId) {
          router.push(`/(tabs)/swap/${data.swapId}` as any);
        } else if (data.rentalId) {
          router.push('/(tabs)/profile/wardrobe' as any);
        } else if (data.type === 'DIRECT_MESSAGE' || data.type === 'NEW_MESSAGE') {
          router.push('/(tabs)/messages' as any);
        } else {
          router.push('/(tabs)/notifications' as any);
        }
      } catch (err) {
        console.warn('[Push] Error navigating from push notification response:', err);
      }
    };

    // 1. Handle cold-start launch if user tapped notification from lock screen while app was completely killed
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

    // 2. Listener for when user taps the notification while app is in background or phone notification drawer
    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user, router]);
}
