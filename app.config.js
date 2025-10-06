// app.config.js - Environment-aware configuration
import 'dotenv/config';

// Import centralized environment configuration
const { getConfig } = require('./config/environments.js');

const config = getConfig();
const firebase = config.getFirebaseConfig();

// Get current environment info for passing to app
const { getCurrentEnvironment } = require('./config/environments.js');
const currentEnv = getCurrentEnvironment();

// Determine app configuration based on environment
const getAppConfig = () => {
  const isProduction = config.isProduction();
  
  return {
    name: isProduction ? "Meet-n-Split" : "Meet-n-Split Dev",
    slug: isProduction ? "meetnsplit" : "meetnsplit-dev",
    bundleIdentifier: isProduction ? "com.meetnsplit.app" : "com.meetnsplit.app.dev",
    package: isProduction ? "com.meetnsplit.app" : "com.meetnsplit.app.dev",
    
    // Google Services files - use production files for production env
    googleServicesFile: isProduction ? "./GoogleService-Info-prod.plist" : "./GoogleService-Info.plist",
    androidGoogleServicesFile: isProduction ? "./google-services-prod.json" : "./google-services.json",
    
    // Firebase configuration from centralized config
    firebase: {
      projectId: firebase.projectId,
      apiKey: firebase.apiKey,
      authDomain: firebase.authDomain,
      databaseURL: firebase.databaseURL,
      storageBucket: firebase.storageBucket,
      messagingSenderId: firebase.messagingSenderId,
      appId: firebase.appId,
      measurementId: firebase.measurementId,
    },
    
    // API configuration from centralized config
    api: {
      baseURL: config.getApiBaseUrl(),
      jwtSecret: config.getJwtSecret(),
    },
    
    // Security settings
    allowArbitraryLoads: config.allowHttp(), // Allow HTTP only in local/dev
  };
};

const appConfig = getAppConfig();

export default {
  expo: {
    name: appConfig.name,
    slug: "spendy",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "meetnsplit",
    userInterfaceStyle: "automatic",
    projectId: "8ba655ab-7839-4196-9893-2a71413248ed",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#B0004F"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: appConfig.bundleIdentifier,
      googleServicesFile: appConfig.googleServicesFile,
      infoPlist: {
        NSCameraUsageDescription: "This app needs access to camera for QR code scanning and taking profile pictures.",
        NSFaceIDUsageDescription: "Allow Meet-n-Split to use Face ID for secure authentication.",
        NSContactsUsageDescription: "This app needs access to contacts to help you add friends and split expenses with people in your contact list.",
        NSLocationWhenInUseUsageDescription: "This app uses location to provide location-based expense tracking and merchant suggestions.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app uses location to provide location-based expense tracking and merchant suggestions.",
        NSPhotoLibraryUsageDescription: "This app needs access to your photo library to update your profile picture and save expense receipts.",
        NSPhotoLibraryAddUsageDescription: "This app needs access to save photos to your photo library.",
        NSUserNotificationsUsageDescription: "This app sends push notifications for expense updates, payment reminders, and group activity.",
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: appConfig.allowArbitraryLoads,
          NSAllowsLocalNetworking: !config.isProduction()
        }
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#B0004F"
      },
      package: appConfig.package,
      googleServicesFile: appConfig.androidGoogleServicesFile,
      notification: {
        icon: "./assets/notification-icon-meetnsplit.png",
        color: "#B0004F"
      },
      intentFilters: [
        {
          action: "VIEW",
          data: [{ scheme: "meetnsplit" }],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ],
      permissions: [
        "CAMERA",
        "READ_CONTACTS",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "NOTIFICATIONS"
      ]
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    plugins: [
      "expo-font",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon-meetnsplit.png",
          color: "#B0004F",
          sounds: ["./assets/notification_sound.wav"],
          mode: "production"
        }
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Allow Meet-n-Split to access your camera for QR code scanning and profile pictures."
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "This app needs access to your photo library to update your profile picture and save expense receipts.",
          cameraPermission: "This app needs access to your camera to take profile pictures."
        }
      ],
      [
        "expo-contacts",
        {
          contactsPermission: "Allow Meet-n-Split to access your contacts to add friends."
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow Meet-n-Split to use your location for expense tracking.",
          locationAlwaysPermission: "Allow Meet-n-Split to use your location for automatic expense categorization.",
          locationWhenInUsePermission: "Allow Meet-n-Split to use your location when you're using the app.",
          isIosBackgroundLocationEnabled: false
        }
      ]
    ],
    // Pass environment config to the app
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      "**/*"
    ],
    extra: {
      // Environment information for runtime access
      environment: {
        name: config.environment.name,
        isLocal: config.isLocal(),
        isDevelopment: config.isDevelopment(),
        isProduction: config.isProduction(),
        debugging: config.isDebugging(),
      },
      firebase: appConfig.firebase,
      api: appConfig.api,
      google: {
        visionApiKey: process.env.GOOGLE_VISION_API_KEY,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
      qrService: {
        secret: process.env.QR_SERVICE_SECRET,
      },
      external: {
        expoProjectId: process.env.EXPO_PROJECT_ID,
        sentryDsn: process.env.SENTRY_DSN,
      },
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || process.env.EXPO_PROJECT_ID
      }
    },
    owner: "sree030289"
  }
};