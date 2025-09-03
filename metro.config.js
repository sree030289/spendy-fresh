const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase compatibility fixes for Expo SDK 53
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

// Optimize for development to reduce reload indicators
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    return (req, res, next) => {
      // Only set no-cache for specific cases to reduce reload frequency
      if (req.url && (req.url.includes('.bundle') || req.url.includes('hot-reload'))) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else {
        // Allow caching for static assets to reduce reload indicators
        res.setHeader('Cache-Control', 'public, max-age=300');
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;