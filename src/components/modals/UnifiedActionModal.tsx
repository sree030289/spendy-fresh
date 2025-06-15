// src/components/modals/UnifiedActionModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

// Import modals
import AddExpenseModal from '@/components/modals/AddExpenseModal';
import AddReminderModal from '@/components/smartMoney/AddReminderModal';
import SmartMoneyExpenseModal from '@/components/smartMoney/SmartMoneyExpenseModal';
import GmailSyncModal from './GmailSyncModal';

// Import services
import { SplittingService } from '@/services/firebase/splitting';
import { SmartMoneyService } from '@/services/smartMoney/SmartMoneyService';
import { RemindersService } from '@/services/reminders/RemindersService';

const { width } = Dimensions.get('window');

interface UnifiedActionModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function UnifiedActionModal({ visible, onClose }: UnifiedActionModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  // Modal states
  const [showSplitExpense, setShowSplitExpense] = useState(false);
  const [showSmartExpense, setShowSmartExpense] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showGmailSync, setShowGmailSync] = useState(false);
  
  // Data states
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (visible && user) {
      loadUserData();
    }
  }, [visible, user]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const [userGroups, userFriends] = await Promise.all([
        SplittingService.getUserGroups(user.id),
        SplittingService.getFriends(user.id)
      ]);
      setGroups(userGroups);
      setFriends(userFriends);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActionSelect = (action: string) => {
    onClose();
    
    switch (action) {
      case 'split-expense':
        setShowSplitExpense(true);
        break;
      case 'smart-expense':
        setShowSmartExpense(true);
        break;
      case 'reminder':
        setShowReminder(true);
        break;
      case 'gmail-sync':
        setShowGmailSync(true);
        break;
    }
  };

  const handleSplitExpenseSubmit = async (expenseData: any) => {
    try {
      setLoading(true);
      await SplittingService.addExpense(expenseData);
      setShowSplitExpense(false);
      Alert.alert('Success', 'Split expense added successfully!');
    } catch (error) {
      console.error('Error adding split expense:', error);
      Alert.alert('Error', 'Failed to add split expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSmartExpenseSubmit = async (expenseData: any) => {
    try {
      setLoading(true);
      await SmartMoneyService.addTransaction({
        ...expenseData,
        userId: user.id,
        source: 'manual',
        aiConfidence: 0.8,
        canSplit: true,
        tags: [expenseData.category.toLowerCase()],
        date: new Date()
      });
      setShowSmartExpense(false);
      Alert.alert('Success', 'Smart Money expense added successfully!');
    } catch (error) {
      console.error('Error adding smart expense:', error);
      Alert.alert('Error', 'Failed to add smart expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReminderSubmit = async (reminderData: any) => {
    try {
      setLoading(true);
      await RemindersService.createReminder(user.id, {
        ...reminderData,
        status: 'upcoming',
        notificationEnabled: true,
        reminderDays: [3, 1],
        autoDetected: false
      });
      setShowReminder(false);
      Alert.alert('Success', 'Reminder added successfully!');
    } catch (error) {
      console.error('Error adding reminder:', error);
      Alert.alert('Error', 'Failed to add reminder. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGmailSync = async () => {
    try {
      setLoading(true);
      // This would integrate with Gmail API to sync and analyze emails
      // For now, show the sync modal
      setShowGmailSync(true);
    } catch (error) {
      console.error('Error with Gmail sync:', error);
      Alert.alert('Error', 'Failed to sync with Gmail. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const actionItems = [
    {
      id: 'split-expense',
      title: 'Split Expense',
      subtitle: 'Add expense to share with groups',
      icon: 'people',
      gradient: ['#3B82F6', '#2563EB'],
      iconBg: 'rgba(59, 130, 246, 0.2)',
    },
    {
      id: 'smart-expense',
      title: 'Smart Money Expense',
      subtitle: 'AI-powered expense tracking',
      icon: 'sparkles',
      gradient: ['#10B981', '#059669'],
      iconBg: 'rgba(16, 185, 129, 0.2)',
    },
    {
      id: 'reminder',
      title: 'Bill Reminder',
      subtitle: 'Never miss a payment again',
      icon: 'notifications',
      gradient: ['#F59E0B', '#D97706'],
      iconBg: 'rgba(245, 158, 11, 0.2)',
    },
    {
      id: 'gmail-sync',
      title: 'Gmail Sync & Analysis',
      subtitle: 'Auto-detect bills from Gmail',
      icon: 'mail',
      gradient: ['#EF4444', '#DC2626'],
      iconBg: 'rgba(239, 68, 68, 0.2)',
    },
  ];

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <BlurView intensity={20} style={styles.overlay}>
          <TouchableOpacity 
            style={styles.backdrop} 
            activeOpacity={1} 
            onPress={onClose}
          >
            <View style={styles.container}>
              <TouchableOpacity 
                activeOpacity={1} 
                style={[styles.modal, { backgroundColor: theme.colors.background }]}
              >
                {/* Handle Bar */}
                <View style={styles.handleBar}>
                  <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
                </View>
                
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerContent}>
                    <View>
                      <Text style={[styles.title, { color: theme.colors.text }]}>
                        Quick Actions
                      </Text>
                      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        What would you like to add?
                      </Text>
                    </View>
                    <TouchableOpacity 
                      onPress={onClose}
                      style={[styles.closeButton, { backgroundColor: theme.colors.surface }]}
                    >
                      <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Action Items */}
                <View style={styles.actionsContainer}>
                  {actionItems.map((item, index) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.actionItem, { 
                        backgroundColor: theme.colors.surface,
                        marginBottom: index === actionItems.length - 1 ? 0 : 12
                      }]}
                      onPress={() => handleActionSelect(item.id)}
                      disabled={loading}
                    >
                      <View style={styles.actionContent}>
                        <View style={[styles.actionIconContainer, { backgroundColor: item.iconBg }]}>
                          <Ionicons 
                            name={item.icon as any} 
                            size={24} 
                            color={item.gradient[0]} 
                          />
                        </View>
                        
                        <View style={styles.actionText}>
                          <Text style={[styles.actionTitle, { color: theme.colors.text }]}>
                            {item.title}
                          </Text>
                          <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
                            {item.subtitle}
                          </Text>
                        </View>
                        
                        <View style={styles.actionArrow}>
                          <Ionicons 
                            name="chevron-forward" 
                            size={20} 
                            color={theme.colors.textSecondary} 
                          />
                        </View>
                      </View>
                      
                      {/* Gradient Border */}
                      <LinearGradient
                        colors={item.gradient}
                        style={styles.gradientBorder}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: theme.colors.surface }]}
                    onPress={onClose}
                  >
                    <Text style={[styles.cancelText, { color: theme.colors.textSecondary }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* Split Expense Modal */}
      <AddExpenseModal
        visible={showSplitExpense}
        onClose={() => setShowSplitExpense(false)}
        onSubmit={handleSplitExpenseSubmit}
        groups={groups}
        friends={friends}
      />

      {/* Smart Money Expense Modal */}
      <SmartMoneyExpenseModal
        visible={showSmartExpense}
        onClose={() => setShowSmartExpense(false)}
        onSubmit={handleSmartExpenseSubmit}
      />

      {/* Add Reminder Modal */}
      <AddReminderModal
        visible={showReminder}
        onClose={() => setShowReminder(false)}
        onSubmit={handleReminderSubmit}
      />

      {/* Gmail Sync Modal */}
      <GmailSyncModal
        visible={showGmailSync}
        onClose={() => setShowGmailSync(false)}
        onSync={handleGmailSync}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  handleBar: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsContainer: {
    padding: 24,
  },
  actionItem: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
  },
  actionArrow: {
    marginLeft: 8,
  },
  gradientBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  footer: {
    padding: 24,
    paddingTop: 8,
  },
  cancelButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
});