// src/components/modals/PaymentModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import { PaymentService } from '@/services/payments/PaymentService';
import { Friend } from '@/services/firebase/splitting';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  friend: Friend | null;
  onPayment: (friendId: string, amount: number, method: string) => void;
  userCurrency: string;
  userCountry: string;
}

export default function PaymentModal({ 
  visible, 
  onClose, 
  friend, 
  onPayment, 
  userCurrency, 
  userCountry 
}: PaymentModalProps) {
  const { theme } = useTheme();
  const [step, setStep] = useState<'amount' | 'method' | 'confirm'>('amount');
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [availableProviders, setAvailableProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible && friend) {
      resetModal();
      loadPaymentProviders();
    }
  }, [visible, friend, userCurrency, userCountry]);

  const resetModal = () => {
    setStep('amount');
    setAmount('');
    setCustomAmount(false);
    setSelectedMethod('');
    setNote('');
    setLoading(false);
    
    // Set default amount based on friend's balance
    if (friend && friend.balance !== 0) {
      setAmount(Math.abs(friend.balance).toFixed(2));
    }
  };

  const loadPaymentProviders = () => {
    const providers = PaymentService.getAvailableProviders(userCurrency, userCountry);
    setAvailableProviders(providers);
  };

  const handleAmountSelect = (selectedAmount: string) => {
    setAmount(selectedAmount);
    setCustomAmount(false);
  };

  const handleCustomAmount = () => {
    setCustomAmount(true);
    setAmount('');
  };

  const validateAmount = (): boolean => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (step === 'amount') {
      if (validateAmount()) {
        setStep('method');
      }
    } else if (step === 'method') {
      if (!selectedMethod) {
        Alert.alert('Select Payment Method', 'Please choose a payment method');
        return;
      }
      setStep('confirm');
    }
  };

  const handlePrevStep = () => {
    if (step === 'method') {
      setStep('amount');
    } else if (step === 'confirm') {
      setStep('method');
    }
  };

  const handlePayment = async () => {
    if (!friend || !selectedMethod) return;

    setLoading(true);
    try {
      await onPayment(friend.friendId, parseFloat(amount), selectedMethod);
      onClose();
    } catch (error: any) {
      Alert.alert('Payment Error', error.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodIcon = (providerId: string) => {
    const iconMap: { [key: string]: string } = {
      nab: '🏛️',
      anz: '🏦',
      'anz-plus': '➕',
      westpac: '🏪',
      commonwealth: '🟡',
      gpay: '🟢',
      phonepe: '🟣',
      paytm: '🔵',
      paypal: '💙',
      upi: '💳',
      wise: '🌍'
    };
    return iconMap[providerId] || '💳';
  };

  const renderAmountStep = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <View style={styles.amountHeader}>
        {friend && (
          <View style={styles.friendInfo}>
            <View style={[styles.friendAvatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.friendAvatarText}>
                {friend.friendData.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.friendName, { color: theme.colors.text }]}>
                {friend.friendData.fullName}
              </Text>
              <Text style={[styles.friendBalance, { 
                color: friend.balance > 0 ? theme.colors.success : theme.colors.error 
              }]}>
                {friend.balance > 0 
                  ? `Owes you ${userCurrency} ${Math.abs(friend.balance).toFixed(2)}` 
                  : `You owe ${userCurrency} ${Math.abs(friend.balance).toFixed(2)}`
                }
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.amountSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          How much are you {friend && friend.balance > 0 ? 'requesting' : 'paying'}?
        </Text>

        {/* Quick Amount Options */}
        {friend && friend.balance !== 0 && (
          <View style={styles.quickAmounts}>
            <TouchableOpacity
              style={[
                styles.quickAmountButton,
                amount === Math.abs(friend.balance).toFixed(2) && !customAmount && 
                [styles.selectedAmount, { backgroundColor: theme.colors.primary + '20' }]
              ]}
              onPress={() => handleAmountSelect(Math.abs(friend.balance).toFixed(2))}
            >
              <Text style={[
                styles.quickAmountText,
                { color: amount === Math.abs(friend.balance).toFixed(2) && !customAmount 
                  ? theme.colors.primary 
                  : theme.colors.text 
                }
              ]}>
                Full Amount
              </Text>
              <Text style={[
                styles.quickAmountValue,
                { color: amount === Math.abs(friend.balance).toFixed(2) && !customAmount 
                  ? theme.colors.primary 
                  : theme.colors.textSecondary 
                }
              ]}>
                {userCurrency} {Math.abs(friend.balance).toFixed(2)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickAmountButton,
                amount === (Math.abs(friend.balance) / 2).toFixed(2) && !customAmount && 
                [styles.selectedAmount, { backgroundColor: theme.colors.primary + '20' }]
              ]}
              onPress={() => handleAmountSelect((Math.abs(friend.balance) / 2).toFixed(2))}
            >
              <Text style={[
                styles.quickAmountText,
                { color: amount === (Math.abs(friend.balance) / 2).toFixed(2) && !customAmount 
                  ? theme.colors.primary 
                  : theme.colors.text 
                }
              ]}>
                Half Amount
              </Text>
              <Text style={[
                styles.quickAmountValue,
                { color: amount === (Math.abs(friend.balance) / 2).toFixed(2) && !customAmount 
                  ? theme.colors.primary 
                  : theme.colors.textSecondary 
                }
              ]}>
                {userCurrency} {(Math.abs(friend.balance) / 2).toFixed(2)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Custom Amount */}
        <TouchableOpacity
          style={[
            styles.customAmountButton,
            customAmount && [styles.selectedAmount, { backgroundColor: theme.colors.primary + '20' }]
          ]}
          onPress={handleCustomAmount}
        >
          <Text style={[
            styles.customAmountText,
            { color: customAmount ? theme.colors.primary : theme.colors.text }
          ]}>
            Custom Amount
          </Text>
        </TouchableOpacity>

        {/* Amount Input */}
        <View style={styles.amountInputContainer}>
          <Text style={[styles.currencySymbol, { color: theme.colors.textSecondary }]}>
            {userCurrency === 'USD' ? '$' : userCurrency === 'EUR' ? '€' : userCurrency === 'INR' ? '₹' : userCurrency}
          </Text>
          <TextInput
            style={[
              styles.amountInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }
            ]}
            placeholder="0.00"
            placeholderTextColor={theme.colors.textSecondary}
            value={amount}
            onChangeText={(text) => {
              setAmount(text);
              setCustomAmount(true);
            }}
            keyboardType="decimal-pad"
            autoFocus={customAmount}
          />
        </View>

        {/* Note */}
        <View style={styles.noteContainer}>
          <Text style={[styles.noteLabel, { color: theme.colors.text }]}>
            Add a note (optional)
          </Text>
          <TextInput
            style={[
              styles.noteInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }
            ]}
            placeholder="What's this payment for?"
            placeholderTextColor={theme.colors.textSecondary}
            value={note}
            onChangeText={setNote}
            maxLength={100}
            multiline
            numberOfLines={2}
          />
        </View>
      </View>
    </ScrollView>
  );

  const renderMethodStep = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Choose Payment Method
      </Text>

      <View style={styles.paymentMethods}>
        {availableProviders.map((provider) => (
          <TouchableOpacity
            key={provider.id}
            style={[
              styles.paymentMethod,
              selectedMethod === provider.id && [
                styles.selectedMethod,
                { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
              ]
            ]}
            onPress={() => setSelectedMethod(provider.id)}
          >
            <View style={styles.methodLeft}>
              <Text style={styles.methodIcon}>{getPaymentMethodIcon(provider.id)}</Text>
              <View>
                <Text style={[
                  styles.methodName,
                  { color: selectedMethod === provider.id ? theme.colors.primary : theme.colors.text }
                ]}>
                  {provider.name}
                </Text>
                <Text style={[styles.methodDescription, { color: theme.colors.textSecondary }]}>
                  {provider.supportedCurrencies.join(', ')}
                </Text>
              </View>
            </View>
            {selectedMethod === provider.id && (
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {availableProviders.length === 0 && (
        <View style={[styles.noMethods, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="card-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.noMethodsText, { color: theme.colors.textSecondary }]}>
            No payment methods available for {userCurrency} in {userCountry}
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderConfirmStep = () => {
    const selectedProvider = availableProviders.find(p => p.id === selectedMethod);
    
    return (
      <ScrollView contentContainerStyle={styles.stepContent}>
        <View style={[styles.confirmCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.confirmTitle, { color: theme.colors.text }]}>
            Confirm Payment
          </Text>

          {/* Payment Summary */}
          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>To</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {friend?.friendData.fullName}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Amount</Text>
              <Text style={[styles.summaryValueLarge, { color: theme.colors.text }]}>
                {userCurrency} {parseFloat(amount).toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Method</Text>
              <View style={styles.methodSummary}>
                <Text style={styles.methodSummaryIcon}>{getPaymentMethodIcon(selectedMethod)}</Text>
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                  {selectedProvider?.name}
                </Text>
              </View>
            </View>
            
            {note.trim() && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Note</Text>
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                  {note}
                </Text>
              </View>
            )}
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Processing Fee</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.success }]}>
                Free
              </Text>
            </View>
          </View>

          {/* Instructions */}
          <View style={[styles.instructionsCard, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.instructionsText, { color: theme.colors.textSecondary }]}>
              You'll be redirected to {selectedProvider?.name} to complete the payment securely.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {['amount', 'method', 'confirm'].map((stepName, index) => (
        <View key={stepName} style={styles.stepItem}>
          <View style={[
            styles.stepCircle,
            {
              backgroundColor: 
                step === stepName 
                  ? theme.colors.primary 
                  : ['amount', 'method', 'confirm'].indexOf(step) > index
                    ? theme.colors.success
                    : theme.colors.border
            }
          ]}>
            <Text style={[
              styles.stepNumber,
              {
                color: 
                  step === stepName || ['amount', 'method', 'confirm'].indexOf(step) > index
                    ? 'white'
                    : theme.colors.textSecondary
              }
            ]}>
              {index + 1}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  if (!friend) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {friend.balance > 0 ? 'Request Payment' : 'Send Payment'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Content */}
        <View style={styles.content}>
          {step === 'amount' && renderAmountStep()}
          {step === 'method' && renderMethodStep()}
          {step === 'confirm' && renderConfirmStep()}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <View style={styles.footerButtons}>
            {step !== 'amount' && (
              <Button
                title="Back"
                onPress={handlePrevStep}
                variant="outline"
                style={styles.footerButton}
                disabled={loading}
              />
            )}
            
            <Button
              title={
                step === 'amount' ? 'Next' :
                step === 'method' ? 'Next' :
                friend.balance > 0 ? 'Send Request' : 'Send Payment'
              }
              onPress={step === 'confirm' ? handlePayment : handleNextStep}
              loading={loading}
              style={StyleSheet.flatten([styles.footerButton, step === 'amount' && styles.fullWidthButton])}
            />
          </View>
        </View>
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
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 40,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  stepContent: {
    flexGrow: 1,
    padding: 20,
  },
  amountHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  friendAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
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
  amountSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickAmountButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  selectedAmount: {
    borderWidth: 2,
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  quickAmountValue: {
    fontSize: 12,
  },
  customAmountButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    marginBottom: 24,
  },
  customAmountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    marginRight: 12,
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  noteContainer: {
    marginBottom: 24,
  },
  noteLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  noteInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  paymentMethods: {
    gap: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedMethod: {
    borderWidth: 2,
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  methodIcon: {
    fontSize: 24,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  methodDescription: {
    fontSize: 12,
  },
  noMethods: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 12,
  },
  noMethodsText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  confirmCard: {
    borderRadius: 16,
    padding: 24,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  summarySection: {
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  summaryValueLarge: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  methodSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodSummaryIcon: {
    fontSize: 20,
  },
  instructionsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    borderTopWidth: 1,
    padding: 20,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
  fullWidthButton: {
    flex: 1,
  },
});