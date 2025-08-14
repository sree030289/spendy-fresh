import { ApiService } from '@/services/api/ApiService';
import { PersonalTransaction } from '@/types/moneyManagement';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export interface ParsedStatement {
  transactions: Partial<PersonalTransaction>[];
  summary: {
    totalTransactions: number;
    totalIncome: number;
    totalExpenses: number;
    dateRange: {
      startDate: Date;
      endDate: Date;
    };
    bankName?: string;
    accountNumber?: string;
  };
  errors: string[];
  warnings: string[];
}

export interface BankStatementConfig {
  bankName: string;
  formatType: 'csv' | 'pdf' | 'excel';
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  typeColumn?: string;
  categoryMappings?: Record<string, string>;
  dateFormat: string;
}

export class StatementParsingService {
  private static instance: StatementParsingService;
  private apiService: ApiService;
  private supportedBanks: BankStatementConfig[] = [
    {
      bankName: 'Chase Bank',
      formatType: 'csv',
      dateColumn: 'Transaction Date',
      descriptionColumn: 'Description',
      amountColumn: 'Amount',
      typeColumn: 'Type',
      dateFormat: 'MM/DD/YYYY',
      categoryMappings: {
        'ATM': 'Cash Withdrawal',
        'DEPOSIT': 'Deposit',
        'PURCHASE': 'Purchase',
        'PAYMENT': 'Payment'
      }
    },
    {
      bankName: 'Bank of America',
      formatType: 'csv',
      dateColumn: 'Date',
      descriptionColumn: 'Description',
      amountColumn: 'Amount',
      dateFormat: 'MM/DD/YYYY'
    },
    {
      bankName: 'Wells Fargo',
      formatType: 'csv',
      dateColumn: 'Date',
      descriptionColumn: 'Description',
      amountColumn: 'Amount',
      dateFormat: 'MM/DD/YYYY'
    },
    {
      bankName: 'Citi Bank',
      formatType: 'csv',
      dateColumn: 'Date',
      descriptionColumn: 'Description',
      amountColumn: 'Debit',
      dateFormat: 'MM/DD/YYYY'
    }
  ];

  private constructor() {
    this.apiService = ApiService.getInstance();
  }

  public static getInstance(): StatementParsingService {
    if (!StatementParsingService.instance) {
      StatementParsingService.instance = new StatementParsingService();
    }
    return StatementParsingService.instance;
  }

