import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { SplittingService } from '@/services/firebase/splitting';
import { Button } from '@/components/common/Button';

interface GroupSettlementModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: string | null;
  userCurrency: string;
  currentUserId: string;
  onRefresh?: () => void;
}

interface SettlementSuggestion {
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  toUserId: string;
  toUserName: string;
  toUserAvatar?: string;
  amount: number;
}

export default function GroupSettlementModal({
  visible,
  onClose,
  groupId,
  userCurrency,
  currentUserId,
  onRefresh
}: GroupSettlementModalProps) {
  const { theme } = useTheme();
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingSettlement, setProcessingSettlement] = useState<string | null>(null);

  useEffect(() => {
    if (visible && groupId) {
      loadSettlementSuggestions();
    }
  }, [visible, groupId]);

  const loadSettlementSuggestions = async () => {
    if (!groupId) return;
    
    setLoading(true);
    try {
      const suggestions = await SplittingService.getGroupSettlementSuggestions(groupId);
      setSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to load settlement suggestions:', error);
      Alert.alert('Error', 'Failed to load settlement suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleSettlement = async (suggestion: SettlementSuggestion) => {
    const settlementKey = `${suggestion.fromUserId}-${suggestion.toUserId}`;
    setProcessingSettlement(settlementKey);

    try {
      await SplittingService.markPaymentAsPaid(
        suggestion.fromUserId,
        suggestion.toUserId,
        suggestion.amount,
        groupId || undefined,
        `Group settlement: ${suggestion.fromUserName} to ${suggestion.toUserName}`
      );

      Alert.alert('Success', 'Payment marked as paid successfully!');
      
      // Refresh suggestions
      await loadSettlementSuggestions();
      
      // Notify parent to refresh
      onRefresh?.();
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process settlement');
    } finally {
      setProcessingSettlement(null);
    }
  };

  const confirmSettlement = (suggestion: SettlementSuggestion) => {
    const isCurrentUserInvolved = suggestion.fromUserId === currentUserId || suggestion.toUserId === currentUserId;
    
    let title = 'Confirm Settlement';
    let message = `Mark payment of ${userCurrency} ${suggestion.amount.toFixed(2)} from ${suggestion.fromUserName} to ${suggestion.toUserName} as paid?`;
    
    if (suggestion.fromUserId === currentUserId) {
      message = `Mark your payment of ${userCurrency} ${suggestion.amount.toFixed(2)} to ${suggestion.toUserName} as paid?`;
    } else if (suggestion.toUserId === currentUserId) {
      message = `Mark ${suggestion.fromUserName}'s payment of ${userCurrency} ${suggestion.amount.toFixed(2)} to you as paid?`;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Mark as Paid', 
        onPress: () => handleSettlement(suggestion)
      }
    ]);
  };

  const renderSettlementSuggestion = (suggestion: SettlementSuggestion, index: number) => {
    const settlementKey = `${suggestion.fromUserId}-${suggestion.toUserId}`;
    const isProcessing = processingSettlement === settlementKey;
    const isCurrentUserInvolved = suggestion.fromUserId === currentUserId || suggestion.toUserId === currentUserId;

    return (
      <View key={index} style={[styles.suggestionCard, { 
        backgroundColor: theme.colors.surface,
        borderColor: isCurrentUserInvolved ? theme.colors.primary : theme.colors.border,
        borderWidth: isCurrentUserInvolved ? 2 : 1
      }]}>
        <View style={styles.suggestionHeader}>
          <View style={styles.userInfo}>
            <View style={[styles.userAvatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.userAvatarText}>
                {suggestion.fromUserName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {suggestion.fromUserName}
            </Text>
          </View>

          <View style={styles.arrowContainer}>
            <Ionicons name="arrow-forward" size={20} color={theme.colors.textSecondary} />
            <Text style={[styles.amountText, { color: theme.colors.success }]}>
              {userCurrency} {suggestion.amount.toFixed(2)}
            </Text>
          </View>

          <View style={styles.userInfo}>
            <View style={[styles.userAvatar, { backgroundColor: theme.colors.success }]}>
              <Text style={styles.userAvatarText}>
                {suggestion.toUserName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {suggestion.toUserName}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.settleButton, { 
            backgroundColor: theme.colors.primary,
            opacity: isProcessing ? 0.6 : 1
          }]}
          onPress={() => confirmSettlement(suggestion)}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="white" />
              <Text style={styles.settleButtonText}>Mark as Paid</Text>
            </>
          )}
        </TouchableOpacity>

        {isCurrentUserInvolved && (
          <View style={[styles.involvedBadge, { backgroundColor: theme.colors.primary + '20' }]}>
            <Text style={[styles.involvedText, { color: theme.colors.primary }]}>
              You're involved in this settlement
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Group Settlements
          </Text>
          <TouchableOpacity onPress={loadSettlementSuggestions} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                Loading settlement suggestions...
              </Text>
            </View>
          ) : suggestions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                All Settled!
              </Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No outstanding balances need to be settled in this group.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Suggested Settlements
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                These settlements will help minimize the number of transactions needed to settle all balances.
              </Text>

              {suggestions.map((suggestion, index) => renderSettlementSuggestion(suggestion, index))}
            </>
          )}

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Manual settlements are recorded immediately. Make sure payments have been completed 
              before marking them as paid. All group members will be notified of settlements.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  refreshButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  suggestionCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  userInfo: {
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  arrowContainer: {
    alignItems: 'center',
    flex: 1,
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  settleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  involvedBadge: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  involvedText: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
