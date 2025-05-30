import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import CurrencyModal from '@/components/modals/CurrencyModal';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, logout, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  const ProfileItem = ({ 
    icon, 
    title, 
    value, 
    onPress, 
    showChevron = true,
    valueColor 
  }: {
    icon: string;
    title: string;
    value?: string;
    onPress: () => void;
    showChevron?: boolean;
    valueColor?: string;
  }) => (
    <TouchableOpacity
      style={[styles.profileItem, { backgroundColor: theme.colors.surface }]}
      onPress={onPress}
    >
      <View style={styles.profileItemLeft}>
        <Ionicons name={icon as any} size={24} color={theme.colors.text} />
        <Text style={[styles.profileItemTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
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
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
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

  if (!user) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profile</Text>
          <TouchableOpacity onPress={toggleTheme}>
            <Ionicons 
              name={isDark ? 'sunny' : 'moon'} 
              size={24} 
              color={theme.colors.text} 
            />
          </TouchableOpacity>
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
              <Ionicons name="camera" size={16} color="white" />
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
          
          <ProfileItem
            icon="language-outline"
            title="Language"
            value="English"
            onPress={() => Alert.alert('Feature', 'Language settings coming soon')}
          />
        </View>

        {/* Support */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Support
          </Text>
          
          <ProfileItem
            icon="help-circle-outline"
            title="Help & Support"
            onPress={() => Alert.alert('Contact', 'Email: support@spendy.com\nPhone: +1-800-SPENDY')}
          />
          
          <ProfileItem
            icon="document-text-outline"
            title="Privacy Policy"
            onPress={() => Alert.alert('Privacy', 'Privacy policy will be available soon')}
          />
          
          <ProfileItem
            icon="shield-checkmark-outline"
            title="Terms of Service"
            onPress={() => Alert.alert('Terms', 'Terms of service will be available soon')}
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
    minWidth: 0, // Allow shrinking
  },
  mobileStatItem: {
    flex: 1.2, // Give mobile section slightly more space
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
  profileItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
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