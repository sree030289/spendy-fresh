// src/components/modals/JoinGroupModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Icon } from '../common/Icon';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import FullscreenModal from '@/components/common/FullscreenModal';
import { ApiService } from '@/services/api/ApiService';
import { GroupChatService } from '@/services/firebase/GroupChatService';
import { useAuth } from '@/hooks/useAuth';

interface JoinGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (groupId?: string) => void;
  userId: string;
}

export default function JoinGroupModal({
  visible,
  onClose,
  onSuccess,
  userId
}: JoinGroupModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const apiService = ApiService.getInstance();

  const handleJoinGroup = async () => {
    // Validate invite code
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Join the group using the invite code
      const groupId = await apiService.joinGroupByInviteCode(inviteCode.trim().toUpperCase(), userId);

      // Create system message in group chat
      if (user && groupId) {
        try {
          await GroupChatService.createUserJoinedMessage(
            groupId,
            user.id,
            user.fullName
          );
        } catch (chatError) {
          console.error('Failed to create join message in chat:', chatError);
          // Don't fail the join if chat message fails
        }
      }

      Alert.alert(
        'Success! 🎉',
        'You have successfully joined the group! All group members will be automatically added as your friends.',
        [
          {
            text: 'OK',
            onPress: () => {
              setInviteCode('');
              // Pass the groupId to onSuccess so parent can open GroupDetails
              onSuccess(groupId);
              onClose();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Join group error:', error);
      const errorMessage = error.message || 'Failed to join group. Please check the invite code and try again.';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setInviteCode('');
    setError('');
    onClose();
  };

  return (
    <FullscreenModal visible={visible} onClose={handleClose} title="Join Group">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        keyboardVerticalOffset={Platform.select({ ios: 90, android: 0 })}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.content}>
          {/* Icon and Title */}
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + '20' }]}>
              <Icon name="people" size={48} color={theme.colors.primary} />
            </View>
          </View>

          <Text style={[styles.title, { color: theme.colors.text }]}>
            Enter Invite Code
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Ask your friend to share their group invite code. You'll be added to the group and all members will become your friends automatically.
          </Text>

          {/* Invite Code Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              Invite Code
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: error ? theme.colors.error : theme.colors.border,
                  color: theme.colors.text,
                }
              ]}
              placeholder="e.g., ABC123XYZ"
              placeholderTextColor={theme.colors.textSecondary}
              value={inviteCode}
              onChangeText={(text) => {
                const upperText = text.toUpperCase();
                setInviteCode(upperText);
                if (error) setError('');

                // Auto-dismiss keyboard after 8 alphanumeric characters
                if (upperText.length >= 8) {
                  Keyboard.dismiss();
                }
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus={true}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              maxLength={20}
              editable={!loading}
            />
            {error ? (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {error}
              </Text>
            ) : null}
          </View>

          {/* Info Box */}
          <View style={[styles.infoBox, { backgroundColor: theme.colors.surface }]}>
            <Icon name="information-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              When you join a group, all members automatically become your friends. This makes splitting expenses easier!
            </Text>
          </View>

          {/* Join Button */}
          <Button
            title={loading ? 'Joining...' : 'Join Group'}
            onPress={handleJoinGroup}
            loading={loading}
            disabled={loading || !inviteCode.trim()}
            style={styles.joinButton}
          />

          {/* Help Text */}
          <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
            Don't have an invite code? Ask your friend to go to their group settings and share the invite code with you.
          </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </FullscreenModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
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
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
    marginLeft: 4,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  joinButton: {
    marginBottom: 16,
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
