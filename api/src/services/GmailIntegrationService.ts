// src/services/GmailIntegrationService.ts
import { google } from 'googleapis';
import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

export interface GmailBill {
  emailId: string;
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  body: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  dueDate: Date;
  company: string;
  accountNumber?: string;
  invoiceNumber?: string;
  confidence: number;
}

export interface GmailConnection {
  userId: string;
  email: string;
  refreshToken: string;
  accessToken: string;
  expiresAt: Date;
  isConnected: boolean;
  lastSyncAt?: Date;
  autoSync: boolean;
  syncFrequency: 'realtime' | 'hourly' | 'daily';
  createdAt: Date;
  updatedAt: Date;
}

export class GmailIntegrationService {
  private static instance: GmailIntegrationService;
  private oauth2Client: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  static getInstance(): GmailIntegrationService {
    if (!GmailIntegrationService.instance) {
      GmailIntegrationService.instance = new GmailIntegrationService();
    }
    return GmailIntegrationService.instance;
  }

  // Generate OAuth2 URL for Gmail connection
  async generateAuthUrl(userId: string): Promise<string> {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass userId in state for security
      prompt: 'consent' // Force consent to get refresh token
    });

    return authUrl;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string, userId: string): Promise<GmailConnection> {
    try {
      const { tokens } = await this.oauth2Client.getAccessToken(code);
      
      if (!tokens.refresh_token) {
        throw new Error('No refresh token received. User may need to revoke access and reconnect.');
      }

      // Set credentials and get user info
      this.oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      const connection: GmailConnection = {
        userId,
        email: userInfo.data.email!,
        refreshToken: tokens.refresh_token!,
        accessToken: tokens.access_token!,
        expiresAt: new Date(tokens.expiry_date!),
        isConnected: true,
        autoSync: true,
        syncFrequency: 'daily',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store connection in Firestore
      await db.collection('gmailConnections').doc(userId).set(connection);

      console.log(`✅ Gmail connected for user ${userId}: ${connection.email}`);
      return connection;

    } catch (error) {
      console.error('❌ Failed to exchange code for tokens:', error);
      throw new Error('Failed to connect Gmail. Please try again.');
    }
  }

  // Check if user has Gmail connected
  async isGmailConnected(userId: string): Promise<boolean> {
    try {
      const connectionDoc = await db.collection('gmailConnections').doc(userId).get();
      
      if (!connectionDoc.exists) {
        return false;
      }

      const connection = connectionDoc.data() as GmailConnection;
      return connection.isConnected && new Date() < connection.expiresAt;
    } catch (error) {
      console.error('❌ Error checking Gmail connection:', error);
      return false;
    }
  }

  // Get Gmail connection for user
  async getGmailConnection(userId: string): Promise<GmailConnection | null> {
    try {
      const connectionDoc = await db.collection('gmailConnections').doc(userId).get();
      
      if (!connectionDoc.exists) {
        return null;
      }

      const connection = connectionDoc.data() as GmailConnection;
      
      // Check if token needs refresh
      if (new Date() >= connection.expiresAt) {
        return await this.refreshAccessToken(userId, connection);
      }

      return connection;
    } catch (error) {
      console.error('❌ Error getting Gmail connection:', error);
      return null;
    }
  }

  // Refresh access token
  private async refreshAccessToken(userId: string, connection: GmailConnection): Promise<GmailConnection> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: connection.refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      const updatedConnection: GmailConnection = {
        ...connection,
        accessToken: credentials.access_token!,
        expiresAt: new Date(credentials.expiry_date!),
        updatedAt: new Date()
      };

      // Update in Firestore
      await db.collection('gmailConnections').doc(userId).update({
        accessToken: updatedConnection.accessToken,
        expiresAt: updatedConnection.expiresAt,
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`✅ Refreshed Gmail token for user ${userId}`);
      return updatedConnection;

    } catch (error) {
      console.error('❌ Failed to refresh Gmail token:', error);
      
      // Mark as disconnected if refresh fails
      await db.collection('gmailConnections').doc(userId).update({
        isConnected: false,
        updatedAt: FieldValue.serverTimestamp()
      });

      throw new Error('Gmail connection expired. Please reconnect.');
    }
  }

  // Disconnect Gmail
  async disconnectGmail(userId: string): Promise<void> {
    try {
      await db.collection('gmailConnections').doc(userId).update({
        isConnected: false,
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`✅ Gmail disconnected for user ${userId}`);
    } catch (error) {
      console.error('❌ Error disconnecting Gmail:', error);
      throw new Error('Failed to disconnect Gmail.');
    }
  }

  // Sync bills from Gmail
  async syncBillsFromGmail(userId: string): Promise<GmailBill[]> {
    try {
      const connection = await this.getGmailConnection(userId);
      if (!connection) {
        throw new Error('Gmail not connected. Please connect first.');
      }

      // Set up authenticated Gmail client
      this.oauth2Client.setCredentials({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken
      });

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Search for bill-related emails
      const billQueries = [
        'subject:(bill OR invoice OR payment OR statement) -label:spam',
        'from:(billing OR noreply OR no-reply) -label:spam',
        'subject:(due OR overdue OR reminder) -label:spam',
        'body:(amount due OR total due OR balance) -label:spam'
      ];

      const allBills: GmailBill[] = [];
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      for (const query of billQueries) {
        try {
          const searchQuery = `${query} after:${thirtyDaysAgo.toISOString().split('T')[0]}`;
          
          const response = await gmail.users.messages.list({
            userId: 'me',
            q: searchQuery,
            maxResults: 20
          });

          if (response.data.messages) {
            for (const message of response.data.messages) {
              try {
                const bill = await this.extractBillFromMessage(gmail, message.id!, userId);
                if (bill && bill.confidence > 0.6) {
                  // Check for duplicates
                  const isDuplicate = allBills.some(existingBill => 
                    existingBill.messageId === bill.messageId ||
                    (existingBill.from === bill.from && 
                     Math.abs(existingBill.amount - bill.amount) < 0.01 &&
                     Math.abs(existingBill.date.getTime() - bill.date.getTime()) < 24 * 60 * 60 * 1000)
                  );

                  if (!isDuplicate) {
                    allBills.push(bill);
                  }
                }
              } catch (error) {
                console.warn(`⚠️ Failed to extract bill from message ${message.id}:`, error);
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️ Failed to search bills with query "${query}":`, error);
        }
      }

      // Update last sync time
      await db.collection('gmailConnections').doc(userId).update({
        lastSyncAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`✅ Found ${allBills.length} bills from Gmail for user ${userId}`);
      return allBills.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      console.error('❌ Failed to sync bills from Gmail:', error);
      throw error;
    }
  }

  // Extract bill information from Gmail message
  private async extractBillFromMessage(gmail: any, messageId: string, userId: string): Promise<GmailBill | null> {
    try {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const message = response.data;
      const headers = message.payload.headers;
      
      // Extract basic email info
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const dateStr = headers.find((h: any) => h.name === 'Date')?.value || '';
      const date = new Date(dateStr);

      // Extract email body
      let body = '';
      if (message.payload.body?.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString();
      } else if (message.payload.parts) {
        for (const part of message.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body += Buffer.from(part.body.data, 'base64').toString();
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            const htmlBody = Buffer.from(part.body.data, 'base64').toString();
            body += this.stripHtmlTags(htmlBody);
          }
        }
      }

      // Analyze if this is likely a bill
      const billAnalysis = this.analyzeBillContent(from, subject, body);
      
      if (billAnalysis.confidence < 0.6) {
        return null; // Not confident this is a bill
      }

      return {
        emailId: `${userId}_${messageId}`,
        messageId,
        from,
        subject,
        date,
        body: body.substring(0, 1000), // Truncate for storage
        title: billAnalysis.title,
        amount: billAnalysis.amount,
        currency: billAnalysis.currency,
        category: billAnalysis.category,
        dueDate: billAnalysis.dueDate,
        company: billAnalysis.company,
        accountNumber: billAnalysis.accountNumber,
        invoiceNumber: billAnalysis.invoiceNumber,
        confidence: billAnalysis.confidence
      };

    } catch (error) {
      console.error('❌ Failed to extract bill from message:', error);
      return null;
    }
  }

  // Analyze email content to extract bill information
  private analyzeBillContent(from: string, subject: string, body: string): {
    title: string;
    amount: number;
    currency: string;
    category: string;
    dueDate: Date;
    company: string;
    accountNumber?: string;
    invoiceNumber?: string;
    confidence: number;
  } {
    let confidence = 0;
    const now = new Date();
    let dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    // Extract company name from email
    const company = this.extractCompanyName(from, subject);
    
    // Check if subject/body contains bill keywords
    const billKeywords = [
      'bill', 'invoice', 'statement', 'payment', 'due', 'overdue', 
      'amount', 'total', 'balance', 'account', 'subscription'
    ];
    
    const fullText = `${subject} ${body}`.toLowerCase();
    const keywordMatches = billKeywords.filter(keyword => fullText.includes(keyword));
    confidence += (keywordMatches.length / billKeywords.length) * 0.4;

    // Extract amount
    const amount = this.extractAmount(body) || this.extractAmount(subject) || 0;
    if (amount > 0) {
      confidence += 0.3;
    }

    // Extract currency
    const currency = this.extractCurrency(body) || this.extractCurrency(subject) || 'USD';

    // Extract due date
    const extractedDueDate = this.extractDueDate(body) || this.extractDueDate(subject);
    if (extractedDueDate) {
      dueDate = extractedDueDate;
      confidence += 0.15;
    }

    // Categorize bill
    const category = this.categorizeBill(company, subject, body);
    
    // Extract account/invoice numbers
    const accountNumber = this.extractAccountNumber(body);
    const invoiceNumber = this.extractInvoiceNumber(body);
    if (accountNumber || invoiceNumber) {
      confidence += 0.1;
    }

    // Generate title
    const title = this.generateBillTitle(company, category, subject);

    // Boost confidence for known billing domains
    const knownBillingDomains = [
      'billing', 'noreply', 'no-reply', 'invoice', 'payments', 
      'accounts', 'statements', 'notifications'
    ];
    if (knownBillingDomains.some(domain => from.toLowerCase().includes(domain))) {
      confidence += 0.05;
    }

    return {
      title,
      amount,
      currency,
      category,
      dueDate,
      company,
      accountNumber,
      invoiceNumber,
      confidence: Math.min(confidence, 1.0)
    };
  }

  // Helper methods for content analysis
  private extractCompanyName(from: string, subject: string): string {
    // Extract from email domain
    const emailMatch = from.match(/@([^.]+)/);
    if (emailMatch) {
      let company = emailMatch[1];
      company = company.charAt(0).toUpperCase() + company.slice(1);
      return company;
    }

    // Extract from subject line
    const subjectWords = subject.split(' ');
    if (subjectWords.length > 0) {
      return subjectWords[0];
    }

    return 'Unknown Company';
  }

  private extractAmount(text: string): number | null {
    const amountPatterns = [
      /\$([0-9,]+\.?[0-9]*)/g,
      /([0-9,]+\.?[0-9]*)\s*USD/g,
      /total[:\s]*\$?([0-9,]+\.?[0-9]*)/gi,
      /amount[:\s]*\$?([0-9,]+\.?[0-9]*)/gi,
      /due[:\s]*\$?([0-9,]+\.?[0-9]*)/gi
    ];

    for (const pattern of amountPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const numberStr = match.replace(/[^0-9.]/g, '');
          const amount = parseFloat(numberStr);
          if (!isNaN(amount) && amount > 0 && amount < 10000) { // Reasonable amount range
            return amount;
          }
        }
      }
    }

    return null;
  }

  private extractCurrency(text: string): string | null {
    const currencyPatterns = [
      /USD/gi,
      /EUR/gi,
      /GBP/gi,
      /CAD/gi,
      /AUD/gi
    ];

    for (const pattern of currencyPatterns) {
      if (pattern.test(text)) {
        return text.match(pattern)![0].toUpperCase();
      }
    }

    if (text.includes('$')) {
      return 'USD';
    }

    return null;
  }

  private extractDueDate(text: string): Date | null {
    const dueDatePatterns = [
      /due[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
      /payment[:\s]*due[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
      /([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/g
    ];

    for (const pattern of dueDatePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const dateStr = match.replace(/[^0-9\/\-]/g, '');
          const date = new Date(dateStr);
          
          // Check if date is valid and within reasonable range (next 3 months)
          const now = new Date();
          const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          
          if (!isNaN(date.getTime()) && date > now && date < threeMonthsFromNow) {
            return date;
          }
        }
      }
    }

    return null;
  }

  private extractAccountNumber(text: string): string | null {
    const accountPatterns = [
      /account[:\s#]*([0-9]+)/gi,
      /acct[:\s#]*([0-9]+)/gi
    ];

    for (const pattern of accountPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  private extractInvoiceNumber(text: string): string | null {
    const invoicePatterns = [
      /invoice[:\s#]*([A-Za-z0-9]+)/gi,
      /inv[:\s#]*([A-Za-z0-9]+)/gi
    ];

    for (const pattern of invoicePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  private categorizeBill(company: string, subject: string, body: string): string {
    const fullText = `${company} ${subject} ${body}`.toLowerCase();
    
    const categories = {
      utilities: ['electric', 'electricity', 'power', 'gas', 'water', 'sewer', 'utility'],
      subscription: ['netflix', 'spotify', 'apple', 'google', 'microsoft', 'adobe', 'subscription'],
      finance: ['bank', 'credit', 'loan', 'mortgage', 'payment', 'visa', 'mastercard'],
      insurance: ['insurance', 'policy', 'premium', 'coverage'],
      transport: ['uber', 'lyft', 'taxi', 'parking', 'transit', 'metro'],
      shopping: ['amazon', 'ebay', 'order', 'purchase', 'receipt'],
      health: ['medical', 'dental', 'hospital', 'clinic', 'pharmacy'],
      rent: ['rent', 'lease', 'property', 'apartment'],
      food: ['restaurant', 'delivery', 'grubhub', 'doordash', 'uber eats']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => fullText.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  private generateBillTitle(company: string, category: string, subject: string): string {
    // Clean up company name
    const cleanCompany = company.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    
    // Generate appropriate title based on category
    const categoryTitles: { [key: string]: string } = {
      utilities: 'Utility Bill',
      subscription: 'Subscription',
      finance: 'Payment',
      insurance: 'Insurance Premium',
      transport: 'Transport',
      shopping: 'Purchase',
      health: 'Medical Bill',
      rent: 'Rent Payment',
      food: 'Food Order'
    };

    const categoryTitle = categoryTitles[category] || 'Bill Payment';
    
    if (cleanCompany && cleanCompany.length > 2) {
      return `${cleanCompany} ${categoryTitle}`;
    }

    // Fallback to subject if company name is not good
    if (subject && subject.length > 5) {
      return subject.substring(0, 50).trim();
    }

    return categoryTitle;
  }

  private stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}