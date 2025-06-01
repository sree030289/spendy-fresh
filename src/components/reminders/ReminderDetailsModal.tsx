// src/components/reminders/ReminderDetailsModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { RemindersService } from '@/services/reminders/RemindersService';
import { PaymentService } from '@/services/payments/PaymentService';
import { Reminder } from '@/types/reminder';
import { formatCurrency } from '@/utils/currency';

interface ReminderDetailsModalProps {
  visible: boolean;
  reminder: Reminder | null;
  onClose: () => void;
  onReminderUpdated: () => void;
}

export default function ReminderDetailsModal({ 
  visible, 
  reminder, 
  onClose, 
  onReminderUpdated
}: ReminderDetailsModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!reminder) return null;

  const getCategoryIcon = (category: string): string => {
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
    return icons[category as keyof typeof icons] || icons.other;
  };

  const getCategoryColor = (category: string): string => {
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
    return colors[category as keyof typeof colors] || colors.other;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'upcoming': return theme.colors.primary;
      case 'overdue': return theme.colors.error;
      case 'paid': return theme.colors.success;
      default: return theme.colors.textSecondary;
    }
  };

  const getDaysUntilDue = (): number => {
    return Math.ceil(
      (new Date(reminder.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const formatDateWithTime = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  const handleMarkAsPaid = async () => {
    setActionLoading('mark_paid');
    try {
      await RemindersService.markAsPaid(reminder.id);
      onReminderUpdated();
      Alert.alert('Success', 'Reminder marked as paid!');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark as paid');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePayNow = async () => {
    if (!user) return;

    try {
      // Get available payment providers based on user's currency and country
      const providers = PaymentService.getAvailableProviders(user.currency, user.country);
      
      if (providers.length === 0) {
        Alert.alert('No Payment Apps', 'No payment apps available for your region.');
        return;
      }

      // Show payment options
      const buttons = providers.map(provider => ({
        text: provider.name,
        onPress: () => initiatePayment(provider.id)
      }));

      buttons.push({ text: 'Cancel', onPress: () => {} });

      Alert.alert(
        'Choose Payment Method',
        'Select how you want to pay this bill:',
        buttons
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to open payment options');
    }
  };

  const initiatePayment = async (providerId: string) => {
    setActionLoading('pay_now');
    try {
      const paymentRequest = {
        amount: reminder.amount,
        currency: reminder.currency,
        recipientId: 'merchant',
        recipientName: reminder.title,
        description: reminder.description || reminder.title,
        reference: reminder.id,
      };

      await PaymentService.initiatePayment(
        providerId,
        paymentRequest,
        user?.id || '',
        'merchant', // In real app, this would be the merchant's user ID
        undefined, // expenseId
        undefined  // groupId
      );

      // Mark as paid after initiating payment
      setTimeout(() => {
        handleMarkAsPaid();
      }, 2000);

    } catch (error) {
      Alert.alert('Error', 'Failed to initiate payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSnooze = () => {
    Alert.alert(
      'Snooze Reminder',
      'When would you like to be reminded again?',
      [
        { text: 'Tomorrow', onPress: () => snoozeReminder(1) },
        { text: 'In 3 days', onPress: () => snoozeReminder(3) },
        { text: 'Next week', onPress: () => snoozeReminder(7) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const snoozeReminder = async (days: number) => {
    setActionLoading('snooze');
    try {
      const newDueDate = new Date();
      newDueDate.setDate(newDueDate.getDate() + days);
      
      await RemindersService.updateReminder(reminder.id, {
        dueDate: newDueDate,
        status: 'upcoming',
      });
      
      onReminderUpdated();
      Alert.alert('Snoozed', `Reminder snoozed for ${days} day${days === 1 ? '' : 's'}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to snooze reminder');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = () => {
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
              onReminderUpdated();
              onClose();
              Alert.alert('Deleted', 'Reminder deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete reminder');
            }
          }
        }
      ]
    );
  };

  const handleShare = async () => {
    try {
      const message = `Reminder: ${reminder.title}\nAmount: ${formatCurrency(reminder.amount, reminder.currency)}\nDue: ${formatDateWithTime(new Date(reminder.dueDate))}${reminder.description ? `\nDescription: ${reminder.description}` : ''}`;
      
      await Share.share({
        message,
        title: 'Bill Reminder',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share reminder');
    }
  };

  const handleSetCalendarReminder = () => {
    Alert.alert(
      'Calendar Reminder',
      'Would you like to add this to your calendar?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add to Calendar',
          onPress: () => {
            // In a real app, you'd integrate with calendar APIs
            Alert.alert('Success', 'Calendar integration coming soon!');
          }
        }
      ]
    );
  };

  const categoryColor = getCategoryColor(reminder.category);
  const categoryIcon = getCategoryIcon(reminder.category);
  const statusColor = getStatusColor(reminder.status);
  const daysUntilDue = getDaysUntilDue();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Reminder Details
          </Text>
          
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <Ionicons name="share-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Main Info Card */}
          <View style={[styles.mainCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.mainCardHeader}>
              <View style={styles.titleSection}>
                <View style={[styles.categoryIcon, { backgroundColor: categoryColor }]}>
                  <Ionicons name={categoryIcon as any} size={24} color="white" />
                </View>
                <View style={styles.titleText}>
                  <Text style={[styles.title, { color: theme.colors.text }]}>
                    {reminder.title}
                  </Text>
                  <Text style={[styles.category, { color: theme.colors.textSecondary }]}>
                    {reminder.category.charAt(0).toUpperCase() + reminder.category.slice(1)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.amountSection}>
                <Text style={[styles.amount, { color: theme.colors.primary }]}>
                  {formatCurrency(reminder.amount, reminder.currency)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                  <Text style={styles.statusText}>
                    {reminder.status.charAt(0).toUpperCase() + reminder.status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>

            {reminder.description && (
              <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                {reminder.description}
              </Text>
            )}
          </View>

          {/* Due Date Card */}
          <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.infoHeader}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                Due Date
              </Text>
            </View>
            
            <Text style={[styles.dueDate, { color: theme.colors.text }]}>
              {formatDateWithTime(new Date(reminder.dueDate))}
            </Text>
            
            {reminder.status === 'upcoming' && (
              <Text style={[styles.dueDateSub, { color: daysUntilDue <= 3 ? theme.colors.error : theme.colors.textSecondary }]}>
                {daysUntilDue === 0 ? 'Due today!' : 
                 daysUntilDue === 1 ? 'Due tomorrow' :
                 daysUntilDue < 0 ? `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? '' : 's'}` :
                 `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`}
              </Text>
            )}
            
            {reminder.status === 'paid' && reminder.paidDate && (
              <Text style={[styles.dueDateSub, { color: theme.colors.success }]}>
                Paid on {new Date(reminder.paidDate).toLocaleDateString()}
              </Text>
            )}
          </View>

          {/* Recurring Info */}
          {reminder.isRecurring && (
            <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.infoHeader}>
                <Ionicons name="repeat-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                  Recurring
                </Text>
              </View>
              
              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                This reminder repeats {reminder.recurringType || 'monthly'}
              </Text>
              
              {reminder.nextDueDate && (
                <Text style={[styles.infoSubtext, { color: theme.colors.textSecondary }]}>
                  Next due: {new Date(reminder.nextDueDate).toLocaleDateString()}
                </Text>
              )}
            </View>
          )}

          {/* Auto-detected Info */}
          {reminder.autoDetected && reminder.emailSource && (
            <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.infoHeader}>
                <Ionicons name="mail-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                  Auto-detected
                </Text>
              </View>
              
              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                Found in email from {reminder.emailSource}
              </Text>
              
              <Text style={[styles.infoSubtext, { color: theme.colors.textSecondary }]}>
                Created on {new Date(reminder.createdAt).toLocaleDateString()}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsSection}>
            {reminder.status !== 'paid' && (
              <>
                <Button
                  title="Mark as Paid"
                  onPress={handleMarkAsPaid}
                  loading={actionLoading === 'mark_paid'}
                  style={styles.actionButton}
                />
                
                <Button
                  title="Pay Now"
                  onPress={handlePayNow}
                  loading={actionLoading === 'pay_now'}
                  variant="outline"
                  style={styles.actionButton}
                />
              </>
            )}

            {reminder.status === 'upcoming' && (
              <Button
                title="Snooze"
                onPress={handleSnooze}
                loading={actionLoading === 'snooze'}
                variant="outline"
                style={styles.actionButton}
              />
            )}

            <Button
              title="Add to Calendar"
              onPress={handleSetCalendarReminder}
              variant="outline"
              style={styles.actionButton}
            />
          </View>

          {/* More Options */}
          <View style={[styles.moreOptionsCard, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity style={styles.moreOption} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              <Text style={[styles.moreOptionText, { color: theme.colors.error }]}>
                Delete Reminder
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  mainCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
  },
  mainCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  titleText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  amountSection: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  description: {
    fontSize: 16,
    marginTop: 16,
    lineHeight: 22,
  },
  infoCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  dueDate: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
  },
  dueDateSub: {
    fontSize: 14,
  },
  infoText: {
    fontSize: 16,
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 14,
  },
  actionsSection: {
    marginTop: 32,
    gap: 12,
  },
  actionButton: {
    marginBottom: 0,
  },
  moreOptionsCard: {
    marginTop: 24,
    marginBottom: 32,
    borderRadius: 12,
    overflow: 'hidden',
  },
  moreOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  moreOptionText: {
    flex: 1,
    fontSize: 16,
  },
  separator: {
    height: 1,
    marginLeft: 48,
  },
});