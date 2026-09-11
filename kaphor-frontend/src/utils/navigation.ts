import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { router } from 'expo-router';

/**
 * Universal safe back navigation helper.
 * If the router can navigate back within history, it calls router.back().
 * If there is no previous screen in stack history or router.back() fails, it safely falls back to a default route
 * (defaulting to the main tabs or a specified fallback path) instead of leaving the user stuck or exiting the app.
 */
export function safeBack(fallbackPath?: string) {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {}

  try {
    router.back();
    return;
  } catch {}

  if (fallbackPath) {
    try {
      router.replace(fallbackPath as any);
      return;
    } catch {}
  }
  
  try {
    router.replace('/(tabs)' as any);
  } catch {}
}

/**
 * Custom hook to handle Android physical/gesture back button press.
 * Always pops to the immediate previous screen.
 */
export function useBackHandler(
  fallbackPath?: string,
  customHandler?: (() => boolean | void) | null
) {
  useEffect(() => {
    const onBackPress = () => {
      if (customHandler) {
        const result = customHandler();
        if (result !== false && result !== undefined) return true;
      }
      safeBack(fallbackPath);
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [fallbackPath, customHandler]);
}
