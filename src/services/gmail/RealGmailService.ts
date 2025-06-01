// src/services/gmail/RealGmailService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
import { ReminderCategory } from '@/types/reminder';

interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
}

interface ParsedBill {
  title: string;
  description?: string;
  amount: number;
  currency: string;
  category: ReminderCategory;
  dueDate: Date;
  emailSource: string;
  emailSubject: string;
  emailDate: Date;
}

const STORAGE_KEYS = {
  GMAIL_TOKENS: '@spendy_gmail_tokens',
  GMAIL_CONNECTED: '@spendy_gmail_connected',
  LAST_GMAIL_SYNC: '@spendy_last_gmail_sync',
};

// Gmail API Configuration
const GMAIL_CONFIG: GmailConfig = {
  clientId: 'YOUR_GMAIL_CLIENT_ID', // You'll replace this with your real client ID
  clientSecret: 'YOUR_GMAIL_CLIENT_SECRET', // You'll replace this
  redirectUri: 'com.yourcompany.spendy://oauth', // Your app's redirect URI
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
};

// Bill detection patterns
const BILL_PATTERNS = [
  {
    senders: ['billing@netflix.com', 'noreply@netflix.com'],
    subjects: ['payment', 'billing', 'invoice', 'subscription'],
    category: 'entertainment' as ReminderCategory,
    amountPatterns: [/\$(\d+\.?\d*)/g, /USD\s*(\d+\.?\d*)/g],
  },
  {
    senders: ['billing@adobe.com', 'noreply@adobe.com'],
    subjects: ['creative cloud', 'subscription', 'payment'],
    category: 'subscription' as ReminderCategory,
    amountPatterns: [/\$(\d+\.?\d*)/g, /USD\s*(\d+\.?\d*)/g],
  },
  {
    senders: ['billing@verizon.com', 'vzwpix.com'],
    subjects: ['bill', 'payment', 'wireless'],
    category: 'utilities' as ReminderCategory,
    amountPatterns: [/\$(\d+\.?\d*)/g, /USD\s*(\d+\.?\d*)/g],
  },
  {
    senders: ['aws-billing@amazon.com', 'billing@aws.amazon.com'],
    subjects: ['aws', 'billing', 'invoice'],
    category: 'subscription' as ReminderCategory,
    amountPatterns: [/\$(\d+\.?\d*)/g, /USD\s*(\d+\.?\d*)/g],
  },
  {
    senders: ['noreply@microsoft.com', 'billing@microsoft.com'],
    subjects: ['office', '365', 'subscription', 'billing'],
    category: 'subscription' as ReminderCategory,
    amountPatterns: [/\$(\d+\.?\d*)/g, /USD\s*(\d+\.?\d*)/g],
  },
  // Utility companies
  {
    senders: ['@electric', '@power', '@utility'],
    subjects: ['electric', 'power', 'utility', 'bill'],
    category: 'utilities' as ReminderCategory,
    amountPatterns: [/\$(\d+\.?\d*)/g, /USD\s*(\d+\.?\d*)/g],
  },
  // Credit cards
  {
    senders: ['@visa.com', '@mastercard.com', '@amex.com', '@chase.com', '@citi.com'],
    subjects: ['statement', 'payment', 'credit card', 'bill'],
    category: 'finance' as ReminderCategory,
    amountPatterns: [/minimum.*\$(\d+\.?\d*)/gi, /payment.*\$(\d+\.?\d*)/gi],
  },
  // Insurance
  {
    senders: ['@geico.com', '@allstate.com', '@statefarm.com'],
    subjects: ['insurance', 'premium', 'payment'],
    category: 'insurance' as ReminderCategory,
    amountPatterns: [/\$(\d+\.?\d*)/g, /USD\s*(\d+\.?\d*)/g],
  },
];

export class RealGmailService {
  
