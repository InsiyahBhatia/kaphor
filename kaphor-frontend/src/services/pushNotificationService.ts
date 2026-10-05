import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { userService } from './userService';
import { colors } from '../theme';

// Configure how incoming notifications are presented on the device
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Sets up Android notification channels, prompts the user for system-level
 * notification permissions, acquires the Push Token, and persists it to the backend.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  // 1. Configure high-priority Android notification channels for heads-up and lock-screen banners
  if (Platform.OS === 'android') {
    // Default system / general channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Kaphor Alerts & Updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.gold,
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });

    // Direct messages channel (instant heads-up popup)
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Kaphor Direct Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: colors.ink,
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });

    // Orders, rentals, and swaps channel
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Kaphor Orders & Swaps',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300],
      lightColor: colors.forest,
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  }

  // 2. Physical device check (emulators cannot reliably receive remote push notifications)
  if (!Device.isDevice) {
    console.log('[Push] Must use a physical device for remote push notifications');
    return null;
  }

  // 3. Request system notification permissions (Android 13+ POST_NOTIFICATIONS / iOS APNs)
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Notification permission denied by user');
    return null;
  }

  // 4. Resolve correct EAS project ID
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    'e5b16a69-98ce-43ba-9faa-44859edbf66f';

  let token: string | null = null;

  // Android: acquire the native FCM device token first so the backend can deliver
  // directly via Firebase Admin. Only works in a real dev/production build, not Expo Go.
  if (Platform.OS === 'android') {
    try {
      const deviceTokenRes = await Notifications.getDevicePushTokenAsync();
      token = typeof deviceTokenRes?.data === 'string' ? deviceTokenRes.data : null;
    } catch (fcmErr) {
      console.warn('[Push] Native device token acquisition failed:', fcmErr);
    }
  }

  // Fallback: Expo Push token (iOS, or platforms where a native token is unavailable)
  if (!token) {
    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = tokenResponse.data;
    } catch (expoErr) {
      console.warn('[Push] Expo push token acquisition failed:', expoErr);
    }
  }

  // 5. Register acquired token with Kaphor backend
  if (token) {
    try {
      await userService.savePushToken(token);
      console.log('[Push] Registered push token with backend:', token);
    } catch (apiErr) {
      console.warn('[Push] Failed to save push token on backend:', apiErr);
    }
  }

  return token;
}
