import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface CircularLoaderProps {
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

const CircularLoader: React.FC<CircularLoaderProps> = ({ 
  size = 60, 
  primaryColor = '#3bf6ceff', 
  secondaryColor = '#f65cb8ff' 
}) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    spinAnimation.start();
    pulseAnimation.start();

    return () => {
      spinAnimation.stop();
      pulseAnimation.stop();
    };
  }, [spinValue, pulseValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const innerSize = size * 0.73; // 44/60 ratio
  const outerBorderWidth = size * 0.067; // 4/60 ratio
  const innerBorderWidth = size * 0.067;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.outerRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: outerBorderWidth,
            borderColor: primaryColor,
            borderTopColor: 'transparent',
            transform: [{ rotate: spin }, { scale: pulseValue }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.innerRing,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            borderWidth: innerBorderWidth,
            borderColor: secondaryColor,
            borderBottomColor: 'transparent',
            transform: [{ rotate: spin }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerRing: {
    position: 'absolute',
  },
  innerRing: {
    position: 'absolute',
  },
});

export default CircularLoader;
