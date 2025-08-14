import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
// Icon import handled by existing Icon component
import { Icon } from '../common/Icon';
import { useTheme } from '@/hooks/useTheme';
import { PersonalTransaction } from '@/types/moneyManagement';

const { width: screenWidth } = Dimensions.get('window');

interface CalendarViewModalProps {
  visible: boolean;
  transactions: PersonalTransaction[];
  onClose: () => void;
}

interface DayData {
  date: string;
  day: number;
  transactions: PersonalTransaction[];
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

const CalendarViewModal: React.FC<CalendarViewModalProps> = ({
  visible,
  transactions,
  onClose,
}) => {
  const { theme } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());

  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Get previous month's last days to fill the calendar
    const prevMonth = new Date(year, month - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    const days: DayData[] = [];
    const today = new Date();
    
    // Previous month's days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(year, month - 1, day);
      const dateString = date.toISOString().split('T')[0];
      
      const dayTransactions = transactions.filter(t => 
        new Date(t.date).toISOString().split('T')[0] === dateString
      );
      
      const totalIncome = dayTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalExpenses = dayTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      days.push({
        date: dateString,
        day,
        transactions: dayTransactions,
        totalIncome,
        totalExpenses,
        netAmount: totalIncome - totalExpenses,
        isCurrentMonth: false,
        isToday: false,
      });
    }
    
    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split('T')[0];
      const isToday = dateString === today.toISOString().split('T')[0];
      
      const dayTransactions = transactions.filter(t => 
        new Date(t.date).toISOString().split('T')[0] === dateString
      );
      
      const totalIncome = dayTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalExpenses = dayTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      days.push({
        date: dateString,
        day,
        transactions: dayTransactions,
        totalIncome,
        totalExpenses,
        netAmount: totalIncome - totalExpenses,
        isCurrentMonth: true,
        isToday,
      });
    }
    
    // Next month's days to complete the grid
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const dateString = date.toISOString().split('T')[0];
      
      const dayTransactions = transactions.filter(t => 
        new Date(t.date).toISOString().split('T')[0] === dateString
      );
      
      const totalIncome = dayTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalExpenses = dayTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      days.push({
        date: dateString,
        day,
        transactions: dayTransactions,
        totalIncome,
        totalExpenses,
        netAmount: totalIncome - totalExpenses,
        isCurrentMonth: false,
        isToday: false,
      });
    }
    
    return days;
  }, [currentDate, transactions]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const renderDayCell = (dayData: DayData) => {
    const hasTransactions = dayData.transactions.length > 0;
    const hasIncome = dayData.totalIncome > 0;
    const hasExpenses = dayData.totalExpenses > 0;
    
    return (
      <TouchableOpacity
        key={dayData.date}
        style={[
          styles.dayCell,
          dayData.isToday && [styles.todayCell, { backgroundColor: theme.colors.primary }],
          !dayData.isCurrentMonth && styles.otherMonthCell,
        ]}
        disabled={!hasTransactions}
      >
        <Text style={[
          styles.dayNumber,
          dayData.isToday && styles.todayText,
          !dayData.isCurrentMonth && [styles.otherMonthText, { color: theme.colors.textSecondary }],
          dayData.isCurrentMonth && { color: theme.colors.text }
        ]}>
          {dayData.day}
        </Text>
        
        {hasTransactions && (
          <View style={styles.transactionIndicators}>
            {hasIncome && (
              <View style={[styles.incomeIndicator, { backgroundColor: theme.colors.success }]} />
            )}
            {hasExpenses && (
              <View style={[styles.expenseIndicator, { backgroundColor: theme.colors.error }]} />
            )}
            {dayData.transactions.length > 2 && (
              <Text style={[styles.transactionCount, { color: theme.colors.textSecondary }]}>
                +{dayData.transactions.length - 2}
              </Text>
            )}
          </View>
        )}
        
        {hasTransactions && dayData.isCurrentMonth && (
          <Text style={[
            styles.netAmount,
            { 
              color: dayData.netAmount >= 0 ? theme.colors.success : theme.colors.error,
              fontSize: 10
            }
          ]}>
            {dayData.netAmount >= 0 ? '+' : ''}${Math.abs(dayData.netAmount).toFixed(0)}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const monthYear = currentDate.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calculate monthly summary
  const currentMonthData = calendarData.filter(day => day.isCurrentMonth);
  const monthlyIncome = currentMonthData.reduce((sum, day) => sum + day.totalIncome, 0);
  const monthlyExpenses = currentMonthData.reduce((sum, day) => sum + day.totalExpenses, 0);
  const monthlySavings = monthlyIncome - monthlyExpenses;
  const transactionCount = currentMonthData.reduce((sum, day) => sum + day.transactions.length, 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Financial Calendar
          </Text>
          
          <TouchableOpacity>
            <Icon name="calendar" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Month Navigation */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity
            onPress={() => navigateMonth('prev')}
            style={[styles.navButton, { backgroundColor: theme.colors.surface }]}
          >
            <Icon name="back" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          
          <Text style={[styles.monthYearText, { color: theme.colors.text }]}>
            {monthYear}
          </Text>
          
          <TouchableOpacity
            onPress={() => navigateMonth('next')}
            style={[styles.navButton, { backgroundColor: theme.colors.surface }]}
          >
            <Icon name="forward" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Monthly Summary */}
        <View style={[styles.monthlySummary, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                Income
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.success }]}>
                ${monthlyIncome.toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                Expenses
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.error }]}>
                ${monthlyExpenses.toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                Net
              </Text>
              <Text style={[
                styles.summaryValue,
                { color: monthlySavings >= 0 ? theme.colors.success : theme.colors.error }
              ]}>
                ${Math.abs(monthlySavings).toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                Transactions
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {transactionCount}
              </Text>
            </View>
          </View>
        </View>

        {/* Calendar */}
        <ScrollView style={styles.calendarContainer} showsVerticalScrollIndicator={false}>
          {/* Day Headers */}
          <View style={styles.dayHeaders}>
            {daysOfWeek.map(day => (
              <Text key={day} style={[styles.dayHeader, { color: theme.colors.textSecondary }]}>
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {Array.from({ length: 6 }, (_, weekIndex) => (
              <View key={weekIndex} style={styles.calendarWeek}>
                {calendarData
                  .slice(weekIndex * 7, (weekIndex + 1) * 7)
                  .map(renderDayCell)}
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={[styles.legend, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.legendTitle, { color: theme.colors.text }]}>
              Legend
            </Text>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: theme.colors.success }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                  Income
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: theme.colors.error }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                  Expenses
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: theme.colors.primary }]} />
                <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                  Today
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthYearText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  monthlySummary: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  calendarContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 8,
  },
  calendarGrid: {
    gap: 4,
  },
  calendarWeek: {
    flexDirection: 'row',
    gap: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    padding: 4,
    minHeight: 50,
  },
  todayCell: {
    borderRadius: 8,
  },
  otherMonthCell: {
    opacity: 0.3,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  todayText: {
    color: 'white',
  },
  otherMonthText: {
    opacity: 0.5,
  },
  transactionIndicators: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 2,
  },
  incomeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  expenseIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  transactionCount: {
    fontSize: 8,
    fontWeight: '500',
  },
  netAmount: {
    fontSize: 8,
    fontWeight: '600',
  },
  legend: {
    margin: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 100,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default CalendarViewModal;