import { Analytics, CategoryBreakdown, Expense, Income, PredictionData, TrendData } from "@/types";

export class AnalyticsService {
  private static instance: AnalyticsService;
  
  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  generateAnalytics(expenses: Expense[], income: Income[], period: 'daily' | 'weekly' | 'monthly' | 'yearly'): Analytics {
    const filteredExpenses = this.filterByPeriod(expenses, period);
    const filteredIncome = this.filterByPeriod(income, period);

    const totalIncome = filteredIncome.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
    const netFlow = totalIncome - totalExpenses;

    const categoryBreakdown = this.generateCategoryBreakdown(filteredExpenses, totalIncome);
    const trends = this.generateTrends(expenses, income, period);
    const predictions = this.generatePredictions(expenses, income);

    return {
      period,
      totalIncome,
      totalExpenses,
      netFlow,
      categoryBreakdown,
      trends,
      predictions
    };
  }

  private filterByPeriod(items: (Expense | Income)[], period: string): (Expense | Income)[] {
    const now = new Date();
    const startDate = new Date();

    switch (period) {
      case 'daily':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'yearly':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return items.filter(item => new Date(item.date) >= startDate);
  }

  private generateCategoryBreakdown(expenses: Expense[], totalIncome: number): CategoryBreakdown[] {
    const categoryTotals: { [key: string]: number } = {};
    
    expenses.forEach(expense => {
      categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });

    const categoryColors: { [key: string]: string } = {
      'Housing': '#FF6B6B',
      'Transportation': '#4ECDC4',
      'Food': '#45B7D1',
      'Utilities': '#96CEB4',
      'Healthcare': '#FFEAA7',
      'Entertainment': '#DDA0DD',
      'Shopping': '#98D8C8',
      'Education': '#F7DC6F',
      'Insurance': '#BB8FCE',
      'Loans': '#F1948A',
      'Other': '#85C1E9'
    };

    const categoryIcons: { [key: string]: string } = {
      'Housing': '🏠',
      'Transportation': '🚗',
      'Food': '🍽️',
      'Utilities': '💡',
      'Healthcare': '🏥',
      'Entertainment': '🎬',
      'Shopping': '🛍️',
      'Education': '📚',
      'Insurance': '🛡️',
      'Loans': '💳',
      'Other': '📊'
    };

    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
        color: categoryColors[category] || '#95A5A6',
        icon: categoryIcons[category] || '📊',
        trend: 'stable' as const // Simplified for demo
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private generateTrends(expenses: Expense[], income: Income[], period: string): TrendData[] {
    const days = period === 'weekly' ? 7 : period === 'monthly' ? 30 : 365;
    const trends: TrendData[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayExpenses = expenses
        .filter(e => e.date === dateStr)
        .reduce((sum, e) => sum + e.amount, 0);

      const dayIncome = income
        .filter(inc => inc.date === dateStr)
        .reduce((sum, inc) => sum + inc.amount, 0);

      trends.push({
        date: dateStr,
        income: dayIncome,
        expenses: dayExpenses,
        netFlow: dayIncome - dayExpenses
      });
    }

    return trends;
  }

  private generatePredictions(expenses: Expense[], income: Income[]): PredictionData[] {
    // Simplified prediction algorithm
    const monthlyExpenses = this.filterByPeriod(expenses, 'monthly');
    const categoryTotals: { [key: string]: number[] } = {};

    monthlyExpenses.forEach(expense => {
      if (!categoryTotals[expense.category]) {
        categoryTotals[expense.category] = [];
      }
      categoryTotals[expense.category].push(expense.amount);
    });

    return Object.entries(categoryTotals).map(([category, amounts]) => {
      const avg = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
      const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - avg, 2), 0) / amounts.length;
      const confidence = Math.max(0.5, 1 - (variance / (avg * avg))); // Simplified confidence

      let recommendation = '';
      if (avg > 500) {
        recommendation = `Consider budgeting strategies for ${category.toLowerCase()} expenses`;
      } else if (avg > 200) {
        recommendation = `Monitor ${category.toLowerCase()} spending trends`;
      } else {
        recommendation = `${category} spending is well controlled`;
      }

      return {
        category,
        predictedAmount: avg * 1.1, // 10% buffer for next month
        confidence,
        recommendation
      };
    });
  }
}
  