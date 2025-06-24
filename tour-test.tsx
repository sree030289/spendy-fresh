import React from 'react';
import { View } from 'react-native';
import AppTour from '../src/components/tour/AppTour';
import { TourProvider } from '../src/components/tour/TourProvider';

// Simple test to check if components compile correctly
export default function TourTest() {
  return (
    <TourProvider>
      <View>
        <AppTour
          visible={false}
          onComplete={() => {}}
          onSkip={() => {}}
        />
      </View>
    </TourProvider>
  );
}
