// src/components/common/GradientComponents.tsx
import React from 'react';
import { View, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { GRADIENTS } from '@/constants/theme';

interface GradientViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  variant?: keyof typeof GRADIENTS;
}

export const GradientView: React.FC<GradientViewProps> = ({
  children,
  style,
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  variant = 'primary'
}) => {
  const { isDark } = useTheme();
  
  const getGradientColors = () => {
    if (colors) return colors;
    
    // Use dark variants for dark theme
    if (isDark && variant === 'primary') {
      return GRADIENTS.primaryDark;
    }
    
    return GRADIENTS[variant];
  };

  return (
    <LinearGradient
      colors={getGradientColors()}
      start={start}
      end={end}
      style={style}
    >
      {children}
    </LinearGradient>
  );
};

interface GradientCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: keyof typeof GRADIENTS;
  borderRadius?: number;
}

export const GradientCard: React.FC<GradientCardProps> = ({
  children,
  style,
  variant = 'primary',
  borderRadius = 16
}) => {
  const { theme } = useTheme();
  
  return (
    <GradientView
      variant={variant}
      style={[
        {
          borderRadius,
          ...theme.shadows.md,
        },
        style
      ]}
    >
      {children}
    </GradientView>
  );
};

interface GradientBorderProps {
  children: React.ReactNode;
  style?: ViewStyle;
  borderWidth?: number;
  borderRadius?: number;
  variant?: keyof typeof GRADIENTS;
}

export const GradientBorder: React.FC<GradientBorderProps> = ({
  children,
  style,
  borderWidth = 2,
  borderRadius = 12,
  variant = 'primary'
}) => {
  const { theme } = useTheme();
  
  return (
    <GradientView
      variant={variant}
      style={[
        {
          padding: borderWidth,
          borderRadius,
        },
        style
      ]}
    >
      <View style={{
        backgroundColor: theme.colors.background,
        borderRadius: borderRadius - borderWidth,
        flex: 1,
      }}>
        {children}
      </View>
    </GradientView>
  );
};

// src/utils/gradientHelpers.ts
export const createGradientStyle = (
  colors: string[], 
  angle: number = 45
): ViewStyle => {
  // Convert angle to start/end points for LinearGradient
  const angleRad = (angle * Math.PI) / 180;
  const start = { 
    x: Math.cos(angleRad + Math.PI) / 2 + 0.5, 
    y: Math.sin(angleRad + Math.PI) / 2 + 0.5 
  };
  const end = { 
    x: Math.cos(angleRad) / 2 + 0.5, 
    y: Math.sin(angleRad) / 2 + 0.5 
  };
  
  return { start, end };
};

export const getThemeGradient = (
  variant: keyof typeof GRADIENTS = 'primary',
  isDark: boolean = false
) => {
  if (isDark && variant === 'primary') {
    return GRADIENTS.primaryDark;
  }
  return GRADIENTS[variant];
};

// Common gradient configurations
export const GRADIENT_CONFIGS = {
  header: {
    colors: ['#667eea', '#764ba2'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  card: {
    colors: ['#667eea', '#764ba2'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
  button: {
    colors: ['#667eea', '#764ba2'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  background: {
    colors: ['#f8fafc', '#e2e8f0'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  darkBackground: {
    colors: ['#1a202c', '#2d3748'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
};

// Usage examples and documentation
/*
Usage Examples:

1. Basic Gradient View:
<GradientView variant="primary" style={{ padding: 20, borderRadius: 12 }}>
  <Text style={{ color: 'white' }}>Gradient Background</Text>
</GradientView>

2. Gradient Card:
<GradientCard style={{ padding: 20, margin: 16 }}>
  <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
    Featured Content
  </Text>
</GradientCard>

3. Gradient Border:
<GradientBorder borderWidth={3} borderRadius={16}>
  <View style={{ padding: 20 }}>
    <Text>Content with gradient border</Text>
  </View>
</GradientBorder>

4. Custom Gradient Colors:
<GradientView 
  colors={['#ff6b6b', '#ffd93d']} 
  style={{ padding: 16, borderRadius: 8 }}
>
  <Text style={{ color: 'white' }}>Custom Gradient</Text>
</GradientView>

5. In StyleSheet with helper:
const styles = StyleSheet.create({
  gradientButton: {
    ...createGradientStyle(['#667eea', '#764ba2'], 135),
    padding: 16,
    borderRadius: 12,
  }
});
*/