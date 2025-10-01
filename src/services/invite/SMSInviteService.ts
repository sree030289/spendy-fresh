import { Linking, Platform } from 'react-native';
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
          request.countryCode
        );
        console.log('📱 API response received:', apiResponse);
      } catch (apiError) {
        console.error('❌ API call failed:', apiError);
        return {
          success: false,
          message: 'Failed to create friend request',
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
      return '🎉 You have a friend request on Spendy! Open the app to accept it.';
    } else {
      return '👋 You\'re invited to join Spendy! Download the app to split expenses with friends: https://spendy.app/download';
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
    const appStoreLink = 'https://apps.apple.com/app/spendy-meet-n-split';
    const playStoreLink = 'https://play.google.com/store/apps/details?id=com.spendy.meetnspli';
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
   * Get full-screen success message after SMS is sent
   */
  private getFullScreenSuccessMessage(isRegistered: boolean, recipientName?: string, senderName?: string): string {
    if (isRegistered && recipientName) {
      return `SMS sent to ${recipientName}!\n\nThey will receive a notification to accept your friend request. You'll be notified once they accept and they'll appear in your friends list.`;
    } else {
      return `SMS invite sent!\n\nThey will receive instructions to download Meet-n-Split and will be automatically added as your friend. You'll be notified once they join and they'll appear in your friends list.`;
    }
  }
}