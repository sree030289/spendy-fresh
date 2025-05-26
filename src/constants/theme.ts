import { AppTheme } from '@/types';

export const LIGHT_THEME: AppTheme = {
  isDark: false,
  colors: {
    primary: '#10B981',
    secondary: '#059669',
    background: '#FFFFFF',
    surface: '#F9FAFB',
    text: '#111827',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    error: '#EF4444',
    success: '#10B981',
  },
};

export const DARK_THEME: AppTheme = {
  isDark: true,
  colors: {
    primary: '#10B981',
    secondary: '#059669',
    background: '#111827',
    surface: '#1F2937',
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    border: '#374151',
    error: '#EF4444',
    success: '#10B981',
  },
};