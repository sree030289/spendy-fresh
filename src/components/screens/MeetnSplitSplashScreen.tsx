import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';


interface SplashScreenProps {
  onAnimationComplete?: () => void;
}

const MeetNSplitSplash: React.FC<SplashScreenProps> = ({ onAnimationComplete }) => {
  // Animation values
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(20);
  const containerOpacity = useSharedValue(1);

  // Start animation sequence
  useEffect(() => {
    const startAnimation = () => {
      // Phase 1: Logo appears with scale animation (0-800ms)
      logoOpacity.value = withTiming(1, { duration: 300 });
      logoScale.value = withSpring(1, {
        damping: 15,
        stiffness: 100,
      });

      // Phase 2: Title appears (600ms)
      titleOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
      titleTranslateY.value = withDelay(600, withSpring(0, {
        damping: 20,
        stiffness: 150,
      }));

      // Phase 3: Tagline appears (1000ms)
      taglineOpacity.value = withDelay(1000, withTiming(1, { duration: 400 }));
      taglineTranslateY.value = withDelay(1000, withSpring(0, {
        damping: 20,
        stiffness: 150,
      }));

      // Phase 4: Fade out and complete (2500ms)
      containerOpacity.value = withDelay(2500, withTiming(0, { duration: 400 }, (finished) => {
        if (finished && onAnimationComplete) {
          runOnJS(onAnimationComplete)();
        }
      }));
    };

    startAnimation();
  }, []);

  // Animated styles
  const logoStyle = useAnimatedStyle(() => {
    return {
      opacity: logoOpacity.value,
      transform: [{ scale: logoScale.value }],
    };
  });

  const titleStyle = useAnimatedStyle(() => {
    return {
      opacity: titleOpacity.value,
      transform: [{ translateY: titleTranslateY.value }],
    };
  });

  const taglineStyle = useAnimatedStyle(() => {
    return {
      opacity: taglineOpacity.value,
      transform: [{ translateY: taglineTranslateY.value }],
    };
  });

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: containerOpacity.value,
    };
  });

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <LinearGradient
        colors={['#B0004F', '#D91A72']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Logo */}
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>💰</Text>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={[styles.titleContainer, titleStyle]}>
          <Text style={styles.titleText}>Meet n Split</Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View style={[styles.taglineContainer, taglineStyle]}>
          <Text style={styles.taglineText}>Meet • Spend • Split • Track</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 32,
  },
  logoCircle: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoText: {
    fontSize: 48,
  },
  titleContainer: {
    marginBottom: 16,
  },
  titleText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 8,
  },
  taglineContainer: {
    paddingHorizontal: 32,
  },
  taglineText: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    letterSpacing: 1,
  },
});

export default MeetNSplitSplash;