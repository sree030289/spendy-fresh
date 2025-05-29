// Update src/components/modals/GroupChatModal.tsx - Real Chat Implementation

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
import { Group, SplittingService } from '@/services/firebase/splitting';
import { User } from '@/types';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'expense' | 'system';
  expenseData?: {
    id: string;
    description: string;
    amount: number;
    currency: string;
  };
}

interface GroupChatModalProps {
  visible: boolean;
  onClose: () => void;
  group: Group | null;
  currentUser: User | null;
}

export default function GroupChatModal({ visible, onClose, group, currentUser }: GroupChatModalProps) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  // Real-time listener for messages
  useEffect(() => {
    if (!visible || !group?.id) return;

    let unsubscribe: (() => void) | undefined;

    const setupMessageListener = async () => {
      try {
        setInitialLoading(true);
        
        // Get initial messages
        const initialMessages = await SplittingService.getGroupMessages(group.id, 50);
        setMessages(initialMessages);
        
        // Set up real-time listener
        unsubscribe = SplittingService.onGroupMessages(group.id, (newMessages) => {
          setMessages(newMessages);
          // Auto-scroll to bottom when new messages arrive
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        });

      } catch (error) {
        console.error('Setup message listener error:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    setupMessageListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [visible, group?.id]);

  // Auto-scroll to bottom when modal opens
  useEffect(() => {
    if (visible && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 300);
    }
  }, [visible]);

  const sendMessage = async () => {
    const messageText = newMessage.trim();
    if (!messageText || !currentUser || !group) return;

    setLoading(true);
    setNewMessage(''); // Clear input immediately for better UX

    try {
      await SplittingService.sendGroupMessage({
        groupId: group.id,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.profilePicture,
        message: messageText,
        type: 'message'
      });

      // Message will be added automatically via the real-time listener
      
    } catch (error: any) {
      console.error('Send message error:', error);
      Alert.alert('Error', 'Failed to send message');
      setNewMessage(messageText); // Restore message on error
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = () => {
    Alert.alert(
      'Add Expense',
      'This will open the Add Expense modal with this group pre-selected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add Expense', onPress: () => {
          onClose();
          // Navigate to add expense - implement this based on your navigation
        }}
      ]
    );
  };

  const handleTakePhoto = () => {
    Alert.alert(
      'Take Photo',
      'This feature allows you to take and share photos in the group chat.',
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
      return diffInMinutes <= 0 ? 'now' : `${diffInMinutes}m`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays === 1) return 'yesterday';
      if (diffInDays < 7) return `${diffInDays}d`;
      return timestamp.toLocaleDateString();
    }
  };

  const renderMessage = (message: ChatMessage, index: number) => {
    const isCurrentUser = message.userId === currentUser?.id;
    const isSystem = message.type === 'system' || message.type === 'expense';
    
    // Check if we should show the user info (first message from user or different user than previous)
    const prevMessage = messages[index - 1];
    const showUserInfo = !prevMessage || 
                        prevMessage.userId !== message.userId || 
                        prevMessage.type !== 'message' ||
                        (message.timestamp.getTime() - prevMessage.timestamp.getTime()) > 300000; // 5 minutes

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
            Added by {message.userName}
          </Text>
          <Text style={[styles.messageTime, { color: theme.colors.textSecondary }]}>
            {formatMessageTime(message.timestamp)}
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
          <Text style={[styles.messageTime, { color: theme.colors.textSecondary }]}>
            {formatMessageTime(message.timestamp)}
          </Text>
        </View>
      );
    }

    return (
      <View key={message.id} style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        {!isCurrentUser && showUserInfo && (
          <View style={styles.messageHeader}>
            <Text style={styles.userAvatar}>{message.userAvatar || message.userName.charAt(0).toUpperCase()}</Text>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {message.userName}
            </Text>
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          {
            backgroundColor: isCurrentUser ? theme.colors.primary : theme.colors.surface,
            alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            marginTop: showUserInfo && !isCurrentUser ? 8 : 2,
            marginLeft: !isCurrentUser && !showUserInfo ? 44 : 0, // Align with previous messages
          }
        ]}>
          <Text style={[
            styles.messageText,
            { color: isCurrentUser ? 'white' : theme.colors.text }
          ]}>
            {message.message}
          </Text>
        </View>

        <Text style={[
          styles.messageTimeStamp,
          { 
            color: theme.colors.textSecondary,
            textAlign: isCurrentUser ? 'right' : 'left',
            marginLeft: !isCurrentUser && !showUserInfo ? 44 : 0,
          }
        ]}>
          {formatMessageTime(message.timestamp)}
        </Text>
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
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
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

          <TouchableOpacity 
            style={styles.headerAction}
            onPress={() => Alert.alert('Group Info', 'Group details coming soon')}
          >
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
            {initialLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                  Loading messages...
                </Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  Start the conversation!
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                  Send your first message to the group
                </Text>
              </View>
            ) : (
              messages.map((message, index) => renderMessage(message, index))
            )}
          </ScrollView>

          {/* Message Input */}
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
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
                editable={!loading}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton, 
                  { 
                    backgroundColor: newMessage.trim() ? theme.colors.primary : theme.colors.border,
                    opacity: loading ? 0.5 : 1
                  }
                ]}
                onPress={sendMessage}
                disabled={!newMessage.trim() || loading}
              >
                <Ionicons name="send" size={18} color="white" />
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
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageContainer: {
    marginBottom: 12,
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
    fontSize: 14,
    marginRight: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    textAlign: 'center',
    lineHeight: 32,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '80%',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  messageTimeStamp: {
    fontSize: 11,
    marginTop: 4,
  },
  systemMessage: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    maxWidth: '90%',
  },
  systemMessageText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  expenseMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  expenseMessageTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  expenseMessageText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  expenseMessageSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 11,
    textAlign: 'center',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
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
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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