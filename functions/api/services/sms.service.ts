import { ENV } from '../config/env';

/**
 * SMS Service for sending invite notifications
 * 
 * This service handles SMS sending for friend invites.
 * Currently using a mock implementation but can be easily 
 * switched to Twilio, AWS SNS, or other SMS providers.
 */

export interface SMSMessage {
  to: string;
  message: string;
  from?: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
}

export class SMSService {
  private static readonly DEFAULT_FROM = '+1234567890'; // Replace with your SMS number
  
  /**
   * Send SMS message
   */
  static async sendSMS(sms: SMSMessage): Promise<SMSResult> {
    try {
      // TODO: Replace with actual SMS provider (Twilio, AWS SNS, etc.)
      return await SMSService.mockSMSSender(sms);
    } catch (error) {
      console.error('SMS sending error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SMS error'
      };
    }
  }

  /**
   * Send friend invite SMS to registered user
   */
  static async sendRegisteredUserInvite(data: {
    recipientPhone: string;
    inviterName: string;
    inviteId: string;
  }): Promise<SMSResult> {
    const message = `🎉 ${data.inviterName} sent you a friend request on Meet-n-Split! Open the app to accept it.`;
    
    return await SMSService.sendSMS({
      to: data.recipientPhone,
      message,
      from: SMSService.DEFAULT_FROM
    });
  }

  /**
   * Send signup invite SMS to unregistered user
   */
  static async sendUnregisteredUserInvite(data: {
    recipientPhone: string;
    inviterName: string;
    inviteToken: string;
    appDownloadUrl?: string;
  }): Promise<SMSResult> {
    const downloadUrl = data.appDownloadUrl || 'https://yourapp.com/download';
    const signupUrl = `${downloadUrl}?invite=${data.inviteToken}`;
    
    const message = `👋 ${data.inviterName} invited you to join Meet-n-Split! Download the app and they'll be added as your friend automatically: ${signupUrl}`;
    
    return await SMSService.sendSMS({
      to: data.recipientPhone,
      message,
      from: SMSService.DEFAULT_FROM
    });
  }

  /**
   * Send friend request accepted notification
   */
  static async sendAcceptedNotification(data: {
    recipientPhone: string;
    accepterName: string;
  }): Promise<SMSResult> {
    const message = `🎉 ${data.accepterName} accepted your friend request on Meet-n-Split!`;
    
    return await SMSService.sendSMS({
      to: data.recipientPhone,
      message,
      from: SMSService.DEFAULT_FROM
    });
  }

  /**
   * Send welcome notification for auto-accepted invites
   */
  static async sendWelcomeNotification(data: {
    recipientPhone: string;
    friendCount: number;
    friendNames: string[];
  }): Promise<SMSResult> {
    let message: string;
    
    if (data.friendCount === 1) {
      message = `🎉 Welcome to Meet-n-Split! ${data.friendNames[0]} is now your friend and ready to split expenses with you!`;
    } else {
      const namesList = data.friendNames.slice(0, 2).join(', ');
      const remaining = data.friendCount - 2;
      const friendsText = remaining > 0 ? `${namesList} and ${remaining} others` : namesList;
      message = `🎉 Welcome to Meet-n-Split! ${friendsText} are now your friends and ready to split expenses with you!`;
    }
    
    return await SMSService.sendSMS({
      to: data.recipientPhone,
      message,
      from: SMSService.DEFAULT_FROM
    });
  }

  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phone: string): boolean {
    // Basic E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  }

  /**
   * Mock SMS sender for development/testing
   * Replace this with actual SMS provider integration
   */
  private static async mockSMSSender(sms: SMSMessage): Promise<SMSResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Log the SMS that would be sent
    console.log('📱 Mock SMS sent:', {
      to: sms.to,
      from: sms.from || SMSService.DEFAULT_FROM,
      message: sms.message,
      timestamp: new Date().toISOString()
    });

    // Simulate success/failure based on phone number
    if (sms.to.includes('invalid')) {
      return {
        success: false,
        error: 'Invalid phone number'
      };
    }

    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      cost: 0.01 // Mock cost in USD
    };
  }

  /**
   * Integration method for Twilio (example)
   * Uncomment and configure when ready to use Twilio
   */
  /*
  private static async sendWithTwilio(sms: SMSMessage): Promise<SMSResult> {
    const twilio = require('twilio');
    const client = twilio(ENV.TWILIO_ACCOUNT_SID, ENV.TWILIO_AUTH_TOKEN);

    try {
      const message = await client.messages.create({
        body: sms.message,
        from: sms.from || ENV.TWILIO_PHONE_NUMBER,
        to: sms.to
      });

      return {
        success: true,
        messageId: message.sid,
        cost: parseFloat(message.price) || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  */

  /**
   * Integration method for AWS SNS (example)
   * Uncomment and configure when ready to use AWS SNS
   */
  /*
  private static async sendWithAWSSNS(sms: SMSMessage): Promise<SMSResult> {
    const AWS = require('aws-sdk');
    const sns = new AWS.SNS({ region: ENV.AWS_REGION });

    try {
      const params = {
        Message: sms.message,
        PhoneNumber: sms.to,
        MessageAttributes: {
          'AWS.SNS.SMS.SenderID': {
            DataType: 'String',
            StringValue: 'Spendy'
          }
        }
      };

      const result = await sns.publish(params).promise();

      return {
        success: true,
        messageId: result.MessageId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  */
}
