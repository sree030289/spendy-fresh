// src/components/modals/QRCodeModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { Icon } from '../common/Icon';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import FullscreenModal from '@/components/common/FullscreenModal';
import { SecureQRService } from '@/services/qr/SecureQRService';
import { User } from '@/types';

// Temporary Group interface for QR code functionality
interface Group {
  id: string;
  name: string;
  avatar?: string;
  inviteCode: string;
  members: any[];
}
import QRCodeScanner from '@/components/QRCodeScanner';
import ImprovedQRScannerManager, { ScannerState } from '@/services/qr/ImprovedQRScannerManager';

// Helper function to get active member count
const getActiveMemberCount = (members: any[]): number => {
  if (!members || !Array.isArray(members)) return 0;
  return members.filter(member => member.isActive !== false).length;
};

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
  const [qrString, setQrString] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerState, setScannerState] = useState<ScannerState>({
    status: 'idle',
    isProcessing: false,
    hasScanned: false,
    error: null,
    lastScanTime: null,
  });

  const scannerManager = ImprovedQRScannerManager.getInstance();

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
      scannerManager.resetScanner();
      setShowScanner(false);
    } else {
      // When modal closes, ensure all states are reset
      setShowScanner(false);
      scannerManager.resetScanner();
    }
  }, [visible, mode, user, selectedGroup]);

  const generateQRCode = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const qrService = SecureQRService.getInstance();
      let qrUrl = '';
      
      if (mode === 'friend') {
        qrUrl = await qrService.generateFriendInviteQR(
          user.id,
          {
            fullName: user.fullName,
            email: user.email,
            avatar: user.profilePicture
          }
        );
      } else if (mode === 'group' && selectedGroup) {
        qrUrl = await qrService.generateGroupInviteQR(
          selectedGroup.id,
          selectedGroup.inviteCode,
          {
            name: selectedGroup.name,
            avatar: selectedGroup.avatar || '',
            memberCount: getActiveMemberCount(selectedGroup.members)
          },
          user.id
        );
      }

      if (qrUrl) {
        setQrString(qrUrl);
      }
    } catch (error: any) {
      console.error('Generate QR code error:', error);
      Alert.alert('Error', error.message || 'Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!qrString || !user || loading) return;

    setLoading(true);
    try {
      const qrService = SecureQRService.getInstance();
      const targetName = mode === 'friend' ? user.fullName : selectedGroup?.name || 'Group';
      const shareMode = mode === 'scanner' ? 'friend' : mode; // Default scanner mode to friend
      await qrService.shareQRCode(qrString, shareMode, targetName);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to share QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSMS = async () => {
    if (!qrString || !user || loading) return;

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
                const message = mode === 'friend' 
                  ? `👋 Add me as a friend on Meet-n-Split! 💰

📱 ${qrString}

✨ Split expenses easily!
🌐 https://meetnsplit.com`
                  : `🎉 Join "${selectedGroup?.name}" group on Meet-n-Split! 💰

📱 ${qrString}

✨ Smart expense splitting!
🌐 https://meetnsplit.com`;
                
                // Use native SMS sharing
                await Share.share({ message });
                Alert.alert('Success', 'SMS invitation shared!');
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
    if (!qrString || !user || loading) return;

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
              const message = mode === 'friend' 
                ? `👋 Add me as a friend on Meet-n-Split! 💰\n\n📱 ${qrString}\n\n✨ Split expenses easily!\n🌐 https://meetnsplit.com`
                : `🎉 Join "${selectedGroup?.name}" group on Meet-n-Split! 💰\n\n📱 ${qrString}\n\n✨ Smart expense splitting!\n🌐 https://meetnsplit.com`;
                
              try {
                // Use WhatsApp URL scheme
                const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
                await Linking.openURL(whatsappUrl);
              } catch (error: any) {
                // Fallback to regular share
                const fallbackMessage = `WhatsApp: ${message}`;
                await Share.share({ message: fallbackMessage });
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
  if (scannerManager.isBusy()) {
    return;
  }
  
  // Start scanning session
  setShowScanner(true);
  scannerManager.startScanning();
}, [scannerManager]);

const handleQRCodeScanned = useCallback(async (qrData: string) => {
  if (!user) {
    console.log('No user available for QR processing');
    return;
  }

  // Handle special error cases from QRCodeScanner
  if (qrData === 'INVALID_QR_FORMAT') {
    scannerManager.showErrorMessage(
      'This is not a valid Meet-n-Split QR code. Please scan a QR code generated by Meet-n-Split.',
      () => scannerManager.resetForNewScan(),
      () => {
        setShowScanner(false);
        onClose();
      }
    );
    return;
  }

  if (qrData === 'SCAN_ERROR') {
    scannerManager.showErrorMessage(
      'An error occurred while scanning. Please try again.',
      () => scannerManager.resetForNewScan(),
      () => {
        setShowScanner(false);
        onClose();
      }
    );
    return;
  }

  try {
    const result = await scannerManager.processQRCode(qrData, user.id);

    if (result.success) {
      // Close scanner and modal
      setShowScanner(false);
      onClose();
      
      // Show success message
      setTimeout(() => {
        Alert.alert(
          'Success! 🎉',
          result.message,
          [{ 
            text: 'OK',
            onPress: () => {
              // Handle navigation if needed
              if (result.navigationAction?.type === 'group_details' && result.navigationAction.groupId) {
                // Navigate to group details - this would be handled by parent component
                console.log('Navigate to group:', result.navigationAction.groupId);
              }
            }
          }]
        );
      }, 300);
    } else {
      // Show error with retry option
      scannerManager.showErrorMessage(
        result.message,
        () => scannerManager.resetForNewScan(),
        () => {
          setShowScanner(false);
          onClose();
        }
      );
    }
  } catch (error) {
    console.error('Unexpected error in handleQRCodeScanned:', error);
    scannerManager.showErrorMessage(
      'An unexpected error occurred. Please try again.',
      () => scannerManager.resetForNewScan(),
      () => {
        setShowScanner(false);
        onClose();
      }
    );
  }
}, [user, scannerManager, onClose, setShowScanner]);

const handleScannerClose = useCallback(() => {
  setShowScanner(false);
  scannerManager.stopScanning();
  setMode('friend');
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
        <Icon
          name="people"
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
          <Icon name="people"
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
          <Icon
            name="time"
            size={20}
            color={theme.colors.textSecondary}
          />
        ) : (
          <Icon name="camera"
            size={20}
            color={theme.colors.primary}
           />
        )}
        <Text style={[
          styles.modeTabText,
          { color: scannerState.isProcessing ? theme.colors.textSecondary : theme.colors.primary }
        ]}>
          {scannerManager.getStatusMessage()}
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
            ? 'Share this QR code or send it to friends so they can add you on Meet-n-Split'
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
                message: `🎉 Join "${selectedGroup.name}" on Meet-n-Split! 💰\n\nUse invite code: ${selectedGroup.inviteCode}\n\n🌐 https://meetnsplit.com/join/${selectedGroup.inviteCode}\n\n✨ Smart expense splitting!`
              });
            }}
          >
            <Text style={[styles.inviteCode, { color: theme.colors.primary }]}>
              {selectedGroup.inviteCode}
            </Text>
            <Icon name="copy" size={16} color={theme.colors.primary}  />
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
        <Icon name="chatbubbles" size={24} color="#2563EB" />
        <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>SMS</Text>
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
        <Icon name="copy" size={24} color={theme.colors.secondary}  />
        <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>Copy Link</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FullscreenModal
      visible={visible}
      onClose={onClose}
      title={scannerState.isProcessing ? 'Processing QR Code...' : 'QR Code'}
      showBackButton={!loading && !scannerState.isProcessing}
    >
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
          <Icon name="information" size={20} color={theme.colors.primary}  />
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            QR codes expire after {mode === 'friend' ? '7 days' : '30 days'} for security
          </Text>
        </View>

      {/* QR Scanner Modal */}
      <QRCodeScanner
        visible={showScanner}
        onQRCodeScanned={handleQRCodeScanned}
        onClose={handleScannerClose}
            />
    </FullscreenModal>
  );
}

const styles = StyleSheet.create({
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