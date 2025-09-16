import React, { useEffect } from 'react';
import {
  View,
  Text,
  Dimensions,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Extrapolate,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SplashScreenProps {
  onAnimationComplete?: () => void;
}

const MeetNSplitSplash: React.FC<SplashScreenProps> = ({ onAnimationComplete }) => {
  // Animation values
  const animationProgress = useSharedValue(0);
  const titlePosition = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const backgroundProgress = useSharedValue(0);
  const diamondSplit = useSharedValue(0);
  const featureTagsOpacity = useSharedValue(0);

  // Start animation sequence
  useEffect(() => {
    const startAnimation = () => {
      // Reset all values
      animationProgress.value = 0;
      titlePosition.value = 0;
      logoOpacity.value = 0;
      backgroundProgress.value = 0;
      diamondSplit.value = 0;
      featureTagsOpacity.value = 0;

      // Sequence: 3-second animation
      
      // 1. Background change (0-1.2s): Pink to White
      backgroundProgress.value = withTiming(1, { duration: 1200 });
      
      // 2. Title movement (0.9-1.35s): Center to Top
      titlePosition.value = withDelay(900, withTiming(1, { duration: 450 }));
      
      // 3. Logo appears (1.35s)
      logoOpacity.value = withDelay(1350, withTiming(1, { duration: 150 }));
      
      // 4. Diamond split animation (1.5-2.4s)
      diamondSplit.value = withDelay(1500, withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(0, { duration: 300 }),
        withTiming(1, { duration: 300 })
      ));
      
      // 5. Feature tags (2.1-3.0s)
      featureTagsOpacity.value = withDelay(2100, withTiming(1, { duration: 900 }));
      
      // Complete animation
      animationProgress.value = withTiming(1, { duration: 3000 }, (finished) => {
        if (finished && onAnimationComplete) {
          runOnJS(onAnimationComplete)();
        }
      });
    };

    startAnimation();

    // Auto-restart for demo (remove in production)
    const interval = setInterval(startAnimation, 4000);
    return () => clearInterval(interval);
  }, []);

  // Animated styles
  const backgroundStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolate(
      backgroundProgress.value,
      [0, 0.3, 1],
      [0, 0, 1],
      Extrapolate.CLAMP
    );
    
    return {
      backgroundColor: backgroundColor === 0 ? '#B0004F' : '#FFFFFF',
    };
  });

  const titleStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      titlePosition.value,
      [0, 1],
      [0, -screenHeight * 0.25],
      Extrapolate.CLAMP
    );
    
    const scale = interpolate(
      titlePosition.value,
      [0, 1],
      [1, 0.6],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateY },
        { scale }
      ],
    };
  });

  const logoStyle = useAnimatedStyle(() => {
    return {
      opacity: logoOpacity.value,
    };
  });

  const diamondStyle = useAnimatedStyle(() => {
    const splitOffset = interpolate(
      diamondSplit.value,
      [0, 1],
      [0, 15],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: splitOffset },
        { translateY: splitOffset },
      ],
    };
  });

  const featureTagsStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      featureTagsOpacity.value,
      [0, 1],
      [20, 0],
      Extrapolate.CLAMP
    );

    return {
      opacity: featureTagsOpacity.value,
      transform: [{ translateY }],
    };
  });

  // Diamond SVG Component
  const DiamondShape = ({ color, style }: { color: string; style?: any }) => (
    <Animated.View style={[styles.diamond, style]}>
      <Svg width="50" height="50" viewBox="0 0 50 50">
        <Path
          d="M25 5 L45 25 L25 45 L5 25 Z"
          fill={color}
        />
      </Svg>
    </Animated.View>
  );

  return (
    <Animated.View style={[styles.container, backgroundStyle]}>
      {/* Main Title */}
      <Animated.View style={[styles.titleContainer, titleStyle]}>
        <Text style={styles.titleText}>
          <Text style={styles.meetN}>Meet n </Text>
          <Text style={styles.split}>Spli</Text>
          <Text style={styles.t}>t</Text>
        </Text>
      </Animated.View>

      {/* Diamond Logo */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <View style={styles.diamondCross}>
          {/* Top Diamond - Orange */}
          <DiamondShape 
            color="#FF6B35" 
            style={[styles.diamondTop, diamondStyle]} 
          />
          
          {/* Right Diamond - Gray */}
          <DiamondShape 
            color="#4A4A4A" 
            style={[styles.diamondRight, diamondStyle]} 
          />
          
          {/* Bottom Diamond - Dark */}
          <DiamondShape 
            color="#2C2C2C" 
            style={[styles.diamondBottom, diamondStyle]} 
          />
          
          {/* Left Diamond - Pink */}
          <DiamondShape 
            color="#B8336A" 
            style={[styles.diamondLeft, diamondStyle]} 
          />
        </View>
      </Animated.View>

      {/* Feature Tags */}
      <Animated.View style={[styles.featureTagsContainer, featureTagsStyle]}>
        <Text style={styles.featureTag}>Meet</Text>
        <Text style={styles.featureDot}>•</Text>
        <Text style={styles.featureTag}>Spend</Text>
        <Text style={styles.featureDot}>•</Text>
        <Text style={styles.featureTag}>Split</Text>
        <Text style={styles.featureDot}>•</Text>
        <Text style={styles.featureTag}>Track</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#B0004F',
  },
  titleContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 38,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  meetN: {
    color: '#000000',
  },
  split: {
    color: '#E53E3E',
  },
  t: {
    color: '#000000',
  },
  logoContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondCross: {
    width: 120,
    height: 120,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamond: {
    position: 'absolute',
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondTop: {
    top: 0,
    left: 35,
  },
  diamondRight: {
    top: 35,
    right: 0,
  },
  diamondBottom: {
    bottom: 0,
    left: 35,
  },
  diamondLeft: {
    top: 35,
    left: 0,
  },
  featureTagsContainer: {
    position: 'absolute',
    bottom: screenHeight * 0.15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  featureTag: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333333',
  },
  featureDot: {
    fontSize: 12,
    color: '#666666',
  },
});

export default MeetNSplitSplash;