// src/services/qr/QRCodeService.ts
import React from 'react';
import QRCode from 'react-native-qrcode-svg';
import { RNCamera } from 'react-native-camera';
import { Linking, Alert, Share } from 'react-native';
import { SplittingService } from '../firebase/splitting';
import { InviteService } from '../payments/PaymentService';

export interface QRData {
  type: 'friend_invite' | 'group_invite' | 'expense_share' | 'payment_request';
  version: string;
  userId?: string;
  groupId?: string;
  expenseId?: string;
  inviteCode?: string;
  userData?: {
    fullName: string;
    email: string;
    profilePicture?: string;
  };
  groupData?: {
    name: string;
    avatar: string;
    memberCount: number;
  };
  timestamp: number;
  expiresAt?: number;
}

export interface QRGenerationOptions {
  size?: number;
  backgroundColor?: string;
  color?: string;
  logo?: string;
  logoSize?: number;
  logoBackgroundColor?: string;
  enableLogo?: boolean;
}

export class QRCodeService {
  
  // Generate QR code for friend invitation
  static generateFriendInviteQR(
    userId: string, 
    userData: { fullName: string; email: string; profilePicture?: string },
    options?: QRGenerationOptions
  ): QRData {
    const qrData: QRData = {
      type: 'friend_invite',
      version: '1.0',
      userId,
      userData,
      timestamp: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // Expires in 7 days
    };
    
    return qrData;
  }
  
  // Generate QR code for group invitation
  static generateGroupInviteQR(
    groupId: string,
    inviteCode: string,
    groupData: { name: string; avatar: string; memberCount: number },
    createdBy: string,
    options?: QRGenerationOptions
  ): QRData {
    const qrData: QRData = {
      type: 'group_invite',
      version: '1.0',
      groupId,
      inviteCode,
      groupData,
      userId: createdBy,
      timestamp: Date.now(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // Expires in 30 days
    };
    
    return qrData;
  }
  
  // Generate QR code for expense sharing
  static generateExpenseShareQR(
    expenseId: string,
    groupId: string,
    expenseData: { description: string; amount: number; currency: string },
    options?: QRGenerationOptions
  ): QRData {
    const qrData: QRData = {
      type: 'expense_share',
      version: '1.0',
      expenseId,
      groupId,
      timestamp: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // Expires in 24 hours
    };
    
    return qrData;
  }
  
  // Generate QR code for payment request
  static generatePaymentRequestQR(
    fromUserId: string,
    amount: number,
    currency: string,
    description: string,
    options?: QRGenerationOptions
  ): QRData {
    const qrData: QRData = {
      type: 'payment_request',
      version: '1.0',
      userId: fromUserId,
      timestamp: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // Expires in 24 hours
    };
    
    return qrData;
  }
  
  // Convert QR data to string for encoding
static encodeQRData(qrData: QRData): string {
  try {
    // Clean the data to remove any undefined or problematic values
    const cleanData = {
      type: qrData.type,
      version: qrData.version,
      timestamp: qrData.timestamp,
      ...(qrData.userId && { userId: qrData.userId }),
      ...(qrData.groupId && { groupId: qrData.groupId }),
      ...(qrData.inviteCode && { inviteCode: qrData.inviteCode }),
      ...(qrData.userData && { userData: qrData.userData }),
      ...(qrData.groupData && { groupData: qrData.groupData }),
      ...(qrData.expiresAt && { expiresAt: qrData.expiresAt })
    };
    
    const jsonString = JSON.stringify(cleanData);
    
    // Handle non-ASCII characters properly by encoding to UTF-8 first
    // Convert string to UTF-8 bytes, then to base64
    const utf8Bytes = encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    });
    const encodedData = encodeURIComponent(btoa(utf8Bytes));
    return `spendy://qr?data=${encodedData}`;
  } catch (error) {
    console.error('QR encode error:', error);
    throw new Error('Failed to encode QR data');
  }
}
  
  // Parse QR code string back to data
