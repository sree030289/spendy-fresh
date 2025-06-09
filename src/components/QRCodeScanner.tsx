import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '@/hooks/useTheme';
import QRScannerManager from '@/services/qr/QRScannerManager';

interface QRCodeScannerProps {
  visible: boolean;
  onQRCodeScanned: (data: string) => void;
  onClose: () => void;
}

export default function QRCodeScanner({ visible, onQRCodeScanned, onClose }: QRCodeScannerProps) {
  const { theme } = useTheme();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  
  const scannerManager = QRScannerManager.getInstance();

  useEffect(() => {
    (async () => {
      if (!permission?.granted) {
        const { granted } = await requestPermission();
        setHasPermission(granted);
      } else {
        setHasPermission(true);
      }
    })();
  }, [permission, requestPermission]);

  // Reset scanned state when modal opens
  useEffect(() => {
    if (visible) {
      setScanned(false);
      setProcessing(false);
    }
  }, [visible]);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    // Prevent multiple rapid scans
    if (scanned || processing) {
      return;
    }

    setScanned(true);
    setProcessing(true);
    
    try {
      // Basic validation - but don't show alert here, let parent handle all errors
      if (!data.startsWith('spendy://qr') && !data.includes('spendy') && !data.includes('"type":')) {
        // Set error state but let parent handle the alert
        setProcessing(false);
        setScanned(false);
        onQRCodeScanned('INVALID_QR_FORMAT');
        return;
      }

      // Delay to ensure smooth UX
      setTimeout(() => {
        onQRCodeScanned(data);
        // Don't close immediately - let parent handle closing
      }, 200);

    } catch (error: any) {
      setProcessing(false);
      setScanned(false);
      // Let parent handle all error alerts
      onQRCodeScanned('SCAN_ERROR');
    }
  };

  const handleManualReset = () => {
    setScanned(false);
    setProcessing(false);
  };

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <View style={styles.centerContent}>
            <Text style={[styles.message, { color: theme.colors.text }]}>
              Requesting camera permission...
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Camera Access
            </Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.centerContent}>
            <Ionicons name="camera-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.message, { color: theme.colors.text }]}>
              Camera permission is required to scan QR codes
            </Text>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: theme.colors.primary }]}
              onPress={async () => {
                const { granted } = await requestPermission();
                setHasPermission(granted);
              }}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />
        
        <View style={styles.overlay}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={[
                styles.headerButton,
                processing && { opacity: 0.6 }
              ]} 
              onPress={(e) => {
                e.stopPropagation();
                if (!processing) {
                  onClose();
                }
              }}
              disabled={processing}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {processing ? 'Processing...' : 'Scan QR Code'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Scanning Area */}
          <View style={styles.scanningArea}>
            <View style={[
              styles.scanFrame,
              processing && { borderColor: 'orange' },
              scanned && !processing && { borderColor: 'green' }
            ]} />
            <Text style={styles.instruction}>
              {processing 
                ? 'Processing QR code...' 
                : scanned 
                  ? 'QR code detected!' 
                  : 'Position the QR code within the frame'
              }
            </Text>
          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            {(scanned && !processing) && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleManualReset();
                }}
                disabled={processing}
              >
                <Ionicons name="refresh" size={20} color="white" />
                <Text style={styles.actionButtonText}>Scan Again</Text>
              </TouchableOpacity>
            )}
            
            {processing && (
              <View style={styles.actionButton}>
                <Ionicons name="hourglass" size={20} color="white" />
                <Text style={styles.actionButtonText}>Processing...</Text>
              </View>
            )}
            
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.infoText}>
                Only scan QR codes from trusted Spendy users
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  scanningArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: 'white',
    borderRadius: 20,
    backgroundColor: 'transparent',
    shadowColor: 'white',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  instruction: {
    color: 'white',
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bottomActions: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 16,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  infoText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  message: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
