import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/hooks/useAuth';
import EnhancedSplashScreen from '@/components/screens/EnhancedSplashScreen';

interface SplashScreenProps {
  onSplashComplete?: () => void;
}

export default function SplashScreen({ onSplashComplete }: SplashScreenProps) {
  const navigation = useNavigation();
  const { isAuthenticated } = useAuth();

  const handleAnimationComplete = () => {
    console.log('🎬 Splash animation completed');
    
    // Call the parent callback to indicate splash is done
    if (onSplashComplete) {
      onSplashComplete();
    }
    
    // Navigate to appropriate screen after animation completes
    setTimeout(() => {
      if (isAuthenticated) {
        navigation.navigate('Main' as never);
      } else {
        navigation.navigate('Login' as never);
      }
    }, 500); // Small delay after animation for better UX
  };

  return (
    <EnhancedSplashScreen onAnimationComplete={handleAnimationComplete} />
  );
}
