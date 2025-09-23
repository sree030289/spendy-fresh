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
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#B0004F', '#D91A72']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating Particles */}
      <View style={[styles.particle, styles.particle1]} />
      <View style={[styles.particle, styles.particle2]} />
      <View style={[styles.particle, styles.particle3]} />
      <View style={[styles.particle, styles.particle4]} />
      <View style={[styles.particle, styles.particle5]} />

      <View style={styles.contentContainer}>
        {/* Pulse Rings */}
        <Animated.View style={[styles.pulseRing1, pulse1AnimatedStyle]} />
        <Animated.View style={[styles.pulseRing2, pulse2AnimatedStyle]} />

        {/* Success Circle */}
        <Animated.View style={[styles.successCircle, circleAnimatedStyle]}>
          <Animated.View style={[styles.checkmark, checkmarkAnimatedStyle]}>
            <Svg width={90} height={90} viewBox="0 0 100 100">
              <Path
                d="M15 50 L35 70 L85 25"
                stroke="#4CAF50"
                strokeWidth={8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray={200}
                strokeDashoffset={interpolate(checkmarkProgress.value, [0, 1], [200, 0])}
              />
            </Svg>
          </Animated.View>
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
              colors={['#FFFFFF', '#F3F4F6']}
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
    borderWidth: 6,
    borderColor: '#4CAF50',
    borderRadius: 90,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    marginBottom: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
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
    borderColor: 'rgba(76, 175, 80, 0.4)',
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
    borderColor: 'rgba(76, 175, 80, 0.4)',
    borderRadius: 130,
    top: '50%',
    left: '50%',
    marginTop: -130,
    marginLeft: -130,
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 20,
  },
  successMessage: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 20,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 10,
  },
  successSubtitle: {
    color: 'rgba(76, 175, 80, 0.9)',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 15,
    textAlign: 'center',
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
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#B0004F',
    fontSize: 18,
    fontWeight: '600',
  },
  particle: {
    position: 'absolute',
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  particle1: {
    width: 6,
    height: 6,
    left: '20%',
    top: '30%',
  },
  particle2: {
    width: 4,
    height: 4,
    right: '20%',
    top: '25%',
  },
  particle3: {
    width: 8,
    height: 8,
    left: '60%',
    top: '20%',
  },
  particle4: {
    width: 5,
    height: 5,
    left: '30%',
    bottom: '30%',
  },
  particle5: {
    width: 7,
    height: 7,
    right: '30%',
    bottom: '25%',
  },
});

export default FullScreenSuccessAnimation;
