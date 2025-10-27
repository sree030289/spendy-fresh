import { Linking, Platform, Share, Alert } from 'react-native';
import { ApiService } from '../api/ApiService';
import { PhoneNumberService } from './PhoneNumberService';
import { CountryCode } from 'libphonenumber-js';

export interface SMSInviteResult {
  success: boolean;
  isRegistered?: boolean;
  message: string;
  requestId?: string;
  error?: string;
}

export interface SMSInviteRequest {
  phoneNumber: string;
  message?: string;
  countryCode?: CountryCode;
  senderName?: string;
  contactName?: string; // NEW: Add contact name from phone book
}

/**
 * Comprehensive SMS Invite Service
 * Handles the complete SMS invite flow including API calls and native SMS sending
 */
export class SMSInviteService {
  private static instance: SMSInviteService;
  private apiService: ApiService;

  private constructor() {
    this.apiService = ApiService.getInstance();
  }

  static getInstance(): SMSInviteService {
    if (!SMSInviteService.instance) {
      SMSInviteService.instance = new SMSInviteService();
    }
    return SMSInviteService.instance;
  }

  /**
   * Send SMS invite with complete flow:
   * 1. Validate and normalize phone number
   * 2. Check if user is registered/unregistered 
   * 3. Create appropriate friend request
   * 4. Send SMS via device native messaging
   */
  async sendSMSInvite(request: SMSInviteRequest): Promise<SMSInviteResult> {
    try {
      console.log('📱 Starting SMS invite process:', request);

      // Step 1: Validate and normalize phone number
      let normalizedPhone: string;
      try {
        normalizedPhone = PhoneNumberService.normalize(request.phoneNumber, request.countryCode);
        console.log('📱 Phone number normalized:', { original: request.phoneNumber, normalized: normalizedPhone });
      } catch (phoneError) {
        console.error('❌ Phone number validation failed:', phoneError);
        return {
          success: false,
          message: 'Invalid phone number format',
          error: phoneError instanceof Error ? phoneError.message : 'Phone validation failed'
        };
      }

      // Step 2: Create friend request via API
      let apiResponse;
      try {
        apiResponse = await this.apiService.sendSMSFriendRequest(
          request.phoneNumber,
          request.message,
          request.countryCode,
          request.contactName // Pass contact name to API
        );
        console.log('📱 API response received:', apiResponse);
      } catch (apiError: any) {
        console.error('❌ API call failed:', apiError);
        
        // Check if they're already friends
        if (apiError?.response?.data?.error === 'ALREADY_FRIENDS' || 
            apiError?.response?.status === 409) {
          const friendName = request.contactName || 'this contact';
          return {
            success: false,
            message: `You're already friends with ${friendName}! No need to send another invitation.`,
            error: 'ALREADY_FRIENDS'
          };
        }
        
        // Check if it's a self-invitation attempt
        if (apiError?.response?.data?.error === 'SELF_INVITATION') {
          return {
            success: false,
            message: 'You cannot send a friend request to yourself',
            error: 'SELF_INVITATION'
          };
        }
        
        return {
          success: false,
          message: apiError?.response?.data?.message || 'Failed to create friend request',
          error: apiError instanceof Error ? apiError.message : 'API error'
        };
      }

      console.log('📱 API Response data check:', !!apiResponse);
      // Check if we have a valid response with requestId (from your logs, requestId is at top level)
      if (!apiResponse || !(apiResponse as any).requestId) {
        console.log('📱 API response invalid, returning early');
        return {
          success: false,
          message: 'Failed to create friend request - invalid response',
          error: 'API_ERROR'
        };
      }

      console.log('📱 API success confirmed, proceeding to SMS sending...');
      
      // Step 3: Send SMS using device native messaging FIRST
      const apiResponseData = apiResponse as any;
      const phoneToUse = apiResponseData.recipientPhone || normalizedPhone;
      
      try {
        // Get user's name from request context
        const senderName = request.senderName || 'A friend';
        
        // Create enhanced SMS message with app download and deep link
        const enhancedSmsMessage = this.createEnhancedSMSMessage(senderName, apiResponseData.isRegistered);
        
        console.log('📱 Sending enhanced SMS to phone:', phoneToUse);
        console.log('📱 Enhanced SMS content:', enhancedSmsMessage);
        
        await this.sendNativeSMS(phoneToUse, enhancedSmsMessage);
        console.log('📱 Native SMS sent successfully');
        
      } catch (smsError) {
        console.error('❌ SMS sending failed:', smsError);
        // Don't fail the whole process if SMS fails - the friend request was created
        console.log('⚠️ Friend request created but SMS failed - user can manually share');
        
        return {
          success: true, // Friend request was created
          isRegistered: apiResponseData.isRegistered,
          message: `Friend request created but SMS failed to send. You may need to share the invitation manually.`,
          requestId: apiResponseData.requestId
        };
      }

      // Step 4: Return success with full-screen message
      const fullScreenMessage = this.getFullScreenSuccessMessage(
        apiResponseData.isRegistered,
        apiResponseData.recipientName,
        request.senderName
      );

      return {
        success: true,
        isRegistered: apiResponseData.isRegistered,
        message: fullScreenMessage,
        requestId: apiResponseData.requestId
      };

    } catch (error) {
      console.error('❌ SMS invite process failed:', error);
      return {
        success: false,
        message: 'SMS invite failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send SMS using device's native messaging app
   */
  private async sendNativeSMS(phoneNumber: string, message: string): Promise<void> {
    console.log('📱 sendNativeSMS called with:', { phoneNumber, messageLength: message?.length });
    try {
      if (!phoneNumber?.trim()) {
        throw new Error('Phone number is required for SMS');
      }
      if (!message?.trim()) {
        throw new Error('Message is required for SMS');
      }

      const cleanPhoneNumber = phoneNumber.trim();
      const encodedMessage = encodeURIComponent(message.trim());
      
      // Create SMS URL based on platform
      const smsUrl = Platform.OS === 'ios' 
        ? `sms:${cleanPhoneNumber}&body=${encodedMessage}`
        : `sms:${cleanPhoneNumber}?body=${encodedMessage}`;
        
      console.log('📱 Opening SMS URL:', smsUrl);

      const canOpen = await Linking.canOpenURL(smsUrl);
      if (!canOpen) {
        throw new Error('SMS not available on this device. Please share the app link manually.');
      }

      await Linking.openURL(smsUrl);
      console.log('✅ SMS app opened successfully');

    } catch (error) {
      console.error('❌ Native SMS error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown SMS error';
      
      if (errorMessage.includes('not available')) {
        throw new Error('SMS not available on this device');
      } else if (errorMessage.includes('required')) {
        throw error;
      } else {
        throw new Error('Failed to open SMS app. Please check your device settings.');
      }
    }
  }

  /**
   * Get appropriate success message based on invite type
   */
  private getSuccessMessage(isRegistered?: boolean, recipientName?: string, phoneNumber?: string): string {
    if (isRegistered && recipientName) {
      return `Friend request sent to ${recipientName}! They'll get an SMS notification to check the app.`;
    } else if (!isRegistered) {
      const displayPhone = phoneNumber ? phoneNumber.slice(-4) : 'the number';
      return `Invitation sent to ...${displayPhone}! They'll get an SMS with download link and join automatically as your friend.`;
    } else {
      return 'Friend request sent! They\'ll get an SMS notification.';
    }
  }

  /**
   * Get default SMS message for fallback
   */
  private getDefaultMessage(isRegistered?: boolean): string {
    if (isRegistered) {
      return '🎉 You have a friend request on MeetnSplit! Open the app to accept it.';
    } else {
      return '👋 You\'re invited to join MeetnSplit! Download the app to split expenses with friends: https://meetnsplit.app';
    }
  }

  /**
   * Validate phone number
   */
  static validatePhoneNumber(phoneNumber: string, countryCode?: CountryCode): boolean {
    try {
      return PhoneNumberService.validate(phoneNumber, countryCode);
    } catch {
      return false;
    }
  }

  /**
   * Format phone number for display
   */
  static formatPhoneNumber(phoneNumber: string, countryCode?: CountryCode): string {
    try {
      return PhoneNumberService.format(phoneNumber, countryCode);
    } catch {
      return phoneNumber; // Return original if formatting fails
    }
  }

  /**
   * Check if two phone numbers are the same
   */
  static arePhoneNumbersEqual(phone1: string, phone2: string, countryCode?: CountryCode): boolean {
    return PhoneNumberService.areEqual(phone1, phone2, countryCode);
  }

  /**
   * Create enhanced SMS message with app download link and deep link
   */
  private createEnhancedSMSMessage(senderName: string, isRegistered: boolean): string {
    // TODO: Replace with actual app store links
    const appStoreLink = 'https://apps.apple.com/app/meet-n-split/id6753645928';
    const playStoreLink = 'https://play.google.com/store/apps/details?id=com.meetnsplit.app.dev&hl=en_AU';
    const deepLink = 'meetnsplit://friends/pending'; // Deep link to friends pending tab
    
    if (isRegistered) {
      // For registered users - they already have the app
      return `Hello! ${senderName} wants to be friends on Meet-n-Split app. Open the app to accept their friend request: ${deepLink}`;
    } else {
      // For unregistered users - need to download app first
      return `Hello! ${senderName} wants to be friends on Meet-n-Split app for splitting expenses.\n\nDownload the app:\niOS: ${appStoreLink}\nAndroid: ${playStoreLink}\n\nOnce installed, they'll be automatically added as your friend!`;
    }
  }

  /**
   * Check if there's already a pending friend request for the given phone number
   */
  private async hasExistingPendingRequest(phoneNumber: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking for existing friend request for ${phoneNumber}`);
      
      // Get all outgoing friend requests
      const friendRequests = await this.apiService.getFriendRequests();
      const outgoingRequests = friendRequests.outgoing || [];
      
      // Check if any pending outgoing request matches this phone number
      const hasPending = outgoingRequests.some((request: any) => 
        request.status === 'pending' && request.phoneNumber === phoneNumber
      );
      
      if (hasPending) {
        console.log(`ℹ️ Found existing pending request for ${phoneNumber}`);
      }
      
      return hasPending;
    } catch (error) {
      console.error('❌ Error checking existing friend requests:', error);
      // On error, allow the invitation attempt to proceed
      return false;
    }
  }

  /**
   * Get full-screen success message after SMS is sent
   */
  private getFullScreenSuccessMessage(isRegistered: boolean, recipientName?: string, senderName?: string): string {
    if (isRegistered && recipientName) {
      return `SMS sent to ${recipientName}!\n\nThey will receive a notification to accept your friend request. You'll be notified once they accept and they'll appear in your friends list.`;
    } else {
      return `SMS invite sent!\n\nThey will receive instructions to download Meet-n-Split and will be automatically added as your friend. You'll be notified once they join and they'll appear in your friends list.`;
    }
  }

  /**
   * Send bulk SMS invites to multiple contacts as a group message
   * Opens the SMS app once with all recipients
   */
  async sendBulkSMSInvites(contacts: Array<{phoneNumber: string, name: string}>, request: Omit<SMSInviteRequest, 'phoneNumber' | 'contactName'>): Promise<{
    success: boolean;
    message: string;
    successfulInvites: string[];
    failedInvites: Array<{name: string, error: string}>;
  }> {
    try {
      console.log('📱 Starting bulk SMS invite process for', contacts.length, 'contacts');

      const successfulInvites: string[] = [];
      const failedInvites: Array<{name: string, error: string}> = [];
      const alreadyFriends: string[] = []; // Track contacts who are already friends
      const alreadyPending: string[] = []; // Track contacts with pending requests
      const phoneNumbers: string[] = [];

      // Step 1: Create friend requests via API for all contacts
      for (const contact of contacts) {
        try {
          console.log(`📱 Creating friend request for ${contact.name} (${contact.phoneNumber})`);
          
          // Validate and normalize phone number
          let normalizedPhone: string;
          try {
            normalizedPhone = PhoneNumberService.normalize(contact.phoneNumber, request.countryCode);
          } catch (phoneError) {
            console.error(`❌ Phone validation failed for ${contact.name}:`, phoneError);
            failedInvites.push({ name: contact.name, error: 'Invalid phone number' });
            continue;
          }

          // Check if there's already a pending request
          const hasPending = await this.hasExistingPendingRequest(normalizedPhone);
          if (hasPending) {
            console.log(`ℹ️ ${contact.name} already has a pending request, skipping...`);
            alreadyPending.push(contact.name);
            continue;
          }

          // Create friend request via API
          try {
            const apiResponse = await this.apiService.sendSMSFriendRequest(
              contact.phoneNumber,
              request.message,
              request.countryCode,
              contact.name
            );

            if (apiResponse && (apiResponse as any).requestId) {
              successfulInvites.push(contact.name);
              phoneNumbers.push(normalizedPhone);
              console.log(`✅ Friend request created for ${contact.name}`);
            } else {
              failedInvites.push({ name: contact.name, error: 'Failed to create friend request' });
            }
          } catch (apiError: any) {
            // Check if already friends
            if (apiError?.response?.data?.error === 'ALREADY_FRIENDS' || 
                apiError?.response?.status === 409) {
              console.log(`ℹ️ ${contact.name} is already a friend, skipping...`);
              alreadyFriends.push(contact.name);
              continue;
            }
            
            // Check if self-invitation
            if (apiError?.response?.data?.error === 'SELF_INVITATION') {
              failedInvites.push({ name: contact.name, error: 'Cannot invite yourself' });
              continue;
            }
            
            // Other API errors
            failedInvites.push({ 
              name: contact.name, 
              error: apiError?.response?.data?.message || 'Failed to create friend request' 
            });
          }
        } catch (error) {
          console.error(`❌ Error creating friend request for ${contact.name}:`, error);
          failedInvites.push({ 
            name: contact.name, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      // Step 2: If we have successful invites, send individual SMS to each recipient
      if (phoneNumbers.length > 0) {
        try {
          const senderName = request.senderName || 'A friend';
          
          console.log('📱 Sending individual SMS to', phoneNumbers.length, 'recipients');
          
          // Send individual SMS to each contact sequentially
          for (let i = 0; i < phoneNumbers.length; i++) {
            const phoneNumber = phoneNumbers[i];
            const contactName = successfulInvites[i] || 'contact';
            
            try {
              // Create individual message
              const individualMessage = this.createIndividualSMSMessage(senderName);
              
              // Open SMS app for this contact
              await this.sendIndividualSMS(phoneNumber, individualMessage);
              
              console.log(`✅ SMS opened for ${contactName} (${i + 1}/${phoneNumbers.length})`);
              
              // If not the last contact, show progress and wait for user to continue
              if (i < phoneNumbers.length - 1) {
                await new Promise<void>((resolve) => {
                  Alert.alert(
                    'Invite Sent',
                    `SMS sent to ${contactName}!\n\nReady to send to the next contact?`,
                    [
                      {
                        text: 'Skip Remaining',
                        style: 'cancel',
                        onPress: () => resolve()
                      },
                      {
                        text: `Next (${i + 2}/${phoneNumbers.length})`,
                        onPress: () => resolve()
                      }
                    ]
                  );
                });
              } else {
                // Last contact - show completion message
                Alert.alert(
                  'All Invites Sent!',
                  `Successfully sent invites to ${successfulInvites.join(', ')}`,
                  [{ text: 'Done' }]
                );
              }
            } catch (smsError) {
              console.error(`❌ SMS failed for ${contactName}:`, smsError);
              // Continue to next contact even if one fails
            }
          }
          
        } catch (error) {
          console.error('❌ Individual SMS process failed:', error);
          // Friend requests were created, just SMS failed
          return {
            success: true,
            message: `Friend requests created for ${successfulInvites.join(', ')} but SMS failed to open. You may need to share invitations manually.`,
            successfulInvites,
            failedInvites
          };
        }
      }

      // Step 3: Return results with info about all contacts
      let message = '';
      
      if (successfulInvites.length > 0) {
        message = `Individual SMS sent to ${successfulInvites.join(', ')}`;
      }
      
      if (alreadyFriends.length > 0) {
        const friendsMsg = `\n\nAlready friends: ${alreadyFriends.join(', ')} (no invitation needed)`;
        message = message ? message + friendsMsg : `Already friends with ${alreadyFriends.join(', ')}`;
      }
      
      if (alreadyPending.length > 0) {
        const pendingMsg = `\n\nPending requests: ${alreadyPending.join(', ')} (already invited)`;
        message = message ? message + pendingMsg : `Already invited ${alreadyPending.join(', ')}`;
      }
      
      if (failedInvites.length > 0) {
        message += `\n\nFailed: ${failedInvites.map(f => `${f.name} (${f.error})`).join(', ')}`;
      }
      
      // Show alert if some were already friends or pending
      if (alreadyFriends.length > 0 || alreadyPending.length > 0) {
        const parts = [];
        if (alreadyFriends.length > 0) {
          parts.push(`Already friends: ${alreadyFriends.join(', ')}`);
        }
        if (alreadyPending.length > 0) {
          parts.push(`Pending requests: ${alreadyPending.join(', ')}`);
        }
        
        Alert.alert(
          'Some Skipped',
          `${parts.join('\n\n')}${successfulInvites.length > 0 ? `\n\nSMS invites sent to ${successfulInvites.join(', ')}.` : ''}`,
          [{ text: 'OK' }]
        );
      }
      
      return {
        success: successfulInvites.length > 0 || alreadyFriends.length > 0 || alreadyPending.length > 0,
        message,
        successfulInvites,
        failedInvites
      };

    } catch (error) {
      console.error('❌ Bulk SMS invite process failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        successfulInvites: [],
        failedInvites: contacts.map(c => ({ name: c.name, error: 'Bulk invite failed' }))
      };
    }
  }

  /**
   * Send group SMS to multiple recipients
   * Uses Share API for better cross-platform support
   */
  private async sendGroupSMS(phoneNumbers: string[], message: string): Promise<void> {
    console.log('📱 sendGroupSMS called with:', { count: phoneNumbers.length, messageLength: message?.length });
    console.log('📱 Phone numbers:', phoneNumbers);
    
    try {
      if (!phoneNumbers || phoneNumbers.length === 0) {
        throw new Error('At least one phone number is required');
      }
      if (!message?.trim()) {
        throw new Error('Message is required for SMS');
      }

      // Format phone numbers list for the share message
      const phoneList = phoneNumbers.map((num, idx) => `${idx + 1}. ${num}`).join('\n');
      
      const shareMessage = `${message}\n\n📱 Send this to:\n${phoneList}`;

      console.log('📱 Opening Share dialog for group messaging');

      // Try to use Share API first (works better for group messaging)
      try {
        const result = await Share.share({
          message: shareMessage,
          title: 'Invite Friends to MeetnSplit'
        });

        if (result.action === Share.sharedAction) {
          console.log('✅ Share dialog opened successfully');
          if (result.activityType) {
            console.log('📱 Shared via:', result.activityType);
          }
        } else if (result.action === Share.dismissedAction) {
          console.log('ℹ️ Share dialog dismissed');
          // User dismissed, ask if they want to try individual SMS
          this.offerIndividualSMSFallback(phoneNumbers, message);
        }
      } catch (shareError) {
        console.error('❌ Share API error:', shareError);
        // Fallback to individual SMS if Share fails
        this.offerIndividualSMSFallback(phoneNumbers, message);
      }

    } catch (error) {
      console.error('❌ Group SMS error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to open group SMS');
    }
  }

  /**
   * Offer to send individual SMS as fallback
   */
  private offerIndividualSMSFallback(phoneNumbers: string[], message: string): void {
    Alert.alert(
      'Group Messaging Not Available',
      `Would you like to send individual messages to ${phoneNumbers.length} contacts instead?\n\nNote: You'll need to send each message separately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Individual Messages',
          onPress: async () => {
            console.log('📱 User chose individual SMS fallback');
            // Send to first contact, user will manually send to others
            if (phoneNumbers.length > 0) {
              await this.sendIndividualSMS(phoneNumbers[0], message);
            }
          }
        }
      ]
    );
  }

  /**
   * Send individual SMS to one recipient
   */
  private async sendIndividualSMS(phoneNumber: string, message: string): Promise<void> {
    try {
      const encodedMessage = encodeURIComponent(message.trim());
      const smsUrl = Platform.OS === 'ios' 
        ? `sms:${phoneNumber}&body=${encodedMessage}`
        : `sms:${phoneNumber}?body=${encodedMessage}`;
        
      console.log('📱 Opening individual SMS to:', phoneNumber);

      const canOpen = await Linking.canOpenURL(smsUrl);
      if (!canOpen) {
        throw new Error('SMS not available on this device');
      }

      await Linking.openURL(smsUrl);
      console.log('✅ Individual SMS opened successfully');
    } catch (error) {
      console.error('❌ Individual SMS error:', error);
      throw error;
    }
  }

  /**
   * Create message for group SMS
   */
  private createGroupSMSMessage(senderName: string, recipientCount: number): string {
    const appStoreLink = 'https://apps.apple.com/app/meet-n-split/id6753645928';
    const playStoreLink = 'https://play.google.com/store/apps/details?id=com.meetnsplit.app.dev&hl=en_AU';
    
    return `Hello! ${senderName} wants to connect with you on Meet-n-Split app for splitting expenses.\n\nDownload the app:\niOS: ${appStoreLink}\nAndroid: ${playStoreLink}\n\nOnce installed, you'll be automatically added as friends!`;
  }

  /**
   * Create message for individual SMS
   */
  private createIndividualSMSMessage(senderName: string): string {
    const appStoreLink = 'https://apps.apple.com/app/meet-n-split/id6753645928';
    const playStoreLink = 'https://play.google.com/store/apps/details?id=com.meetnsplit.app.dev&hl=en_AU';
    
    return `Hello! ${senderName} wants to connect with you on Meet-n-Split app for splitting expenses.\n\nDownload the app:\niOS: ${appStoreLink}\nAndroid: ${playStoreLink}\n\nOnce installed, you'll be automatically added as friends!`;
  }
}