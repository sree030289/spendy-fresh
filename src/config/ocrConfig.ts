// OCR Service Configuration
export const OCR_CONFIG = {
  // OCR.space API keys (get from https://ocr.space/ocrapi)
  OCR_SPACE: {
    FREE_API_KEY: 'helloworld', // Demo key - replace with your free key
    PREMIUM_API_KEY: process.env.EXPO_PUBLIC_OCR_SPACE_API_KEY || 'helloworld', // Premium key from env
    BASE_URL: 'https://api.ocr.space/parse/image'
  },
  
  // Google Vision API (get from Google Cloud Console)
  GOOGLE_VISION: {
    API_KEY: process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY,
    BASE_URL: 'https://vision.googleapis.com/v1/images:annotate'
  },
  
  // Microsoft Cognitive Services (get from Azure)
  MICROSOFT: {
    API_KEY: process.env.EXPO_PUBLIC_MICROSOFT_VISION_API_KEY,
    ENDPOINT: process.env.EXPO_PUBLIC_MICROSOFT_VISION_ENDPOINT
  },
  
  // Default OCR settings
  DEFAULT_SETTINGS: {
    TIMEOUT_MS: 30000,
    MAX_IMAGE_SIZE: 800 * 1024, // 800KB
    MAX_IMAGE_WIDTH: 1200,
    IMAGE_QUALITY: 0.8,
    CONFIDENCE_THRESHOLD: 0.5
  }
};

// Helper function to check if API keys are configured
export const getAvailableOCRServices = () => {
  const services = [];
  
  if (OCR_CONFIG.OCR_SPACE.FREE_API_KEY && OCR_CONFIG.OCR_SPACE.FREE_API_KEY !== 'helloworld') {
    services.push('OCR.space Free');
  }
  
  if (OCR_CONFIG.OCR_SPACE.PREMIUM_API_KEY && OCR_CONFIG.OCR_SPACE.PREMIUM_API_KEY !== 'helloworld') {
    services.push('OCR.space Premium');
  }
  
  if (OCR_CONFIG.GOOGLE_VISION.API_KEY) {
    services.push('Google Vision API');
  }
  
  if (OCR_CONFIG.MICROSOFT.API_KEY && OCR_CONFIG.MICROSOFT.ENDPOINT) {
    services.push('Microsoft Computer Vision');
  }
  
  // Always include fallback
  services.push('Pattern Recognition Fallback');
  
  return services;
};

// Development/testing configuration
export const DEV_CONFIG = {
  ENABLE_MOCK_OCR: __DEV__ && process.env.EXPO_PUBLIC_MOCK_OCR === 'true',
  ENABLE_LOGGING: __DEV__ || process.env.EXPO_PUBLIC_OCR_LOGGING === 'true',
  SAVE_DEBUG_IMAGES: __DEV__ && process.env.EXPO_PUBLIC_SAVE_DEBUG_IMAGES === 'true'
};