import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Icon } from '../common/Icon';

interface MoneyFlowAnimationProps {
  color: string;
  direction: 'up' | 'down' | 'circular';
}

export default function MoneyFlowAnimation({ color, direction }: MoneyFlowAnimationProps) {
  const coin1Anim = useRef(new Animated.Value(0)).current;
  const coin2Anim = useRef(new Animated.Value(0)).current;
  const coin3Anim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createCoinAnimation = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );

    // Start animations
    Animated.parallel([
      createCoinAnimation(coin1Anim, 0),
      createCoinAnimation(coin2Anim, 500),
      createCoinAnimation(coin3Anim, 1000),
      rotateAnimation,
    ]).start();
  }, [coin1Anim, coin2Anim, coin3Anim, rotateAnim]);

  const getTranslateY = (animValue: Animated.Value) => {
    switch (direction) {
      case 'up':
        return animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [40, -40],
        });
      case 'down':
        return animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [-40, 40],
        });
      case 'circular':
        return animValue.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, -30, 0],
        });
      default:
        return 0;
    }
  };

  const getTranslateX = (animValue: Animated.Value, offset: number) => {
    if (direction === 'circular') {
      return animValue.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [0, 20 + offset, 0, -20 - offset, 0],
      });
    }
    return 0;
  };

  const getOpacity = (animValue: Animated.Value) => {
    return animValue.interpolate({
      inputRange: [0, 0.2, 0.8, 1],
      outputRange: [0, 1, 1, 0],
    });
  };

  const renderCoin = (animValue: Animated.Value, offset: number = 0) => (
    <Animated.View
      style={[
        styles.coin,
        {
          opacity: getOpacity(animValue),
          transform: [
            { translateY: getTranslateY(animValue) },
            { translateX: getTranslateX(animValue, offset) },
            {
              rotate: rotateAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        },
      ]}
    >
      <Icon name="logo-usd" size={20} color={color} />
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {renderCoin(coin1Anim, 0)}
      {renderCoin(coin2Anim, 10)}
      {renderCoin(coin3Anim, -10)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  coin: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});
