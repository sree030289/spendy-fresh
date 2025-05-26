export interface User {
  id: string;
  fullName: string;
  email: string;
  country: string;
  mobile: string;
  currency: string;
  profilePicture?: string;
  biometricEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Country {
  code: string;
  name: string;
  currency: string;
  phoneCode: string;
  flag: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AppTheme {
  isDark: boolean;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
  };
}