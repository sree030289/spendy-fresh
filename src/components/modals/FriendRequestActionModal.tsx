// src/components/modals/FriendRequestActionModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../common/Icon';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { ApiService } from '@/services/api/ApiService';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FriendRequestData {
  requestId: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderAvatar?: string;
  inviteId?: string; // From QR scan
  message?: string;
  timestamp: number;
}

interface FriendRequestActionModalProps {
  visible: boolean;
  onClose: () => void;
  requestData: FriendRequestData | null;
  onRequestProcessed?: (accepted: boolean, requestId: string) => void;
}

export default function FriendRequestActionModal({
  visible,
  onClose,
  requestData,
  onRequestProcessed,
}: FriendRequestActionModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [animationValue] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.spring(animationValue, {
        toValue: 1,
        tension: 65,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animationValue, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleAccept = async () => {
    if (!requestData || !user?.id || processing) return;

    setProcessing(true);
    try {
      const apiService = ApiService.getInstance();
      
      // Accept friend request
      await apiService.respondToFriendRequest(
        requestData.requestId,
        user.id,
        'accepted'
      );

      // Send notification to sender
      await apiService.sendPushNotification(requestData.senderId, {
        title: 'Friend Request Accepted! 🎉',
        body: `${user.fullName} accepted your friend request`,
        data: {
          type: 'friend_request_accepted',
          senderId: user.id,
          senderName: user.fullName,
          deepLink: `spendy://friends`
        }
      });

      // Call parent callback
      onRequestProcessed?.(true, requestData.requestId);

      // Close modal with success
      onClose();
      
      // Show success message
      setTimeout(() => {
        const { CrossPlatformAlert } = require('@/utils/alertUtils');
        CrossPlatformAlert.alert(
          'Friend Added! 👫',
          `You're now friends with ${requestData.senderName}! You can now split expenses together.`,
          [{ text: 'Great!' }]
        );
      }, 500);

    } catch (error: any) {
      console.error('Failed to accept friend request:', error);
      const { CrossPlatformAlert } = require('@/utils/alertUtils');
      CrossPlatformAlert.alert(
        'Error',
        error.message || 'Failed to accept friend request. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!requestData || !user?.id || processing) return;

    setProcessing(true);
    try {
      const apiService = ApiService.getInstance();
      
      // Decline friend request
      await apiService.respondToFriendRequest(
        requestData.requestId,
        user.id,
        'declined'
      );

      // Send notification to sender
      await apiService.sendPushNotification(requestData.senderId, {
        title: 'Friend Request Response',
        body: `${user.fullName} declined your friend request`,
        data: {
          type: 'friend_request_declined',
          senderId: user.id,
          senderName: user.fullName
        }
      });

      // Call parent callback
      onRequestProcessed?.(false, requestData.requestId);

      // Close modal
      onClose();

    } catch (error: any) {
      console.error('Failed to decline friend request:', error);
      const { CrossPlatformAlert } = require('@/utils/alertUtils');
      CrossPlatformAlert.alert(
        'Error',
        error.message || 'Failed to decline friend request. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setProcessing(false);
    }
  };

  if (!visible || !requestData) {
    return null;
  }

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                {
                  scale: animationValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
                {
                  translateY: animationValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
              opacity: animationValue,
            },
          ]}
        >
          <View style={[styles.modal, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                disabled={processing}
              >
                <Icon name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {/* Friend Icon */}
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.iconBackground}
                >
                  <Icon name="people" size={40} color="white" />
                </LinearGradient>
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Friend Request
              </Text>

              {/* Sender Info */}
              <View style={[styles.senderInfo, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.senderDetails}>
                  <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.avatarText}>
                      {requestData.senderName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.senderText}>
                    <Text style={[styles.senderName, { color: theme.colors.text }]}>
                      {requestData.senderName}
                    </Text>
                    <Text style={[styles.senderEmail, { color: theme.colors.textSecondary }]}>
                      {requestData.senderEmail}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.requestMeta}>
                  <Text style={[styles.timeStamp, { color: theme.colors.textSecondary }]}>
                    {formatTime(requestData.timestamp)}
                  </Text>
                  {requestData.inviteId && (
                    <View style={[styles.qrBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                      <Icon name="camera" size={12} color={theme.colors.primary} />
                      <Text style={[styles.qrBadgeText, { color: theme.colors.primary }]}>
                        QR Invite
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Message */}
              <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
                {requestData.message || 'wants to add you as a friend on Meet-n-Split'}
              </Text>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.declineButton,
                    { 
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border 
                    },
                    processing && { opacity: 0.6 }
                  ]}
                  onPress={handleDecline}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                  ) : (
                    <>
                      <Icon name="close" size={20} color={theme.colors.textSecondary} />
                      <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>
                        Decline
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.acceptButton,
                    processing && { opacity: 0.6 }
                  ]}
                  onPress={handleAccept}
                  disabled={processing}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.acceptGradient}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Icon name="checkmark" size={20} color="white" />
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Benefits */}
              <View style={styles.benefits}>
                <Text style={[styles.benefitsTitle, { color: theme.colors.text }]}>
                  When you become friends:
                </Text>
                <View style={styles.benefitItem}>
                  <Icon name="checkmark" size={16} color="#10B981" />
                  <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
                    Split expenses and bills together
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <Icon name="checkmark" size={16} color="#10B981" />
                  <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
                    Track shared balances and settlements
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: screenWidth * 0.9,
    maxWidth: 400,
    maxHeight: screenHeight * 0.8,
  },
  modal: {
    borderRadius: 24,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 16,
    paddingRight: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  senderInfo: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  senderDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  senderText: {
    flex: 1,
  },
  senderName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  senderEmail: {
    fontSize: 14,
  },
  requestMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeStamp: {
    fontSize: 12,
  },
  qrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  qrBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  actionButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  declineButton: {
    borderWidth: 1,
  },
  acceptButton: {
    overflow: 'hidden',
  },
  acceptGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  benefits: {
    width: '100%',
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  benefitText: {
    fontSize: 14,
    flex: 1,
  },
});