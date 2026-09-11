import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Universal key-value storage that safely uses Expo SecureStore on native Android/iOS
 * and standard localStorage on Web.
 */
export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('Web storage setItem failed', e);
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    console.warn('SecureStore setItemAsync error', e);
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('Web storage getItem failed', e);
    }
    return null;
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    console.warn('SecureStore getItemAsync error', e);
    return null;
  }
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Web storage removeItem failed', e);
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    console.warn('SecureStore deleteItemAsync error', e);
  }
}

export const safeStorage = {
  setItem,
  getItem,
  deleteItem,
};

export default safeStorage;
