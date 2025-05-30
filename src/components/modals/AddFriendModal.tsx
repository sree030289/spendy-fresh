// Enhanced src/components/modals/AddFriendModal.tsx
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
  PermissionsAndroid,
  Platform,
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
  onSubmit: (email: string, method: 'email' | 'sms' | 'whatsapp' | 'qr', contactData?: ContactData) => void;
}

interface ContactData {
  name: string;
  phoneNumber: string;
}

export default function AddFriendModal({ visible, onClose, onSubmit }: AddFriendModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [activeMethod, setActiveMethod] = useState<'email' | 'phone' | 'qr'>('email');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', phone: '', name: '' });
  const [showContactNameInput, setShowContactNameInput] = useState(false);

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

  const validateName = (name: string): boolean => {
    if (!name.trim()) {
      setErrors(prev => ({ ...prev, name: 'Contact name is required' }));
      return false;
    }
    if (name.trim().length < 2) {
      setErrors(prev => ({ ...prev, name: 'Name must be at least 2 characters' }));
      return false;
    }
    setErrors(prev => ({ ...prev, name: '' }));
    return true;
  };

  const requestContactsPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'Contacts Permission',
            message: 'Spendy needs access to your contacts to help you find friends',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true; // iOS handles permissions automatically
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  };

  const handlePickContact = async () => {
    try {
      const hasPermission = await requestContactsPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'We need access to your contacts to help you add friends. Please enable contacts permission in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      // For now, show a placeholder since expo-contacts needs to be installed
      Alert.alert(
        'Contact Picker',
        'Contact picker would open here. For now, please enter the phone number manually.',
        [{ text: 'OK' }]
      );

      // TODO: Implement actual contact picker
      // const { status } = await Contacts.requestPermissionsAsync();
      // if (status === 'granted') {
      //   const contact = await Contacts.presentContactPickerAsync();
      //   if (contact && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      //     setPhoneNumber(contact.phoneNumbers[0].number);
      //     setContactName(contact.name);
      //     setShowContactNameInput(false);
      //   }
      // }
      
    } catch (error) {
      console.error('Contact picker error:', error);
      Alert.alert('Error', 'Failed to access contacts');
    }
  };

  const handlePhoneNumberChange = (text: string) => {
    setPhoneNumber(text);
    // Show name input when phone number is manually entered
    if (text.trim().length > 0 && !contactName) {
      setShowContactNameInput(true);
    } else if (text.trim().length === 0) {
      setShowContactNameInput(false);
      setContactName('');
    }
    if (errors.phone) validatePhone(text);
  };

  const handleSendEmail = async () => {
    if (!validateEmail(email)) return;
    
    setLoading(true);
    try {
      // The duplicate checking is now handled in the parent component
      // and in the SplittingService.sendFriendRequest method
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
    if (showContactNameInput && !validateName(contactName)) return;
    
    setLoading(true);
    try {
      const contactData: ContactData = {
        name: contactName || 'Friend',
        phoneNumber: phoneNumber.trim()
      };

      const message = InviteService.generateFriendInviteMessage(user?.fullName || 'Friend');
      await InviteService.sendSMSInvite(phoneNumber, message);
      
      // Also send contact data to parent for potential friend creation
      await onSubmit('', 'sms', contactData);
      
      Alert.alert('Success', 'SMS invitation sent!');
      resetPhoneForm();
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send SMS');
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!validatePhone(phoneNumber)) return;
    if (showContactNameInput && !validateName(contactName)) return;
    
    setLoading(true);
    try {
      const contactData: ContactData = {
        name: contactName || 'Friend',
        phoneNumber: phoneNumber.trim()
      };

      const message = InviteService.generateFriendInviteMessage(user?.fullName || 'Friend');
      await InviteService.sendWhatsAppInvite(phoneNumber, message);
      
      // Also send contact data to parent for potential friend creation
      await onSubmit('', 'whatsapp', contactData);
      
      Alert.alert('Success', 'WhatsApp invitation sent!');
      resetPhoneForm();
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send WhatsApp message');
    } finally {
      setLoading(false);
    }
  };

  const resetPhoneForm = () => {
    setPhoneNumber('');
    setContactName('');
    setShowContactNameInput(false);
  };

  const handleShowQR = () => {
    onSubmit('', 'qr');
    onClose();
  };

  const handleScanQR = async () => {
    try {
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
      {/* Contact Picker Button */}
      <TouchableOpacity
        style={[styles.contactPickerButton, { backgroundColor: theme.colors.surface }]}
        onPress={handlePickContact}
      >
        <Ionicons name="people" size={24} color={theme.colors.primary} />
        <Text style={[styles.contactPickerText, { color: theme.colors.text }]}>
          Pick from Contacts
        </Text>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
        <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>or</Text>
        <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
      </View>

      {/* Manual Phone Input */}
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
          onChangeText={handlePhoneNumberChange}
          keyboardType="phone-pad"
        />
        {errors.phone ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {errors.phone}
          </Text>
        ) : null}
      </View>

      {/* Contact Name Input (shown when phone is manually entered) */}
      {showContactNameInput && (
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Contact Name</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface,
                borderColor: errors.name ? theme.colors.error : theme.colors.border,
                color: theme.colors.text,
              }
            ]}
            placeholder="Enter your friend's name"
            placeholderTextColor={theme.colors.textSecondary}
            value={contactName}
            onChangeText={(text) => {
              setContactName(text);
              if (errors.name) validateName(text);
            }}
            autoCapitalize="words"
          />
          {errors.name ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {errors.name}
            </Text>
          ) : null}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.phoneActions}>
        <Button
          title="Send SMS"
          onPress={handleSendSMS}
          loading={loading}
          style={[styles.phoneButton, { backgroundColor: '#2563EB' }]}
          disabled={!phoneNumber.trim() || (showContactNameInput && !contactName.trim())}
        />
        <Button
          title="Send WhatsApp"
          onPress={handleSendWhatsApp}
          loading={loading}
          style={[styles.phoneButton, { backgroundColor: '#25D366' }]}
          disabled={!phoneNumber.trim() || (showContactNameInput && !contactName.trim())}
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
  contactPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactPickerText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    paddingHorizontal: 16,
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