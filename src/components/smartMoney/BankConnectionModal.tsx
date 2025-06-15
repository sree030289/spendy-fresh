import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

interface BankConnectionModalProps {
  visible: boolean;
  onClose: () => void;
  onConnect: (bankData: any) => void;
}

export function BankConnectionModal({ visible, onClose, onConnect }: BankConnectionModalProps) {
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const popularBanks = [
    { id: 'chase', name: 'Chase', logo: '🏦', color: '#0066b2' },
    { id: 'bofa', name: 'Bank of America', logo: '🏛️', color: '#e31837' },
    { id: 'wells', name: 'Wells Fargo', logo: '🏪', color: '#d71920' },
    { id: 'citi', name: 'Citibank', logo: '🏢', color: '#056dae' },
  ];

  const handleConnect = async () => {
    if (!selectedBank) return;

    setIsConnecting(true);
    try {
      // Simulate bank connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      onConnect({ bankId: selectedBank });
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to connect bank account');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <BlurView intensity={100} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Connect Bank</Text>
            <View style={styles.closeButton} />
          </View>
        </BlurView>

        <ScrollView style={styles.content}>
          <Text style={styles.description}>
            Securely connect your bank account to automatically track transactions and balances.
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>Popular Banks</Text>
            {popularBanks.map((bank) => (
              <TouchableOpacity
                key={bank.id}
                style={[
                  styles.bankItem,
                  selectedBank === bank.id && styles.bankItemSelected,
                ]}
                onPress={() => setSelectedBank(bank.id)}
              >
                <View style={styles.bankLeft}>
                  <Text style={styles.bankLogo}>{bank.logo}</Text>
                  <Text style={styles.bankName}>{bank.name}</Text>
                </View>
                {selectedBank === bank.id && (
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.connectButton, !selectedBank && styles.connectButtonDisabled]}
            onPress={handleConnect}
            disabled={!selectedBank || isConnecting}
          >
            <LinearGradient
              colors={selectedBank ? ['#10B981', '#059669'] : ['#D1D5DB', '#9CA3AF']}
              style={styles.connectButtonGradient}
            >
              {isConnecting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="link" size={20} color="white" />
                  <Text style={styles.connectButtonText}>Connect Bank</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.securityInfo}>
            <Ionicons name="shield-checkmark" size={24} color="#10B981" />
            <Text style={styles.securityText}>
              Your data is encrypted and secure. We use bank-level security.
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
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#10B981',
    borderRadius: 20,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    padding: 16,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#1F2937',
  },
  categoryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#10B981',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  categoryButtonTextActive: {
    color: 'white',
  },
  toggleSection: {
    marginBottom: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  toggleSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E7EB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#10B981',
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  // Bank connection styles
  description: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bankItemSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  bankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankLogo: {
    fontSize: 24,
    marginRight: 12,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  connectButton: {
    marginTop: 20,
    borderRadius: 12,
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    gap: 12,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  // Transaction details styles
  transactionHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  transactionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  transactionEmoji: {
    fontSize: 32,
  },
  transactionAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  transactionDate: {
    fontSize: 16,
    color: '#6B7280',
  },
  detailsGrid: {
    marginBottom: 24,
  },
  detailItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#1F2937',
  },
  detailInput: {
    fontSize: 16,
    color: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 4,
  },
  tagsSection: {
    marginBottom: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#EBF8FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#1E40AF',
  },
  aiInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    gap: 8,
  },
  aiText: {
    fontSize: 14,
    color: '#166534',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  actionButton: {
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
});