// src/components/tour/AppTourNew.tsx - Key fixes for timer and state management

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  StatusBar,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TourStep {
  id: string;
  title: string;
  description: string;
  quote: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  gradient: [string, string];
  animation?: 'fadeIn' | 'slideUp' | 'bounce' | 'scale' | 'typewriter' | 'pulse';
  features?: string[];
  demoType: 'realData' | 'liveAnimation' | 'interactive' | 'screenshot';
  realData?: any;
}

// ... [Keep all the existing tourSteps and sample data] ...
const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Spendy! 💰',
    quote: 'Split. Track. Share. Make Money.',
    description: 'Australia\'s smartest expense sharing app with real-time balances, receipt scanning, and exclusive deals from your favorite brands.',
    icon: 'sparkles-outline',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    animation: 'pulse',
    demoType: 'liveAnimation',
    features: ['Real-time splitting', 'Smart balance tracking', 'Exclusive deals', 'AI-powered insights'],
  },
  {
    id: 'expenses-groups',
    title: 'Smart Expenses & Groups 📱',
    quote: 'Every Receipt Tells a Story.',
    description: 'Snap receipts to automatically split expenses and organize them into groups. Perfect for trips, roommates, and events with smart group management.',
    icon: 'camera-outline',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    animation: 'typewriter',
    demoType: 'realData',
    realData: [],
    features: ['Receipt scanning', 'Smart groups', 'Custom splitting', 'Auto notifications'],
  },
  {
    id: 'personal-tracker',
    title: 'Personal Tracker & Balances 📊',
    quote: 'Know Your Numbers, Control Your Future.',
    description: 'Track personal spending patterns, monitor balances across all groups, and get smart settlement suggestions to minimize transactions.',
    icon: 'analytics-outline',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    animation: 'slideUp',
    demoType: 'interactive',
    realData: [],
    features: ['Personal analytics', 'Real-time balances', 'Smart settlements', 'Quick payments'],
  },
  {
    id: 'ai-deals',
    title: 'AI Analytics & Deals Hub 🤖',
    quote: 'Save Money While You Split.',
    description: 'Get AI-powered spending insights, scan receipts with smart recognition, and discover exclusive deals that help you save money on every purchase.',
    icon: 'storefront-outline',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    animation: 'scale',
    demoType: 'realData',
    realData: [],
    features: ['AI analytics', 'Receipt scanning', 'Deals hub', 'Smart savings'],
  },
];

