/**
 * Tests for ApiService Firebase token management
 */

import { ApiService } from '../ApiService';
import { authService } from '@/services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock the dependencies
jest.mock('@/services/auth');
jest.mock('@react-native-async-storage/async-storage');

describe('ApiService Token Management', () => {
  let apiService: ApiService;

  beforeEach(() => {
    apiService = ApiService.getInstance();
    jest.clearAllMocks();
  });

  describe('refreshToken', () => {
    it('should get fresh token from Firebase and update storage', async () => {
      const mockToken = 'fresh-firebase-token-123';
      (authService.getIdToken as jest.Mock).mockResolvedValue(mockToken);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const result = await apiService.refreshToken();

      expect(authService.getIdToken).toHaveBeenCalledWith(true); // Force refresh
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@spendy_auth_token', mockToken);
      expect(result).toBe(mockToken);
    });

    it('should return null if no Firebase user exists', async () => {
      (authService.getIdToken as jest.Mock).mockResolvedValue(null);

      const result = await apiService.refreshToken();

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      (authService.getIdToken as jest.Mock).mockRejectedValue(new Error('Firebase error'));

      const result = await apiService.refreshToken();

      expect(result).toBeNull();
    });
  });

  describe('validateStoredToken', () => {
    it('should return true if Firebase user exists and token is valid', async () => {
      const mockUser = { uid: 'user123', email: 'test@example.com' };
      const mockToken = 'valid-token-123';
      
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (authService.getIdToken as jest.Mock).mockResolvedValue(mockToken);

      const result = await apiService.validateStoredToken();

      expect(authService.getCurrentUser).toHaveBeenCalled();
      expect(authService.getIdToken).toHaveBeenCalledWith(false); // Don't force refresh
      expect(result).toBe(true);
    });

    it('should return false if no Firebase user exists', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      const result = await apiService.validateStoredToken();

      expect(result).toBe(false);
    });

    it('should return false if token cannot be obtained', async () => {
      const mockUser = { uid: 'user123', email: 'test@example.com' };
      
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (authService.getIdToken as jest.Mock).mockResolvedValue(null);

      const result = await apiService.validateStoredToken();

      expect(result).toBe(false);
    });

    it('should handle errors and return false', async () => {
      (authService.getCurrentUser as jest.Mock).mockImplementation(() => {
        throw new Error('Auth error');
      });

      const result = await apiService.validateStoredToken();

      expect(result).toBe(false);
    });
  });
});
