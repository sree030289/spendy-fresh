// src/components/modals/EnhancedAddModal.tsx
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Icon } from '../common/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface EnhancedAddModalProps {
  visible: boolean;
  onClose: () => void;
  onAddExpenseForSplitting: () => void;
  onAddTransactionForSmartMoney: () => void;
  onAddReminder: () => void;
  onSyncGmail: () => void;
}

export default function EnhancedAddModal({
  visible,
  onClose,
  onAddExpenseForSplitting,
  onAddTransactionForSmartMoney,
  onAddReminder,
  onSyncGmail,
}: EnhancedAddModalProps) {
  const { theme } = useTheme();
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Show modal
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHeight * 0.5, // Half screen
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide modal
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > 10;
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        translateY.setValue(screenHeight * 0.5 + gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 100 || gestureState.vy > 0.5) {
        // Close modal if dragged down significantly
        onClose();
      } else {
        // Snap back to half screen
        Animated.spring(translateY, {
          toValue: screenHeight * 0.5,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  const actionItems = [
    {
      title: 'Add Expense for Splitting',
      subtitle: 'Split bills with friends',
      icon: 'people',
      gradient: [theme.colors.primary, theme.colors.secondary],
      onPress: onAddExpenseForSplitting,
    },
    {
      title: 'Add Transaction for Smart Money',
      subtitle: 'Track personal expenses',
      icon: 'card',
      gradient: ['#10B981', '#059669'],
      onPress: onAddTransactionForSmartMoney,
    },
    {
      title: 'Add Reminder',
      subtitle: 'Set payment reminders',
      icon: 'alarm',
      gradient: ['#F59E0B', '#D97706'],
      onPress: onAddReminder,
    },
    {
      title: 'Sync Gmail',
      subtitle: 'Import email receipts',
      icon: 'mail',
      gradient: ['#EF4444', '#DC2626'],
      onPress: onSyncGmail,
    },
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity }]}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            { 
              backgroundColor: theme.colors.surface,
              transform: [{ translateY }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandle}>
            <View style={[styles.dragIndicator, { backgroundColor: theme.colors.textSecondary }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Quick Actions
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Choose what you'd like to add
            </Text>
          </View>

          {/* Action Items */}
          <View style={styles.actionsContainer}>
            {actionItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionItem}
                onPress={() => {
                  item.onPress();
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={item.gradient}
                  style={styles.actionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.actionContent}>
                    <View style={styles.actionIcon}>
                      <Icon name={item.icon as any} size={24} color="white" />
                    </View>
                    <View style={styles.actionText}>
                      <Text style={styles.actionTitle}>{item.title}</Text>
                      <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
                    </View>
                    <Icon name="forward" size={20} color="rgba(255,255,255,0.7)"  />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.5,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dragHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  actionsContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  actionItem: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    padding: 20,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
});