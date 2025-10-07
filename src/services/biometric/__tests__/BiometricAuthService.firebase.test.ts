/**
 * Tests for BiometricAuthService Firebase integration
 */

import { BiometricAuthService } from '../BiometricAuthService';
import { authService } from '@/services/auth';
import { ApiService } from '@/services/api/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock the dependencies
jest.mock('@/services/auth');
jest.mock('@/services/api/ApiService');
jest.mock('@react-native-async-storage/async-storage');

describe('BiometricAuthService Firebase Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateFirebaseSession', () => {
    it('should return true when Firebase user exists and token is valid', async () => {
      const mockUser = { uid: 'user123', email: 'test@example.com' };
      const mockApiService = {
        validateStoredToken: jest.fn().mockResolvedValue(true)
      };
      
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (ApiService.getInstance as jest.Mock).mockReturnValue(mockApiService);

      const result = await BiometricAuthService.validateFirebaseSession();

      expect(authService.getCurrentUser).toHaveBeenCalled();
      expect(mockApiService.validateStoredToken).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when no Firebase user exists', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      const result = await BiometricAuthService.validateFirebaseSession();

      expect(result).toBe(false);
    });

    it('should return false when token is invalid', async () => {
      const mockUser = { uid: 'user123', email: 'test@example.com' };
      const mockApiService = {
        validateStoredToken: jest.fn().mockResolvedValue(false)
      };
      
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (ApiService.getInstance as jest.Mock).mockReturnValue(mockApiService);

      const result = await BiometricAuthService.validateFirebaseSession();

      expect(result).toBe(false);
    });

    it('should handle errors and return false', async () => {
      (authService.getCurrentUser as jest.Mock).mockImplementation(() => {
        throw new Error('Auth error');
      });

      const result = await BiometricAuthService.validateFirebaseSession();

      expect(result).toBe(false);
    });
  });

  describe('getFreshToken', () => {
    it('should get fresh token from Firebase and update ApiService', async () => {
      const mockToken = 'fresh-token-123';
      const mockApiService = {
        restoreAuthToken: jest.fn().mockResolvedValue(undefined)
      };
      
      (authService.getIdToken as jest.Mock).mockResolvedValue(mockToken);
      (ApiService.getInstance as jest.Mock).mockReturnValue(mockApiService);

      const result = await BiometricAuthService.getFreshToken();

      expect(authService.getIdToken).toHaveBeenCalledWith(true); // Force refresh
      expect(mockApiService.restoreAuthToken).toHaveBeenCalledWith(mockToken);
      expect(result).toBe(mockToken);
    });

    it('should return null if no token available', async () => {
      (authService.getIdToken as jest.Mock).mockResolvedValue(null);

      const result = await BiometricAuthService.getFreshToken();

      expect(result).toBeNull();
    });

    it('should handle errors and return null', async () => {
      (authService.getIdToken as jest.Mock).mockRejectedValue(new Error('Token error'));

      const result = await BiometricAuthService.getFreshToken();

      expect(result).toBeNull();
    });
  });
});
