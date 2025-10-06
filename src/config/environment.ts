// src/config/environment.ts - Runtime environment configuration
import Constants from 'expo-constants';

export interface EnvironmentConfig {
  firebase: {
    projectId: string;
    apiKey: string;
    authDomain: string;
    databaseURL: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
    useEmulator: boolean;
  };
  api: {
    baseURL: string;
    jwtSecret: string;
  };
  environment: 'local' | 'development' | 'production';
  isDevelopment: boolean;
  isProduction: boolean;
  isLocal: () => boolean;
  getEmulatorConfig: () => any;
  getEmulatorHost: (service: string) => string;
  getEmulatorPort: (service: string) => number;
  google: {
    visionApiKey?: string;
    clientSecret?: string;
  };
  qrService: {
    secret: string;
  };
  revenueCat: {
    apiKeys: {
      apple: string;
      google: string;
    };
    appIds: {
      apple: string;
      google: string;
    };
  };
  external: {
    expoProjectId?: string;
    sentryDsn?: string;
  };
}

// Get configuration from Expo Constants (from app.config.js extra section)
const getEnvironmentConfig = (): EnvironmentConfig => {
  // Get values from Expo Constants (app.config.js extra section)
  const extra = Constants.expoConfig?.extra || {};
  
  // Try to get environment info from app.config.js
  const envInfo = extra.environment || {};
  let environment: 'local' | 'development' | 'production' = 'local';
  
  if (envInfo.isProduction) {
    environment = 'production';
  } else if (envInfo.isDevelopment) {
    environment = 'development';
  } else if (envInfo.isLocal) {
    environment = 'local';
  }

  // Log configuration loading for debugging
  console.log('🔧 Loading environment configuration:', {
    hasExtra: !!extra,
    hasFirebase: !!extra.firebase,
    hasApi: !!extra.api,
    environment,
    projectId: extra.firebase?.projectId || 'MISSING'
  });

  // Fallback configuration for production (not localhost!)
  const fallbackConfig = {
    firebase: {
      projectId: 'spendy-97913',
      apiKey: 'AIzaSyA3PwHVfgqpxizujlimha-xTjsh_-5Tsc0',
      authDomain: 'spendy-97913.firebaseapp.com',
      databaseURL: 'https://spendy-97913-default-rtdb.firebaseio.com',
      storageBucket: 'spendy-97913.firebasestorage.app',
      messagingSenderId: '576826934856',
      appId: '1:576826934856:web:7a74ac9644f9bfc7da7a7d',
      measurementId: 'G-ZHGC7PM0HZ'
    },
    api: {
      baseURL: 'https://us-central1-spendy-97913.cloudfunctions.net/meetnsplitApi',
      jwtSecret: 'production-jwt-secret-change-me',
    },
    qrService: {
      secret: '5cb8663848fad3a60b2afb79c5ad47787c64c9c7a1a56bbf8ccd3c14131b14e8',
    },
  };

  return {
    firebase: {
      projectId: extra.firebase?.projectId || fallbackConfig.firebase.projectId,
      apiKey: extra.firebase?.apiKey || fallbackConfig.firebase.apiKey,
      authDomain: extra.firebase?.authDomain || fallbackConfig.firebase.authDomain,
      databaseURL: extra.firebase?.databaseURL || fallbackConfig.firebase.databaseURL,
      storageBucket: extra.firebase?.storageBucket || fallbackConfig.firebase.storageBucket,
      messagingSenderId: extra.firebase?.messagingSenderId || fallbackConfig.firebase.messagingSenderId,
      appId: extra.firebase?.appId || fallbackConfig.firebase.appId,
      measurementId: extra.firebase?.measurementId,
      useEmulator: environment === 'local',
    },
    api: {
      baseURL: extra.api?.baseURL || fallbackConfig.api.baseURL,
      jwtSecret: extra.api?.jwtSecret || fallbackConfig.api.jwtSecret,
    },
    environment,
    isDevelopment: environment === 'development' || environment === 'local',
    isProduction: environment === 'production',
    google: {
      visionApiKey: extra.google?.visionApiKey,
      clientSecret: extra.google?.clientSecret,
    },
    qrService: {
      secret: extra.qrService?.secret || fallbackConfig.qrService.secret,
    },
    revenueCat: {
      apiKeys: {
        apple: extra.revenueCat?.apiKeys?.apple || 'appl_ixikjWzYxdenhqByADKWioLGGFE',
        google: extra.revenueCat?.apiKeys?.google || 'goog_mQiNRXHKgAdxqTCsVRGjShjPzrg',
      },
      appIds: {
        apple: extra.revenueCat?.appIds?.apple || 'app893f790c95',
        google: extra.revenueCat?.appIds?.google || 'appa291f8b62a',
      },
    },
    external: {
      expoProjectId: extra.external?.expoProjectId || extra.eas?.projectId,
      sentryDsn: extra.external?.sentryDsn,
    },
    
    // Helper methods
    isLocal: () => environment === 'local',
    getEmulatorConfig: () => environment === 'local' ? {
      auth: { host: '127.0.0.1', port: 9099 },
      firestore: { host: '127.0.0.1', port: 8080 },
      functions: { host: '127.0.0.1', port: 5001 },
      storage: { host: '127.0.0.1', port: 9199 },
      database: { host: '127.0.0.1', port: 9000 },
    } : null,
    getEmulatorHost: (service: string) => '127.0.0.1',
    getEmulatorPort: (service: string) => {
      const ports: Record<string, number> = {
        auth: 9099,
        firestore: 8080,
        functions: 5001,
        storage: 9199,
        database: 9000,
      };
      return ports[service] || 8080;
    },
  };
};

// Validate environment configuration
export const validateEnvironmentConfig = (): void => {
  const config = getEnvironmentConfig();
  
  if (!config.firebase.projectId) {
    throw new Error('FIREBASE_PROJECT_ID is required');
  }
  
  if (!config.api.baseURL) {
    throw new Error('API_BASE_URL is required');
  }
  
  if (config.isProduction) {
    if (!config.firebase.apiKey) {
      throw new Error('FIREBASE_API_KEY is required in production');
    }
    
    if (config.api.jwtSecret === 'dev-jwt-secret') {
      throw new Error('Production JWT_SECRET must be properly configured');
    }
    
    if (!config.qrService.secret || config.qrService.secret === 'dev-qr-secret') {
      throw new Error('Production QR_SERVICE_SECRET must be properly configured');
    }
  }
};

// Export the configuration instance
export const ENV = getEnvironmentConfig();

// Auto-validate on import (only in production)
if (ENV.isProduction) {
  try {
    validateEnvironmentConfig();
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    throw error;
  }
}

// Development logging
if (__DEV__) {
  console.log('🔧 Environment loaded:', {
    environment: ENV.environment,
    firebase: { projectId: ENV.firebase.projectId },
    api: { baseURL: ENV.api.baseURL },
  });
}