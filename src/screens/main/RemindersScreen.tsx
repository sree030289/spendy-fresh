import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { RemindersService } from '@/services/reminders/RemindersService';
import { Reminder, ReminderCategory, ReminderStatus } from '@/types/reminder';
import { formatCurrency } from '@/utils/currency';
import AddReminderModal from '@/components/reminders/AddReminderModal';
import ReminderDetailsModal from '@/components/reminders/ReminderDetailsModal';
import EditReminderModal from '@/components/reminders/EditReminderModal';
import ReminderStatsModal from '@/components/reminders/ReminderStatsModal';
import { RealGmailService } from '@/services/gmail/RealGmailService';

interface TabInfo {
  key: ReminderStatus | 'all';
  title: string;
  count: number;
  color: string;
}

type ViewMode = 'list' | 'calendar';

export default function RemindersScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<Reminder[]>([]);
  const [activeTab, setActiveTab] = useState<ReminderStatus | 'all'>('upcoming');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [emailConnected, setEmailConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadReminders();
    checkEmailConnection();
  }, []);

  useEffect(() => {
    filterReminders();
  }, [reminders, activeTab, searchQuery]);

  const loadReminders = async () => {
    try {
      setLoading(true);
      const data = await RemindersService.getReminders(user?.id || '');
      setReminders(data);
    } catch (error) {
      console.error('Error loading reminders:', error);
      Alert.alert('Error', 'Failed to load reminders');
    } finally {
      setLoading(false);
    }
  };

  const checkEmailConnection = async () => {
    try {
      const connected = await RealGmailService.isGmailConnected(user?.id || '');
      setEmailConnected(connected);
    } catch (error) {
      console.error('Error checking email connection:', error);
    }
  };

  const filterReminders = () => {
    let filtered = reminders;

    if (activeTab !== 'all') {
      filtered = filtered.filter(reminder => reminder.status === activeTab);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(reminder =>
        reminder.title.toLowerCase().includes(query) ||
        reminder.category.toLowerCase().includes(query) ||
        reminder.description?.toLowerCase().includes(query)
      );
    }

    setFilteredReminders(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReminders();
    setRefreshing(false);
  };

  const handleConnectEmail = async () => {
    try {
      setIsSyncing(true);
      
      Alert.alert(
        'Connect Gmail',
        'You will be redirected to Google to sign in and authorize Spendy to read your emails for bill detection.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect Gmail',
            onPress: async () => {
              try {
                const success = await RealGmailService.connectGmail(user?.id || '');
                if (success) {
                  setEmailConnected(true);
                  Alert.alert('Success', 'Gmail connected successfully!');
                }
              } catch (error) {
                Alert.alert('Error', error.message);
              } finally {
                setIsSyncing(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      setIsSyncing(false);
      Alert.alert('Error', 'Failed to connect email');
    }
  };

  const handleSyncEmail = async () => {
    try {
      setIsSyncing(true);
      const bills = await RealGmailService.syncBillsFromGmail(user?.id || '');
      if (bills.length > 0) {
        Alert.alert('Sync Complete', `Found ${bills.length} new bills!`);
        await loadReminders();
      } else {
        Alert.alert('Sync Complete', 'No new bills found');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to sync email');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMarkAsPaid = async (reminder: Reminder) => {
    try {
      await RemindersService.markAsPaid(reminder.id);
      await loadReminders();
      Alert.alert('Success', 'Reminder marked as paid!');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark as paid');
    }
  };

  const handleEditReminder = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setShowEditModal(true);
  };

  const handleDeleteReminder = async (reminder: Reminder) => {
    Alert.alert(
      'Delete Reminder',
      `Are you sure you want to delete "${reminder.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await RemindersService.deleteReminder(reminder.id);
              await loadReminders();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete reminder');
            }
          }
        }
      ]
    );
  };

  // Handle tab change with automatic view mode switching
  const handleTabChange = (tab: ReminderStatus | 'all') => {
    setActiveTab(tab);
    
    // Auto-switch to list mode for overdue and paid tabs
    if (tab === 'overdue' || tab === 'paid') {
      setViewMode('list');
    }
  };

  const getTabs = (): TabInfo[] => {
    const upcomingCount = reminders.filter(r => r.status === 'upcoming').length;
    const overdueCount = reminders.filter(r => r.status === 'overdue').length;
    const paidCount = reminders.filter(r => r.status === 'paid').length;

    return [
      { key: 'upcoming', title: 'Upcoming', count: upcomingCount, color: theme.colors.primary },
      { key: 'overdue', title: 'Overdue', count: overdueCount, color: theme.colors.error },
      { key: 'paid', title: 'Paid', count: paidCount, color: theme.colors.success },
    ];
  };

  const getStats = () => {
    const upcoming = reminders.filter(r => r.status === 'upcoming');
    const overdue = reminders.filter(r => r.status === 'overdue');
    
    const totalUpcoming = upcoming.reduce((sum, r) => sum + r.amount, 0);
    const totalOverdue = overdue.reduce((sum, r) => sum + r.amount, 0);
    const totalDue = totalUpcoming + totalOverdue;

    return {
      upcomingCount: upcoming.length,
      overdueCount: overdue.length,
      totalDue: formatCurrency(totalDue, user?.currency || 'USD')
    };
  };

  const getCategoryIcon = (category: ReminderCategory): string => {
    const icons = {
      utilities: 'flash-outline',
      entertainment: 'play-outline',
      finance: 'card-outline',
      insurance: 'shield-outline',
      subscription: 'repeat-outline',
      rent: 'home-outline',
      food: 'restaurant-outline',
      transport: 'car-outline',
      health: 'medical-outline',
      education: 'school-outline',
      shopping: 'bag-outline',
      other: 'ellipse-outline'
    };
    return icons[category] || icons.other;
  };

  const getCategoryColor = (category: ReminderCategory): string => {
    const colors = {
      utilities: '#F59E0B',
      entertainment: '#8B5CF6',
      finance: '#EF4444',
      insurance: '#10B981',
      subscription: '#3B82F6',
      rent: '#F97316',
      food: '#EC4899',
      transport: '#06B6D4',
      health: '#84CC16',
      education: '#6366F1',
      shopping: '#F472B6',
      other: '#6B7280'
    };
    return colors[category] || colors.other;
  };

  const getReminderStatusStyle = (reminder: Reminder) => {
    if (reminder.status === 'overdue') {
      return {
        borderLeftColor: theme.colors.error,
        backgroundColor: `${theme.colors.error}10`
      };
    } else if (reminder.status === 'paid') {
      return {
        borderLeftColor: theme.colors.success,
        backgroundColor: `${theme.colors.success}10`,
        opacity: 0.7
      };
    } else {
      return {
        borderLeftColor: theme.colors.primary,
        backgroundColor: theme.colors.surface
      };
    }
  };

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    while (current <= lastDay || days.length < 42) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days.slice(0, 42);
  };

  const getRemindersForDate = (date: Date) => {
    return reminders.filter(reminder => {
      const reminderDate = new Date(reminder.dueDate);
      return reminderDate.toDateString() === date.toDateString();
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const stats = getStats();
  const tabs = getTabs();

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
      <View style={styles.headerTop}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Reminders
        </Text>
        <TouchableOpacity
          style={[styles.syncButton, { backgroundColor: isSyncing ? theme.colors.textSecondary : theme.colors.primary }]}
          onPress={emailConnected ? handleSyncEmail : handleConnectEmail}
          disabled={isSyncing}
        >
          <Ionicons name="mail-outline" size={16} color={isSyncing ? theme.colors.text : 'white'} />
          <Text style={[styles.syncButtonText, { color: isSyncing ? theme.colors.text : 'white' }]}>
            {isSyncing ? 'Syncing...' : emailConnected ? 'Sync' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: theme.colors.background }]}
          onPress={() => setShowStatsModal(true)}
        >
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>
            {stats.upcomingCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Upcoming
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: theme.colors.background }]}
          onPress={() => setShowStatsModal(true)}
        >
          <Text style={[styles.statValue, { color: theme.colors.error }]}>
            {stats.overdueCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Overdue
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: theme.colors.background }]}
          onPress={() => setShowStatsModal(true)}
        >
          <Text style={[styles.statValue, { color: theme.colors.success }]} numberOfLines={1}>
            {stats.totalDue}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Total Due
          </Text>
        </TouchableOpacity>
      </View>

      {/* View Toggle */}
      <View style={[styles.viewToggle, { backgroundColor: theme.colors.background }]}>
        <TouchableOpacity
          style={[
            styles.viewButton,
            viewMode === 'list' && [styles.activeViewButton, { backgroundColor: theme.colors.primary }]
          ]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons 
            name="list-outline" 
            size={16} 
            color={viewMode === 'list' ? 'white' : theme.colors.textSecondary} 
          />
          <Text style={[
            styles.viewButtonText,
            { color: viewMode === 'list' ? 'white' : theme.colors.textSecondary }
          ]}>
            List
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.viewButton,
            viewMode === 'calendar' && [styles.activeViewButton, { backgroundColor: theme.colors.primary }]
          ]}
          onPress={() => setViewMode('calendar')}
        >
          <Ionicons 
            name="calendar-outline" 
            size={16} 
            color={viewMode === 'calendar' ? 'white' : theme.colors.textSecondary} 
          />
          <Text style={[
            styles.viewButtonText,
            { color: viewMode === 'calendar' ? 'white' : theme.colors.textSecondary }
          ]}>
            Calendar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmailBanner = () => (
    <View style={[
      styles.emailBanner,
      {
        backgroundColor: emailConnected ? theme.colors.success : theme.colors.primary
      }
    ]}>
      <Ionicons 
        name={emailConnected ? "checkmark-circle" : "mail-outline"} 
        size={24} 
        color="white" 
      />
      <View style={styles.emailBannerText}>
        <Text style={styles.emailBannerTitle}>
          {emailConnected ? 'Gmail Connected' : 'Connect Gmail'}
        </Text>
        <Text style={styles.emailBannerSubtitle}>
          {emailConnected 
            ? 'Auto-sync enabled • john@gmail.com'
            : 'Auto-detect recurring bills & payments'
          }
        </Text>
      </View>
      <TouchableOpacity
        style={styles.connectBtn}
        onPress={() => setEmailConnected(!emailConnected)}
      >
        <Text style={styles.connectBtnText}>
          {emailConnected ? 'Disconnect' : 'Connect'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderTabs = () => (
    <View style={[styles.tabsContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && [styles.activeTab, { borderBottomColor: tab.color }]
          ]}
          onPress={() => handleTabChange(tab.key)}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === tab.key ? tab.color : theme.colors.textSecondary }
          ]}>
            {tab.title}
          </Text>
          {tab.count > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: theme.colors.error }]}>
              <Text style={styles.tabBadgeText}>{tab.count}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderReminderCard = (reminder: Reminder) => {
    const categoryColor = getCategoryColor(reminder.category);
    const categoryIcon = getCategoryIcon(reminder.category);
    const statusStyle = getReminderStatusStyle(reminder);
    
    const daysUntilDue = Math.ceil(
      (new Date(reminder.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    return (
      <TouchableOpacity
        key={reminder.id}
        style={[styles.reminderCard, statusStyle, { borderColor: theme.colors.border }]}
        onPress={() => {
          setSelectedReminder(reminder);
          setShowDetailsModal(true);
        }}
      >
        <View style={styles.reminderHeader}>
          <View style={styles.reminderTitleSection}>
            <View style={[styles.categoryIcon, { backgroundColor: categoryColor }]}>
              <Ionicons name={categoryIcon as any} size={16} color="white" />
            </View>
            <View style={styles.reminderTitleText}>
              <Text style={[styles.reminderTitle, { color: theme.colors.text }]}>
                {reminder.title}
              </Text>
              <Text style={[styles.reminderCategory, { color: theme.colors.textSecondary, backgroundColor: theme.colors.background }]}>
                {reminder.category}
              </Text>
            </View>
          </View>
          <Text style={[styles.reminderAmount, { color: theme.colors.primary }]}>
            {formatCurrency(reminder.amount, user?.currency || 'USD')}
          </Text>
        </View>

        <View style={styles.reminderDetails}>
          <View style={styles.reminderInfo}>
            <Text style={[
              styles.reminderDate,
              {
                color: reminder.status === 'overdue' 
                  ? theme.colors.error 
                  : theme.colors.textSecondary
              }
            ]}>
              {reminder.status === 'overdue' 
                ? `Overdue: ${new Date(reminder.dueDate).toLocaleDateString()}`
                : reminder.status === 'paid'
                ? `Paid: ${reminder.paidDate ? new Date(reminder.paidDate).toLocaleDateString() : 'Recently'}`
                : `Due: ${new Date(reminder.dueDate).toLocaleDateString()}`
              }
            </Text>
            {reminder.status === 'upcoming' && daysUntilDue <= 3 && (
              <Text style={[styles.urgentLabel, { color: theme.colors.error }]}>
                {daysUntilDue === 0 ? 'Due Today!' : `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`}
              </Text>
            )}
          </View>

          <View style={styles.reminderActions}>
            {reminder.status !== 'paid' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => handleMarkAsPaid(reminder)}
              >
                <Text style={styles.actionButtonText}>Mark Paid</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              onPress={() => handleEditReminder(reminder)}
            >
              <Ionicons name="create-outline" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              onPress={() => handleDeleteReminder(reminder)}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCalendarView = () => {
    const calendarDays = getCalendarDays();
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
      <View style={styles.calendarContainer}>
        {/* Calendar Header */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            style={styles.calendarNav}
            onPress={() => {
              const newMonth = new Date(currentMonth);
              newMonth.setMonth(newMonth.getMonth() - 1);
              setCurrentMonth(newMonth);
            }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          
          <Text style={[styles.calendarMonth, { color: theme.colors.text }]}>
            {monthName}
          </Text>
          
          <TouchableOpacity
            style={styles.calendarNav}
            onPress={() => {
              const newMonth = new Date(currentMonth);
              newMonth.setMonth(newMonth.getMonth() + 1);
              setCurrentMonth(newMonth);
            }}
          >
            <Ionicons name="chevron-forward" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Days of Week */}
        <View style={styles.calendarGrid}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <View key={`day-header-${index}`} style={styles.calendarDayHeader}>
              <Text style={[styles.calendarDayHeaderText, { color: theme.colors.textSecondary }]}>
                {day.charAt(0)}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar Days */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((date, index) => {
            const dayReminders = getRemindersForDate(date);
            const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
            const isTodayDate = isToday(date);

            return (
              <TouchableOpacity
                key={`calendar-day-${index}-${date.getTime()}`}
                style={[
                  styles.calendarDay,
                  isTodayDate && [styles.calendarDayToday, { backgroundColor: theme.colors.primary }],
                  !isCurrentMonth && styles.calendarDayOtherMonth
                ]}
                onPress={() => {
                  if (dayReminders.length > 0) {
                    Alert.alert(
                      `Reminders for ${date.toLocaleDateString()}`,
                      dayReminders.map(r => `• ${r.title} - ${formatCurrency(r.amount, user?.currency || 'USD')}`).join('\n')
                    );
                  }
                }}
              >
                <Text style={[
                  styles.calendarDayText,
                  { color: isTodayDate ? 'white' : isCurrentMonth ? theme.colors.text : theme.colors.textSecondary }
                ]}>
                  {date.getDate()}
                </Text>
                {dayReminders.length > 0 && (
                  <View style={[styles.calendarDayIndicator, { backgroundColor: theme.colors.error }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Today's Reminders */}
        <View style={[styles.todayReminders, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.todayRemindersTitle, { color: theme.colors.text }]}>
            Today's Reminders
          </Text>
          {getRemindersForDate(new Date()).length === 0 ? (
            <Text style={[styles.noRemindersText, { color: theme.colors.textSecondary }]}>
              No reminders for today 🎉
            </Text>
          ) : (
            getRemindersForDate(new Date()).map(renderReminderCard)
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="alarm-outline" size={64} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        {activeTab === 'all' ? 'No reminders yet' : `No ${activeTab} reminders`}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
        {activeTab === 'paid' 
          ? 'Completed payments will appear here'
          : 'Add your first bill reminder to get started'
        }
      </Text>
      {activeTab !== 'paid' && (
        <Button
          title="Add Reminder"
          onPress={() => setShowAddModal(true)}
          style={styles.emptyButton}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      {renderHeader()}

      {/* Tabs */}
      {renderTabs()}

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Email Connection Banner */}
        {renderEmailBanner()}

        {/* Search - Only show in list view */}
        {viewMode === 'list' && (
          <View style={styles.searchContainer}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                }
              ]}
              placeholder="Search reminders..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Ionicons 
              name="search-outline" 
              size={20} 
              color={theme.colors.textSecondary} 
              style={styles.searchIcon}
            />
          </View>
        )}

        {/* Content based on view mode */}
        {viewMode === 'calendar' ? (
          renderCalendarView()
        ) : (
          <View style={styles.remindersContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                  Loading reminders...
                </Text>
              </View>
            ) : filteredReminders.length === 0 ? (
              renderEmptyState()
            ) : (
              filteredReminders.map(renderReminderCard)
            )}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Modals */}
      <AddReminderModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onReminderAdded={loadReminders}
      />

      <ReminderDetailsModal
        visible={showDetailsModal}
        reminder={selectedReminder}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedReminder(null);
        }}
        onReminderUpdated={loadReminders}
      />

      <EditReminderModal
        visible={showEditModal}
        reminder={selectedReminder}
        onClose={() => {
          setShowEditModal(false);
          setSelectedReminder(null);
        }}
        onReminderUpdated={() => {
          loadReminders();
          setShowEditModal(false);
          setSelectedReminder(null);
        }}
      />

      <ReminderStatsModal
        visible={showStatsModal}
        onClose={() => setShowStatsModal(false)}
      />
    </SafeAreaView>
  );
}

// ...existing styles...
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  activeViewButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  emailBanner: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emailBannerText: {
    flex: 1,
  },
  emailBannerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emailBannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  connectBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  connectBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  searchContainer: {
    position: 'relative',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  searchInput: {
    paddingHorizontal: 48,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 14,
  },
  remindersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 100,
  },
  reminderCard: {
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reminderTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderTitleText: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reminderCategory: {
    fontSize: 12,
    textTransform: 'capitalize',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  reminderAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  reminderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderInfo: {
    flex: 1,
  },
  reminderDate: {
    fontSize: 14,
    marginBottom: 2,
  },
  urgentLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  reminderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  calendarContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarNav: {
    padding: 8,
    borderRadius: 8,
  },
  calendarMonth: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayHeader: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayHeaderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
    position: 'relative',
  },
  calendarDayToday: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarDayOtherMonth: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  calendarDayIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  todayReminders: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
  },
  todayRemindersTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  noRemindersText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 32,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 8,
  },
});