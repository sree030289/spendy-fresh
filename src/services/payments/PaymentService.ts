// src/services/payments/PaymentService.ts
import { Linking, Alert, Platform } from 'react-native';
import { SplittingService } from '../firebase/splitting';

interface PaymentProvider {
  id: string;
  name: string;
  icon: string;
  deepLinkScheme: string;
  webUrl?: string;
  supportedCurrencies: string[];
  countries: string[];
  isAvailable: boolean;
}

interface PaymentRequest {
  amount: number;
  currency: string;
  recipientId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  description: string;
  reference?: string;
}

// Australian Banks
const AUSTRALIAN_BANKS: PaymentProvider[] = [
  {
    id: 'nab',
    name: 'NAB',
    icon: '🏛️',
    deepLinkScheme: 'nab-mobile://',
    webUrl: 'https://ib.nab.com.au',
    supportedCurrencies: ['AUD'],
    countries: ['AU'],
    isAvailable: true
  },
  {
    id: 'anz',
    name: 'ANZ',
    icon: '🏦',
    deepLinkScheme: 'anzau://',
    webUrl: 'https://www.anz.com.au/internet-banking',
    supportedCurrencies: ['AUD'],
    countries: ['AU'],
    isAvailable: true
  },
  {
    id: 'anz-plus',
    name: 'ANZ Plus',
    icon: '➕',
    deepLinkScheme: 'anzplus://',
    webUrl: 'https://plus.anz',
    supportedCurrencies: ['AUD'],
    countries: ['AU'],
    isAvailable: true
  },
  {
    id: 'westpac',
    name: 'Westpac',
    icon: '🏪',
    deepLinkScheme: 'wbc://',
    webUrl: 'https://online.westpac.com.au',
    supportedCurrencies: ['AUD'],
    countries: ['AU'],
    isAvailable: true
  },
  {
    id: 'commonwealth',
    name: 'CommBank',
    icon: '🟡',
    deepLinkScheme: 'cba://',
    webUrl: 'https://www.netbank.com.au',
    supportedCurrencies: ['AUD'],
    countries: ['AU'],
    isAvailable: true
  }
];

// Indian Payment Apps
const INDIAN_PAYMENT_APPS: PaymentProvider[] = [
  {
    id: 'gpay',
    name: 'Google Pay',
    icon: '🟢',
    deepLinkScheme: 'gpay://',
    webUrl: 'https://pay.google.com',
    supportedCurrencies: ['INR'],
    countries: ['IN'],
    isAvailable: true
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    icon: '🟣',
    deepLinkScheme: 'phonepe://',
    webUrl: 'https://www.phonepe.com',
    supportedCurrencies: ['INR'],
    countries: ['IN'],
    isAvailable: true
  },
  {
    id: 'paytm',
    name: 'Paytm',
    icon: '🔵',
    deepLinkScheme: 'paytm://',
    webUrl: 'https://paytm.com',
    supportedCurrencies: ['INR'],
    countries: ['IN'],
    isAvailable: true
  },
  {
    id: 'upi',
    name: 'UPI Apps',
    icon: '💳',
    deepLinkScheme: 'upi://',
    webUrl: 'https://www.npci.org.in/what-we-do/upi',
    supportedCurrencies: ['INR'],
    countries: ['IN'],
    isAvailable: true
  }
];

// International Payment Apps
const INTERNATIONAL_APPS: PaymentProvider[] = [
  {
    id: 'paypal',
    name: 'PayPal',
    icon: '💙',
    deepLinkScheme: 'paypal://',
    webUrl: 'https://www.paypal.com',
    supportedCurrencies: ['AUD', 'USD', 'EUR', 'GBP', 'INR', 'CAD', 'SGD'],
    countries: ['AU', 'US', 'UK', 'IN', 'CA', 'SG'],
    isAvailable: true
  },
  {
    id: 'wise',
    name: 'Wise',
    icon: '🌍',
    deepLinkScheme: 'wise://',
    webUrl: 'https://wise.com',
    supportedCurrencies: ['AUD', 'USD', 'EUR', 'GBP', 'INR', 'CAD', 'SGD'],
    countries: ['AU', 'US', 'UK', 'IN', 'CA', 'SG'],
    isAvailable: true
  }
];

export class PaymentService {
  private static allProviders = [...AUSTRALIAN_BANKS, ...INDIAN_PAYMENT_APPS, ...INTERNATIONAL_APPS];
  
