/**
 * Example Integration: Unified Invite System
 * 
 * This file demonstrates how to integrate the unified invite system 
 * with your existing registration and friend management flows.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { UnifiedInviteService } from '../services/invite/UnifiedInviteService';
import { PhoneNumberService } from '../services/invite/PhoneNumberService';
import { useRegistrationInviteCheck } from '../hooks/useRegistrationInviteCheck';
import PendingInvitesModal from '../components/modals/PendingInvitesModal';
import { UnifiedInvite } from '../types';

// =====================================
// EXAMPLE 1: SMS INVITE FLOW
// =====================================

/**
 * Example function to send SMS invite
 * Integrate this with your existing friend invite UI
 */
export const sendSMSInvite = async (
  inviterUserId: string,
  recipientPhone: string,
  message?: string
) => {
  try {
    const inviteService = UnifiedInviteService.getInstance();
    
    // Create the invite (automatically handles registered vs unregistered users)
    const result = await inviteService.createInvite({
      inviterId: inviterUserId,
      recipientPhone: recipientPhone,
      message: message || 'Join me on Meet-n-Split to split expenses!',
      sentVia: 'SMS'
    });

    if (result.success) {
      if (result.isRegisteredUser) {
        // Flow 1: Registered user
        Alert.alert(
          'Invite Sent! 📱',
          `Friend request sent to ${recipientPhone}. They'll receive a push notification and SMS.`,
          [{ text: 'Great!', style: 'default' }]
        );
      } else {
        // Flow 2: Unregistered user
        Alert.alert(
          'Invitation Sent! 🚀',
          `SMS invitation sent to ${recipientPhone}. They'll receive a signup link.`,
          [{ text: 'Perfect!', style: 'default' }]
        );
      }
    } else {
      // Handle friendship status issues
      Alert.alert('Unable to Send Invite', result.message);
    }

    return result;
  } catch (error) {
    console.error('Send SMS invite error:', error);
    Alert.alert('Error', 'Failed to send invite. Please try again.');
    return { success: false, message: 'Failed to send invite', isRegisteredUser: false };
  }
};

// =====================================
// EXAMPLE 2: REGISTRATION INTEGRATION
// =====================================

/**
 * Example component showing how to integrate invite checking with registration
 * Add this to your registration success screen or user onboarding flow
 */
export const RegistrationInviteChecker: React.FC<{
  userId: string;
  userPhone: string;
  userEmail: string;
  onInvitesProcessed?: (friendsCount: number) => void;
}> = ({ userId, userPhone, userEmail, onInvitesProcessed }) => {
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [processedInvites, setProcessedInvites] = useState<UnifiedInvite[]>([]);

  // Use the hook to automatically check for pending invites
  const { isChecking, checkResult, error, hasChecked } = useRegistrationInviteCheck({
    userId,
    phoneNumber: userPhone,
    email: userEmail,
    enabled: true
  });

  useEffect(() => {
    if (hasChecked && checkResult?.hasPendingInvites) {
      console.log('🎉 Registration invite check complete:', checkResult);
      
      // Show welcome message for new friendships
      if (checkResult.autoAcceptedCount > 0) {
        const friendsText = checkResult.autoAcceptedCount === 1 ? 'friend' : 'friends';
        Alert.alert(
          'Welcome to Spendy! 🎉',
          `Great news! You already have ${checkResult.autoAcceptedCount} ${friendsText} waiting for you. Start splitting expenses together!`,
          [
            {
              text: 'Show Friends',
              onPress: () => {
                setProcessedInvites(checkResult.invites);
                setShowPendingModal(true);
              }
            },
            { text: 'Continue', style: 'default' }
          ]
        );
      }

      // Notify parent component
      onInvitesProcessed?.(checkResult.newFriendships.length);
    }
  }, [hasChecked, checkResult]);

  if (isChecking) {
    return (
      <View style={{ padding: 16, alignItems: 'center' }}>
        <Text>🔍 Checking for friend invitations...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ padding: 16, alignItems: 'center' }}>
        <Text style={{ color: 'red' }}>⚠️ {error}</Text>
      </View>
    );
  }

  return (
    <>
      {/* Show pending invites modal if needed */}
      <PendingInvitesModal
        visible={showPendingModal}
        invites={processedInvites}
        currentUserId={userId}
        onClose={() => setShowPendingModal(false)}
        onInviteAccepted={(inviteId) => {
          console.log('Invite accepted:', inviteId);
          // Refresh friends list or navigate to friends screen
        }}
        onInviteDeclined={(inviteId) => {
          console.log('Invite declined:', inviteId);
        }}
      />
    </>
  );
};

// =====================================
// EXAMPLE 3: PHONE NUMBER UTILITIES
// =====================================

/**
 * Example utilities for phone number handling
 * Use these in your contact selection and invite UIs
 */
