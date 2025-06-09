// src/components/modals/QRCodeModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import { QRCodeService } from '@/services/qr/QRCodeService';
import { InviteService } from '@/services/payments/PaymentService';
import { User } from '@/types';
import { Group } from '@/services/firebase/splitting';
import QRCodeScanner from '@/components/QRCodeScanner';
import QRScannerManager, { QRScannerState } from '@/services/qr/QRScannerManager';

interface QRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  user: User | null;
  selectedGroup?: Group | null;
}

type QRMode = 'friend' | 'group' | 'scanner';

export default function QRCodeModal({ visible, onClose, user, selectedGroup }: QRCodeModalProps) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<QRMode>('friend');
  const [qrData, setQrData] = useState<any>(null);
  const [qrString, setQrString] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerState, setScannerState] = useState<QRScannerState>({
    isScanning: false,
    isProcessing: false,
    hasScanned: false,
    error: null,
  });
  const [isHandlingScan, setIsHandlingScan] = useState(false); // Add this state

  const scannerManager = QRScannerManager.getInstance();

  useEffect(() => {
    // Subscribe to scanner state changes
    const unsubscribe = scannerManager.subscribe(setScannerState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (visible && user) {
      generateQRCode();
    }
    
    // Reset scanner state when modal opens or closes
    if (visible) {
      scannerManager.stopScanning();
      setShowScanner(false);
      setIsHandlingScan(false);
    } else {
      // When modal closes, ensure all states are reset
      setShowScanner(false);
      setIsHandlingScan(false);
      scannerManager.stopScanning();
    }
  }, [visible, mode, user, selectedGroup]);

  const generateQRCode = () => {
    if (!user) return;

    try {
      let generatedQRData;
      
      if (mode === 'friend') {
        generatedQRData = QRCodeService.generateFriendInviteQR(
          user.id,
          {
            fullName: user.fullName,
            email: user.email,
            profilePicture: user.profilePicture
          }
        );
      } else if (mode === 'group' && selectedGroup) {
        generatedQRData = QRCodeService.generateGroupInviteQR(
          selectedGroup.id,
          selectedGroup.inviteCode,
          {
            name: selectedGroup.name,
            avatar: selectedGroup.avatar,
            memberCount: selectedGroup.members.length
          },
          user.id
        );
      }

      if (generatedQRData) {
        setQrData(generatedQRData);
        const encodedString = QRCodeService.encodeQRData(generatedQRData);
        setQrString(encodedString);
      }
    } catch (error) {
      console.error('Generate QR code error:', error);
      Alert.alert('Error', 'Failed to generate QR code');
    }
  };

  const handleShare = async () => {
    if (!qrData || !user || loading) return;

    setLoading(true);
    try {
      await QRCodeService.shareQRCode(qrData);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to share QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSMS = async () => {
    if (!qrData || !user || loading) return;

    Alert.prompt(
      'Send SMS',
      'Enter phone number to send invitation:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async (phoneNumber) => {
            if (phoneNumber && !loading) {
              setLoading(true);
              try {
                await QRCodeService.shareViaSMS(qrData, phoneNumber);
                Alert.alert('Success', 'SMS invitation sent!');
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to send SMS');
              } finally {
                setLoading(false);
              }
            }
          }
        }
      ],
      'plain-text',
      '',
      'phone-pad'
    );
  };

  const handleSendWhatsApp = async () => {
    if (!qrData || !user || loading) return;

    Alert.prompt(
      'Send WhatsApp',
      'Enter phone number to send invitation:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async (phoneNumber) => {
            if (phoneNumber && !loading) {
              setLoading(true);
              try {
                await QRCodeService.shareViaWhatsApp(qrData, phoneNumber);
                Alert.alert('Success', 'WhatsApp invitation sent!');
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to send WhatsApp message');
              } finally {
                setLoading(false);
              }
            }
          }
        }
      ],
      'plain-text',
      '',
      'phone-pad'
    );
  };

const handleScanQR = useCallback(() => {
  // Prevent multiple rapid button presses
  if (!scannerManager.canProcessAction()) {
    return;
  }
  
  setShowScanner(true);
  scannerManager.startScanning();
}, [scannerManager]);

