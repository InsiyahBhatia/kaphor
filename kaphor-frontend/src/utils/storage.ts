import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Universal, ultra-resilient key-value storage.
 * Uses AsyncStorage as the primary persistent layer (no 2048-byte limit, survives restarts/reboots)
 * with SecureStore integration where appropriate.
 */
export async function setItem(key: string, value: string): Promise<void> {
  // Always persist in AsyncStorage first (universal, no length limits, immune to Keystore hiccups)
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    }
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.warn('AsyncStorage setItem failed:', e);
  }

  // On native platforms, also attempt SecureStore for credentials within the 2048-byte safe boundary
  if (Platform.OS !== 'web' && value.length <= 2000) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // SecureStore may fail on certain Android devices or length limits; AsyncStorage already saved it
    }
  }
}

export async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const webVal = window.localStorage.getItem(key);
        if (webVal !== null) return webVal;
      }
    }

    // 1. Primary lookup in AsyncStorage
    const val = await AsyncStorage.getItem(key);
    if (val !== null && val !== undefined) {
      return val;
    }
  } catch (e) {
    console.warn('AsyncStorage getItem error:', e);
  }

  // 2. Fallback to SecureStore (handles migration from previous app versions)
  if (Platform.OS !== 'web') {
    try {
      const secureVal = await SecureStore.getItemAsync(key);
      if (secureVal !== null && secureVal !== undefined) {
        // Backfill into AsyncStorage for faster, reliable subsequent lookups
        AsyncStorage.setItem(key, secureVal).catch(() => {});
        return secureVal;
      }
    } catch {
      // SecureStore error ignored
    }
  }

  return null;
}

export async function deleteItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    }
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn('AsyncStorage removeItem error:', e);
  }

  if (Platform.OS !== 'web') {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  }
}

export const safeStorage = {
  setItem,
  getItem,
  deleteItem,
};

export default safeStorage;

