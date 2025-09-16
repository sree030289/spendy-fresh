import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../common/Icon';
import { useTheme } from '@/hooks/useTheme';

const { width, height } = Dimensions.get('window');

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const { theme } = useTheme();
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const features = [
    {
      icon: 'people' as const,
      title: 'Split Expenses',
      description: 'Easily split bills with friends and track who owes what'
    },
    {
      icon: 'analytics' as const,
      title: 'Smart Analytics',
      description: 'Get insights into your spending patterns and financial health'
    },
    {
      icon: 'card' as const,
      title: 'Multiple Groups',
      description: 'Organize expenses across different friend groups and activities'
    },
    {
      icon: 'notifications' as const,
      title: 'Smart Reminders',
      description: 'Never forget to pay or collect money with intelligent notifications'
    }
  ];

  const isWeb = Platform.OS === 'web';

  const handleFeatureHover = (index: number | null) => {
    if (isWeb) {
      setHoveredFeature(index);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Hero Section */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.secondary]}
        style={styles.heroSection}
      >
        <View style={styles.heroContent}>
          <Text style={[styles.heroTitle, { color: theme.colors.surface }]}>
            Meet-n-Split
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.colors.surface }]}>
            Split expenses, track balances, stay organized
          </Text>
          <Text style={[styles.heroDescription, { color: theme.colors.surface }]}>
            The smart way to manage shared expenses with friends, family, and groups. 
            Never lose track of who owes what again.
          </Text>
          
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: theme.colors.surface }]}
            onPress={onGetStarted}
            {...(isWeb && {
              onMouseEnter: () => handleFeatureHover(-1),
              onMouseLeave: () => handleFeatureHover(null)
            })}
          >
            <Text style={[styles.ctaButtonText, { color: theme.colors.primary }]}>
              Get Started Free
            </Text>
            <Icon name="forward" size={20} color={theme.colors.primary}  />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Features Section */}
      <View style={styles.featuresSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Why Choose Meet-n-Split?
        </Text>
        
        <View style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.featureCard,
                { 
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  ...(hoveredFeature === index && isWeb && {
                    transform: [{ scale: 1.02 }],
                    shadowColor: theme.colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 8
                  })
                }
              ]}
              {...(isWeb && {
                onMouseEnter: () => handleFeatureHover(index),
                onMouseLeave: () => handleFeatureHover(null)
              })}
            >
              <Icon 
                name={feature.icon} 
                size={32} 
                color={theme.colors.primary} 
                style={styles.featureIcon}
              />
              <Text style={[styles.featureTitle, { color: theme.colors.text }]}>
                {feature.title}
              </Text>
              <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]}>
                {feature.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* How It Works Section */}
      <View style={[styles.howItWorksSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          How It Works
        </Text>
        
        <View style={styles.stepsContainer}>
          {[
            { step: '1', title: 'Create Account', desc: 'Sign up in seconds with email or social login' },
            { step: '2', title: 'Add Friends', desc: 'Invite friends via email, phone, or QR code' },
            { step: '3', title: 'Split Expenses', desc: 'Add expenses and split them automatically' },
            { step: '4', title: 'Settle Up', desc: 'Track balances and settle when convenient' }
          ].map((item, index) => (
            <View key={index} style={styles.stepItem}>
              <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                <Text style={[styles.stepNumberText, { color: theme.colors.surface }]}>
                  {item.step}
                </Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
                  {item.title}
                </Text>
                <Text style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                  {item.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* CTA Section */}
      <View style={styles.finalCtaSection}>
        <Text style={[styles.finalCtaTitle, { color: theme.colors.text }]}>
          Ready to Get Started?
        </Text>
        <Text style={[styles.finalCtaSubtitle, { color: theme.colors.textSecondary }]}>
          Join thousands of users who trust Meet-n-Split with their shared expenses
        </Text>
        
        <TouchableOpacity
          style={[styles.finalCtaButton, { backgroundColor: theme.colors.primary }]}
          onPress={onGetStarted}
        >
          <Text style={[styles.finalCtaButtonText, { color: theme.colors.surface }]}>
            Start Splitting Now
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    paddingHorizontal: 24,
    paddingVertical: 80,
    alignItems: 'center',
    minHeight: Platform.OS === 'web' ? 400 : height * 0.6,
  },
  heroContent: {
    maxWidth: 600,
    alignItems: 'center',
    textAlign: Platform.OS === 'web' ? 'center' : 'left',
  },
  heroTitle: {
    fontSize: Platform.OS === 'web' ? 48 : 36,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: Platform.OS === 'web' ? 24 : 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: Platform.OS === 'web' ? 18 : 16,
    textAlign: 'center',
    lineHeight: Platform.OS === 'web' ? 28 : 24,
    marginBottom: 32,
    opacity: 0.9,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  featuresSection: {
    paddingHorizontal: 24,
    paddingVertical: 60,
    maxWidth: Platform.OS === 'web' ? 1200 : width,
    alignSelf: 'center',
    width: '100%',
  },
  sectionTitle: {
    fontSize: Platform.OS === 'web' ? 32 : 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
  },
  featuresGrid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap',
    gap: 20,
    justifyContent: 'center',
  },
  featureCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    textAlign: 'center',
    width: Platform.OS === 'web' ? '45%' : '100%',
    minWidth: Platform.OS === 'web' ? 250 : 'auto',
    maxWidth: Platform.OS === 'web' ? 300 : 'auto',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    transition: Platform.OS === 'web' ? 'all 0.2s ease' : undefined,
  },
  featureIcon: {
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  howItWorksSection: {
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  stepsContainer: {
    maxWidth: Platform.OS === 'web' ? 800 : width,
    alignSelf: 'center',
    width: '100%',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    marginTop: 4,
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  finalCtaSection: {
    paddingHorizontal: 24,
    paddingVertical: 60,
    alignItems: 'center',
  },
  finalCtaTitle: {
    fontSize: Platform.OS === 'web' ? 28 : 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  finalCtaSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  finalCtaButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  finalCtaButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});