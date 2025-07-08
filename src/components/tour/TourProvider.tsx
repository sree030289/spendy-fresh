// src/components/tour/TourProvider.tsx - Fixed version

import React, { createContext, useContext, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';

interface TourContextType {
  startTour: () => void;
  resetTour: () => Promise<void>;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const tourInProgress = useRef(false);

  // FIXED: Memoized callbacks to prevent unnecessary re-renders
  const startTour = useCallback(() => {
    console.log('🎯 TourProvider: startTour called');
    
    if (tourInProgress.current) {
      console.log('🎯 TourProvider: Tour already in progress, skipping');
      return;
    }

    if (!user?.id) {
      console.log('🎯 TourProvider: No user ID available');
      return;
    }

    // FIXED: Don't set tourInProgress here - let the AppNavigator handle it
    console.log('🎯 TourProvider: Starting tour for user:', user.id);
    
    // The actual tour display is handled by the AppNavigator
    // This just signals that we want to start the tour
  }, [user?.id]);

  const resetTour = useCallback(async () => {
    try {
      console.log('🎯 TourProvider: resetTour called');
      
      if (!user?.id) {
        console.log('🎯 TourProvider: No user ID available for reset');
        return;
      }

      const tourKey = `app_tour_completed_${user.id}`;
      await AsyncStorage.removeItem(tourKey);
      tourInProgress.current = false;
      
      console.log('🎯 TourProvider: Tour reset completed for user:', user.id);
    } catch (error) {
      console.error('❌ TourProvider: Error resetting tour:', error);
    }
  }, [user?.id]);

  // FIXED: Memoized context value to prevent child re-renders
  const contextValue = React.useMemo(
    () => ({
      startTour,
      resetTour,
    }),
    [startTour, resetTour]
  );

  return (
    <TourContext.Provider value={contextValue}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}