  // Initialize Gmail OAuth flow
  static async connectGmail(userId: string): Promise<boolean> {
    try {
      console.log('🔐 Starting Gmail OAuth flow...');
      
      // Step 1: Build OAuth URL
      const authUrl = this.buildOAuthUrl();
      
      // Step 2: Open OAuth URL
      const supported = await Linking.canOpenURL(authUrl);
      if (!supported) {
        throw new Error('Cannot open OAuth URL');
      }
      
      Alert.alert(
        'Connect Gmail',
        'You will be redirected to Google to sign in and authorize Spendy to read your emails for bill detection.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              await Linking.openURL(authUrl);
              // Note: In a real implementation, you'd handle the redirect back to your app
              // and exchange the authorization code for tokens
              console.log('🔗 Opened OAuth URL, waiting for redirect...');
            }
          }
        ]
      );
      
      // For demo purposes, simulate successful connection
      // In real implementation, this would happen after OAuth callback
      setTimeout(async () => {
        await this.simulateSuccessfulConnection(userId);
      }, 3000);
      
      return true;
    } catch (error) {
      console.error('❌ Gmail connection failed:', error);
      throw new Error(`Failed to connect Gmail: ${error.message}`);
    }
  }
  
  // Build OAuth URL
  private static buildOAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: GMAIL_CONFIG.clientId,
      redirect_uri: GMAIL_CONFIG.redirectUri,
      scope: GMAIL_CONFIG.scopes.join(' '),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
    });
    
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  
  // Simulate successful connection (replace with real OAuth callback handling)
  private static async simulateSuccessfulConnection(userId: string): Promise<void> {
    const mockTokens: GmailTokens = {
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
      expiryDate: Date.now() + (60 * 60 * 1000), // 1 hour from now
    };
    
    await AsyncStorage.setItem(`${STORAGE_KEYS.GMAIL_TOKENS}_${userId}`, JSON.stringify(mockTokens));
    await AsyncStorage.setItem(`${STORAGE_KEYS.GMAIL_CONNECTED}_${userId}`, 'true');
    
    console.log('✅ Gmail connection simulated successfully');
  }
  
  // Check if Gmail is connected
  static async isGmailConnected(userId: string): Promise<boolean> {
    try {
      const connected = await AsyncStorage.getItem(`${STORAGE_KEYS.GMAIL_CONNECTED}_${userId}`);
      return connected === 'true';
    } catch (error) {
      console.error('❌ Failed to check Gmail connection:', error);
      return false;
    }
  }
  
  // Disconnect Gmail
  static async disconnectGmail(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${STORAGE_KEYS.GMAIL_TOKENS}_${userId}`);
      await AsyncStorage.removeItem(`${STORAGE_KEYS.GMAIL_CONNECTED}_${userId}`);
      await AsyncStorage.removeItem(`${STORAGE_KEYS.LAST_GMAIL_SYNC}_${userId}`);
      
      console.log('✅ Gmail disconnected successfully');
    } catch (error) {
      console.error('❌ Failed to disconnect Gmail:', error);
      throw error;
    }
  }
  
  // Get stored tokens
  private static async getStoredTokens(userId: string): Promise<GmailTokens | null> {
    try {
      const tokensStr = await AsyncStorage.getItem(`${STORAGE_KEYS.GMAIL_TOKENS}_${userId}`);
      return tokensStr ? JSON.parse(tokensStr) : null;
    } catch (error) {
      console.error('❌ Failed to get stored tokens:', error);
      return null;
    }
  }
  
  // Refresh access token if needed
  private static async refreshTokenIfNeeded(userId: string): Promise<string | null> {
    try {
      const tokens = await this.getStoredTokens(userId);
      if (!tokens) return null;
      
      // Check if token is expired
      if (Date.now() >= tokens.expiryDate) {
        console.log('🔄 Access token expired, refreshing...');
        
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: GMAIL_CONFIG.clientId,
            client_secret: GMAIL_CONFIG.clientSecret,
            refresh_token: tokens.refreshToken,
            grant_type: 'refresh_token',
          }).toString(),
        });
        
        if (!refreshResponse.ok) {
          throw new Error('Failed to refresh token');
        }
        
        const refreshData = await refreshResponse.json();
        
        const newTokens: GmailTokens = {
          accessToken: refreshData.access_token,
          refreshToken: tokens.refreshToken, // Keep existing refresh token
          expiryDate: Date.now() + (refreshData.expires_in * 1000),
        };
        
        await AsyncStorage.setItem(`${STORAGE_KEYS.GMAIL_TOKENS}_${userId}`, JSON.stringify(newTokens));
        
        console.log('✅ Access token refreshed successfully');
        return newTokens.accessToken;
      }
      
      return tokens.accessToken;
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      return null;
    }
  }
  
  // Sync bills from Gmail
  static async syncBillsFromGmail(userId: string): Promise<ParsedBill[]> {
    try {
      console.log('📧 Starting Gmail bill sync...');
      
      const accessToken = await this.refreshTokenIfNeeded(userId);
      if (!accessToken) {
        throw new Error('No valid access token available');
      }
      
      // Get recent emails
      const emails = await this.getRecentEmails(accessToken);
      console.log(`📧 Retrieved ${emails.length} recent emails`);
      
      // Parse emails for bills
      const bills: ParsedBill[] = [];
      for (const email of emails) {
        const parsedBill = await this.parseEmailForBill(email, accessToken);
        if (parsedBill) {
          bills.push(parsedBill);
        }
      }
      
      // Update last sync time
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.LAST_GMAIL_SYNC}_${userId}`,
        new Date().toISOString()
      );
      
      console.log(`✅ Gmail sync completed: ${bills.length} bills found`);
      return bills;
      
    } catch (error) {
      console.error('❌ Gmail sync failed:', error);
      throw new Error(`Gmail sync failed: ${error.message}`);
    }
  }
  
  // Get recent emails from Gmail API
  private static async getRecentEmails(accessToken: string): Promise<any[]> {
    try {
      // Search for emails that might contain bills (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateQuery = `after:${thirtyDaysAgo.getFullYear()}/${thirtyDaysAgo.getMonth() + 1}/${thirtyDaysAgo.getDate()}`;
      
      const searchQuery = `${dateQuery} (billing OR payment OR invoice OR statement OR subscription OR bill OR due)`;
      
      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=50`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      if (!listResponse.ok) {
        throw new Error(`Gmail API error: ${listResponse.status}`);
      }
      
      const listData = await listResponse.json();
      const messageIds = listData.messages || [];
      
      // Get full email details
      const emails = [];
      for (const message of messageIds.slice(0, 20)) { // Limit to 20 for performance
        try {
          const emailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );
          
          if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            emails.push(emailData);
          }
        } catch (emailError) {
          console.warn('Failed to fetch email:', emailError);
        }
      }
      
      return emails;
    } catch (error) {
      console.error('❌ Failed to get recent emails:', error);
      throw error;
    }
  }
  
  // Parse email for bill information
  private static async parseEmailForBill(email: any, accessToken: string): Promise<ParsedBill | null> {
    try {
      const headers = email.payload?.headers || [];
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';
      
      // Extract email content
      const emailBody = this.extractEmailBody(email.payload);
      
      // Check if this email matches any bill patterns
      const matchedPattern = BILL_PATTERNS.find(pattern => {
        const senderMatch = pattern.senders.some(sender => 
          from.toLowerCase().includes(sender.toLowerCase())
        );
        const subjectMatch = pattern.subjects.some(keyword => 
          subject.toLowerCase().includes(keyword.toLowerCase())
        );
        
        return senderMatch || subjectMatch;
      });
      
      if (!matchedPattern) {
        return null; // Not a bill email
      }
      
      // Extract amount
      const amount = this.extractAmount(emailBody, matchedPattern.amountPatterns);
      if (!amount) {
        return null; // No amount found
      }
      
      // Extract or estimate due date
      const dueDate = this.extractDueDate(emailBody, new Date(date));
      
      // Create bill object
      const bill: ParsedBill = {
        title: this.generateBillTitle(from, subject),
        description: `Auto-detected from email: ${subject}`,
        amount,
        currency: 'USD', // TODO: Extract currency from email
        category: matchedPattern.category,
        dueDate,
        emailSource: from,
        emailSubject: subject,
        emailDate: new Date(date),
      };
      
      console.log('📋 Parsed bill:', {
        title: bill.title,
        amount: bill.amount,
        dueDate: bill.dueDate.toISOString(),
        from,
      });
      
      return bill;
    } catch (error) {
      console.warn('Failed to parse email for bill:', error);
      return null;
    }
  }
  
  // Extract email body content
  private static extractEmailBody(payload: any): string {
    try {
      if (payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64').toString();
      }
      
      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
            if (part.body?.data) {
              return Buffer.from(part.body.data, 'base64').toString();
            }
          }
        }
      }
      
      return '';
    } catch (error) {
      console.warn('Failed to extract email body:', error);
      return '';
    }
  }
  
  // Extract amount from email content
  private static extractAmount(content: string, patterns: RegExp[]): number | null {
    try {
      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
          // Extract number from the first match
          const numberMatch = matches[0].match(/(\d+\.?\d*)/);
          if (numberMatch) {
            return parseFloat(numberMatch[1]);
          }
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to extract amount:', error);
      return null;
    }
  }
  
  // Extract or estimate due date
  private static extractDueDate(content: string, emailDate: Date): Date {
    try {
      // Look for due date patterns
      const dueDatePatterns = [
        /due\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+\d{4})/gi,
        /payment\s+(?:is\s+)?due\s+(\w+\s+\d{1,2},?\s+\d{4})/gi,
        /(\d{1,2}\/\d{1,2}\/\d{4})/g,
      ];
      
      for (const pattern of dueDatePatterns) {
        const match = content.match(pattern);
        if (match) {
          const dateStr = match[1] || match[0];
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime()) && parsedDate > emailDate) {
            return parsedDate;
          }
        }
      }
      
      // If no due date found, estimate based on email date (usually 30 days for bills)
      const estimatedDueDate = new Date(emailDate);
      estimatedDueDate.setDate(estimatedDueDate.getDate() + 30);
      
      return estimatedDueDate;
    } catch (error) {
      console.warn('Failed to extract due date:', error);
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 30);
      return fallbackDate;
    }
  }
  
  // Generate a readable bill title
  private static generateBillTitle(from: string, subject: string): string {
    try {
      // Extract company name from email address
      const emailMatch = from.match(/@([^.]+)/);
      const domain = emailMatch ? emailMatch[1] : '';
      
      // Clean up common prefixes/suffixes
      let company = domain
        .replace(/billing|noreply|no-reply/gi, '')
        .replace(/[-_]/g, ' ')
        .trim();
      
      // Capitalize first letter
      company = company.charAt(0).toUpperCase() + company.slice(1);
      
      // If we can extract a service name from subject, use it
      const serviceMatch = subject.match(/(subscription|bill|payment|invoice)\s+(?:for\s+)?([^,.\n]+)/gi);
      if (serviceMatch) {
        return `${company} ${serviceMatch[0]}`;
      }
      
      // Fallback to company + "Bill"
      return `${company} Bill`;
    } catch (error) {
      console.warn('Failed to generate bill title:', error);
      return 'Bill Payment';
    }
  }
  
  // Check if sync is needed
  static async shouldSync(userId: string): Promise<boolean> {
    try {
      const lastSyncStr = await AsyncStorage.getItem(`${STORAGE_KEYS.LAST_GMAIL_SYNC}_${userId}`);
      if (!lastSyncStr) return true;
      
      const lastSync = new Date(lastSyncStr);
      const now = new Date();
      const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
      
      // Sync every 24 hours
      return hoursSinceSync >= 24;
    } catch (error) {
      console.error('❌ Failed to check sync status:', error);
      return true;
    }
  }
}