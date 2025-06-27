import { Reminder, ReminderCategory } from "@/types";

export class GmailService {
  private static instance: GmailService;
  private accessToken: string | null = null;
  
  static getInstance(): GmailService {
    if (!GmailService.instance) {
      GmailService.instance = new GmailService();
    }
    return GmailService.instance;
  }

  async authenticate(): Promise<boolean> {
    try {
      // Initialize Google APIs
      await this.loadGoogleAPIs();
      
      const authInstance = gapi.auth2.getAuthInstance();
      if (!authInstance.isSignedIn.get()) {
        await authInstance.signIn();
      }
      
      this.accessToken = authInstance.currentUser.get().getAuthResponse().access_token;
      return true;
    } catch (error) {
      console.error('Gmail authentication failed:', error);
      return false;
    }
  }

  private async loadGoogleAPIs(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof gapi !== 'undefined') {
        gapi.load('auth2:client', {
          callback: () => {
            gapi.client.init({
              apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
              clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
              scope: 'https://www.googleapis.com/auth/gmail.readonly'
            }).then(resolve).catch(reject);
          },
          onerror: reject
        });
      } else {
        reject(new Error('Google APIs not loaded'));
      }
    });
  }

  async scanEmailsForBills(): Promise<Reminder[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await gapi.client.gmail.users.messages.list({
        userId: 'me',
        q: 'subject:(bill OR invoice OR payment OR subscription OR due) newer_than:30d',
        maxResults: 50
      });

      const messages = response.result.messages || [];
      const reminders: Reminder[] = [];

      for (const message of messages) {
        const detail = await gapi.client.gmail.users.messages.get({
          userId: 'me',
          id: message.id
        });

        const reminder = this.parseEmailForReminder(detail.result);
        if (reminder) {
          reminders.push(reminder);
        }
      }

      return reminders;
    } catch (error) {
      console.error('Error scanning emails:', error);
      return [];
    }
  }

  private parseEmailForReminder(email: any): Reminder | null {
    try {
      const headers = email.payload.headers;
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';

      // AI-powered parsing (simplified)
      const billPatterns = [
        { pattern: /netflix/i, category: 'Subscriptions' as ReminderCategory, amount: 15.99 },
        { pattern: /spotify/i, category: 'Subscriptions' as ReminderCategory, amount: 9.99 },
        { pattern: /electric|electricity|power/i, category: 'Utilities' as ReminderCategory, amount: 120 },
        { pattern: /gas|natural gas/i, category: 'Utilities' as ReminderCategory, amount: 80 },
        { pattern: /water|sewer/i, category: 'Utilities' as ReminderCategory, amount: 60 },
        { pattern: /credit card|visa|mastercard/i, category: 'Bills' as ReminderCategory, amount: 250 },
        { pattern: /mortgage|home loan/i, category: 'Loans' as ReminderCategory, amount: 1500 },
        { pattern: /car payment|auto loan/i, category: 'Loans' as ReminderCategory, amount: 400 },
        { pattern: /insurance/i, category: 'Insurance' as ReminderCategory, amount: 200 }
      ];

      const matchedPattern = billPatterns.find(p => p.pattern.test(subject) || p.pattern.test(from));
      
      if (matchedPattern) {
        // Extract amount if possible (simplified regex)
        const amountMatch = subject.match(/\$?(\d+\.?\d*)/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : matchedPattern.amount;

        // Determine due date (simplified)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7); // Default to next week

        return {
          id: `gmail-${email.id}`,
          title: this.extractBillName(subject, from),
          amount,
          dueDate: dueDate.toISOString().split('T')[0],
          status: 'pending',
          category: matchedPattern.category,
          recurring: 'monthly',
          autoDetected: true,
          priority: amount > 500 ? 'high' : amount > 100 ? 'medium' : 'low',
          emailId: email.id,
          description: `Auto-detected from email: ${subject}`
        };
      }

      return null;
    } catch (error) {
      console.error('Error parsing email:', error);
      return null;
    }
  }

  private extractBillName(subject: string, from: string): string {
    // Extract company name from email
    const domainMatch = from.match(/@([^.]+)/);
    if (domainMatch) {
      return domainMatch[1].charAt(0).toUpperCase() + domainMatch[1].slice(1) + ' Bill';
    }
    
    // Extract from subject
    const words = subject.split(' ').filter(word => word.length > 3);
    return words[0] || 'Bill Payment';
  }
}
