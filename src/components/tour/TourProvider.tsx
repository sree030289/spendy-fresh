import React, { createContext, useContext, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppTour from './AppTourNew';

const STORAGE_KEY = 'app_tour_completed';

interface TourContextType {
  showTour: boolean;
  startTour: () => void;
  closeTour: () => void;
  resetTour: () => Promise<void>;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const TourProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [showTour, setShowTour] = useState(false);

  const startTour = () => {
    setShowTour(true);
  };

  const closeTour = async () => {
    setShowTour(false);
    // Mark tour as completed
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
  };

  const resetTour = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setShowTour(true);
  };

  return (
    <TourContext.Provider value={{ showTour, startTour, closeTour, resetTour }}>
      {children}
      <AppTour
        visible={showTour}
        onComplete={closeTour}
        onSkip={closeTour}
      />
    </TourContext.Provider>
  );
};

export const useTour = () => {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};
