// src/components/modals/GmailSyncModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';

interface GmailSyncModalProps {
  visible: boolean;
  onClose: () => void;
  onSync: () => void;
}

interface DetectedBill {
  id: string;
  title: string;
  merchant: string;
  amount: number;
  dueDate: Date;
  category: string;
  confidence: number;
  emailDate: Date;
  emailSubject: string;
  selected: boolean;
}

export default function GmailSyncModal({ visible, onClose, onSync }: GmailSyncModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [currentStep, setCurrentStep] = useState<'connect' | 'analyzing' | 'results'>('connect');
  const [isConnected, setIsConnected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedBills, setDetectedBills] = useState<DetectedBill[]>([]);
  const [syncSettings, setSyncSettings] = useState({
    autoSync: true,
    includeReceipts: true,
    includeBills: true,
    includeSubscriptions: true,
    includeCreditCards: true,
    includeInvestments: false,
  });
  
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');

  useEffect(() => {
    if (visible) {
      resetModal();
    }
  }, [visible]);

  const resetModal = () => {
    setCurrentStep('connect');
    setIsConnected(false);
    setIsAnalyzing(false);
    setDetectedBills([]);
    setAnalysisProgress(0);
    setAnalysisStatus('');
  };

  const handleGmailConnect = async () => {
    try {
      // In a real app, this would use Google OAuth
      // For demo purposes, we'll simulate the connection
      setIsConnected(true);
      setCurrentStep('analyzing');
      await simulateGmailAnalysis();
    } catch (error) {
      Alert.alert('Connection Failed', 'Failed to connect to Gmail. Please try again.');
      console.error('Gmail connection error:', error);
    }
  };

  const simulateGmailAnalysis = async () => {
    setIsAnalyzing(true);
    
    const steps = [
      { progress: 20, status: 'Connecting to Gmail...' },
      { progress: 40, status: 'Scanning recent emails...' },
      { progress: 60, status: 'Analyzing bill patterns...' },
      { progress: 80, status: 'Detecting recurring payments...' },
      { progress: 100, status: 'Processing results...' },
    ];

    for (const step of steps) {
      setAnalysisProgress(step.progress);
      setAnalysisStatus(step.status);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Simulate detected bills
    const mockBills: DetectedBill[] = [
      {
        id: '1',
        title: 'Netflix Subscription',
        merchant: 'Netflix',
        amount: 15.99,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        category: 'Entertainment',
        confidence: 0.95,
        emailDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        emailSubject: 'Your Netflix bill is ready',
        selected: true,
      },
      {
        id: '2',
        title: 'Electricity Bill',
        merchant: 'Energy Australia',
        amount: 247.83,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        category: 'Utilities',
        confidence: 0.92,
        emailDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        emailSubject: 'Your electricity bill is now available',
        selected: true,
      },
      {
        id: '3',
        title: 'Chase Credit Card',
        merchant: 'Chase Bank',
        amount: 1247.65,
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        category: 'Credit Card',
        confidence: 0.98,
        emailDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        emailSubject: 'Your Chase statement is ready',
        selected: true,
      },
      {
        id: '4',
        title: 'Spotify Premium',
        merchant: 'Spotify',
        amount: 9.99,
        dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        category: 'Entertainment',
        confidence: 0.89,
        emailDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        emailSubject: 'Spotify Premium - Payment Reminder',
        selected: true,
      },
      {
        id: '5',
        title: 'Insurance Payment',
        merchant: 'GEICO',
        amount: 187.50,
        dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
        category: 'Insurance',
        confidence: 0.87,
        emailDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        emailSubject: 'Auto Insurance Payment Due Soon',
        selected: false,
      },
    ];

    setDetectedBills(mockBills);
    setIsAnalyzing(false);
    setCurrentStep('results');
  };

  const toggleBillSelection = (billId: string) => {
    setDetectedBills(prev => 
      prev.map(bill => 
        bill.id === billId ? { ...bill, selected: !bill.selected } : bill
      )
    );
  };

  const handleCreateReminders = async () => {
    const selectedBills = detectedBills.filter(bill => bill.selected);
    
    if (selectedBills.length === 0) {
      Alert.alert('No Bills Selected', 'Please select at least one bill to create reminders.');
      return;
    }

    try {
      // In a real app, this would call the RemindersService
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      Alert.alert(
        'Reminders Created!',
        `Successfully created ${selectedBills.length} smart reminders from your Gmail.`,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create reminders. Please try again.');
    }
  };

  const renderConnectStep = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      {/* Gmail Logo */}
      <View style={styles.logoContainer}>
        <LinearGradient
          colors={['#EA4335', '#FBBC04']}
          style={styles.gmailLogo}
        >
          <Ionicons name="mail" size={48} color="white" />
        </LinearGradient>
      </View>

      {/* Title */}
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        Connect Gmail for Smart Bill Detection
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
        We'll analyze your Gmail to automatically detect bills, subscriptions, and recurring payments
      </Text>

      {/* Features */}
      <View style={styles.featuresContainer}>
        <View style={styles.featureItem}>
          <View style={[styles.featureIcon, { backgroundColor: '#00C851' + '20' }]}>
            <Ionicons name="sparkles" size={20} color="#00C851" />
          </View>
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: theme.colors.text }]}>
              AI-Powered Detection
            </Text>
            <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]}>
              Smart algorithms identify bills, due dates, and amounts
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={[styles.featureIcon, { backgroundColor: '#3B82F6' + '20' }]}>
            <Ionicons name="shield-checkmark" size={20} color="#3B82F6" />
          </View>
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: theme.colors.text }]}>
              Secure & Private
            </Text>
            <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]}>
              Your emails are processed securely and never stored
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={[styles.featureIcon, { backgroundColor: '#F59E0B' + '20' }]}>
            <Ionicons name="notifications" size={20} color="#F59E0B" />
          </View>
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: theme.colors.text }]}>
              Auto Reminders
            </Text>
            <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]}>
              Never miss a payment with smart notifications
            </Text>
          </View>
        </View>
      </View>

      {/* Sync Settings */}
      <View style={[styles.settingsContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.settingsTitle, { color: theme.colors.text }]}>
          What to sync?
        </Text>
        
        {[
          { key: 'includeBills', label: 'Utility Bills', icon: 'flash' },
          { key: 'includeSubscriptions', label: 'Subscriptions', icon: 'repeat' },
          { key: 'includeCreditCards', label: 'Credit Card Bills', icon: 'card' },
          { key: 'includeReceipts', label: 'Purchase Receipts', icon: 'receipt' },
          { key: 'includeInvestments', label: 'Investment Statements', icon: 'trending-up' },
        ].map((setting) => (
          <View key={setting.key} style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons 
                name={setting.icon as any} 
                size={20} 
                color={theme.colors.primary} 
                style={styles.settingIcon}
              />
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                {setting.label}
              </Text>
            </View>
            <Switch
              value={syncSettings[setting.key as keyof typeof syncSettings]}
              onValueChange={(value) => 
                setSyncSettings(prev => ({ ...prev, [setting.key]: value }))
              }
              trackColor={{ false: theme.colors.border, true: '#00C851' }}
              thumbColor={theme.colors.background}
            />
          </View>
        ))}
      </View>

      {/* Connect Button */}
      <TouchableOpacity onPress={handleGmailConnect}>
        <LinearGradient
          colors={['#EA4335', '#DB4437']}
          style={styles.connectButton}
        >
          <Ionicons name="logo-google" size={24} color="white" />
          <Text style={styles.connectButtonText}>Connect Gmail Account</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Disclaimer */}
      <Text style={[styles.disclaimer, { color: theme.colors.textSecondary }]}>
        We'll only access emails to detect bills and payments. Your email content is never stored or shared.
      </Text>
    </ScrollView>
  );

  const renderAnalyzingStep = () => (
    <View style={styles.analyzingContainer}>
      <View style={styles.analyzingContent}>
        {/* Progress Circle */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressCircle, { borderColor: theme.colors.border }]}>
            <View style={[
              styles.progressFill,
              {
                transform: [{ rotate: `${(analysisProgress / 100) * 360}deg` }],
                borderColor: '#00C851',
              }
            ]} />
            <View style={[styles.progressInner, { backgroundColor: theme.colors.background }]}>
              <Text style={[styles.progressText, { color: theme.colors.text }]}>
                {analysisProgress}%
              </Text>
            </View>
          </View>
        </View>

        {/* Status */}
        <Text style={[styles.analyzingTitle, { color: theme.colors.text }]}>
          Analyzing Your Gmail
        </Text>
        <Text style={[styles.analyzingStatus, { color: theme.colors.textSecondary }]}>
          {analysisStatus}
        </Text>

        {/* Analysis Steps */}
        <View style={styles.analysisSteps}>
          {[
            { step: 'Scanning recent emails', completed: analysisProgress > 20 },
            { step: 'Identifying bill patterns', completed: analysisProgress > 40 },
            { step: 'Extracting payment details', completed: analysisProgress > 60 },
            { step: 'Creating smart reminders', completed: analysisProgress > 80 },
          ].map((item, index) => (
            <View key={index} style={styles.analysisStep}>
              <View style={[
                styles.stepIndicator,
                item.completed && { backgroundColor: '#00C851' }
              ]}>
                {item.completed && (
                  <Ionicons name="checkmark" size={12} color="white" />
                )}
              </View>
              <Text style={[
                styles.stepText,
                { color: item.completed ? theme.colors.text : theme.colors.textSecondary }
              ]}>
                {item.step}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderResultsStep = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      {/* Header */}
      <View style={styles.resultsHeader}>
        <View style={[styles.successIcon, { backgroundColor: '#00C851' + '20' }]}>
          <Ionicons name="checkmark-circle" size={32} color="#00C851" />
        </View>
        <Text style={[styles.resultsTitle, { color: theme.colors.text }]}>
          Found {detectedBills.length} Bills & Payments
        </Text>
        <Text style={[styles.resultsSubtitle, { color: theme.colors.textSecondary }]}>
          Select which ones you'd like to create reminders for
        </Text>
      </View>

      {/* Bills List */}
      <View style={styles.billsList}>
        {detectedBills.map((bill) => (
          <TouchableOpacity
            key={bill.id}
            style={[
              styles.billItem,
              { 
                backgroundColor: theme.colors.surface,
                borderColor: bill.selected ? '#00C851' : theme.colors.border,
                borderWidth: bill.selected ? 2 : 1,
              }
            ]}
            onPress={() => toggleBillSelection(bill.id)}
          >
            <View style={styles.billItemLeft}>
              <View style={[
                styles.billCheckbox,
                bill.selected && { backgroundColor: '#00C851', borderColor: '#00C851' }
              ]}>
                {bill.selected && (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
              </View>
              
              <View style={styles.billInfo}>
                <Text style={[styles.billTitle, { color: theme.colors.text }]}>
                  {bill.title}
                </Text>
                <Text style={[styles.billMerchant, { color: theme.colors.textSecondary }]}>
                  {bill.merchant} • Due {bill.dueDate.toLocaleDateString()}
                </Text>
                <Text style={[styles.billEmail, { color: theme.colors.textSecondary }]}>
                  From: "{bill.emailSubject}"
                </Text>
              </View>
            </View>
            
            <View style={styles.billItemRight}>
              <Text style={[styles.billAmount, { color: theme.colors.text }]}>
                ${bill.amount}
              </Text>
              <View style={styles.confidenceContainer}>
                <View style={[
                  styles.confidenceBadge,
                  { backgroundColor: bill.confidence > 0.9 ? '#00C851' : '#F59E0B' }
                ]}>
                  <Text style={styles.confidenceText}>
                    {Math.round(bill.confidence * 100)}%
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary */}
      <View style={[styles.summaryContainer, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
            Selected Bills
          </Text>
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
            {detectedBills.filter(b => b.selected).length} of {detectedBills.length}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
            Total Amount
          </Text>
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
            ${detectedBills.filter(b => b.selected).reduce((sum, b) => sum + b.amount, 0).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.selectAllButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => {
            const allSelected = detectedBills.every(b => b.selected);
            setDetectedBills(prev => 
              prev.map(bill => ({ ...bill, selected: !allSelected }))
            );
          }}
        >
          <Text style={[styles.selectAllText, { color: theme.colors.primary }]}>
            {detectedBills.every(b => b.selected) ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleCreateReminders}>
          <LinearGradient
            colors={['#00C851', '#00A844']}
            style={styles.createButton}
          >
            <Ionicons name="notifications" size={20} color="white" />
            <Text style={styles.createButtonText}>
              Create {detectedBills.filter(b => b.selected).length} Reminders
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Gmail Smart Sync
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Content */}
        {currentStep === 'connect' && renderConnectStep()}
        {currentStep === 'analyzing' && renderAnalyzingStep()}
        {currentStep === 'results' && renderResultsStep()}
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
  stepContent: {
    flexGrow: 1,
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  gmailLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  settingsContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  disclaimer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  analyzingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  analyzingContent: {
    alignItems: 'center',
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressFill: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  progressInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  analyzingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  analyzingStatus: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  analysisSteps: {
    alignItems: 'flex-start',
  },
  analysisStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepText: {
    fontSize: 14,
  },
  resultsHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultsSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  billsList: {
    marginBottom: 24,
  },
  billItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  billItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  billCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  billInfo: {
    flex: 1,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  billMerchant: {
    fontSize: 14,
    marginBottom: 2,
  },
  billEmail: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  billItemRight: {
    alignItems: 'flex-end',
  },
  billAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  confidenceContainer: {
    alignItems: 'flex-end',
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  summaryContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  selectAllButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectAllText: {
    fontSize: 16,
    fontWeight: '500',
  },
  createButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});