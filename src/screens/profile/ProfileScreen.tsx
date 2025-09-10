// ProfileScreen.tsx - Updated with subscription management
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/common/Icon';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import CurrencyModal from '@/components/modals/CurrencyModal';
import SubscriptionModal from '@/components/modals/SubscriptionModal';
import { TermsPrivacyModal } from '@/components/modals/TermsPrivacyModal';
import { useTour } from '@/components/tour/TourProvider';
import { SubscriptionService, UserSubscription, SubscriptionPlan } from '@/services/SubscriptionService';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, logout, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showTermsPrivacyModal, setShowTermsPrivacyModal] = useState(false);
  const { startTour, resetTour } = useTour();

  // Subscription states
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [usageStats, setUsageStats] = useState<{
    groups: { current: number; limit: number };
    transactions: { current: number; limit: number };
    daysUntilRenewal?: number;
  } | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  // Load subscription data
  useEffect(() => {
    const loadSubscriptionData = async () => {
      if (!user?.id) return;

      try {
        setSubscriptionLoading(true);
        const subscriptionService = SubscriptionService.getInstance();
        const summary = await subscriptionService.getSubscriptionSummary(user.id);
        
        setSubscription(summary.subscription);
        setSubscriptionPlan(summary.plan);
        setUsageStats({
          groups: summary.usage.groups,
          transactions: summary.usage.transactions,
          daysUntilRenewal: summary.daysUntilRenewal
        });
      } catch (error) {
        console.error('Error loading subscription data:', error);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    loadSubscriptionData();
  }, [user?.id]);

  const ProfileItem = ({ 
    icon, 
    title, 
    value, 
    onPress, 
    showChevron = true,
    valueColor,
    badge,
    badgeColor = '#10B981'
  }: {
    icon: string;
    title: string;
    value?: string;
    onPress: () => void;
    showChevron?: boolean;
    valueColor?: string;
    badge?: string;
    badgeColor?: string;
  }) => (
    <TouchableOpacity
      style={[styles.profileItem, { backgroundColor: theme.colors.surface }]}
      onPress={onPress}
    >
      <View style={styles.profileItemLeft}>
        <Icon name={icon as any} size={24} color={theme.colors.text} />
        <View style={styles.profileItemTextContainer}>
          <Text style={[styles.profileItemTitle, { color: theme.colors.text }]}>
            {title}
          </Text>
          {badge && (
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.profileItemRight}>
        {value && (
          <Text style={[
            styles.profileItemValue, 
            { color: valueColor || theme.colors.textSecondary }
          ]}>
            {value}
          </Text>
        )}
        {showChevron && (
          <Icon name="forward" size={20} color={theme.colors.textSecondary}  />
        )}
      </View>
    </TouchableOpacity>
  );

  const handleImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && user) {
      try {
        await updateUser({ profilePicture: result.assets[0].uri });
        Alert.alert('Success', 'Profile picture updated successfully!');
      } catch (error) {
        Alert.alert('Error', 'Failed to update profile picture');
      }
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      // For web, use a simple confirm dialog
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        setLoading(true);
        await logout();
        setLoading(false);
      }
    } else {
      // For mobile, use the native Alert
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Logout', 
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              await logout();
              setLoading(false);
            }
          },
        ]
      );
    }
  };

  const handleChangePassword = () => {
    navigation.navigate('ChangePassword' as never);
  };

  const handleCurrencyUpdate = async (newCurrency: string) => {
    await updateUser({ currency: newCurrency });
  };

  const handleBiometricToggle = async () => {
    if (!user) return;

    try {
      const newBiometricState = !user.biometricEnabled;
      await updateUser({ biometricEnabled: newBiometricState });
      
      Alert.alert(
        'Biometric Authentication',
        `Biometric login has been ${newBiometricState ? 'enabled' : 'disabled'}.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update biometric setting');
    }
  };

  const handleSubscriptionPurchase = async (plan: 'monthly' | 'yearly', promoCode?: string) => {
    try {
      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const subscriptionService = SubscriptionService.getInstance();
      const result = await subscriptionService.processSubscription(user.id, plan, promoCode);

      if (result.success) {
        setShowSubscriptionModal(false);
        Alert.alert('Success! 🎉', result.message, [
          {
            text: 'Awesome!',
            onPress: () => {
              // Reload subscription data
              loadSubscriptionData();
            }
          }
        ]);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Subscription purchase error:', error);
      Alert.alert('Error', 'Failed to process subscription. Please try again.');
    }
  };

  const handleManageSubscription = () => {
    if (subscription?.plan === 'premium') {
      Alert.alert(
        'Manage Subscription',
        'What would you like to do with your subscription?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Cancel Subscription',
            style: 'destructive',
            onPress: handleCancelSubscription
          },
          {
            text: 'View Details',
            onPress: () => setShowSubscriptionModal(true)
          }
        ]
      );
    } else {
      setShowSubscriptionModal(true);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      if (!user?.id) return;

      Alert.alert(
        'Cancel Subscription',
        'Are you sure you want to cancel your premium subscription? You will lose access to premium features at the end of your current billing period.',
        [
          { text: 'Keep Subscription', style: 'cancel' },
          {
            text: 'Cancel Subscription',
            style: 'destructive',
            onPress: async () => {
              const subscriptionService = SubscriptionService.getInstance();
              const result = await subscriptionService.cancelSubscription(user.id);
              
              if (result.success) {
                Alert.alert('Subscription Cancelled', result.message);
                // Reload subscription data
                loadSubscriptionData();
              } else {
                Alert.alert('Error', result.message);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel subscription');
    }
  };

  const loadSubscriptionData = async () => {
    if (!user?.id) return;

    try {
      setSubscriptionLoading(true);
      const subscriptionService = SubscriptionService.getInstance();
      const summary = await subscriptionService.getSubscriptionSummary(user.id);
      
      setSubscription(summary.subscription);
      setSubscriptionPlan(summary.plan);
      setUsageStats({
        groups: summary.usage.groups,
        transactions: summary.usage.transactions,
        daysUntilRenewal: summary.daysUntilRenewal
      });
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const formatUsageText = (current: number, limit: number) => {
    if (limit === -1) return `${current} (Unlimited)`;
    return `${current}/${limit}`;
  };

  const getUsageColor = (current: number, limit: number) => {
    if (limit === -1) return theme.colors.success;
    const percentage = current / limit;
    if (percentage >= 0.9) return theme.colors.error;
    if (percentage >= 0.7) return theme.colors.warning;
    return theme.colors.success;
  };

  if (!user) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profile</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={handleImagePicker} style={styles.profileImageContainer}>
            {user.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImagePlaceholder, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.profileImageText}>
                  {user.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Icon name="camera" size={16} color="white"  />
            </View>
          </TouchableOpacity>
          
          <Text style={[styles.userName, { color: theme.colors.text }]}>
            {user.fullName}
          </Text>
          <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>
            {user.email}
          </Text>
          
          {/* User Stats */}
          <View style={styles.userStats}>
            <View style={[styles.statItem, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.statValue, { color: theme.colors.text }]} numberOfLines={1}>
                {user.country}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Country
              </Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.statValue, { color: theme.colors.text }]} numberOfLines={1}>
                {user.currency}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Currency
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.statItem, styles.mobileStatItem, { backgroundColor: theme.colors.surface }]}
              onPress={() => Alert.alert('Mobile Number', user.mobile)}
            >
              <Text style={[styles.statValue, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="middle">
                {user.mobile}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Mobile (tap to view)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Subscription Status */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Subscription & Usage
          </Text>
          
          {subscriptionLoading ? (
            <View style={[styles.subscriptionCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.subscriptionTitle, { color: theme.colors.text }]}>
                Loading subscription data...
              </Text>
            </View>
          ) : (
            <>
              {/* Subscription Status Card */}
              <View style={[
                styles.subscriptionCard, 
                { 
                  backgroundColor: subscription?.plan === 'premium' ? '#667eea' : theme.colors.surface,
                }
              ]}>
                <View style={styles.subscriptionHeader}>
                  <View>
                    <Text style={[
                      styles.subscriptionTitle, 
                      { color: subscription?.plan === 'premium' ? 'white' : theme.colors.text }
                    ]}>
                      {subscription?.plan === 'premium' ? '⭐ Premium' : '🆓 Free Plan'}
                    </Text>
                    {subscription?.plan === 'premium' && usageStats?.daysUntilRenewal && (
                      <Text style={[styles.subscriptionSubtitle, { color: 'rgba(255,255,255,0.8)' }]}>
                        Renews in {usageStats.daysUntilRenewal} days
                      </Text>
                    )}
                    {subscription?.plan === 'free' && (
                      <Text style={[styles.subscriptionSubtitle, { color: theme.colors.textSecondary }]}>
                        Upgrade to unlock all features
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.manageButton,
                      { 
                        backgroundColor: subscription?.plan === 'premium' ? 'rgba(255,255,255,0.2)' : theme.colors.primary,
                      }
                    ]}
                    onPress={handleManageSubscription}
                  >
                    <Text style={[
                      styles.manageButtonText,
                      { color: subscription?.plan === 'premium' ? 'white' : 'white' }
                    ]}>
                      {subscription?.plan === 'premium' ? 'Manage' : 'Upgrade'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Usage Stats */}
                {usageStats && (
                  <View style={styles.usageStats}>
                    <View style={styles.usageItem}>
                      <Text style={[
                        styles.usageLabel,
                        { color: subscription?.plan === 'premium' ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary }
                      ]}>
                        Groups
                      </Text>
                      <Text style={[
                        styles.usageValue,
                        { 
                          color: subscription?.plan === 'premium' ? 'white' : getUsageColor(usageStats.groups.current, usageStats.groups.limit)
                        }
                      ]}>
                        {formatUsageText(usageStats.groups.current, usageStats.groups.limit)}
                      </Text>
                    </View>
                    <View style={styles.usageItem}>
                      <Text style={[
                        styles.usageLabel,
                        { color: subscription?.plan === 'premium' ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary }
                      ]}>
                        Daily Transactions
                      </Text>
                      <Text style={[
                        styles.usageValue,
                        { 
                          color: subscription?.plan === 'premium' ? 'white' : getUsageColor(usageStats.transactions.current, usageStats.transactions.limit)
                        }
                      ]}>
                        {formatUsageText(usageStats.transactions.current, usageStats.transactions.limit)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {/* Account Settings */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Account Settings
          </Text>
          
          <ProfileItem
            icon="card-outline"
            title="Currency"
            value={user.currency}
            onPress={() => setShowCurrencyModal(true)}
            valueColor={theme.colors.primary}
          />
          
          <ProfileItem
            icon="lock-closed-outline"
            title="Change Password"
            onPress={handleChangePassword}
          />
          
          <ProfileItem
            icon="finger-print-outline"
            title="Biometric Login"
            value={user.biometricEnabled ? 'Enabled' : 'Disabled'}
            onPress={handleBiometricToggle}
            valueColor={user.biometricEnabled ? theme.colors.success : theme.colors.textSecondary}
          />
        </View>

        {/* App Settings */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            App Settings
          </Text>
          
          <ProfileItem
            icon="notifications-outline"
            title="Notifications"
            value="Enabled"
            onPress={() => Alert.alert('Feature', 'Notification settings coming soon')}
          />
          
          <ProfileItem
            icon={isDark ? 'moon' : 'sunny'}
            title="Theme"
            value={isDark ? 'Dark' : 'Light'}
            onPress={toggleTheme}
          />
        </View>

        {/* Support */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Support
          </Text>
          
          <ProfileItem
            icon="play-circle-outline"
            title="App Tour"
            onPress={() => {
              Alert.alert(
                'App Tour',
                'Would you like to see the app tour again? This will show you all the key features of Spendy.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Start Tour', 
                    onPress: () => {
                      console.log('🎯 Profile: User tapped Start Tour button');
                      resetTour();
                      startTour();
                      console.log('✅ Profile: Called resetTour() and startTour()');
                    }
                  }
                ]
              );
            }}
          />
          
          <ProfileItem
            icon="help-circle-outline"
            title="Help & Support"
            onPress={() => Alert.alert('Contact', 'Email: support@spendy.com\nPhone: +1-800-SPENDY')}
          />
          
          <ProfileItem
            icon="document-text-outline"
            title="Legal"
            onPress={() => setShowTermsPrivacyModal(true)}
          />
        </View>

        {/* Account Info */}
        <View style={[styles.accountInfo, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.accountInfoTitle, { color: theme.colors.text }]}>
            Account Created
          </Text>
          <Text style={[styles.accountInfoValue, { color: theme.colors.textSecondary }]}>
            {user.createdAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </View>

        {/* Logout Button */}
        <Button
          title="Logout"
          onPress={handleLogout}
          loading={loading}
          variant="outline"
          style={StyleSheet.flatten([styles.logoutButton, { borderColor: theme.colors.error }])}
          textStyle={{ color: theme.colors.error }}
        />

        {/* App Version */}
        <Text style={[styles.appVersion, { color: theme.colors.textSecondary }]}>
          Spendy v1.0.0
        </Text>
      </ScrollView>

      {/* Currency Modal */}
      <CurrencyModal
        visible={showCurrencyModal}
        currentCurrency={user?.currency || 'USD'}
        onClose={() => setShowCurrencyModal(false)}
        onUpdate={handleCurrencyUpdate}
      />

      {/* Subscription Modal */}
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSubscribe={handleSubscriptionPurchase}
        reason="premium_feature"
        featureName="Premium Subscription"
        canClose={true}
      />

      {/* Terms & Privacy Modal */}
      <TermsPrivacyModal
        visible={showTermsPrivacyModal}
        onClose={() => setShowTermsPrivacyModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tourButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10B981',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    marginBottom: 20,
  },
  userStats: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },
  statItem: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 0,
  },
  mobileStatItem: {
    flex: 1.2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  profileItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileItemTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  profileItemTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  badge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileItemValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  subscriptionCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subscriptionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subscriptionSubtitle: {
    fontSize: 14,
  },
  manageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  usageStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  usageItem: {
    alignItems: 'center',
  },
  usageLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  usageValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  accountInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  accountInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  accountInfoValue: {
    fontSize: 14,
  },
  logoutButton: {
    marginBottom: 16,
  },
  appVersion: {
    fontSize: 12,
    textAlign: 'center',
  },
});