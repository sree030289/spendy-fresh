// src/services/gmail/RealGmailService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { ReminderCategory } from '@/types/reminder';

// CRITICAL: Add this line to handle auth session completion
WebBrowser.maybeCompleteAuthSession();

interface GmailConfig {
  clientId: string;
  clientSecret: string;
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

// Gmail API Configuration - Updated for proper OAuth flow
const GMAIL_CONFIG: GmailConfig = {
  // Use the correct client ID that matches your Google Cloud Console
  clientId: '886487256037-brml4e3c7gcdndlvso0dunrp1v18jhq1.apps.googleusercontent.com',
  clientSecret: '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',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
};

// OAuth discovery endpoints
const OAUTH_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Bill detection patterns (keeping your existing patterns)
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
  
  // Fixed Gmail OAuth flow
  static async connectGmail(userId: string): Promise<boolean> {
    try {
      console.log('🔐 Starting Gmail OAuth flow for user:', userId);
      
      // Use different redirect URI strategies based on environment
      let redirectUri;
      if (__DEV__) {
        // For Expo development client, use HTTPS proxy URL required for sensitive scopes
        redirectUri = makeRedirectUri({
          useProxy: true,
        });
      } else {
        // For production builds
        redirectUri = makeRedirectUri({
          scheme: 'spendy',
          path: 'oauth',
        });
      }
      
      console.log('📱 Generated Redirect URI:', redirectUri);

      const request = new AuthSession.AuthRequest({
        clientId: GMAIL_CONFIG.clientId,
        scopes: GMAIL_CONFIG.scopes,
        redirectUri: redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true, // Enable PKCE for security
        extraParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      });

      console.log('🚀 Launching auth prompt...');
      const result = await request.promptAsync(OAUTH_DISCOVERY);
      // Note: useProxy is automatically true when using Expo's auth proxy URL
      
      console.log('📋 Full OAuth result:', JSON.stringify(result, null, 2));

      if (result.type === 'success') {
        console.log('✅ OAuth success. Code:', result.params.code);
        const tokens = await this.exchangeCodeForTokens(
          result.params.code,
          redirectUri,
          request.codeVerifier // Pass the code verifier for PKCE
        );

        await this.storeTokens(userId, tokens);
        console.log('✅ Gmail OAuth completed successfully');
        return true;
      } else if (result.type === 'error') {
        console.error('❌ OAuth error:', JSON.stringify(result.params, null, 2));
        Alert.alert('OAuth Error', result.params.error_description || result.params.error || 'Unknown error');
        return false;
      } else {
        console.log(`❌ OAuth dismissed or cancelled. Type: ${result.type}`);
        return false;
      }

    } catch (error: any) {
      console.error('❌ Gmail connection failed:', error);
      Alert.alert('Connection Error', `Failed to connect Gmail: ${error.message}`);
      return false;
    }
  }

