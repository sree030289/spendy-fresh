// src/components/common/FullscreenModal.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '@/hooks/useTheme';

interface FullscreenModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  rightActions?: React.ReactNode;
  showBackButton?: boolean;
}

export default function FullscreenModal({
  visible,
  onClose,
  title,
  children,
  rightActions,
  showBackButton = true,
}: FullscreenModalProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          {showBackButton && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="back" size={24} color={theme.colors.text}  />
            </TouchableOpacity>
          )}
          
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {title}
          </Text>
          
          <View style={styles.rightActions}>
            {rightActions}
          </View>
        </View>
        
        {/* Content */}
        <View style={styles.content}>
          {children}
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginRight: 32, // Compensate for back button width to center title
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 32,
    justifyContent: 'flex-end',
  },
  content: {
    flex: 1,
  },
});