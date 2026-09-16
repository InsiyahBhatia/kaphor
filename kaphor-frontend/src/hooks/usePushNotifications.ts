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

    // Register push token and Android channel when authenticated
    registerForPushNotificationsAsync();

    // Listener for when user taps the notification from phone notification drawer or lock screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      try {
        const data = response.notification.request.content.data;
        if (data?.url) {
          router.push(data.url as any);
        } else if (data?.conversationId) {
          router.push({
            pathname: '/(tabs)/studio/chat',
            params: { id: data.conversationId },
          } as any);
        } else if (data?.type === 'DIRECT_MESSAGE') {
          router.push('/(tabs)/studio' as any);
        } else if (data?.type) {
          router.push('/(tabs)/notifications' as any);
        }
      } catch (err) {
        console.warn('[Push] Error navigating from push notification response:', err);
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);
}
