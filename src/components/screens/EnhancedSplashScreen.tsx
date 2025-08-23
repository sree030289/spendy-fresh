import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions, Text } from 'react-native';
// import LottieView from 'lottie-react-native';

const { width, height } = Dimensions.get('window');

interface EnhancedSplashScreenProps {
  onAnimationComplete: () => void;
}

const EnhancedSplashScreen: React.FC<EnhancedSplashScreenProps> = ({ onAnimationComplete }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const sMovementAnim = useRef(new Animated.Value(0)).current;
  const titleOpacityAnim = useRef(new Animated.Value(0)).current;
  
  // Circle animation values
  const circle1ScaleAnim = useRef(new Animated.Value(0)).current;
  const circle2ScaleAnim = useRef(new Animated.Value(0)).current;
  const circle3ScaleAnim = useRef(new Animated.Value(0)).current;
  const circle1OpacityAnim = useRef(new Animated.Value(0)).current;
  const circle2OpacityAnim = useRef(new Animated.Value(0)).current;
  const circle3OpacityAnim = useRef(new Animated.Value(0)).current;
  
  // Custom loading animation values
  const loadingAnim1 = useRef(new Animated.Value(0)).current;
  const loadingAnim2 = useRef(new Animated.Value(0)).current;
  const loadingAnim3 = useRef(new Animated.Value(0)).current;
  const loadingAnim4 = useRef(new Animated.Value(0)).current;
  
  // const lottieRef = useRef<LottieView>(null);
  
  const [currentPhase, setCurrentPhase] = useState(1);
  const [showLottie, setShowLottie] = useState(false);
  const [showTitle, setShowTitle] = useState(false);

  useEffect(() => {
    startAnimation();
  }, []);

  const startCustomLoadingAnimation = () => {
    // Reset all animations first
    loadingAnim1.setValue(0);
    loadingAnim2.setValue(0);
    loadingAnim3.setValue(0);
    loadingAnim4.setValue(0);
    
    // Create the exact circular movement pattern from your Lottie file
    const animationDuration = 1000; // 1 second like the original
    
    const createRectangleAnimation = (animValue: Animated.Value, delay: number = 0) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: animationDuration,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start all rectangles with no delay - they'll move in their circular patterns
    Animated.parallel([
      createRectangleAnimation(loadingAnim1, 0),
      createRectangleAnimation(loadingAnim2, 0), 
      createRectangleAnimation(loadingAnim3, 0),
      createRectangleAnimation(loadingAnim4, 0),
    ]).start();
  };

  const startAnimation = () => {
    // Phase 1: Red background with white "S" (1 second)
    setTimeout(() => {
      // Phase 2: "S" moves up and transforms into title, Lottie animation starts
      setCurrentPhase(2);
      setShowLottie(true);
      
      // Start custom loading animation (mimics your Lottie animation)
      startCustomLoadingAnimation();
      
      // Move "S" upward and fade it out while bringing in title
      Animated.parallel([
        Animated.timing(sMovementAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        // Fade out S and fade in title simultaneously
        Animated.sequence([
          Animated.delay(400), // Wait halfway through S movement
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 0, // Fade out S
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(titleOpacityAnim, {
              toValue: 1, // Fade in title
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();

      // Show title immediately when S starts moving
      setTimeout(() => {
        setShowTitle(true);
      }, 400);
      
      // Phase 3: Complete animation after Lottie finishes (3.5 seconds after Phase 2 starts)
      setTimeout(() => {
        setCurrentPhase(3);
        
        // Complete animation with final fade out
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }).start(() => {
            onAnimationComplete();
          });
        }, 1000);
      }, 3500);
    }, 1000);
  };

  const getBackgroundColor = () => {
    return currentPhase === 1 ? '#D6001C' : '#FFFFFF';
  };

  const getSTextColor = () => {
    return currentPhase === 1 ? '#FFFFFF' : '#D6001C';
  };

  const sUpwardMovement = sMovementAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -height * 0.25], // Move S to top title position
  });

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      <Animated.View style={[styles.fullContainer, { opacity: currentPhase === 3 ? fadeAnim : 1 }]}>
        
        {/* Custom Loading Animation - Exactly replicating your Lottie animation */}
        {showLottie && (
          <View style={styles.customLoadingAnimation}>
            {/* Rectangle 1: Moves from center-top → right → center-bottom */}
            <Animated.View
              style={[
                styles.loadingRect,
                {
                  transform: [
                    { rotate: '45deg' },
                    {
                      translateX: loadingAnim1.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 60, 0], // center → right → center
                      }),
                    },
                    {
                      translateY: loadingAnim1.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [-60, 0, 60], // top → center → bottom
                      }),
                    },
                  ],
                },
              ]}
            />
            
            {/* Rectangle 2: Moves from right → center-bottom → left */}
            <Animated.View
              style={[
                styles.loadingRect,
                {
                  transform: [
                    { rotate: '45deg' },
                    {
                      translateX: loadingAnim2.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [60, 0, -60], // right → center → left
                      }),
                    },
                    {
                      translateY: loadingAnim2.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 60, 0], // center → bottom → center
                      }),
                    },
                  ],
                },
              ]}
            />
            
            {/* Rectangle 3: Moves from center-bottom → left → center-top */}
            <Animated.View
              style={[
                styles.loadingRect,
                {
                  transform: [
                    { rotate: '45deg' },
                    {
                      translateX: loadingAnim3.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, -60, 0], // center → left → center
                      }),
                    },
                    {
                      translateY: loadingAnim3.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [60, 0, -60], // bottom → center → top
                      }),
                    },
                  ],
                },
              ]}
            />
            
            {/* Rectangle 4: Moves from left → center-top → right */}
            <Animated.View
              style={[
                styles.loadingRect,
                {
                  transform: [
                    { rotate: '45deg' },
                    {
                      translateX: loadingAnim4.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [-60, 0, 60], // left → center → right
                      }),
                    },
                    {
                      translateY: loadingAnim4.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, -60, 0], // center → top → center
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        )}
        
        {/* Main "S" Logo - fades out as it moves up */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [
                { scale: scaleAnim },
                { translateY: sUpwardMovement },
              ],
              opacity: currentPhase === 1 ? 1 : 0, // Only visible in phase 1
            },
          ]}
        >
          <Text
            style={[
              styles.logoText,
              {
                color: getSTextColor(),
                textShadowColor: currentPhase > 1 ? 'rgba(214,0,28,0.3)' : 'transparent',
                textShadowOffset: currentPhase > 1 ? { width: 2, height: 2 } : { width: 0, height: 0 },
                textShadowRadius: currentPhase > 1 ? 4 : 0,
              },
            ]}
          >
            S
          </Text>
        </Animated.View>
        
        {/* App title that appears at the top replacing the S */}
        {showTitle && (
          <Animated.View
            style={[
              styles.titleContainer,
              {
                opacity: titleOpacityAnim,
              },
            ]}
          >
            <Text style={styles.appName}>Spendy</Text>
            <Text style={styles.tagline}>Smart Bill Splitting</Text>
          </Animated.View>
        )}
        
        {/* Phase indicator dots */}
        <View style={styles.phaseIndicator}>
          {[1, 2, 3].map((phase) => (
            <View
              key={phase}
              style={[
                styles.phaseDot,
                {
                  backgroundColor: currentPhase >= phase ? 
                    (currentPhase === 1 ? '#FFFFFF' : '#D6001C') : 
                    (currentPhase === 1 ? 'rgba(255,255,255,0.3)' : 'rgba(214,0,28,0.3)'),
                  opacity: 0.8,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  lottieAnimation: {
    position: 'absolute',
    width: width * 0.8,
    height: height * 0.6,
    top: height * 0.3, // Position below the title
    left: width * 0.1,
    opacity: 0.9,
  },
  customLoadingAnimation: {
    position: 'absolute',
    width: 200,
    height: 200,
    top: height * 0.4, // Position below the title
    left: (width - 200) / 2, // Center horizontally
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingRect: {
    position: 'absolute',
    width: 57, // Exact size from your Lottie file (114px / 2)
    height: 57,
    backgroundColor: '#D6001C',
    borderRadius: 8,
    top: '50%',
    left: '50%',
    marginTop: -28.5, // Half of height to center
    marginLeft: -28.5, // Half of width to center
  },
  simpleAnimation: {
    position: 'absolute',
    width: width * 1.2,
    height: height * 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.3,
  },
  animatedCircle: {
    position: 'absolute',
    backgroundColor: '#D6001C',
    borderRadius: 50,
  },
  circle1: {
    width: 100,
    height: 100,
    top: '30%',
    left: '20%',
  },
  circle2: {
    width: 80,
    height: 80,
    top: '60%',
    right: '25%',
  },
  circle3: {
    width: 60,
    height: 60,
    bottom: '40%',
    left: '30%',
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
  titleContainer: {
    position: 'absolute',
    top: '15%', // Position at the top where S moves to
    alignItems: 'center',
    zIndex: 10,
    width: '100%',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#D6001C',
    marginBottom: 8,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    letterSpacing: 0.5,
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

export default EnhancedSplashScreen;
