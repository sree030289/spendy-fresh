// Version compatibility utility to prevent Reanimated crashes
import { Platform } from 'react-native';

// Check if we're running in Expo Go (which has fixed Reanimated version)
export const isExpoGo = () => {
  return __DEV__ && !Platform.constants?.reactNativeVersion?.patch;
};

// Determine which animation components to use
export const AnimationComponents = {
  FullScreenSuccess: isExpoGo() 
    ? require('./FullScreenSuccessAnimationSimple').default 
    : require('./FullScreenSuccessAnimation').default,
  
  FullScreenError: isExpoGo() 
    ? require('./FullScreenErrorSimple').default 
    : require('./FullScreenError').default,
};

// Feature flags for animation capabilities
export const AnimationFeatures = {
  canUseReanimated: !isExpoGo(),
  canUseSVGAnimations: !isExpoGo(),
  canUseComplexGestures: !isExpoGo(),
};

export default {
  AnimationComponents,
  AnimationFeatures,
  isExpoGo,
};
