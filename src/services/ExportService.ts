// src/services/ExportService.ts
import { getCurrencySymbol } from '@/utils/currency';
import { ApiService } from '@/services/api/ApiService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Types for export - matching the Group interface from RealSplittingScreen
interface Group {
  id: string;
  name: string;
  description?: string;
  avatar: string;
  createdBy: string;
  members: Array<{
    userId: string;
    userData: {
      fullName: string;
      email: string;
      avatar?: string;
    };
    role: 'admin' | 'member';
    balance: number;
  }>;
  currency: string;
  createdAt: Date;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  createdAt: string | Date;
  paidByData: {
    fullName: string;
  };
  splitType: string;
  status?: string;
}

export class ExportService {
  static async exportGroupData(group: Group, format: 'csv' | 'pdf'): Promise<void> {
    try {
      console.log(`📤 Exporting group ${group.name} as ${format.toUpperCase()}`);
      
      // Get all expenses for the group
      const apiService = ApiService.getInstance();
      const expenses = await apiService.getGroupExpenses(group.id);
      
      if (format === 'csv') {
        await this.exportAsCSV(group, expenses);
      } else {
        await this.exportAsPDF(group, expenses);
      }
      
      console.log('✅ Export completed successfully');
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  }

  private static async exportAsCSV(group: Group, expenses: Expense[]): Promise<void> {
    const currencySymbol = getCurrencySymbol(group.currency);
    
    // Generate CSV content
    let csvContent = '';
    
    // Header section
    csvContent += `Group Export Report\n`;
    csvContent += `Group Name,${group.name}\n`;
    csvContent += `Total Members,${group.members.length}\n`;
    csvContent += `Currency,${group.currency}\n`;
    csvContent += `Export Date,${new Date().toISOString().split('T')[0]}\n\n`;
    
    // Members section
    csvContent += `Members\n`;
    csvContent += `Name,Email,Role,Balance\n`;
    group.members.forEach(member => {
      const currencySymbol = getCurrencySymbol(group.currency);
      csvContent += `"${member.userData.fullName}","${member.userData.email}","${member.role}","${currencySymbol}${member.balance.toFixed(2)}"\n`;
    });
    csvContent += `\n`;
    
    // Expenses section
    csvContent += `Expenses\n`;
    csvContent += `Date,Description,Amount,Currency,Category,Paid By,Split Type,Status\n`;
    expenses.forEach(expense => {
      const date = expense.createdAt instanceof Date ? expense.createdAt.toISOString().split('T')[0] : new Date(expense.createdAt).toISOString().split('T')[0];
      csvContent += `"${date}","${expense.description}","${expense.amount}","${expense.currency}","${expense.category}","${expense.paidByData.fullName}","${expense.splitType}","${expense.status || 'Active'}"\n`;
    });
    csvContent += `\n`;
    
    // Balance summary section
    csvContent += `Balance Summary\n`;
    csvContent += `Member,Balance\n`;
    group.members.forEach(member => {
      csvContent += `"${member.userData.fullName}","${currencySymbol}${member.balance.toFixed(2)}"\n`;
    });
    
    // Save to file
    const fileName = `${group.name.replace(/[^a-zA-Z0-9]/g, '_')}_export_${Date.now()}.csv`;
    const fileUri = FileSystem.documentDirectory + fileName;
    
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    
    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Export ${group.name} Data`,
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  }

  private static async exportAsPDF(group: Group, expenses: Expense[]): Promise<void> {
    // For PDF export, we'll create an HTML content and then convert to PDF
    // This is a simplified implementation - in a real app, you might want to use a proper PDF library
    
    const currencySymbol = getCurrencySymbol(group.currency);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${group.name} - Export Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; color: #2563EB; }
            .subtitle { font-size: 16px; color: #6B7280; margin-top: 5px; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #E5E7EB; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #E5E7EB; }
            th { background-color: #F9FAFB; font-weight: bold; }
            .amount { text-align: right; }
            .positive { color: #10B981; }
            .negative { color: #EF4444; }
            .summary-box { background-color: #F0F9FF; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .summary-item { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #6B7280; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">${group.name}</div>
            <div class="subtitle">Group Export Report</div>
            <div class="subtitle">Generated on ${new Date().toLocaleDateString()}</div>
        </div>
        
        <div class="section">
            <div class="summary-box">
                <div class="summary-item">
                    <strong>Total Members:</strong>
                    <span>${group.members.length}</span>
                </div>
                <div class="summary-item">
                    <strong>Total Expenses:</strong>
                    <span>${expenses.length}</span>
                </div>
                <div class="summary-item">
                    <strong>Total Amount:</strong>
                    <span>${currencySymbol}${totalExpenses.toFixed(2)}</span>
                </div>
                <div class="summary-item">
                    <strong>Currency:</strong>
                    <span>${group.currency}</span>
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Members</div>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th class="amount">Balance</th>
                    </tr>
                </thead>
                <tbody>`;
    
    group.members.forEach(member => {
      const balanceClass = member.balance > 0 ? 'positive' : member.balance < 0 ? 'negative' : '';
      htmlContent += `
                    <tr>
                        <td>${member.userData.fullName}</td>
                        <td>${member.userData.email}</td>
                        <td>${member.role}</td>
                        <td class="amount ${balanceClass}">${currencySymbol}${member.balance.toFixed(2)}</td>
                    </tr>`;
    });
    
    htmlContent += `
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <div class="section-title">Expenses</div>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Paid By</th>
                        <th class="amount">Amount</th>
                    </tr>
                </thead>
                <tbody>`;
    
    expenses.forEach(expense => {
      const date = expense.createdAt instanceof Date ? expense.createdAt.toLocaleDateString() : new Date(expense.createdAt).toLocaleDateString();
      htmlContent += `
                    <tr>
                        <td>${date}</td>
                        <td>${expense.description}</td>
                        <td>${expense.category}</td>
                        <td>${expense.paidByData.fullName}</td>
                        <td class="amount">${currencySymbol}${expense.amount.toFixed(2)}</td>
                    </tr>`;
    });
    
    htmlContent += `
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>This report was generated by Spendy - Expense Splitting App</p>
            <p>Export Date: ${new Date().toISOString()}</p>
        </div>
    </body>
    </html>`;
    
    // Save HTML content to file (in a real implementation, you'd convert this to PDF)
    const fileName = `${group.name.replace(/[^a-zA-Z0-9]/g, '_')}_report_${Date.now()}.html`;
    const fileUri = FileSystem.documentDirectory + fileName;
    
    await FileSystem.writeAsStringAsync(fileUri, htmlContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    
    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/html',
        dialogTitle: `Export ${group.name} Report`,
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  }
}