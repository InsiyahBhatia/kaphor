import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { userService } from './userService';

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
 * Sets up Android notification channel, prompts the user for system-level
 * notification permissions, acquires the Expo Push Token, and persists it to the backend.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  // Configure high-priority Android notification channel for heads-up and lock-screen banners
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Kaphor Alerts & Updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C49A45',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  }

  // Physical device check (emulators cannot reliably receive remote push notifications)
  if (!Device.isDevice) {
    console.log('[Push] Must use a physical device for remote push notifications');
    return null;
  }

  // Request system notification permissions
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

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      '3aeb7c93-08b6-4700-b8aa-d55744986915';

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const pushToken = tokenResponse.data;

    // Register token with Kaphor backend for background alerts
    if (pushToken) {
      await userService.savePushToken(pushToken);
      console.log('[Push] Registered push token with backend:', pushToken);
    }

    return pushToken;
  } catch (error) {
    console.warn('[Push] Error getting push token:', error);
    return null;
  }
}
