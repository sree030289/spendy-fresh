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
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import CurrencyModal from '@/components/modals/CurrencyModal';
import SubscriptionModal from '@/components/modals/SubscriptionModal';
import { TermsPrivacyModal } from '@/components/modals/TermsPrivacyModal';

import { SubscriptionService, UserSubscription, SubscriptionPlan } from '@/services/SubscriptionService';
// Firebase Storage not supported in React Native - use API backend for uploads
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
// import { storage } from '@/services/firebase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PhoneNumberService } from '@/services/invite/PhoneNumberService';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, logout, updateUser, uploadProfilePicture } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showTermsPrivacyModal, setShowTermsPrivacyModal] = useState(false);
  const [cachedProfilePicture, setCachedProfilePicture] = useState<string | null>(null);
  const [imageRefreshKey, setImageRefreshKey] = useState(0);


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

  // Load cached profile picture
  useEffect(() => {
    const loadCachedProfilePicture = async () => {
      console.log('🔄 Loading cached profile picture...', {
        hasUserId: !!user?.id,
        hasProfilePicture: !!user?.profilePicture,
        userId: user?.id,
        profilePicture: user?.profilePicture?.substring(0, 50) + '...'
      });

      if (!user?.id || !user.profilePicture) {
        console.log('🚫 No user ID or profile picture, clearing cached picture');
        setCachedProfilePicture(null);
        return;
      }

      try {
        const cachedUri = await getCachedProfilePicture(user.profilePicture, user.id);
        console.log('✅ Setting cached profile picture:', cachedUri?.substring(0, 50) + '...');
        setCachedProfilePicture(cachedUri);
      } catch (error) {
        console.error('❌ Error loading cached profile picture:', error);
        console.log('🔄 Falling back to remote URL');
        setCachedProfilePicture(user.profilePicture); // Fallback to remote URL
      }
    };

    loadCachedProfilePicture();
  }, [user?.id, user?.profilePicture]);

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

  // Cache profile picture locally for offline viewing
  const cacheProfilePicture = async (imageUri: string, userId: string): Promise<string> => {
    try {
      if (!imageUri || !userId) {
        return imageUri;
      }

      const cacheDir = `${FileSystem.cacheDirectory}profile_pictures/`;
      const cachedImagePath = `${cacheDir}${userId}_profile.jpg`;

      // Ensure cache directory exists
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });

      console.log('💾 Caching profile picture locally...', {
        imageUri: imageUri.substring(0, 100) + '...',
        userId,
        isRemote: imageUri.startsWith('http://') || imageUri.startsWith('https://'),
        cachedImagePath
      });

      // Check if the URI is already a local file or remote URL
      if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
        // Remote URL - download it
        console.log('� Downloading remote image...');
        const downloadResult = await FileSystem.downloadAsync(imageUri, cachedImagePath);
        
        if (downloadResult && downloadResult.status === 200) {
          console.log('✅ Profile picture downloaded and cached:', cachedImagePath);
          
          // Verify the cached file exists
          const fileInfo = await FileSystem.getInfoAsync(cachedImagePath);
          if (fileInfo.exists) {
            console.log('📋 Cached file verified:', {
              size: fileInfo.size,
              uri: fileInfo.uri
            });
            
            // Store the cached path in AsyncStorage for quick access
            await AsyncStorage.setItem(`@cached_profile_${userId}`, cachedImagePath);
            
            return cachedImagePath;
          } else {
            console.warn('⚠️ Cached file does not exist after download');
            return imageUri;
          }
        } else {
          console.warn('⚠️ Failed to download profile picture, using original URL');
          return imageUri;
        }
      } else {
        // Local file - copy it to cache directory
        console.log('📁 Copying local image to cache...');
        await FileSystem.copyAsync({
          from: imageUri,
          to: cachedImagePath
        });
        
        console.log('✅ Profile picture copied and cached:', cachedImagePath);
        
        // Verify the copied file exists
        const fileInfo = await FileSystem.getInfoAsync(cachedImagePath);
        if (fileInfo.exists) {
          console.log('📋 Copied file verified:', {
            size: fileInfo.size,
            uri: fileInfo.uri
          });
          
          // Store the cached path in AsyncStorage for quick access
          await AsyncStorage.setItem(`@cached_profile_${userId}`, cachedImagePath);
          
          return cachedImagePath;
        } else {
          console.warn('⚠️ Copied file does not exist after copy operation');
          return imageUri;
        }
      }
    } catch (error) {
      console.error('❌ Error caching profile picture:', error);
      return imageUri; // Fallback to original URL
    }
  };

  // Get cached profile picture or fallback to remote URL
  const getCachedProfilePicture = async (remoteUri: string, userId: string): Promise<string> => {
    try {
      console.log('🔍 Getting cached profile picture for:', { userId, remoteUri: remoteUri?.substring(0, 50) + '...' });
      
      if (!userId) {
        console.log('🚫 No userId provided, returning remote URI');
        return remoteUri;
      }

      // Check if we have a cached version
      const cachedPath = await AsyncStorage.getItem(`@cached_profile_${userId}`);
      console.log('📋 Cached path from AsyncStorage:', cachedPath);
      
      if (cachedPath) {
        // Verify the cached file still exists
        const fileInfo = await FileSystem.getInfoAsync(cachedPath);
        console.log('📁 File info for cached path:', { 
          exists: fileInfo.exists, 
          size: fileInfo.exists ? (fileInfo as any).size : 'N/A' 
        });
        
        if (fileInfo.exists) {
          console.log('✅ Using cached profile picture:', cachedPath);
          return cachedPath;
        } else {
          console.log('🧹 Cached file doesn\'t exist, clearing cache entry');
          // Clear invalid cache entry
          await AsyncStorage.removeItem(`@cached_profile_${userId}`);
        }
      }

      // No cache or invalid cache, use remote URL and cache it
      if (remoteUri) {
        console.log('🌐 No valid cache, using remote URL and caching in background');
        // Cache in background without blocking UI
        cacheProfilePicture(remoteUri, userId).catch(err => 
          console.warn('⚠️ Background caching failed:', err)
        );
      }

      console.log('📤 Returning remote URI:', remoteUri?.substring(0, 50) + '...');
      return remoteUri;
    } catch (error) {
      console.error('❌ Error getting cached profile picture:', error);
      return remoteUri;
    }
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
      
      // Optimized camera settings for profile pictures
      const cameraOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1] as [number, number],
        quality: 0.8, // Good quality for profile pictures
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
              'Please allow photo library access in Settings > Privacy & Security > Photos > Meet-n-Split.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') }
              ]
            );
            return;
          }
        }

        console.log('✅ Permission granted, launching iOS image picker...');
        
        // Optimized gallery settings for profile pictures  
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true, // Enable editing for better user experience
          aspect: [1, 1] as [number, number], // Square aspect ratio for profile pictures
          quality: 0.8, // Good quality that will be auto-resized if needed
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

  // Profile picture upload to Firebase Storage
  const uploadProfilePictureToFirebase = async (imageUri: string, userId: string): Promise<string> => {
    try {
      console.log('☁️ Starting Firebase Storage upload for profile picture...');
      
      // Get Firebase Storage instance
      const { getFirebaseStorage } = await import('@/services/firebase/config');
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      
      const storage = await getFirebaseStorage();
      console.log('✅ Firebase Storage instance obtained');
      
      // Convert image URI to blob
      console.log('🔄 Converting image to blob...');
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('✅ Image converted to blob:', { size: blob.size, type: blob.type });
      
      // Create storage reference with timestamp for uniqueness
      const timestamp = Date.now();
      const filename = `profile-pictures/${userId}/${timestamp}.jpg`;
      const storageRef = ref(storage, filename);
      console.log('📁 Storage reference created:', filename);
      
      // Upload the blob
      console.log('📤 Uploading to Firebase Storage...');
      const uploadResult = await uploadBytes(storageRef, blob, {
        contentType: 'image/jpeg',
        customMetadata: {
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
        }
      });
      console.log('✅ Upload completed:', uploadResult.metadata.name);
      
      // Get download URL
      console.log('🔗 Getting download URL...');
      const downloadURL = await getDownloadURL(storageRef);
      console.log('✅ Download URL obtained:', downloadURL.substring(0, 50) + '...');
      
      return downloadURL;
    } catch (error: any) {
      console.error('❌ Firebase Storage upload failed:', error);
      throw new Error(`Failed to upload profile picture: ${error.message}`);
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

      console.log('📤 Asset details:', {
        width: firstAsset.width,
        height: firstAsset.height,
        type: firstAsset.type,
        fileSize: firstAsset.fileSize
      });

      // Auto-resize image if it exceeds resolution limits
      const maxResolution = 2048;
      let processedUri = firstAsset.uri;
      
      if (firstAsset.width && firstAsset.height && (firstAsset.width > maxResolution || firstAsset.height > maxResolution)) {
        console.log(`📏 Image resolution too high (${firstAsset.width}x${firstAsset.height}), resizing to max ${maxResolution}...`);
        
        try {
          // Calculate new dimensions maintaining aspect ratio
          const aspectRatio = firstAsset.width / firstAsset.height;
          let newWidth, newHeight;
          
          if (firstAsset.width > firstAsset.height) {
            newWidth = maxResolution;
            newHeight = Math.round(maxResolution / aspectRatio);
          } else {
            newHeight = maxResolution;
            newWidth = Math.round(maxResolution * aspectRatio);
          }
          
          console.log(`🔄 Resizing from ${firstAsset.width}x${firstAsset.height} to ${newWidth}x${newHeight}`);
          
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            firstAsset.uri,
            [
              { 
                resize: { 
                  width: newWidth, 
                  height: newHeight 
                } 
              }
            ],
            {
              compress: 0.8, // Good compression for profile pictures
              format: ImageManipulator.SaveFormat.JPEG,
            }
          );
          
          processedUri = manipulatedImage.uri;
          console.log('✅ Image successfully resized:', {
            originalSize: `${firstAsset.width}x${firstAsset.height}`,
            newSize: `${newWidth}x${newHeight}`,
            originalFileSize: firstAsset.fileSize,
            newUri: manipulatedImage.uri
          });
          
        } catch (manipulatorError) {
          console.error('❌ Image resize failed:', manipulatorError);
          throw new Error('Failed to resize image. Please try a different photo.');
        }
      }
      
      console.log('✅ Image validation passed:', {
        platform: Platform.OS,
        originalSize: firstAsset.width && firstAsset.height ? `${firstAsset.width}x${firstAsset.height}` : 'unknown',
        fileSize: firstAsset.fileSize,
        finalUri: processedUri
      });

      // Use the processed URI (resized if needed) for upload
      const imageUri = processedUri;
      console.log('📤 Final image URI for upload:', imageUri);

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
      
      // Update the profile picture URL in the backend API
      console.log('🔄 Updating user profile via API with Firebase Storage URL...');
      
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
      console.log('📥 API updated user profile with Firebase Storage URL successfully');
      
      // Update local AsyncStorage
      const updatedUser = { 
        ...user, 
        profilePicture: profilePictureUrl, // Ensure we use the Firebase URL
        profileImage: profilePictureUrl,
        updatedAt: new Date() 
      };
      
      await AsyncStorage.setItem('@spendy_user_data', JSON.stringify(updatedUser));
      console.log('📱 Updated local user data with new profile picture');
      
      // Update auth context state immediately to show the image in UI
      // Pass only the updated fields (Partial<User>)
      if (updateUser && typeof updateUser === 'function') {
        await updateUser({
          profilePicture: profilePictureUrl,
          profileImage: profilePictureUrl,
          updatedAt: new Date()
        });
        console.log('🔄 Updated auth context with new profile picture');
      }

      // Cache the profile picture locally and update UI immediately
      try {
        const cachedImagePath = await cacheProfilePicture(profilePictureUrl, user.id);
        console.log('💾 Profile picture cached for offline viewing:', cachedImagePath);
        
        // Update cached profile picture state for immediate UI update
        console.log('🎯 Setting cached profile picture state:', cachedImagePath);
        setCachedProfilePicture(cachedImagePath);
        
        // Force a re-render by updating the key or triggering state change
        console.log('🔄 Profile picture state updated, UI should refresh now');

        // Force image re-render by incrementing refresh key
        setImageRefreshKey(prev => prev + 1);
      } catch (cacheError) {
        console.warn('⚠️ Failed to cache profile picture:', cacheError);
        // Still update UI with remote URL if caching fails
        console.log('🔄 Setting profile picture to remote URL as fallback:', profilePictureUrl);
        setCachedProfilePicture(profilePictureUrl);

        // Force image re-render even on cache failure
        setImageRefreshKey(prev => prev + 1);
      }

      console.log('✅ Profile picture updated successfully!');

      // Clear loading state before showing alert to prevent blank screen
      setLoading(false);

      // Trigger global refresh for friends/groups to show updated profile picture
      try {
        // Notify other components that profile was updated
        if ((global as any).refreshFriendsData) {
          (global as any).refreshFriendsData();
        }
      } catch (refreshError) {
        console.warn('⚠️ Failed to trigger friends refresh:', refreshError);
      }

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
            ? 'Permission denied. Please go to Settings > Privacy & Security > Photos > Meet-n-Split and allow access.'
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

      // Update user setting without showing global loading
      await updateUser({ biometricEnabled: newBiometricState });

      // Show success alert
      Alert.alert(
        'Biometric Authentication',
        `Biometric login has been ${newBiometricState ? 'enabled' : 'disabled'}.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error updating biometric setting:', error);
      Alert.alert('Error', 'Failed to update biometric setting. Please try again.');
    }
  };

  const handleSubscriptionPurchase = async (plan: 'monthly' | 'yearly', promoCode?: string) => {
    try {
      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Use RealPaymentService instead of SubscriptionService for actual purchases
      const RealPaymentService = (await import('@/services/RealPaymentService')).default;
      const paymentService = RealPaymentService.getInstance();
      await paymentService.initialize(user.id);

      const result = await paymentService.purchaseSubscription(plan, promoCode);

      if (result.success) {
        // Update global user state via auth context
        if (updateUser) {
          await updateUser({
            isPremium: true,
            subscriptionStatus: 'premium'
          });
        }

        setShowSubscriptionModal(false);
        Alert.alert('Success! 🎉', 'Welcome to Premium!', [
          {
            text: 'Awesome!',
            onPress: () => {
              loadSubscriptionData();
            }
          }
        ]);
      } else if (!result.userCancelled) {
        Alert.alert('Purchase Failed', result.error || 'Please try again.');
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

  // Debug current state
  console.log('🎨 ProfileScreen render - Current state:', {
    cachedProfilePicture: cachedProfilePicture?.substring(0, 50) + '...',
    userProfilePicture: user.profilePicture?.substring(0, 50) + '...',
    userProfileImage: user.profileImage?.substring(0, 50) + '...',
    hasImage: !!(cachedProfilePicture || user.profilePicture),
    userId: user.id
  });

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
            {(cachedProfilePicture || user.profilePicture) ? (
              <Image
                key={`profile-${imageRefreshKey}`}
                source={{ uri: cachedProfilePicture || user.profilePicture }}
                style={styles.profileImage}
                onLoad={() => {
                  console.log('🖼️ Profile image loaded successfully:', cachedProfilePicture || user.profilePicture);
                }}
                onError={(error) => {
                  console.error('❌ Profile image failed to load:', error.nativeEvent.error);
                  console.log('🔄 Falling back to initials for URI:', cachedProfilePicture || user.profilePicture);
                  // Force fallback to initials by clearing the cached picture
                  setCachedProfilePicture(null);
                }}
              />
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
              onPress={() => {
                if (user.mobile && user.mobile.trim()) {
                  const formattedNumber = PhoneNumberService.format(user.mobile);
                  Alert.alert('Mobile Number', formattedNumber);
                } else {
                  Alert.alert(
                    'Mobile Number',
                    'No mobile number set. You can update your mobile number by contacting support.',
                    [
                      { text: 'OK', style: 'cancel' },
                      {
                        text: 'Contact Support',
                        onPress: () => Alert.alert('Contact', 'Email: admin@meetnsplit.com\nPhone: +1-800-MEETNSPLIT')
                      }
                    ]
                  );
                }
              }}
            >
              <Text style={[styles.statValue, { color: user.mobile && user.mobile.trim() ? theme.colors.text : theme.colors.textSecondary }]} numberOfLines={1} ellipsizeMode="middle">
                {user.mobile && user.mobile.trim() ? PhoneNumberService.format(user.mobile) : 'Not set'}
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
            icon="help-circle-outline"
            title="Help & Support"
            onPress={() => Alert.alert('Contact', 'Email: admin@meetnsplit.com\nPhone: +1-800-MEETNSPLIT')}
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
          Meet-n-Split v1.0.0
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