import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/hooks/useAuth';

export default function SplashScreen() {
  const navigation = useNavigation();
  const { isAuthenticated, isLoading } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const [animationComplete, setAnimationComplete] = React.useState(false);

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAnimationComplete(true);
    });
  }, []);

  useEffect(() => {
    // Navigate after animation and auth check is complete
    if (animationComplete && !isLoading) {
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          navigation.navigate('Main' as never);
        } else {
          navigation.navigate('Login' as never);
        }
      }, 500); // Small delay for better UX

      return () => clearTimeout(timer);
    }
  }, [animationComplete, isLoading, isAuthenticated, navigation]);

  return (
    <LinearGradient
      colors={['#10B981', '#059669']}
      style={styles.container}
    >
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>💰</Text>
        </View>
        <Text style={styles.title}>Spendy</Text>
        <Text style={styles.tagline}>Track. Split. Pay.</Text>
        
        {isLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    backgroundColor: 'white',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoEmoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  tagline: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  loadingContainer: {
    marginTop: 32,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
  },
});