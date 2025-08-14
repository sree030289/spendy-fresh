import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
// Icon import handled by existing Icon component
import { Icon } from '../common/Icon';
import { useTheme } from '@/hooks/useTheme';
import { PersonalTransaction } from '@/types/moneyManagement';

interface TransactionDetailsModalProps {
  visible: boolean;
  transaction: PersonalTransaction | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}

const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  visible,
  transaction,
  onClose,
  onEdit,
  onDelete,
}) => {
  const { theme } = useTheme();

  if (!transaction) {
    return null;
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(transaction.id),
        },
      ]
    );
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Salary': '💰', 'Freelance': '💼', 'Business': '🏢', 'Investment': '📈',
      'Rent': '🏠', 'Groceries': '🛒', 'Transportation': '🚗', 'Entertainment': '🎬',
      'Utilities': '⚡', 'Healthcare': '🏥', 'Shopping': '🛍️', 'Restaurant': '🍽️',
    };
    return icons[category] || (transaction.type === 'income' ? '💵' : '💳');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Transaction Details
          </Text>
          
          <TouchableOpacity onPress={onEdit}>
            <Icon name="edit" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Transaction Summary */}
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.summaryHeader}>
              <View style={[
                styles.categoryIcon,
                { backgroundColor: transaction.type === 'income' ? theme.colors.success : theme.colors.error }
              ]}>
                <Text style={styles.categoryIconText}>
                  {getCategoryIcon(transaction.category)}
                </Text>
              </View>
              
              <View style={styles.summaryInfo}>
                <Text style={[styles.transactionDescription, { color: theme.colors.text }]}>
                  {transaction.description}
                </Text>
                <Text style={[styles.transactionCategory, { color: theme.colors.textSecondary }]}>
                  {transaction.category}
                </Text>
              </View>
              
              <Text style={[
                styles.transactionAmount,
                { 
                  color: transaction.type === 'income' 
                    ? theme.colors.success 
                    : theme.colors.error 
                }
              ]}>
                {transaction.type === 'income' ? '+' : '-'}$
                {transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          {/* Details Section */}
          <View style={[styles.detailsCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Details
            </Text>
            
            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                  Type
                </Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                  {transaction.type === 'income' ? 'Income' : 'Expense'}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                  Date
                </Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                  {new Date(transaction.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              
              {transaction.subcategory && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                    Subcategory
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                    {transaction.subcategory}
                  </Text>
                </View>
              )}
              
              {transaction.paymentMethod && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                    Payment Method
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                    {transaction.paymentMethod}
                  </Text>
                </View>
              )}
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                  Source
                </Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                  {transaction.source === 'manual' ? 'Manual Entry' : transaction.source}
                </Text>
              </View>
              
              {transaction.isRecurring && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                    Recurring
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.colors.primary }]}>
                    Yes
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Tags Section */}
          {transaction.tags && transaction.tags.length > 0 && (
            <View style={[styles.tagsCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Tags
              </Text>
              <View style={styles.tagsContainer}>
                {transaction.tags.map((tag, index) => (
                  <View key={index} style={[styles.tag, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Notes Section */}
          {transaction.notes && (
            <View style={[styles.notesCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Notes
              </Text>
              <Text style={[styles.notesText, { color: theme.colors.text }]}>
                {transaction.notes}
              </Text>
            </View>
          )}

          {/* Metadata Section */}
          <View style={[styles.metadataCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Metadata
            </Text>
            
            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                  Created
                </Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                  {new Date(transaction.createdAt).toLocaleDateString('en-US')}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                  Last Modified
                </Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                  {new Date(transaction.updatedAt).toLocaleDateString('en-US')}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: theme.colors.error }]}
            onPress={handleDelete}
          >
            <Icon name="trash" size={20} color="white" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: theme.colors.primary }]}
            onPress={onEdit}
          >
            <Icon name="edit" size={20} color="white" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  categoryIconText: {
    fontSize: 28,
  },
  summaryInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  transactionCategory: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  detailsCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  detailsList: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  tagsCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  notesCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  metadataCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 100,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TransactionDetailsModal;