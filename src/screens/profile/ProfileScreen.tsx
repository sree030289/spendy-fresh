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
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';

export default function ProfileScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, logout, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && user) {
      await updateUser({ profilePicture: result.assets[0].uri });
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

  const ProfileItem = ({ icon, title, value, onPress }: any) => (
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
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );

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
        </View>

        {/* Profile Items */}
        <View style={styles.profileItems}>
          <ProfileItem
            icon="globe-outline"
            title="Currency"
            value={user.currency}
            onPress={() => Alert.alert('Feature', 'Currency change coming soon')}
          />
          
          <ProfileItem
            icon="lock-closed-outline"
            title="Change Password"
            onPress={() => Alert.alert('Feature', 'Password change coming soon')}
          />
          
          <ProfileItem
            icon="finger-print-outline"
            title="Biometric Login"
            value={user.biometricEnabled ? 'Enabled' : 'Disabled'}
            onPress={async () => {
              await updateUser({ biometricEnabled: !user.biometricEnabled });
            }}
          />
          
          <ProfileItem
            icon="notifications-outline"
            title="Notifications"
            onPress={() => Alert.alert('Feature', 'Notification settings coming soon')}
          />
          
          <ProfileItem
            icon="help-circle-outline"
            title="Contact Us"
            onPress={() => Alert.alert('Contact', 'support@spendy.com')}
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
    </SafeAreaView>
  );
}
// ==================== SHARED STYLES ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  keyboardView: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  phoneContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCode: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 100,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  registerButton: {
    marginTop: 8,
  },
  loginButton: {
    marginTop: 8,
  },
  biometricButton: {
    marginTop: 8,
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 16,
    fontWeight: '500',
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  registerLinkText: {
    fontSize: 16,
  },
  resetButton: {
    marginTop: 8,
  },
  backButton: {
    marginTop: 8,
  },
  successContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  redirectText: {
    fontSize: 16,
  },
  placeholder: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  placeholderText: {
    fontSize: 16,
  },
  modal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  biometricContent: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    maxWidth: 300,
    width: '100%',
  },
  biometricTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  biometricSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  biometricButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
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
});
