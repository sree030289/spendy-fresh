// src/services/qr/QRScannerManager.ts
import { CrossPlatformAlert } from '@/utils/alertUtils';
import { QRCodeService } from './QRCodeService';
import { SecureQRService } from './SecureQRService';

export interface QRScannerState {
  isScanning: boolean;
  isProcessing: boolean;
  hasScanned: boolean;
  error: string | null;
}

export interface QRScanResult {
  success: boolean;
  data?: any;
  error?: string;
  shouldCloseModal?: boolean;
}

export class QRScannerManager {
  private static instance: QRScannerManager;
  private state: QRScannerState = {
    isScanning: false,
    isProcessing: false,
    hasScanned: false,
    error: null,
  };
  
  private stateListeners: Set<(state: QRScannerState) => void> = new Set();
  private lastScanTime: number | null = null;
  private lastProcessedQRData: string | null = null;

  static getInstance(): QRScannerManager {
    if (!QRScannerManager.instance) {
      QRScannerManager.instance = new QRScannerManager();
    }
    return QRScannerManager.instance;
  }

  // Subscribe to state changes
  subscribe(listener: (state: QRScannerState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  // Update state and notify listeners
  private updateState(newState: Partial<QRScannerState>): void {
    this.state = { ...this.state, ...newState };
    this.stateListeners.forEach(listener => listener(this.state));
  }

  // Get current state
  getState(): QRScannerState {
    return { ...this.state };
  }

  // Start scanning session
  startScanning(): void {
    this.lastScanTime = null; // Reset timestamp for new session
    this.lastProcessedQRData = null; // Reset QR data for new session
    this.updateState({
      isScanning: true,
      isProcessing: false,
      hasScanned: false,
      error: null,
    });
  }

  // Reset scanner for new scan (called when modal opens)
  resetScanner(): void {
    this.lastScanTime = null;
    this.lastProcessedQRData = null;
    this.updateState({
      isScanning: true,
      isProcessing: false,
      hasScanned: false,
      error: null,
    });
  }

  // Stop scanning session
  stopScanning(): void {
    this.updateState({
      isScanning: false,
      isProcessing: false,
      hasScanned: false,
      error: null,
    });
  }

  // Process scanned QR code
  async processQRCode(
    qrData: string, 
    currentUserId: string,
    options?: {
      closeOnSuccess?: boolean;
      navigation?: any;
    }
  ): Promise<QRScanResult> {
    // Prevent multiple rapid scans but allow retry after a short delay
    if (this.state.isProcessing) {
      console.log('🚫 QR scan blocked - already processing');
      return {
        success: false,
        error: 'Please wait, processing QR code...',
      };
    }

    // Add timestamp-based debouncing to prevent rapid successive scans (reduced to 1.5 seconds)
    const now = Date.now();
    if (this.lastScanTime && (now - this.lastScanTime) < 1500) {
      console.log('🚫 QR scan blocked - too soon after last scan');
      return {
        success: false,
        error: 'Please wait before scanning another QR code...',
      };
    }
    
    // Additional check: if we just processed the same QR data, block it
    if (this.lastProcessedQRData === qrData) {
      console.log('🚫 QR scan blocked - same QR data already processed');
      return {
        success: false,
        error: 'This QR code was already processed',
      };
    }
    
    this.lastScanTime = now;
    this.lastProcessedQRData = qrData;

    this.updateState({
      isProcessing: true,
      error: null,
    });

    try {
      // Validate QR code format
      if (!this.isValidSpendyQR(qrData)) {
        throw new Error('Invalid Spendy QR code format');
      }

      // Detect QR version and use appropriate service
      const isV2QR = await this.detectQRVersion(qrData);
      
      if (isV2QR) {
        console.log('🔄 Using SecureQRService for v2.0 QR code');
        if (options?.navigation) {
          await SecureQRService.handleScannedQRWithNavigation(
            qrData, 
            currentUserId, 
            options.navigation
          );
        } else {
          await SecureQRService.handleScannedQR(qrData, currentUserId);
        }
      } else {
        console.log('🔄 Using QRCodeService for v1.0 QR code');
        if (options?.navigation) {
          await QRCodeService.handleScannedQRWithNavigation(
            qrData, 
            currentUserId, 
            options.navigation
          );
        } else {
          await QRCodeService.handleScannedQR(qrData, currentUserId);
        }
      }

      this.updateState({
        isProcessing: false,
        hasScanned: true,
        isScanning: false, // Stop scanning on success
      });

      return {
        success: true,
        data: qrData,
        shouldCloseModal: options?.closeOnSuccess ?? true,
      };

    } catch (error: any) {
      const errorMessage = error.message || 'Failed to process QR code';
      console.error('🚫 QR processing error:', error);
      
      this.updateState({
        isProcessing: false,
        isScanning: false, // Stop scanning on error
        error: errorMessage,
        hasScanned: true, // Mark as scanned to prevent retry
      });

      // Clear the processed QR data on error so user can retry if needed
      this.lastProcessedQRData = null;
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Validate QR code format
  private isValidSpendyQR(qrData: string): boolean {
    return qrData.startsWith('spendy://qr') || 
           qrData.includes('spendy') || 
           qrData.includes('"type":');
  }

    // Reset scanner for new scan
  resetForNewScan(): void {
    this.updateState({
      isProcessing: false,
      hasScanned: false,
      isScanning: true,
      error: null,
    });
  }

  // Handle scan errors with user feedback
  handleScanError(error: string, onRetry?: () => void, onCancelFromAlert?: () => void): void { // Added onCancelFromAlert
    this.updateState({
      isProcessing: false,
      error,
    });

    CrossPlatformAlert.alert(
      'QR Code Error',
      error,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            this.stopScanning();
            onCancelFromAlert?.(); // Call the new callback
          },
        },
        ...(onRetry ? [{
          text: 'Try Again',
          onPress: () => {
            this.resetForNewScan();
            onRetry();
          },
        }] : []),
      ]
    );
  }

  // Show success feedback
  showSuccessMessage(message: string, onClose?: () => void): void {
    CrossPlatformAlert.alert(
      'Success',
      message,
      [{
        text: 'OK',
        onPress: () => {
          this.stopScanning();
          onClose?.();
        },
      }]
    );
  }

  // Prevent rapid button presses
  canProcessAction(): boolean {
    return !this.state.isProcessing && !this.state.hasScanned;
  }

  // Check if scanner is busy
  isBusy(): boolean {
    return this.state.isProcessing || this.state.hasScanned;
  }

  // Detect QR version to use appropriate service
  private async detectQRVersion(qrData: string): Promise<boolean> {
    try {
      // Extract the encoded data part
      let encodedData = '';
      if (qrData.includes('spendy://qr?data=')) {
        encodedData = qrData.replace('spendy://qr?data=', '');
      } else if (qrData.includes('meetnsplit.com/qr?data=')) {
        encodedData = qrData.split('data=')[1];
      } else {
        return false; // Default to v1.0 for unknown formats
      }

      // Try to decode and check version
      try {
        const base64Decoded = atob(encodedData);
        const jsonString = decodeURIComponent(base64Decoded);
        const qrDataObj = JSON.parse(jsonString);
        console.log('🔍 Detected QR version:', qrDataObj.version);
        return qrDataObj.version === '2.0';
      } catch {
        // If decode fails, default to v1.0
        console.log('🔍 QR version detection failed, defaulting to v1.0');
        return false;
      }
    } catch (error) {
      console.error('QR version detection error:', error);
      return false; // Default to v1.0
    }
  }
}

export default QRScannerManager;
