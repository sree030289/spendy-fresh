import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Icon } from '../common/Icon';

interface SplittingAnimationProps {
  totalAmount: number;
  numPeople: number;
  color: string;
}

export default function SplittingAnimation({ totalAmount, numPeople, color }: SplittingAnimationProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const splitAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sequence of animations
    const animationSequence = Animated.sequence([
      // 1. Show the total amount
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),
      
      // 2. Wait a moment
      Animated.delay(800),
      
      // 3. Split animation
      Animated.timing(splitAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      
      // 4. Bounce the individual amounts
      Animated.spring(bounceAnim, {
        toValue: 1,
        tension: 100,
        friction: 3,
        useNativeDriver: true,
      }),
    ]);

    animationSequence.start();

    // Loop the animation
    const interval = setInterval(() => {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.5);
      splitAnim.setValue(0);
      bounceAnim.setValue(0);
      animationSequence.start();
    }, 4000);

    return () => clearInterval(interval);
  }, [fadeAnim, scaleAnim, splitAnim, bounceAnim]);

  const splitAmount = totalAmount / numPeople;

  return (
    <View style={styles.container}>
      {/* Total Amount */}
      <Animated.View
        style={[
          styles.totalContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={[styles.currency, { color }]}>$</Text>
        <Text style={[styles.totalAmount, { color }]}>{totalAmount.toFixed(2)}</Text>
      </Animated.View>

      {/* Arrow Animation */}
      <Animated.View
        style={[
          styles.arrowContainer,
          {
            opacity: splitAnim,
            transform: [
              {
                translateY: splitAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Icon name="arrowDown" size={24} color={color}  />
      </Animated.View>

      {/* Split Amounts */}
      <View style={styles.splitContainer}>
        {Array.from({ length: numPeople }, (_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.splitItem,
              {
                opacity: splitAnim,
                transform: [
                  {
                    translateX: splitAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, (index - (numPeople - 1) / 2) * 60],
                    }),
                  },
                  {
                    scale: bounceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.personIcon, { backgroundColor: color }]}>
              <Icon name="person" size={16} color="white"  />
            </View>
            <Text style={[styles.splitAmount, { color }]}>
              ${splitAmount.toFixed(2)}
            </Text>
          </Animated.View>
        ))}
      </View>

      {/* Equal sign animation */}
      <Animated.View
        style={[
          styles.equalSign,
          {
            opacity: bounceAnim,
            transform: [
              {
                scale: bounceAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={[styles.equalText, { color }]}>Each person pays</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    paddingVertical: 20,
  },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  currency: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  arrowContainer: {
    marginVertical: 10,
  },
  splitContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    height: 60,
  },
  splitItem: {
    alignItems: 'center',
    position: 'absolute',
  },
  personIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  splitAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  equalSign: {
    marginTop: 10,
  },
  equalText: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
});