  // Updated token exchange with PKCE support
  private static async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<any> {
    console.log('🔄 Exchanging code for tokens...');
    
    const tokenRequestBody: any = {
      client_id: GMAIL_CONFIG.clientId,
      client_secret: GMAIL_CONFIG.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };

    // Add PKCE code verifier if present
    if (codeVerifier) {
      tokenRequestBody.code_verifier = codeVerifier;
    }

    console.log('Token request body:', JSON.stringify(tokenRequestBody, null, 2));

    const response = await fetch(OAUTH_DISCOVERY.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenRequestBody).toString(),
    });

    const responseText = await response.text();
    console.log('Token exchange response status:', response.status);

    if (!response.ok) {
      console.error('❌ Token exchange failed:', responseText);
      try {
        const errorJson = JSON.parse(responseText);
        throw new Error(`Token exchange failed: ${errorJson.error_description || errorJson.error}`);
      } catch (e) {
        throw new Error(`Token exchange failed (${response.status}): ${responseText}`);
      }
    }

    try {
      const tokens = JSON.parse(responseText);
      console.log('✅ Tokens received successfully');
      return tokens;
    } catch (e: any) {
      console.error('❌ Failed to parse tokens:', e);
      throw new Error(`Failed to parse tokens: ${e.message}`);
    }
  }

  // Store tokens securely
  private static async storeTokens(userId: string, tokens: any): Promise<void> {
    const tokenData: GmailTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: Date.now() + (tokens.expires_in * 1000),
    };

    await AsyncStorage.setItem(
      `${STORAGE_KEYS.GMAIL_TOKENS}_${userId}`,
      JSON.stringify(tokenData)
    );
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.GMAIL_CONNECTED}_${userId}`,
      'true'
    );
    
    console.log('💾 Tokens stored successfully');
  }
  
  // Check if Gmail is connected
  static async isGmailConnected(userId: string): Promise<boolean> {
    try {
      const connected = await AsyncStorage.getItem(`${STORAGE_KEYS.GMAIL_CONNECTED}_${userId}`);
      const tokens = await this.getStoredTokens(userId);
      
      return connected === 'true' && tokens !== null;
    } catch (error) {
      console.error('❌ Failed to check Gmail connection:', error);
      return false;
    }
  }
  
  // Disconnect Gmail
  static async disconnectGmail(userId: string): Promise<void> {
    try {
      const tokens = await this.getStoredTokens(userId);
      
      if (tokens?.accessToken) {
        // Revoke the token
        await fetch(OAUTH_DISCOVERY.revocationEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `token=${tokens.accessToken}`,
        });
      }

      await AsyncStorage.removeItem(`${STORAGE_KEYS.GMAIL_TOKENS}_${userId}`);
      await AsyncStorage.removeItem(`${STORAGE_KEYS.GMAIL_CONNECTED}_${userId}`);
      await AsyncStorage.removeItem(`${STORAGE_KEYS.LAST_GMAIL_SYNC}_${userId}`);
      
      console.log('✅ Gmail disconnected successfully');
    } catch (error) {
      console.error('❌ Failed to disconnect Gmail:', error);
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
      if (!tokens) {
        console.log('No stored tokens found for refresh.');
        return null;
      }
      if (!tokens.refreshToken) {
        console.log('No refresh token available. Need to re-authenticate.');
        await this.disconnectGmail(userId);
        throw new Error('Please reconnect your Gmail account, refresh token is missing.');
      }

      // Check if token is expired (with 5 minute buffer)
      if (Date.now() >= (tokens.expiryDate - 300000)) {
        console.log('🔄 Access token expired, refreshing...');
        
        const refreshRequestBody = {
          client_id: GMAIL_CONFIG.clientId,
          client_secret: GMAIL_CONFIG.clientSecret,
          refresh_token: tokens.refreshToken,
          grant_type: 'refresh_token',
        };

        const refreshResponse = await fetch(OAUTH_DISCOVERY.tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(refreshRequestBody).toString(),
        });

        const refreshResponseText = await refreshResponse.text();

        if (!refreshResponse.ok) {
          console.error('❌ Token refresh failed:', refreshResponseText);
          await this.disconnectGmail(userId);
          throw new Error('Failed to refresh token. Please reconnect your Gmail account.');
        }

        const refreshData = JSON.parse(refreshResponseText);
        
        const newTokens: GmailTokens = {
          accessToken: refreshData.access_token,
          refreshToken: refreshData.refresh_token || tokens.refreshToken,
          expiryDate: Date.now() + (refreshData.expires_in * 1000),
        };
        
        await AsyncStorage.setItem(
          `${STORAGE_KEYS.GMAIL_TOKENS}_${userId}`,
          JSON.stringify(newTokens)
        );
        
        console.log('✅ Token refreshed successfully');
        return newTokens.accessToken;
      }

      return tokens.accessToken;
    } catch (error: any) {
      console.error('❌ Failed to refresh token:', error.message);
      if (error.message.includes('Please reconnect')) throw error;
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }
  
  // Sync bills from Gmail
  static async syncBillsFromGmail(userId: string): Promise<ParsedBill[]> {
    try {
      console.log('📧 Starting Gmail bill sync...');
      
      const accessToken = await this.refreshTokenIfNeeded(userId);
      if (!accessToken) {
        Alert.alert("Gmail Sync Error", "Could not get Gmail access. Please try connecting Gmail again.");
        return [];
      }
      
      // Get recent emails
      const emails = await this.getRecentEmails(accessToken);
      console.log(`📧 Retrieved ${emails.length} recent emails`);
      
      // Parse emails for bills
      const bills: ParsedBill[] = [];
      for (const email of emails) {
        const parsedBill = await this.parseEmailForBill(email);
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
      
    } catch (error: any) {
      console.error('❌ Gmail sync failed:', error.message);
      Alert.alert("Gmail Sync Error", `Failed to sync emails: ${error.message}`);
      return [];
    }
  }
  
  // Get recent emails from Gmail API
  private static async getRecentEmails(accessToken: string): Promise<any[]> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateQuery = `after:${thirtyDaysAgo.getFullYear()}/${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}/${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;
      
      const searchQuery = `${dateQuery} (subject:(billing OR payment OR invoice OR statement OR subscription OR bill OR due) OR from:(billing OR noreply OR support OR accounts))`;
      console.log("Gmail search query:", searchQuery);
      
      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=50`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const listResponseText = await listResponse.text();
      if (!listResponse.ok) {
        console.error('❌ Gmail API error:', listResponse.status, listResponseText);
        throw new Error(`Gmail API error: ${listResponse.status} - ${listResponseText}`);
      }
      
      const listData = JSON.parse(listResponseText);
      const messageRefs = listData.messages || [];
      if (messageRefs.length === 0) {
        console.log("No messages found matching search query.");
        return [];
      }
      console.log(`Found ${messageRefs.length} message references.`);
      
      // Get full email details
      const emails = [];
      const batchSize = 5;
      for (let i = 0; i < Math.min(messageRefs.length, 20); i += batchSize) {
        const batch = messageRefs.slice(i, i + batchSize);
        const emailPromises = batch.map(async (messageRef: any) => {
          try {
            const emailResponse = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageRef.id}?format=full`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            const emailResponseText = await emailResponse.text();
            if (emailResponse.ok) {
              return JSON.parse(emailResponseText);
            } else {
              console.warn(`Failed to fetch email ${messageRef.id}:`, emailResponse.status, emailResponseText);
              return null;
            }
          } catch (emailError: any) {
            console.warn(`Error fetching email ${messageRef.id}:`, emailError.message);
            return null;
          }
        });
        const resolvedEmails = await Promise.all(emailPromises);
        emails.push(...resolvedEmails.filter(email => email !== null));
      }
      
      console.log(`Successfully fetched details for ${emails.length} emails.`);
      return emails;
    } catch (error: any) {
      console.error('❌ Failed to get recent emails:', error.message);
      throw error;
    }
  }
  
  // Parse email for bill information - keeping your existing implementation
  private static async parseEmailForBill(email: any): Promise<ParsedBill | null> {
    try {
      const headers = email.payload?.headers || [];
      const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
      const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
      const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
      const emailDate = dateHeader ? new Date(dateHeader) : new Date();
      
      const emailBody = this.extractEmailBody(email.payload);
      if (!emailBody && !subject) {
        return null;
      }
      
      const matchedPattern = BILL_PATTERNS.find(pattern => {
        const fromLower = from.toLowerCase();
        const subjectLower = subject.toLowerCase();
        const senderMatch = pattern.senders.some(sender => 
          fromLower.includes(sender.toLowerCase())
        );
        const subjectMatch = pattern.subjects.some(keyword => 
          subjectLower.includes(keyword.toLowerCase())
        );
        
        return senderMatch || subjectMatch;
      });
      
      if (!matchedPattern) {
        return null; 
      }
      
      const amount = this.extractAmount(emailBody || subject, matchedPattern.amountPatterns);
      if (amount === null || amount <= 0) {
        return null; 
      }
      
      const dueDate = this.extractDueDate(emailBody || subject, emailDate);
      
      const bill: ParsedBill = {
        title: this.generateBillTitle(from, subject),
        description: `Auto-detected from email: ${subject.substring(0, 100)}`,
        amount,
        currency: 'USD',
        category: matchedPattern.category,
        dueDate,
        emailSource: from,
        emailSubject: subject,
        emailDate: emailDate,
      };
      
      console.log('📋 Parsed bill:', {
        title: bill.title,
        amount: bill.amount,
        dueDate: bill.dueDate.toISOString(),
        from,
      });
      
      return bill;
    } catch (error: any) {
      console.warn('Failed to parse email for bill:', error.message);
      return null;
    }
  }
  
  // Extract email body content - keeping your existing implementation
  private static extractEmailBody(payload: any): string {
    let fullBody = "";
    const partsToSearch = payload.parts ? [...payload.parts] : [];
    if (payload.body?.data && (payload.mimeType === 'text/plain' || payload.mimeType === 'text/html')) {
      partsToSearch.unshift(payload);
    }

    for (const part of partsToSearch) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        try {
          fullBody += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/')) + "\n";
        } catch (e) { console.warn("Error decoding base64 (text/plain):", e); }
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        try {
          const htmlContent = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          fullBody += htmlContent.replace(/<style[^>]*>.*<\/style>/gs, '')
                               .replace(/<script[^>]*>.*<\/script>/gs, '')
                               .replace(/<[^>]+>/g, ' ')
                               .replace(/\s+/g, ' ')
                               .trim() + "\n";
        } catch (e) { console.warn("Error decoding base64 (text/html):", e); }
      } else if (part.parts) {
        fullBody += this.extractEmailBody(part) + "\n";
      }
    }
    return fullBody.trim();
  }
  
  // Extract amount from email content - keeping your existing implementation
  private static extractAmount(content: string, patterns: RegExp[]): number | null {
    if (!content) return null;
    const textContent = content.toLowerCase();

    for (const pattern of patterns) {
      const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      let match;
      const foundAmounts = [];
      while ((match = globalPattern.exec(textContent)) !== null) {
        const amountStr = match[1] || match[2];
        if (amountStr) {
          const amount = parseFloat(amountStr.replace(/,/g, ''));
          if (!isNaN(amount) && amount > 0 && amount < 100000) {
            foundAmounts.push(amount);
          }
        }
      }
      if (foundAmounts.length > 0) {
        return Math.max(...foundAmounts);
      }
    }
    return null;
  }
  
  // Extract or estimate due date - keeping your existing implementation
  private static extractDueDate(content: string, emailDate: Date): Date {
    if (!content) {
      const fallbackDate = new Date(emailDate);
      fallbackDate.setDate(fallbackDate.getDate() + 15);
      return fallbackDate;
    }
    const textContent = content.toLowerCase();

    const dueDatePatterns = [
      /due\s+(?:on|by|date)?\s*:?\s*(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/gi,
      /payment\s+(?:is\s+)?due\s+(?:on|by)?\s*:?\s*(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/gi,
      /statement\s+date\s*:?\s*(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/gi,
    ];

    let potentialDates: Date[] = [];

    for (const pattern of dueDatePatterns) {
      let match;
      const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      while ((match = globalPattern.exec(textContent)) !== null) {
        const dateStr = match[1];
        if (dateStr) {
          try {
            let parsedDate = new Date(dateStr.replace(/(st|nd|rd|th)/gi, ''));
            if (isNaN(parsedDate.getTime())) {
              parsedDate = new Date(dateStr.replace(/(st|nd|rd|th)/gi, '') + ", " + emailDate.getFullYear());
            }
            if (!isNaN(parsedDate.getTime()) && parsedDate >= emailDate) {
              potentialDates.push(parsedDate);
            }
          } catch (e) { /* ignore parse errors */ }
        }
      }
    }
    
    if (potentialDates.length > 0) {
      potentialDates.sort((a, b) => a.getTime() - b.getTime());
      return potentialDates[0];
    }
    
    const estimatedDueDate = new Date(emailDate);
    estimatedDueDate.setDate(estimatedDueDate.getDate() + 15);
    return estimatedDueDate;
  }
  
  // Generate a readable bill title - keeping your existing implementation
  private static generateBillTitle(from: string, subject: string): string {
    try {
      let companyName = '';
      const fromLower = from.toLowerCase();
      const emailMatch = fromLower.match(/@(?:www\.)?([^\.]+)\./);
      if (emailMatch && emailMatch[1]) {
        companyName = emailMatch[1].charAt(0).toUpperCase() + emailMatch[1].slice(1);
      } else {
        const nameMatch = from.match(/^([^<]+)/);
        if (nameMatch && nameMatch[1]) {
          companyName = nameMatch[1].trim().split(' ')[0];
          companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1).toLowerCase();
        }
      }

      let cleanSubject = subject
        .replace(/^(re:|fwd?:|reminder:|action required:|your|important:)\s*/gi, '')
        .replace(/bill|invoice|statement|payment|due|receipt|order confirmation/gi, '')
        .replace(/#\d+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (companyName) {
        cleanSubject = cleanSubject.replace(new RegExp(companyName, 'gi'), '').trim();
      }

      let title = companyName;
      if (cleanSubject && cleanSubject.length > 2 && cleanSubject.length < 40 && cleanSubject.toLowerCase() !== "bill") {
        title += ` - ${cleanSubject}`;
      } else {
        title += ' Bill';
      }
      
      return title.replace(/\s*-\s*$/, " Bill").trim();
    } catch (error: any) {
      console.warn('Failed to generate bill title:', error.message);
      return subject || 'Bill Payment';
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
      
      return hoursSinceSync >= 6;
    } catch (error) {
      console.error('❌ Failed to check sync status:', error);
      return true;
    }
  }
}