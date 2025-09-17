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
  Linking,
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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/services/firebase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, logout, updateUser, uploadProfilePicture } = useAuth();
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
    // Show selection dialog for camera or photo gallery
    Alert.alert(
      'Select Profile Picture',
      'Choose how you want to add your profile picture:',
      [
        {
          text: 'Camera',
          onPress: () => openCamera(),
        },
        {
          text: 'Photo Gallery',
          onPress: () => openGallery(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const openCamera = async () => {
    try {
      console.log('📷 Opening camera...');
      
      // Request camera permissions with detailed logging
      console.log('🔐 Requesting camera permissions...');
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      console.log('🔐 Camera permission result:', permissionResult);
      
      if (permissionResult.status !== 'granted') {
        console.log('❌ Camera permission denied:', permissionResult.status);
        Alert.alert('Permission Required', 'Camera access is required to take photos.');
        return;
      }

      console.log('✅ Camera permission granted, launching camera...');
      
      // Use more conservative settings for iOS
      const cameraOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1] as [number, number],
        quality: 0.7, // Higher quality for better compatibility
        exif: false, // Disable EXIF data to improve performance
        base64: false, // Disable base64 encoding for better performance
      };

      console.log('📷 Camera options:', cameraOptions);
      
      const result = await ImagePicker.launchCameraAsync(cameraOptions);
      console.log('📷 Camera result:', {
        canceled: result.canceled,
        assetsLength: result.assets?.length,
        firstAssetUri: result.assets?.[0]?.uri
      });

      if (!result.canceled) {
        await processImageResult(result);
      } else {
        console.log('📷 User canceled camera');
      }
    } catch (error: any) {
      console.error('❌ Camera error details:', {
        error,
        message: error?.message,
        stack: error?.stack,
        platform: Platform.OS
      });
      
      Alert.alert(
        'Camera Error', 
        `Failed to open camera: ${error?.message || 'Unknown error'}. Please try again.`
      );
    }
  };

  const openGallery = async () => {
    try {
      console.log('📱 Opening photo gallery for iOS...');
      
      if (Platform.OS === 'ios') {
        // iOS-specific approach with minimal configuration
        console.log('🍎 Using iOS-optimized gallery access...');
        
        // Check permissions first
        const permissionResult = await ImagePicker.getMediaLibraryPermissionsAsync();
        console.log('🔐 Current permissions:', permissionResult.status);
        
        if (permissionResult.status !== 'granted') {
          console.log('🔐 Requesting media library permissions...');
          const requestResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
          console.log('🔐 Permission request result:', requestResult.status);
          
          if (requestResult.status !== 'granted') {
            Alert.alert(
              'Permission Required',
              'Please allow photo library access in Settings > Privacy & Security > Photos > Spendy.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') }
              ]
            );
            return;
          }
        }

        console.log('✅ Permission granted, launching iOS image picker...');
        
        // Ultra-minimal iOS configuration to prevent crashes
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false, // Disable editing on iOS to prevent crashes
          quality: 0.5, // Lower quality for iOS stability
          exif: false,
          base64: false,
        });

        console.log('📤 iOS Image picker result:', result.canceled ? 'cancelled' : 'success');
        if (!result.canceled && result.assets && result.assets[0]) {
          console.log('🖼️ Processing iOS image...');
          await processImageResult(result);
        } else {
          console.log('📱 No image selected on iOS');
        }
      } else {
        // Android approach (keep existing logic)
        console.log('🤖 Using Android gallery access...');
        
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please allow photo library access.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
          await processImageResult(result);
        }
      }
    } catch (error: any) {
      console.error('❌ Gallery error details:', {
        error: error?.toString(),
        message: error?.message,
        platform: Platform.OS,
        stack: error?.stack
      });
      
      // iOS-specific error handling
      if (Platform.OS === 'ios') {
        Alert.alert(
          'Photo Gallery Error', 
          'Unable to access photo gallery. Please try:\n1. Restart the app\n2. Check Settings > Privacy & Security > Photos\n3. Try taking a photo with camera instead'
        );
      } else {
        Alert.alert('Error', 'Failed to open photo gallery. Please try again.');
      }
    }
  };

  // iOS-safe Firebase Storage upload function
  const uploadProfilePictureToFirebase = async (imageUri: string, userId: string): Promise<string> => {
    try {
      console.log('📤 Starting Firebase Storage upload for iOS...');
      console.log('📤 Image URI:', imageUri);
      
      // iOS-specific URI handling with more robust approach
      let processedUri = imageUri;
      if (Platform.OS === 'ios') {
        // Handle different URI formats on iOS
        if (imageUri.startsWith('ph://')) {
          // iOS Photos framework URI - keep as is, expo-image-picker handles conversion
          processedUri = imageUri;
        } else if (!imageUri.startsWith('http') && !imageUri.startsWith('file://')) {
          processedUri = `file://${imageUri}`;
        }
        console.log('📤 Processed iOS URI:', processedUri);
      }
      
      // Create a unique filename with timestamp
      const timestamp = Date.now();
      const filename = `profiles/${userId}/profile_picture_${timestamp}.jpg`;
      const storageRef = ref(storage, filename);
      
      console.log('🔄 Creating upload task for iOS...');
      
      // Try different upload methods for iOS compatibility
      let uploadResult;
      
      if (Platform.OS === 'ios') {
        // Method 1: Try direct URI upload (works better with expo-image-picker on iOS)
        try {
          console.log('🍎 Attempting iOS-optimized upload method...');
          
          // For iOS, we'll use a different approach to handle the image
          const response = await fetch(processedUri);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
          }
          
          // Get the ArrayBuffer instead of blob for iOS compatibility
          console.log('🔄 Converting to ArrayBuffer for iOS...');
          const arrayBuffer = await response.arrayBuffer();
          
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            throw new Error('Invalid or empty image data');
          }
          
          console.log('📊 ArrayBuffer details:', {
            size: arrayBuffer.byteLength,
            sizeKB: Math.round(arrayBuffer.byteLength / 1024),
            sizeMB: Math.round(arrayBuffer.byteLength / (1024 * 1024))
          });
          
          // Convert ArrayBuffer to Uint8Array for Firebase
          const uint8Array = new Uint8Array(arrayBuffer);
          
          console.log('☁️ Uploading ArrayBuffer to Firebase Storage...');
          uploadResult = await uploadBytes(storageRef, uint8Array, {
            contentType: 'image/jpeg',
            customMetadata: {
              'uploaded-by': 'ios-app',
              'upload-timestamp': timestamp.toString(),
              'user-id': userId
            }
          });
          
        } catch (iosError: any) {
          console.warn('⚠️ iOS-optimized method failed, trying fallback:', iosError?.message);
          
          // Fallback: Try with blob method
          const response = await fetch(processedUri);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
          }
          
          const blob = await response.blob();
          if (!blob || blob.size === 0) {
            throw new Error('Invalid or empty image blob');
          }
          
          console.log('☁️ Fallback: Uploading blob to Firebase Storage...');
          uploadResult = await uploadBytes(storageRef, blob, {
            contentType: 'image/jpeg'
          });
        }
      } else {
        // Standard method for other platforms
        const response = await fetch(processedUri);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        uploadResult = await uploadBytes(storageRef, blob);
      }
      
      console.log('✅ Upload completed:', uploadResult.metadata.name);
      
      console.log('🔗 Getting download URL...');
      const downloadURL = await getDownloadURL(storageRef);
      
      if (!downloadURL || typeof downloadURL !== 'string') {
        throw new Error('Failed to get valid download URL');
      }
      
      console.log('✅ Profile picture uploaded successfully:', downloadURL);
      return downloadURL;
      
    } catch (error: any) {
      console.error('❌ Firebase upload error details:', {
        error: error?.toString(),
        message: error?.message,
        name: error?.name,
        platform: Platform.OS,
        imageUri: imageUri?.substring(0, 100) + '...' // Truncate for logging
      });
      
      // Provide iOS-specific error messages
      if (Platform.OS === 'ios') {
        if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
          throw new Error('Network error. Please check your internet connection and try again.');
        } else if (error?.message?.includes('ArrayBuffer') || error?.message?.includes('blob')) {
          throw new Error('Failed to process image. Please try selecting a different photo.');
        } else if (error?.message?.includes('storage') || error?.message?.includes('Firebase')) {
          throw new Error('Upload service is currently unavailable. Please try again later.');
        } else if (error?.message?.includes('timeout')) {
          throw new Error('Upload timed out. Please try again with a smaller image.');
        }
      }
      
      // Generic fallback error
      throw new Error('Failed to upload profile picture. Please try again.');
    }
  };

  const processImageResult = async (result: ImagePicker.ImagePickerResult) => {
    try {
      console.log('🔄 Processing image result (iOS-safe):', {
        canceled: result?.canceled,
        hasAssets: !!result?.assets,
        assetsLength: result?.assets?.length,
        platform: Platform.OS
      });

      if (!result || result.canceled) {
        console.log('📱 Image selection was canceled or invalid');
        return;
      }

      if (!user) {
        console.log('❌ No user logged in');
        Alert.alert('Error', 'Please log in to update profile picture');
        return;
      }

      setLoading(true);
      console.log('📸 Profile picture selected, starting upload process...');
      
      // iOS-specific validation with detailed checks
      if (!result.assets || !Array.isArray(result.assets) || result.assets.length === 0) {
        throw new Error('No image assets found in selection result');
      }

      const firstAsset = result.assets[0];
      if (!firstAsset) {
        throw new Error('First asset is null or undefined');
      }

      if (!firstAsset.uri || typeof firstAsset.uri !== 'string') {
        throw new Error('Invalid or missing image URI');
      }

      const imageUri = firstAsset.uri;
      console.log('📤 Processing image URI (iOS):', imageUri);
      console.log('📤 Asset details:', {
        width: firstAsset.width,
        height: firstAsset.height,
        type: firstAsset.type,
        fileSize: firstAsset.fileSize
      });

      // iOS-specific size and format validation with more conservative limits
      if (Platform.OS === 'ios') {
        // More conservative file size limit for iOS to prevent memory issues
        const maxFileSize = 5 * 1024 * 1024; // 5MB limit
        if (firstAsset.fileSize && firstAsset.fileSize > maxFileSize) {
          const fileSizeMB = Math.round(firstAsset.fileSize / (1024 * 1024));
          throw new Error(`Image file is too large (${fileSizeMB}MB). Please select an image smaller than 5MB.`);
        }
        
        // More conservative resolution limits for iOS
        const maxResolution = 2048; // 2048x2048 max
        if (firstAsset.width && firstAsset.height && (firstAsset.width > maxResolution || firstAsset.height > maxResolution)) {
          throw new Error(`Image resolution is too high (${firstAsset.width}x${firstAsset.height}). Please select an image with maximum 2048x2048 resolution.`);
        }
        
        // Additional iOS memory check
        if (firstAsset.width && firstAsset.height && firstAsset.fileSize) {
          const estimatedMemoryUsage = firstAsset.width * firstAsset.height * 4; // 4 bytes per pixel (RGBA)
          const maxMemoryUsage = 50 * 1024 * 1024; // 50MB memory limit
          if (estimatedMemoryUsage > maxMemoryUsage) {
            throw new Error('Image requires too much memory to process. Please select a smaller image.');
          }
        }
        
        console.log('✅ iOS image validation passed:', {
          width: firstAsset.width,
          height: firstAsset.height,
          fileSize: firstAsset.fileSize,
          fileSizeMB: firstAsset.fileSize ? Math.round(firstAsset.fileSize / (1024 * 1024)) : 'unknown'
        });
      }

      // Start upload process with iOS-safe approach
      console.log('☁️ Starting profile picture update...');
      
      let profilePictureUrl: string;
      
      if (uploadProfilePicture && typeof uploadProfilePicture === 'function') {
        // Use auth context method (if available)
        console.log('📤 Using auth context upload method...');
        try {
          profilePictureUrl = await uploadProfilePicture(imageUri);
        } catch (contextError: any) {
          console.warn('⚠️ Auth context upload failed, falling back to direct method:', contextError?.message);
          // Fallback to direct method if context method fails
          profilePictureUrl = await uploadProfilePictureToFirebase(imageUri, user.id);
        }
      } else {
        // Direct Firebase upload with iOS-optimized timeout
        console.log('☁️ Using direct Firebase upload...');
        const timeoutDuration = Platform.OS === 'ios' ? 45000 : 30000; // Longer timeout for iOS
        
        const uploadPromise = uploadProfilePictureToFirebase(imageUri, user.id);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Upload is taking too long. Please try again with a smaller image.'));
          }, timeoutDuration);
        });
        
        profilePictureUrl = await Promise.race([uploadPromise, timeoutPromise]);
      }
      
      if (!profilePictureUrl || typeof profilePictureUrl !== 'string') {
        throw new Error('Failed to get valid profile picture URL');
      }

      console.log('✅ Profile picture uploaded successfully:', profilePictureUrl);
      
      // For direct Firebase method, we also need to update the API
      if (!uploadProfilePicture || typeof uploadProfilePicture !== 'function') {
        console.log('🔄 Updating user profile via API...');
        
        // Import ApiService and get instance with timeout
        const { ApiService } = await import('@/services/api/ApiService');
        const apiService = ApiService.getInstance();
        
        // Update profile picture via API with timeout
        const apiPromise = apiService.updateUserProfile({
          profilePicture: profilePictureUrl
        });
        const apiTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('API timeout - please try again')), 15000);
        });
        
        await Promise.race([apiPromise, apiTimeoutPromise]);
        console.log('📥 API updated user profile successfully');
      }
      
      // Update local AsyncStorage
      const updatedUser = { 
        ...user, 
        profilePicture: profilePictureUrl, // Ensure we use the Firebase URL
        profileImage: profilePictureUrl,
        updatedAt: new Date() 
      };
      
      await AsyncStorage.setItem('@spendy_user_data', JSON.stringify(updatedUser));
      console.log('📱 Updated local user data with new profile picture');
      
      console.log('✅ Profile picture updated successfully!');
      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error: any) {
      console.error('❌ Failed to process image result:', {
        error,
        message: error?.message,
        stack: error?.stack,
        platform: Platform.OS,
        userExists: !!user
      });
      
      // Provide specific iOS-friendly error messages
      let errorMessage = 'Failed to update profile picture';
      if (error instanceof Error) {
        if (error.message.includes('Firebase') || error.message.includes('storage')) {
          errorMessage = 'Failed to upload to cloud storage. Please check your internet connection.';
        } else if (error.message.includes('Invalid image') || error.message.includes('No image assets') || error.message.includes('URI')) {
          errorMessage = 'Invalid image selected. Please try selecting a different image.';
        } else if (error.message.includes('permission')) {
          errorMessage = Platform.OS === 'ios' 
            ? 'Permission denied. Please go to Settings > Privacy & Security > Photos > Spendy and allow access.'
            : 'Permission denied. Please allow access and try again.';
        } else if (error.message.includes('fetch') || error.message.includes('blob')) {
          errorMessage = 'Failed to process image. Please try taking a new photo or selecting a different image.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Upload timed out. Please try again with a smaller image or check your internet connection.';
        } else if (error.message.includes('too large') || error.message.includes('resolution')) {
          errorMessage = 'Image is too large. Please select a smaller image or take a new photo.';
        } else if (error.message.includes('Memory') || error.message.includes('memory')) {
          errorMessage = Platform.OS === 'ios'
            ? 'Not enough memory. Please close other apps and try again, or restart the app.'
            : 'Not enough memory. Please try again.';
        } else {
          errorMessage = `${error.message || 'Unknown error occurred'}`;
        }
      }
      
      Alert.alert('Profile Update Error', errorMessage);
    } finally {
      setLoading(false);
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
            onPress={() => Alert.alert('Contact', 'Email: support@meetnsplit.com\nPhone: +1-800-MEETNSPLIT')}
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
            {user.createdAt 
              ? (user.createdAt instanceof Date 
                  ? user.createdAt.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : new Date(user.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                )
              : 'Not available'
            }
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