interface AppTourProps {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const STORAGE_KEY = 'app_tour_completed';

export default function AppTour({ visible, onComplete, onSkip }: AppTourProps) {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(visible);
  
  // FIXED: Use refs for timers to prevent memory leaks and unnecessary re-renders
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const hasCompleted = useRef(false);
  const isAnimating = useRef(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const typewriterAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // FIXED: Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer();
    };
  }, []);

  // FIXED: Handle visibility changes properly
  useEffect(() => {
    setIsVisible(visible);
    if (visible && !hasCompleted.current) {
      startEntranceAnimation();
      startStepAnimation();
      startAutoAdvanceTimer();
    } else if (!visible) {
      clearAutoAdvanceTimer();
    }
  }, [visible]);

  // FIXED: Handle step changes properly
  useEffect(() => {
    if (isVisible && !isAnimating.current) {
      startStepAnimation();
      startAutoAdvanceTimer();
    }
  }, [currentStep, isVisible]);

  // FIXED: Memoized timer functions to prevent unnecessary re-creates
  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
  }, []);

  const startAutoAdvanceTimer = useCallback(() => {
    // Clear existing timer
    clearAutoAdvanceTimer();

    // Don't auto-advance if tour is completed or not visible
    if (hasCompleted.current || !isVisible) {
      return;
    }

    // Set new timer for 4 seconds (give users time to read)
    autoAdvanceTimer.current = setTimeout(() => {
      if (hasCompleted.current) {
        return; // Prevent advancing if already completed
      }

      if (currentStep < tourSteps.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        handleComplete();
      }
    }, 4000); // Increased from 3 to 4 seconds

  }, [currentStep, isVisible]);

  // FIXED: Improved animation handling
  const startEntranceAnimation = useCallback(() => {
    if (isAnimating.current) return;
    
    isAnimating.current = true;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isAnimating.current = false;
    });
  }, []);

  const startStepAnimation = useCallback(() => {
    const step = tourSteps[currentStep];
    if (!step || isAnimating.current) return;

    isAnimating.current = true;

    // Reset animations
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    scaleAnim.setValue(0.9);
    bounceAnim.setValue(0);
    typewriterAnim.setValue(0);

    // Start step-specific animation
    let animation: Animated.CompositeAnimation;

    switch (step.animation) {
      case 'pulse':
        animation = Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
        ]);
        break;
      case 'typewriter':
        animation = Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(typewriterAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        ]);
        break;
      case 'slideUp':
        animation = Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 8, useNativeDriver: true }),
        ]);
        break;
      case 'scale':
        animation = Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 8, useNativeDriver: true }),
        ]);
        break;
      case 'bounce':
        animation = Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(bounceAnim, { toValue: 1, tension: 200, friction: 3, useNativeDriver: true }),
        ]);
        break;
      default:
        animation = Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true });
    }

    animation.start(() => {
      isAnimating.current = false;
    });

    // Update progress
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / tourSteps.length,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  // FIXED: Prevent multiple calls to completion handlers
  const handleNext = useCallback(() => {
    if (hasCompleted.current || isAnimating.current) return;
    
    clearAutoAdvanceTimer();
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep]);

  const handlePrevious = useCallback(() => {
    if (hasCompleted.current || isAnimating.current) return;
    
    clearAutoAdvanceTimer();
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(async () => {
    if (hasCompleted.current) return;
    
    hasCompleted.current = true;
    clearAutoAdvanceTimer();
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      setIsVisible(false);
      onSkip();
    } catch (error) {
      console.error('Error saving tour skip:', error);
      onSkip();
    }
  }, [onSkip]);

  const handleComplete = useCallback(async () => {
    if (hasCompleted.current) return;
    
    hasCompleted.current = true;
    clearAutoAdvanceTimer();
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      setIsVisible(false);
      onComplete();
    } catch (error) {
      console.error('Error saving tour completion:', error);
      onComplete();
    }
  }, [onComplete]);

  // ... [Keep all the existing render methods] ...
  const getCurrentStep = () => tourSteps[currentStep];

  const renderQuote = (quote: string) => (
    <Animated.View style={[styles.quoteContainer, { opacity: fadeAnim }]}>
      <Text style={styles.quote}>"{quote}"</Text>
    </Animated.View>
  );

  const renderProgressIndicators = () => (
    <View style={styles.progressContainer}>
      <View style={styles.indicatorsContainer}>
        {tourSteps.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.indicator,
              {
                backgroundColor: index === currentStep ? '#667eea' : 'rgba(255, 255, 255, 0.3)',
                transform: [{ scale: index === currentStep ? 1.2 : 1 }],
              },
            ]}
            onPress={() => {
              if (!hasCompleted.current && !isAnimating.current) {
                clearAutoAdvanceTimer();
                setCurrentStep(index);
              }
            }}
          />
        ))}
      </View>
      <Text style={styles.progressText}>
        Step {currentStep + 1} of {tourSteps.length}
      </Text>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );

  if (!isVisible) return null;

  const currentStepData = getCurrentStep();

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      presentationStyle="fullScreen"
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip Tour</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.stepContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
              },
            ]}
          >
            {/* Icon */}
            <Animated.View
              style={[
                styles.iconContainer,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <LinearGradient
                colors={currentStepData.gradient}
                style={styles.iconGradient}
              >
                <Ionicons
                  name={currentStepData.icon}
                  size={30}
                  color="white"
                />
              </LinearGradient>
            </Animated.View>

            {/* Title */}
            <Text style={styles.title}>{currentStepData.title}</Text>

            {/* Quote */}
            {renderQuote(currentStepData.quote)}

            {/* Description */}
            <Text style={styles.description}>{currentStepData.description}</Text>

            {/* Features */}
            {currentStepData.features && (
              <View style={styles.featuresContainer}>
                {currentStepData.features.map((feature, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.featureItem,
                      {
                        opacity: fadeAnim,
                      },
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                    <Text style={styles.featureText}>{feature}</Text>
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          {renderProgressIndicators()}
          
          <View style={styles.navigationButtons}>
            <TouchableOpacity
              onPress={handlePrevious}
              style={[
                styles.navButton,
                styles.prevButton,
                { opacity: currentStep === 0 ? 0.5 : 1 },
              ]}
              disabled={currentStep === 0 || hasCompleted.current}
            >
              <Ionicons name="chevron-back" size={20} color="rgba(255, 255, 255, 0.7)" />
              <Text style={styles.prevButtonText}>Previous</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNext}
              style={styles.navButton}
              disabled={hasCompleted.current}
            >
              <LinearGradient
                colors={currentStepData.gradient}
                style={styles.nextButtonGradient}
              >
                <Text style={styles.nextButtonText}>
                  {currentStep === tourSteps.length - 1 ? 'Get Started' : 'Next'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

// ... [Keep all existing styles] ...
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
  },
  skipButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  stepContainer: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  iconContainer: {
    marginBottom: 10,
  },
  iconGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 6,
  },
  quoteContainer: {
    marginBottom: 8,
  },
  quote: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#fbbf24',
    fontStyle: 'italic',
  },
  description: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  featuresContainer: {
    width: '100%',
    gap: 6,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bottomControls: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 3,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
  },
  navButton: {
    flex: 1,
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
  },
  prevButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});