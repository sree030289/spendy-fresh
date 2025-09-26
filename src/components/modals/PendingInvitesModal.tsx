import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { UnifiedInvite } from '../../types';
import { useInviteResponse } from '../../hooks/useRegistrationInviteCheck';

interface PendingInvitesModalProps {
  visible: boolean;
  invites: UnifiedInvite[];
  currentUserId: string;
  onClose: () => void;
  onInviteAccepted?: (inviteId: string) => void;
  onInviteDeclined?: (inviteId: string) => void;
}

const PendingInvitesModal: React.FC<PendingInvitesModalProps> = ({
  visible,
  invites,
  currentUserId,
  onClose,
  onInviteAccepted,
  onInviteDeclined
}) => {
  const { isProcessing, acceptInvite, declineInvite, error } = useInviteResponse();
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);

  const handleAcceptInvite = async (invite: UnifiedInvite) => {
    try {
      setProcessingInviteId(invite.id);
      const success = await acceptInvite(invite.id, currentUserId);
      
      if (success) {
        onInviteAccepted?.(invite.id);
        Alert.alert(
          'Friend Request Accepted! 🎉',
          `You're now friends with ${invite.inviterData.fullName}. Start splitting expenses together!`,
          [{ text: 'Great!', style: 'default' }]
        );
      } else {
        Alert.alert('Error', 'Failed to accept friend request. Please try again.');
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleDeclineInvite = async (invite: UnifiedInvite) => {
    Alert.alert(
      'Decline Friend Request',
      `Are you sure you want to decline ${invite.inviterData.fullName}'s friend request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingInviteId(invite.id);
              const success = await declineInvite(invite.id, currentUserId);
              
              if (success) {
                onInviteDeclined?.(invite.id);
              } else {
                Alert.alert('Error', 'Failed to decline friend request. Please try again.');
              }
            } catch (err) {
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setProcessingInviteId(null);
            }
          }
        }
      ]
    );
  };

  const getInviteTypeLabel = (invite: UnifiedInvite): string => {
    switch (invite.type) {
      case 'SMS_REGISTERED_USER':
        return 'SMS Invite';
      case 'EMAIL_REGISTERED_USER':
        return 'Email Invite';
      case 'SMS_UNREGISTERED_USER':
        return 'SMS Welcome';
      case 'EMAIL_UNREGISTERED_USER':
        return 'Email Welcome';
      default:
        return 'Friend Request';
    }
  };

  const getStatusColor = (status: UnifiedInvite['status']): string => {
    switch (status) {
      case 'PENDING':
        return '#FFA500';
      case 'ACCEPTED':
        return '#4CAF50';
      case 'DECLINED':
        return '#F44336';
      case 'SIGNUP_PENDING':
        return '#2196F3';
      case 'EXPIRED':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderInviteItem = (invite: UnifiedInvite) => {
    const isCurrentlyProcessing = processingInviteId === invite.id;
    const canRespond = invite.status === 'PENDING' && invite.recipientUserId === currentUserId;

    return (
      <View key={invite.id} style={styles.inviteItem}>
        <View style={styles.inviteHeader}>
          <View style={styles.inviterInfo}>
            {invite.inviterData.profilePicture ? (
              <Image
                source={{ uri: invite.inviterData.profilePicture }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {invite.inviterData.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.inviterDetails}>
              <Text style={styles.inviterName}>{invite.inviterData.fullName}</Text>
              <Text style={styles.inviterEmail}>{invite.inviterData.email}</Text>
              <View style={styles.inviteMetadata}>
                <Text style={styles.inviteType}>{getInviteTypeLabel(invite)}</Text>
                <Text style={styles.inviteDate}>• {formatDate(invite.createdAt)}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invite.status) }]}>
            <Text style={styles.statusText}>{invite.status}</Text>
          </View>
        </View>

        {invite.message && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageText}>"{invite.message}"</Text>
          </View>
        )}

        {canRespond && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={() => handleDeclineInvite(invite)}
              disabled={isCurrentlyProcessing}
            >
              {isCurrentlyProcessing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.declineButtonText}>Decline</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleAcceptInvite(invite)}
              disabled={isCurrentlyProcessing}
            >
              {isCurrentlyProcessing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {invite.status === 'ACCEPTED' && invite.acceptedAt && (
          <View style={styles.acceptedInfo}>
            <Text style={styles.acceptedText}>
              ✅ Accepted on {formatDate(invite.acceptedAt)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {invites.length > 0 ? 'Pending Friend Requests' : 'No Pending Requests'}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {invites.length > 0 ? (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              {invites.map(renderInviteItem)}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>📭</Text>
            <Text style={styles.emptyStateTitle}>No Pending Invites</Text>
            <Text style={styles.emptyStateDescription}>
              You're all caught up! When someone sends you a friend request, it will appear here.
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity style={styles.footerButton} onPress={onClose}>
            <Text style={styles.footerButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    paddingTop: 60, // Account for status bar
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666666',
    fontWeight: '300',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  inviteItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  inviterInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
  },
  inviterDetails: {
    flex: 1,
  },
  inviterName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  inviterEmail: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  inviteMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteType: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  inviteDate: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  messageContainer: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  messageText: {
    fontSize: 14,
    color: '#333333',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: '#F44336',
  },
  declineButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptedInfo: {
    backgroundColor: '#E8F5E8',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  acceptedText: {
    color: '#2E7D32',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  footerButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PendingInvitesModal;
