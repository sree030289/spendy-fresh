// config/environments.js
// Centralized Environment Configuration for Meet-n-Split App
// Single source of truth for all environment settings

const ENVIRONMENTS = {
  // Local Development - Firebase Emulator
  local: {
    name: 'Local Development',
    firebase: {
      useEmulator: true,
      projectId: 'spendy-develop',
      apiKey: 'AIzaSyA3PwHVfgqpxizujlimha-xTjsh_-5Tsc0',
      authDomain: 'spendy-develop.firebaseapp.com',
      databaseURL: 'https://spendy-develop-default-rtdb.firebaseio.com',
      storageBucket: 'spendy-develop.appspot.com',
      messagingSenderId: '827143652568',
      appId: '1:827143652568:web:a8b9c0d1e2f3g4h5i6j7k8',
    },
    emulators: {
      auth: { host: '127.0.0.1', port: 9099 },
      firestore: { host: '127.0.0.1', port: 8080 },
      functions: { host: '127.0.0.1', port: 5001 },
      storage: { host: '127.0.0.1', port: 9199 },
      database: { host: '127.0.0.1', port: 9000 },
      hosting: { host: '127.0.0.1', port: 5000 },
      ui: { host: '127.0.0.1', port: 4000 },
    },
    api: {
      // Network IP for device testing, localhost for web/simulator
      baseURL: process.env.NODE_ENV === 'development' 
        ? 'http://192.168.0.144:5001/spendy-develop/us-central1/meetnsplitApi'
        : 'http://127.0.0.1:5001/spendy-develop/us-central1/meetnsplitApi',
      functionsURL: 'http://127.0.0.1:5001/spendy-develop/us-central1',
    },
    oauth: {
      googleRedirectUri: 'http://127.0.0.1:5001/spendy-develop/us-central1/meetnsplitApi/gmail/callback',
    },
    security: {
      jwtSecret: 'dev-jwt-secret-for-development',
      qrServiceSecret: 'dev-qr-secret-for-development',
    },
    features: {
      debugging: true,
      verbose: true,
      allowHttp: true,
    }
  },

  // Development - Cloud Functions
  development: {
    name: 'Development Cloud',
    firebase: {
      useEmulator: false,
      projectId: 'spendy-develop',
      apiKey: 'AIzaSyA3PwHVfgqpxizujlimha-xTjsh_-5Tsc0',
      authDomain: 'spendy-develop.firebaseapp.com',
      databaseURL: 'https://spendy-develop-default-rtdb.firebaseio.com',
      storageBucket: 'spendy-develop.appspot.com',
      messagingSenderId: '827143652568',
      appId: '1:827143652568:web:a8b9c0d1e2f3g4h5i6j7k8',
    },
    emulators: null, // No emulators in development
    api: {
      baseURL: 'https://us-central1-spendy-develop.cloudfunctions.net/meetnsplitApi',
      functionsURL: 'https://us-central1-spendy-develop.cloudfunctions.net',
    },
    oauth: {
      googleRedirectUri: 'https://us-central1-spendy-develop.cloudfunctions.net/meetnsplitApi/gmail/callback',
    },
    security: {
      jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-for-development',
      qrServiceSecret: process.env.QR_SERVICE_SECRET || 'dev-qr-secret-for-development',
    },
    features: {
      debugging: true,
      verbose: false,
      allowHttp: false,
    }
  },

  // Production
  production: {
    name: 'Production',
    firebase: {
      useEmulator: false,
      projectId: 'spendy-97913',
      apiKey: 'AIzaSyA3PwHVfgqpxizujlimha-xTjsh_-5Tsc0',
      authDomain: 'spendy-97913.firebaseapp.com',
      databaseURL: 'https://spendy-97913-default-rtdb.firebaseio.com',
      storageBucket: 'spendy-97913.firebasestorage.app',
      messagingSenderId: '576826934856',
      appId: '1:576826934856:web:7a74ac9644f9bfc7da7a7d',
      measurementId: 'G-ZHGC7PM0HZ'
    },
    emulators: null, // No emulators in production
    api: {
      baseURL: 'https://us-central1-spendy-97913.cloudfunctions.net/meetnsplitApi',
      functionsURL: 'https://us-central1-spendy-97913.cloudfunctions.net',
    },
    oauth: {
      googleRedirectUri: 'https://us-central1-spendy-97913.cloudfunctions.net/meetnsplitApi/gmail/callback',
    },
    security: {
      jwtSecret: process.env.JWT_SECRET || 'production-jwt-secret-change-me',
      qrServiceSecret: process.env.QR_SERVICE_SECRET || 'production-qr-secret-change-me',
    },
    features: {
      debugging: false,
      verbose: false,
      allowHttp: false,
    }
  }
};

