// src/components/modals/RemindModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import FullscreenModal from '@/components/common/FullscreenModal';
import { Friend } from '@/services/firebase/splitting';
import { getCurrencySymbol } from '@/utils/currency';

interface RemindModalProps {
  visible: boolean;
  onClose: () => void;
  friend: Friend | null;
  balance: number;
  currency: string;
  onSendReminder: (method: 'sms' | 'whatsapp' | 'app', message: string) => Promise<void>;
}

export default function RemindModal({
  visible,
  onClose,
  friend,
  balance,
  currency,
  onSendReminder,
}: RemindModalProps) {
  const { theme } = useTheme();
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!friend) return null;

  const isOwedByFriend = balance > 0;
  const amount = Math.abs(balance);
  const currencySymbol = getCurrencySymbol(currency);

  const defaultMessage = isOwedByFriend
    ? `Hi ${friend.friendData.fullName}! Just a friendly reminder that you owe me ${currencySymbol}${amount.toFixed(2)} for our shared expenses. When you get a chance, could you settle up? Thanks! 😊`
    : `Hi ${friend.friendData.fullName}! I haven't forgotten that I owe you ${currencySymbol}${amount.toFixed(2)}. I'll settle up soon. Thanks for your patience! 😊`;

  const handleSendReminder = async (method: 'sms' | 'whatsapp' | 'app') => {
    try {
      setIsSending(true);
      const message = customMessage.trim() || defaultMessage;
      
      if (method === 'sms') {
        // Send SMS
        const phoneNumber = friend.friendData.mobile;
        if (!phoneNumber) {
          Alert.alert('Error', 'No phone number available for this friend');
          return;
        }
        
        const url = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
        const canOpen = await Linking.canOpenURL(url);
        
        if (canOpen) {
          await Linking.openURL(url);
          await onSendReminder(method, message);
          Alert.alert('Success', 'SMS reminder sent!');
        } else {
          Alert.alert('Error', 'Cannot send SMS on this device');
        }
      } else if (method === 'whatsapp') {
        // Send WhatsApp message
        const phoneNumber = friend.friendData.mobile?.replace(/[^\d]/g, '');
        if (!phoneNumber) {
          Alert.alert('Error', 'No phone number available for this friend');
          return;
        }
        
        const url = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
        const canOpen = await Linking.canOpenURL(url);
        
        if (canOpen) {
          await Linking.openURL(url);
          await onSendReminder(method, message);
          Alert.alert('Success', 'WhatsApp reminder sent!');
        } else {
          Alert.alert('Error', 'WhatsApp is not installed on this device');
        }
      } else if (method === 'app') {
        // Send app notification
        await onSendReminder(method, message);
        Alert.alert('Success', 'In-app reminder sent!');
      }
      
      onClose();
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      Alert.alert('Error', error.message || 'Failed to send reminder');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <FullscreenModal visible={visible} onClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Send Reminder
          </Text>
          <View style={styles.placeholder} />
        </View>

        {/* Friend Info */}
        <View style={[styles.friendInfo, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.avatarText}>
              {friend.friendData.fullName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.friendDetails}>
            <Text style={[styles.friendName, { color: theme.colors.text }]}>
              {friend.friendData.fullName}
            </Text>
            <Text style={[styles.balanceInfo, { 
              color: isOwedByFriend ? theme.colors.success : theme.colors.error 
            }]}>
              {isOwedByFriend 
                ? `Owes you ${currencySymbol}${amount.toFixed(2)}`
                : `You owe ${currencySymbol}${amount.toFixed(2)}`
              }
            </Text>
          </View>
        </View>

        {/* Message Input */}
        <View style={styles.messageSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Customize Message (Optional)
          </Text>
          <TextInput
            style={[styles.messageInput, { 
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderColor: theme.colors.border
            }]}
            placeholder={defaultMessage}
            placeholderTextColor={theme.colors.textSecondary}
            value={customMessage}
            onChangeText={setCustomMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Reminder Options */}
        <View style={styles.optionsSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Choose Reminder Method
          </Text>
          
          <TouchableOpacity
            style={[styles.optionButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => handleSendReminder('sms')}
            disabled={isSending}
          >
            <Ionicons name="chatbubble" size={24} color="#10B981" />
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                Send SMS
              </Text>
              <Text style={[styles.optionSubtitle, { color: theme.colors.textSecondary }]}>
                Send a text message reminder
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => handleSendReminder('whatsapp')}
            disabled={isSending}
          >
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                Send WhatsApp
              </Text>
              <Text style={[styles.optionSubtitle, { color: theme.colors.textSecondary }]}>
                Send a WhatsApp message
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => handleSendReminder('app')}
            disabled={isSending}
          >
            <Ionicons name="notifications" size={24} color="#8B5CF6" />
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                App Notification
              </Text>
              <Text style={[styles.optionSubtitle, { color: theme.colors.textSecondary }]}>
                Send an in-app notification
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {isSending && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
              Sending reminder...
            </Text>
          </View>
        )}
      </View>
    </FullscreenModal>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  balanceInfo: {
    fontSize: 14,
    fontWeight: '500',
  },
  messageSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    height: 100,
    fontSize: 14,
  },
  optionsSection: {
    marginHorizontal: 20,
    flex: 1,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionContent: {
    flex: 1,
    marginLeft: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
});