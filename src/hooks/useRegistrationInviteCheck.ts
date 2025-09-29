import { useEffect, useState, useRef } from 'react';
import { ApiService } from '../services/api/ApiService';
import { PendingInviteCheckResult } from '../types';

interface UseRegistrationInviteCheckProps {
  userId: string | null;
  phoneNumber: string | null;
  email: string | null;
  enabled?: boolean; // Allow manual control
}

interface UseRegistrationInviteCheckResult {
  isChecking: boolean;
  checkResult: PendingInviteCheckResult | null;
  error: string | null;
  hasChecked: boolean;
  recheckInvites: () => Promise<void>;
}

/**
 * Hook to automatically check for pending invites during user registration
 * and convert them to active friend requests or friendships
 */
export function useRegistrationInviteCheck({
  userId,
  phoneNumber,
  email,
  enabled = true
}: UseRegistrationInviteCheckProps): UseRegistrationInviteCheckResult {
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<PendingInviteCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  
  // Use ref to prevent multiple simultaneous checks
  const isCheckingRef = useRef(false);
  const apiService = useRef(ApiService.getInstance());

  const checkForPendingInvites = async (): Promise<void> => {
    // Prevent multiple simultaneous checks
    if (isCheckingRef.current) {
      console.log('🔄 Invite check already in progress, skipping...');
      return;
    }

    // Validate required parameters
    if (!userId || !phoneNumber || !email) {
      console.log('⏳ Missing required parameters for invite check:', { userId, phoneNumber, email });
      return;
    }

    if (!enabled) {
      console.log('🚫 Invite check disabled');
      return;
    }

    isCheckingRef.current = true;
    setIsChecking(true);
    setError(null);

    try {
      console.log('🔍 Checking for pending invites:', { userId, phoneNumber, email });

      const result = await apiService.current.checkPendingInvitesOnRegistration({
        userId,
        phoneNumber,
        email
      });

      console.log('✅ Pending invite check complete:', result);

      setCheckResult(result);
      setHasChecked(true);

      // Log results for debugging
      if (result.hasPendingInvites) {
        console.log(`🎉 Found ${result.invites.length} pending invites!`);
        console.log(`🤝 Auto-accepted ${result.autoAcceptedCount} invites`);
        console.log(`👥 Created ${result.newFriendships.length} new friendships`);
        
        if (result.newFriendships.length > 0) {
          console.log('New friends:', result.newFriendships);
        }
      } else {
        console.log('📭 No pending invites found');
      }

    } catch (err) {
      console.error('❌ Error checking pending invites:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to check pending invites';
      setError(errorMessage);
      
      // Set empty result on error
      setCheckResult({
        hasPendingInvites: false,
        invites: [],
        autoAcceptedCount: 0,
        newFriendships: []
      });
      setHasChecked(true);
    } finally {
      setIsChecking(false);
      isCheckingRef.current = false;
    }
  };

  // Manual recheck function
  const recheckInvites = async (): Promise<void> => {
    setHasChecked(false);
    setCheckResult(null);
    setError(null);
    await checkForPendingInvites();
  };

  // Auto-check when all required parameters are available
  useEffect(() => {
    if (userId && phoneNumber && email && enabled && !hasChecked && !isCheckingRef.current) {
      console.log('🚀 Auto-triggering pending invite check');
      checkForPendingInvites();
    }
  }, [userId, phoneNumber, email, enabled, hasChecked]);

  // Cleanup function
  useEffect(() => {
    return () => {
      isCheckingRef.current = false;
    };
  }, []);

  return {
    isChecking,
    checkResult,
    error,
    hasChecked,
    recheckInvites
  };
}

/**
 * Simpler hook for just checking if user has pending invites (no auto-conversion)
 */
export function usePendingInvitesCheck(phoneNumber: string | null, email: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const checkPendingInvites = async () => {
    if (!phoneNumber && !email) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const apiService = ApiService.getInstance();
      const result = await apiService.checkPendingInvitesOnRegistration({
        userId: '', // No user ID for simple check
        phoneNumber: phoneNumber || '',
        email: email || ''
      });
      
      setPendingInvites(result.invites || []);
    } catch (err) {
      console.error('Error checking pending invites:', err);
      setError(err instanceof Error ? err.message : 'Failed to check pending invites');
      setPendingInvites([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (phoneNumber || email) {
      checkPendingInvites();
    }
  }, [phoneNumber, email]);

  return {
    isLoading,
    pendingInvites,
    error,
    refetch: checkPendingInvites
  };
}

/**
 * Hook for handling individual friend request responses (accept/decline)
 */
export function useInviteResponse() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiService = useRef(ApiService.getInstance());

  const acceptInvite = async (requestId: string): Promise<boolean> => {
    setIsProcessing(true);
    setError(null);

    try {
      await apiService.current.acceptFriendRequest(requestId);
      console.log('✅ Friend request accepted successfully');
      return true;
    } catch (err) {
      console.error('❌ Error accepting friend request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to accept friend request';
      setError(errorMessage);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const declineInvite = async (requestId: string): Promise<boolean> => {
    setIsProcessing(true);
    setError(null);

    try {
      await apiService.current.declineFriendRequest(requestId);
      console.log('✅ Friend request declined successfully');
      return true;
    } catch (err) {
      console.error('❌ Error declining friend request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to decline friend request';
      setError(errorMessage);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    error,
    acceptInvite,
    declineInvite,
    clearError: () => setError(null)
  };
}