/**
 * Get current environment configuration
 * Priority: SPENDY_ENV > NODE_ENV > 'local'
 */
function getCurrentEnvironment() {
  const spendyEnv = process.env.SPENDY_ENV;
  const nodeEnv = process.env.NODE_ENV;
  
  // If SPENDY_ENV is set, use it directly (no mapping needed)
  if (spendyEnv && ENVIRONMENTS[spendyEnv]) {
    return ENVIRONMENTS[spendyEnv];
  }
  
  // If SPENDY_ENV is set but invalid, warn and fallback
  if (spendyEnv) {
    console.warn(`Unknown SPENDY_ENV: ${spendyEnv}, falling back to NODE_ENV or 'local'`);
  }
  
  // Map NODE_ENV values to our environment names (only for NODE_ENV)
  const nodeEnvMapping = {
    'development': 'local',
    'test': 'development', 
    'production': 'production'
  };

  const finalEnv = nodeEnvMapping[nodeEnv] || nodeEnv || 'local';
  
  if (!ENVIRONMENTS[finalEnv]) {
    console.warn(`Unknown environment: ${finalEnv}, falling back to 'local'`);
    return ENVIRONMENTS.local;
  }
  
  return ENVIRONMENTS[finalEnv];
}

/**
 * Get environment-specific configuration
 */
function getConfig() {
  const env = getCurrentEnvironment();
  
  console.log(`🔧 Environment: ${env.name}`);
  
  return {
    environment: env,
    
    // Firebase configuration
    getFirebaseConfig: () => env.firebase,
    
    // API URLs
    getApiBaseUrl: () => env.api.baseURL,
    getFunctionsUrl: () => env.api.functionsURL,
    
    // OAuth configuration  
    getGoogleRedirectUri: () => env.oauth.googleRedirectUri,
    
    // Security
    getJwtSecret: () => env.security.jwtSecret,
    getQrServiceSecret: () => env.security.qrServiceSecret,
    
    // Feature flags
    isDebugging: () => env.features.debugging,
    isVerbose: () => env.features.verbose,
    allowHttp: () => env.features.allowHttp,
    
    // Firebase service URLs
    getFirestoreUrl: () => {
      if (env.firebase.useEmulator) {
        return `http://${env.emulators.firestore.host}:${env.emulators.firestore.port}`;
      }
      return `https://${env.firebase.projectId}.firebaseio.com`;
    },
    
    getAuthUrl: () => {
      if (env.firebase.useEmulator) {
        return `http://${env.emulators.auth.host}:${env.emulators.auth.port}`;
      }
      return `https://${env.firebase.authDomain}`;
    },
    
    getStorageUrl: () => {
      if (env.firebase.useEmulator) {
        return `http://${env.emulators.storage.host}:${env.emulators.storage.port}`;
      }
      return `https://firebasestorage.googleapis.com/v0/b/${env.firebase.storageBucket}`;
    },
    
    // Emulator configuration
    getEmulatorConfig: () => env.emulators,
    shouldUseEmulator: () => env.firebase.useEmulator,
    getEmulatorHost: (service) => env.emulators?.[service]?.host || '127.0.0.1',
    getEmulatorPort: (service) => env.emulators?.[service]?.port || 8080,
    
    // Database URLs
    getDatabaseUrl: () => env.firebase.databaseURL,
    getFirestoreSettings: () => ({
      projectId: env.firebase.projectId,
      useEmulator: env.firebase.useEmulator,
      emulatorHost: env.firebase.useEmulator ? `${env.emulators.firestore.host}:${env.emulators.firestore.port}` : null,
    }),
    
    // Authentication settings
    getAuthSettings: () => ({
      useEmulator: env.firebase.useEmulator,
      emulatorHost: env.firebase.useEmulator ? `http://${env.emulators.auth.host}:${env.emulators.auth.port}` : null,
    }),
    
    // Storage settings
    getStorageSettings: () => ({
      useEmulator: env.firebase.useEmulator,
      emulatorHost: env.firebase.useEmulator ? `${env.emulators.storage.host}:${env.emulators.storage.port}` : null,
    }),
    
    // Helper methods
    isLocal: () => env === ENVIRONMENTS.local,
    isDevelopment: () => env === ENVIRONMENTS.development,
    isProduction: () => env === ENVIRONMENTS.production,
    
    // Get all environments (for admin tools)
    getAllEnvironments: () => ENVIRONMENTS,
  };
}

module.exports = {
  ENVIRONMENTS,
  getCurrentEnvironment,
  getConfig,
};
