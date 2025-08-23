import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import LottieView from 'lottie-react-native';

const { width, height } = Dimensions.get('window');

interface NewAnimatedSplashScreenProps {
  onAnimationComplete: () => void;
}

const NewAnimatedSplashScreen: React.FC<NewAnimatedSplashScreenProps> = ({ onAnimationComplete }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const colorTransitionAnim = useRef(new Animated.Value(0)).current;
  const lottieRef = useRef<LottieView>(null);
  
  const [currentPhase, setCurrentPhase] = useState(1);
  const [showLottie, setShowLottie] = useState(false);

  useEffect(() => {
    startAnimation();
  }, []);

  const startAnimation = () => {
    // Phase 1: Red background with white "S" (1 second)
    setTimeout(() => {
      // Phase 2: Color inversion transition
      setCurrentPhase(2);
      
      Animated.timing(colorTransitionAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }).start(() => {
        // Phase 3: Animated "S" with Lottie (3 seconds)
        setTimeout(() => {
          setCurrentPhase(3);
          setShowLottie(true);
          
          // Start Lottie animation
          if (lottieRef.current) {
            lottieRef.current.play();
          }
          
          // Animate the "S" with rotation and scale
          Animated.parallel([
            Animated.loop(
              Animated.sequence([
                Animated.timing(rotateAnim, {
                  toValue: 1,
                  duration: 1000,
                  useNativeDriver: true,
                }),
                Animated.timing(rotateAnim, {
                  toValue: 0,
                  duration: 1000,
                  useNativeDriver: true,
                }),
              ]),
              { iterations: 2 }
            ),
            Animated.sequence([
              Animated.timing(scaleAnim, {
                toValue: 1.2,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 1.1,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
              }),
            ]),
          ]).start();
          
          // Complete animation after 3 seconds
          setTimeout(() => {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }).start(() => {
              onAnimationComplete();
            });
          }, 3000);
        }, 500);
      });
    }, 1000);
  };

  const getBackgroundColor = () => {
    if (currentPhase === 1) {
      return '#D6001C'; // Red background
    } else if (currentPhase === 2) {
      return colorTransitionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#D6001C', '#FFFFFF'],
      });
    } else {
      return '#FFFFFF'; // White background
    }
  };

  const getTextColor = () => {
    if (currentPhase === 1) {
      return '#FFFFFF'; // White text
    } else if (currentPhase === 2) {
      return colorTransitionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#FFFFFF', '#D6001C'],
      });
    } else {
      // Phase 3: Cycle through multiple colors
      return rotateAnim.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: ['#D6001C', '#22C55E', '#000000', '#3B82F6', '#D6001C'],
      });
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: getBackgroundColor(), opacity: fadeAnim }]}>
      {/* Background Lottie Animation */}
      {showLottie && (
        <LottieView
          ref={lottieRef}
          source={require('../../../assets/splash-animation.json')}
          style={styles.lottieBackground}
          autoPlay={false}
          loop={true}
          speed={0.8}
        />
      )}
      
      {/* Main "S" Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [
              { scale: scaleAnim },
              { rotate: currentPhase === 3 ? spin : '0deg' },
            ],
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.logoText,
            {
              color: getTextColor(),
              textShadowColor: currentPhase === 3 ? 'rgba(0,0,0,0.3)' : 'transparent',
              textShadowOffset: currentPhase === 3 ? { width: 2, height: 2 } : { width: 0, height: 0 },
              textShadowRadius: currentPhase === 3 ? 4 : 0,
            },
          ]}
        >
          S
        </Animated.Text>
      </Animated.View>
      
      {/* Phase indicator dots (optional) */}
      <View style={styles.phaseIndicator}>
        {[1, 2, 3].map((phase) => (
          <View
            key={phase}
            style={[
              styles.phaseDot,
              {
                backgroundColor: currentPhase >= phase ? '#FFFFFF' : 'rgba(255,255,255,0.3)',
                opacity: currentPhase === 1 ? 0.8 : 0.6,
              },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  lottieBackground: {
    position: 'absolute',
    width: width * 1.5,
    height: height * 1.5,
    opacity: 0.6,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  logoText: {
    fontSize: 120,
    fontWeight: 'bold',
    fontFamily: 'System',
    letterSpacing: -2,
  },
  phaseIndicator: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    gap: 8,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default NewAnimatedSplashScreen;
