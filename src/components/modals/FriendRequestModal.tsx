import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FriendRequestData {
  id: string;
  fromUserId: string;
  fromUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  message?: string;
  createdAt: Date;
}

interface FriendRequestModalProps {
  visible: boolean;
  onClose: () => void;
  friendRequest: FriendRequestData | null;
  onAccept: (requestId: string) => Promise<void>;
  onDecline: (requestId: string) => Promise<void>;
}

export default function FriendRequestModal({
  visible,
  onClose,
  friendRequest,
  onAccept,
  onDecline,
}: FriendRequestModalProps) {
  const { theme } = useTheme();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // Animate in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible]);

  const handleAccept = async () => {
    if (!friendRequest) return;
    
    try {
      setIsAccepting(true);
      await onAccept(friendRequest.id);
      
      // Show success feedback
      Alert.alert(
        'Friend Request Accepted! 🎉',
        `You are now friends with ${friendRequest.fromUserData.fullName}`,
        [
          {
            text: 'Great!',
            onPress: onClose,
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept friend request');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!friendRequest) return;

    Alert.alert(
      'Decline Friend Request',
      `Are you sure you want to decline the friend request from ${friendRequest.fromUserData.fullName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeclining(true);
              await onDecline(friendRequest.id);
              onClose();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to decline friend request');
            } finally {
              setIsDeclining(false);
            }
          },
        },
      ]
    );
  };

  const formatTimeAgo = (date: Date | any) => {
    // Handle null/undefined dates
    if (!date) {
      return 'Recently';
    }

    let validDate: Date;
    
    try {
      // Handle different date formats
      if (date instanceof Date) {
        validDate = date;
      } else if (typeof date === 'object' && date.toDate && typeof date.toDate === 'function') {
        // Firestore Timestamp object
        validDate = date.toDate();
      } else if (typeof date === 'string' || typeof date === 'number') {
        // String or timestamp
        validDate = new Date(date);
      } else {
        // Fallback for unknown format
        return 'Recently';
      }

      // Validate the date is actually valid
      if (isNaN(validDate.getTime())) {
        return 'Recently';
      }

      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - validDate.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h ago`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    } catch (error) {
      console.warn('Error formatting time ago:', error);
      return 'Recently';
    }
  };

  if (!friendRequest || !shouldRender) return null;

  const handleBackdropPress = () => {
    if (!isAccepting && !isDeclining) {
      onClose();
    }
  };

  return (
    <Modal
      visible={shouldRender}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View 
        style={[
          styles.overlay,
          { opacity: opacityAnim }
        ]}
      >
        <TouchableOpacity 
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.background,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerIcon}>
                <Ionicons name="person-add" size={24} color={theme.colors.primary} />
              </View>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                Friend Request
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                {formatTimeAgo(friendRequest.createdAt)}
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.closeButton, { backgroundColor: theme.colors.surface }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* User Info */}
            <View style={[styles.userCard, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.avatarText}>
                  {friendRequest.fromUserData.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: theme.colors.text }]}>
                  {friendRequest.fromUserData.fullName}
                </Text>
                <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>
                  {friendRequest.fromUserData.email}
                </Text>
              </View>
            </View>

            {/* Message */}
            <View style={[styles.messageCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.messageLabel, { color: theme.colors.textSecondary }]}>
                Message:
              </Text>
              <Text style={[styles.messageText, { color: theme.colors.text }]}>
                {friendRequest.message || `Hi! I'd like to add you as a friend on Spendy so we can split expenses together.`}
              </Text>
            </View>

            {/* Benefits */}
            <View style={styles.benefits}>
              <Text style={[styles.benefitsTitle, { color: theme.colors.text }]}>
                As friends, you can:
              </Text>
              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <Ionicons name="receipt-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
                    Split expenses together
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="people-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
                    Create groups and manage balances
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="card-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
                    Send and receive payments
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.declineButton,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
              ]}
              onPress={handleDecline}
              disabled={isDeclining || isAccepting}
            >
              {isDeclining ? (
                <ActivityIndicator size="small" color={theme.colors.textSecondary} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={20} color={theme.colors.textSecondary} />
                  <Text style={[styles.declineButtonText, { color: theme.colors.textSecondary }]}>
                    Decline
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.acceptButton,
                { backgroundColor: theme.colors.primary }
              ]}
              onPress={handleAccept}
              disabled={isDeclining || isAccepting}
            >
              {isAccepting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 34,
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '500',
  },
  messageCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  benefits: {
    marginBottom: 8,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  benefitsList: {
    gap: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});