  async selectAndParseStatement(): Promise<ParsedStatement | null> {
    try {
      // Let user pick a file
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return null;
      }

      const file = result.assets[0];
      return await this.parseStatementFile(file);
    } catch (error) {
      console.error('Error selecting and parsing statement:', error);
      throw new Error('Failed to parse statement file');
    }
  }

  async parseStatementFile(file: DocumentPicker.DocumentPickerAsset): Promise<ParsedStatement> {
    try {
      // Read file content
      const fileContent = await FileSystem.readAsStringAsync(file.uri);
      
      // Determine file type and parse accordingly
      const fileExtension = file.name.toLowerCase().split('.').pop();
      
      if (fileExtension === 'csv') {
        return await this.parseCSVStatement(fileContent, file.name);
      } else if (fileExtension === 'pdf') {
        return await this.parsePDFStatement(file);
      } else {
        throw new Error('Unsupported file format. Please use CSV or PDF files.');
      }
    } catch (error) {
      console.error('Error parsing statement file:', error);
      throw new Error('Failed to parse statement file. Please check the format and try again.');
    }
  }

  private async parseCSVStatement(content: string, fileName: string): Promise<ParsedStatement> {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('Invalid CSV file. Must contain at least a header and one data row.');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataRows = lines.slice(1);

    // Try to detect bank format
    const bankConfig = this.detectBankFormat(headers, fileName);
    
    const transactions: Partial<PersonalTransaction>[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    
    let totalIncome = 0;
    let totalExpenses = 0;
    const dates: Date[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      try {
        const row = this.parseCSVRow(dataRows[i]);
        if (row.length < headers.length) {
          warnings.push(`Row ${i + 2}: Incomplete data, skipping`);
          continue;
        }

        const transaction = this.mapRowToTransaction(row, headers, bankConfig);
        if (transaction) {
          transactions.push(transaction);
          
          if (transaction.type === 'income') {
            totalIncome += transaction.amount || 0;
          } else {
            totalExpenses += transaction.amount || 0;
          }
          
          if (transaction.date) {
            dates.push(new Date(transaction.date));
          }
        }
      } catch (error) {
        errors.push(`Row ${i + 2}: ${error}`);
      }
    }

    const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
    
    return {
      transactions,
      summary: {
        totalTransactions: transactions.length,
        totalIncome,
        totalExpenses,
        dateRange: {
          startDate: sortedDates[0] || new Date(),
          endDate: sortedDates[sortedDates.length - 1] || new Date()
        },
        bankName: bankConfig?.bankName
      },
      errors,
      warnings
    };
  }

  private async parsePDFStatement(file: DocumentPicker.DocumentPickerAsset): Promise<ParsedStatement> {
    try {
      // For PDF parsing, we'll send it to the backend for processing
      const formData = new FormData();
      formData.append('statement', {
        uri: file.uri,
        type: file.mimeType || 'application/pdf',
        name: file.name
      } as any);

      const response = await this.apiService.post('/money/statements/parse-pdf', formData, {
        'Content-Type': 'multipart/form-data'
      });

      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to parse PDF statement');
      }
    } catch (error) {
      console.error('Error parsing PDF statement:', error);
      throw new Error('Failed to parse PDF statement. Please try a CSV file instead.');
    }
  }

  private detectBankFormat(headers: string[], fileName: string): BankStatementConfig | null {
    const lowerHeaders = headers.map(h => h.toLowerCase());
    const lowerFileName = fileName.toLowerCase();

    for (const config of this.supportedBanks) {
      const bankNameInFile = lowerFileName.includes(config.bankName.toLowerCase().replace(' ', ''));
      const hasRequiredColumns = lowerHeaders.includes(config.dateColumn.toLowerCase()) &&
                                 lowerHeaders.includes(config.descriptionColumn.toLowerCase()) &&
                                 lowerHeaders.includes(config.amountColumn.toLowerCase());
      
      if (bankNameInFile || hasRequiredColumns) {
        return config;
      }
    }

    // Try to create a generic config based on common column names
    const dateColumnIndex = lowerHeaders.findIndex(h => 
      h.includes('date') || h.includes('time')
    );
    const descColumnIndex = lowerHeaders.findIndex(h => 
      h.includes('description') || h.includes('memo') || h.includes('detail')
    );
    const amountColumnIndex = lowerHeaders.findIndex(h => 
      h.includes('amount') || h.includes('debit') || h.includes('credit')
    );

    if (dateColumnIndex >= 0 && descColumnIndex >= 0 && amountColumnIndex >= 0) {
      return {
        bankName: 'Generic Bank',
        formatType: 'csv',
        dateColumn: headers[dateColumnIndex],
        descriptionColumn: headers[descColumnIndex],
        amountColumn: headers[amountColumnIndex],
        dateFormat: 'MM/DD/YYYY'
      };
    }

    return null;
  }

  private parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private mapRowToTransaction(
    row: string[], 
    headers: string[], 
    config: BankStatementConfig | null
  ): Partial<PersonalTransaction> | null {
    if (!config) return null;

    const dateIndex = headers.findIndex(h => h === config.dateColumn);
    const descIndex = headers.findIndex(h => h === config.descriptionColumn);
    const amountIndex = headers.findIndex(h => h === config.amountColumn);
    const typeIndex = config.typeColumn ? headers.findIndex(h => h === config.typeColumn) : -1;

    if (dateIndex === -1 || descIndex === -1 || amountIndex === -1) {
      return null;
    }

    const dateStr = row[dateIndex]?.replace(/"/g, '');
    const description = row[descIndex]?.replace(/"/g, '');
    const amountStr = row[amountIndex]?.replace(/"/g, '').replace(/[$,]/g, '');
    const typeStr = typeIndex >= 0 ? row[typeIndex]?.replace(/"/g, '') : '';

    // Parse date
    const date = this.parseDate(dateStr, config.dateFormat);
    if (!date) return null;

    // Parse amount
    const amount = Math.abs(parseFloat(amountStr));
    if (isNaN(amount)) return null;

    // Determine transaction type
    const isNegative = amountStr.includes('-') || parseFloat(amountStr) < 0;
    const type: 'income' | 'expense' = isNegative ? 'expense' : 'income';

    // Auto-categorize based on description
    const category = this.categorizeTransaction(description, type);

    return {
      type,
      amount,
      description: description || 'Bank Transaction',
      category,
      date: date.toISOString(),
      source: 'bank_statement',
      tags: ['imported'],
      isRecurring: false
    };
  }

  private parseDate(dateStr: string, format: string): Date | null {
    try {
      // Handle common date formats
      if (format === 'MM/DD/YYYY') {
        const [month, day, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else if (format === 'DD/MM/YYYY') {
        const [day, month, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else if (format === 'YYYY-MM-DD') {
        return new Date(dateStr);
      }
      
      // Fallback to Date.parse
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }

  private categorizeTransaction(description: string, type: 'income' | 'expense'): string {
    const desc = description.toLowerCase();

    if (type === 'income') {
      if (desc.includes('salary') || desc.includes('payroll')) return 'Salary';
      if (desc.includes('deposit') || desc.includes('transfer in')) return 'Deposit';
      if (desc.includes('interest')) return 'Interest';
      if (desc.includes('dividend')) return 'Dividend';
      if (desc.includes('refund')) return 'Refund';
      return 'Other Income';
    } else {
      // Expense categorization
      if (desc.includes('grocery') || desc.includes('supermarket') || desc.includes('food')) return 'Groceries';
      if (desc.includes('gas') || desc.includes('fuel') || desc.includes('shell') || desc.includes('exxon')) return 'Fuel';
      if (desc.includes('restaurant') || desc.includes('dining') || desc.includes('cafe')) return 'Restaurant';
      if (desc.includes('uber') || desc.includes('lyft') || desc.includes('taxi')) return 'Transportation';
      if (desc.includes('amazon') || desc.includes('shopping') || desc.includes('store')) return 'Shopping';
      if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('subscription')) return 'Subscriptions';
      if (desc.includes('rent') || desc.includes('mortgage')) return 'Rent';
      if (desc.includes('electric') || desc.includes('utility') || desc.includes('water')) return 'Utilities';
      if (desc.includes('pharmacy') || desc.includes('medical') || desc.includes('doctor')) return 'Healthcare';
      if (desc.includes('atm') || desc.includes('withdrawal')) return 'Cash Withdrawal';
      if (desc.includes('fee') || desc.includes('charge')) return 'Bank Fee';
      
      return 'Other Expense';
    }
  }

  async saveImportedTransactions(
    transactions: Partial<PersonalTransaction>[],
    userId: string
  ): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      const response = await this.apiService.post('/money/transactions/import', {
        transactions: transactions.map(t => ({ ...t, userId })),
        source: 'statement_import'
      });

      return {
        success: response.success,
        imported: response.data?.imported || 0,
        errors: response.data?.errors || []
      };
    } catch (error) {
      console.error('Error saving imported transactions:', error);
      return {
        success: false,
        imported: 0,
        errors: ['Failed to save imported transactions']
      };
    }
  }

  getSupportedBanks(): string[] {
    return this.supportedBanks.map(bank => bank.bankName);
  }

  async getImportHistory(userId: string): Promise<any[]> {
    try {
      const response = await this.apiService.get('/money/statements/import-history');
      return response.success ? response.data.imports : [];
    } catch (error) {
      console.error('Error getting import history:', error);
      return [];
    }
  }
}

export default StatementParsingService;