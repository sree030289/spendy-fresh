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
import { requestCameraPermissionsAsync } from 'expo-image-picker';
import * as Contacts from 'expo-contacts';

interface ContactData {
  name: string;
  phoneNumber: string;
}

interface AddFriendModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (email: string, method: 'email' | 'sms' | 'whatsapp' | 'qr', contactData?: ContactData | ContactData[]) => void;
  onOpenQRScanner?: () => void;
}

export default function AddFriendModal({ visible, onClose, onSubmit, onOpenQRScanner }: AddFriendModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [activeMethod, setActiveMethod] = useState<'email' | 'phone' | 'qr'>('email');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<ContactData[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', phone: '', name: '' });
  const [showContactNameInput, setShowContactNameInput] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  const MAX_CONTACTS = 5;

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
      const { status } = await Contacts.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  };

  const addContactToSelection = (name: string, phone: string) => {
    // Ensure we always have a valid name
    const validName = name?.trim() || 'Friend';
    
    const newContact: ContactData = {
      name: validName,
      phoneNumber: phone.trim()
    };

    // Check if contact already exists
    const existingContact = selectedContacts.find(
      c => c.phoneNumber === newContact.phoneNumber
    );

    if (existingContact) {
      Alert.alert(
        'Contact Already Added',
        `${validName} is already in your selection.`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (selectedContacts.length >= MAX_CONTACTS) {
      Alert.alert(
        'Maximum Contacts Reached',
        `You can only select up to ${MAX_CONTACTS} contacts at once.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedContacts(prev => [...prev, newContact]);
    
    // Show success message
    const remaining = MAX_CONTACTS - selectedContacts.length - 1;
    const message = remaining > 0 
      ? `${validName} added! You can add ${remaining} more contact${remaining !== 1 ? 's' : ''}.`
      : `${validName} added! You've reached the maximum of ${MAX_CONTACTS} contacts.`;
    
    Alert.alert('Contact Added', message, [{ text: 'OK' }]);
  };

  const removeContactFromSelection = (index: number) => {
    setSelectedContacts(prev => prev.filter((_, i) => i !== index));
  };

  const addManualContact = () => {
    if (!validatePhone(phoneNumber) || !validateName(contactName)) return;

    const newContact: ContactData = {
      name: contactName.trim(),
      phoneNumber: phoneNumber.trim()
    };

    // Check if contact already exists
    const existingContact = selectedContacts.find(
      c => c.phoneNumber === newContact.phoneNumber
    );

    if (existingContact) {
      Alert.alert(
        'Contact Already Added',
        `A contact with this phone number is already in your selection.`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (selectedContacts.length >= MAX_CONTACTS) {
      Alert.alert(
        'Maximum Contacts Reached',
        `You can only select up to ${MAX_CONTACTS} contacts at once.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedContacts(prev => [...prev, newContact]);
    
    // Clear manual input
    setPhoneNumber('');
    setContactName('');
    setShowManualInput(false);
    setShowContactNameInput(false);
    
    // Show success message
    const remaining = MAX_CONTACTS - selectedContacts.length - 1;
    const message = remaining > 0 
      ? `${newContact.name} added! You can add ${remaining} more contact${remaining !== 1 ? 's' : ''}.`
      : `${newContact.name} added! You've reached the maximum of ${MAX_CONTACTS} contacts.`;
    
    Alert.alert('Contact Added', message, [{ text: 'OK' }]);
  };

  const handlePickContact = async () => {
    try {
      if (selectedContacts.length >= MAX_CONTACTS) {
        Alert.alert(
          'Maximum Contacts Reached',
          `You can only select up to ${MAX_CONTACTS} contacts at once.`,
          [{ text: 'OK' }]
        );
        return;
      }

      setLoading(true);
      
      // Request contacts permission
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

      // Present contact picker
      const contact = await Contacts.presentContactPickerAsync();
      
      if (contact) {
        console.log('Selected contact:', contact);
        
        // Extract phone number
        let selectedPhone = '';
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          // If multiple phone numbers, let user choose
          if (contact.phoneNumbers.length > 1) {
            const phoneOptions = contact.phoneNumbers.map(phone => ({
              text: `${phone.label || 'Phone'}: ${phone.number}`,
              onPress: () => {
                addContactToSelection(contact.name || '', phone.number || '');
              }
            }));
            
            phoneOptions.push({ text: 'Cancel', onPress: () => {} });
            
            Alert.alert(
              'Select Phone Number',
              `${contact.name} has multiple phone numbers. Which one would you like to use?`,
              phoneOptions as any
            );
          } else {
            selectedPhone = contact.phoneNumbers[0].number || '';
          }
        }
        
        // Extract name - ensure we always have a valid name
        const selectedName = contact.name?.trim() || contact.firstName?.trim() || contact.lastName?.trim() || 'Friend';
        
        if (selectedPhone && contact.phoneNumbers?.length === 1) {
          addContactToSelection(selectedName, selectedPhone);
        } else if (!selectedPhone) {
          Alert.alert(
            'No Phone Number',
            `${selectedName || 'This contact'} doesn't have a phone number. Please add them manually or select a different contact.`,
            [{ text: 'OK' }]
          );
        }
      }
      
    } catch (error: any) {
      console.error('Contact picker error:', error);
      
      if (error.code === 'E_CONTACT_CANCELLED') {
        // User cancelled - do nothing
        return;
      }
      
      Alert.alert(
        'Contact Picker Error', 
        'Failed to access contacts. Please enter the contact information manually.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
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
    if (selectedContacts.length === 0) {
      Alert.alert('No Contacts Selected', 'Please select at least one contact to send SMS invitations.');
      return;
    }
    
    setLoading(true);
    try {
      const successfulInvites: string[] = [];
      const failedInvites: string[] = [];

      // Validate all contacts have names before sending
      const validatedContacts = selectedContacts.map(contact => ({
        ...contact,
        name: contact.name?.trim() || 'Friend'
      }));

      for (const contact of validatedContacts) {
        try {
          const message = InviteService.generateFriendInviteMessage(user?.fullName || 'Friend');
          await InviteService.sendSMSInvite(contact.phoneNumber, message);
          successfulInvites.push(contact.name);
        } catch (error) {
          console.error(`Failed to send SMS to ${contact.name}:`, error);
          failedInvites.push(contact.name);
        }
      }

      // Send all contacts to parent for friend creation
      await onSubmit('', 'sms', validatedContacts);
      
      // Show results
      let resultMessage = '';
      if (successfulInvites.length > 0) {
        resultMessage += `SMS invitations sent to: ${successfulInvites.join(', ')}`;
      }
      if (failedInvites.length > 0) {
        if (resultMessage) resultMessage += '\n\n';
        resultMessage += `Failed to send to: ${failedInvites.join(', ')}`;
      }
      
      Alert.alert(
        successfulInvites.length > 0 ? 'Invitations Sent!' : 'Some Invitations Failed',
        resultMessage,
        [{ text: 'OK' }]
      );
      
      // Reset and close
      setSelectedContacts([]);
      resetPhoneForm();
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send SMS invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (selectedContacts.length === 0) {
      Alert.alert('No Contacts Selected', 'Please select at least one contact to send WhatsApp invitations.');
      return;
    }
    
    setLoading(true);
    try {
      const successfulInvites: string[] = [];
      const failedInvites: string[] = [];

      // Validate all contacts have names before sending
      const validatedContacts = selectedContacts.map(contact => ({
        ...contact,
        name: contact.name?.trim() || 'Friend'
      }));

      for (const contact of validatedContacts) {
        try {
          const message = InviteService.generateFriendInviteMessage(user?.fullName || 'Friend');
          await InviteService.sendWhatsAppInvite(contact.phoneNumber, message);
          successfulInvites.push(contact.name);
        } catch (error) {
          console.error(`Failed to send WhatsApp to ${contact.name}:`, error);
          failedInvites.push(contact.name);
        }
      }

      // Send all contacts to parent for friend creation
      await onSubmit('', 'whatsapp', validatedContacts);
      
      // Show results
      let resultMessage = '';
      if (successfulInvites.length > 0) {
        resultMessage += `WhatsApp invitations sent to: ${successfulInvites.join(', ')}`;
      }
      if (failedInvites.length > 0) {
        if (resultMessage) resultMessage += '\n\n';
        resultMessage += `Failed to send to: ${failedInvites.join(', ')}`;
      }
      
      Alert.alert(
        successfulInvites.length > 0 ? 'Invitations Sent!' : 'Some Invitations Failed',
        resultMessage,
        [{ text: 'OK' }]
      );
      
      // Reset and close
      setSelectedContacts([]);
      resetPhoneForm();
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send WhatsApp invitations');
    } finally {
      setLoading(false);
    }
  };

  const resetPhoneForm = () => {
    setPhoneNumber('');
    setContactName('');
    setShowContactNameInput(false);
    setShowManualInput(false);
    setSelectedContacts([]);
  };

  const handleShowQR = () => {
    onSubmit('', 'qr');
    onClose();
  };

  const handleScanQR = async () => {
    try {
      // Check camera permissions first
      const { status } = await requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to scan QR codes',
          [{ text: 'OK' }]
        );
        return;
      }

      // Close this modal and open QR scanner in parent
      onClose();
      if (onOpenQRScanner) {
        onOpenQRScanner();
      }
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
      {/* Selected Contacts Display */}
      {selectedContacts.length > 0 && (
        <View style={styles.selectedContactsContainer}>
          <View style={styles.selectedContactsHeader}>
            <Text style={[styles.selectedContactsTitle, { color: theme.colors.text }]}>
              Selected Contacts ({selectedContacts.length}/{MAX_CONTACTS})
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedContacts([])}
              style={styles.clearAllButton}
            >
              <Text style={[styles.clearAllText, { color: theme.colors.primary }]}>Clear All</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedContactsList}>
            {selectedContacts.map((contact, index) => (
              <View key={index} style={[styles.selectedContactChip, { backgroundColor: theme.colors.primary + '15' }]}>
                <View style={styles.selectedContactInfo}>
                  <Text style={[styles.selectedContactName, { color: theme.colors.text }]} numberOfLines={1}>
                    {contact.name}
                  </Text>
                  <Text style={[styles.selectedContactPhone, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {contact.phoneNumber}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeContactFromSelection(index)}
                  style={styles.removeContactButton}
                >
                  <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Contact Picker Button */}
      <TouchableOpacity
        style={[
          styles.contactPickerButton, 
          { 
            backgroundColor: theme.colors.surface,
            opacity: selectedContacts.length >= MAX_CONTACTS ? 0.5 : 1
          }
        ]}
        onPress={handlePickContact}
        disabled={loading || selectedContacts.length >= MAX_CONTACTS}
      >
        <Ionicons name="people" size={24} color={theme.colors.primary} />
        <Text style={[styles.contactPickerText, { color: theme.colors.text }]}>
          {loading ? 'Loading...' : 
           selectedContacts.length >= MAX_CONTACTS ? `Maximum ${MAX_CONTACTS} contacts selected` :
           `Pick from Contacts (${selectedContacts.length}/${MAX_CONTACTS})`}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
        <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>or</Text>
        <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
      </View>

      {/* Manual Contact Entry */}
      {!showManualInput && selectedContacts.length < MAX_CONTACTS && (
        <TouchableOpacity
          style={[styles.manualEntryButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => setShowManualInput(true)}
        >
          <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
          <Text style={[styles.manualEntryText, { color: theme.colors.text }]}>
            Add Contact Manually
          </Text>
        </TouchableOpacity>
      )}

      {/* Manual Input Form */}
      {showManualInput && (
        <View style={styles.manualInputContainer}>
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

          <View style={styles.manualInputActions}>
            <TouchableOpacity
              style={[styles.cancelManualButton, { borderColor: theme.colors.border }]}
              onPress={() => {
                setShowManualInput(false);
                setPhoneNumber('');
                setContactName('');
                setErrors({ email: '', phone: '', name: '' });
              }}
            >
              <Text style={[styles.cancelManualText, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.addManualButton, { backgroundColor: theme.colors.primary }]}
              onPress={addManualContact}
              disabled={!phoneNumber.trim() || !contactName.trim()}
            >
              <Text style={styles.addManualText}>Add Contact</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      {selectedContacts.length > 0 && (
        <View style={styles.phoneActions}>
          <Button
            title={`Send SMS (${selectedContacts.length})`}
            onPress={handleSendSMS}
            loading={loading}
            style={StyleSheet.flatten([styles.phoneButton, { backgroundColor: '#2563EB' }])}
          />
          <Button
            title={`Send WhatsApp (${selectedContacts.length})`}
            onPress={handleSendWhatsApp}
            loading={loading}
            style={StyleSheet.flatten([styles.phoneButton, { backgroundColor: '#25D366' }])}
          />
        </View>
      )}

      <View style={styles.infoCard}>
        <Ionicons name="chatbubble-outline" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          {selectedContacts.length > 0 
            ? `Send invitations to ${selectedContacts.length} contact${selectedContacts.length !== 1 ? 's' : ''} via SMS or WhatsApp with a link to download Spendy.`
            : `Select up to ${MAX_CONTACTS} contacts and send invitations via SMS or WhatsApp with a link to download Spendy.`
          }
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
  selectedContactsContainer: {
    marginBottom: 20,
  },
  selectedContactsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedContactsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearAllButton: {
    padding: 4,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedContactsList: {
    flexDirection: 'row',
  },
  selectedContactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 120,
    maxWidth: 160,
  },
  selectedContactInfo: {
    flex: 1,
    marginRight: 8,
  },
  selectedContactName: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedContactPhone: {
    fontSize: 12,
    marginTop: 2,
  },
  removeContactButton: {
    padding: 2,
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
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  manualEntryText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  manualInputContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  manualInputActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelManualButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelManualText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addManualButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addManualText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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