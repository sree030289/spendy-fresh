// src/services/banking/BankingService.ts
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import SecureStorage from '../storage/SecureStorage';

export interface BankAccount {
  id: string;
  userId: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'credit' | 'investment';
  accountNumber: string; // Encrypted/masked
  balance: number;
  currency: string;
  isActive: boolean;
  isPrimary: boolean;
  
  // Banking integration
  plaidAccountId?: string;
  trueLayerAccountId?: string;
  accessToken?: string; // Encrypted
  institutionId: string;
  
  // Metadata
  lastSynced: Date;
  syncEnabled: boolean;
  syncFrequency: 'manual' | 'daily' | 'hourly';
  
  // Display info
  displayName: string;
  accountMask: string; // Last 4 digits
  logoUrl?: string;
  color?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  amount: number;
  description: string;
  date: Date;
  type: 'debit' | 'credit';
  category?: string;
  merchant?: string;
  location?: string;
  pending: boolean;
  
  // Banking specific
  bankTransactionId: string;
  merchantCategoryCode?: string;
  referenceNumber?: string;
  
  // Processed data
  isTransfer?: boolean;
  transferAccountId?: string;
  isDuplicate?: boolean;
  confidence?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Institution {
  id: string;
  name: string;
  displayName: string;
  logoUrl?: string;
  primaryColor?: string;
  url?: string;
  supportedAccountTypes: string[];
  country: string;
  mfa: string[];
}

export interface BankConnectionResult {
  success: boolean;
  account?: BankAccount;
  error?: string;
  requiresMFA?: boolean;
  mfaType?: string;
}

export class BankingService {

  // ACCOUNT MANAGEMENT
  static async getBankAccounts(userId: string): Promise<BankAccount[]> {
    try {
      const accountsQuery = query(
        collection(db, 'bankAccounts'),
        where('userId', '==', userId),
        where('isActive', '==', true),
        orderBy('isPrimary', 'desc'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(accountsQuery);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          lastSynced: data.lastSynced?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }) as BankAccount[];
    } catch (error) {
      console.error('Get bank accounts error:', error);
      return [];
    }
  }

