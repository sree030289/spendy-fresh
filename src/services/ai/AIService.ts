// src/services/ai/AIService.ts
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

export interface CategoryResult {
  category: string;
  icon: string;
  confidence: number;
  tags: string[];
}

export interface ReceiptData {
  merchant: string;
  amount: number;
  date: Date;
  description: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }>;
  tax?: number;
  tip?: number;
  total: number;
  confidence: number;
  rawText?: string;
  receiptUrl?: string;
  location?: string;
}

export interface SpendingInsight {
  type: 'positive' | 'warning' | 'info' | 'alert';
  title: string;
  description: string;
  icon: string;
  confidence: number;
  actionable: boolean;
  action?: {
    type: 'create_budget' | 'set_reminder' | 'view_category';
    data: any;
  };
}

export class AIService {
  
  // Receipt Processing with ML Kit (on-device) and Cloud OCR (fallback)
  static async processReceipt(imageUri: string): Promise<ReceiptData> {
    try {
      console.log('🔍 Processing receipt with AI...');
      
      // First try on-device ML Kit OCR
      let ocrResult;
      try {
        ocrResult = await this.processWithMLKit(imageUri);
        console.log('✅ ML Kit OCR successful');
      } catch (mlKitError) {
        console.log('⚠️ ML Kit failed, trying cloud OCR...');
        ocrResult = await this.processWithCloudOCR(imageUri);
      }
      
      // Parse the OCR text to extract receipt data
      const receiptData = await this.parseReceiptText(ocrResult.text, ocrResult.confidence);
      
      return receiptData;
    } catch (error) {
      console.error('❌ Receipt processing failed:', error);
      throw new Error('Failed to process receipt. Please try again.');
    }
  }

  // On-device ML Kit OCR (iOS/Android)
  private static async processWithMLKit(imageUri: string): Promise<{ text: string; confidence: number }> {
    try {
      // Import ML Kit text recognition
      const { default: TextRecognition } = await import('@react-native-ml-kit/text-recognition');
      
      const result = await TextRecognition.recognize(imageUri);
      
      return {
        text: result.text,
        confidence: this.calculateMLKitConfidence(result)
      };
    } catch (error) {
      console.error('ML Kit error:', error);
      throw error;
    }
  }

  // Cloud OCR fallback (Google Vision API or AWS Textract)
  private static async processWithCloudOCR(imageUri: string): Promise<{ text: string; confidence: number }> {
    try {
      // Convert image to base64
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Call your backend OCR service
      const response = await fetch('https://your-api.com/ocr/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_API_KEY',
        },
        body: JSON.stringify({
          image: base64Image,
          features: ['TEXT_DETECTION', 'DOCUMENT_TEXT_DETECTION']
        }),
      });

      if (!response.ok) {
        throw new Error('Cloud OCR API error');
      }

      const result = await response.json();
      
