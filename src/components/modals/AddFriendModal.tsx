// src/components/modals/AddFriendModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { QRCodeService } from '@/services/qr/QRCodeService';
import { InviteService } from '@/services/payments/PaymentService';

interface AddFriendModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (email: string, method: 'email' | 'sms' | 'whatsapp' | 'qr') => void;
}

export default function AddFriendModal({ visible, onClose, onSubmit }: AddFriendModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [activeMethod, setActiveMethod] = useState<'email' | 'phone' | 'qr'>('email');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', phone: '' });

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setErrors(prev => ({ ...prev, email: 'Email is required' }));
      return false;
    }
    if (!emailRegex.test(email.trim())) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
      return false;
    }
    setErrors(prev => ({ ...prev, email: '' }));
    return true;
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    if (!phone.trim()) {
      setErrors(prev => ({ ...prev, phone: 'Phone number is required' }));
      return false;
    }
    if (!phoneRegex.test(phone.trim())) {
      setErrors(prev => ({ ...prev, phone: 'Please enter a valid phone number' }));
      return false;
    }
    setErrors(prev => ({ ...prev, phone: '' }));
    return true;
  };

  const handleSendEmail = async () => {
    if (!validateEmail(email)) return;
    
    setLoading(true);
    try {
      await onSubmit(email, 'email');
      setEmail('');
      onClose();
    } catch (error) {
      // Error handled in parent component
    } finally {
      setLoading(false);
    }
  };

  const handleSendSMS = async () => {
    if (!validatePhone(phoneNumber)) return;
    
    setLoading(true);
    try {
      const message = InviteService.generateFriendInviteMessage(user?.fullName || 'Friend');
      await InviteService.sendSMSInvite(phoneNumber, message);
      Alert.alert('Success', 'SMS invitation sent!');
      setPhoneNumber('');
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send SMS');
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!validatePhone(phoneNumber)) return;
    
    setLoading(true);
    try {
      const message = InviteService.generateFriendInviteMessage(user?.fullName || 'Friend');
      await InviteService.sendWhatsAppInvite(phoneNumber, message);
      Alert.alert('Success', 'WhatsApp invitation sent!');
      setPhoneNumber('');
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send WhatsApp message');
    } finally {
      setLoading(false);
    }
  };

  const handleShowQR = () => {
    onSubmit('', 'qr');
    onClose();
  };

  const handleScanQR = async () => {
    try {
      // This would open the QR scanner
      // For now, we'll just show an alert
      Alert.alert(
        'QR Scanner',
        'Open camera to scan friend\'s QR code',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Camera', onPress: () => {
            // Navigate to QR scanner screen
            console.log('Open QR scanner');
          }}
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to open QR scanner');
    }
  };

  const renderEmailMethod = () => (
    <View style={styles.methodContent}>
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Email Address</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: errors.email ? theme.colors.error : theme.colors.border,
              color: theme.colors.text,
            }
          ]}
          placeholder="Enter friend's email address"
          placeholderTextColor={theme.colors.textSecondary}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) validateEmail(text);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {errors.email ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {errors.email}
          </Text>
        ) : null}
      </View>

      <Button
        title="Send Friend Request"
        onPress={handleSendEmail}
        loading={loading}
        style={styles.actionButton}
      />

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          Your friend will receive an email invitation to join Spendy and connect with you.
        </Text>
      </View>
    </View>
  );

  const renderPhoneMethod = () => (
    <View style={styles.methodContent}>
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Phone Number</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: errors.phone ? theme.colors.error : theme.colors.border,
              color: theme.colors.text,
            }
          ]}
          placeholder="Enter phone number with country code"
          placeholderTextColor={theme.colors.textSecondary}
          value={phoneNumber}
          onChangeText={(text) => {
            setPhoneNumber(text);
            if (errors.phone) validatePhone(text);
          }}
          keyboardType="phone-pad"
        />
        {errors.phone ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {errors.phone}
          </Text>
        ) : null}
      </View>

      <View style={styles.phoneActions}>
        <Button
          title="Send SMS"
          onPress={handleSendSMS}
          loading={loading}
          style={[styles.phoneButton, { backgroundColor: '#2563EB' }]}
        />
        <Button
          title="Send WhatsApp"
          onPress={handleSendWhatsApp}
          loading={loading}
          style={[styles.phoneButton, { backgroundColor: '#25D366' }]}
        />
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="chatbubble-outline" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          Send invitation via SMS or WhatsApp with a link to download Spendy.
        </Text>
      </View>
    </View>
  );

  const renderQRMethod = () => (
    <View style={styles.methodContent}>
      <View style={styles.qrActions}>
        <TouchableOpacity
          style={[styles.qrCard, { backgroundColor: theme.colors.surface }]}
          onPress={handleShowQR}
        >
          <Ionicons name="qr-code" size={48} color={theme.colors.primary} />
          <Text style={[styles.qrTitle, { color: theme.colors.text }]}>Share Your QR Code</Text>
          <Text style={[styles.qrDescription, { color: theme.colors.textSecondary }]}>
            Generate a QR code for others to scan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.qrCard, { backgroundColor: theme.colors.surface }]}
          onPress={handleScanQR}
        >
          <Ionicons name="camera" size={48} color={theme.colors.secondary} />
          <Text style={[styles.qrTitle, { color: theme.colors.text }]}>Scan QR Code</Text>
          <Text style={[styles.qrDescription, { color: theme.colors.textSecondary }]}>
            Scan a friend's QR code to add them
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="flash-outline" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          QR codes are the fastest way to add friends when you're together in person.
        </Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Add Friend</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Method Selection */}
          <View style={styles.methodSelector}>
            <TouchableOpacity
              style={[
                styles.methodTab,
                activeMethod === 'email' && [styles.activeMethodTab, { backgroundColor: theme.colors.primary + '20' }]
              ]}
              onPress={() => setActiveMethod('email')}
            >
              <Ionicons
                name="mail"
                size={20}
                color={activeMethod === 'email' ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text style={[
                styles.methodTabText,
                { color: activeMethod === 'email' ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                Email
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.methodTab,
                activeMethod === 'phone' && [styles.activeMethodTab, { backgroundColor: theme.colors.primary + '20' }]
              ]}
              onPress={() => setActiveMethod('phone')}
            >
              <Ionicons
                name="phone-portrait"
                size={20}
                color={activeMethod === 'phone' ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text style={[
                styles.methodTabText,
                { color: activeMethod === 'phone' ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                Phone
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.methodTab,
                activeMethod === 'qr' && [styles.activeMethodTab, { backgroundColor: theme.colors.primary + '20' }]
              ]}
              onPress={() => setActiveMethod('qr')}
            >
              <Ionicons
                name="qr-code"
                size={20}
                color={activeMethod === 'qr' ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text style={[
                styles.methodTabText,
                { color: activeMethod === 'qr' ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                QR Code
              </Text>
            </TouchableOpacity>
          </View>

          {/* Method Content */}
          {activeMethod === 'email' && renderEmailMethod()}
          {activeMethod === 'phone' && renderPhoneMethod()}
          {activeMethod === 'qr' && renderQRMethod()}
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
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  methodSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  activeMethodTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  methodTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  methodContent: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  errorText: {
    fontSize: 14,
    marginTop: 6,
  },
  actionButton: {
    marginBottom: 20,
  },
  phoneActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  phoneButton: {
    flex: 1,
  },
  qrActions: {
    gap: 16,
    marginBottom: 20,
  },
  qrCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  qrDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});