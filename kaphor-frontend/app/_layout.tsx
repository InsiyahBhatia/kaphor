import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';
import { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display';
import { IMFellEnglish_400Regular } from '@expo-google-fonts/im-fell-english';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { Toast } from '../src/components/common/Toast';
import { NotificationToast } from '../src/components/common/NotificationToast';
import { LoadingScreen } from '../src/components/common/LoadingScreen';
import { useAuth } from '../src/context/AuthContext';
import { useRouter, useSegments } from 'expo-router';

SplashScreen.preventAutoHideAsync();

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

  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BebasNeue_400Regular,
    IBMPlexMono_400Regular,
    PlayfairDisplay_400Regular_Italic,
    IMFellEnglish_400Regular,
  });


  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return <LoadingScreen />;
  }

  return (
    <AuthProvider>
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
