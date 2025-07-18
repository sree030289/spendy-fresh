const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase compatibility fixes for Expo SDK 53
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

// Fix iOS Simulator network issues
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    return (req, res, next) => {
      // Add headers to prevent iOS Simulator network caching issues
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return middleware(req, res, next);
    };
  },
};

module.exports = config;