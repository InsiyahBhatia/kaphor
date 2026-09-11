import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { router } from 'expo-router';

/**
 * Universal safe back navigation helper.
 * If the router can navigate back within history, it calls router.back().
 * If there is no previous screen in stack history or router.back() fails, it safely falls back to a default route
 * (defaulting to the main tabs or a specified fallback path) instead of leaving the user stuck or exiting the app.
 */
export function safeBack(fallbackPath: string = '/(tabs)') {
  try {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackPath as any);
    }
  } catch (err) {
    try {
      router.replace(fallbackPath as any);
    } catch {
      router.replace('/(tabs)' as any);
    }
  }
}

/**
 * Custom hook to handle Android physical/gesture back button press.
 * Calls onBackCustom if provided, otherwise safeBack(fallbackPath).
 */
export function useBackHandler(
  fallbackPath: string = '/(tabs)',
  customHandler?: (() => boolean | void) | null
) {
  useEffect(() => {
    const onBackPress = () => {
      if (customHandler) {
        const result = customHandler();
        if (result !== false) return true;
      }
      safeBack(fallbackPath);
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [fallbackPath, customHandler]);
}
