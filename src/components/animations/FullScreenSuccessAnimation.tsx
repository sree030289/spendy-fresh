import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface FullScreenSuccessAnimationProps {
  visible: boolean;
  title?: string;
  message?: string;
  subtitle?: string;
  buttonText?: string;
  onContinue: () => void;
  autoHide?: boolean;
  autoHideDelay?: number;
  showButton?: boolean;
}

const FullScreenSuccessAnimation: React.FC<FullScreenSuccessAnimationProps> = ({
  visible,
  title = 'Done!',
  message = 'Created Successfully',
  subtitle = 'Your action completed successfully',
  buttonText = 'Continue',
  onContinue,
  autoHide = false,
  autoHideDelay = 3000,
  showButton = true,
}) => {
  const [isVisible, setIsVisible] = useState(visible);

  // Animation values
  const circleScale = useSharedValue(0);
  const checkmarkProgress = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const messageOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const pulseScale1 = useSharedValue(1);
  const pulseScale2 = useSharedValue(1);
  const pulseOpacity1 = useSharedValue(0);
  const pulseOpacity2 = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      startAnimation();

      // Auto hide if enabled
      if (autoHide) {
        const timer = setTimeout(() => {
          hideAnimation();
        }, autoHideDelay);
        return () => clearTimeout(timer);
      }
    } else {
      hideAnimation();
    }
  }, [visible]);

  const startAnimation = () => {
    // Overlay fade in
    overlayOpacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });

    // Circle grow animation
    circleScale.value = withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });

    // Checkmark draw animation
    checkmarkProgress.value = withDelay(
      400,
      withTiming(1, {
        duration: 1000,
        easing: Easing.out(Easing.cubic),
      })
    );

    // Text animations
    titleOpacity.value = withDelay(
      1000,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );

    messageOpacity.value = withDelay(
      1300,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );

    subtitleOpacity.value = withDelay(
      1600,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );

    if (showButton) {
      buttonOpacity.value = withDelay(
        2000,
        withTiming(1, {
          duration: 800,
          easing: Easing.out(Easing.cubic),
        })
      );
    }

    // Pulse animations
    startPulseAnimations();
  };

  const hideAnimation = () => {
    overlayOpacity.value = withTiming(0, {
      duration: 300,
      easing: Easing.in(Easing.cubic),
    }, () => {
      runOnJS(() => setIsVisible(false))();
    });
  };

  const startPulseAnimations = () => {
    const createPulseAnimation = (scale: Animated.SharedValue<number>, opacity: Animated.SharedValue<number>, delay: number) => {
      const animate = () => {
        scale.value = withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(1.4, { duration: 2500, easing: Easing.out(Easing.cubic) })
        );
        opacity.value = withSequence(
          withTiming(0.6, { duration: 0 }),
          withTiming(0, { duration: 2500, easing: Easing.out(Easing.cubic) })
        );
      };

      setTimeout(() => {
        animate();
        const interval = setInterval(animate, 2500);
        setTimeout(() => clearInterval(interval), 10000); // Stop after 10 seconds
      }, delay);
    };

    createPulseAnimation(pulseScale1, pulseOpacity1, 1200);
    createPulseAnimation(pulseScale2, pulseOpacity2, 1600);
  };

  // Animated styles
  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const circleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
    opacity: interpolate(circleScale.value, [0, 0.6, 1], [0, 1, 1]),
  }));

  const checkmarkAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(checkmarkProgress.value, [0, 0.2, 1], [0, 1, 1]),
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: interpolate(titleOpacity.value, [0, 1], [30, 0]) }],
  }));

  const messageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
    transform: [{ translateY: interpolate(messageOpacity.value, [0, 1], [30, 0]) }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: interpolate(subtitleOpacity.value, [0, 1], [30, 0]) }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: interpolate(buttonOpacity.value, [0, 1], [30, 0]) }],
  }));

  const pulse1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale1.value }],
    opacity: pulseOpacity1.value,
  }));

  const pulse2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale2.value }],
    opacity: pulseOpacity2.value,
  }));

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.container, overlayAnimatedStyle]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
      
      {/* Modern White Background with subtle pattern */}
      <View style={styles.background}>
        {/* Decorative circles */}
        <View style={[styles.decorativeCircle, styles.circle1]} />
        <View style={[styles.decorativeCircle, styles.circle2]} />
        <View style={[styles.decorativeCircle, styles.circle3]} />
      </View>

      {/* Floating Confetti/Particles */}
      <View style={[styles.confetti, styles.confetti1]} />
      <View style={[styles.confetti, styles.confetti2]} />
      <View style={[styles.confetti, styles.confetti3]} />
      <View style={[styles.confetti, styles.confetti4]} />
      <View style={[styles.confetti, styles.confetti5]} />
      <View style={[styles.confetti, styles.confetti6]} />

      <View style={styles.contentContainer}>
        {/* Pulse Rings */}
        <Animated.View style={[styles.pulseRing1, pulse1AnimatedStyle]} />
        <Animated.View style={[styles.pulseRing2, pulse2AnimatedStyle]} />

        {/* Success Circle with gradient */}
        <Animated.View style={[styles.successCircle, circleAnimatedStyle]}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.circleGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Animated.View style={[styles.checkmark, checkmarkAnimatedStyle]}>
              <Svg width={90} height={90} viewBox="0 0 100 100">
                <Path
                  d="M15 50 L35 70 L85 25"
                  stroke="#FFFFFF"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray={200}
                  strokeDashoffset={interpolate(checkmarkProgress.value, [0, 1], [200, 0])}
                />
              </Svg>
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* Text Content */}
        <Animated.Text style={[styles.successTitle, titleAnimatedStyle]}>
          {title}
        </Animated.Text>
        
        <Animated.Text style={[styles.successMessage, messageAnimatedStyle]}>
          {message}
        </Animated.Text>
        
        {subtitle && (
          <Animated.Text style={[styles.successSubtitle, subtitleAnimatedStyle]}>
            {subtitle}
          </Animated.Text>
        )}
      </View>

      {/* Continue Button */}
      {showButton && (
        <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={onContinue}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#B0004F', '#D91A72']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>{buttonText}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.05,
  },
  circle1: {
    width: 500,
    height: 500,
    backgroundColor: '#10B981',
    top: -250,
    right: -200,
  },
  circle2: {
    width: 400,
    height: 400,
    backgroundColor: '#B0004F',
    bottom: -200,
    left: -150,
  },
  circle3: {
    width: 300,
    height: 300,
    backgroundColor: '#3B82F6',
    top: '30%',
    left: -100,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    flex: 1,
  },
  successCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    marginBottom: 50,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
  },
  circleGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 110,
    top: '50%',
    left: '50%',
    marginTop: -110,
    marginLeft: -110,
  },
  pulseRing2: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 130,
    top: '50%',
    left: '50%',
    marginTop: -130,
    marginLeft: -130,
  },
  successTitle: {
    color: '#1F2937',
    fontSize: 42,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  successMessage: {
    color: '#4B5563',
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 8,
  },
  successSubtitle: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 60,
    left: 40,
    right: 40,
  },
  continueButton: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#B0004F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  confetti: {
    position: 'absolute',
    borderRadius: 2,
  },
  confetti1: {
    width: 10,
    height: 10,
    backgroundColor: '#10B981',
    left: '15%',
    top: '25%',
    transform: [{ rotate: '45deg' }],
  },
  confetti2: {
    width: 8,
    height: 8,
    backgroundColor: '#B0004F',
    right: '20%',
    top: '20%',
    borderRadius: 4,
  },
  confetti3: {
    width: 12,
    height: 12,
    backgroundColor: '#3B82F6',
    left: '65%',
    top: '18%',
    transform: [{ rotate: '30deg' }],
  },
  confetti4: {
    width: 8,
    height: 8,
    backgroundColor: '#F59E0B',
    left: '25%',
    bottom: '28%',
    borderRadius: 4,
  },
  confetti5: {
    width: 10,
    height: 10,
    backgroundColor: '#8B5CF6',
    right: '25%',
    bottom: '30%',
    transform: [{ rotate: '60deg' }],
  },
  confetti6: {
    width: 6,
    height: 6,
    backgroundColor: '#EC4899',
    right: '40%',
    top: '35%',
    borderRadius: 3,
  },
});

export default FullScreenSuccessAnimation;
