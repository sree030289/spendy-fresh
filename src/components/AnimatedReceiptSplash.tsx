import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';
import Svg, { 
  Rect, 
  Text as SvgText, 
  Line, 
  Defs,
  LinearGradient,
  Stop
} from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  onAnimationComplete?: () => void;
}

const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onAnimationComplete }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const splitAnim = useRef(new Animated.Value(0)).current;
  const tearAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  
  const [splitProgress, setSplitProgress] = useState(0);
  const [tearProgress, setTearProgress] = useState(0);

  useEffect(() => {
    // Add listeners to track animation progress
    const splitListener = splitAnim.addListener(({ value }) => setSplitProgress(value));
    const tearListener = tearAnim.addListener(({ value }) => setTearProgress(value));

    const startAnimation = () => {
      // Sequence of animations with refined timing
      Animated.sequence([
        // 1. Fade in and scale up the S (quicker start)
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 120,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
        
        // 2. Brief pause
        Animated.delay(300),
        
        // 3. Animate the receipt line appearing (faster)
        Animated.timing(splitAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        
        // 4. Animate the tear effect (quicker)
        Animated.timing(tearAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        
        // 5. Hold final state briefly
        Animated.delay(600),
      ]).start(() => {
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      });
    };

    startAnimation();

    // Cleanup listeners
    return () => {
      splitAnim.removeListener(splitListener);
      tearAnim.removeListener(tearListener);
    };
  }, []);

  const iconSize = Math.min(screenWidth, screenHeight) * 0.5;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 1024 1024"
        >
          <Defs>
            <LinearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#E81C3E" />
              <Stop offset="100%" stopColor="#D6001C" />
            </LinearGradient>
          </Defs>
          
          {/* Red background */}
          <Rect
            width="1024"
            height="1024"
            fill="url(#redGradient)"
            rx="120"
            ry="120"
          />
          
          {/* White "S" */}
          <SvgText
            x="512"
            y="450"
            fontSize="650"
            fontWeight="bold"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="Arial"
          >
            S
          </SvgText>
          
          {/* Animated dashed line */}
          <Line
            x1={150 + (1 - splitProgress) * 724}
            y1="676"
            x2={150 + splitProgress * 724}
            y2="676"
            stroke="#000000"
            strokeWidth="4"
            strokeDasharray="15,10"
          />
          
          {/* Animated tear marks */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const x = 150 + (i * 724) / 7;
            const currentTearProgress = Math.max(0, Math.min(1, (tearProgress * 8) - i));
            
            return currentTearProgress > 0 ? (
              <Line
                key={i}
                x1={x}
                y1="696"
                x2={x + (Math.random() - 0.5) * 10}
                y2={696 + currentTearProgress * 20}
                stroke="#000000"
                strokeWidth="8"
                strokeLinecap="round"
              />
            ) : null;
          })}
        </Svg>
      </Animated.View>
      
      {/* App name text */}
      <Animated.Text
        style={[
          styles.appName,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
            ],
          },
        ]}
      >
        Spendy
      </Animated.Text>
      
      <Animated.Text
        style={[
          styles.tagline,
          {
            opacity: splitAnim,
            transform: [
              {
                translateY: splitAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        Split Bills. Share Costs.
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#D6001C',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default AnimatedSplashScreen;
