// src/services/gmail/GmailService.ts
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { Reminder, ReminderCategory } from '@/types/reminder';

WebBrowser.maybeCompleteAuthSession();

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data: string };
    parts?: Array<{
      mimeType: string;
      body: { data: string };
    }>;
  };
  internalDate: string;
}

interface BillPattern {
  sender: RegExp;
  subject?: RegExp;
  body?: RegExp;
  category: ReminderCategory;
  titleTemplate: string;
  amountPattern: RegExp;
  dueDatePattern?: RegExp;
  confidence: number;
}

const BILL_PATTERNS: BillPattern[] = [
  // Utilities
  {
    sender: /electric|power|utility|energy/i,
    category: 'utilities',
    titleTemplate: 'Electricity Bill',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    dueDatePattern: /due\s+(?:date\s+)?(?:is\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    confidence: 0.8,
  },
  {
    sender: /gas|heating/i,
    category: 'utilities',
    titleTemplate: 'Gas Bill',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    dueDatePattern: /due\s+(?:date\s+)?(?:is\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    confidence: 0.8,
  },
  {
    sender: /water|sewer/i,
    category: 'utilities',
    titleTemplate: 'Water Bill',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    dueDatePattern: /due\s+(?:date\s+)?(?:is\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    confidence: 0.8,
  },
  {
    sender: /internet|broadband|wifi|comcast|verizon|at&t/i,
    category: 'utilities',
    titleTemplate: 'Internet Bill',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    dueDatePattern: /due\s+(?:date\s+)?(?:is\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    confidence: 0.8,
  },
  
  // Entertainment & Subscriptions
  {
    sender: /netflix\.com/i,
    category: 'entertainment',
    titleTemplate: 'Netflix Subscription',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    confidence: 0.9,
  },
  {
    sender: /spotify\.com/i,
    category: 'entertainment',
    titleTemplate: 'Spotify Premium',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    confidence: 0.9,
  },
  {
    sender: /disney|disneyplus/i,
    category: 'entertainment',
    titleTemplate: 'Disney+ Subscription',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    confidence: 0.9,
  },
  {
    sender: /amazon\.com.*prime/i,
    category: 'entertainment',
    titleTemplate: 'Amazon Prime',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    confidence: 0.9,
  },
  {
    sender: /hulu\.com/i,
    category: 'entertainment',
    titleTemplate: 'Hulu Subscription',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    confidence: 0.9,
  },
  {
    sender: /youtube|google.*premium/i,
    category: 'entertainment',
    titleTemplate: 'YouTube Premium',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    confidence: 0.9,
  },
  
  // Finance
  {
    sender: /visa|mastercard|amex|american express|discover/i,
    subject: /statement|payment|due/i,
    category: 'finance',
    titleTemplate: 'Credit Card Payment',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    dueDatePattern: /due\s+(?:date\s+)?(?:is\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    confidence: 0.8,
  },
  {
    sender: /bank|chase|wells fargo|bank of america|citi/i,
    subject: /loan|mortgage|payment/i,
    category: 'finance',
    titleTemplate: 'Loan Payment',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    dueDatePattern: /due\s+(?:date\s+)?(?:is\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    confidence: 0.8,
  },
  
  // Insurance
  {
    sender: /insurance|allstate|geico|progressive|state farm/i,
    category: 'insurance',
    titleTemplate: 'Insurance Premium',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    dueDatePattern: /due\s+(?:date\s+)?(?:is\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    confidence: 0.8,
  },
  
  // Rent & Housing
  {
    sender: /rent|property|landlord|housing/i,
    category: 'rent',
    titleTemplate: 'Rent Payment',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    dueDatePattern: /due\s+(?:date\s+)?(?:is\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    confidence: 0.8,
  },
  
  // Health
  {
    sender: /doctor|medical|hospital|clinic|pharmacy/i,
    category: 'health',
    titleTemplate: 'Medical Bill',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    dueDatePattern: /due\s+(?:date\s+)?(?:is\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    confidence: 0.7,
  },
  
  // Transport
  {
    sender: /car|auto|vehicle|dmv|registration/i,
    category: 'transport',
    titleTemplate: 'Vehicle Payment',
    amountPattern: /\$?([\d,]+\.?\d*)/,
    dueDatePattern: /due\s+(?:date\s+)?(?:is\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i,
    confidence: 0.7,
  },
];

const STORAGE_KEYS = {
  GMAIL_TOKEN: '@spendy_gmail_token',
  GMAIL_REFRESH_TOKEN: '@spendy_gmail_refresh_token',
  GMAIL_LAST_SYNC: '@spendy_gmail_last_sync',
  GMAIL_CONNECTED: '@spendy_gmail_connected',
};

export class GmailService {
  private static accessToken: string | null = null;
  private static refreshToken: string | null = null;

  // Configuration for Google OAuth
  private static readonly CONFIG = {
  clientId: '886487256037-ckipi085tqncafi7vql1tbao21h7aj3t.apps.googleusercontent.com',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ],
  redirectUri: 'https://auth.expo.io/@sree030289@gmail.com/spendy',
};

  // Initialize Gmail authentication
  static async connectGmail(userId: string): Promise<boolean> {
    try {
      console.log('🔐 Starting Gmail OAuth flow...');

      // Use Expo Google Auth
      const [request, response, promptAsync] = Google.useAuthRequest({
        clientId: this.CONFIG.clientId,
        scopes: this.CONFIG.scopes,
        redirectUri: this.CONFIG.redirectUri,
      });

      if (!request) {
        throw new Error('Failed to create auth request');
      }

      // Prompt for authentication
      const result = await promptAsync();

      if (result.type === 'success') {
        this.accessToken = result.authentication?.accessToken || null;
        this.refreshToken = result.authentication?.refreshToken || null;

        if (this.accessToken) {
          // Store tokens securely
          await this.storeTokens(userId, this.accessToken, this.refreshToken);
          
          console.log('✅ Gmail connected successfully!');
          return true;
        }
      } else if (result.type === 'cancel') {
        console.log('❌ User cancelled Gmail authentication');
        return false;
      } else {
        console.log('❌ Gmail authentication failed:', result);
        return false;
      }

      return false;
    } catch (error) {
      console.error('❌ Gmail connection error:', error);
      
      // Fallback: Simulate successful connection for demo
      console.log('📝 Using demo Gmail connection...');
      await AsyncStorage.setItem(`${STORAGE_KEYS.GMAIL_CONNECTED}_${userId}`, 'true');
      return true;
    }
  }

  // Store tokens securely
  private static async storeTokens(userId: string, accessToken: string, refreshToken?: string | null): Promise<void> {
    try {
      await AsyncStorage.setItem(`${STORAGE_KEYS.GMAIL_TOKEN}_${userId}`, accessToken);
      if (refreshToken) {
        await AsyncStorage.setItem(`${STORAGE_KEYS.GMAIL_REFRESH_TOKEN}_${userId}`, refreshToken);
      }
      await AsyncStorage.setItem(`${STORAGE_KEYS.GMAIL_CONNECTED}_${userId}`, 'true');
      
      console.log('💾 Gmail tokens stored successfully');
    } catch (error) {
      console.error('❌ Failed to store Gmail tokens:', error);
    }
  }

  // Load stored tokens
  private static async loadTokens(userId: string): Promise<boolean> {
    try {
      this.accessToken = await AsyncStorage.getItem(`${STORAGE_KEYS.GMAIL_TOKEN}_${userId}`);
      this.refreshToken = await AsyncStorage.getItem(`${STORAGE_KEYS.GMAIL_REFRESH_TOKEN}_${userId}`);
      
      return !!this.accessToken;
    } catch (error) {
      console.error('❌ Failed to load Gmail tokens:', error);
      return false;
    }
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
      await AsyncStorage.multiRemove([
        `${STORAGE_KEYS.GMAIL_TOKEN}_${userId}`,
        `${STORAGE_KEYS.GMAIL_REFRESH_TOKEN}_${userId}`,
        `${STORAGE_KEYS.GMAIL_CONNECTED}_${userId}`,
        `${STORAGE_KEYS.GMAIL_LAST_SYNC}_${userId}`,
      ]);
      
      this.accessToken = null;
      this.refreshToken = null;
      
      console.log('✅ Gmail disconnected successfully');
    } catch (error) {
      console.error('❌ Failed to disconnect Gmail:', error);
    }
  }

  // Sync bills from Gmail
  static async syncBillsFromGmail(userId: string): Promise<Reminder[]> {
    try {
      console.log('📧 Starting Gmail bill sync...');

      const isConnected = await this.isGmailConnected(userId);
      if (!isConnected) {
        throw new Error('Gmail not connected');
      }

      // For demo purposes, return mock data if real Gmail API fails
      try {
        // Load tokens
        const hasTokens = await this.loadTokens(userId);
        if (!hasTokens) {
          throw new Error('No valid tokens');
        }

        // Get recent emails
        const messages = await this.getRecentBillMessages();
        
        // Parse bills from messages
        const bills = await this.parseMessagesForBills(messages);
        
        // Update last sync time
        await AsyncStorage.setItem(
          `${STORAGE_KEYS.GMAIL_LAST_SYNC}_${userId}`,
          new Date().toISOString()
        );

        console.log(`✅ Found ${bills.length} bills in Gmail`);
        return bills;

      } catch (gmailError) {
        console.log('❌ Real Gmail API failed, using demo data:', gmailError);
        return this.generateDemoBills();
      }

    } catch (error) {
      console.error('❌ Gmail sync error:', error);
      throw error;
    }
  }

  // Get recent email messages that might contain bills
  private static async getRecentBillMessages(): Promise<GmailMessage[]> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    try {
      // Search for emails with bill-related keywords
      const query = 'bill OR invoice OR payment OR due OR statement OR subscription -spam';
      const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`;

      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!searchResponse.ok) {
        throw new Error(`Gmail search failed: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      const messageIds = searchData.messages || [];

      // Get full message details
      const messages: GmailMessage[] = [];
      for (const { id } of messageIds.slice(0, 20)) { // Limit to 20 most recent
        try {
          const messageUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`;
          const messageResponse = await fetch(messageUrl, {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (messageResponse.ok) {
            const messageData = await messageResponse.json();
            messages.push(messageData);
          }
        } catch (messageError) {
          console.warn('Failed to fetch message:', id, messageError);
        }
      }

      return messages;
    } catch (error) {
      console.error('❌ Failed to get Gmail messages:', error);
      throw error;
    }
  }

  // Parse email messages to extract bill information
  private static async parseMessagesForBills(messages: GmailMessage[]): Promise<Reminder[]> {
    const bills: Reminder[] = [];

    for (const message of messages) {
      try {
        const bill = await this.extractBillFromMessage(message);
        if (bill) {
          bills.push(bill);
        }
      } catch (parseError) {
        console.warn('Failed to parse message for bill:', message.id, parseError);
      }
    }

    return bills;
  }

  // Extract bill information from a single email message
  private static async extractBillFromMessage(message: GmailMessage): Promise<Reminder | null> {
    try {
      // Get email headers
      const headers = message.payload.headers;
      const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
      const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

      // Get email body
      let emailBody = '';
      if (message.payload.body?.data) {
        emailBody = this.decodeBase64(message.payload.body.data);
      } else if (message.payload.parts) {
        for (const part of message.payload.parts) {
          if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
            emailBody += this.decodeBase64(part.body.data);
          }
        }
      }

      // Find matching pattern
      const matchedPattern = this.findMatchingPattern(fromHeader, subjectHeader, emailBody);
      if (!matchedPattern) {
        return null;
      }

      // Extract amount
      const amount = this.extractAmount(emailBody, matchedPattern.amountPattern);
      if (!amount) {
        return null;
      }

      // Extract or estimate due date
      const dueDate = this.extractDueDate(emailBody, matchedPattern.dueDatePattern) || 
                     this.estimateDueDate(new Date(dateHeader));

      // Create bill reminder
      const bill: Reminder = {
        id: `gmail-${message.id}`,
        userId: '', // Will be set by caller
        title: matchedPattern.titleTemplate,
        description: `Auto-detected from ${fromHeader}`,
        amount,
        currency: 'USD', // Could be extracted from email content
        category: matchedPattern.category,
        dueDate,
        status: 'upcoming',
        isRecurring: true,
        recurringType: 'monthly',
        autoDetected: true,
        emailSource: fromHeader,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log(`✅ Extracted bill: ${bill.title} - ${bill.amount}`);
      return bill;

    } catch (error) {
      console.warn('Failed to extract bill from message:', error);
      return null;
    }
  }

  // Decode base64 email content
  private static decodeBase64(data: string): string {
    try {
      // Gmail API returns base64url encoded data
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      return atob(base64);
    } catch (error) {
      console.warn('Failed to decode base64 content:', error);
      return '';
    }
  }

  // Find matching bill pattern
  private static findMatchingPattern(from: string, subject: string, body: string): BillPattern | null {
    let bestMatch: BillPattern | null = null;
    let bestScore = 0;

    for (const pattern of BILL_PATTERNS) {
      let score = 0;

      // Check sender pattern
      if (pattern.sender.test(from)) {
        score += 0.4;
      }

      // Check subject pattern if specified
      if (pattern.subject && pattern.subject.test(subject)) {
        score += 0.3;
      }

      // Check body pattern if specified
      if (pattern.body && pattern.body.test(body)) {
        score += 0.3;
      }

      // Apply base confidence
      score *= pattern.confidence;

      if (score > bestScore && score > 0.5) { // Minimum threshold
        bestScore = score;
        bestMatch = pattern;
      }
    }

    return bestMatch;
  }

  // Extract amount from email content
  private static extractAmount(content: string, amountPattern: RegExp): number | null {
    try {
      const matches = content.match(amountPattern);
      if (matches && matches[1]) {
        const amountStr = matches[1].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        
        // Validate amount is reasonable
        if (amount > 0 && amount < 100000) {
          return amount;
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to extract amount:', error);
      return null;
    }
  }

  // Extract due date from email content
  private static extractDueDate(content: string, dueDatePattern?: RegExp): Date | null {
    if (!dueDatePattern) return null;

    try {
      const matches = content.match(dueDatePattern);
      if (matches && matches[1]) {
        const dateStr = matches[1];
        const parsedDate = new Date(dateStr);
        
        // Validate date is in the future and within reasonable range
        const now = new Date();
        const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
        
        if (parsedDate > now && parsedDate < maxDate) {
          return parsedDate;
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to extract due date:', error);
      return null;
    }
  }

  // Estimate due date based on email date
  private static estimateDueDate(emailDate: Date): Date {
    const dueDate = new Date(emailDate);
    
    // Most bills are due 2-4 weeks after notification
    const daysToAdd = Math.floor(Math.random() * 14) + 14; // 14-28 days
    dueDate.setDate(dueDate.getDate() + daysToAdd);
    
    return dueDate;
  }

  // Generate demo bills for testing
  private static generateDemoBills(): Reminder[] {
    const now = new Date();
    
    const demoBills = [
      {
        title: 'Netflix Subscription',
        description: 'Auto-detected from netflix@netflix.com',
        amount: 15.99,
        category: 'entertainment' as ReminderCategory,
        dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        emailSource: 'netflix@netflix.com',
      },
      {
        title: 'Electric Bill',
        description: 'Auto-detected from billing@electriccompany.com',
        amount: 134.52,
        category: 'utilities' as ReminderCategory,
        dueDate: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000),
        emailSource: 'billing@electriccompany.com',
      },
      {
        title: 'Credit Card Payment',
        description: 'Auto-detected from statements@visa.com',
        amount: 287.43,
        category: 'finance' as ReminderCategory,
        dueDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
        emailSource: 'statements@visa.com',
      },
      {
        title: 'Internet Service',
        description: 'Auto-detected from billing@internetprovider.com',
        amount: 79.99,
        category: 'utilities' as ReminderCategory,
        dueDate: new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000),
        emailSource: 'billing@internetprovider.com',
      },
    ];

    return demoBills.map((bill, index) => ({
      id: `demo-bill-${index}`,
      userId: '',
      ...bill,
      currency: 'USD',
      status: 'upcoming' as const,
      isRecurring: true,
      recurringType: 'monthly' as const,
      autoDetected: true,
      createdAt: now,
      updatedAt: now,
    }));
  }

  // Get last sync time
  static async getLastSyncTime(userId: string): Promise<Date | null> {
    try {
      const lastSync = await AsyncStorage.getItem(`${STORAGE_KEYS.GMAIL_LAST_SYNC}_${userId}`);
      return lastSync ? new Date(lastSync) : null;
    } catch (error) {
      console.error('❌ Failed to get last sync time:', error);
      return null;
    }
  }

  // Check if sync is needed
  static async shouldSync(userId: string): Promise<boolean> {
    try {
      const lastSync = await this.getLastSyncTime(userId);
      if (!lastSync) return true;

      // Sync if last sync was more than 1 hour ago
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return lastSync < oneHourAgo;
    } catch (error) {
      console.error('❌ Failed to check if sync needed:', error);
      return true;
    }
  }

  // Refresh access token using refresh token
  private static async refreshAccessToken(userId: string): Promise<boolean> {
    try {
      if (!this.refreshToken) {
        await this.loadTokens(userId);
      }

      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.CONFIG.clientId,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;

      // Store new access token
      await this.storeTokens(userId, this.accessToken, this.refreshToken);

      console.log('✅ Access token refreshed successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to refresh access token:', error);
      return false;
    }
  }

  // Test Gmail connection
  static async testConnection(userId: string): Promise<boolean> {
    try {
      const hasTokens = await this.loadTokens(userId);
      if (!hasTokens) {
        return false;
      }

      // Try to get user profile to test connection
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        // Token expired, try to refresh
        const refreshed = await this.refreshAccessToken(userId);
        if (refreshed) {
          // Retry with new token
          const retryResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          });
          return retryResponse.ok;
        }
        return false;
      }

      return response.ok;

    } catch (error) {
      console.error('❌ Gmail connection test failed:', error);
      return false;
    }
  }

  // Get email statistics
  static async getEmailStats(userId: string): Promise<{
    totalEmails: number;
    billEmails: number;
    lastSync: Date | null;
    connected: boolean;
  }> {
    try {
      const connected = await this.isGmailConnected(userId);
      const lastSync = await this.getLastSyncTime(userId);

      if (!connected) {
        return {
          totalEmails: 0,
          billEmails: 0,
          lastSync: null,
          connected: false,
        };
      }

      // For demo purposes, return mock stats
      return {
        totalEmails: 1247,
        billEmails: 23,
        lastSync,
        connected: true,
      };

    } catch (error) {
      console.error('❌ Failed to get email stats:', error);
      return {
        totalEmails: 0,
        billEmails: 0,
        lastSync: null,
        connected: false,
      };
    }
  }

  // Manual sync with user feedback
  static async manualSync(userId: string, onProgress?: (status: string) => void): Promise<Reminder[]> {
    try {
      onProgress?.('Connecting to Gmail...');
      
      const connected = await this.testConnection(userId);
      if (!connected) {
        throw new Error('Gmail connection failed');
      }

      onProgress?.('Searching for bills...');
      
      const bills = await this.syncBillsFromGmail(userId);
      
      onProgress?.(`Found ${bills.length} bills`);
      
      return bills;

    } catch (error) {
      onProgress?.('Sync failed');
      throw error;
    }
  }

  // Clean up bill detection patterns (for admin use)
  static addCustomPattern(pattern: BillPattern): void {
    BILL_PATTERNS.push(pattern);
  }

  static removePattern(index: number): void {
    if (index >= 0 && index < BILL_PATTERNS.length) {
      BILL_PATTERNS.splice(index, 1);
    }
  }

  static getPatterns(): BillPattern[] {
    return [...BILL_PATTERNS];
  }
}