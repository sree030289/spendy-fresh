// src/services/qr/QRScannerManager.ts
import { Alert } from 'react-native';
import { QRCodeService } from './QRCodeService';

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
    // Prevent multiple rapid scans
    if (this.state.isProcessing || this.state.hasScanned) {
      return {
        success: false,
        error: 'Already processing a QR code',
      };
    }

    this.updateState({
      isProcessing: true,
      error: null,
    });

    try {
      // Validate QR code format
      if (!this.isValidSpendyQR(qrData)) {
        throw new Error('Invalid Spendy QR code format');
      }

      // Process the QR code
      if (options?.navigation) {
        await QRCodeService.handleScannedQRWithNavigation(
          qrData, 
          currentUserId, 
          options.navigation
        );
      } else {
        await QRCodeService.handleScannedQR(qrData, currentUserId);
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
      
      this.updateState({
        isProcessing: false,
        isScanning: false, // Stop scanning on error
        error: errorMessage,
      });

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
      error: null,
    });
  }

  // Handle scan errors with user feedback
  handleScanError(error: string, onRetry?: () => void, onCancelFromAlert?: () => void): void { // Added onCancelFromAlert
    this.updateState({
      isProcessing: false,
      error,
    });

    Alert.alert(
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
    Alert.alert(
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
}

export default QRScannerManager;
