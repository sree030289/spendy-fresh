// SmartMoneyCalendarModal.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  FlatList,
  Alert,
} from 'react-native';
import { Icon } from '../common/Icon';
import { Expense, Income, Reminder } from '@/types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SmartMoneyCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  expenses: Expense[];
  income: Income[];
  reminders: Reminder[];
  theme: any;
  onExpensePress?: (expense: Expense) => void;
  onReminderPress?: (reminder: Reminder) => void;
  onAddExpense?: () => void;
  onAddReminder?: () => void;
}

const SmartMoneyCalendarModal: React.FC<SmartMoneyCalendarModalProps> = ({
  visible,
  onClose,
  expenses = [],
  income = [],
  reminders = [],
  theme,
  onExpensePress,
  onReminderPress,
  onAddExpense,
  onAddReminder,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'year'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    showExpenses: true,
    showReminders: true,
    showIncome: true,
    categories: [] as string[],
  });

  // Helper functions
  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
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
      'Salary': '#2ECC71',
      'Freelance': '#3498DB',
      'Investment': '#9B59B6',
      'Business': '#E67E22',
      'Bills': '#E74C3C',
      'Subscriptions': '#F39C12',
      'Rent': '#8E44AD',
      'Other': '#85C1E9'
    };
    return colors[category] || '#95A5A6';
  };

  const getCategoryEmoji = (category: string): string => {
    const emojis: Record<string, string> = {
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
      'Salary': '💰',
      'Freelance': '💻',
      'Investment': '📈',
      'Business': '🏢',
      'Bills': '📄',
      'Subscriptions': '📱',
      'Rent': '🏠',
      'Other': '📊'
    };
    return emojis[category] || '📊';
  };

  // Get all items for a specific date
  const getItemsForDate = (date: Date) => {
    const dateKey = formatDateKey(date);
    let items: any[] = [];

    if (filters.showExpenses) {
      const dayExpenses = expenses
        .filter(expense => expense.date === dateKey)
        .map(expense => ({ ...expense, itemType: 'expense', priority: 'medium' }));
      items.push(...dayExpenses);
    }

    if (filters.showIncome) {
      const dayIncome = income
        .filter(inc => inc.date === dateKey)
        .map(inc => ({ ...inc, itemType: 'income', priority: 'low' }));
      items.push(...dayIncome);
    }

    if (filters.showReminders) {
      const dayReminders = reminders
        .filter(reminder => reminder.dueDate === dateKey)
        .map(reminder => ({ ...reminder, itemType: 'reminder', date: reminder.dueDate }));
      items.push(...dayReminders);
    }

    // Sort by priority and time
    return items.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority as keyof typeof priorityOrder] || 1) - 
             (priorityOrder[a.priority as keyof typeof priorityOrder] || 1);
    });
  };

  // Navigation functions
  const navigate = (direction: number) => {
    const newDate = new Date(currentDate);
    
    switch (viewMode) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + direction);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction * 7));
        break;
      case 'year':
        newDate.setFullYear(newDate.getFullYear() + direction);
        break;
    }
    
    setCurrentDate(newDate);
  };

  const getCalendarTitle = (): string => {
    if (viewMode === 'year') {
      return currentDate.getFullYear().toString();
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Generate calendar days for month view
  const getMonthDays = (): Date[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days: Date[] = [];
    const currentDay = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    return days;
  };

  // Generate week days
  const getWeekDays = (): Date[] => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Generate months for year view
  const getYearMonths = (): Date[] => {
    const year = currentDate.getFullYear();
    const months: Date[] = [];
    for (let i = 0; i < 12; i++) {
      months.push(new Date(year, i, 1));
    }
    return months;
  };

  // Month View Component
  const renderMonthView = () => {
    const days = getMonthDays();
    const today = new Date();
    const currentMonth = currentDate.getMonth();

    return (
      <View style={styles.monthContainer}>
        {/* Day headers */}
        <View style={styles.dayHeadersRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <View key={day} style={styles.dayHeader}>
              <Text style={[styles.dayHeaderText, { color: theme.colors.textSecondary }]}>
                {day}
              </Text>
            </View>
          ))}
        </View>
        
        {/* Calendar days grid */}
        <View style={styles.monthGrid}>
          {days.map((day, index) => {
            const isCurrentMonth = day.getMonth() === currentMonth;
            const isToday = day.toDateString() === today.toDateString();
            const items = getItemsForDate(day);
            const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.monthDay,
                  { backgroundColor: isCurrentMonth ? theme.colors.surface : theme.colors.background },
                  isToday && { borderColor: theme.colors.primary, borderWidth: 2 }
                ]}
                onPress={() => setSelectedDate(day)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dayNumber,
                  { color: isCurrentMonth ? theme.colors.text : theme.colors.textSecondary },
                  isToday && { color: theme.colors.primary, fontWeight: 'bold' }
                ]}>
                  {day.getDate()}
                </Text>
                
                {items.length > 0 && (
                  <View style={styles.dayItemsContainer}>
                    {items.slice(0, 2).map((item, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.monthDayItem,
                          { backgroundColor: `${getCategoryColor(item.category)}30` }
                        ]}
                      >
                        <Text style={[
                          styles.monthDayItemText,
                          { color: getCategoryColor(item.category) }
                        ]} numberOfLines={1}>
                          {getCategoryEmoji(item.category)} {item.title}
                        </Text>
                      </View>
                    ))}
                    {items.length > 2 && (
                      <Text style={[styles.moreItemsText, { color: theme.colors.textSecondary }]}>
                        +{items.length - 2} more
                      </Text>
                    )}
                    {totalAmount > 0 && (
                      <Text style={[styles.dayTotalText, { color: theme.colors.text }]}>
                        ${totalAmount.toFixed(2)}
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Week View Component - Redesigned
  const renderWeekView = () => {
    const days = getWeekDays();
    const today = new Date();

    return (
      <View style={styles.weekContainer}>
        {/* Week Header with Day Names and Numbers */}
        <View style={styles.weekHeaderRow}>
          {days.map((day, index) => {
            const isToday = day.toDateString() === today.toDateString();
            return (
              <TouchableOpacity
                key={index}
                style={styles.weekHeaderDay}
                onPress={() => setSelectedDate(day)}
              >
                <Text style={[
                  styles.weekHeaderDayName, 
                  { color: theme.colors.textSecondary }
                ]}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={[
                  styles.weekHeaderDayNumber,
                  { 
                    color: isToday ? theme.colors.primary : theme.colors.text,
                    backgroundColor: isToday ? `${theme.colors.primary}20` : 'transparent',
                    paddingHorizontal: isToday ? 8 : 0,
                    paddingVertical: isToday ? 4 : 0,
                    borderRadius: isToday ? 8 : 0,
                  }
                ]}>
                  {day.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Week Content with Items in Columns */}
        <ScrollView style={styles.weekContent} showsVerticalScrollIndicator={false}>
          <View style={styles.weekTimeSlots}>
            {days.map((day, index) => {
              const items = getItemsForDate(day);
              
              return (
                <View key={index} style={styles.weekDayColumn}>
                  {items.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.weekDayItem,
                        { borderLeftColor: getCategoryColor(item.category) }
                      ]}
                      onPress={() => {
                        if (item.itemType === 'expense') {
                          onExpensePress?.(item as Expense);
                        } else if (item.itemType === 'reminder') {
                          onReminderPress?.(item as Reminder);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.weekItemContent}>
                        <Text 
                          style={[styles.weekItemTitle, { color: theme.colors.text }]} 
                          numberOfLines={2}
                        >
                          {getCategoryEmoji(item.category)} {item.title}
                        </Text>
                        <Text style={[styles.weekItemAmount, { color: getCategoryColor(item.category) }]}>
                          ${item.amount.toFixed(2)}
                        </Text>
                        <Text style={[styles.weekItemCategory, { color: theme.colors.textSecondary }]}>
                          {item.category}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  
                  {/* Empty state for days with no items */}
                  {items.length === 0 && (
                    <TouchableOpacity
                      style={[styles.weekDayItem, { 
                        backgroundColor: theme.colors.background,
                        borderLeftColor: 'transparent',
                        borderStyle: 'dashed',
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: 60,
                      }]}
                      onPress={() => setSelectedDate(day)}
                    >
                      <Icon name="add-circle-outline" size={16} color={theme.colors.textSecondary} />
                      <Text style={[styles.weekItemCategory, { color: theme.colors.textSecondary, marginTop: 4 }]}>
                        Add item
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Year View Component - Fixed overflow
  const renderYearView = () => {
    const months = getYearMonths();
    
    return (
      <View style={styles.yearContainer}>
        <FlatList
          data={months}
          numColumns={3}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item: month }) => {
            const monthItems: any[] = [];
            const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
            
            for (let day = 1; day <= daysInMonth; day++) {
              const date = new Date(month.getFullYear(), month.getMonth(), day);
              monthItems.push(...getItemsForDate(date));
            }
            
            const monthTotal = monthItems.reduce((sum, item) => sum + item.amount, 0);
            const expenseCount = monthItems.filter(item => item.itemType === 'expense').length;
            const reminderCount = monthItems.filter(item => item.itemType === 'reminder').length;
            const incomeCount = monthItems.filter(item => item.itemType === 'income').length;
            
            // Format large amounts
            const formatAmount = (amount: number) => {
              if (amount >= 10000) {
                return `${(amount / 1000).toFixed(1)}k`;
              } else if (amount >= 1000) {
                return `${(amount / 1000).toFixed(2)}k`;
              }
              return `${amount.toFixed(0)}`;
            };
            
            return (
              <TouchableOpacity
                style={[styles.yearMonth, { backgroundColor: theme.colors.surface }]}
                onPress={() => {
                  setCurrentDate(month);
                  setViewMode('month');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.yearMonthTitle, { color: theme.colors.text }]}>
                  {month.toLocaleDateString('en-US', { month: 'short' })}
                </Text>
                
                <View style={styles.yearMonthStats}>
                  <View style={styles.yearStatRow}>
                    <Text style={[styles.yearStatLabel, { color: theme.colors.textSecondary }]}>
                      Total:
                    </Text>
                    <Text 
                      style={[styles.yearStatValue, { color: theme.colors.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {formatAmount(monthTotal)}
                    </Text>
                  </View>
                  
                  <View style={styles.yearBottomStats}>
                    <View style={styles.yearStatItem}>
                      <Icon name="remove-circle" size={10} color={theme.colors.error} />
                      <Text style={[styles.yearStatCount, { color: theme.colors.textSecondary }]}>
                        {expenseCount}
                      </Text>
                    </View>
                    
                    <View style={styles.yearStatItem}>
                      <Icon name="add-circle" size={10} color={theme.colors.success} />
                      <Text style={[styles.yearStatCount, { color: theme.colors.textSecondary }]}>
                        {incomeCount}
                      </Text>
                    </View>
                    
                    <View style={styles.yearStatItem}>
                      <Icon name="notifications" size={10} color={theme.colors.warning}  />
                      <Text style={[styles.yearStatCount, { color: theme.colors.textSecondary }]}>
                        {reminderCount}
                      </Text>
                    </View>
                  </View>
                  
                  {monthItems.length > 0 && (
                    <View style={{
                      marginTop: 8,
                      paddingTop: 6,
                      borderTopWidth: 1,
                      borderTopColor: theme.colors.border,
                    }}>
                      <Text style={[
                        styles.yearStatCount, 
                        { 
                          color: theme.colors.textSecondary, 
                          textAlign: 'center',
                          fontSize: 9,
                        }
                      ]}>
                        {monthItems.length} items
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.yearGrid}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  // Selected Date Detail Modal
  const renderSelectedDateModal = () => {
    if (!selectedDate) return null;
    
    const selectedDateItems = getItemsForDate(selectedDate);
    
    return (
      <Modal
        visible={!!selectedDate}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedDate(null)}
      >
        <View style={styles.selectedDateModalOverlay}>
          <View style={[styles.selectedDateModal, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.selectedDateHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.selectedDateTitle, { color: theme.colors.text }]}>
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedDate(null)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color={theme.colors.textSecondary}  />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.selectedDateContent} showsVerticalScrollIndicator={false}>
              {selectedDateItems.length === 0 ? (
                <View style={styles.emptyDateContainer}>
                  <Icon name="calendar" size={48} color={theme.colors.textSecondary}  />
                  <Text style={[styles.emptyDateText, { color: theme.colors.text }]}>
                    No items for this date
                  </Text>
                  <View style={styles.emptyDateActions}>
                    <TouchableOpacity
                      style={[styles.addButton, { backgroundColor: theme.colors.error }]}
                      onPress={() => {
                        setSelectedDate(null);
                        onAddExpense?.();
                      }}
                    >
                      <Text style={styles.addButtonText}>Add Expense</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.addButton, { backgroundColor: theme.colors.warning }]}
                      onPress={() => {
                        setSelectedDate(null);
                        onAddReminder?.();
                      }}
                    >
                      <Text style={styles.addButtonText}>Add Reminder</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.selectedDateItems}>
                  {selectedDateItems.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.selectedDateItem,
                        { 
                          backgroundColor: theme.colors.background,
                          borderLeftColor: getCategoryColor(item.category)
                        }
                      ]}
                      onPress={() => {
                        setSelectedDate(null);
                        if (item.itemType === 'expense') {
                          onExpensePress?.(item as Expense);
                        } else if (item.itemType === 'reminder') {
                          onReminderPress?.(item as Reminder);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.selectedItemContent}>
                        <View style={styles.selectedItemHeader}>
                          <Text style={styles.selectedItemEmoji}>
                            {getCategoryEmoji(item.category)}
                          </Text>
                          <View style={styles.selectedItemInfo}>
                            <Text style={[styles.selectedItemTitle, { color: theme.colors.text }]}>
                              {item.title}
                            </Text>
                            <Text style={[styles.selectedItemCategory, { color: theme.colors.textSecondary }]}>
                              {item.category}
                            </Text>
                          </View>
                          <View style={styles.selectedItemRight}>
                            <Text style={[styles.selectedItemAmount, { color: theme.colors.text }]}>
                              ${item.amount.toFixed(2)}
                            </Text>
                            <Text style={[styles.selectedItemType, { color: theme.colors.textSecondary }]}>
                              {item.itemType}
                            </Text>
                          </View>
                        </View>
                        
                        {item.status && (
                          <View style={[
                            styles.statusBadge,
                            { 
                              backgroundColor: item.status === 'pending' 
                                ? `${theme.colors.warning}20` 
                                : `${theme.colors.success}20` 
                            }
                          ]}>
                            <Text style={[
                              styles.statusBadgeText,
                              { 
                                color: item.status === 'pending' 
                                  ? theme.colors.warning 
                                  : theme.colors.success 
                              }
                            ]}>
                              {item.status}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                  
                  <View style={[styles.dayTotalContainer, { borderTopColor: theme.colors.border }]}>
                    <Text style={[styles.dayTotalLabel, { color: theme.colors.textSecondary }]}>
                      Total for this day:
                    </Text>
                    <Text style={[styles.dayTotalAmount, { color: theme.colors.text }]}>
                      ${selectedDateItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { 
          backgroundColor: theme.colors.surface, 
          borderBottomColor: theme.colors.border 
        }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={styles.closeHeaderButton}>
              <Icon name="close" size={24} color={theme.colors.text}  />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                Calendar View
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                Financial Timeline
              </Text>
            </View>
            
            <TouchableOpacity
              onPress={() => setShowFilters(!showFilters)}
              style={styles.filterButton}
            >
              <Icon name="filter" size={24} color={theme.colors.text}  />
            </TouchableOpacity>
          </View>
          
          {/* Filters */}
          {showFilters && (
            <View style={[styles.filtersContainer, { backgroundColor: theme.colors.background }]}>
              <View style={styles.filtersRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    { backgroundColor: filters.showExpenses ? theme.colors.error : theme.colors.surface }
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, showExpenses: !prev.showExpenses }))}
                >
                  <Icon 
                    name="remove-circle" 
                    size={16} 
                    color={filters.showExpenses ? 'white' : theme.colors.error} 
                  />
                  <Text style={[
                    styles.filterChipText,
                    { color: filters.showExpenses ? 'white' : theme.colors.error }
                  ]}>
                    Expenses
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    { backgroundColor: filters.showIncome ? theme.colors.success : theme.colors.surface }
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, showIncome: !prev.showIncome }))}
                >
                  <Icon 
                    name="add-circle" 
                    size={16} 
                    color={filters.showIncome ? 'white' : theme.colors.success} 
                  />
                  <Text style={[
                    styles.filterChipText,
                    { color: filters.showIncome ? 'white' : theme.colors.success }
                  ]}>
                    Income
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    { backgroundColor: filters.showReminders ? theme.colors.warning : theme.colors.surface }
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, showReminders: !prev.showReminders }))}
                >
                  <Icon name="notifications" 
                    size={16} 
                    color={filters.showReminders ? 'white' : theme.colors.warning} 
                   />
                  <Text style={[
                    styles.filterChipText,
                    { color: filters.showReminders ? 'white' : theme.colors.warning }
                  ]}>
                    Reminders
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Navigation */}
        <View style={[styles.navigation, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.navigationRow}>
            <TouchableOpacity
              onPress={() => navigate(-1)}
              style={[styles.navButton, { backgroundColor: theme.colors.background }]}
            >
              <Icon name="back" size={20} color={theme.colors.text}  />
            </TouchableOpacity>
            
            <Text style={[styles.navigationTitle, { color: theme.colors.text }]}>
              {getCalendarTitle()}
            </Text>
            
            <TouchableOpacity
              onPress={() => navigate(1)}
              style={[styles.navButton, { backgroundColor: theme.colors.background }]}
            >
              <Icon name="forward" size={20} color={theme.colors.text}  />
            </TouchableOpacity>
          </View>
          
          <View style={[styles.viewModeSelector, { backgroundColor: theme.colors.background }]}>
            {(['month', 'week', 'year'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setViewMode(mode)}
                style={[
                  styles.viewModeButton,
                  viewMode === mode && { backgroundColor: theme.colors.primary }
                ]}
              >
                <Text style={[
                  styles.viewModeText,
                  { color: viewMode === mode ? 'white' : theme.colors.textSecondary }
                ]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Calendar Content */}
        <View style={styles.calendarContent}>
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'year' && renderYearView()}
        </View>

        {/* Selected Date Modal */}
        {renderSelectedDateModal()}
        
        {/* Summary Stats */}
        <View style={[styles.summaryStats, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.summaryRow}>
            <View style={styles.statItem}>
              <Icon name="remove-circle" size={16} color={theme.colors.error} />
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                ${expenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Expenses
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Icon name="add-circle" size={16} color={theme.colors.success} />
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                ${income.reduce((sum, inc) => sum + inc.amount, 0).toFixed(2)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Income
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Icon name="notifications" size={16} color={theme.colors.warning}  />
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {reminders.filter(r => r.status === 'pending').length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Pending
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header Styles
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeHeaderButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  filterButton: {
    padding: 4,
  },
  
  // Filters Styles
  filtersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Navigation Styles
  navigation: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  viewModeSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewModeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Calendar Content
  calendarContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  
  // Month View Styles
  monthContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  dayHeadersRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  dayHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  monthDay: {
    width: (screenWidth - 48) / 7, // Better spacing calculation
    minHeight: 100,
    marginBottom: 8,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  dayItemsContainer: {
    flex: 1,
  },
  monthDayItem: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 3,
  },
  monthDayItemText: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  moreItemsText: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 3,
    fontStyle: 'italic',
  },
  dayTotalText: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 4,
  },
  
  // Week View Styles - Completely redesigned
  weekContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  weekRow: {
    flexDirection: 'column',
    flex: 1,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#F3F4F6',
    marginBottom: 16,
  },
  weekHeaderDay: {
    flex: 1,
    alignItems: 'center',
  },
  weekHeaderDayName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  weekHeaderDayNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  weekContent: {
    flex: 1,
  },
  weekTimeSlots: {
    flexDirection: 'row',
    flex: 1,
  },
  weekDayColumn: {
    flex: 1,
    paddingHorizontal: 2,
  },
  weekDayItem: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  weekItemContent: {
    flex: 1,
  },
  weekItemTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 14,
  },
  weekItemAmount: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  weekItemCategory: {
    fontSize: 9,
    opacity: 0.7,
  },
  
  // Year View Styles - Fixed layout
  yearContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  yearGrid: {
    paddingVertical: 8,
  },
  yearMonth: {
    width: (screenWidth - 56) / 3, // Fixed width calculation
    height: 140, // Fixed height to prevent overflow
    margin: 4,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  yearMonthTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  yearMonthStats: {
    flex: 1,
    justifyContent: 'space-between',
  },
  yearStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  yearStatLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  yearStatValue: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'right',
    flex: 1,
    marginLeft: 4,
  },
  yearStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  yearStatCount: {
    fontSize: 10,
    fontWeight: '500',
  },
  yearBottomStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  
  // Selected Date Modal Styles
  selectedDateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  selectedDateModal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  selectedDateHeader: {
    padding: 20,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedDateTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  selectedDateContent: {
    maxHeight: 400,
  },
  
  // Empty Date Styles
  emptyDateContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyDateText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 20,
  },
  emptyDateActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Selected Date Items Styles
  selectedDateItems: {
    padding: 16,
  },
  selectedDateItem: {
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  selectedItemContent: {
    padding: 16,
  },
  selectedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedItemEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  selectedItemInfo: {
    flex: 1,
  },
  selectedItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedItemCategory: {
    fontSize: 14,
  },
  selectedItemRight: {
    alignItems: 'flex-end',
  },
  selectedItemAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  selectedItemType: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  dayTotalContainer: {
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayTotalLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  dayTotalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Summary Stats Styles
  summaryStats: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default SmartMoneyCalendarModal;