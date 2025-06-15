// src/utils/NativeModuleInitializer.ts
import { Platform } from 'react-native';

/**
 * Helper class to initialize native modules and handle errors gracefully
 */
export class NativeModuleInitializer {
  /**
   * Initialize all required native modules
   * Call this early in your app startup process
   */
  static initializeModules(): void {
    // Only need to do specific initialization on iOS
    if (Platform.OS === 'ios') {
      try {
        // Sometimes this helps force modules to load properly in dev mode
        console.log('Initializing native modules...');
        
        // Add other module initializations here if needed
      } catch (error) {
        console.warn('Error initializing native modules:', error);
      }
    }
  }
}
