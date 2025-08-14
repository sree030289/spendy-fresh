import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTour } from '@/components/tour/TourProvider';
import { Icon } from '../common/Icon';

export default function TourDemo() {
  const { theme } = useTheme();
  const { startTour, resetTour } = useTour();

  const handleStartTour = () => {
    resetTour();
    startTour();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        App Tour Demo
      </Text>
      
      <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
        Test the interactive app tour with animations and feature highlights.
      </Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={handleStartTour}
      >
        <Icon name="play-circle" size={24} color="white" />
        <Text style={styles.buttonText}>Start App Tour</Text>
      </TouchableOpacity>

      <View style={styles.features}>
        <Text style={[styles.featuresTitle, { color: theme.colors.text }]}>
          Tour Features:
        </Text>
        
        {[
          '🎨 Beautiful animations and transitions',
          '📱 Interactive mock screens',
          '💰 Splitting expense demonstrations',
          '🎯 Key feature highlights',
          '⏭️ Skipable at any time',
          '💾 Remembers completion status',
          '🔄 Can be replayed from profile',
        ].map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Text style={[styles.featureText, { color: theme.colors.text }]}>
              {feature}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 25,
    marginBottom: 32,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  features: {
    width: '100%',
    maxWidth: 300,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  featureItem: {
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