const handleQRCodeScanned = useCallback(async (qrData: string) => {
  if (!user || isHandlingScan) {
    console.log('Scan handling already in progress, user is null, or modal not visible.');
    return;
  }

  // Handle special error cases from QRCodeScanner
  if (qrData === 'INVALID_QR_FORMAT') {
    Alert.alert(
      'Invalid QR Code',
      'This is not a valid Spendy QR code. Please scan a QR code generated by Spendy.',
      [
        {
          text: 'Try Again',
          onPress: () => {
            // Keep scanner open for retry
          }
        },
        {
          text: 'Cancel',
          onPress: () => {
            setShowScanner(false);
            onClose();
          }
        }
      ]
    );
    return;
  }

  if (qrData === 'SCAN_ERROR') {
    Alert.alert(
      'Scan Error',
      'An error occurred while scanning. Please try again.',
      [
        {
          text: 'Try Again',
          onPress: () => {
            // Keep scanner open for retry
          }
        },
        {
          text: 'Cancel',
          onPress: () => {
            setShowScanner(false);
            onClose();
          }
        }
      ]
    );
    return;
  }

  setIsHandlingScan(true);

  try {
    const result = await scannerManager.processQRCode(qrData, user.id, {
      closeOnSuccess: true,
    });

    if (result.success) {
      // Immediately close scanner and modal
      setShowScanner(false);
      onClose(); 
      
      // Show success message with a slight delay to ensure UI updates
      setTimeout(() => {
        Alert.alert(
          'Success',
          'QR code processed successfully!',
          [{ text: 'OK' }]
        );
      }, 100);
    } else {
      // Handle error without using QRScannerManager's alert
      Alert.alert(
        'QR Code Error',
        result.error || 'Failed to process QR code',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setShowScanner(false);
              onClose();
            }
          },
          {
            text: 'Try Again',
            onPress: () => {
              // Keep scanner open for retry
            }
          }
        ]
      );
    }
  } catch (error) {
    console.error('Unexpected error in handleQRCodeScanned:', error);
    Alert.alert(
      'Error',
      'An unexpected error occurred. Please try again.',
      [
        {
          text: 'Cancel',
          onPress: () => {
            setShowScanner(false);
            onClose();
          }
        },
        {
          text: 'Try Again',
          onPress: () => {
            // Keep scanner open for retry
          }
        }
      ]
    );
  } finally {
    setIsHandlingScan(false);
  }
}, [user, scannerManager, onClose, setShowScanner, isHandlingScan]);

