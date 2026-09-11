import * as React from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuth } from '../context/AuthContext';
import { Alert, Platform } from 'react-native';
import axios, { AxiosError } from 'axios';

const DEFAULT_WEB_CLIENT_ID = '1091661686962-8v9tqlipbm6jf3gom0bg4q8rj4q41m7v.apps.googleusercontent.com';

function googleBackendMessage(error: unknown): string {
  if (axios.isAxiosError(error) || (error as any)?.isAxiosError) {
    const ax = error as AxiosError<{ message?: string; error?: string }>;
    const data = ax.response?.data;
    const msg = data?.message || data?.error;
    if (typeof msg === 'string' && msg.length > 0) return msg;
    if (!ax.response) {
      return 'Cannot reach the backend server. Please check your internet connection and verify the backend is online.';
    }
  }
  return 'Google sign-in failed on the server. Please try again.';
}

export function useGoogleAuth() {
  const { signInWithGoogle, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const inFlight = React.useRef(false);

  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || DEFAULT_WEB_CLIENT_ID;
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
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Clear the SDK’s cached account so sign-in shows the account picker instead of
      // silently reusing the last Google session.
      try {
        await GoogleSignin.signOut();
      } catch {
        /* no prior Google session */
      }
      const response = await GoogleSignin.signIn();

      if (response.type !== 'success') {
        return false;
      }

      let idToken = response.data?.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken;
      }

      if (!idToken) {
        Alert.alert(
          'Google Sign-In Error',
          'No ID token received from Google Play Services. Verify your Google OAuth Web Client ID.'
        );
        return false;
      }

      await signInWithGoogle(idToken);
      return true;
    } catch (error: any) {
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        return false;
      }
      if (error?.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Please Wait', 'Google sign-in is already in progress.');
        return false;
      }

      console.error('Native Google Auth Error:', error);

      if (axios.isAxiosError(error) || error?.isAxiosError || error?.response) {
        Alert.alert('Sign-In Error', googleBackendMessage(error));
        return false;
      }

      let diagnosticMsg = error?.message || 'Something went wrong during Google sign-in.';
      if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        diagnosticMsg = 'Google Play Services is not available or needs to be updated.';
      } else if (error?.code === '10' || error?.code === statusCodes.SIGN_IN_REQUIRED || String(error).includes('10')) {
        diagnosticMsg = 'Google Play Services Developer Error (10): The SHA-1 fingerprint of the build does not match the Android OAuth Client ID in Google Cloud / Firebase Console.';
      }

      Alert.alert('Google Sign-In', diagnosticMsg);
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
