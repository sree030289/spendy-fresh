export const useTheme = () => {
  return {
    theme: {
      colors: {
        primary: '#10B981',
        background: '#FFFFFF',
        surface: '#F9FAFB',
        text: '#111827',
        textSecondary: '#6B7280',
        border: '#E5E7EB',
        error: '#EF4444',
      }
    },
    isDark: false,
    toggleTheme: () => {}
  };
};