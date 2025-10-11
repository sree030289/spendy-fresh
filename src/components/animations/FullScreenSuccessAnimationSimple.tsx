import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, StatusBar, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

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

const FullScreenSuccessAnimationSimple: React.FC<FullScreenSuccessAnimationProps> = ({
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
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [checkmarkAnim] = useState(new Animated.Value(0));
  const [checkmarkScaleAnim] = useState(new Animated.Value(0));
  const [confettiAnim] = useState(new Animated.Value(0));
  
  // Ribbon burst animations (from center outward, then fall)
  const [ribbon1X] = useState(new Animated.Value(0));
  const [ribbon1Y] = useState(new Animated.Value(0));
  const [ribbon2X] = useState(new Animated.Value(0));
  const [ribbon2Y] = useState(new Animated.Value(0));
  const [ribbon3X] = useState(new Animated.Value(0));
  const [ribbon3Y] = useState(new Animated.Value(0));
  const [ribbon4X] = useState(new Animated.Value(0));
  const [ribbon4Y] = useState(new Animated.Value(0));
  const [ribbon5X] = useState(new Animated.Value(0));
  const [ribbon5Y] = useState(new Animated.Value(0));
  const [ribbon6X] = useState(new Animated.Value(0));
  const [ribbon6Y] = useState(new Animated.Value(0));
  const [ribbon7X] = useState(new Animated.Value(0));
  const [ribbon7Y] = useState(new Animated.Value(0));
  const [ribbon8X] = useState(new Animated.Value(0));
  const [ribbon8Y] = useState(new Animated.Value(0));
  const [ribbon9X] = useState(new Animated.Value(0));
  const [ribbon9Y] = useState(new Animated.Value(0));
  const [ribbon10X] = useState(new Animated.Value(0));
  const [ribbon10Y] = useState(new Animated.Value(0));
  const [ribbon11X] = useState(new Animated.Value(0));
  const [ribbon11Y] = useState(new Animated.Value(0));
  const [ribbon12X] = useState(new Animated.Value(0));
  const [ribbon12Y] = useState(new Animated.Value(0));
  const [ribbon13X] = useState(new Animated.Value(0));
  const [ribbon13Y] = useState(new Animated.Value(0));
  const [ribbon14X] = useState(new Animated.Value(0));
  const [ribbon14Y] = useState(new Animated.Value(0));
  const [ribbon15X] = useState(new Animated.Value(0));
  const [ribbon15Y] = useState(new Animated.Value(0));
  const [ribbon16X] = useState(new Animated.Value(0));
  const [ribbon16Y] = useState(new Animated.Value(0));
  const [ribbon17X] = useState(new Animated.Value(0));
  const [ribbon17Y] = useState(new Animated.Value(0));
  const [ribbon18X] = useState(new Animated.Value(0));
  const [ribbon18Y] = useState(new Animated.Value(0));
  const [ribbon19X] = useState(new Animated.Value(0));
  const [ribbon19Y] = useState(new Animated.Value(0));
  const [ribbon20X] = useState(new Animated.Value(0));
  const [ribbon20Y] = useState(new Animated.Value(0));
  
  const [ribbonOpacity] = useState(new Animated.Value(0));

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
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(checkmarkAnim, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(300),
        Animated.spring(checkmarkScaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(confettiAnim, {
        toValue: 1,
        duration: 1000,
        delay: 200,
        useNativeDriver: true,
      }),
      
      // Ribbon burst animations - explode from center, then fall
      Animated.sequence([
        Animated.delay(600), // Increased delay for better timing
        Animated.parallel([
          Animated.timing(ribbonOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          ...createBurstAnimation(ribbon1X, ribbon1Y, -180, -250),
          ...createBurstAnimation(ribbon2X, ribbon2Y, 0, -280),
          ...createBurstAnimation(ribbon3X, ribbon3Y, 180, -250),
          ...createBurstAnimation(ribbon4X, ribbon4Y, -130, -200),
          ...createBurstAnimation(ribbon5X, ribbon5Y, 130, -200),
          ...createBurstAnimation(ribbon6X, ribbon6Y, -220, -150),
          ...createBurstAnimation(ribbon7X, ribbon7Y, 220, -150),
          ...createBurstAnimation(ribbon8X, ribbon8Y, -160, -230),
          ...createBurstAnimation(ribbon9X, ribbon9Y, 160, -230),
          ...createBurstAnimation(ribbon10X, ribbon10Y, -80, -260),
          ...createBurstAnimation(ribbon11X, ribbon11Y, 80, -260),
          ...createBurstAnimation(ribbon12X, ribbon12Y, 0, -300),
          ...createBurstAnimation(ribbon13X, ribbon13Y, -200, -200),
          ...createBurstAnimation(ribbon14X, ribbon14Y, 200, -200),
          ...createBurstAnimation(ribbon15X, ribbon15Y, -100, -270),
          ...createBurstAnimation(ribbon16X, ribbon16Y, 100, -270),
          ...createBurstAnimation(ribbon17X, ribbon17Y, -240, -100),
          ...createBurstAnimation(ribbon18X, ribbon18Y, 240, -100),
          ...createBurstAnimation(ribbon19X, ribbon19Y, -50, -240),
          ...createBurstAnimation(ribbon20X, ribbon20Y, 50, -240),
        ]),
      ]),
    ]).start();
  };
  
  const createBurstAnimation = (xValue: Animated.Value, yValue: Animated.Value, targetX: number, targetY: number) => {
    return [
      // Burst upward/outward
      Animated.sequence([
        Animated.timing(xValue, {
          toValue: targetX,
          duration: 600, // Increased duration for smoother burst
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(yValue, {
          toValue: targetY,
          duration: 600, // Increased duration
          useNativeDriver: true,
        }),
        // Then fall down
        Animated.timing(yValue, {
          toValue: height,
          duration: 2000, // Slower fall for more dramatic effect
          useNativeDriver: true,
        }),
      ]),
    ];
  };

  const hideAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
    });
  };

  if (!isVisible) return null;

  const checkmarkProgress = checkmarkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });

  const checkmarkScale = checkmarkScaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const confettiOpacity = confettiAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
      
      {/* White Background with decorative circles */}
      <View style={styles.background}>
        <View style={[styles.decorativeCircle, styles.circle1]} />
        <View style={[styles.decorativeCircle, styles.circle2]} />
        <View style={[styles.decorativeCircle, styles.circle3]} />
      </View>

      {/* Colorful Confetti */}
      <Animated.View style={[styles.confetti, styles.confetti1, { opacity: confettiOpacity }]} />
      <Animated.View style={[styles.confetti, styles.confetti2, { opacity: confettiOpacity }]} />
      <Animated.View style={[styles.confetti, styles.confetti3, { opacity: confettiOpacity }]} />
      <Animated.View style={[styles.confetti, styles.confetti4, { opacity: confettiOpacity }]} />
      <Animated.View style={[styles.confetti, styles.confetti5, { opacity: confettiOpacity }]} />
      <Animated.View style={[styles.confetti, styles.confetti6, { opacity: confettiOpacity }]} />
      
      {/* Bursting Sparkle Ribbons - shoot from center, then fall */}
      <Animated.View style={[styles.ribbon, styles.ribbon1, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon1X },
          { translateY: ribbon1Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon2, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon2X },
          { translateY: ribbon2Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon3, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon3X },
          { translateY: ribbon3Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon4, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon4X },
          { translateY: ribbon4Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon5, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon5X },
          { translateY: ribbon5Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon6, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon6X },
          { translateY: ribbon6Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon7, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon7X },
          { translateY: ribbon7Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon8, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon8X },
          { translateY: ribbon8Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon9, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon9X },
          { translateY: ribbon9Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon10, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon10X },
          { translateY: ribbon10Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon11, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon11X },
          { translateY: ribbon11Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon12, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon12X },
          { translateY: ribbon12Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon13, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon13X },
          { translateY: ribbon13Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon14, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon14X },
          { translateY: ribbon14Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon15, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon15X },
          { translateY: ribbon15Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon16, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon16X },
          { translateY: ribbon16Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon17, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon17X },
          { translateY: ribbon17Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon18, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon18X },
          { translateY: ribbon18Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon19, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon19X },
          { translateY: ribbon19Y }
        ] 
      }]} />
      <Animated.View style={[styles.ribbon, styles.ribbon20, { 
        opacity: ribbonOpacity,
        transform: [
          { translateX: ribbon20X },
          { translateY: ribbon20Y }
        ] 
      }]} />

      <Animated.View style={[styles.contentContainer, { transform: [{ scale: scaleAnim }] }]}>
        {/* Success Circle with green gradient and animated checkmark */}
        <View style={styles.successCircle}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.circleGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Animated.View style={{ transform: [{ scale: checkmarkScale }] }}>
              <Svg width={60} height={60} viewBox="0 0 100 100">
                <Path
                  d="M15 50 L35 70 L85 25"
                  stroke="#FFFFFF"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray={200}
                  strokeDashoffset={checkmarkProgress as any}
                />
              </Svg>
            </Animated.View>
          </LinearGradient>
        </View>

        {/* Text Content */}
        <Text style={styles.successTitle}>{title}</Text>
        <Text style={styles.successMessage}>{message}</Text>
        {subtitle && <Text style={styles.successSubtitle}>{subtitle}</Text>}
      </Animated.View>

      {/* Continue Button */}
      {showButton && (
        <View style={styles.buttonContainer}>
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
        </View>
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
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 32,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  circleGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    color: '#1F2937',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  successMessage: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
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
  // Sparkle/Star styles - diamond shapes
  ribbon: {
    position: 'absolute',
    width: 12,
    height: 12,
    left: '50%',
    top: '50%',
    transform: [{ rotate: '45deg' }],
  },
  ribbon1: {
    backgroundColor: '#FFD700',
    width: 10,
    height: 10,
  },
  ribbon2: {
    backgroundColor: '#FF6B9D',
    width: 14,
    height: 14,
  },
  ribbon3: {
    backgroundColor: '#4ECDC4',
    width: 8,
    height: 8,
  },
  ribbon4: {
    backgroundColor: '#FFE66D',
    width: 12,
    height: 12,
  },
  ribbon5: {
    backgroundColor: '#95E1D3',
    width: 10,
    height: 10,
  },
  ribbon6: {
    backgroundColor: '#F38181',
    width: 14,
    height: 14,
  },
  ribbon7: {
    backgroundColor: '#AA96DA',
    width: 9,
    height: 9,
  },
  ribbon8: {
    backgroundColor: '#FCBAD3',
    width: 11,
    height: 11,
  },
  ribbon9: {
    backgroundColor: '#FFD93D',
    width: 13,
    height: 13,
  },
  ribbon10: {
    backgroundColor: '#6BCF7F',
    width: 10,
    height: 10,
  },
  ribbon11: {
    backgroundColor: '#FF8EC9',
    width: 12,
    height: 12,
  },
  ribbon12: {
    backgroundColor: '#A0E7E5',
    width: 15,
    height: 15,
  },
  ribbon13: {
    backgroundColor: '#FFA07A',
    width: 11,
    height: 11,
  },
  ribbon14: {
    backgroundColor: '#98D8C8',
    width: 13,
    height: 13,
  },
  ribbon15: {
    backgroundColor: '#FFB6C1',
    width: 9,
    height: 9,
  },
  ribbon16: {
    backgroundColor: '#87CEEB',
    width: 12,
    height: 12,
  },
  ribbon17: {
    backgroundColor: '#DDA0DD',
    width: 14,
    height: 14,
  },
  ribbon18: {
    backgroundColor: '#F0E68C',
    width: 10,
    height: 10,
  },
  ribbon19: {
    backgroundColor: '#FFB347',
    width: 11,
    height: 11,
  },
  ribbon20: {
    backgroundColor: '#B19CD9',
    width: 13,
    height: 13,
  },
});

export default FullScreenSuccessAnimationSimple;
