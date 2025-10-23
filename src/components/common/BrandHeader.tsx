import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Icon } from './Icon';
import { MeetNSplitLogo } from './MeetNSplitLogo';
import { useTheme } from '@/hooks/useTheme';

interface BrandHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  height?: number;
  showProfileButton?: boolean;
  onProfilePress?: () => void;
  profileContent?: React.ReactNode;
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({
  showBackButton = false,
  onBackPress,
  height = 100,
  showProfileButton = false,
  onProfilePress,
  profileContent,
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: theme.colors.brand, height }]}>
      {/* Back Button */}
      {showBackButton && onBackPress && (
        <TouchableOpacity
          onPress={onBackPress}
          style={styles.backButton}
        >
          <Icon name="back" size={24} color="#ffffff" />
        </TouchableOpacity>
      )}

      {/* Centered Logo */}
      <View style={styles.logoContainer}>
        <MeetNSplitLogo size="small" color="light" />
      </View>

      {/* Profile Button */}
      {showProfileButton && (
        <View style={styles.profileContainer}>
          {profileContent}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingTop: 10,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 24,
    padding: 8,
    zIndex: 10,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
});