  static async connectBankAccount(userId: string, connectionData: {
    institutionId: string;
    publicToken?: string; // Plaid
    accessCode?: string; // TrueLayer
    accountId?: string;
    displayName?: string;
  }): Promise<BankAccount | null> {
    try {
      let accountData: Partial<BankAccount>;

      // Handle different banking providers
      if (connectionData.publicToken) {
        // Plaid integration
        accountData = await this.connectPlaidAccount(userId, connectionData);
      } else if (connectionData.accessCode) {
        // TrueLayer integration
        accountData = await this.connectTrueLayerAccount(userId, connectionData);
      } else {
        throw new Error('Invalid connection data');
      }

      // Store encrypted access tokens
      if (accountData.accessToken) {
        await this.storeEncryptedToken(accountData.id!, accountData.accessToken);
        delete accountData.accessToken; // Remove from data to be stored in Firestore
      }

      const newAccount: Omit<BankAccount, 'id'> = {
        userId,
        ...accountData,
        isActive: true,
        isPrimary: false,
        syncEnabled: true,
        syncFrequency: 'daily',
        lastSynced: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      } as BankAccount;

      const docRef = await addDoc(collection(db, 'bankAccounts'), {
        ...newAccount,
        lastSynced: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Initial sync
      await this.syncTransactions(docRef.id);

      return { ...newAccount, id: docRef.id };
    } catch (error) {
      console.error('Connect bank account error:', error);
      return null;
    }
  }

  static async disconnectBankAccount(accountId: string): Promise<void> {
    try {
      // Remove encrypted tokens
      await this.removeEncryptedToken(accountId);
      
      // Mark account as inactive
      await updateDoc(doc(db, 'bankAccounts', accountId), {
        isActive: false,
        syncEnabled: false,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Disconnect bank account error:', error);
      throw error;
    }
  }

  static async updateAccountSettings(accountId: string, settings: {
    displayName?: string;
    syncEnabled?: boolean;
    syncFrequency?: 'manual' | 'daily' | 'hourly';
    isPrimary?: boolean;
    color?: string;
  }): Promise<void> {
    try {
      await updateDoc(doc(db, 'bankAccounts', accountId), {
        ...settings,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Update account settings error:', error);
      throw error;
    }
  }

  // TRANSACTION SYNCING
  static async syncTransactions(accountId: string): Promise<void> {
    try {
      const accountDoc = await getDoc(doc(db, 'bankAccounts', accountId));
      if (!accountDoc.exists()) {
        throw new Error('Account not found');
      }

      const account = accountDoc.data() as BankAccount;
      
      // Get access token
      const accessToken = await this.getEncryptedToken(accountId);
      if (!accessToken) {
        throw new Error('Access token not found');
      }

      let transactions: BankTransaction[] = [];

      // Fetch transactions based on provider
      if (account.plaidAccountId) {
        transactions = await this.fetchPlaidTransactions(account, accessToken);
      } else if (account.trueLayerAccountId) {
        transactions = await this.fetchTrueLayerTransactions(account, accessToken);
      }

      // Process and store transactions
      for (const transaction of transactions) {
        await this.processAndStoreTransaction(transaction);
      }

      // Update last synced time and balance
      await updateDoc(doc(db, 'bankAccounts', accountId), {
        lastSynced: serverTimestamp(),
        balance: account.balance,
        updatedAt: serverTimestamp()
      });

    } catch (error) {
      console.error('Sync transactions error:', error);
      throw error;
    }
  }

  static async getTransactions(accountId: string, limitCount: number = 100): Promise<BankTransaction[]> {
    try {
      const transactionsQuery = query(
        collection(db, 'bankTransactions'),
        where('accountId', '==', accountId),
        orderBy('date', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(transactionsQuery);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }) as BankTransaction[];
    } catch (error) {
      console.error('Get transactions error:', error);
      return [];
    }
  }

  // PLAID INTEGRATION
  private static async connectPlaidAccount(userId: string, data: any): Promise<Partial<BankAccount>> {
    try {
      // Exchange public token for access token
      const response = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicToken: data.publicToken,
          userId
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Plaid connection failed');
      }

      // Get account info
      const accountInfo = await this.getPlaidAccountInfo(result.accessToken, data.accountId);

      return {
        bankName: accountInfo.institution.name,
        accountType: this.mapPlaidAccountType(accountInfo.subtype),
        accountNumber: accountInfo.account.mask,
        balance: accountInfo.account.balances.current,
        currency: accountInfo.account.balances.iso_currency_code || 'USD',
        plaidAccountId: accountInfo.account.account_id,
        accessToken: result.accessToken,
        institutionId: accountInfo.institution.institution_id,
        displayName: data.displayName || `${accountInfo.institution.name} ${accountInfo.account.name}`,
        accountMask: accountInfo.account.mask,
        logoUrl: accountInfo.institution.logo,
        color: accountInfo.institution.primary_color
      };
    } catch (error) {
      console.error('Connect Plaid account error:', error);
      throw error;
    }
  }

  private static async fetchPlaidTransactions(account: BankAccount, accessToken: string): Promise<BankTransaction[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      const response = await fetch('/api/plaid/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          accountIds: [account.plaidAccountId],
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch Plaid transactions');
      }

      return result.transactions.map((tx: any) => ({
        accountId: account.id,
        amount: Math.abs(tx.amount),
        description: tx.name,
        date: new Date(tx.date),
        type: tx.amount > 0 ? 'debit' : 'credit',
        category: tx.category?.[0],
        merchant: tx.merchant_name,
        location: tx.location?.address,
        pending: tx.pending,
        bankTransactionId: tx.transaction_id,
        merchantCategoryCode: tx.merchant_category_code,
        referenceNumber: tx.account_owner,
        isDuplicate: false,
        confidence: 1.0,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
    } catch (error) {
      console.error('Fetch Plaid transactions error:', error);
      return [];
    }
  }

  private static async getPlaidAccountInfo(accessToken: string, accountId: string): Promise<any> {
    const response = await fetch('/api/plaid/account-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, accountId })
    });

    if (!response.ok) {
      throw new Error('Failed to get Plaid account info');
    }

    return response.json();
  }

  private static mapPlaidAccountType(subtype: string): 'checking' | 'savings' | 'credit' | 'investment' {
    const mapping: Record<string, 'checking' | 'savings' | 'credit' | 'investment'> = {
      'checking': 'checking',
      'savings': 'savings',
      'credit card': 'credit',
      'credit': 'credit',
      'investment': 'investment',
      'brokerage': 'investment'
    };
    return mapping[subtype?.toLowerCase()] || 'checking';
  }

  // TRUELAYER INTEGRATION
  private static async connectTrueLayerAccount(userId: string, data: any): Promise<Partial<BankAccount>> {
    try {
      // Exchange authorization code for access token
      const response = await fetch('/api/truelayer/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authCode: data.accessCode,
          userId
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'TrueLayer connection failed');
      }

      // Get account info
      const accountInfo = await this.getTrueLayerAccountInfo(result.accessToken, data.accountId);

      return {
        bankName: accountInfo.provider.display_name,
        accountType: this.mapTrueLayerAccountType(accountInfo.account_type),
        accountNumber: accountInfo.account_number.number,
        balance: accountInfo.balance.current,
        currency: accountInfo.currency,
        trueLayerAccountId: accountInfo.account_id,
        accessToken: result.accessToken,
        institutionId: accountInfo.provider.provider_id,
        displayName: data.displayName || `${accountInfo.provider.display_name} ${accountInfo.display_name}`,
        accountMask: accountInfo.account_number.number.slice(-4),
        logoUrl: accountInfo.provider.logo_uri
      };
    } catch (error) {
      console.error('Connect TrueLayer account error:', error);
      throw error;
    }
  }

  private static async fetchTrueLayerTransactions(account: BankAccount, accessToken: string): Promise<BankTransaction[]> {
    try {
      const response = await fetch('/api/truelayer/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          accountId: account.trueLayerAccountId
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch TrueLayer transactions');
      }

      return result.results.map((tx: any) => ({
        accountId: account.id,
        amount: Math.abs(tx.amount),
        description: tx.description,
        date: new Date(tx.timestamp),
        type: tx.amount > 0 ? 'credit' : 'debit',
        category: tx.transaction_category,
        merchant: tx.merchant_name,
        pending: false,
        bankTransactionId: tx.transaction_id,
        merchantCategoryCode: tx.meta?.merchant_category_code,
        referenceNumber: tx.reference,
        isDuplicate: false,
        confidence: 1.0,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
    } catch (error) {
      console.error('Fetch TrueLayer transactions error:', error);
      return [];
    }
  }

  private static async getTrueLayerAccountInfo(accessToken: string, accountId: string): Promise<any> {
    const response = await fetch('/api/truelayer/account-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, accountId })
    });

    if (!response.ok) {
      throw new Error('Failed to get TrueLayer account info');
    }

    return response.json();
  }

  private static mapTrueLayerAccountType(accountType: string): 'checking' | 'savings' | 'credit' | 'investment' {
    const mapping: Record<string, 'checking' | 'savings' | 'credit' | 'investment'> = {
      'TRANSACTION': 'checking',
      'SAVINGS': 'savings',
      'CREDIT_CARD': 'credit',
      'INVESTMENT': 'investment'
    };
    return mapping[accountType] || 'checking';
  }

  // TRANSACTION PROCESSING
  private static async processAndStoreTransaction(transaction: BankTransaction): Promise<void> {
    try {
      // Check for duplicates
      const existingQuery = query(
        collection(db, 'bankTransactions'),
        where('bankTransactionId', '==', transaction.bankTransactionId),
        where('accountId', '==', transaction.accountId)
      );

      const existingSnapshot = await getDocs(existingQuery);
      if (!existingSnapshot.empty) {
        return; // Transaction already exists
      }

      // Detect transfers between accounts
      await this.detectTransfers(transaction);

      // Store transaction
      await addDoc(collection(db, 'bankTransactions'), {
        ...transaction,
        date: Timestamp.fromDate(transaction.date),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Process and store transaction error:', error);
    }
  }

  private static async detectTransfers(transaction: BankTransaction): Promise<void> {
    try {
      // Look for matching opposite transaction within 2 days
      const searchStart = new Date(transaction.date);
      searchStart.setDate(searchStart.getDate() - 2);
      const searchEnd = new Date(transaction.date);
      searchEnd.setDate(searchEnd.getDate() + 2);

      const potentialTransfersQuery = query(
        collection(db, 'bankTransactions'),
        where('amount', '==', transaction.amount),
        where('date', '>=', Timestamp.fromDate(searchStart)),
        where('date', '<=', Timestamp.fromDate(searchEnd))
      );

      const snapshot = await getDocs(potentialTransfersQuery);
      
      for (const doc of snapshot.docs) {
        const potentialTransfer = doc.data() as BankTransaction;
        
        // Check if it's an opposite transaction (different account, opposite type)
        if (potentialTransfer.accountId !== transaction.accountId &&
            potentialTransfer.type !== transaction.type &&
            this.isLikelyTransfer(transaction, potentialTransfer)) {
          
          // Mark both as transfers
          transaction.isTransfer = true;
          transaction.transferAccountId = potentialTransfer.accountId;
          
          await updateDoc(doc(db, 'bankTransactions', doc.id as string), {
            isTransfer: true,
            transferAccountId: transaction.accountId,
            updatedAt: serverTimestamp()
          });
          
          break;
        }
      }
    } catch (error) {
      console.error('Detect transfers error:', error);
    }
  }

  private static isLikelyTransfer(tx1: BankTransaction, tx2: BankTransaction): boolean {
    // Simple heuristics for transfer detection
    const descriptionSimilarity = this.calculateStringSimilarity(tx1.description, tx2.description);
    const timeDifference = Math.abs(tx1.date.getTime() - tx2.date.getTime());
    const oneDayMs = 24 * 60 * 60 * 1000;

    return descriptionSimilarity > 0.6 || timeDifference < oneDayMs;
  }

  private static calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity
    const set1 = new Set(str1.toLowerCase().split(' '));
    const set2 = new Set(str2.toLowerCase().split(' '));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  // ENCRYPTED STORAGE
  private static async storeEncryptedToken(accountId: string, accessToken: string): Promise<void> {
    try {
      await SecureStorage.setItem(`bank_token_${accountId}`, accessToken);
    } catch (error) {
      console.error('Store encrypted token error:', error);
      throw error;
    }
  }

  private static async getEncryptedToken(accountId: string): Promise<string | null> {
    try {
      return await SecureStorage.getItem(`bank_token_${accountId}`);
    } catch (error) {
      console.error('Get encrypted token error:', error);
      return null;
    }
  }

  private static async removeEncryptedToken(accountId: string): Promise<void> {
    try {
      await SecureStorage.removeItem(`bank_token_${accountId}`);
    } catch (error) {
      console.error('Remove encrypted token error:', error);
    }
  }

  // INSTITUTIONS
  static async getInstitutions(country: string = 'US'): Promise<Institution[]> {
    try {
      const response = await fetch(`/api/institutions?country=${country}`);
      if (!response.ok) {
        throw new Error('Failed to fetch institutions');
      }
      return response.json();
    } catch (error) {
      console.error('Get institutions error:', error);
      return [];
    }
  }

  static async searchInstitutions(query: string, country: string = 'US'): Promise<Institution[]> {
    try {
      const response = await fetch('/api/institutions/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, country })
      });

      if (!response.ok) {
        throw new Error('Failed to search institutions');
      }
      return response.json();
    } catch (error) {
      console.error('Search institutions error:', error);
      return [];
    }
  }

  // BALANCE UPDATES
  static async refreshAccountBalances(userId: string): Promise<void> {
    try {
      const accounts = await this.getBankAccounts(userId);
      
      for (const account of accounts.filter(a => a.syncEnabled)) {
        try {
          const accessToken = await this.getEncryptedToken(account.id);
          if (!accessToken) continue;

          let newBalance: number | null = null;

          if (account.plaidAccountId) {
            newBalance = await this.getPlaidBalance(accessToken, account.plaidAccountId);
          } else if (account.trueLayerAccountId) {
            newBalance = await this.getTrueLayerBalance(accessToken, account.trueLayerAccountId);
          }

          if (newBalance !== null && newBalance !== account.balance) {
            await updateDoc(doc(db, 'bankAccounts', account.id), {
              balance: newBalance,
              lastSynced: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        } catch (error) {
          console.error(`Failed to refresh balance for account ${account.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Refresh account balances error:', error);
    }
  }

  private static async getPlaidBalance(accessToken: string, accountId: string): Promise<number | null> {
    try {
      const response = await fetch('/api/plaid/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, accountId })
      });

      if (!response.ok) return null;
      
      const result = await response.json();
      return result.accounts?.[0]?.balances?.current || null;
    } catch (error) {
      console.error('Get Plaid balance error:', error);
      return null;
    }
  }

  private static async getTrueLayerBalance(accessToken: string, accountId: string): Promise<number | null> {
    try {
      const response = await fetch('/api/truelayer/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, accountId })
      });

      if (!response.ok) return null;
      
      const result = await response.json();
      return result.results?.[0]?.current || null;
    } catch (error) {
      console.error('Get TrueLayer balance error:', error);
      return null;
    }
  }

  // BACKGROUND SYNC
  static async performBackgroundSync(userId: string): Promise<void> {
    try {
      const accounts = await this.getBankAccounts(userId);
      const syncPromises = accounts
        .filter(account => account.syncEnabled && account.syncFrequency !== 'manual')
        .map(account => this.syncTransactions(account.id));

      await Promise.allSettled(syncPromises);
    } catch (error) {
      console.error('Background sync error:', error);
    }
  }

  // REAL-TIME LISTENERS
  static onBankAccounts(userId: string, callback: (accounts: BankAccount[]) => void): () => void {
    const accountsQuery = query(
      collection(db, 'bankAccounts'),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('isPrimary', 'desc')
    );

    return onSnapshot(accountsQuery, (snapshot) => {
      const accounts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          lastSynced: data.lastSynced?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }) as BankAccount[];

      callback(accounts);
    });
  }

  static onTransactions(accountId: string, callback: (transactions: BankTransaction[]) => void): () => void {
    const transactionsQuery = query(
      collection(db, 'bankTransactions'),
      where('accountId', '==', accountId),
      orderBy('date', 'desc'),
      limit(50)
    );

    return onSnapshot(transactionsQuery, (snapshot) => {
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }) as BankTransaction[];

      callback(transactions);
    });
  }
}