  // Get available payment providers based on user's currency and country
  static getAvailableProviders(currency: string, country: string): PaymentProvider[] {
    return this.allProviders.filter(provider => 
      provider.supportedCurrencies.includes(currency) &&
      provider.countries.includes(country) &&
      provider.isAvailable
    );
  }
  
  // Check if app is installed
  static async isAppInstalled(deepLinkScheme: string): Promise<boolean> {
    try {
      const canOpen = await Linking.canOpenURL(deepLinkScheme);
      return canOpen;
    } catch (error) {
      console.log('App check error:', error);
      return false;
    }
  }
  
  // Generate payment deep links
  static async generatePaymentLink(provider: PaymentProvider, request: PaymentRequest): Promise<string> {
    const { amount, currency, recipientName, recipientPhone, description, reference } = request;
    
    switch (provider.id) {
      // Australian Banks
      case 'nab':
        return `${provider.deepLinkScheme}payanyone?amount=${amount}&currency=${currency}&payee=${encodeURIComponent(recipientName)}&description=${encodeURIComponent(description)}`;
        
      case 'anz':
        return `${provider.deepLinkScheme}transfer?amount=${amount}&currency=${currency}&recipient=${encodeURIComponent(recipientName)}&memo=${encodeURIComponent(description)}`;
        
      case 'anz-plus':
        return `${provider.deepLinkScheme}pay?amount=${amount}&recipient=${encodeURIComponent(recipientName)}&note=${encodeURIComponent(description)}`;
        
      case 'westpac':
        return `${provider.deepLinkScheme}transfer?amount=${amount}&payee=${encodeURIComponent(recipientName)}&description=${encodeURIComponent(description)}`;
        
      case 'commonwealth':
        return `${provider.deepLinkScheme}payanyone?amount=${amount}&payee=${encodeURIComponent(recipientName)}&description=${encodeURIComponent(description)}`;
        
      // Indian Payment Apps
      case 'gpay':
        // UPI format for Google Pay
        const gpayUPI = recipientPhone ? `${recipientPhone}@gpay` : 'merchant@upi';
        return `${provider.deepLinkScheme}pay?pa=${gpayUPI}&am=${amount}&cu=${currency}&tn=${encodeURIComponent(description)}`;
        
      case 'phonepe':
        const phonepeUPI = recipientPhone ? `${recipientPhone}@ybl` : 'merchant@upi';
        return `${provider.deepLinkScheme}pay?pa=${phonepeUPI}&am=${amount}&cu=${currency}&tn=${encodeURIComponent(description)}`;
        
      case 'paytm':
        return `${provider.deepLinkScheme}pay?pa=${recipientPhone}@paytm&am=${amount}&cu=${currency}&tn=${encodeURIComponent(description)}`;
        
      case 'upi':
        // Generic UPI link
        const upiId = recipientPhone ? `${recipientPhone}@upi` : 'merchant@upi';
        return `upi://pay?pa=${upiId}&am=${amount}&cu=${currency}&tn=${encodeURIComponent(description)}`;
        
      // International
      case 'paypal':
        return `${provider.deepLinkScheme}paypalme/${recipientName}/${amount}${currency}?note=${encodeURIComponent(description)}`;
        
      case 'wise':
        return `${provider.deepLinkScheme}send?amount=${amount}&currency=${currency}&recipient=${encodeURIComponent(recipientName)}&note=${encodeURIComponent(description)}`;
        
      default:
        throw new Error(`Unsupported payment provider: ${provider.id}`);
    }
  }
  
