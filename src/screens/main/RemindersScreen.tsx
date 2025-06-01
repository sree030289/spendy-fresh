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

interface TabInfo {
  key: ReminderStatus | 'all';
  title: string;
  count: number;
  color: string;
}

export default function RemindersScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<Reminder[]>([]);
  const [activeTab, setActiveTab] = useState<ReminderStatus | 'all'>('upcoming');
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
      const connected = await RemindersService.isEmailConnected(user?.id || '');
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
      Alert.alert(
        'Connect Email',
        'This will allow us to automatically detect bills and payment confirmations from your email.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect Gmail',
            onPress: async () => {
              setIsSyncing(true);
              await RemindersService.connectEmail(user?.id || '', 'gmail');
              setEmailConnected(true);
              setIsSyncing(false);
              Alert.alert('Success', 'Gmail connected successfully!');
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
      const newReminders = await RemindersService.syncEmailBills(user?.id || '');
      if (newReminders.length > 0) {
        Alert.alert('Sync Complete', `Found ${newReminders.length} new bills!`);
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

  const stats = getStats();
  const tabs = getTabs();

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
          {emailConnected ? 'Email Connected' : 'Connect Email'}
        </Text>
        <Text style={styles.emailBannerSubtitle}>
          {emailConnected 
            ? 'Auto-sync enabled • bills@example.com'
            : 'Auto-detect recurring bills & payments'
          }
        </Text>
      </View>
      <Button
        title={emailConnected ? (isSyncing ? 'Syncing...' : 'Sync') : 'Connect'}
        onPress={emailConnected ? handleSyncEmail : handleConnectEmail}
        loading={isSyncing}
        variant="outline"
        style={styles.emailBannerButton}
        textStyle={{ color: 'white', fontSize: 14 }}
      />
    </View>
  );

  const renderStatsCards = () => (
    <View style={styles.statsContainer}>
      <TouchableOpacity
        style={[styles.statCard, { backgroundColor: theme.colors.surface }]}
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
        style={[styles.statCard, { backgroundColor: theme.colors.surface }]}
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
        style={[styles.statCard, { backgroundColor: theme.colors.surface }]}
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
  );

  const renderTabs = () => (
    <View style={[styles.tabsContainer, { backgroundColor: theme.colors.surface }]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && styles.activeTab,
            { borderBottomColor: activeTab === tab.key ? tab.color : 'transparent' }
          ]}
          onPress={() => setActiveTab(tab.key)}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === tab.key ? tab.color : theme.colors.textSecondary }
          ]}>
            {tab.title}
          </Text>
          {tab.count > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: tab.color }]}>
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
              <Text style={[styles.reminderCategory, { color: theme.colors.textSecondary }]}>
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

          {reminder.status !== 'paid' && (
            <View style={styles.reminderActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => handleMarkAsPaid(reminder)}
              >
                <Text style={styles.actionButtonText}>Mark Paid</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, { borderColor: theme.colors.border }]}
                onPress={() => handleEditReminder(reminder)}
              >
                <Ionicons name="create-outline" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, { borderColor: theme.colors.border }]}
                onPress={() => handleDeleteReminder(reminder)}
              >
                <Ionicons name="trash-outline" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
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
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Reminders
        </Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Email Connection Banner */}
        {renderEmailBanner()}

        {/* Stats Cards */}
        {renderStatsCards()}

        {/* Search */}
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

        {/* Tabs */}
        {renderTabs()}

        {/* Reminders List */}
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
      </ScrollView>

      {/* Add Reminder Modal */}
      <AddReminderModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onReminderAdded={loadReminders}
      />

      {/* Edit Reminder Modal */}
      <EditReminderModal
        visible={showEditModal}
        reminder={selectedReminder}
        onClose={() => {
          setShowEditModal(false);
          setSelectedReminder(null);
        }}
        onReminderUpdated={loadReminders}
      />

      {/* Reminder Details Modal */}
      <ReminderDetailsModal
        visible={showDetailsModal}
        reminder={selectedReminder}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedReminder(null);
        }}
        onReminderUpdated={loadReminders}
      />

      {/* Stats Modal */}
      <ReminderStatsModal
        visible={showStatsModal}
        onClose={() => setShowStatsModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  emailBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
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
  emailBannerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 12,
  },
  searchContainer: {
    position: 'relative',
    marginHorizontal: 24,
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
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabBadge: {
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
  remindersContainer: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  reminderCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    marginBottom: 2,
  },
  reminderCategory: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  reminderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
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
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
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
});