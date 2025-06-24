// src/components/common/Button.tsx
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { GRADIENTS } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  iconPosition = 'left',
  fullWidth = false,
}) => {
  const { theme, isDark } = useTheme();

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          minHeight: 40,
          borderRadius: theme.borderRadius.md,
        };
      case 'lg':
        return {
          paddingVertical: theme.spacing.xl,
          paddingHorizontal: theme.spacing.xxxl,
          minHeight: 64,
          borderRadius: theme.borderRadius.xl,
        };
      default: // md
        return {
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.xxl,
          minHeight: 56,
          borderRadius: theme.borderRadius.lg,
        };
    }
  };

  const getButtonStyle = (): ViewStyle => {
    const sizeStyles = getSizeStyles();
    const baseStyle = {
      ...sizeStyles,
      opacity: disabled ? 0.6 : 1,
      width: fullWidth ? '100%' : undefined,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: theme.spacing.sm,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: theme.colors.primary,
          ...theme.shadows.sm,
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: theme.colors.transparent,
          borderWidth: 2,
          borderColor: theme.colors.primary,
        };
      case 'ghost':
        return {
          ...baseStyle,
          backgroundColor: theme.colors.transparent,
        };
      case 'gradient':
        return {
          ...baseStyle,
          backgroundColor: theme.colors.transparent,
          ...theme.shadows.md,
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle = {
      fontSize: size === 'sm' ? 14 : size === 'lg' ? 18 : 16,
      fontWeight: '600' as const,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          color: theme.colors.textInverse,
        };
      case 'outline':
        return {
          ...baseStyle,
          color: theme.colors.primary,
        };
      case 'ghost':
        return {
          ...baseStyle,
          color: theme.colors.primary,
        };
      case 'gradient':
        return {
          ...baseStyle,
          color: theme.colors.textInverse,
        };
      case 'secondary':
      default:
        return {
          ...baseStyle,
          color: theme.colors.text,
        };
    }
  };

  const getGradientColors = () => {
    if (isDark) {
      return GRADIENTS.primaryDark;
    }
    return GRADIENTS.primary;
  };

  const renderContent = () => (
    <>
      {loading ? (
        <ActivityIndicator 
          color={variant === 'primary' || variant === 'gradient' ? theme.colors.textInverse : theme.colors.primary} 
          size="small"
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </>
  );

  if (variant === 'gradient') {
    return (
      <TouchableOpacity
        style={[{ borderRadius: getSizeStyles().borderRadius }, style]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[getButtonStyle(), { backgroundColor: undefined }]}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

// Specialized button variants using the new design system
export const GradientButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button {...props} variant="gradient" />
);

export const PrimaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button {...props} variant="primary" />
);

export const SecondaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button {...props} variant="secondary" />
);

export const OutlineButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button {...props} variant="outline" />
);

export const GhostButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button {...props} variant="ghost" />
);

const styles = StyleSheet.create({
  // Additional styles can be added here if needed
});