  // Initiate payment with deep link
  static async initiatePayment(
    providerId: string, 
    request: PaymentRequest, 
    fromUserId: string,
    toUserId: string,
    expenseId?: string,
    groupId?: string
  ): Promise<string> {
    try {
      const provider = this.allProviders.find(p => p.id === providerId);
      if (!provider) {
        throw new Error('Payment provider not found');
      }
      
      // Check if app is installed
      const isInstalled = await this.isAppInstalled(provider.deepLinkScheme);
      
      // Generate payment link
      const paymentLink = await this.generatePaymentLink(provider, request);
      
      // Create payment record in Firebase
      const paymentId = await SplittingService.createPayment({
        fromUserId,
        toUserId,
        expenseId,
        groupId,
        amount: request.amount,
        currency: request.currency,
        method: this.getPaymentMethod(provider.id),
        provider: provider.id,
        status: 'pending',
        deepLinkUsed: isInstalled
      });
      
      if (isInstalled) {
        // Open app with deep link
        const opened = await Linking.openURL(paymentLink);
        if (!opened) {
          throw new Error('Failed to open payment app');
        }
      } else {
        // Show options to install app or use web
        Alert.alert(
          `${provider.name} Not Installed`,
          `Would you like to install ${provider.name} or continue with web browser?`,
          [
            {
              text: 'Install App',
              onPress: () => this.openAppStore(provider.id)
            },
            {
              text: 'Use Web',
              onPress: () => provider.webUrl && Linking.openURL(provider.webUrl)
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      }
      
      return paymentId;
      
    } catch (error) {
      console.error('Initiate payment error:', error);
      throw error;
    }
  }
  
  private static getPaymentMethod(providerId: string): 'bank' | 'paypal' | 'gpay' | 'phonepe' | 'paytm' | 'upi' {
    if (['nab', 'anz', 'anz-plus', 'westpac', 'commonwealth'].includes(providerId)) {
      return 'bank';
    } else if (providerId === 'paypal') {
      return 'paypal';
    } else if (providerId === 'gpay') {
      return 'gpay';
    } else if (providerId === 'phonepe') {
      return 'phonepe';
    } else if (providerId === 'paytm') {
      return 'paytm';
    } else {
      return 'upi';
    }
  }
  
  private static async openAppStore(providerId: string): Promise<void> {
    const appStoreUrls: Record<string, { ios: string; android: string }> = {
      nab: {
        ios: 'https://apps.apple.com/au/app/nab-mobile-banking/id476203002',
        android: 'https://play.google.com/store/apps/details?id=au.com.nab.mobile'
      },
      anz: {
        ios: 'https://apps.apple.com/au/app/anz-australia/id471824740',
        android: 'https://play.google.com/store/apps/details?id=com.anz.android'
      },
      'anz-plus': {
        ios: 'https://apps.apple.com/au/app/anz-plus/id1536738408',
        android: 'https://play.google.com/store/apps/details?id=au.com.anzx.plus'
      },
      westpac: {
        ios: 'https://apps.apple.com/au/app/westpac-mobile-banking/id353916972',
        android: 'https://play.google.com/store/apps/details?id=org.westpac.bank'
      },
      commonwealth: {
        ios: 'https://apps.apple.com/au/app/commbank/id310251202',
        android: 'https://play.google.com/store/apps/details?id=com.cba.android.netbank'
      },
      gpay: {
        ios: 'https://apps.apple.com/in/app/google-pay/id1193357041',
        android: 'https://play.google.com/store/apps/details?id=com.google.android.apps.nfc.payment'
      },
      phonepe: {
        ios: 'https://apps.apple.com/in/app/phonepe-payments-recharges/id1170055821',
        android: 'https://play.google.com/store/apps/details?id=com.phonepe.app'
      },
      paytm: {
        ios: 'https://apps.apple.com/in/app/paytm-payments-bank/id473941634',
        android: 'https://play.google.com/store/apps/details?id=net.one97.paytm'
      },
      paypal: {
        ios: 'https://apps.apple.com/app/paypal-mobile-cash/id283646709',
        android: 'https://play.google.com/store/apps/details?id=com.paypal.android.p2pmobile'
      },
      wise: {
        ios: 'https://apps.apple.com/app/wise-ex-transferwise/id612261027',
        android: 'https://play.google.com/store/apps/details?id=com.transferwise.android'
      }
    };
    
    const urls = appStoreUrls[providerId];
    if (urls) {
      const storeUrl = Platform.OS === 'ios' ? urls.ios : urls.android;
      await Linking.openURL(storeUrl);
    }
  }
  
  // Handle payment result (called when user returns from payment app)
  static async handlePaymentResult(paymentId: string, status: 'completed' | 'failed' | 'cancelled'): Promise<void> {
    try {
      // Update payment status in Firebase
      // This would be called from deep link handling or manual confirmation
      
      // Create notification based on result
      if (status === 'completed') {
        // Update friend balances
        // Send success notifications
        console.log('Payment completed successfully');
      } else if (status === 'failed') {
        console.log('Payment failed');
      } else {
        console.log('Payment cancelled');
      }
      
    } catch (error) {
      console.error('Handle payment result error:', error);
    }
  }
  
  // Generate payment summary for different providers
  static generatePaymentSummary(provider: PaymentProvider, request: PaymentRequest): string {
    const { amount, currency, recipientName, description } = request;
    
    switch (provider.id) {
      case 'nab':
      case 'anz':
      case 'anz-plus':
      case 'westpac':
      case 'commonwealth':
        return `Pay ${recipientName} ${currency} ${amount} via ${provider.name} for ${description}`;
        
      case 'gpay':
      case 'phonepe':
      case 'paytm':
      case 'upi':
        return `Send ₹${amount} to ${recipientName} via ${provider.name} for ${description}`;
        
      case 'paypal':
        return `Send ${currency} ${amount} to ${recipientName} via PayPal for ${description}`;
        
      default:
        return `Send ${currency} ${amount} to ${recipientName} via ${provider.name}`;
    }
  }
  
  // Get payment instructions for manual payment
  static getPaymentInstructions(provider: PaymentProvider, request: PaymentRequest): string[] {
    const { amount, currency, recipientName, description } = request;
    
    switch (provider.id) {
      case 'nab':
        return [
          '1. Open NAB Mobile Banking app',
          '2. Go to "Pay Anyone"',
          `3. Enter recipient: ${recipientName}`,
          `4. Enter amount: ${currency} ${amount}`,
          `5. Add reference: ${description}`,
          '6. Review and send payment'
        ];
        
      case 'anz':
        return [
          '1. Open ANZ Mobile app',
          '2. Select "Transfer & Pay"',
          '3. Choose "Pay Anyone"',
          `4. Enter recipient: ${recipientName}`,
          `5. Enter amount: ${currency} ${amount}`,
          `6. Add description: ${description}`,
          '7. Confirm payment'
        ];
        
      case 'gpay':
        return [
          '1. Open Google Pay app',
          '2. Tap "Send money"',
          `3. Enter phone number or UPI ID`,
          `4. Enter amount: ₹${amount}`,
          `5. Add note: ${description}`,
          '6. Confirm payment'
        ];
        
      case 'phonepe':
        return [
          '1. Open PhonePe app',
          '2. Tap "Send Money"',
          `3. Enter mobile number or UPI ID`,
          `4. Enter amount: ₹${amount}`,
          `5. Add remark: ${description}`,
          '6. Proceed to pay'
        ];
        
      default:
        return [
          `1. Open ${provider.name} app`,
          `2. Send ${currency} ${amount}`,
          `3. To: ${recipientName}`,
          `4. Note: ${description}`
        ];
    }
  }
}

// SMS and WhatsApp Integration
export class InviteService {
  
  // Send SMS invite
  static async sendSMSInvite(phoneNumber: string, message: string): Promise<void> {
    try {
      const smsUrl = Platform.OS === 'ios' 
        ? `sms:${phoneNumber}&body=${encodeURIComponent(message)}`
        : `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
        
      const canOpen = await Linking.canOpenURL(smsUrl);
      if (canOpen) {
        await Linking.openURL(smsUrl);
      } else {
        throw new Error('SMS not available');
      }
    } catch (error) {
      console.error('Send SMS error:', error);
      throw error;
    }
  }
  
  // Send WhatsApp invite
  static async sendWhatsAppInvite(phoneNumber: string, message: string): Promise<void> {
    try {
      // Format phone number (remove + and spaces)
      const formattedNumber = phoneNumber.replace(/[\s+]/g, '');
      
      const whatsappUrl = `whatsapp://send?phone=${formattedNumber}&text=${encodeURIComponent(message)}`;
      
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to web WhatsApp
        const webUrl = `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Send WhatsApp error:', error);
      throw error;
    }
  }
  
  // Generate invite messages
  static generateFriendInviteMessage(senderName: string, appName: string = 'Spendy'): string {
    return `Hi! ${senderName} invited you to join ${appName} - the best app for splitting expenses with friends. Download now: https://spendy.app/download`;
  }
  
  static generateGroupInviteMessage(senderName: string, groupName: string, inviteCode: string): string {
    return `${senderName} invited you to join "${groupName}" on Spendy! Use invite code: ${inviteCode} or click: https://spendy.app/join/${inviteCode}`;
  }
  
  static generateExpenseNotification(senderName: string, amount: number, currency: string, description: string): string {
    return `${senderName} added a new expense: ${description} for ${currency} ${amount}. Check Spendy app for details.`;
  }
}