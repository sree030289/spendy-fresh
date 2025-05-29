// src/components/modals/GroupChatModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import { Group } from '@/services/firebase/splitting';
import { User } from '@/types';

interface GroupChatModalProps {
  visible: boolean;
  onClose: () => void;
  group: Group | null;
  currentUser: User | null;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'expense' | 'system';
  expenseData?: {
    description: string;
    amount: number;
    currency: string;
  };
}

export default function GroupChatModal({ visible, onClose, group, currentUser }: GroupChatModalProps) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && group) {
      loadChatMessages();
    }
  }, [visible, group]);

  const loadChatMessages = () => {
    // Mock chat messages - in real implementation, this would come from Firebase
    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        userId: 'user1',
        userName: 'Sarah Johnson',
        userAvatar: '👩‍💼',
        message: 'Hey everyone! Just booked the hotel for our weekend trip 🏨',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        type: 'message'
      },
      {
        id: '2',
        userId: 'system',
        userName: 'System',
        message: 'Sarah added an expense',
        timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
        type: 'expense',
        expenseData: {
          description: 'Hotel Booking',
          amount: 480.00,
          currency: 'USD'
        }
      },
      {
        id: '3',
        userId: 'user2',
        userName: 'Mike Chen',
        userAvatar: '👨‍💻',
        message: 'Perfect! I can handle gas and tolls ⛽',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        type: 'message'
      },
      {
        id: '4',
        userId: currentUser?.id || 'currentUser',
        userName: currentUser?.fullName || 'You',
        message: 'Great! I\'ll add tonight\'s dinner expense',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        type: 'message'
      }
    ];

    setMessages(mockMessages);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !group) return;

    setLoading(true);
    try {
      const message: ChatMessage = {
        id: Date.now().toString(),
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.profilePicture,
        message: newMessage.trim(),
        timestamp: new Date(),
        type: 'message'
      };

      setMessages(prev => [...prev, message]);
      setNewMessage('');
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // In real implementation, this would send to Firebase
      // await ChatService.sendMessage(group.id, message);

    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = () => {
    Alert.alert(
      'Add Expense',
      'This would open the Add Expense modal with this group pre-selected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add Expense', onPress: () => {
          // Close chat and open expense modal
          onClose();
          // Navigate to add expense
        }}
      ]
    );
  };

  const handleTakePhoto = () => {
    Alert.alert(
      'Take Photo',
      'This would open the camera to take and share a photo.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Camera', onPress: () => {
          // Implement camera functionality
          console.log('Open camera');
        }}
      ]
    );
  };

  const formatMessageTime = (timestamp: Date): string => {
    const now = new Date();
    const diffInHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isCurrentUser = message.userId === currentUser?.id;
    const isSystem = message.type === 'system' || message.type === 'expense';

    if (message.type === 'expense') {
      return (
        <View key={message.id} style={[styles.systemMessage, { backgroundColor: theme.colors.success + '20' }]}>
          <View style={styles.expenseMessageHeader}>
            <Ionicons name="receipt" size={16} color={theme.colors.success} />
            <Text style={[styles.expenseMessageTitle, { color: theme.colors.success }]}>
              Expense Added
            </Text>
          </View>
          <Text style={[styles.expenseMessageText, { color: theme.colors.text }]}>
            {message.expenseData?.description} - ${message.expenseData?.amount.toFixed(2)}
          </Text>
          <Text style={[styles.expenseMessageSubtext, { color: theme.colors.textSecondary }]}>
            Split equally among {group?.members.length} people
          </Text>
        </View>
      );
    }

    if (isSystem) {
      return (
        <View key={message.id} style={[styles.systemMessage, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.systemMessageText, { color: theme.colors.textSecondary }]}>
            {message.message}
          </Text>
        </View>
      );
    }

    return (
      <View key={message.id} style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        {!isCurrentUser && (
          <View style={styles.messageHeader}>
            <Text style={styles.userAvatar}>{message.userAvatar || '👤'}</Text>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {message.userName}
            </Text>
            <Text style={[styles.messageTime, { color: theme.colors.textSecondary }]}>
              {formatMessageTime(message.timestamp)}
            </Text>
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          {
            backgroundColor: isCurrentUser ? theme.colors.primary : theme.colors.surface,
            alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
            maxWidth: isCurrentUser ? '80%' : '85%',
          }
        ]}>
          <Text style={[
            styles.messageText,
            { color: isCurrentUser ? 'white' : theme.colors.text }
          ]}>
            {message.message}
          </Text>
        </View>

        {isCurrentUser && (
          <Text style={[styles.currentUserTime, { color: theme.colors.textSecondary }]}>
            {formatMessageTime(message.timestamp)}
          </Text>
        )}
      </View>
    );
  };

  if (!group) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.groupAvatar}>{group.avatar}</Text>
            <View>
              <Text style={[styles.groupName, { color: theme.colors.text }]}>
                {group.name}
              </Text>
              <Text style={[styles.groupMembers, { color: theme.colors.textSecondary }]}>
                {group.members.length} members
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.headerAction}>
            <Ionicons name="information-circle" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map(renderMessage)}
          </ScrollView>

          {/* Message Input */}
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.background }]}>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.messageInput,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.text
                  }
                ]}
                placeholder="Type a message..."
                placeholderTextColor={theme.colors.textSecondary}
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}
                onPress={sendMessage}
                disabled={!newMessage.trim() || loading}
              >
                <Ionicons name="send" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.quickAction, { backgroundColor: theme.colors.surface }]}
                onPress={handleAddExpense}
              >
                <Ionicons name="add-circle" size={16} color={theme.colors.primary} />
                <Text style={[styles.quickActionText, { color: theme.colors.primary }]}>
                  Add Expense
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickAction, { backgroundColor: theme.colors.surface }]}
                onPress={handleTakePhoto}
              >
                <Ionicons name="camera" size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.quickActionText, { color: theme.colors.textSecondary }]}>
                  Photo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  groupAvatar: {
    fontSize: 24,
    marginRight: 12,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  groupMembers: {
    fontSize: 12,
    marginTop: 2,
  },
  headerAction: {
    padding: 4,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 16,
  },
  currentUserMessage: {
    alignItems: 'flex-end',
  },
  otherUserMessage: {
    alignItems: 'flex-start',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userAvatar: {
    fontSize: 16,
    marginRight: 8,
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 8,
  },
  messageTime: {
    fontSize: 10,
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '80%',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18,
  },
  currentUserTime: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  systemMessage: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
    maxWidth: '90%',
  },
  systemMessageText: {
    fontSize: 12,
    textAlign: 'center',
  },
  expenseMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  expenseMessageTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  expenseMessageText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  expenseMessageSubtext: {
    fontSize: 11,
    textAlign: 'center',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
  },
});