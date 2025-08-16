import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';

const { width: screenWidth } = Dimensions.get('window');

interface DynamicBannerProps {
  scrollY?: Animated.Value;
  onScroll?: (event: any) => void;
  showStats?: boolean;
  statsData?: {
    leftValue: string;
    leftLabel: string;
    rightValue: string;
    rightLabel: string;
  };
  screenType?: 'home' | 'money' | 'reminder';
  onQRScanPress?: () => void;
  onAnalyticsPress?: () => void;
  onNotificationsPress?: () => void;
  onCalendarPress?: () => void;
  onSyncPress?: () => void;
}

const DynamicBanner: React.FC<DynamicBannerProps> = ({
  scrollY,
  showStats = false,
  statsData,
  screenType = 'home',
  onQRScanPress,
  onAnalyticsPress,
  onNotificationsPress,
  onCalendarPress,
  onSyncPress,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();

  // Get simple time-based greeting
  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
      return 'Good Morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good Afternoon';
    } else if (hour >= 17 && hour < 21) {
      return 'Good Evening';
    } else {
      return 'Good Night';
    }
  };

  const greeting = getTimeBasedGreeting();

  // Get icons based on screen type (unique icons for each screen)
  const getScreenIcons = () => {
    switch (screenType) {
      case 'money':
        return [
          { name: 'calendar', onPress: onCalendarPress || (() => console.log('Calendar feature coming soon')), color: '#F59E0B' },
          { name: 'analytics', onPress: onAnalyticsPress || (() => console.log('Analytics feature coming soon')), color: '#10B981' },
        ];
      case 'reminder':
        return [
          { name: 'sync', onPress: onSyncPress || (() => console.log('Sync pressed')), color: '#3B82F6' },
          { name: 'notifications', onPress: onNotificationsPress || (() => console.log('Notifications feature coming soon')), color: '#EC4899' },
        ];
      default: // home
        const icons = [
          { name: 'qrCode', onPress: onQRScanPress || (() => console.log('QR Scanner feature coming soon')), color: '#8B5CF6' },
          { name: 'notifications', onPress: onNotificationsPress || (() => console.log('Notifications feature coming soon')), color: '#EF4444' },
        ];
        
        // Only add analytics if onAnalyticsPress is provided
        if (onAnalyticsPress) {
          icons.splice(1, 0, { name: 'analytics', onPress: onAnalyticsPress, color: '#10B981' });
        }
        
        return icons;
    }
  };

  const screenIcons = getScreenIcons();

  return (
    <View style={styles.container}>
      {/* Compact Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.greetingContainer}>
          <Text style={[styles.greetingText, { color: theme.colors.text }]}>
            {greeting}
          </Text>
          <Text style={[styles.nameText, { color: theme.colors.text }]}>
            {user?.fullName?.split(' ')[0] || 'User'}
          </Text>
        </View>

        {/* Action Icons with colors */}
        <View style={styles.actionContainer}>
          {screenIcons.map((icon, index) => (
            <TouchableOpacity 
              key={index}
              style={[styles.actionButton, { backgroundColor: `${icon.color}15` }]}
              onPress={icon.onPress}
            >
              <Icon name={icon.name as any} size={18} color={icon.color} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Stats Section (if needed) */}
      {showStats && statsData && (
        <View style={styles.statsSection}>
          <View style={[styles.statsCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {statsData.leftValue}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                {statsData.leftLabel}
              </Text>
            </View>
            
            <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {statsData.rightValue}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                {statsData.rightLabel}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: screenWidth,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: 16,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  nameText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  statsSection: {
    marginTop: 16,
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    marginHorizontal: 16,
  },
});

export default DynamicBanner;