export const PhoneNumberUtils = {
  /**
   * Format phone number for display in UI
   */
  formatForDisplay: (phoneNumber: string, countryCode?: string): string => {
    try {
      return PhoneNumberService.format(phoneNumber, countryCode as any);
    } catch (error) {
      return phoneNumber; // Return original if formatting fails
    }
  },

  /**
   * Validate phone number before sending invite
   */
  validatePhoneNumber: (phoneNumber: string, countryCode?: string): boolean => {
    return PhoneNumberService.validate(phoneNumber, countryCode as any);
  },

  /**
   * Normalize phone number for storage/comparison
   */
  normalizePhoneNumber: (phoneNumber: string, countryCode?: string): string => {
    return PhoneNumberService.normalize(phoneNumber, countryCode as any);
  },

  /**
   * Format phone number as user types (for input fields)
   */
  formatAsYouType: (phoneNumber: string, countryCode?: string): string => {
    return PhoneNumberService.formatAsYouType(phoneNumber, countryCode as any);
  }
};

// =====================================
// EXAMPLE 4: FRIEND INVITE UI INTEGRATION
// =====================================

/**
 * Example function to integrate with your existing friend invite UI
 * Replace your current invite logic with this unified approach
 */
export const handleFriendInvite = async (
  inviterUserId: string,
  recipientContact: string, // Can be phone or email
  inviteMethod: 'SMS' | 'EMAIL',
  message?: string
) => {
  try {
    const inviteService = UnifiedInviteService.getInstance();
    
    // Determine if contact is phone or email
    const isPhone = recipientContact.includes('+') || /^\d/.test(recipientContact);
    const isEmail = recipientContact.includes('@');

    if (!isPhone && !isEmail) {
      Alert.alert('Invalid Contact', 'Please enter a valid phone number or email address.');
      return { success: false };
    }

    // Create invite request
    const inviteRequest = {
      inviterId: inviterUserId,
      ...(isPhone ? { recipientPhone: recipientContact } : { recipientEmail: recipientContact }),
      message: message || 'Join me on Meet-n-Split to split expenses!',
      sentVia: inviteMethod
    };

    // Send the invite
    const result = await inviteService.createInvite(inviteRequest);

    if (result.success) {
      // Show appropriate success message
      const contactType = isPhone ? 'phone number' : 'email address';
      const deliveryMethod = result.isRegisteredUser ? 
        `push notification and ${inviteMethod.toLowerCase()}` : 
        `${inviteMethod.toLowerCase()} with signup link`;

      Alert.alert(
        'Invite Sent Successfully! ✅',
        `Your friend request was sent to ${recipientContact} via ${deliveryMethod}.`,
        [{ text: 'Great!', style: 'default' }]
      );
    } else {
      Alert.alert('Unable to Send Invite', result.message);
    }

    return result;
  } catch (error) {
    console.error('Friend invite error:', error);
    Alert.alert('Error', 'Failed to send invite. Please try again.');
    return { success: false, message: 'Failed to send invite' };
  }
};

// =====================================
// EXAMPLE 5: DEEP LINK HANDLER
// =====================================

/**
 * Example deep link handler for invite URLs
 * Add this to your existing deep link routing
 */
export const handleInviteDeepLink = async (inviteToken: string, currentUserId?: string) => {
  try {
    console.log('🔗 Handling invite deep link:', inviteToken);
    
    // This would typically be handled by your API
    // The invite token would be used to fetch and process the invite
    
    if (!currentUserId) {
      // User not logged in - redirect to login/register with invite context
      // You can store the invite token and process it after login
      return {
        action: 'redirect_to_auth',
        inviteToken,
        message: 'Please log in or create an account to accept this invitation'
      };
    }

    // User is logged in - fetch and display the invite
    // This would call your API to get the invite details by token
    return {
      action: 'show_invite',
      inviteToken,
      message: 'Processing friend invitation...'
    };
    
  } catch (error) {
    console.error('Deep link handler error:', error);
    return {
      action: 'error',
      message: 'Invalid or expired invitation link'
    };
  }
};

// =====================================
// EXAMPLE 6: TESTING UTILITIES
// =====================================

/**
 * Example testing utilities
 * Use these for testing the invite system in development
 */
export const InviteTestUtils = {
  /**
   * Test phone number normalization
   */
  testPhoneNormalization: () => {
    const testNumbers = [
      '+1 (555) 123-4567',
      '555-123-4567',
      '5551234567',
      '+44 20 7946 0958',
      '020 7946 0958'
    ];

    console.log('📱 Testing phone number normalization:');
    testNumbers.forEach(number => {
      try {
        const normalized = PhoneNumberService.normalize(number, 'US');
        console.log(`${number} -> ${normalized}`);
      } catch (error) {
        console.log(`${number} -> ERROR: ${error}`);
      }
    });
  },

  /**
   * Test invite creation flow
   */
  testInviteFlow: async (inviterUserId: string) => {
    console.log('🧪 Testing invite flow...');
    
    // Test with a fake phone number (won't actually send SMS in test mode)
    const testPhone = '+1234567890';
    
    try {
      const result = await sendSMSInvite(inviterUserId, testPhone, 'Test invite message');
      console.log('Test result:', result);
    } catch (error) {
      console.error('Test error:', error);
    }
  }
};

export default {
  sendSMSInvite,
  RegistrationInviteChecker,
  PhoneNumberUtils,
  handleFriendInvite,
  handleInviteDeepLink,
  InviteTestUtils
};