      return {
        text: result.fullTextAnnotation?.text || '',
        confidence: result.confidence || 0.8
      };
    } catch (error) {
      console.error('Cloud OCR error:', error);
      // Fallback to mock data for development
      return this.getMockReceiptData();
    }
  }

  // Parse OCR text to extract structured receipt data
  private static async parseReceiptText(ocrText: string, confidence: number): Promise<ReceiptData> {
    try {
      const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      let merchant = '';
      let totalAmount = 0;
      let date = new Date();
      const items: Array<{ name: string; price: number; quantity: number }> = [];
      let tax = 0;
      let tip = 0;

      // Extract merchant (usually first few lines)
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        if (lines[i] && !this.isAmountLine(lines[i]) && !this.isDateLine(lines[i])) {
          merchant = lines[i];
          break;
        }
      }

      // Extract date
      for (const line of lines) {
        const extractedDate = this.extractDate(line);
        if (extractedDate) {
          date = extractedDate;
          break;
        }
      }

      // Extract amounts
      for (const line of lines) {
        const amounts = this.extractAmounts(line);
        
        if (amounts.length > 0) {
          // Check for total indicators
          const lowerLine = line.toLowerCase();
          if (lowerLine.includes('total') || lowerLine.includes('amount due') || lowerLine.includes('balance')) {
            totalAmount = Math.max(...amounts);
          } else if (lowerLine.includes('tax') || lowerLine.includes('gst')) {
            tax = amounts[0];
          } else if (lowerLine.includes('tip') || lowerLine.includes('gratuity')) {
            tip = amounts[0];
          } else {
            // Potential item
            const itemName = line.replace(/[\d\.\$\,\s]+$/, '').trim();
            if (itemName.length > 2) {
              items.push({
                name: itemName,
                price: amounts[0],
                quantity: 1
              });
            }
          }
        }
      }

      // If no total found, calculate from items
      if (totalAmount === 0 && items.length > 0) {
        totalAmount = items.reduce((sum, item) => sum + item.price, 0) + tax + tip;
      }

      // Generate description
      const description = merchant || items[0]?.name || 'Receipt';

      return {
        merchant: merchant || 'Unknown Merchant',
        amount: totalAmount,
        date,
        description,
        items,
        tax: tax > 0 ? tax : undefined,
        tip: tip > 0 ? tip : undefined,
        total: totalAmount,
        confidence,
        rawText: ocrText,
        location: this.extractLocation(ocrText)
      };
    } catch (error) {
      console.error('Parse receipt text error:', error);
      throw error;
    }
  }

  // Transaction Categorization with ML
  static async categorizeExpense(description: string, amount?: number, merchant?: string): Promise<CategoryResult> {
    try {
      console.log('🤖 Categorizing expense:', description);
      
      // Try ML categorization first
      let category;
      try {
        category = await this.categorizeWithML(description, amount, merchant);
      } catch (mlError) {
        console.log('ML categorization failed, using rule-based fallback');
        category = this.categorizeWithRules(description, merchant);
      }
      
      return category;
    } catch (error) {
      console.error('Categorization error:', error);
      return {
        category: 'Other',
        icon: '📊',
        confidence: 0.5,
        tags: ['uncategorized']
      };
    }
  }

  // ML-based categorization (would use TensorFlow.js or cloud ML)
  private static async categorizeWithML(description: string, amount?: number, merchant?: string): Promise<CategoryResult> {
    try {
      // In production, this would call your ML model
      const response = await fetch('https://your-api.com/ml/categorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_API_KEY',
        },
        body: JSON.stringify({
          description,
          amount,
          merchant,
        }),
      });

      if (!response.ok) {
        throw new Error('ML API error');
      }

      const result = await response.json();
      
      return {
        category: result.category,
        icon: this.getCategoryIcon(result.category),
        confidence: result.confidence,
        tags: result.tags || []
      };
    } catch (error) {
      // Fallback to rule-based categorization
      throw error;
    }
  }

  // Rule-based categorization fallback
  private static categorizeWithRules(description: string, merchant?: string): CategoryResult {
    const text = (description + ' ' + (merchant || '')).toLowerCase();
    
    // Food & Dining
    if (this.matchesKeywords(text, [
      'restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'kfc', 'subway',
      'pizza', 'burger', 'sushi', 'thai', 'chinese', 'indian', 'mexican',
      'bistro', 'bar', 'pub', 'food', 'dining', 'eat', 'lunch', 'dinner',
      'breakfast', 'takeaway', 'delivery', 'uber eats', 'doordash', 'grubhub'
    ])) {
      return {
        category: 'Food & Drink',
        icon: '🍽️',
        confidence: 0.9,
        tags: ['food', 'dining']
      };
    }

    // Transport
    if (this.matchesKeywords(text, [
      'uber', 'lyft', 'taxi', 'bus', 'train', 'metro', 'subway', 'gas',
      'petrol', 'fuel', 'parking', 'toll', 'transport', 'car', 'vehicle',
      'airline', 'flight', 'airport', 'travel'
    ])) {
      return {
        category: 'Transport',
        icon: '🚗',
        confidence: 0.85,
        tags: ['transport', 'travel']
      };
    }

    // Shopping
    if (this.matchesKeywords(text, [
      'amazon', 'ebay', 'walmart', 'target', 'costco', 'mall', 'store',
      'shop', 'retail', 'purchase', 'buy', 'clothing', 'shoes', 'fashion',
      'electronics', 'computer', 'phone', 'gadget'
    ])) {
      return {
        category: 'Shopping',
        icon: '🛍️',
        confidence: 0.8,
        tags: ['shopping', 'retail']
      };
    }

    // Bills & Utilities
    if (this.matchesKeywords(text, [
      'electric', 'electricity', 'gas', 'water', 'internet', 'phone',
      'cable', 'utility', 'bill', 'payment', 'service', 'subscription',
      'netflix', 'spotify', 'apple', 'google', 'microsoft'
    ])) {
      return {
        category: 'Bills & Utilities',
        icon: '⚡',
        confidence: 0.85,
        tags: ['bills', 'utilities']
      };
    }

    // Health & Fitness
    if (this.matchesKeywords(text, [
      'hospital', 'doctor', 'medical', 'pharmacy', 'medicine', 'health',
      'gym', 'fitness', 'yoga', 'trainer', 'therapy', 'dental', 'clinic'
    ])) {
      return {
        category: 'Health & Fitness',
        icon: '🏥',
        confidence: 0.8,
        tags: ['health', 'medical']
      };
    }

    // Entertainment
    if (this.matchesKeywords(text, [
      'movie', 'cinema', 'theater', 'concert', 'music', 'game', 'entertainment',
      'sport', 'event', 'ticket', 'show', 'netflix', 'spotify', 'youtube'
    ])) {
      return {
        category: 'Entertainment',
        icon: '🎬',
        confidence: 0.8,
        tags: ['entertainment', 'leisure']
      };
    }

    // Groceries
    if (this.matchesKeywords(text, [
      'grocery', 'supermarket', 'coles', 'woolworths', 'aldi', 'market',
      'fresh', 'produce', 'meat', 'vegetables', 'fruit', 'dairy'
    ])) {
      return {
        category: 'Groceries',
        icon: '🛒',
        confidence: 0.85,
        tags: ['groceries', 'food']
      };
    }

    // Default category
    return {
      category: 'Other',
      icon: '📊',
      confidence: 0.6,
      tags: ['other']
    };
  }

  // Spending Pattern Analysis
  static async analyzeSpendingPatterns(transactions: any[]): Promise<{
    insights: SpendingInsight[];
    recommendations: string[];
    trends: any[];
  }> {
    try {
      const insights: SpendingInsight[] = [];
      const recommendations: string[] = [];
      
      // Analyze by category
      const categorySpending = new Map<string, number>();
      transactions.forEach(tx => {
        const current = categorySpending.get(tx.category) || 0;
        categorySpending.set(tx.category, current + tx.amount);
      });

      // Find top spending category
      const topCategory = Array.from(categorySpending.entries())
        .sort((a, b) => b[1] - a[1])[0];

      if (topCategory) {
        const percentage = (topCategory[1] / transactions.reduce((sum, tx) => sum + tx.amount, 0)) * 100;
        if (percentage > 40) {
          insights.push({
            type: 'info',
            title: `High ${topCategory[0]} spending`,
            description: `${topCategory[0]} accounts for ${percentage.toFixed(1)}% of your spending`,
            icon: '📊',
            confidence: 0.9,
            actionable: true,
            action: {
              type: 'create_budget',
              data: { category: topCategory[0] }
            }
          });
          recommendations.push(`Consider setting a budget for ${topCategory[0]} expenses`);
        }
      }

      // Analyze frequency
      const dailySpending = new Map<string, number>();
      transactions.forEach(tx => {
        const day = tx.date.toDateString();
        const current = dailySpending.get(day) || 0;
        dailySpending.set(day, current + tx.amount);
      });

      const avgDailySpending = Array.from(dailySpending.values())
        .reduce((sum, amount) => sum + amount, 0) / dailySpending.size;

      insights.push({
        type: 'info',
        title: 'Spending Pattern',
        description: `Your average daily spending is $${avgDailySpending.toFixed(2)}`,
        icon: '💳',
        confidence: 0.8,
        actionable: false
      });

      // Analyze merchant frequency
      const merchantCount = new Map<string, number>();
      transactions.forEach(tx => {
        merchantCount.set(tx.merchant, (merchantCount.get(tx.merchant) || 0) + 1);
      });

      const frequentMerchant = Array.from(merchantCount.entries())
        .sort((a, b) => b[1] - a[1])[0];

      if (frequentMerchant && frequentMerchant[1] > 5) {
        insights.push({
          type: 'info',
          title: 'Frequent Merchant',
          description: `You shop at ${frequentMerchant[0]} frequently (${frequentMerchant[1]} times)`,
          icon: '🏪',
          confidence: 0.7,
          actionable: false
        });
      }

      // Weekly vs weekend spending
      const weekdaySpending = transactions.filter(tx => {
        const day = tx.date.getDay();
        return day >= 1 && day <= 5;
      }).reduce((sum, tx) => sum + tx.amount, 0);

      const weekendSpending = transactions.filter(tx => {
        const day = tx.date.getDay();
        return day === 0 || day === 6;
      }).reduce((sum, tx) => sum + tx.amount, 0);

      if (weekendSpending > weekdaySpending * 1.5) {
        insights.push({
          type: 'warning',
          title: 'Weekend Spending Alert',
          description: 'You spend significantly more on weekends',
          icon: '⚠️',
          confidence: 0.8,
          actionable: true,
          action: {
            type: 'set_reminder',
            data: { type: 'weekend_budget' }
          }
        });
      }

      return {
        insights,
        recommendations,
        trends: [] // TODO: Implement trend analysis
      };
    } catch (error) {
      console.error('Analyze spending patterns error:', error);
      return {
        insights: [],
        recommendations: [],
        trends: []
      };
    }
  }

  // Budget Predictions
  static async predictBudgetOverrun(
    currentSpending: number,
    budgetLimit: number,
    daysInPeriod: number,
    daysPassed: number
  ): Promise<{
    willExceed: boolean;
    projectedAmount: number;
    daysToOverrun?: number;
    confidence: number;
  }> {
    try {
      const dailyAverage = currentSpending / daysPassed;
      const projectedAmount = dailyAverage * daysInPeriod;
      const willExceed = projectedAmount > budgetLimit;
      
      let daysToOverrun;
      if (willExceed && dailyAverage > 0) {
        daysToOverrun = Math.ceil((budgetLimit - currentSpending) / dailyAverage) + daysPassed;
      }

      return {
        willExceed,
        projectedAmount,
        daysToOverrun,
        confidence: daysPassed > 7 ? 0.8 : 0.6 // Higher confidence with more data
      };
    } catch (error) {
      console.error('Predict budget overrun error:', error);
      return {
        willExceed: false,
        projectedAmount: currentSpending,
        confidence: 0.0
      };
    }
  }

  // Utility Methods
  private static matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private static isAmountLine(line: string): boolean {
    return /\$?\d+\.?\d*/.test(line);
  }

  private static isDateLine(line: string): boolean {
    return /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(line);
  }

  private static extractDate(line: string): Date | null {
    const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
    const match = line.match(dateRegex);
    
    if (match) {
      const [, month, day, year] = match;
      const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
      return new Date(fullYear, parseInt(month) - 1, parseInt(day));
    }
    
    return null;
  }

  private static extractAmounts(line: string): number[] {
    const amountRegex = /\$?(\d+\.?\d*)/g;
    const amounts: number[] = [];
    let match;
    
    while ((match = amountRegex.exec(line)) !== null) {
      const amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0) {
        amounts.push(amount);
      }
    }
    
    return amounts;
  }

  private static extractLocation(text: string): string | undefined {
    // Simple location extraction - in production would use NLP
    const lines = text.split('\n');
    for (const line of lines.slice(1, 5)) { // Check first few lines after merchant
      if (line.match(/\d+.*(?:street|st|road|rd|avenue|ave|lane|ln)/i)) {
        return line.trim();
      }
    }
    return undefined;
  }

  private static calculateMLKitConfidence(result: any): number {
    // Calculate confidence based on ML Kit result
    if (!result.blocks || result.blocks.length === 0) return 0.3;
    
    let totalConfidence = 0;
    let totalElements = 0;
    
    result.blocks.forEach((block: any) => {
      if (block.lines) {
        block.lines.forEach((line: any) => {
          if (line.elements) {
            line.elements.forEach((element: any) => {
              if (element.confidence) {
                totalConfidence += element.confidence;
                totalElements++;
              }
            });
          }
        });
      }
    });
    
    return totalElements > 0 ? totalConfidence / totalElements : 0.7;
  }

  private static getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Food & Drink': '🍽️',
      'Transport': '🚗',
      'Shopping': '🛍️',
      'Bills & Utilities': '⚡',
      'Health & Fitness': '🏥',
      'Entertainment': '🎬',
      'Groceries': '🛒',
      'Housing': '🏠',
      'Income': '💰',
      'Other': '📊'
    };
    
    return icons[category] || '📊';
  }

  private static getMockReceiptData(): { text: string; confidence: number } {
    return {
      text: `WOOLWORTHS
123 Main Street
Sydney NSW 2000

Date: 15/06/2024
Time: 14:30

Apples Red 1kg        $4.50
Bread White          $2.80
Milk 2L              $3.20
Chicken Breast 500g  $8.90
Bananas 1kg          $3.40

Subtotal            $22.80
GST                  $2.28
TOTAL               $25.08

Payment: Card
Thank you for shopping with us!`,
      confidence: 0.85
    };
  }

  // Smart reminder timing optimization
  static calculateOptimalReminderTime(bill: any, userPreferences?: any): Date {
    const dueDate = new Date(bill.dueDate);
    const now = new Date();
    
    // Default to 3 days before due date at 9 AM
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - 3);
    reminderDate.setHours(9, 0, 0, 0);
    
    // Adjust based on user preferences
    if (userPreferences?.reminderDaysBefore) {
      reminderDate.setDate(dueDate.getDate() - userPreferences.reminderDaysBefore);
    }
    
    if (userPreferences?.preferredTime) {
      const [hour, minute] = userPreferences.preferredTime.split(':');
      reminderDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
    }
    
    // Ensure reminder is in the future
    if (reminderDate <= now) {
      reminderDate.setTime(now.getTime() + 60000); // 1 minute from now
    }
    
    return reminderDate;
  }

  // Detect recurring patterns
  static detectRecurringPattern(transactions: any[]): {
    isRecurring: boolean;
    frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null;
    confidence: number;
    nextExpected?: Date;
  } {
    if (transactions.length < 3) {
      return { isRecurring: false, frequency: null, confidence: 0 };
    }

    // Sort by date
    const sortedTx = transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Calculate intervals between transactions
    const intervals: number[] = [];
    for (let i = 1; i < sortedTx.length; i++) {
      const intervalDays = Math.round(
        (sortedTx[i].date.getTime() - sortedTx[i-1].date.getTime()) / (1000 * 60 * 60 * 24)
      );
      intervals.push(intervalDays);
    }

    // Check for consistent intervals
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Low variance indicates recurring pattern
    const confidence = Math.max(0, 1 - (stdDev / avgInterval));
    
    if (confidence > 0.7) {
      let frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null = null;
      
      if (avgInterval >= 6 && avgInterval <= 8) frequency = 'weekly';
      else if (avgInterval >= 28 && avgInterval <= 32) frequency = 'monthly';
      else if (avgInterval >= 88 && avgInterval <= 95) frequency = 'quarterly';
      else if (avgInterval >= 360 && avgInterval <= 370) frequency = 'yearly';
      
      if (frequency) {
        const lastTransaction = sortedTx[sortedTx.length - 1];
        const nextExpected = new Date(lastTransaction.date);
        nextExpected.setDate(nextExpected.getDate() + avgInterval);
        
        return {
          isRecurring: true,
          frequency,
          confidence,
          nextExpected
        };
      }
    }

    return { isRecurring: false, frequency: null, confidence: 0 };
  }
}