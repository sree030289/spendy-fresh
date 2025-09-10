import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from './common/Icon';
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
  const isProcessingRef = useRef(false);
  const lastScanTimeRef = useRef<number>(0);

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
      isProcessingRef.current = false;
      lastScanTimeRef.current = 0;
    }
  }, [visible]);

  // Add cleanup when modal closes
  useEffect(() => {
    if (!visible) {
      setScanned(false);
      setProcessing(false);
    }
  }, [visible]);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    // Strong protection against multiple rapid scans
    const now = Date.now();
    
    // Check ref-based flags first (immediate)
    if (isProcessingRef.current) {
      console.log('🚫 QR scan blocked by ref - already processing');
      return;
    }
    
    // Time-based protection
    if (lastScanTimeRef.current && (now - lastScanTimeRef.current) < 2000) {
      console.log('🚫 QR scan blocked by time - too soon after last scan');
      return;
    }
    
    // State-based protection (backup)
    if (scanned || processing) {
      console.log('🚫 QR scan blocked by state - already scanned or processing');
      return;
    }

    // Set all protection flags
    isProcessingRef.current = true;
    lastScanTimeRef.current = now;
    setScanned(true);
    setProcessing(true);
    
    try {
      console.log('📱 QR Code scanned:', data);
      
      // Simple validation - check if it's a valid JSON or Spendy URL
      let isValidQR = false;
      
      if (data.startsWith('spendy://')) {
        isValidQR = true;
      } else {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type && (parsed.type.includes('invite') || parsed.type.includes('friend') || parsed.type.includes('group'))) {
            isValidQR = true;
          }
        } catch {
          // Not JSON, check other patterns
          if (data.includes('spendy') || data.includes('friend') || data.includes('group')) {
            isValidQR = true;
          }
        }
      }

      if (!isValidQR) {
        console.log('❌ Invalid QR format');
        setProcessing(false);
        setScanned(false);
        isProcessingRef.current = false;
        onQRCodeScanned('INVALID_QR_FORMAT');
        return;
      }

      console.log('✅ Valid QR code detected, passing to parent');
      // Pass the data to parent with a small delay for smooth UX
      setTimeout(() => {
        onQRCodeScanned(data);
      }, 300);

    } catch (error: any) {
      console.error('❌ QR scan error:', error);
      setProcessing(false);
      setScanned(false);
      isProcessingRef.current = false;
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
              <Icon name="close" size={24} color={theme.colors.text}  />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Camera Access
            </Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.centerContent}>
            <Icon name="camera" size={64} color={theme.colors.textSecondary}  />
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
              <Icon name="close" size={24} color="white"  />
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
                <Icon name="refresh" size={20} color="white"  />
                <Text style={styles.actionButtonText}>Scan Again</Text>
              </TouchableOpacity>
            )}
            
            {processing && (
              <View style={styles.actionButton}>
                <Icon name="hourglass" size={20} color="white" />
                <Text style={styles.actionButtonText}>Processing...</Text>
              </View>
            )}
            
            <View style={styles.infoCard}>
              <Icon name="information" size={16} color="rgba(255,255,255,0.8)"  />
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
