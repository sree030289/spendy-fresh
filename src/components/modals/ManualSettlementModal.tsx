import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Friend } from '@/services/firebase/splitting';
import { Button } from '@/components/common/Button';

interface ManualSettlementModalProps {
  visible: boolean;
  onClose: () => void;
  friend: Friend | null;
  userCurrency: string;
  onSettlement: (friendId: string, amount: number, type: 'pay' | 'request', description?: string) => Promise<void>;
}

export default function ManualSettlementModal({
  visible,
  onClose,
  friend,
  userCurrency,
  onSettlement
}: ManualSettlementModalProps) {
  const { theme } = useTheme();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [settlementType, setSettlementType] = useState<'pay' | 'request'>('pay');

  const resetForm = () => {
    setAmount('');
    setDescription('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmitAction = async () => {
    if (!friend) return;
    
    // Enhanced validation
    const trimmedAmount = amount.trim();
    
    // Check if amount is empty
    if (!trimmedAmount) {
      Alert.alert('Invalid Amount', 'Please enter an amount');
      return;
    }
    
    // Parse and validate amount
    const amountNum = parseFloat(trimmedAmount);
    
    // Check for invalid number
    if (isNaN(amountNum)) {
      Alert.alert('Invalid Amount', 'Please enter a valid number');
      return;
    }
    
    // Check for negative or zero amounts
    if (amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Amount must be greater than 0');
      return;
    }
    
    // Check for reasonable maximum amount (e.g., $100,000)
    if (amountNum > 100000) {
      Alert.alert('Invalid Amount', 'Amount cannot exceed 100,000');
      return;
    }
    
    // Check for too many decimal places (currency typically has 2)
    const decimalPlaces = (trimmedAmount.split('.')[1] || '').length;
    if (decimalPlaces > 2) {
      Alert.alert('Invalid Amount', 'Amount cannot have more than 2 decimal places');
      return;
    }
    
    // Round to 2 decimal places to handle floating point precision
    const finalAmount = Math.round(amountNum * 100) / 100;

    setLoading(true);
    try {
      await onSettlement(friend.friendId, finalAmount, settlementType, description.trim() || 'Manual settlement');
      
      const successMessage = settlementType === 'pay' 
        ? 'Payment marked as paid successfully!'
        : 'Payment request sent successfully!';
      Alert.alert('Success', successMessage);
      handleClose();
    } catch (error: any) {
      const errorMessage = settlementType === 'pay'
        ? 'Failed to mark payment as paid'
        : 'Failed to send payment request';
      Alert.alert('Error', error.message || errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSettleAllBalances = async () => {
    if (!friend || friend.balance === 0) return;

    const absoluteBalance = Math.abs(friend.balance);
    
    // Validate the balance amount
    if (absoluteBalance > 100000) {
      Alert.alert('Amount Too Large', 'Balance exceeds maximum settleable amount of 100,000');
      return;
    }

    Alert.alert(
      'Settle All Balances',
      `Are you sure you want to settle all outstanding balances (${userCurrency} ${absoluteBalance.toFixed(2)}) with ${friend.friendData.fullName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          onPress: async () => {
            setLoading(true);
            try {
              // Round to 2 decimal places to handle floating point precision
              const finalAmount = Math.round(absoluteBalance * 100) / 100;
              
              await onSettlement(friend.friendId, finalAmount, 'pay', 'Settlement of all balances');
              Alert.alert('Success', 'All balances settled successfully!');
              handleClose();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to settle balances');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (!friend) return null;

  const owedAmount = Math.abs(friend.balance);
  const isOwed = friend.balance > 0; // User is owed money
  const owesUser = friend.balance < 0; // Friend owes user

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Manual Settlement
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Friend Info */}
          <View style={styles.friendInfo}>
            <View style={[styles.friendAvatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.friendAvatarText}>
                {friend.friendData.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.friendDetails}>
              <Text style={[styles.friendName, { color: theme.colors.text }]}>
                {friend.friendData.fullName}
              </Text>
              {friend.balance !== 0 && (
                <Text style={[styles.friendBalance, { 
                  color: isOwed ? theme.colors.success : theme.colors.error 
                }]}>
                  {isOwed 
                    ? `Owes you ${userCurrency} ${owedAmount.toFixed(2)}`
                    : `You owe ${userCurrency} ${owedAmount.toFixed(2)}`
                  }
                </Text>
              )}
            </View>
          </View>

          {/* Settlement Type Selector */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Settlement Action
            </Text>
            <View style={styles.settlementTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.settlementTypeButton,
                  settlementType === 'pay' && [styles.activeSettlementType, { backgroundColor: theme.colors.success }],
                  settlementType !== 'pay' && { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
                ]}
                onPress={() => setSettlementType('pay')}
              >
                <Ionicons 
                  name="checkmark-circle" 
                  size={24} 
                  color={settlementType === 'pay' ? 'white' : theme.colors.textSecondary} 
                />
                <View style={styles.settlementTypeContent}>
                  <Text style={[
                    styles.settlementTypeTitle,
                    { color: settlementType === 'pay' ? 'white' : theme.colors.text }
                  ]}>
                    Mark as Paid
                  </Text>
                  <Text style={[
                    styles.settlementTypeDescription,
                    { color: settlementType === 'pay' ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary }
                  ]}>
                    Record that payment has been completed
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.settlementTypeButton,
                  settlementType === 'request' && [styles.activeSettlementType, { backgroundColor: theme.colors.primary }],
                  settlementType !== 'request' && { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
                ]}
                onPress={() => setSettlementType('request')}
              >
                <Ionicons 
                  name="send" 
                  size={24} 
                  color={settlementType === 'request' ? 'white' : theme.colors.textSecondary} 
                />
                <View style={styles.settlementTypeContent}>
                  <Text style={[
                    styles.settlementTypeTitle,
                    { color: settlementType === 'request' ? 'white' : theme.colors.text }
                  ]}>
                    Send Request
                  </Text>
                  <Text style={[
                    styles.settlementTypeDescription,
                    { color: settlementType === 'request' ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary }
                  ]}>
                    Request payment from {friend?.friendData.fullName}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Settlement */}
          {friend.balance !== 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Quick Settlement
              </Text>
              <TouchableOpacity
                style={[styles.quickSettleButton, { 
                  backgroundColor: theme.colors.primary,
                  opacity: loading ? 0.6 : 1
                }]}
                onPress={handleSettleAllBalances}
                disabled={loading}
              >
                <Ionicons name="checkmark-circle" size={20} color="white" />
                <Text style={styles.quickSettleText}>
                  Mark All as Paid ({userCurrency} {owedAmount.toFixed(2)})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Custom Amount Settlement */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Mark Specific Amount as Paid
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Amount ({userCurrency})
              </Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder={`Enter amount in ${userCurrency}`}
                placeholderTextColor={theme.colors.textSecondary}
                value={amount}
                onChangeText={(text) => {
                  // Format input to handle currency properly
                  let formattedText = text;
                  
                  // Remove any non-numeric characters except decimal point
                  formattedText = formattedText.replace(/[^0-9.]/g, '');
                  
                  // Ensure only one decimal point
                  const parts = formattedText.split('.');
                  if (parts.length > 2) {
                    formattedText = parts[0] + '.' + parts.slice(1).join('');
                  }
                  
                  // Limit to 2 decimal places
                  if (parts[1] && parts[1].length > 2) {
                    formattedText = parts[0] + '.' + parts[1].substring(0, 2);
                  }
                  
                  // Prevent amounts over 100,000
                  const numValue = parseFloat(formattedText);
                  if (!isNaN(numValue) && numValue > 100000) {
                    return; // Don't update if over limit
                  }
                  
                  setAmount(formattedText);
                }}
                keyboardType="decimal-pad"
                maxLength={10} // Limit input length
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Description (Optional)
              </Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="Add a note for this settlement"
                placeholderTextColor={theme.colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
              />
            </View>

            <Button
              title={settlementType === 'pay' ? "Mark as Paid" : "Send Payment Request"}
              onPress={handleSubmitAction}
              loading={loading}
              style={StyleSheet.flatten([
                styles.markPaidButton, 
                { backgroundColor: settlementType === 'pay' ? theme.colors.success : theme.colors.primary }
              ])}
              disabled={!amount.trim() || loading}
            />
          </View>

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Manual settlements are recorded immediately without going through external payment apps. 
              Make sure the payment has actually been completed before marking it as paid.
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  friendAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  friendAvatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  friendBalance: {
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  quickSettleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  quickSettleText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  markPaidButton: {
    marginTop: 8,
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
  settlementTypeContainer: {
    gap: 12,
  },
  settlementTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  activeSettlementType: {
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settlementTypeContent: {
    flex: 1,
  },
  settlementTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settlementTypeDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
});
