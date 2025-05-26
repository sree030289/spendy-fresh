import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { COUNTRIES } from '@/constants/countries';

export default function ProfileScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { 
    user, 
    logout, 
    updateUser, 
    updatePassword, 
    uploadProfilePicture, 
    deleteProfilePicture 
  } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && user) {
        setUploadingImage(true);
        try {
          await uploadProfilePicture(result.assets[0].uri);
          Alert.alert('Success', 'Profile picture updated successfully!');
        } catch (error: any) {
          Alert.alert('Error', error.message);
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleDeleteProfilePicture = () => {
    Alert.alert(
      'Delete Profile Picture',
      'Are you sure you want to delete your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploadingImage(true);
              await deleteProfilePicture();
              Alert.alert('Success', 'Profile picture deleted successfully!');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setUploadingImage(false);
            }
          }
        }
      ]
    );
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters long');
      return;
    }

    try {
      setLoading(true);
      await updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
      Alert.alert('Success', 'Password updated successfully!');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCurrencyChange = async (currency: string) => {
    try {
      await updateUser({ currency });
      setShowCurrencyModal(false);
      Alert.alert('Success', 'Currency updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const toggleBiometric = async () => {
    try {
      await updateUser({ biometricEnabled: !user?.biometricEnabled });
      Alert.alert(
        'Success', 
        `Biometric login ${!user?.biometricEnabled ? 'enabled' : 'disabled'} successfully!`
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
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
            try {
              setLoading(true);
              await logout();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          }
        },
      ]
    );
  };

  const ProfileItem = ({ icon, title, value, onPress, rightIcon = "chevron-forward" }: any) => (
    <TouchableOpacity
      style={[styles.profileItem, { backgroundColor: theme.colors.surface }]}
      onPress={onPress}
    >
      <View style={styles.profileItemLeft}>
        <Ionicons name={icon} size={24} color={theme.colors.text} />
        <Text style={[styles.profileItemTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
      </View>
      <View style={styles.profileItemRight}>
        {value && (
          <Text style={[styles.profileItemValue, { color: theme.colors.textSecondary }]}>
            {value}
          </Text>
        )}
        <Ionicons name={rightIcon} size={20} color={theme.colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );

  const PasswordModal = () => (
    <Modal
      visible={showPasswordModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            Change Password
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.modalContent}>
          <TextInput
            style={[styles.modalInput, { 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            placeholder="Current Password"
            placeholderTextColor={theme.colors.textSecondary}
            value={passwordForm.currentPassword}
            onChangeText={(text) => setPasswordForm({ ...passwordForm, currentPassword: text })}
            secureTextEntry
          />

          <TextInput
            style={[styles.modalInput, { 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            placeholder="New Password"
            placeholderTextColor={theme.colors.textSecondary}
            value={passwordForm.newPassword}
            onChangeText={(text) => setPasswordForm({ ...passwordForm, newPassword: text })}
            secureTextEntry
          />

          <TextInput
            style={[styles.modalInput, { 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            placeholder="Confirm New Password"
            placeholderTextColor={theme.colors.textSecondary}
            value={passwordForm.confirmPassword}
            onChangeText={(text) => setPasswordForm({ ...passwordForm, confirmPassword: text })}
            secureTextEntry
          />

          <Button
            title="Update Password"
            onPress={handlePasswordChange}
            loading={loading}
            style={styles.modalButton}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );

  const CurrencyModal = () => (
    <Modal
      visible={showCurrencyModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            Select Currency
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.currencyList}>
          {COUNTRIES.map((country) => (
            <TouchableOpacity
              key={country.code}
              style={[
                styles.currencyItem, 
                { backgroundColor: theme.colors.surface },
                user?.currency === country.currency && { borderColor: theme.colors.primary, borderWidth: 2 }
              ]}
              onPress={() => handleCurrencyChange(country.currency)}
            >
              <Text style={styles.currencyFlag}>{country.flag}</Text>
              <View style={styles.currencyInfo}>
                <Text style={[styles.currencyCode, { color: theme.colors.text }]}>
                  {country.currency}
                </Text>
                <Text style={[styles.currencyName, { color: theme.colors.textSecondary }]}>
                  {country.name}
                </Text>
              </View>
              {user?.currency === country.currency && (
                <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (!user) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
          <View style={styles.profileImageContainer}>
            <TouchableOpacity onPress={handleImagePicker} style={styles.profileImageWrapper}>
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
            
            {user.profilePicture && (
              <TouchableOpacity
                onPress={handleDeleteProfilePicture}
                style={styles.deleteIcon}
              >
                <Ionicons name="trash" size={16} color={theme.colors.error} />
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={[styles.userName, { color: theme.colors.text }]}>
            {user.fullName}
          </Text>
          <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>
            {user.email}
          </Text>
          <Text style={[styles.userMobile, { color: theme.colors.textSecondary }]}>
            {user.mobile}
          </Text>
        </View>

        {/* Profile Items */}
        <View style={styles.profileItems}>
          <ProfileItem
            icon="globe-outline"
            title="Currency"
            value={user.currency}
            onPress={() => setShowCurrencyModal(true)}
          />
          
          <ProfileItem
            icon="lock-closed-outline"
            title="Change Password"
            onPress={() => setShowPasswordModal(true)}
          />
          
          <ProfileItem
            icon="finger-print-outline"
            title="Biometric Login"
            value={user.biometricEnabled ? 'Enabled' : 'Disabled'}
            onPress={toggleBiometric}
            rightIcon={user.biometricEnabled ? "toggle" : "toggle-outline"}
          />
          
          <ProfileItem
            icon="moon-outline"
            title="Dark Mode"
            value={isDark ? 'On' : 'Off'}
            onPress={toggleTheme}
            rightIcon={isDark ? "toggle" : "toggle-outline"}
          />
          
          <ProfileItem
            icon="notifications-outline"
            title="Notifications"
            onPress={() => Alert.alert('Feature', 'Notification settings coming soon')}
          />
          
          <ProfileItem
            icon="help-circle-outline"
            title="Help & Support"
            onPress={() => Alert.alert('Contact', 'Email: support@spendy.com\nPhone: +1 (555) 123-4567')}
          />
          
          <ProfileItem
            icon="information-circle-outline"
            title="About"
            onPress={() => Alert.alert('Spendy', 'Version 1.0.0\nTrack. Split. Pay.')}
          />
        </View>

        {/* Logout Button */}
        <Button
          title="Logout"
          onPress={handleLogout}
          loading={loading}
          variant="outline"
          style={[styles.logoutButton, { borderColor: theme.colors.error }]}
          textStyle={{ color: theme.colors.error }}
        />
      </ScrollView>

      <PasswordModal />
      <CurrencyModal />
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
  profileImageWrapper: {
    position: 'relative',
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
  deleteIcon: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'white',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    marginBottom: 2,
  },
  userMobile: {
    fontSize: 14,
  },
  profileItems: {
    gap: 12,
    marginBottom: 32,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  profileItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileItemTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  profileItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileItemValue: {
    fontSize: 14,
  },
  logoutButton: {
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
    gap: 16,
  },
  modalInput: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  modalButton: {
    marginTop: 16,
  },
  currencyList: {
    flex: 1,
    padding: 20,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  currencyFlag: {
    fontSize: 24,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
  },
  currencyName: {
    fontSize: 14,
  },
});