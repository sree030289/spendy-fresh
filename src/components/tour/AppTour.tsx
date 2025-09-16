import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
  StatusBar,
  Image,
  FlatList,
} from 'react-native';
import { Icon } from '../common/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TourStep {
  id: string;
  title: string;
  description: string;
  quote: string;
  icon: string;
  color: string;
  gradient: [string, string];
  animation?: 'fadeIn' | 'slideUp' | 'bounce' | 'scale' | 'typewriter' | 'pulse';
  features?: string[];
  demoType: 'realData' | 'liveAnimation' | 'interactive' | 'screenshot';
  realData?: any;
}

// Real sample data for demonstrations
const sampleExpenses = [
  { id: 1, description: 'Pizza Night', amount: 67.45, category: 'Food', participants: ['You', 'Sarah', 'Mike', 'Emma'], paidBy: 'You', date: '2025-06-20', group: 'Miami Trip' },
  { id: 2, description: 'Apartment Bills', amount: 285.90, category: 'Utilities', participants: ['You', 'Alex', 'Sarah', 'Mike'], paidBy: 'Alex', date: '2025-06-19', group: 'Roommates' },
  { id: 3, description: 'Concert Tickets', amount: 152.00, category: 'Entertainment', participants: ['You', 'Sarah', 'Mike', 'Emma', 'Alex', 'Lisa'], paidBy: 'Sarah', date: '2025-06-18', group: 'Friends' },
];

const sampleBalances = [
  { name: 'Overall Balance', description: 'All groups', amount: 156.20, type: 'positive', icon: '👤' },
  { name: 'This Month', description: '$847 spent', amount: -42.30, type: 'negative', icon: '📈' },
  { name: 'Savings Goal', description: '85% achieved', amount: 198.70, type: 'positive', icon: '🎯' },
];

