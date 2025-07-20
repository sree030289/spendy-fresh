// src/components/modals/UnifiedActionModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

const { width, height } = Dimensions.get('window');

interface UnifiedActionModalProps {
  visible: boolean;
  onClose: () => void;
  onActionSelect?: (actionId: string) => void;
}

export default function UnifiedActionModal({ visible, onClose, onActionSelect }: UnifiedActionModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  // Loading state
  const [loading, setLoading] = useState(false);
  
  // Animation values
  const translateY = useRef(new Animated.Value(height)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Animation effects
  React.useEffect(() => {
    if (visible) {
      showModal();
    } else {
      hideModal();
    }
  }, [visible]);

  const showModal = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideModal = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: height,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleClose = () => {
    hideModal();
    setTimeout(onClose, 200);
  };

  // Pan gesture for swipe to dismiss
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > 10;
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        translateY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 100 || gestureState.vy > 0.5) {
        handleClose();
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  const handleActionSelect = async (actionId: string) => {
    setLoading(true);
    
    try {
      console.log('🎯 Action selected:', actionId);
      
      // Close the main modal first with animation
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 300,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose();
        
        // Pass action to parent after modal is closed
        setTimeout(() => {
          onActionSelect?.(actionId);
        }, 100);
      });
      
    } catch (error) {
      console.error('Error handling action:', error);
    } finally {
      setLoading(false);
    }
  };

interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  gradient: readonly [string, string];
  color: string;
}

  const actionItems: ActionItem[] = [
    {
      id: 'split-expense',
      title: 'Split Expense',
      subtitle: 'Add expense to share with friends',
      icon: 'people',
      gradient: ['#667eea', '#764ba2'] as const,
      color: '#667eea',
    },
    {
      id: 'smart-expense',
      title: 'Smart Money',
      subtitle: 'AI-powered expense tracking',
      icon: 'sparkles',
      gradient: ['#11998e', '#38ef7d'] as const,
      color: '#11998e',
    },
    {
      id: 'reminder',
      title: 'Bill Reminder',
      subtitle: 'Never miss a payment',
      icon: 'alarm',
      gradient: ['#f093fb', '#f5576c'] as const,
      color: '#f093fb',
    },
    {
      id: 'gmail-sync',
      title: 'Gmail Sync',
      subtitle: 'Auto-detect bills from email',
      icon: 'mail',
      gradient: ['#4facfe', '#00f2fe'] as const,
      color: '#4facfe',
    },
  ];

  if (!visible) return null;

  console.log('🎬 UnifiedActionModal rendering:', {
    visible,
    loading,
    actionItemsCount: actionItems.length
  });

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <Animated.View style={[styles.overlay, { opacity }]}>
          {/* FIXED: Remove BlurView and use proper background overlay */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
          
          {/* Backdrop */}
          <TouchableOpacity 
            style={styles.backdrop}
            activeOpacity={1}
            onPress={handleClose}
          />
          
          {/* Modal Content */}
          <Animated.View 
            style={[
              styles.modalContainer,
              { 
                backgroundColor: theme.colors.background,
                transform: [{ translateY }],
              }
            ]}
            {...panResponder.panHandlers}
          >
            {/* Drag Handle */}
            <View style={styles.dragHandle}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>
            
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  Quick Actions
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                  Choose what you'd like to add
                </Text>
              </View>
              <TouchableOpacity 
                onPress={handleClose}
                style={[styles.closeButton, { backgroundColor: theme.colors.surface }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Action Items */}
            <View style={styles.actionsContainer}>
              {actionItems.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.actionItem,
                    { 
                      backgroundColor: theme.colors.surface,
                      marginBottom: index === actionItems.length - 1 ? 0 : 16,
                    }
                  ]}
                  onPress={() => {
                    console.log('🔥 Button pressed:', item.id, item.title);
                    handleActionSelect(item.id);
                  }}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={item.gradient}
                    style={styles.actionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <View style={styles.actionContent}>
                      <View style={styles.iconContainer}>
                        <Ionicons 
                          name={item.icon as any} 
                          size={24} 
                          color="white" 
                        />
                      </View>
                      
                      <View style={styles.textContainer}>
                        <Text style={styles.actionTitle}>
                          {item.title}
                        </Text>
                        <Text style={styles.actionSubtitle}>
                          {item.subtitle}
                        </Text>
                      </View>
                      
                      <View style={styles.arrowContainer}>
                        <Ionicons 
                          name="chevron-forward" 
                          size={20} 
                          color="rgba(255,255,255,0.8)" 
                        />
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>

            {/* Safe Area Bottom */}
            <View style={styles.safeAreaBottom} />
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    opacity: 0.7,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  actionsContainer: {
    padding: 24,
  },
  actionItem: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionGradient: {
    padding: 20,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  arrowContainer: {
    marginLeft: 8,
  },
  safeAreaBottom: {
    height: 34,
  },
});