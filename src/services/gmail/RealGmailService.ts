// src/services/gmail/RealGmailService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native'; // Removed Linking as it's not used here
// import { makeRedirectUri } from 'expo-auth-session'; // Not used if GMAIL_CONFIG.redirectUri is hardcoded
import * as AuthSession from 'expo-auth-session';
// import * as Crypto from 'expo-crypto'; // Not used in this simplified non-PKCE flow
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
  clientId: '',//'886487256037-ckipi085tqncafi7vql1tbao21h7aj3t.apps.googleusercontent.com',
  clientSecret: '',//'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',
  // This is the URI that MUST be registered in Google Cloud Console
  // and is the URI Google will redirect TO.
  redirectUri: 'https://auth.expo.io/@sree030289/spendy', 
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

// Bill detection patterns (assuming this is defined above as in your context)
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
  
  // Initialize Gmail OAuth flow with real implementation
  static async connectGmail(userId: string): Promise<boolean> {
    try {
      console.log('🔐 Starting real Gmail OAuth flow for user:', userId);
      
      const authRequestRedirectUri = GMAIL_CONFIG.redirectUri; 
      console.log('📱 Using Redirect URI for AuthRequest:', authRequestRedirectUri);

      const request = new AuthSession.AuthRequest({
        clientId: GMAIL_CONFIG.clientId,
        scopes: GMAIL_CONFIG.scopes,
        redirectUri: authRequestRedirectUri, 
        responseType: AuthSession.ResponseType.Code,
        usePKCE: false, 
        additionalParameters: {
          access_type: 'offline',
          prompt: 'consent', // Ensures user sees consent screen, good for testing refresh tokens
        },
      });

      console.log('🚀 Launching auth prompt...');
      const result = await request.promptAsync(OAUTH_DISCOVERY);
      
      // Log the entire result object to see what's happening
      console.log('📋 Full OAuth result object:', JSON.stringify(result, null, 2));

      if (result.type === 'success') {
        console.log('✅ OAuth prompt returned success. Code:', result.params.code);
        const tokens = await this.exchangeCodeForTokens(
          result.params.code,
          authRequestRedirectUri // Use the same redirect URI
        );

        await this.storeTokens(userId, tokens);
        console.log('✅ Gmail OAuth completed successfully');
        return true;
      } else if (result.type === 'error') {
        console.error('❌ OAuth prompt returned error. Params:', JSON.stringify(result.params, null, 2));
        if (result.error) { // Expo's own error object
            console.error('Error details (from AuthSession.AuthError):', JSON.stringify(result.error, null, 2));
            Alert.alert('OAuth Error', `Code: ${result.error.code}, Message: ${result.error.message}`);
        } else { // Error from provider
            Alert.alert('OAuth Error', `Type: ${result.type}. Message: ${result.params.error_description || result.params.error || 'Unknown error from provider'}`);
        }
        return false;
      } else { // 'dismiss', 'cancel', or other types
        console.log(`❌ OAuth prompt returned type: ${result.type}. Full result:`, JSON.stringify(result, null, 2));
        Alert.alert('OAuth Info', `Auth flow did not complete. Type: ${result.type}`);
        return false;
      }

    } catch (error: any) {
      console.error('❌ Gmail connection failed with exception:', error);
      Alert.alert('Connection Error', `An unexpected error occurred: ${error.message}`);
      return false;
    }
  }

  // Exchange authorization code for tokens - Updated without PKCE for development
  private static async exchangeCodeForTokens(
    code: string,
    redirectUri: string 
  ): Promise<any> {
    console.log('🔄 Exchanging code for tokens with redirectUri:', redirectUri);
    
    const tokenRequestBody = {
      client_id: GMAIL_CONFIG.clientId,
      client_secret: GMAIL_CONFIG.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };
    console.log('Token request body being sent:', JSON.stringify(tokenRequestBody, null, 2));

    const response = await fetch(OAUTH_DISCOVERY.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenRequestBody).toString(),
    });

    const responseBodyText = await response.text(); 
    console.log('Token exchange response status:', response.status);
    console.log('Token exchange response body text:', responseBodyText);

    if (!response.ok) {
      console.error('❌ Token exchange failed. Status:', response.status, 'Body:', responseBodyText);
      try {
        const errorJson = JSON.parse(responseBodyText);
        throw new Error(`Failed to exchange code for tokens: ${errorJson.error_description || errorJson.error || responseBodyText}`);
      } catch (e) {
        throw new Error(`Failed to exchange code for tokens (status ${response.status}): ${responseBodyText}`);
      }
    }

    try {
      const tokens = JSON.parse(responseBodyText);
      console.log('✅ Tokens received successfully.'); // Avoid logging tokens themselves directly unless necessary for debugging
      return tokens;
    } catch (e: any) {
      console.error('❌ Failed to parse tokens from response body:', responseBodyText, e);
      throw new Error(`Failed to parse tokens from response: ${e.message}`);
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
        await fetch(OAUTH_DISCOVERY.revocationEndpoint, { // Use defined revocation endpoint
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
      // Don't rethrow here unless you want the UI to handle it explicitly
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
        await this.disconnectGmail(userId); // Clear invalid state
        throw new Error('Please reconnect your Gmail account, refresh token is missing.');
      }


      // Check if token is expired (with 5 minute buffer)
      if (Date.now() >= (tokens.expiryDate - 300000)) {
        console.log('🔄 Access token expired or nearing expiry, refreshing...');
        
        const refreshRequestBody = {
            client_id: GMAIL_CONFIG.clientId,
            client_secret: GMAIL_CONFIG.clientSecret, // Client secret is often required for refresh
            refresh_token: tokens.refreshToken,
            grant_type: 'refresh_token',
        };
        console.log('Refresh token request body:', JSON.stringify(refreshRequestBody, null, 2));

        const refreshResponse = await fetch(OAUTH_DISCOVERY.tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(refreshRequestBody).toString(),
        });

        const refreshResponseBodyText = await refreshResponse.text();
        console.log('Refresh token response status:', refreshResponse.status);
        console.log('Refresh token response body text:', refreshResponseBodyText);


        if (!refreshResponse.ok) {
          console.error('❌ Token refresh failed. Status:', refreshResponse.status, 'Body:', refreshResponseBodyText);
          // If refresh fails (e.g., refresh token revoked), disconnect and require re-auth
          await this.disconnectGmail(userId);
          throw new Error('Failed to refresh token. Please reconnect your Gmail account.');
        }

        const refreshData = JSON.parse(refreshResponseBodyText);
        
        const newTokens: GmailTokens = {
          accessToken: refreshData.access_token,
          // Google might return a new refresh token, but often doesn't. Stick to old one if not provided.
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
      // If it's an error we threw, rethrow it, otherwise wrap it
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
        return []; // Return empty or throw, depending on desired UX
      }
      
      // Get recent emails
      const emails = await this.getRecentEmails(accessToken);
      console.log(`📧 Retrieved ${emails.length} recent emails`);
      
      // Parse emails for bills
      const bills: ParsedBill[] = [];
      for (const email of emails) {
        const parsedBill = await this.parseEmailForBill(email); // Removed accessToken as it's not used by this specific parseEmailForBill
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
      return []; // Return empty or throw
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
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=50`, // Increased maxResults slightly
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const listResponseBodyText = await listResponse.text();
      if (!listResponse.ok) {
        console.error('❌ Gmail API error (list messages):', listResponse.status, listResponseBodyText);
        throw new Error(`Gmail API error (list messages): ${listResponse.status} - ${listResponseBodyText}`);
      }
      
      const listData = JSON.parse(listResponseBodyText);
      const messageRefs = listData.messages || [];
      if (messageRefs.length === 0) {
        console.log("No messages found matching search query.");
        return [];
      }
      console.log(`Found ${messageRefs.length} message references.`);
      
      // Get full email details
      const emails = [];
      // Use Promise.all for concurrent fetching, but limit concurrency
      const batchSize = 5;
      for (let i = 0; i < Math.min(messageRefs.length, 20); i += batchSize) { // Process up to 20 messages
          const batch = messageRefs.slice(i, i + batchSize);
          const emailPromises = batch.map(async (messageRef: any) => {
            try {
                const emailResponse = await fetch(
                    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageRef.id}?format=full`, // format=full for more details
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );
                const emailResponseBodyText = await emailResponse.text();
                if (emailResponse.ok) {
                    return JSON.parse(emailResponseBodyText);
                } else {
                    console.warn(`Failed to fetch email ${messageRef.id}:`, emailResponse.status, emailResponseBodyText);
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
      throw error; // Rethrow to be caught by syncBillsFromGmail
    }
  }
  
  // Parse email for bill information
  private static async parseEmailForBill(email: any): Promise<ParsedBill | null> { // Removed accessToken as it's not used here
    try {
      const headers = email.payload?.headers || [];
      const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
      const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
      const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
      const emailDate = dateHeader ? new Date(dateHeader) : new Date(); // Fallback to now if no date header
      
      const emailBody = this.extractEmailBody(email.payload);
      if (!emailBody && !subject) { // If no body and no subject, unlikely to be useful
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
        // console.log(`Email from "${from}" with subject "${subject}" did not match any bill patterns.`);
        return null; 
      }
      // console.log(`Email from "${from}" - "${subject}" matched pattern:`, matchedPattern.category);
      
      const amount = this.extractAmount(emailBody || subject, matchedPattern.amountPatterns); // Also check subject for amount
      if (amount === null || amount <= 0) { // Amount must be positive
        // console.log("No valid amount found.");
        return null; 
      }
      
      const dueDate = this.extractDueDate(emailBody || subject, emailDate); // Also check subject for due date
      
      const bill: ParsedBill = {
        title: this.generateBillTitle(from, subject),
        description: `Auto-detected from email: ${subject.substring(0, 100)}`, // Truncate description
        amount,
        currency: 'USD', // TODO: Extract currency from email if possible
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
      console.warn('Failed to parse email for bill:', error.message, 'Subject:', email.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'subject')?.value);
      return null;
    }
  }
  
  // Extract email body content
  private static extractEmailBody(payload: any): string {
    let fullBody = "";
    const partsToSearch = payload.parts ? [...payload.parts] : [];
    if (payload.body?.data && (payload.mimeType === 'text/plain' || payload.mimeType === 'text/html')) {
        partsToSearch.unshift(payload); // Add main payload if it has body data and is text/plain or text/html
    }

    for (const part of partsToSearch) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
            try {
                fullBody += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/')) + "\n";
            } catch (e) { console.warn("Error decoding base64 (text/plain):", e); }
        } else if (part.mimeType === 'text/html' && part.body?.data) {
            try {
                const htmlContent = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                // Basic HTML to text conversion (replace with a library for better results if needed)
                fullBody += htmlContent.replace(/<style[^>]*>.*<\/style>/gs, '') // Remove style blocks
                                     .replace(/<script[^>]*>.*<\/script>/gs, '') // Remove script blocks
                                     .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
                                     .replace(/\s+/g, ' ') // Normalize whitespace
                                     .trim() + "\n";
            } catch (e) { console.warn("Error decoding base64 (text/html):", e); }
        } else if (part.parts) { // Recursively check nested parts for multipart/*
            fullBody += this.extractEmailBody(part) + "\n";
        }
    }
    return fullBody.trim();
  }
  
  // Extract amount from email content
  private static extractAmount(content: string, patterns: RegExp[]): number | null {
    if (!content) return null;
    const textContent = content.toLowerCase(); // Process on lowercase

    for (const pattern of patterns) {
      const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      let match;
      // Find all matches and prefer larger amounts or specific keywords like "total due"
      const foundAmounts = [];
      while ((match = globalPattern.exec(textContent)) !== null) {
        const amountStr = match[1] || match[2]; // Adjust based on typical regex capture groups
        if (amountStr) {
          const amount = parseFloat(amountStr.replace(/,/g, ''));
          if (!isNaN(amount) && amount > 0 && amount < 100000) { // Basic sanity check for amount
            foundAmounts.push(amount);
          }
        }
      }
      if (foundAmounts.length > 0) {
        // Heuristic: return the largest amount found if multiple, or first if only one.
        // This can be improved with more context.
        return Math.max(...foundAmounts);
      }
    }
    return null;
  }
  
  // Extract or estimate due date
  private static extractDueDate(content: string, emailDate: Date): Date {
    if (!content) { // Fallback if content is empty
        const fallbackDate = new Date(emailDate);
        fallbackDate.setDate(fallbackDate.getDate() + 15); // Default to 15 days from email date
        return fallbackDate;
    }
    const textContent = content.toLowerCase();

    const dueDatePatterns = [
      /due\s+(?:on|by|date)?\s*:?\s*(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/gi,
      /payment\s+(?:is\s+)?due\s+(?:on|by)?\s*:?\s*(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/gi,
      /statement\s+date\s*:?\s*(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/gi, // Often bills are due ~15-30 days after statement
    ];

    let potentialDates: Date[] = [];

    for (const pattern of dueDatePatterns) {
        let match;
        const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
        while ((match = globalPattern.exec(textContent)) !== null) {
            const dateStr = match[1];
            if (dateStr) {
                try {
                    // Attempt to parse various date formats
                    let parsedDate = new Date(dateStr.replace(/(st|nd|rd|th)/gi, '')); // Remove ordinal indicators
                    if (isNaN(parsedDate.getTime())) { // Try adding current year if not specified
                        parsedDate = new Date(dateStr.replace(/(st|nd|rd|th)/gi, '') + ", " + emailDate.getFullYear());
                    }
                    if (!isNaN(parsedDate.getTime()) && parsedDate >= emailDate) { // Must be on or after email date
                        potentialDates.push(parsedDate);
                    }
                } catch (e) { /* ignore parse errors */ }
            }
        }
    }
    
    if (potentialDates.length > 0) {
        potentialDates.sort((a, b) => a.getTime() - b.getTime()); // Sort by date, earliest first
        return potentialDates[0]; // Return the earliest valid due date found
    }
    
    // Fallback: estimate due date (e.g., 15-30 days from email date)
    const estimatedDueDate = new Date(emailDate);
    estimatedDueDate.setDate(estimatedDueDate.getDate() + 15); // Default to 15 days
    return estimatedDueDate;
  }
  
  // Generate a readable bill title
  private static generateBillTitle(from: string, subject: string): string {
    try {
      let companyName = '';
      const fromLower = from.toLowerCase();
      // Extract company name from email address (e.g., @company.com -> Company)
      const emailMatch = fromLower.match(/@(?:www\.)?([^\.]+)\./);
      if (emailMatch && emailMatch[1]) {
        companyName = emailMatch[1].charAt(0).toUpperCase() + emailMatch[1].slice(1);
      } else { // Fallback: try to get from display name part of 'From'
        const nameMatch = from.match(/^([^<]+)/);
        if (nameMatch && nameMatch[1]) {
            companyName = nameMatch[1].trim().split(' ')[0]; // Take first word of display name
            companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1).toLowerCase();
        }
      }

      // Clean up subject
      let cleanSubject = subject
        .replace(/^(re:|fwd?:|reminder:|action required:|your|important:)\s*/gi, '')
        .replace(/bill|invoice|statement|payment|due|receipt|order confirmation/gi, '') // Remove common bill words
        .replace(/#\d+/g, '') // Remove invoice numbers
        .replace(/\s+/g, ' ')
        .trim();
      
      // Remove company name from subject if present to avoid "Netflix Netflix Bill"
      if (companyName) {
        cleanSubject = cleanSubject.replace(new RegExp(companyName, 'gi'), '').trim();
      }

      let title = companyName;
      if (cleanSubject && cleanSubject.length > 2 && cleanSubject.length < 40 && cleanSubject.toLowerCase() !== "bill") {
        title += ` - ${cleanSubject}`;
      } else {
        title += ' Bill';
      }
      
      return title.replace(/\s*-\s*$/, " Bill").trim(); // Ensure it ends nicely
    } catch (error: any) {
      console.warn('Failed to generate bill title:', error.message);
      return subject || 'Bill Payment'; // Fallback to subject or generic
    }
  }
  
  // Check if sync is needed
  static async shouldSync(userId: string): Promise<boolean> {
    try {
      const lastSyncStr = await AsyncStorage.getItem(`${STORAGE_KEYS.LAST_GMAIL_SYNC}_${userId}`);
      if (!lastSyncStr) return true; // Sync if never synced
      
      const lastSync = new Date(lastSyncStr);
      const now = new Date();
      // Sync if last sync was more than, e.g., 6 hours ago
      const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60); 
      
      return hoursSinceSync >= 6; // Sync every 6 hours
    } catch (error) {
      console.error('❌ Failed to check sync status:', error);
      return true; // Default to sync if error checking
    }
  }
}