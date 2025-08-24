// src/constants/theme.ts
import { AppTheme } from '@/types';

// Gradient colors from the design
export const GRADIENT_COLORS = {
  primary: '#667eea',
  secondary: '#764ba2',
  // Additional gradient variants
  light: '#8B92F7',
  dark: '#5A67D8',
};

// Common colors used in both themes
export const COMMON_COLORS = {
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  
  // =============================================================================
  // 🎨 COLOR THEME OPTIONS - Change these 3 lines to switch themes instantly!
  // =============================================================================
  
  // 🟣 CURRENT: Purple Theme
  // brandRed: '#7C3AED',        // Purple primary
  // brandRedLight: '#8B5CF6',   // Purple light
  // brandRedDark: '#6D28D9',    // Purple dark
  
  // 📋 COPY & PASTE OPTIONS:
  // 
  // 🔴 Classic Red (Original)
  // brandRed: '#DC143C',        
  // brandRedLight: '#E6345B',   
  // brandRedDark: '#B91033',    
  //
  // 🔵 Ocean Blue  
  // brandRed: '#1E40AF',        
  // brandRedLight: '#3B82F6',   
  // brandRedDark: '#1E3A8A',    
  //
  // 🍷 Custom Burgundy Wine
  brandRed: '#B0004F',        // Deep burgundy primary
  brandRedLight: '#D91A72',   // Lighter burgundy  
  brandRedDark: '#8B003F',    // Darker burgundy
  //
  // 🟠 Sunset Orange
  // brandRed: '#EA580C',        
  // brandRedLight: '#FB923C',   
  // brandRedDark: '#C2410C',    
  //
  // 🟡 Golden Yellow
  // brandRed: '#D97706',        
  // brandRedLight: '#F59E0B',   
  // brandRedDark: '#B45309',    
  //
  // ⚫ Sleek Black
  // brandRed: '#1F2937',        
  // brandRedLight: '#374151',   
  // brandRedDark: '#111827',    
  //
  // 🔮 Royal Purple (Current)
  // brandRed: '#7C3AED',        
  // brandRedLight: '#8B5CF6',   
  // brandRedDark: '#6D28D9',    
  //
  // 🩷 Rose Pink
  // brandRed: '#E11D48',        
  // brandRedLight: '#F43F5E',   
  // brandRedDark: '#BE123C',    
  //
  // 🟦 Sky Blue
  // brandRed: '#0EA5E9',        
  // brandRedLight: '#38BDF8',   
  // brandRedDark: '#0284C7',    
  //
  // 🟫 Coffee Brown
  // brandRed: '#92400E',        
  // brandRedLight: '#B45309',   
  // brandRedDark: '#78350F',    
  //
  // 🔥 Fire Red
  // brandRed: '#EF4444',        
  // brandRedLight: '#F87171',   
  // brandRedDark: '#DC2626',    
  //
  // 💎 Teal Gem
  // brandRed: '#0D9488',        
  // brandRedLight: '#14B8A6',   
  // brandRedDark: '#0F766E',    
  //
  // 🌸 Soft Pink
  // brandRed: '#DB2777',        
  // brandRedLight: '#EC4899',   
  // brandRedDark: '#BE185D',    
  //
  // 🍇 Grape Purple
  // brandRed: '#9333EA',        
  // brandRedLight: '#A855F7',   
  // brandRedDark: '#7E22CE',    
  //
  // 🌊 Deep Ocean
  // brandRed: '#1E3A8A',        
  // brandRedLight: '#3B82F6',   
  // brandRedDark: '#1E40AF',    
  
  // =============================================================================
  
  // Gradient-based color palette
  primary: GRADIENT_COLORS.primary,
  primaryLight: '#8B92F7',
  primaryDark: '#5A67D8',
  secondary: GRADIENT_COLORS.secondary,
  
  // Status colors that work well with the gradient
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Neutral grays
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
};

