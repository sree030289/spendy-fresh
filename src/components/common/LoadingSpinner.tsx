import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  showText = true,
  message = 'Loading'
}) => {
  const { theme } = useTheme();
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  
  // Animation references
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dotAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ]).current;

  const colors = [
    '#3B82F6', // blue
    '#A855F7', // purple
    '#22C55E', // green
    '#EC4899', // pink
    '#F97316', // orange
    '#EF4444', // red
    '#EAB308', // yellow
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#06B6D4', // cyan
  ];

  const currentColor = colors[currentColorIndex];

  const sizeConfig = {
    small: { spinner: 32, inner: 20, center: 6, text: 14 },
    medium: { spinner: 48, inner: 32, center: 8, text: 16 },
    large: { spinner: 64, inner: 48, center: 12, text: 18 }
  };

  const config = sizeConfig[size];

  useEffect(() => {
    // Color changing effect
    const colorInterval = setInterval(() => {
      setCurrentColorIndex((prev) => (prev + 1) % colors.length);
    }, 1000);

    // Spinning animation
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );

    // Pulse animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );

    // Progress bar animation
    const progressLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    // Bouncing dots animation
    const createDotAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -10,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const dotAnimationLoops = dotAnimations.map((anim, index) => 
      createDotAnimation(anim, index * 150)
    );

    // Start all animations
    spinLoop.start();
    pulseLoop.start();
    progressLoop.start();
    dotAnimationLoops.forEach(loop => loop.start());

    return () => {
      clearInterval(colorInterval);
      spinLoop.stop();
      pulseLoop.stop();
      progressLoop.stop();
      dotAnimationLoops.forEach(loop => loop.stop());
    };
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressTranslate = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-200, 0, 200],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* Main Spinner */}
        <View style={styles.spinnerContainer}>
          {/* Outer rotating ring */}
          <Animated.View
            style={[
              styles.outerRing,
              {
                width: config.spinner,
                height: config.spinner,
                borderRadius: config.spinner / 2,
                borderColor: currentColor,
                transform: [{ rotate: spin }],
              }
            ]}
          />
          
          {/* Inner pulsing ring */}
          <Animated.View
            style={[
              styles.innerRing,
              {
                width: config.inner,
                height: config.inner,
                borderRadius: config.inner / 2,
                transform: [{ scale: pulseAnim }],
              }
            ]}
          />
          
          {/* Center dot */}
          <View
            style={[
              styles.centerDot,
              {
                width: config.center,
                height: config.center,
                borderRadius: config.center / 2,
                backgroundColor: currentColor,
              }
            ]}
          />
        </View>

        {/* Loading text with animated dots */}
        {showText && (
          <View style={styles.textContainer}>
            <Text style={[styles.loadingText, { fontSize: config.text, color: theme.colors.text }]}>
              {message}
              <View style={styles.dotsContainer}>
                {dotAnimations.map((anim, index) => (
                  <Animated.Text
                    key={index}
                    style={[
                      styles.dot,
                      { 
                        transform: [{ translateY: anim }],
                        color: currentColor
                      }
                    ]}
                  >
                    .
                  </Animated.Text>
                ))}
              </View>
            </Text>
          </View>
        )}

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.surface }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: currentColor,
                  transform: [{ translateX: progressTranslate }],
                }
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  spinnerContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  outerRing: {
    borderWidth: 3,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
  },
  innerRing: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'absolute',
  },
  centerDot: {
    position: 'absolute',
  },
  textContainer: {
    marginBottom: 16,
  },
  loadingText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginLeft: 4,
  },
  dot: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 1,
  },
  progressContainer: {
    width: 200,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    width: 50,
    height: '100%',
    borderRadius: 2,
  },
});