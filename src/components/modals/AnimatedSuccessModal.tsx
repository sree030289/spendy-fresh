// src/components/modals/AnimatedSuccessModal.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface AnimatedSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number; // Auto-close duration in milliseconds
}

export default function AnimatedSuccessModal({
  visible,
  onClose,
  title,
  message,
  type = 'success',
  duration = 2000,
}: AnimatedSuccessModalProps) {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      checkAnim.setValue(0);

      // Entrance animation
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]),
        // Animate the check mark
        Animated.timing(checkAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-close timer
      const timer = setTimeout(() => {
        // Exit animation
        Animated.parallel([
          Animated.timing(opacityAnim, {
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
          onClose();
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  const getIconConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle',
          colors: ['#10B981', '#059669'],
          iconColor: '#fff',
        };
      case 'error':
        return {
          icon: 'close-circle',
          colors: ['#EF4444', '#DC2626'],
          iconColor: '#fff',
        };
      case 'warning':
        return {
          icon: 'warning',
          colors: ['#F59E0B', '#D97706'],
          iconColor: '#fff',
        };
      case 'info':
        return {
          icon: 'information-circle',
          colors: ['#3B82F6', '#2563EB'],
          iconColor: '#fff',
        };
      default:
        return {
          icon: 'checkmark-circle',
          colors: ['#10B981', '#059669'],
          iconColor: '#fff',
        };
    }
  };

  const iconConfig = getIconConfig();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: opacityAnim,
          }
        ]}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.surface,
              transform: [
                { scale: scaleAnim }
              ],
            },
          ]}
        >
          {/* Icon Circle */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={iconConfig.colors}
              style={styles.iconCircle}
            >
              <Animated.View
                style={{
                  transform: [
                    {
                      scale: checkAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 1.2, 1],
                      }),
                    },
                  ],
                }}
              >
                <Ionicons 
                  name={iconConfig.icon as any} 
                  size={48} 
                  color={iconConfig.iconColor} 
                />
              </Animated.View>
            </LinearGradient>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {title}
            </Text>
            <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
              {message}
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: iconConfig.colors[0],
                  width: opacityAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: screenWidth * 0.8,
    maxWidth: 320,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  progressBar: {
    width: '100%',
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
});