import { router } from 'expo-router';

/**
 * Universal safe back navigation helper.
 * If the router can navigate back within history, it calls router.back().
 * If there is no previous screen in stack history, it safely falls back to a default route
 * (defaulting to the main tabs or a specified fallback path) instead of leaving the user stuck or exiting the app.
 */
export function safeBack(fallbackPath: string = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackPath as any);
  }
}
