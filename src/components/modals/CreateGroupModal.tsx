// src/components/modals/CreateGroupModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { Friend, SplittingService } from '@/services/firebase/splitting';
import { InviteService } from '@/services/payments/PaymentService';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (groupData: any) => void;
  friends: Friend[];
}

const GROUP_ICONS = [
  '🏖️', '🏠', '💼', '🎉', '✈️', '🍕', 
  '🎬', '🏋️', '🎵', '📚', '🚗', '💰',
  '🍽️', '🛒', '⚽', '🎮', '🏥', '🎨',
  '📱', '🎯', '🌮', '☕', '🍺', '🎪'
];

export default function CreateGroupModal({ visible, onClose, onSubmit, friends }: CreateGroupModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('🍕');
  const [description, setDescription] = useState('');
const [selectedFriends, setSelectedFriends] = useState<string[]>([]); // Keep this but make it optional
  const [inviteMethod, setInviteMethod] = useState<'none' | 'sms' | 'whatsapp' | 'email'>('none');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ name: '' });

  const validateGroupName = (name: string): boolean => {
    if (!name.trim()) {
      setErrors(prev => ({ ...prev, name: 'Group name is required' }));
      return false;
    }
    if (name.trim().length < 2) {
      setErrors(prev => ({ ...prev, name: 'Group name must be at least 2 characters' }));
      return false;
    }
    setErrors(prev => ({ ...prev, name: '' }));
    return true;
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };


const handleCreateGroup = async () => {
  if (!validateGroupName(groupName)) return;

  setLoading(true);
  try {
    // Pass selected friends to group creation
    const groupData = {
      name: groupName.trim(),
      description: description.trim() || '',
      avatar: selectedIcon,
      currency: user?.currency || 'AUD',
      selectedFriends: selectedFriends, // Include selected friends
      inviteMethod: inviteMethod,
    };

    await onSubmit(groupData);

    // Reset form
    setGroupName('');
    setDescription('');
    setSelectedIcon('🍕');
    setSelectedFriends([]);
    
  } catch (error) {
    // Error handled in parent component
  } finally {
    setLoading(false);
  }
};

  const sendInvitations = async () => {
    const selectedFriendData = friends.filter(friend => 
      selectedFriends.includes(friend.id)
    );

    const inviteMessage = InviteService.generateGroupInviteMessage(
      user?.fullName || 'Someone',
      groupName,
      'TEMP_CODE' // This would be replaced with actual invite code
    );

    const promises = selectedFriendData.map(async (friend) => {
      try {
        if (inviteMethod === 'sms') {
          // Extract phone number from friend data or use email as fallback
          const phoneNumber = friend.friendData.email; // This should be phone number
          await InviteService.sendSMSInvite(phoneNumber, inviteMessage);
        } else if (inviteMethod === 'whatsapp') {
          const phoneNumber = friend.friendData.email; // This should be phone number
          await InviteService.sendWhatsAppInvite(phoneNumber, inviteMessage);
        }
        // Email invitations would be handled by Firebase Functions
      } catch (error) {
        console.error(`Failed to send invitation to ${friend.friendData.fullName}:`, error);
      }
    });

    await Promise.all(promises);
    Alert.alert('Success', 'Group created and invitations sent!');
  };

  const renderIconSelector = () => (
    <View style={styles.iconSelector}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Group Icon</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.iconGrid}>
          {GROUP_ICONS.map((icon) => (
            <TouchableOpacity
              key={icon}
              style={[
                styles.iconOption,
                selectedIcon === icon && [styles.selectedIcon, { borderColor: theme.colors.primary }]
              ]}
              onPress={() => setSelectedIcon(icon)}
            >
              <Text style={styles.iconText}>{icon}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

const renderFriendSelector = () => (
  <View style={styles.friendSelector}>
    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
      Add Friends ({selectedFriends.length} selected)
    </Text>
    
    {friends.length === 0 ? (
      <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
        <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
          No friends added yet
        </Text>
        <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
          Add friends first to invite them to groups
        </Text>
      </View>
    ) : (
      <ScrollView style={styles.friendsList} nestedScrollEnabled>
        {friends.map((friend) => (
          <TouchableOpacity
            key={friend.id}
            style={[styles.friendItem, { backgroundColor: theme.colors.surface }]}
            onPress={() => toggleFriendSelection(friend.id)}
          >
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
                <Text style={[styles.friendEmail, { color: theme.colors.textSecondary }]}>
                  {friend.friendData.email}
                </Text>
                {/* Show status */}
                <Text style={[
                  styles.friendStatus, 
                  { 
                    color: friend.status === 'accepted' ? theme.colors.success : 
                           friend.status === 'invited' ? theme.colors.primary : theme.colors.textSecondary
                  }
                ]}>
                  {friend.status === 'accepted' ? '✓ Friends' : 
                   friend.status === 'invited' ? '📤 Invited' : 
                   friend.status === 'pending' ? '⏳ Pending' : 'Unknown'}
                </Text>
              </View>
            </View>
            <View style={styles.friendSelector}>
              <View style={[
                styles.checkbox,
                selectedFriends.includes(friend.id) && [styles.checkedBox, { backgroundColor: theme.colors.primary }]
              ]}>
                {selectedFriends.includes(friend.id) && (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    )}
  </View>
);

const renderInviteMethod = () => (
  <View style={styles.inviteMethod}>
    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>After Creation</Text>
    
    <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
      <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
      <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
        After creating the group, you'll get an invite code that you can share with friends via SMS, WhatsApp, or QR code.
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
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Create Group</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Group Name */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Group Name *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: errors.name ? theme.colors.error : theme.colors.border,
                  color: theme.colors.text,
                }
              ]}
              placeholder="Enter group name"
              placeholderTextColor={theme.colors.textSecondary}
              value={groupName}
              onChangeText={(text) => {
                setGroupName(text);
                if (errors.name) validateGroupName(text);
              }}
              maxLength={50}
            />
            {errors.name ? (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.name}
              </Text>
            ) : null}
          </View>

          {/* Description */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Description (Optional)</Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                }
              ]}
              placeholder="What's this group for?"
              placeholderTextColor={theme.colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          {/* Icon Selector */}
          {renderIconSelector()}

          {/* Friend Selector */}
          {renderFriendSelector()}

          {/* Invite Method */}
          {renderInviteMethod()}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <View style={styles.footerButtons}>
            <Button
              title="Cancel"
              onPress={onClose}
              variant="outline"
              style={styles.footerButton}
              disabled={loading}
            />
            <Button
              title="Create Group"
              onPress={handleCreateGroup}
              loading={loading}
              style={styles.footerButton}
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
  content: {
    flexGrow: 1,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 24,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 14,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  iconSelector: {
    marginBottom: 24,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 4,
  },
  iconOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedIcon: {
    borderWidth: 2,
  },
  iconText: {
    fontSize: 24,
  },
  friendSelector: {
    marginBottom: 24,
  },
  friendsList: {
    maxHeight: 200,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
  },
  friendEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    borderColor: 'transparent',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  inviteMethod: {
    marginBottom: 24,
  },
  inviteOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inviteOption: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedInviteOption: {
    borderColor: 'transparent',
  },
  inviteOptionText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
  },
  invitePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  invitePreviewText: {
    flex: 1,
    fontSize: 14,
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
    helperText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  friendStatus: {
  fontSize: 11,
  fontWeight: '500',
  marginTop: 2,
},
});