// src/components/common/SkeletonLoader.tsx - Simple Skeleton Loading Component
import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style = {}
}) => {
  const { theme } = useTheme();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surface,
          opacity,
        },
        style,
      ]}
    />
  );
};

interface ExpenseSkeletonProps {
  count?: number;
}

export const ExpenseSkeleton: React.FC<ExpenseSkeletonProps> = ({ count = 3 }) => {
  const { theme } = useTheme();
  
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.itemContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.leftSection}>
            <SkeletonLoader width={40} height={40} borderRadius={20} />
          </View>
          <View style={styles.centerSection}>
            <SkeletonLoader width="70%" height={16} style={{ marginBottom: 8 }} />
            <SkeletonLoader width="50%" height={12} />
          </View>
          <View style={styles.rightSection}>
            <SkeletonLoader width={60} height={16} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
  },
  leftSection: {
    marginRight: 12,
  },
  centerSection: {
    flex: 1,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
});