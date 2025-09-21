import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '@/config/environment';

interface OTPSession {
  sessionId: string;
  email: string;
  expiresAt: number;
  verified: boolean;
}

export class EmailService {
  private static instance: EmailService;
  private currentSession: OTPSession | null = null;

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }



  async sendOTP(email: string): Promise<{ success: boolean; message: string; sessionId?: string }> {
    try {
      console.log('Sending OTP to', email, 'via EmailService');
      
      const response = await fetch(`${ENV.api.baseURL}/auth/send-password-reset-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });

      const data = await response.json();

      if (data.success && data.sessionId) {
        // Store session data
        this.currentSession = {
          sessionId: data.sessionId,
          email: email.toLowerCase(),
          expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes expiry
          verified: false
        };

        console.log('📧 Sending OTP to', email + ':', 'Session created with ID', data.sessionId);

        return {
          success: true,
          message: data.message,
          sessionId: data.sessionId
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to send OTP. Please try again.'
        };
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      return {
        success: false,
        message: 'An error occurred while sending OTP'
      };
    }
  }

  private async sendEmailViaService(email: string, otp: string): Promise<boolean> {
    try {
      // Option 1: Use Firebase Functions (recommended for production)
      // You would create a Firebase Function that uses nodemailer or SendGrid
      
      // Option 2: Use a third-party service like EmailJS (for client-side)
      // This is what we'll implement for demo purposes
      
      // Option 3: Use your own backend API
      
      // For now, we'll simulate the email sending and log the OTP
      console.log(`📧 Sending OTP to ${email}: ${otp}`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In production, you would make an actual API call here
      // const response = await fetch('YOUR_EMAIL_API_ENDPOINT', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, otp })
      // });
      // return response.ok;
      
      return true; // Simulate success for demo
    } catch (error) {
      console.error('Error in sendEmailViaService:', error);
      return false;
    }
  }

  async verifyOTP(email: string, otp: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.currentSession) {
        return {
          success: false,
          message: 'No verification session found. Please request a new OTP.'
        };
      }

      console.log('AuthService: Verifying OTP for', email);

      const response = await fetch(`${ENV.api.baseURL}/auth/verify-password-reset-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          otp: otp.trim(),
          sessionId: this.currentSession.sessionId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Mark session as verified
        this.currentSession.verified = true;
        console.log('✅ OTP verified successfully');

        return {
          success: true,
          message: data.message
        };
      } else {
        return {
          success: false,
          message: data.message || 'Invalid OTP. Please check and try again.'
        };
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return {
        success: false,
        message: 'An error occurred while verifying OTP'
      };
    }
  }

  isOTPVerified(email: string): boolean {
    return this.currentSession?.email === email.toLowerCase() && 
           this.currentSession?.verified === true &&
           Date.now() <= this.currentSession.expiresAt;
  }

  clearOTP(): void {
    this.currentSession = null;
  }

  // Get remaining time for current OTP in seconds
  getOTPRemainingTime(): number {
    if (!this.currentSession) return 0;
    const remaining = Math.max(0, Math.floor((this.currentSession.expiresAt - Date.now()) / 1000));
    return remaining;
  }

  // Get current session ID for password reset
  getSessionId(): string | null {
    return this.currentSession?.sessionId || null;
  }
}

export default EmailService;
