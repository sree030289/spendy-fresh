// src/services/analytics/AnalyticsService.ts
import { Expense, Group, Friend } from '@/types';

export interface AnalyticsData {
  totalSpent: number;
  totalIncome: number;
  groupCount: number;
  friendCount: number;
  categoryBreakdown: CategoryData[];
  topSpenders: SpenderData[];
  settlementSpeed: SettlementData[];
  groupInsights: GroupInsightData[];
  spendingTrend: TrendData[];
  paymentPatterns: PaymentPattern[];
}

export interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  transactionCount: number;
}

export interface SpenderData {
  id: string;
  name: string;
  amount: number;
  avatar?: string;
  transactionCount: number;
}

export interface SettlementData {
  id: string;
  name: string;
  avgDays: number;
  status: 'fast' | 'medium' | 'slow';
  settledCount: number;
  pendingCount: number;
}

export interface GroupInsightData {
  groupId: string;
  groupName: string;
  totalSpent: number;
  topPayer: string;
  topPayerId: string;
  memberCount: number;
  avgPerPerson: number;
}

export interface TrendData {
  period: string;
  amount: number;
  transactionCount: number;
  date: Date;
}

export interface PaymentPattern {
  dayOfWeek: string;
  amount: number;
  frequency: number;
}

class AnalyticsService {
  private static instance: AnalyticsService;

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  // Category colors
  private categoryColors: { [key: string]: string } = {
    'Food & Dining': '#FF6B6B',
    'Entertainment': '#4ECDC4',
    'Travel': '#45B7D1',
    'Shopping': '#FFA07A',
    'Utilities': '#96CEB4',
    'Transportation': '#FFEAA7',
    'Healthcare': '#DDA15E',
    'Education': '#BC6C25',
    'Others': '#98D8C8',
  };

  /**
   * Process expenses data and generate comprehensive analytics
   */
  async generateAnalytics(
    expenses: Expense[],
    groups: Group[],
    friends: Friend[],
    timeRange: 'week' | 'month' | 'year' | 'all' = 'month'
  ): Promise<AnalyticsData> {
    // Filter expenses by time range
    const filteredExpenses = this.filterByTimeRange(expenses, timeRange);

    return {
      totalSpent: this.calculateTotalSpent(filteredExpenses),
      totalIncome: this.calculateTotalIncome(filteredExpenses),
      groupCount: groups.length,
      friendCount: friends.length,
      categoryBreakdown: this.analyzeCategoryBreakdown(filteredExpenses),
      topSpenders: this.rankTopSpenders(filteredExpenses, friends),
      settlementSpeed: this.analyzeSettlementSpeed(filteredExpenses, friends),
      groupInsights: this.analyzeGroupInsights(filteredExpenses, groups),
      spendingTrend: this.calculateSpendingTrend(filteredExpenses, timeRange),
      paymentPatterns: this.analyzePaymentPatterns(filteredExpenses),
    };
  }

  /**
   * Filter expenses by time range
   */
  private filterByTimeRange(expenses: Expense[], timeRange: string): Expense[] {
    const now = new Date();
    const cutoffDate = new Date();

    switch (timeRange) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        return expenses;
    }