const handleScannerClose = useCallback(() => {
  setShowScanner(false);
  scannerManager.stopScanning();
  setMode('friend');
  setIsHandlingScan(false); // Reset the handling flag
}, [scannerManager]);

  const renderModeSelector = () => (
    <View style={styles.modeSelector}>
      <TouchableOpacity
        style={[
          styles.modeTab,
          mode === 'friend' && [styles.activeModeTab, { backgroundColor: theme.colors.primary + '20' }]
        ]}
        onPress={() => setMode('friend')}
      >
        <Ionicons
          name="person-add"
          size={20}
          color={mode === 'friend' ? theme.colors.primary : theme.colors.textSecondary}
        />
        <Text style={[
          styles.modeTabText,
          { color: mode === 'friend' ? theme.colors.primary : theme.colors.textSecondary }
        ]}>
          Add Friend
        </Text>
      </TouchableOpacity>

      {selectedGroup && (
        <TouchableOpacity
          style={[
            styles.modeTab,
            mode === 'group' && [styles.activeModeTab, { backgroundColor: theme.colors.primary + '20' }]
          ]}
          onPress={() => setMode('group')}
        >
          <Ionicons
            name="people"
            size={20}
            color={mode === 'group' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text style={[
            styles.modeTabText,
            { color: mode === 'group' ? theme.colors.primary : theme.colors.textSecondary }
          ]}>
            Group Invite
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[
          styles.modeTab, 
          { backgroundColor: theme.colors.surface },
          (scannerState.isProcessing || loading) && { opacity: 0.6 }
        ]}
        onPress={handleScanQR}
        disabled={scannerState.isProcessing || loading}
      >
        {scannerState.isProcessing ? (
          <Ionicons
            name="hourglass"
            size={20}
            color={theme.colors.textSecondary}
          />
        ) : (
          <Ionicons
            name="camera"
            size={20}
            color={theme.colors.primary}
          />
        )}
        <Text style={[
          styles.modeTabText,
          { color: scannerState.isProcessing ? theme.colors.textSecondary : theme.colors.primary }
        ]}>
          {scannerState.isProcessing ? 'Processing...' : 'Scan QR'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderQRCode = () => (
    <View style={styles.qrContainer}>
      <View style={[styles.qrCodeWrapper, { backgroundColor: 'white' }]}>
        {qrString && (
          <QRCode
            value={qrString}
            size={200}
            backgroundColor="white"
            color="black"
            logoSize={30}
            logoBackgroundColor="white"
            logoMargin={5}
            logoBorderRadius={10}
          />
        )}
      </View>

      <View style={styles.qrInfo}>
        <Text style={[styles.qrTitle, { color: theme.colors.text }]}>
          {mode === 'friend' ? 'Add Me as Friend' : `Join "${selectedGroup?.name}"`}
        </Text>
        <Text style={[styles.qrDescription, { color: theme.colors.textSecondary }]}>
          {mode === 'friend' 
            ? 'Share this QR code or send it to friends so they can add you on Spendy'
            : `Share this QR code to invite people to join the "${selectedGroup?.name}" group`
          }
        </Text>
      </View>

      {mode === 'group' && selectedGroup && (
        <View style={[styles.inviteCodeContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.inviteCodeLabel, { color: theme.colors.textSecondary }]}>
            Or share invite code:
          </Text>
          <TouchableOpacity
            style={styles.inviteCodeButton}
            onPress={() => {
              Share.share({
                message: `Join "${selectedGroup.name}" on Spendy! Use invite code: ${selectedGroup.inviteCode}`
              });
            }}
          >
            <Text style={[styles.inviteCode, { color: theme.colors.primary }]}>
              {selectedGroup.inviteCode}
            </Text>
            <Ionicons name="copy" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderShareOptions = () => (
    <View style={styles.shareOptions}>
      <TouchableOpacity
        style={[styles.shareOption, { backgroundColor: theme.colors.surface }]}
        onPress={handleSendSMS}
        disabled={loading}
      >
        <Ionicons name="chatbox" size={24} color="#2563EB" />
        <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>SMS</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.shareOption, { backgroundColor: theme.colors.surface }]}
        onPress={handleSendWhatsApp}
        disabled={loading}
      >
        <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
        <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>WhatsApp</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.shareOption, { backgroundColor: theme.colors.surface }]}
        onPress={() => {
          if (qrString) {
            Share.share({ message: qrString });
          }
        }}
        disabled={loading}
      >
        <Ionicons name="copy" size={24} color={theme.colors.secondary} />
        <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>Copy Link</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity 
            onPress={onClose} 
            disabled={loading || scannerState.isProcessing}
            style={{ opacity: (loading || scannerState.isProcessing) ? 0.6 : 1 }}
          >
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {scannerState.isProcessing ? 'Processing QR Code...' : 'QR Code'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Mode Selector */}
        {renderModeSelector()}

        {/* Content */}
        <View style={styles.content}>
          {!showScanner ? (
            <>
              {renderQRCode()}
              {renderShareOptions()}
            </>
          ) : null}
        </View>

        {/* Footer Info */}
        <View style={[styles.footer, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            QR codes expire after {mode === 'friend' ? '7 days' : '30 days'} for security
          </Text>
        </View>
      </SafeAreaView>

      {/* QR Scanner Modal */}
      <QRCodeScanner
        visible={showScanner}
        onQRCodeScanned={handleQRCodeScanned}
        onClose={handleScannerClose}
            />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    margin: 20,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  activeModeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  qrCodeWrapper: {
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  qrInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  qrDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  inviteCodeContainer: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  inviteCodeLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  inviteCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  shareOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  shareOption: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  shareOptionText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});