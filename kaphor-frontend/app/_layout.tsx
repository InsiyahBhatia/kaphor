import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { IBMPlexMono_400Regular, IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono';
import { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display/400Regular_Italic';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display/700Bold';
import { IMFellEnglish_400Regular } from '@expo-google-fonts/im-fell-english';
import { CormorantGaramond_400Regular } from '@expo-google-fonts/cormorant-garamond/400Regular';
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold';
import { CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond/700Bold';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { Caveat_400Regular } from '@expo-google-fonts/caveat/400Regular';
import { Caveat_600SemiBold } from '@expo-google-fonts/caveat/600SemiBold';
import { Caveat_700Bold } from '@expo-google-fonts/caveat/700Bold';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { Toast } from '../src/components/common/Toast';
import { NotificationToast } from '../src/components/common/NotificationToast';
import { useAuth } from '../src/context/AuthContext';
import { useRouter, useSegments } from 'expo-router';
import { BrandSplash } from '../src/components/common/BrandSplash';
import { warmUpServer } from '../src/services/api';
import { usePushNotifications } from '../src/hooks/usePushNotifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Wake the (free-plan) backend while fonts and auth load
warmUpServer();

function PushNotificationManager() {
  usePushNotifications();
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inAdminGroup = segments[0] === '(admin)';

    if (!user && (inTabsGroup || inAdminGroup)) {
      // Redirect to landing if trying to access protected area while logged out
      router.replace('/');
    } else if (user) {
      const isQuizPage = segments[segments.length - 1] === 'style-quiz';
      
      if (!user.onboardingDone && !isQuizPage) {
        router.replace('/(auth)/style-quiz');
      } else if (user.onboardingDone && inAuthGroup && !isQuizPage) {
        if (user.role === 'ADMIN') {
          router.replace('/(admin)');
        } else {
          router.replace('/(tabs)');
        }
      }
    }
  }, [user, segments, isLoading]);

  return (
    <>
      {children}
      <BrandSplash visible={isLoading} />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BebasNeue_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Caveat_400Regular,
    Caveat_600SemiBold,
    Caveat_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_700Bold,
    IMFellEnglish_400Regular,
    CormorantGaramond_400Regular,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <AuthProvider>
      <PushNotificationManager />
      <ThemeProvider>
        <ProtectedRoute>
          <StatusBar style="dark" />
          <NotificationToast />
          <Toast />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(admin)" options={{ animation: 'fade' }} />
          </Stack>
        </ProtectedRoute>
      </ThemeProvider>
    </AuthProvider>
  );
}