    return expenses.filter((expense) => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= cutoffDate;
    });
  }

  /**
   * Calculate total spent
   */
  private calculateTotalSpent(expenses: Expense[]): number {
    return expenses
      .filter((e) => e.type === 'expense')
      .reduce((sum, expense) => sum + expense.amount, 0);
  }

  /**
   * Calculate total income
   */
  private calculateTotalIncome(expenses: Expense[]): number {
    return expenses
      .filter((e) => e.type === 'income')
      .reduce((sum, expense) => sum + expense.amount, 0);
  }

  /**
   * Analyze category breakdown
   */
  private analyzeCategoryBreakdown(expenses: Expense[]): CategoryData[] {
    const categoryMap = new Map<string, { amount: number; count: number }>();

    expenses
      .filter((e) => e.type === 'expense')
      .forEach((expense) => {
        const category = expense.category || 'Others';
        const existing = categoryMap.get(category) || { amount: 0, count: 0 };
        categoryMap.set(category, {
          amount: existing.amount + expense.amount,
          count: existing.count + 1,
        });
      });

    const total = Array.from(categoryMap.values()).reduce(
      (sum, cat) => sum + cat.amount,
      0
    );

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        percentage: (data.amount / total) * 100,
        color: this.categoryColors[category] || this.categoryColors['Others'],
        transactionCount: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * Rank top spenders
   */
  private rankTopSpenders(expenses: Expense[], friends: Friend[]): SpenderData[] {
    const spenderMap = new Map<string, { amount: number; count: number; name: string }>();

    expenses.forEach((expense) => {
      if (expense.paidBy) {
        const existing = spenderMap.get(expense.paidBy) || {
          amount: 0,
          count: 0,
          name: this.getFriendName(expense.paidBy, friends),
        };
        spenderMap.set(expense.paidBy, {
          amount: existing.amount + expense.amount,
          count: existing.count + 1,
          name: existing.name,
        });
      }
    });

    return Array.from(spenderMap.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        amount: data.amount,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }

  /**
   * Analyze settlement speed
   */
  private analyzeSettlementSpeed(
    expenses: Expense[],
    friends: Friend[]
  ): SettlementData[] {
    const settlementMap = new Map<
      string,
      { totalDays: number; count: number; pending: number }
    >();

    expenses.forEach((expense) => {
      if (expense.settledDate && expense.date) {
        const daysDiff = this.getDaysDifference(
          new Date(expense.date),
          new Date(expense.settledDate)
        );

        expense.splits?.forEach((split) => {
          const existing = settlementMap.get(split.userId) || {
            totalDays: 0,
            count: 0,
            pending: 0,
          };
          settlementMap.set(split.userId, {
            totalDays: existing.totalDays + daysDiff,
            count: existing.count + 1,
            pending: existing.pending,
          });
        });
      } else {
        // Count pending settlements
        expense.splits?.forEach((split) => {
          if (!split.settled) {
            const existing = settlementMap.get(split.userId) || {
              totalDays: 0,
              count: 0,
              pending: 0,
            };
            settlementMap.set(split.userId, {
              ...existing,
              pending: existing.pending + 1,
            });
          }
        });
      }
    });

    return Array.from(settlementMap.entries())
      .map(([id, data]) => {
        const avgDays = data.count > 0 ? data.totalDays / data.count : 0;
        return {
          id,
          name: this.getFriendName(id, friends),
          avgDays,
          status: this.getSettlementStatus(avgDays),
          settledCount: data.count,
          pendingCount: data.pending,
        };
      })
      .sort((a, b) => a.avgDays - b.avgDays);
  }

  /**
   * Analyze group insights
   */
  private analyzeGroupInsights(expenses: Expense[], groups: Group[]): GroupInsightData[] {
    const groupMap = new Map<string, { total: number; payers: Map<string, number> }>();

    expenses.forEach((expense) => {
      if (expense.groupId) {
        const existing = groupMap.get(expense.groupId) || {
          total: 0,
          payers: new Map(),
        };

        existing.total += expense.amount;

        if (expense.paidBy) {
          const payerAmount = existing.payers.get(expense.paidBy) || 0;
          existing.payers.set(expense.paidBy, payerAmount + expense.amount);
        }

        groupMap.set(expense.groupId, existing);
      }
    });

    return Array.from(groupMap.entries())
      .map(([groupId, data]) => {
        const group = groups.find((g) => g.id === groupId);
        const topPayerEntry = Array.from(data.payers.entries()).sort(
          (a, b) => b[1] - a[1]
        )[0];

        return {
          groupId,
          groupName: group?.name || 'Unknown Group',
          totalSpent: data.total,
          topPayer: topPayerEntry ? topPayerEntry[0] : 'N/A',
          topPayerId: topPayerEntry ? topPayerEntry[0] : '',
          memberCount: group?.members?.length || 0,
          avgPerPerson: group?.members?.length
            ? data.total / group.members.length
            : data.total,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }

  /**
   * Calculate spending trend
   */
  private calculateSpendingTrend(expenses: Expense[], timeRange: string): TrendData[] {
    const trendMap = new Map<string, { amount: number; count: number; date: Date }>();

    expenses.forEach((expense) => {
      const date = new Date(expense.date);
      const key = this.getPeriodKey(date, timeRange);

      const existing = trendMap.get(key) || { amount: 0, count: 0, date };
      trendMap.set(key, {
        amount: existing.amount + expense.amount,
        count: existing.count + 1,
        date: existing.date,
      });
    });

    return Array.from(trendMap.entries())
      .map(([period, data]) => ({
        period,
        amount: data.amount,
        transactionCount: data.count,
        date: data.date,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Analyze payment patterns (day of week)
   */
  private analyzePaymentPatterns(expenses: Expense[]): PaymentPattern[] {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const patternMap = new Map<string, { amount: number; count: number }>();

    expenses.forEach((expense) => {
      const dayOfWeek = days[new Date(expense.date).getDay()];
      const existing = patternMap.get(dayOfWeek) || { amount: 0, count: 0 };
      patternMap.set(dayOfWeek, {
        amount: existing.amount + expense.amount,
        count: existing.count + 1,
      });
    });

    return days.map((day) => {
      const data = patternMap.get(day) || { amount: 0, count: 0 };
      return {
        dayOfWeek: day,
        amount: data.amount,
        frequency: data.count,
      };
    });
  }

  // Helper methods

  private getFriendName(userId: string, friends: Friend[]): string {
    const friend = friends.find((f) => f.id === userId);
    return friend?.name || 'Unknown';
  }

  private getDaysDifference(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private getSettlementStatus(avgDays: number): 'fast' | 'medium' | 'slow' {
    if (avgDays <= 2) return 'fast';
    if (avgDays <= 5) return 'medium';
    return 'slow';
  }

  private getPeriodKey(date: Date, timeRange: string): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    switch (timeRange) {
      case 'week':
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      case 'month':
        return `Week ${Math.ceil(date.getDate() / 7)}`;
      case 'year':
        return months[date.getMonth()];
      case 'all':
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
      default:
        return date.toLocaleDateString();
    }
  }
}

export default AnalyticsService;