static decodeQRData(qrString: string): QRData {
  try {
    if (!qrString.startsWith('spendy://qr?data=')) {
      throw new Error('Invalid Spendy QR code');
    }
    
    const encodedData = qrString.replace('spendy://qr?data=', '');
    if (!encodedData) {
      throw new Error('No data found in QR code');
    }
    
    // Decode from base64 first, then convert UTF-8 bytes back to string
    const base64Decoded = atob(decodeURIComponent(encodedData));
    const jsonString = decodeURIComponent(base64Decoded.split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    const qrData: QRData = JSON.parse(jsonString);
    
    if (!qrData.version || qrData.version !== '1.0') {
      throw new Error('Unsupported QR code version');
    }
    
    if (qrData.expiresAt && Date.now() > qrData.expiresAt) {
      throw new Error('QR code has expired');
    }
    
    return qrData;
  } catch (error) {
    console.error('QR decode error:', error);
    throw new Error('Invalid or corrupted QR code');
  }
}
  
  // Handle scanned QR code
  static async handleScannedQR(qrString: string, currentUserId: string): Promise<void> {
    try {
      const qrData = this.decodeQRData(qrString);
      
      switch (qrData.type) {
        case 'friend_invite':
          await this.handleFriendInviteQR(qrData, currentUserId);
          break;
          
        case 'group_invite':
          await this.handleGroupInviteQR(qrData, currentUserId);
          break;
          
        case 'expense_share':
          await this.handleExpenseShareQR(qrData, currentUserId);
          break;
          
        case 'payment_request':
          await this.handlePaymentRequestQR(qrData, currentUserId);
          break;
          
        default:
          throw new Error('Unknown QR code type');
      }
    } catch (error) {
      console.error('Handle QR error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid QR code';
      Alert.alert('QR Code Error', errorMessage);
    }
  }

  static async handleScannedQRWithNavigation(
  qrString: string, 
  currentUserId: string,
  navigation: any // Navigation object
): Promise<void> {
  try {
    const qrData = this.decodeQRData(qrString);
    
    switch (qrData.type) {
      case 'friend_invite':
        await this.handleFriendInviteQR(qrData, currentUserId);
        break;
        
      case 'group_invite':
        const groupId = await this.handleGroupInviteQR(qrData, currentUserId);
        if (groupId) {
          // Navigate to group details
          navigation.navigate('GroupDetails', { groupId });
        }
        break;
        
      case 'expense_share':
        await this.handleExpenseShareQR(qrData, currentUserId);
        break;
        
      case 'payment_request':
        await this.handlePaymentRequestQR(qrData, currentUserId);
        break;
        
      default:
        throw new Error('Unknown QR code type');
    }
  } catch (error) {
    console.error('Handle QR error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Invalid QR code';
    Alert.alert('QR Code Error', errorMessage);
    throw error; // Re-throw so caller can handle
  }
}
  
  // Handle friend invite QR code
  private static async handleFriendInviteQR(qrData: QRData, currentUserId: string): Promise<void> {
    if (!qrData.userId || !qrData.userData) {
      throw new Error('Invalid friend invite QR code');
    }
    
    if (qrData.userId === currentUserId) {
      Alert.alert('Oops!', 'You cannot add yourself as a friend');
      return;
    }
    
    Alert.alert(
      'Friend Invitation',
      `${qrData.userData.fullName} wants to be your friend on Spendy. Send friend request?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Add Friend',
          onPress: async () => {
            try {
              const result = await SplittingService.sendFriendRequest(
                currentUserId,
                qrData.userData!.email,
                'Added via QR code'
              );
              
              if (result.isNewUser) {
                Alert.alert('Invitation Saved!', result.message || 'Invitation saved for when they join Spendy!');
              } else {
                Alert.alert('Success', result.message || 'Friend request sent!');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to send friend request');
            }
          }
        }
      ]
    );
  }
  
  // Handle group invite QR code
private static async handleGroupInviteQR(qrData: QRData, currentUserId: string): Promise<string | null> {
  if (!qrData.inviteCode || !qrData.groupData) {
    throw new Error('Invalid group invite QR code');
  }
  
  return new Promise((resolve) => {
    Alert.alert(
      'Group Invitation',
      `Join "${qrData.groupData.name}" group with ${qrData.groupData.memberCount} members?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(null)
        },
        {
          text: 'Join Group',
          onPress: async () => {
            try {
              const groupId = await SplittingService.joinGroupByInviteCode(
                qrData.inviteCode!,
                currentUserId
              );
              Alert.alert('Success', `You've joined "${qrData.groupData!.name}"!`);
              resolve(groupId);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to join group');
              resolve(null);
            }
          }
        }
      ]
    );
  });
}
  
  // Handle expense share QR code
  private static async handleExpenseShareQR(qrData: QRData, currentUserId: string): Promise<void> {
    if (!qrData.expenseId || !qrData.groupId) {
      throw new Error('Invalid expense share QR code');
    }
    
    Alert.alert(
      'Expense Details',
      'View expense details?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'View',
          onPress: () => {
            // Navigate to expense details screen
            console.log('Navigate to expense:', qrData.expenseId);
          }
        }
      ]
    );
  }
  
  // Handle payment request QR code
  private static async handlePaymentRequestQR(qrData: QRData, currentUserId: string): Promise<void> {
    if (!qrData.userId) {
      throw new Error('Invalid payment request QR code');
    }
    
    Alert.alert(
      'Payment Request',
      'Process payment request?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Pay',
          onPress: () => {
            // Navigate to payment screen
            console.log('Navigate to payment for user:', qrData.userId);
          }
        }
      ]
    );
  }
  
  // Share QR code via multiple channels
  static async shareQRCode(qrData: QRData, qrImageUri?: string): Promise<void> {
    try {
      let shareMessage = '';
      let shareTitle = '';
      
      switch (qrData.type) {
        case 'friend_invite':
          shareTitle = 'Add me on Spendy!';
          shareMessage = InviteService.generateFriendInviteMessage(
            qrData.userData?.fullName || 'Friend'
          );
          break;
          
        case 'group_invite':
          shareTitle = `Join "${qrData.groupData?.name}" on Spendy`;
          shareMessage = InviteService.generateGroupInviteMessage(
            'Someone',
            qrData.groupData?.name || 'Group',
            qrData.inviteCode || ''
          );
          break;
          
        default:
          shareTitle = 'Spendy Invitation';
          shareMessage = 'Join me on Spendy - the best expense splitting app!';
      }
      
      const shareOptions: any = {
        title: shareTitle,
        message: shareMessage,
        url: this.encodeQRData(qrData)
      };
      
      if (qrImageUri) {
        shareOptions.url = qrImageUri;
      }
      
      await Share.share(shareOptions);
    } catch (error) {
      console.error('Share QR error:', error);
      Alert.alert('Error', 'Failed to share QR code');
    }
  }
  
  // Share via SMS
  static async shareViaSMS(qrData: QRData, phoneNumber: string): Promise<void> {
    try {
      let message = '';
      
      switch (qrData.type) {
        case 'friend_invite':
          message = InviteService.generateFriendInviteMessage(
            qrData.userData?.fullName || 'Friend'
          );
          break;
          
        case 'group_invite':
          message = InviteService.generateGroupInviteMessage(
            'Someone',
            qrData.groupData?.name || 'Group',
            qrData.inviteCode || ''
          );
          break;
          
        default:
          message = 'Join me on Spendy! ' + this.encodeQRData(qrData);
      }
      
      await InviteService.sendSMSInvite(phoneNumber, message);
    } catch (error) {
      console.error('Share SMS error:', error);
      Alert.alert('Error', 'Failed to send SMS');
    }
  }
  
  // Share via WhatsApp
  static async shareViaWhatsApp(qrData: QRData, phoneNumber: string): Promise<void> {
    try {
      let message = '';
      
      switch (qrData.type) {
        case 'friend_invite':
          message = InviteService.generateFriendInviteMessage(
            qrData.userData?.fullName || 'Friend'
          );
          break;
          
        case 'group_invite':
          message = InviteService.generateGroupInviteMessage(
            'Someone',
            qrData.groupData?.name || 'Group',
            qrData.inviteCode || ''
          );
          break;
          
        default:
          message = 'Join me on Spendy! ' + this.encodeQRData(qrData);
      }
      
      await InviteService.sendWhatsAppInvite(phoneNumber, message);
    } catch (error) {
      console.error('Share WhatsApp error:', error);
      Alert.alert('Error', 'Failed to send WhatsApp message');
    }
  }
  
  // Render QR code component
  static renderQRCode(
    qrData: QRData, 
    options: QRGenerationOptions = {}
  ): React.ReactElement {
    const defaultOptions: QRGenerationOptions = {
      size: 200,
      backgroundColor: 'white',
      color: 'black',
      enableLogo: false,
      logoSize: 30,
      logoBackgroundColor: 'white'
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    const qrString = this.encodeQRData(qrData);
    
    return React.createElement(QRCode, {
      value: qrString,
      size: finalOptions.size,
      backgroundColor: finalOptions.backgroundColor,
      color: finalOptions.color,
      logo: finalOptions.enableLogo ? finalOptions.logo : undefined,
      logoSize: finalOptions.logoSize,
      logoBackgroundColor: finalOptions.logoBackgroundColor,
      logoMargin: 5,
      logoBorderRadius: 10,
      enableLinearGradient: false,
      getRef: (c: any) => (this.qrRef = c)
    });
  }
  
  private static qrRef: any;
  
  // Get QR code as base64 image
  static getQRCodeImage(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.qrRef) {
        this.qrRef.toDataURL((dataURL: string) => {
          resolve(dataURL);
        });
      } else {
        reject(new Error('QR code not rendered'));
      }
    });
  }
  
  // Deep link handling
  static handleDeepLink(url: string): void {
    try {
      if (url.startsWith('spendy://qr')) {
        // Extract current user ID from app state/storage
        const currentUserId = 'current-user-id'; // Get from auth context
        this.handleScannedQR(url, currentUserId);
      }
    } catch (error) {
      console.error('Deep link handling error:', error);
    }
  }
  
  // Initialize deep link listener
  static initializeDeepLinkListener(): void {
    // Handle deep links when app is already open
    Linking.addEventListener('url', (event) => {
      this.handleDeepLink(event.url);
    });
    
    // Handle deep links when app is opened from background
    Linking.getInitialURL().then((url) => {
      if (url) {
        this.handleDeepLink(url);
      }
    });
  }
  
  // Generate batch QR codes for events
  static generateBatchQRCodes(
    type: 'friend_invite' | 'group_invite',
    data: any[],
    options?: QRGenerationOptions
  ): QRData[] {
    return data.map(item => {
      switch (type) {
        case 'friend_invite':
          return this.generateFriendInviteQR(
            item.userId,
            item.userData,
            options
          );
          
        case 'group_invite':
          return this.generateGroupInviteQR(
            item.groupId,
            item.inviteCode,
            item.groupData,
            item.createdBy,
            options
          );
          
        default:
          throw new Error('Unsupported batch QR type');
      }
    });
  }

  
  
  // Analytics tracking for QR code usage
  static trackQRCodeGenerated(type: string, userId: string): void {
    // Track QR code generation analytics
    console.log('QR Code Generated:', { type, userId, timestamp: Date.now() });
  }
  
  static trackQRCodeScanned(type: string, userId: string): void {
    // Track QR code scan analytics
    console.log('QR Code Scanned:', { type, userId, timestamp: Date.now() });
  }
}

// Camera component for QR scanning
export class QRScanner {
  static renderScanner(onQRCodeScanned: (data: string) => void): React.ReactElement {
    return React.createElement(RNCamera, {
      style: { flex: 1 },
      type: RNCamera.Constants.Type.back,
      flashMode: RNCamera.Constants.FlashMode.auto,
      androidCameraPermissionOptions: {
        title: 'Permission to use camera',
        message: 'We need your permission to use your camera to scan QR codes',
        buttonPositive: 'Ok',
        buttonNegative: 'Cancel',
      },
      onBarCodeRead: (scanResult: any) => {
        if (scanResult.data && scanResult.type === 'QR_CODE') {
          onQRCodeScanned(scanResult.data);
        }
      },
      barCodeTypes: [RNCamera.Constants.BarCodeType.qr]
    });
  }
}