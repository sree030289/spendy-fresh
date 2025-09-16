// app.config.js
import 'dotenv/config';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const EXPO_ENVIRONMENT = process.env.EXPO_ENVIRONMENT || 'development';

// Environment-specific configuration
const getEnvironmentConfig = () => {
  if (EXPO_ENVIRONMENT === 'production') {
    return {
      name: "Spendy",
      slug: "spendy",
      bundleIdentifier: "com.svaag.spendy",
      package: "com.svaag.spendy",
      googleServicesFile: process.env.NODE_ENV === 'production' ? "./GoogleService-Info-prod.plist" : undefined,
      androidGoogleServicesFile: process.env.NODE_ENV === 'production' ? "./google-services-prod.json" : undefined,
      firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
      },
      api: {
        baseURL: process.env.API_BASE_URL,
        jwtSecret: process.env.JWT_SECRET,
      },
      allowArbitraryLoads: false, // Enforce HTTPS in production
    };
  } else {
    return {
      name: "Spendy Dev",
      slug: "spendy-dev", 
      bundleIdentifier: "com.svaag.spendy.dev",
      package: "com.svaag.spendy.dev",
      googleServicesFile: process.env.NODE_ENV === 'production' ? "./GoogleService-Info-dev.plist" : undefined,
      androidGoogleServicesFile: process.env.NODE_ENV === 'production' ? "./google-services-dev.json" : undefined,
      firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || 'spendy-dev-project',
        apiKey: process.env.FIREBASE_API_KEY || 'dev-api-key',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'spendy-dev-project.firebaseapp.com',
        databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://spendy-dev-project-default-rtdb.firebaseio.com',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'spendy-dev-project.appspot.com',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '123456789',
        appId: process.env.FIREBASE_APP_ID || '1:123456789:web:abcdef123456',
      },
      api: {
        baseURL: process.env.API_BASE_URL || 'http://localhost:5000/spendy-dev-project/us-central1/spendyApi',
        jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-not-for-production',
      },
      allowArbitraryLoads: true, // Allow HTTP in development
    };
  }
};

const envConfig = getEnvironmentConfig();

export default {
  expo: {
    name: envConfig.name,
    slug: envConfig.slug,
    version: "1.0.0",
    orientation: "portrait",
    scheme: "spendy",
    userInterfaceStyle: "automatic",
    projectId: envConfig.firebase.projectId,
    icon: "./assets/icon-receipt.png",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#D6001C"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: envConfig.bundleIdentifier,
      googleServicesFile: envConfig.googleServicesFile,
      infoPlist: {
        NSCameraUsageDescription: "This app needs access to camera for QR code scanning and taking profile pictures.",
        NSFaceIDUsageDescription: "Allow Spendy to use Face ID for secure authentication.",
        NSContactsUsageDescription: "This app needs access to contacts to help you add friends and split expenses with people in your contact list.",
        NSLocationWhenInUseUsageDescription: "This app uses location to provide location-based expense tracking and merchant suggestions.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app uses location to provide location-based expense tracking and merchant suggestions.",
        NSPhotoLibraryUsageDescription: "This app needs access to your photo library to update your profile picture and save expense receipts.",
        NSPhotoLibraryAddUsageDescription: "This app needs access to save photos to your photo library.",
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: envConfig.allowArbitraryLoads,
          NSAllowsLocalNetworking: !IS_PRODUCTION
        }
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon-receipt.png",
        backgroundColor: "#D6001C"
      },
      package: envConfig.package,
      googleServicesFile: envConfig.androidGoogleServicesFile,
      intentFilters: [
        {
          action: "VIEW",
          data: [{ scheme: "spendy" }],
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
      "expo-notifications",
      [
        "expo-camera",
        {
          cameraPermission: "Allow Spendy to access your camera for QR code scanning and profile pictures."
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
          contactsPermission: "Allow Spendy to access your contacts to add friends."
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow Spendy to use your location for expense tracking.",
          locationAlwaysPermission: "Allow Spendy to use your location for automatic expense categorization.",
          locationWhenInUsePermission: "Allow Spendy to use your location when you're using the app.",
          isIosBackgroundLocationEnabled: false
        }
      ]
    ],
    // Pass environment config to the app
    extra: {
      environment: EXPO_ENVIRONMENT,
      firebase: envConfig.firebase,
      api: envConfig.api,
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
    },
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      "**/*"
    ]
  }
};