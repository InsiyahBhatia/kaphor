import * as React from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuth } from '../context/AuthContext';
import { Alert } from 'react-native';
import { AxiosError } from 'axios';

function googleBackendMessage(error: unknown): string {
  const ax = error as AxiosError<{ message?: string; error?: string }>;
  const data = ax.response?.data;
  const msg = data?.message;
  if (typeof msg === 'string' && msg.length > 0) return msg;
  if (!ax.response) {
    return 'Cannot reach the server. On a real Android device, ensure EXPO_PUBLIC_API_URL uses your computer IP (same Wi‑Fi) and the backend is running.';
  }
  return 'Google sign-in failed. Please try again.';
}

export function useGoogleAuth() {
  const { signInWithGoogle, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const inFlight = React.useRef(false);

  React.useEffect(() => {
    try {
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      if (!webClientId) {
        console.warn(
          'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing; Google Sign-In may not return an ID token.'
        );
      }
      GoogleSignin.configure({
        webClientId,
        offlineAccess: true,
      });
    } catch (e) {
      console.error('Failed to configure GoogleSignin natively:', e);
    }
  }, []);

  /**
   * @returns true when the backend accepted the Google token and the session was stored.
   */
  const loginWithGoogle = async (): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      // Clear the SDK’s cached account so sign-in shows the account picker instead of
      // silently reusing the last Google session (e.g. insiyahmbhatia@gmail.com).
      try {
        await GoogleSignin.signOut();
      } catch {
        /* no prior Google session */
      }
      const response = await GoogleSignin.signIn();

      if (response.type !== 'success') {
        return false;
      }

      let idToken = response.data.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }

      if (!idToken) {
        Alert.alert(
          'Google Sign-In',
          'No ID token from Google. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your OAuth Web client ID (from Google Cloud Console).'
        );
        return false;
      }

      if (__DEV__) {
        console.log('Google ID token received; verifying with backend...');
      }

      await signInWithGoogle(idToken);
      return true;
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        return false;
      }
      if (err.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Wait', 'Sign-in is already in progress.');
        return false;
      }

      const isAxios = (error as AxiosError).isAxiosError === true;
      if (isAxios) {
        Alert.alert('Google Sign-In', googleBackendMessage(error));
        return false;
      }

      console.error('Native Google Auth Error:', error);
      Alert.alert('Login Failed', 'Something went wrong during Google sign-in.');
      return false;
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  return {
    loginWithGoogle,
    isGoogleLoading: loading || authLoading,
  };
}
