// src/services/import/CSVImportService.ts
import { SplittingService, Expense, ExpenseSplit } from '@/services/firebase/splitting-disabled';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export interface CSVExpenseData {
  date: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  splits: Record<string, number>;
  paidBy: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  details: Array<{
    row: number;
    status: 'imported' | 'skipped' | 'error';
    message?: string;
  }>;
}

export class CSVImportService {
  // Pick a CSV file from device
  static async pickCSVFile(): Promise<{ uri: string; name: string } | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true
      });
      
      if (result.canceled) {
        return null;
      }
      
      return {
        uri: result.assets[0].uri,
        name: result.assets[0].name
      };
    } catch (error) {
      console.error('Error picking CSV file:', error);
      throw error;
    }
  }
  
  // Read CSV file content
  static async readCSVFile(fileUri: string): Promise<string> {
    try {
      const fileContent = await FileSystem.readAsStringAsync(fileUri);
      return fileContent;
    } catch (error) {
      console.error('Error reading CSV file:', error);
      throw error;
    }
  }
  
  // Parse CSV data
  static parseCSVData(csvData: string): CSVExpenseData[] {
    try {
      const lines = csvData.split('\n');
      if (lines.length < 2) {
        throw new Error('CSV file is empty or has invalid format');
      }
      
      const headers = lines[0].split(',').map(header => header.trim());
      
      // Validate expected headers
      const requiredHeaders = ['Date', 'Description', 'Category', 'Cost', 'Currency'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
      }
      
      const splitHeaders = headers.slice(5).filter(h => h !== '');
      
      // Parse each line
      const parsedData: CSVExpenseData[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = this.parseCSVLine(line);
        
        if (values.length < 5) {
          console.error(`Skipping line ${i + 1}: Not enough values`);
          continue;
        }
        
        // Find the paidBy person (the one with a positive value)
        const splitValues = values.slice(5);
        const paidByIndex = splitValues.findIndex(val => !val.startsWith('-') && parseFloat(val) > 0);
        
        if (paidByIndex === -1) {
          console.error(`Skipping line ${i + 1}: No payer identified`);
          continue;
        }
        
        const paidBy = splitHeaders[paidByIndex];
        
        // Create splits object
        const splits: Record<string, number> = {};
        
        splitHeaders.forEach((person, index) => {
          if (index < splitValues.length) {
            const value = parseFloat(splitValues[index].replace(/[^0-9.-]/g, ''));
            if (!isNaN(value)) {
              splits[person] = value;
            }
          }
        });
        
        parsedData.push({
          date: values[0],
          description: values[1],
          category: values[2],
          amount: parseFloat(values[3].replace(/[^0-9.-]/g, '')),
          currency: values[4],
          splits,
          paidBy
        });
      }
      
      return parsedData;
    } catch (error) {
      console.error('Error parsing CSV data:', error);
      throw error;
    }
  }
  
  // Helper to parse CSV line considering quoted values
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current); // Add the last field
    return result.map(val => val.trim().replace(/^"|"$/g, ''));
  }
  
  // Convert CSV data to expenses format for import
  static async importExpensesToGroup(
    userId: string, 
    groupId: string, 
    data: CSVExpenseData[],
    categoryMapping: Record<string, string> = {},
    groupMembers: Array<{ id: string; name: string; email: string }>,
    options = { skipDuplicates: true }
  ): Promise<ImportResult> {
    try {
      const result: ImportResult = {
        imported: 0,
        skipped: 0,
        errors: 0,
        details: []
      };
      
      // Maps to convert person identifier to user IDs
      const personToUserIdMap = new Map<string, string>();
      
      // Process each expense
      for (let i = 0; i < data.length; i++) {
        const expenseData = data[i];
        
        try {
          // Skip empty or invalid data
          if (!expenseData.description || !expenseData.amount || isNaN(expenseData.amount)) {
            result.details.push({
              row: i + 1,
              status: 'error',
              message: 'Invalid expense data (missing description or amount)'
            });
            result.errors++;
            continue;
          }
          
          // Match paidBy person to a group member
          const paidByMember = this.matchPersonToMember(expenseData.paidBy, groupMembers);
          
          if (!paidByMember) {
            result.details.push({
              row: i + 1,
              status: 'error',
              message: `Payer "${expenseData.paidBy}" not found in group members`
            });
            result.errors++;
            continue;
          }
          
          // Generate split data
          const splitData: ExpenseSplit[] = [];
          let totalSplitAmount = 0;
          
          for (const [person, amount] of Object.entries(expenseData.splits)) {
            const member = this.matchPersonToMember(person, groupMembers);
            
            if (!member) {
              console.warn(`Member not found for ${person}, skipping in split`);
              continue;
            }
            
            // Handle negative amounts (what they owe)
            const splitAmount = amount < 0 ? Math.abs(amount) : 0;
            if (splitAmount > 0) {
              splitData.push({
                userId: member.id,
                userData: {
                  fullName: member.name,
                  email: member.email
                },
                amount: splitAmount,
                percentage: 0, // Will calculate after
                isPaid: false,
                paidAt: null
              });
              totalSplitAmount += splitAmount;
            }
          }
          
          // Calculate percentages
          if (totalSplitAmount > 0) {
            splitData.forEach(split => {
              split.percentage = Math.round((split.amount / totalSplitAmount) * 100);
            });
          }
          
          // Map category
          const mappedCategory = categoryMapping[expenseData.category.toLowerCase()] || expenseData.category;
          
          // Create expense object
          const expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> = {
            groupId,
            description: expenseData.description,
            amount: expenseData.amount,
            currency: expenseData.currency,
            category: mappedCategory,
            categoryIcon: this.getCategoryIcon(mappedCategory),
            paidBy: paidByMember.id,
            paidByData: {
              fullName: paidByMember.name,
              email: paidByMember.email
            },
            splitType: 'custom',
            splitData,
            date: new Date(expenseData.date),
            isSettled: false,
            tags: ['imported'],
            isSettlementTransaction: false
          };
          
          // Add the expense to Firebase
          const expenseId = await SplittingService.addExpense(expense);
          
          result.imported++;
          result.details.push({
            row: i + 1,
            status: 'imported'
          });
        } catch (error) {
          console.error(`Error importing expense row ${i + 1}:`, error);
          result.errors++;
          result.details.push({
            row: i + 1,
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      return result;
    } catch (error) {
      console.error('Import expenses error:', error);
      throw error;
    }
  }
  
  // Match a person identifier to a group member
  private static matchPersonToMember(
    personIdentifier: string,
    groupMembers: Array<{ id: string; name: string; email: string }>
  ): { id: string; name: string; email: string } | null {
    // Try exact match first
    const exactMatch = groupMembers.find(
      member => 
        member.name === personIdentifier || 
        member.email === personIdentifier ||
        `+${member.email}` === personIdentifier // Handle phone numbers stored in email field
    );
    
    if (exactMatch) return exactMatch;
    
    // Try fuzzy match
    const fuzzyMatch = groupMembers.find(member => 
      member.name.toLowerCase().includes(personIdentifier.toLowerCase()) ||
      personIdentifier.toLowerCase().includes(member.name.toLowerCase())
    );
    
    return fuzzyMatch || null;
  }
  
  // Get a category icon for a given category
  private static getCategoryIcon(category: string): string {
    const categoryIcons: Record<string, string> = {
      groceries: '🛒',
      dining: '🍽️',
      transport: '🚗',
      entertainment: '🎬',
      utilities: '💡',
      rent: '🏠',
      travel: '✈️',
      shopping: '🛍️',
      general: '📝',
      other: '📦'
    };
    
    const lowerCategory = category.toLowerCase();
    
    for (const [key, icon] of Object.entries(categoryIcons)) {
      if (lowerCategory.includes(key)) {
        return icon;
      }
    }
    
    return '📝'; // Default icon
  }
}
