import { ApiService } from '@/services/api/ApiService';
import { PersonalTransaction, PersonalAnalytics } from '@/types/moneyManagement';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export interface ExportOptions {
  format: 'csv' | 'pdf';
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  includeCategories?: string[];
  transactionTypes?: ('income' | 'expense')[];
}

export class PremiumFeaturesService {
  private static instance: PremiumFeaturesService;
  private apiService: ApiService;

  private constructor() {
    this.apiService = ApiService.getInstance();
  }

  public static getInstance(): PremiumFeaturesService {
    if (!PremiumFeaturesService.instance) {
      PremiumFeaturesService.instance = new PremiumFeaturesService();
    }
    return PremiumFeaturesService.instance;
  }

  async checkPremiumAccess(userId: string): Promise<boolean> {
    try {
      const response = await this.apiService.get(`/users/${userId}/subscription`);
      return response.success && response.data?.isPremium;
    } catch (error) {
      console.error('Error checking premium access:', error);
      return false;
    }
  }

  async exportTransactionsToCSV(
    transactions: PersonalTransaction[], 
    options: ExportOptions
  ): Promise<void> {
    try {
      // Filter transactions based on options
      const filteredTransactions = this.filterTransactions(transactions, options);
      
      // Generate CSV content
      const csvContent = this.generateCSVContent(filteredTransactions);
      
      // Create file
      const fileName = `transactions_${this.formatDate(options.dateRange.startDate)}_to_${this.formatDate(options.dateRange.endDate)}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Transactions',
        });
      } else {
        Alert.alert('Success', `File saved to: ${fileUri}`);
      }
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw new Error('Failed to export transactions to CSV');
    }
  }

  async exportTransactionsToPDF(
    transactions: PersonalTransaction[], 
    analytics: PersonalAnalytics | null,
    options: ExportOptions
  ): Promise<void> {
    try {
      // For PDF export, we'll call the backend to generate it
      const exportData = {
        transactions: this.filterTransactions(transactions, options),
        analytics,
        options,
        generatedAt: new Date().toISOString()
      };

      const response = await this.apiService.post('/money/export/pdf', exportData);
      
      if (response.success && response.data.downloadUrl) {
        // Download and share the PDF
        const fileName = `financial_report_${this.formatDate(options.dateRange.startDate)}_to_${this.formatDate(options.dateRange.endDate)}.pdf`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        const downloadResult = await FileSystem.downloadAsync(
          response.data.downloadUrl,
          fileUri
        );
        
        if (downloadResult.status === 200) {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Financial Report',
            });
          } else {
            Alert.alert('Success', `PDF saved to: ${fileUri}`);
          }
        } else {
          throw new Error('Failed to download PDF');
        }
      } else {
        throw new Error(response.message || 'Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw new Error('Failed to export transactions to PDF');
    }
  }

  async exportAnalyticsReport(
    analytics: PersonalAnalytics,
    format: 'csv' | 'pdf'
  ): Promise<void> {
    try {
      if (format === 'csv') {
        await this.exportAnalyticsToCSV(analytics);
      } else {
        await this.exportAnalyticsToPDF(analytics);
      }
    } catch (error) {
      console.error('Error exporting analytics report:', error);
      throw new Error(`Failed to export analytics to ${format.toUpperCase()}`);
    }
  }

  private filterTransactions(
    transactions: PersonalTransaction[], 
    options: ExportOptions
  ): PersonalTransaction[] {
    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      const inDateRange = transactionDate >= options.dateRange.startDate && 
                         transactionDate <= options.dateRange.endDate;
      
      const matchesType = !options.transactionTypes || 
                         options.transactionTypes.includes(transaction.type);
      
      const matchesCategory = !options.includeCategories || 
                             options.includeCategories.includes(transaction.category);
      
      return inDateRange && matchesType && matchesCategory;
    });
  }

  private generateCSVContent(transactions: PersonalTransaction[]): string {
    const headers = [
      'Date',
      'Type',
      'Description',
      'Category',
      'Subcategory',
      'Amount',
      'Payment Method',
      'Tags',
      'Notes',
      'Recurring',
      'Source'
    ];
    
    const csvRows = [headers.join(',')];
    
    transactions.forEach(transaction => {
      const row = [
        this.formatDate(new Date(transaction.date)),
        transaction.type,
        `"${transaction.description.replace(/"/g, '""')}"`,
        transaction.category,
        transaction.subcategory || '',
        transaction.amount.toString(),
        transaction.paymentMethod || '',
        `"${(transaction.tags || []).join(', ')}"`,
        `"${(transaction.notes || '').replace(/"/g, '""')}"`,
        transaction.isRecurring ? 'Yes' : 'No',
        transaction.source
      ];
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }

  private async exportAnalyticsToCSV(analytics: PersonalAnalytics): Promise<void> {
    const fileName = `analytics_report_${this.formatDate(analytics.startDate)}_to_${this.formatDate(analytics.endDate)}.csv`;
    const fileUri = FileSystem.documentDirectory + fileName;
    
    // Generate analytics CSV content
    const csvContent = this.generateAnalyticsCSVContent(analytics);
    
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Analytics Report',
      });
    }
  }

  private async exportAnalyticsToPDF(analytics: PersonalAnalytics): Promise<void> {
    const response = await this.apiService.post('/money/export/analytics-pdf', {
      analytics,
      generatedAt: new Date().toISOString()
    });
    
    if (response.success && response.data.downloadUrl) {
      const fileName = `analytics_report_${this.formatDate(analytics.startDate)}_to_${this.formatDate(analytics.endDate)}.pdf`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      const downloadResult = await FileSystem.downloadAsync(
        response.data.downloadUrl,
        fileUri
      );
      
      if (downloadResult.status === 200) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Analytics Report',
          });
        }
      }
    }
  }

  private generateAnalyticsCSVContent(analytics: PersonalAnalytics): string {
    const sections = [];
    
    // Summary section
    sections.push('FINANCIAL SUMMARY');
    sections.push(`Period,${this.formatDate(analytics.startDate)} to ${this.formatDate(analytics.endDate)}`);
    sections.push(`Total Income,${analytics.totalIncome}`);
    sections.push(`Total Expenses,${analytics.totalExpenses}`);
    sections.push(`Net Savings,${analytics.netSavings}`);
    sections.push(`Savings Rate,${analytics.savingsRate}%`);
    sections.push('');
    
    // Category breakdown
    sections.push('EXPENSE BREAKDOWN');
    sections.push('Category,Amount,Percentage,Transaction Count,Average Amount,Trend');
    analytics.categoryBreakdown.forEach(category => {
      sections.push(`${category.category},${category.amount},${category.percentage}%,${category.transactionCount},${category.averageAmount},${category.trend}`);
    });
    sections.push('');
    
    // Income breakdown
    sections.push('INCOME BREAKDOWN');
    sections.push('Category,Amount,Percentage,Transaction Count,Average Amount');
    analytics.incomeBreakdown.forEach(income => {
      sections.push(`${income.category},${income.amount},${income.percentage}%,${income.transactionCount},${income.averageAmount}`);
    });
    sections.push('');
    
    // Monthly trends
    sections.push('MONTHLY TRENDS');
    sections.push('Month,Income,Expenses,Savings,Savings Rate');
    analytics.monthlyTrends.forEach(trend => {
      sections.push(`${trend.month},${trend.income},${trend.expenses},${trend.savings},${trend.savingsRate}%`);
    });
    
    return sections.join('\n');
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async getExportHistory(userId: string): Promise<any[]> {
    try {
      const response = await this.apiService.get(`/money/export/history`);
      return response.success ? response.data.exports : [];
    } catch (error) {
      console.error('Error getting export history:', error);
      return [];
    }
  }

  async scheduleRecurringExport(
    userId: string,
    exportConfig: {
      frequency: 'weekly' | 'monthly' | 'quarterly';
      format: 'csv' | 'pdf';
      email: string;
      includeAnalytics: boolean;
    }
  ): Promise<boolean> {
    try {
      const response = await this.apiService.post('/money/export/recurring', {
        ...exportConfig,
        userId
      });
      return response.success;
    } catch (error) {
      console.error('Error scheduling recurring export:', error);
      return false;
    }
  }

  async cancelRecurringExport(userId: string, exportId: string): Promise<boolean> {
    try {
      const response = await this.apiService.delete(`/money/export/recurring/${exportId}`);
      return response.success;
    } catch (error) {
      console.error('Error canceling recurring export:', error);
      return false;
    }
  }
}

export default PremiumFeaturesService;