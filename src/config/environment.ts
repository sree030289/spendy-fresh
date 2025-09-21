// src/config/environment.ts
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
  };
  api: {
    baseURL: string;
    jwtSecret: string;
  };
  environment: 'development' | 'staging' | 'production';
  isDevelopment: boolean;
  isProduction: boolean;
  google: {
    visionApiKey?: string;
    clientSecret?: string;
  };
  qrService: {
    secret: string;
  };
  external: {
    expoProjectId?: string;
    sentryDsn?: string;
  };
}

// Get configuration from Expo Constants (from app.config.js extra section)
const getEnvironmentConfig = (): EnvironmentConfig => {
  const extra = Constants.expoConfig?.extra || Constants.manifest?.extra;
  
  if (!extra) {
    throw new Error('Environment configuration not found. Please check app.config.js');
  }

  const environment = extra.environment || 'development';
  
  return {
    firebase: {
      projectId: extra.firebase?.projectId || '',
      apiKey: extra.firebase?.apiKey || '',
      authDomain: extra.firebase?.authDomain || '',
      databaseURL: extra.firebase?.databaseURL || '',
      storageBucket: extra.firebase?.storageBucket || '',
      messagingSenderId: extra.firebase?.messagingSenderId || '',
      appId: extra.firebase?.appId || '',
    },
    api: {
      baseURL: extra.api?.baseURL || 'https://us-central1-spendy-develop.cloudfunctions.net/meetnsplitApi',
      jwtSecret: extra.api?.jwtSecret || 'dev-jwt-secret',
    },
    environment: environment as 'development' | 'staging' | 'production',
    isDevelopment: environment === 'development',
    isProduction: environment === 'production',
    google: {
      visionApiKey: extra.google?.visionApiKey,
      clientSecret: extra.google?.clientSecret,
    },
    qrService: {
      secret: extra.qrService?.secret || 'dev-qr-secret',
    },
    external: {
      expoProjectId: extra.external?.expoProjectId,
      sentryDsn: extra.external?.sentryDsn,
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
    
    if (config.qrService.secret === 'dev-qr-secret') {
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