export const LIGHT_THEME: AppTheme = {
  isDark: false,
  colors: {
    // Background colors
    background: COMMON_COLORS.white,
    surface: COMMON_COLORS.gray50,
    surfaceSecondary: COMMON_COLORS.gray100,
    
    // Brand colors
    brand: COMMON_COLORS.brandRed,
    brandLight: COMMON_COLORS.brandRedLight,
    brandDark: COMMON_COLORS.brandRedDark,
    
    // Primary brand colors (now using red)
    primary: COMMON_COLORS.brandRed,
    primaryLight: COMMON_COLORS.brandRedLight,
    primaryDark: COMMON_COLORS.brandRedDark,
    secondary: COMMON_COLORS.secondary,
    
    // Text colors
    text: COMMON_COLORS.gray900,
    textSecondary: COMMON_COLORS.gray600,
    textTertiary: COMMON_COLORS.gray500,
    textInverse: COMMON_COLORS.white,
    
    // Status colors
    success: COMMON_COLORS.success,
    warning: COMMON_COLORS.warning,
    error: COMMON_COLORS.error,
    info: COMMON_COLORS.info,
    
    // Border and divider colors
    border: COMMON_COLORS.gray200,
    borderLight: COMMON_COLORS.gray100,
    divider: COMMON_COLORS.gray200,
    
    // Interactive states
    hover: COMMON_COLORS.gray100,
    pressed: COMMON_COLORS.gray200,
    disabled: COMMON_COLORS.gray300,
    
    // Gradients (for components that support them)
    gradientStart: GRADIENT_COLORS.primary,
    gradientEnd: GRADIENT_COLORS.secondary,
    
    // Card and elevation
    card: COMMON_COLORS.white,
    cardElevated: COMMON_COLORS.white,
    shadow: 'rgba(0, 0, 0, 0.1)',
    
    // Input colors
    inputBackground: COMMON_COLORS.white,
    inputBorder: COMMON_COLORS.gray300,
    inputPlaceholder: COMMON_COLORS.gray400,
    
    // Modal and overlay
    overlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: COMMON_COLORS.white,
    
    // Tab and navigation
    tabActive: COMMON_COLORS.brandRed,
    tabInactive: COMMON_COLORS.gray500,
    tabBackground: COMMON_COLORS.white,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 20,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: COMMON_COLORS.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: COMMON_COLORS.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    lg: {
      shadowColor: COMMON_COLORS.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 5,
    },
    xl: {
      shadowColor: COMMON_COLORS.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 8,
    },
  },
};

export const DARK_THEME: AppTheme = {
  isDark: true,
  colors: {
    // Background colors
    background: COMMON_COLORS.gray900,
    surface: COMMON_COLORS.gray800,
    surfaceSecondary: COMMON_COLORS.gray700,
    
    // Brand colors (same red color works well in dark mode)
    brand: COMMON_COLORS.brandRed,
    brandLight: COMMON_COLORS.brandRedLight,
    brandDark: COMMON_COLORS.brandRedDark,
    
    // Primary brand colors (now using red for consistency)
    primary: COMMON_COLORS.brandRed,
    primaryLight: COMMON_COLORS.brandRedLight,
    primaryDark: COMMON_COLORS.brandRedDark,
    secondary: '#9F7AEA', // Lighter purple for dark mode
    
    // Text colors
    text: COMMON_COLORS.white,
    textSecondary: COMMON_COLORS.gray300,
    textTertiary: COMMON_COLORS.gray400,
    textInverse: COMMON_COLORS.gray900,
    
    // Status colors (slightly adjusted for dark mode)
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
    
    // Border and divider colors
    border: COMMON_COLORS.gray700,
    borderLight: COMMON_COLORS.gray600,
    divider: COMMON_COLORS.gray700,
    
    // Interactive states
    hover: COMMON_COLORS.gray700,
    pressed: COMMON_COLORS.gray600,
    disabled: COMMON_COLORS.gray600,
    
    // Gradients (adjusted for dark mode)
    gradientStart: COMMON_COLORS.primaryLight,
    gradientEnd: '#9F7AEA',
    
    // Card and elevation
    card: COMMON_COLORS.gray800,
    cardElevated: COMMON_COLORS.gray700,
    shadow: 'rgba(0, 0, 0, 0.3)',
    
    // Input colors
    inputBackground: COMMON_COLORS.gray800,
    inputBorder: COMMON_COLORS.gray600,
    inputPlaceholder: COMMON_COLORS.gray500,
    
    // Modal and overlay
    overlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: COMMON_COLORS.gray800,
    
    // Tab and navigation
    tabActive: COMMON_COLORS.brandRed,
    tabInactive: COMMON_COLORS.gray400,
    tabBackground: COMMON_COLORS.gray800,
  },
  spacing: LIGHT_THEME.spacing,
  borderRadius: LIGHT_THEME.borderRadius,
  shadows: {
    sm: {
      shadowColor: COMMON_COLORS.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: COMMON_COLORS.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 3,
    },
    lg: {
      shadowColor: COMMON_COLORS.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 5,
    },
    xl: {
      shadowColor: COMMON_COLORS.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 24,
      elevation: 8,
    },
  },
};

// Utility functions for gradients
export const createLinearGradient = (colors: string[] = [GRADIENT_COLORS.primary, GRADIENT_COLORS.secondary]) => {
  return {
    colors,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  };
};

// Common gradient combinations
export const GRADIENTS = {
  primary: [GRADIENT_COLORS.primary, GRADIENT_COLORS.secondary],
  primaryLight: [COMMON_COLORS.primaryLight, GRADIENT_COLORS.secondary],
  success: ['#10B981', '#059669'],
  error: ['#EF4444', '#DC2626'],
  warning: ['#F59E0B', '#D97706'],
  info: ['#3B82F6', '#2563EB'],
  
  // Dark mode variants
  primaryDark: [COMMON_COLORS.primaryLight, '#9F7AEA'],
  surfaceDark: [COMMON_COLORS.gray800, COMMON_COLORS.gray700],
};