const sampleAIData = [
  { title: 'AI Insight', amount: '-15%', description: 'Dining spending vs last month', icon: '🧠' },
  { title: 'Receipt Scans', amount: '47', description: 'This month • 98% accuracy', icon: '📸' },
  { title: 'Deals Saved', amount: '$247', description: 'Cashback & discounts earned', icon: '🛍️' },
];

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Meet-n-Split! 💰',
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
    realData: sampleExpenses,
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
    realData: sampleBalances,
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
    realData: sampleAIData,
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
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const typewriterAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && isVisible) {
      startEntranceAnimation();
      startStepAnimation();
    }
  }, [visible, isVisible, currentStep]);

  useEffect(() => {
    // Pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    // Rotation animation
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );
    rotateAnimation.start();

    return () => {
      pulseAnimation.stop();
      rotateAnimation.stop();
    };
  }, []);

  const startEntranceAnimation = () => {
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
    ]).start();
  };

  const startStepAnimation = () => {
    const step = tourSteps[currentStep];
    if (!step) return;

    // Reset animations
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    scaleAnim.setValue(0.9);
    bounceAnim.setValue(0);
    typewriterAnim.setValue(0);

    switch (step.animation) {
      case 'pulse':
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
        ]).start();
        break;
      case 'typewriter':
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(typewriterAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        ]).start();
        break;
      case 'slideUp':
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 8, useNativeDriver: true }),
        ]).start();
        break;
      case 'scale':
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 8, useNativeDriver: true }),
        ]).start();
        break;
      case 'bounce':
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(bounceAnim, { toValue: 1, tension: 200, friction: 3, useNativeDriver: true }),
        ]).start();
        break;
      default:
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }

    // Update progress
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / tourSteps.length,
      duration: 600,
      useNativeDriver: false,
    }).start();
  };

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    onSkip();
  };

  const handleComplete = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    onComplete();
  };

  const getCurrentStep = () => tourSteps[currentStep];

  const renderQuote = (quote: string) => (
    <Animated.View style={[styles.quoteContainer, { opacity: fadeAnim }]}>
      <Text style={styles.quote}>"{quote}"</Text>
    </Animated.View>
  );

  const renderPhoneMockup = () => {
    const step = getCurrentStep();
    
    return (
      <Animated.View style={[
        styles.phoneMockup,
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: slideAnim },
          ],
        },
      ]}>
        <LinearGradient
          colors={step.gradient}
          style={styles.phoneScreen}
        >
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>9:41</Text>
            <Text style={styles.statusText}>100% 🔋</Text>
          </View>
          
          <View style={styles.appContent}>
            <View style={styles.screenHeader}>
              <Text style={styles.screenIcon}>{getScreenIcon(step.id)}</Text>
              <Text style={styles.screenTitle}>{getScreenTitle(step.id)}</Text>
            </View>
            
            <View style={styles.screenBody}>
              {renderScreenContent(step)}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  const getScreenIcon = (stepId: string) => {
    switch (stepId) {
      case 'welcome': return '💰';
      case 'expenses-groups': return '📱';
      case 'personal-tracker': return '📊';
      case 'ai-deals': return '🤖';
      default: return '💰';
    }
  };

  const getScreenTitle = (stepId: string) => {
    switch (stepId) {
      case 'welcome': return 'MeetNSplit';
      case 'expenses-groups': return 'Expenses & Groups';
      case 'personal-tracker': return 'Personal Tracker';
      case 'ai-deals': return 'AI Analytics & Deals';
      default: return 'MeetNSplit';
    }
  };

  const renderScreenContent = (step: TourStep) => {
    switch (step.id) {
      case 'welcome':
        return (
          <View style={styles.welcomeContent}>
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>$2,847</Text>
                <Text style={styles.statLabel}>Total Split</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: '#fbbf24' }]}>+$156</Text>
                <Text style={styles.statLabel}>You're Owed</Text>
              </View>
            </View>
          </View>
        );
      
      case 'expenses-groups':
        return (
          <View style={styles.listContent}>
            {sampleExpenses.map((expense, index) => (
              <View key={expense.id} style={styles.listItem}>
                <Text style={styles.listTitle}>{getExpenseEmoji(expense.category)} {expense.description}</Text>
                <Text style={styles.listAmount}>${expense.amount}</Text>
                <Text style={styles.listDetails}>Split {expense.participants.length} ways • {expense.group}</Text>
              </View>
            ))}
          </View>
        );
      
      case 'personal-tracker':
        return (
          <View style={styles.listContent}>
            {sampleBalances.map((balance, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listIcon}>{balance.icon}</Text>
                <View style={styles.listInfo}>
                  <Text style={styles.listTitle}>{balance.name}</Text>
                  <Text style={styles.listDetails}>{balance.description}</Text>
                </View>
                <Text style={[
                  styles.listAmount,
                  { color: balance.type === 'positive' ? '#10B981' : '#EF4444' }
                ]}>
                  {balance.amount > 0 ? '+' : ''}${Math.abs(balance.amount)}
                </Text>
              </View>
            ))}
          </View>
        );
      
      case 'ai-deals':
        return (
          <View style={styles.listContent}>
            {sampleAIData.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listIcon}>{item.icon}</Text>
                <View style={styles.listInfo}>
                  <Text style={styles.listTitle}>{item.title}</Text>
                  <Text style={styles.listDetails}>{item.description}</Text>
                </View>
                <Text style={styles.listAmount}>{item.amount}</Text>
              </View>
            ))}
          </View>
        );
      
      default:
        return null;
    }
  };

  const getExpenseEmoji = (category: string) => {
    switch (category) {
      case 'Food': return '🍕';
      case 'Utilities': return '🏠';
      case 'Entertainment': return '🎬';
      default: return '💰';
    }
  };

  const renderFeatures = (features: string[]) => (
    <View style={styles.featuresContainer}>
      {features.map((feature, index) => (
        <Animated.View
          key={index}
          style={[
            styles.featureItem,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateX: slideAnim.interpolate({
                    inputRange: [0, 50],
                    outputRange: [0, 50],
                  }),
                },
              ],
            },
          ]}
        >
          <Icon name="success" size={16} color="#10B981"  />
          <Text style={styles.featureText}>{feature}</Text>
        </Animated.View>
      ))}
    </View>
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
            onPress={() => setCurrentStep(index)}
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
      statusBarHidden={false}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        style={styles.container}
      >
        {/* Background Effects */}
        <View style={styles.backgroundEffects}>
          <Animated.View
            style={[
              styles.floatingShape,
              {
                transform: [
                  {
                    rotate: rotateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.floatingShape2,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip Tour</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                <Icon
                  name={currentStepData.icon}
                  size={60}
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

            {/* Phone Mockup */}
            {renderPhoneMockup()}

            {/* Features */}
            {currentStepData.features && renderFeatures(currentStepData.features)}
          </Animated.View>
        </ScrollView>

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
              disabled={currentStep === 0}
            >
              <Icon name="back" size={20} color="rgba(255, 255, 255, 0.7)"  />
              <Text style={styles.prevButtonText}>Previous</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNext}
              style={styles.navButton}
            >
              <LinearGradient
                colors={currentStepData.gradient}
                style={styles.nextButtonGradient}
              >
                <Text style={styles.nextButtonText}>
                  {currentStep === tourSteps.length - 1 ? 'Get Started' : 'Next'}
                </Text>
                <Icon name="forward" size={20} color="white"  />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundEffects: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  floatingShape: {
    position: 'absolute',
    top: 100,
    right: 50,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
  },
  floatingShape2: {
    position: 'absolute',
    bottom: 200,
    left: 30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(118, 75, 162, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  skipButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backdropFilter: 'blur(10px)',
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  quoteContainer: {
    marginBottom: 15,
  },
  quote: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#fbbf24',
    fontStyle: 'italic',
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  phoneMockup: {
    width: 280,
    height: 500,
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.5,
    shadowRadius: 50,
    elevation: 25,
  },
  phoneScreen: {
    flex: 1,
    padding: 8,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  appContent: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    padding: 20,
    backdropFilter: 'blur(10px)',
  },
  screenHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  screenIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  screenBody: {
    flex: 1,
  },
  welcomeContent: {
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  listContent: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    backdropFilter: 'blur(10px)',
  },
  listIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  listInfo: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  listAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  listDetails: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  featuresContainer: {
    width: '100%',
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bottomControls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 15,
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
    marginBottom: 15,
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
    paddingVertical: 16,
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
    paddingVertical: 16,
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
