// src/components/modals/SuccessAnimationModal.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SuccessAnimationModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  onButtonPress?: () => void;
  type?: 'success' | 'error' | 'warning';
  autoClose?: boolean;
  duration?: number;
}

export default function SuccessAnimationModal({
  visible,
  onClose,
  title,
  message,
  buttonText = 'Continue',
  onButtonPress,
  type = 'success',
  autoClose = false,
  duration = 2000,
}: SuccessAnimationModalProps) {
  const { theme } = useTheme();
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;
  const contentSlideAnim = useRef(new Animated.Value(50)).current;

  const getIconName = () => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'close-circle';
      case 'warning': return 'warning';
      default: return 'checkmark-circle';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success': return '#10B981';
      case 'error': return '#EF4444';
      case 'warning': return '#F59E0B';
      default: return '#10B981';
    }
  };

  const getGradientColors = () => {
    switch (type) {
      case 'success': return ['#10B981', '#059669'];
      case 'error': return ['#EF4444', '#DC2626'];
      case 'warning': return ['#F59E0B', '#D97706'];
      default: return ['#10B981', '#059669'];
    }
  };

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      iconScaleAnim.setValue(0);
      contentSlideAnim.setValue(50);

      // Start entrance animation
      Animated.parallel([
        // Background fade in
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Modal scale in
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Then animate icon and content
        Animated.sequence([
          // Icon animation
          Animated.spring(iconScaleAnim, {
            toValue: 1,
            tension: 50,
            friction: 4,
            useNativeDriver: true,
          }),
          // Content slide up
          Animated.spring(contentSlideAnim, {
            toValue: 0,
            tension: 80,
            friction: 6,
            useNativeDriver: true,
          }),
        ]).start();

        // Auto close if enabled
        if (autoClose) {
          setTimeout(() => {
            handleClose();
          }, duration);
        }
      });
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleButtonPress = () => {
    if (onButtonPress) {
      onButtonPress();
    } else {
      handleClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: opacityAnim,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={[styles.modal, { backgroundColor: theme.colors.background }]}>
            {/* Icon Container */}
            <View style={styles.iconContainer}>
              <Animated.View
                style={[
                  styles.iconBackground,
                  {
                    backgroundColor: getIconColor() + '20',
                    transform: [{ scale: iconScaleAnim }],
                  },
                ]}
              >
                <Ionicons
                  name={getIconName() as any}
                  size={60}
                  color={getIconColor()}
                />
              </Animated.View>
            </View>

            {/* Content */}
            <Animated.View
              style={[
                styles.content,
                {
                  transform: [{ translateY: contentSlideAnim }],
                },
              ]}
            >
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {title}
              </Text>
              <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
                {message}
              </Text>

              {/* Button */}
              {!autoClose && (
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleButtonPress}
                >
                  <LinearGradient
                    colors={getGradientColors()}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.buttonText}>{buttonText}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: screenWidth * 0.85,
    maxWidth: 400,
  },
  modal: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 25,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  button: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});