// src/utils/devUtils.ts
// Development utilities to reduce visual noise

export const hideDevIndicators = () => {
  if (__DEV__) {
    // Reduce console noise
    const originalLog = console.log;
    console.log = (...args) => {
      // Filter out development reload messages
      if (args[0] && typeof args[0] === 'string') {
        if (args[0].includes('Reloading') || 
            args[0].includes('Fast Refresh') ||
            args[0].includes('Metro') ||
            args[0].includes('Bundle loaded')) {
          return;
        }
      }
      originalLog.apply(console, args);
    };

    // Reduce warning noise
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (args[0] && typeof args[0] === 'string') {
        if (args[0].includes('YellowBox') || 
            args[0].includes('Fast Refresh') ||
            args[0].includes('reload')) {
          return;
        }
      }
      originalWarn.apply(console, args);
    };
  }
};

export const isDevBuild = () => {
  return __DEV__;
};
