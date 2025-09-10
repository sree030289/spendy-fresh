import AsyncStorage from '@react-native-async-storage/async-storage';

interface OTPData {
  otp: string;
  email: string;
  expiresAt: number;
  verified: boolean;
}

export class EmailService {
  private static instance: EmailService;
  private currentOTP: OTPData | null = null;

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOTP(email: string): Promise<{ success: boolean; message: string; otp?: string }> {
    try {
      const otp = this.generateOTP();
      const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes expiry

      // Store OTP data
      this.currentOTP = {
        otp,
        email: email.toLowerCase(),
        expiresAt,
        verified: false
      };

      // In a real app, you would send this via your backend API to an email service
      // For now, we'll use a cloud function approach or direct email service
      const success = await this.sendEmailViaService(email, otp);

      if (success) {
        return {
          success: true,
          message: 'OTP sent successfully to your email address',
          otp // Remove this in production - only for demo
        };
      } else {
        return {
          success: false,
          message: 'Failed to send OTP. Please try again.'
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
      if (!this.currentOTP) {
        return {
          success: false,
          message: 'No OTP found. Please request a new one.'
        };
      }

      if (this.currentOTP.email !== email.toLowerCase()) {
        return {
          success: false,
          message: 'OTP was not sent to this email address.'
        };
      }

      if (Date.now() > this.currentOTP.expiresAt) {
        this.currentOTP = null;
        return {
          success: false,
          message: 'OTP has expired. Please request a new one.'
        };
      }

      if (this.currentOTP.otp !== otp) {
        return {
          success: false,
          message: 'Invalid OTP. Please check and try again.'
        };
      }

      // Mark as verified
      this.currentOTP.verified = true;
      
      return {
        success: true,
        message: 'OTP verified successfully!'
      };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return {
        success: false,
        message: 'An error occurred while verifying OTP'
      };
    }
  }

  isOTPVerified(email: string): boolean {
    return this.currentOTP?.email === email.toLowerCase() && 
           this.currentOTP?.verified === true &&
           Date.now() <= this.currentOTP.expiresAt;
  }

  clearOTP(): void {
    this.currentOTP = null;
  }

  // Get remaining time for current OTP in seconds
  getOTPRemainingTime(): number {
    if (!this.currentOTP) return 0;
    const remaining = Math.max(0, Math.floor((this.currentOTP.expiresAt - Date.now()) / 1000));
    return remaining;
  }
}

export default EmailService;
