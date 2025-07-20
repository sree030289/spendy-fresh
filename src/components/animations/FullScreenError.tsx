import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, StatusBar, BackHandler, Alert } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface FullScreenErrorProps {
  visible: boolean;
  title?: string;
  message?: string;
  subtitle?: string;
  errorCode?: string;
  buttonText?: string;
  onRestart: () => void;
  preventBack?: boolean;
}

const FullScreenError: React.FC<FullScreenErrorProps> = ({
  visible,
  title = "Oops! Something went wrong",
  message = "We're sorry, but the app encountered an unexpected error.",
  subtitle = "Please close and restart the app to continue.",
  errorCode = "APP_RESTART_001",
  buttonText = "Close & Restart App",
  onRestart,
  preventBack = true,
}) => {
  const [isVisible, setIsVisible] = useState(visible);

  // Animation values
  const iconOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0.8);
  const iconFloat = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const messageOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const codeOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      startErrorAnimation();
    } else {
      hideAnimation();
    }
  }, [visible]);

  useEffect(() => {
    // Prevent back button on Android
    if (preventBack && visible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        showRestartAlert();
        return true; // Prevent default back action
      });
      return () => backHandler.remove();
    }
  }, [preventBack, visible]);

  const showRestartAlert = () => {
    Alert.alert(
      'Restart Required',
      'This app needs to be restarted. Would you like to close it now?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restart', style: 'default', onPress: onRestart },
      ]
    );
  };

  const startErrorAnimation = () => {
    // Overlay fade in
    overlayOpacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });

    // Icon animation
    iconOpacity.value = withDelay(
      200,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );

    iconScale.value = withDelay(
      200,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );

    // Gentle floating animation
    iconFloat.value = withDelay(
      1000,
      withRepeat(
        withTiming(-8, {
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true
      )
    );

    // Text animations
    titleOpacity.value = withDelay(
      600,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );

    messageOpacity.value = withDelay(
      900,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );

    subtitleOpacity.value = withDelay(
      1200,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );

    buttonOpacity.value = withDelay(
      1500,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );

    codeOpacity.value = withDelay(
      1800,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );
  };

  const hideAnimation = () => {
    overlayOpacity.value = withTiming(0, {
      duration: 300,
      easing: Easing.in(Easing.cubic),
    }, () => {
      runOnJS(() => setIsVisible(false))();
    });
  };

  // Animated styles
  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const iconContainerStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [
      { scale: iconScale.value },
      { translateY: iconFloat.value }
    ],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: interpolate(titleOpacity.value, [0, 1], [20, 0]) }],
  }));

  const messageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
    transform: [{ translateY: interpolate(messageOpacity.value, [0, 1], [20, 0]) }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: interpolate(subtitleOpacity.value, [0, 1], [20, 0]) }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: interpolate(buttonOpacity.value, [0, 1], [20, 0]) }],
  }));

  const codeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: codeOpacity.value,
    transform: [{ translateY: interpolate(codeOpacity.value, [0, 1], [20, 0]) }],
  }));

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.container, overlayAnimatedStyle]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.contentContainer}>
        {/* Error Icon */}
        <Animated.View style={[styles.iconContainer, iconContainerStyle]}>
          <Svg width={60} height={60} viewBox="0 0 24 24">
            {/* Sad face */}
            <Circle 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="rgba(255,255,255,0.8)" 
              strokeWidth="2"
              fill="none"
            />
            <Path 
              d="M16 16s-1.5-2-4-2-4 2-4 2" 
              stroke="rgba(255,255,255,0.8)" 
              strokeWidth="2" 
              strokeLinecap="round"
              fill="none"
            />
            <Path 
              d="M9 9h.01" 
              stroke="rgba(255,255,255,0.8)" 
              strokeWidth="2" 
              strokeLinecap="round"
              fill="none"
            />
            <Path 
              d="M15 9h.01" 
              stroke="rgba(255,255,255,0.8)" 
              strokeWidth="2" 
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </Animated.View>

        {/* Error Text */}
        <Animated.Text style={[styles.errorTitle, titleAnimatedStyle]}>
          {title}
        </Animated.Text>
        
        <Animated.Text style={[styles.errorMessage, messageAnimatedStyle]}>
          {message}
        </Animated.Text>
        
        <Animated.Text style={[styles.errorSubtitle, subtitleAnimatedStyle]}>
          {subtitle}
        </Animated.Text>

        {/* Restart Button */}
        <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
          <TouchableOpacity
            style={styles.restartButton}
            onPress={onRestart}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.8)']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" style={styles.buttonIcon}>
                <Path 
                  d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                  stroke="#4a5568"
                  strokeWidth="2"
                  fill="none"
                />
                <Path 
                  d="M3 3v5h5"
                  stroke="#4a5568"
                  strokeWidth="2"
                  fill="none"
                />
              </Svg>
              <Text style={styles.buttonText}>{buttonText}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Error Code */}
      <Animated.View style={[styles.errorCodeContainer, codeAnimatedStyle]}>
        <Text style={styles.errorCodeText}>Error Code: {errorCode}</Text>
      </Animated.View>
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
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  errorTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 27,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    marginBottom: 50,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 280,
  },
  restartButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonIcon: {
    marginRight: 4,
  },
  buttonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '600',
  },
  errorCodeContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  errorCodeText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});

export default FullScreenError;
