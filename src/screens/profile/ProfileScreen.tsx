import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { COUNTRIES } from '@/constants/countries';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, logout, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(user?.currency || 'USD');
  const [currencySearchQuery, setCurrencySearchQuery] = useState('');
  const [currencyUpdateLoading, setCurrencyUpdateLoading] = useState(false);

  // Get unique currencies from countries data
  const currencies = [...new Set(COUNTRIES.map(c => c.currency))].sort();
  
  // Filter currencies based on search
  const filteredCurrencies = currencies.filter(currency => {
    const country = COUNTRIES.find(c => c.currency === currency);
    return currency.toLowerCase().includes(currencySearchQuery.toLowerCase()) ||
           (country && country.name.toLowerCase().includes(currencySearchQuery.toLowerCase()));
  });

  const getCurrencyInfo = (currency: string) => {
    const country = COUNTRIES.find(c => c.currency === currency);
    const countries = COUNTRIES.filter(c => c.currency === currency);
    
    return {
      flag: country?.flag || '💰',
      name: currency,
      description: countries.length === 1 
        ? country.name 
        : `${countries.length} countries`,
      countries: countries.map(c => c.name).join(', ')
    };
  };

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
    // Navigate to change password screen
    navigation.navigate('ChangePassword' as never);
  };

  const openCurrencyModal = () => {
    setSelectedCurrency(user?.currency || 'USD');
    setCurrencySearchQuery('');
    setShowCurrencyModal(true);
  };

  const handleCurrencyUpdate = async () => {
    if (!user || selectedCurrency === user.currency) {
      setShowCurrencyModal(false);
      return;
    }

    setCurrencyUpdateLoading(true);
    try {
      // Update user's currency in the database
      await updateUser({ currency: selectedCurrency });
      
      Alert.alert(
        'Currency Updated!',
        `Your currency has been successfully changed to ${selectedCurrency}. All your future transactions will use this currency.`,
        [
          {
            text: 'OK',
            onPress: () => setShowCurrencyModal(false)
          }
        ]
      );
    } catch (error: any) {
      console.error('Currency update error:', error);
      Alert.alert(
        'Update Failed',
        'Failed to update currency. Please try again.'
      );
    } finally {
      setCurrencyUpdateLoading(false);
    }
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

  const CurrencyItem = ({ currency }: { currency: string }) => {
    const currencyInfo = getCurrencyInfo(currency);
    const isSelected = currency === selectedCurrency;
    const isCurrentUserCurrency = currency === user?.currency;

    return (
      <TouchableOpacity
        style={[
          styles.currencyItem,
          {
            backgroundColor: isSelected 
              ? `${theme.colors.primary}15` 
              : theme.colors.background,
            borderColor: isSelected 
              ? theme.colors.primary 
              : theme.colors.border,
            borderWidth: isSelected ? 2 : 1,
          }
        ]}
        onPress={() => setSelectedCurrency(currency)}
      >
        <View style={styles.currencyLeft}>
          <Text style={styles.currencyFlag}>{currencyInfo.flag}</Text>
          <View style={styles.currencyInfo}>
            <View style={styles.currencyHeader}>
              <Text style={[
                styles.currencyCode, 
                { 
                  color: theme.colors.text,
                  fontWeight: isSelected ? '700' : '600'
                }
              ]}>
                {currencyInfo.name}
              </Text>
              {isCurrentUserCurrency && (
                <View style={[
                  styles.currentBadge,
                  { backgroundColor: theme.colors.success }
                ]}>
                  <Text style={styles.currentBadgeText}>Current</Text>
                </View>
              )}
            </View>
            <Text style={[
              styles.currencyDescription, 
              { color: theme.colors.textSecondary }
            ]}>
              {currencyInfo.description}
            </Text>
          </View>
        </View>
        
        <View style={styles.currencyRight}>
          {isSelected && (
            <Ionicons 
              name="checkmark-circle" 
              size={24} 
              color={theme.colors.primary} 
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const CurrencyModal = () => (
    <Modal
      visible={showCurrencyModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        {/* Modal Header */}
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            Change Currency
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Current Currency Info */}
        <View style={[styles.currentCurrencyCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.currentCurrencyHeader}>
            <Ionicons name="card-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.currentCurrencyTitle, { color: theme.colors.text }]}>
              Current: {user?.currency}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }
            ]}
            placeholder="Search currencies..."
            placeholderTextColor={theme.colors.textSecondary}
            value={currencySearchQuery}
            onChangeText={setCurrencySearchQuery}
            returnKeyType="search"
          />
          <Ionicons
            name="search-outline"
            size={20}
            color={theme.colors.textSecondary}
            style={styles.searchIcon}
          />
        </View>

        {/* Currency List */}
        <ScrollView style={styles.currencyList} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Available Currencies ({filteredCurrencies.length})
          </Text>
          
          {filteredCurrencies.map((currency) => (
            <CurrencyItem key={currency} currency={currency} />
          ))}
          
          {filteredCurrencies.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>
                No currencies found
              </Text>
              <Text style={[styles.emptyStateSubtitle, { color: theme.colors.textSecondary }]}>
                Try searching with a different term
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Update Button */}
        <View style={styles.modalFooter}>
          {selectedCurrency !== user?.currency && (
            <View style={[styles.changeInfo, { backgroundColor: `${theme.colors.primary}10` }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.changeInfoText, { color: theme.colors.primary }]}>
                Changing from {user?.currency} to {selectedCurrency}
              </Text>
            </View>
          )}
          
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              onPress={() => setShowCurrencyModal(false)}
              variant="outline"
              style={styles.modalButton}
            />
            <Button
              title={selectedCurrency === user?.currency ? "No Changes" : "Update Currency"}
              onPress={handleCurrencyUpdate}
              loading={currencyUpdateLoading}
              disabled={selectedCurrency === user?.currency}
              style={styles.modalButton}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
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
          
          {/* User Stats */}
          <View style={styles.userStats}>
            <View style={[styles.statItem, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {user.country}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Country
              </Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {user.currency}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Currency
              </Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {user.mobile}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Mobile
              </Text>
            </View>
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
            onPress={openCurrencyModal}
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
          style={[styles.logoutButton, { borderColor: theme.colors.error }]}
          textStyle={{ color: theme.colors.error }}
        />

        {/* App Version */}
        <Text style={[styles.appVersion, { color: theme.colors.textSecondary }]}>
          Spendy v1.0.0
        </Text>
      </ScrollView>

      {/* Currency Change Modal */}
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
    gap: 12,
    width: '100%',
  },
  statItem: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
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
  
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  currentCurrencyCard: {
    margin: 20,
    padding: 16,
    borderRadius: 12,
  },
  currentCurrencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentCurrencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  searchContainer: {
    position: 'relative',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    paddingHorizontal: 48,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 14,
  },
  currencyList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencyFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
  },
  currentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  currencyDescription: {
    fontSize: 12,
  },
  currencyRight: {
    marginLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalFooter: {
    padding: 20,
    paddingTop: 16,
  },
  changeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  changeInfoText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});