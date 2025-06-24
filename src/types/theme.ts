// src/types/theme.ts (or add to existing types file)
export interface AppTheme {
  colors: {
    // Background colors
    background: string;
    surface: string;
    surfaceSecondary: string;
    
    // Primary brand colors
    primary: string;
    primaryLight: string;
    primaryDark: string;
    secondary: string;
    
    // Text colors
    text: string;
    textSecondary: string;
    textTertiary: string;
    textInverse: string;
    
    // Status colors
    success: string;
    warning: string;
    error: string;
    info: string;
    
    // Border and divider colors
    border: string;
    borderLight: string;
    divider: string;
    
    // Interactive states
    hover: string;
    pressed: string;
    disabled: string;
    
    // Gradients
    gradientStart: string;
    gradientEnd: string;
    
    // Card and elevation
    card: string;
    cardElevated: string;
    shadow: string;
    
    // Input colors
    inputBackground: string;
    inputBorder: string;
    inputPlaceholder: string;
    
    // Modal and overlay
    overlay: string;
    modalBackground: string;
    
    // Tab and navigation
    tabActive: string;
    tabInactive: string;
    tabBackground: string;
    
    // Utility
    transparent: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    xxxl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    full: number;
  };
  shadows: {
    sm: ShadowStyle;
    md: ShadowStyle;
    lg: ShadowStyle;
    xl: ShadowStyle;
  };
}

export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}