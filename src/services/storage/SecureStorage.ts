// src/services/storage/SecureStorage.ts
import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A wrapper for EncryptedStorage with fallback to AsyncStorage if EncryptedStorage is unavailable.
 * This prevents runtime errors when RNEncryptedStorage is undefined.
 */
class SecureStorage {
  private static isEncryptedStorageAvailable(): boolean {
    return typeof EncryptedStorage !== 'undefined' && EncryptedStorage !== null;
  }

  /**
   * Store a string value securely
   */
  static async setItem(key: string, value: string): Promise<void> {
    try {
      if (this.isEncryptedStorageAvailable()) {
        await EncryptedStorage.setItem(key, value);
      } else {
        console.warn('EncryptedStorage not available, falling back to AsyncStorage');
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('Error storing data securely:', error);
      throw error;
    }
  }

  /**
   * Get a securely stored string value
   */
  static async getItem(key: string): Promise<string | null> {
    try {
      if (this.isEncryptedStorageAvailable()) {
        return await EncryptedStorage.getItem(key);
      } else {
        console.warn('EncryptedStorage not available, falling back to AsyncStorage');
        return await AsyncStorage.getItem(key);
      }
    } catch (error) {
      console.error('Error retrieving secure data:', error);
      return null;
    }
  }

  /**
   * Remove a securely stored item
   */
  static async removeItem(key: string): Promise<void> {
    try {
      if (this.isEncryptedStorageAvailable()) {
        await EncryptedStorage.removeItem(key);
      } else {
        console.warn('EncryptedStorage not available, falling back to AsyncStorage');
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Error removing secure data:', error);
      throw error;
    }
  }

  /**
   * Clear all stored items
   */
  static async clear(): Promise<void> {
    try {
      if (this.isEncryptedStorageAvailable()) {
        await EncryptedStorage.clear();
      } else {
        console.warn('EncryptedStorage not available, falling back to AsyncStorage');
        await AsyncStorage.clear();
      }
    } catch (error) {
      console.error('Error clearing secure storage:', error);
      throw error;
    }
  }
}

export default SecureStorage;
