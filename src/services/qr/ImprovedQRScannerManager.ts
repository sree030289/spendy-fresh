// src/services/qr/ImprovedQRScannerManager.ts
import { SecureQRService } from './SecureQRService';
import { CrossPlatformAlert } from '@/utils/alertUtils';

export interface ScannerState {
  status: 'idle' | 'scanning' | 'processing' | 'success' | 'error';
  isProcessing: boolean;
  hasScanned: boolean;
  error: string | null;
  lastScanTime: number | null;
}

export interface ScanResult {
  success: boolean;
  message: string;
  shouldCloseScanner?: boolean;
  shouldShowModal?: boolean;
  navigationAction?: {
    type: 'group_details' | 'friend_requests';
    groupId?: string;
  };
}

export class ImprovedQRScannerManager {
  private static instance: ImprovedQRScannerManager;
  private state: ScannerState = {
    status: 'idle',
    isProcessing: false,
    hasScanned: false,
    error: null,
    lastScanTime: null,
  };
  
  private stateListeners: Set<(state: ScannerState) => void> = new Set();
  private currentAlert: any = null; // Track current alert
  private scanTimeout: NodeJS.Timeout | null = null;
  private readonly SCAN_COOLDOWN = 3000; // 3 seconds between scans
  private readonly PROCESSING_TIMEOUT = 30000; // 30 seconds max processing time

  static getInstance(): ImprovedQRScannerManager {
    if (!ImprovedQRScannerManager.instance) {
      ImprovedQRScannerManager.instance = new ImprovedQRScannerManager();
    }
    return ImprovedQRScannerManager.instance;
  }

  // Subscribe to state changes
  subscribe(listener: (state: ScannerState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  // Update state atomically and notify listeners
  private updateState(newState: Partial<ScannerState>): void {
    this.state = { ...this.state, ...newState };
    this.stateListeners.forEach(listener => listener(this.state));
  }

  // Get current state (immutable copy)
  getState(): ScannerState {
    return { ...this.state };
  }

  // Start scanning session
  startScanning(): void {
    this.clearAlert();
    this.clearTimeouts();
    
    this.updateState({
      status: 'scanning',
      isProcessing: false,
      hasScanned: false,
      error: null,
      lastScanTime: null,
    });
  }

  // Stop scanning session
  stopScanning(): void {
    this.clearAlert();
    this.clearTimeouts();
    
    this.updateState({
      status: 'idle',
      isProcessing: false,
      hasScanned: false,
      error: null,
      lastScanTime: null,
    });
  }

  // Check if scanner can process new scan
  canProcessScan(): boolean {
    const now = Date.now();
    
    // Prevent rapid successive scans
    if (this.state.lastScanTime && (now - this.state.lastScanTime) < this.SCAN_COOLDOWN) {
      return false;
    }
    
    // Don't allow if already processing
    if (this.state.isProcessing || this.state.status === 'processing') {
      return false;
    }
    
    return true;
  }

  // Process scanned QR code with race condition protection
  async processQRCode(qrData: string, currentUserId: string): Promise<ScanResult> {
    // Prevent duplicate processing
    if (!this.canProcessScan()) {
      return {
        success: false,
        message: 'Please wait before scanning another QR code...',
      };
    }

    // Clear any existing alerts
    this.clearAlert();

    // Set processing state immediately
    this.updateState({
      status: 'processing',
      isProcessing: true,
      hasScanned: true,
      lastScanTime: Date.now(),
      error: null,
    });

    // Set processing timeout
    this.scanTimeout = setTimeout(() => {
      if (this.state.isProcessing) {
        this.updateState({
          status: 'error',
          isProcessing: false,
          error: 'Processing timed out. Please try again.',
        });
      }
    }, this.PROCESSING_TIMEOUT);

    try {
      const qrService = SecureQRService.getInstance();
      const result = await qrService.processScannedQR(qrData, currentUserId);

      this.clearTimeouts();

      if (result.success) {
        this.updateState({
          status: 'success',
          isProcessing: false,
          error: null,
        });

        return {
          success: true,
          message: result.message,
          shouldCloseScanner: true,
          shouldShowModal: result.shouldShowModal,
          navigationAction: result.navigationAction,
        };
      } else {
        this.updateState({
          status: 'error',
          isProcessing: false,
          error: result.message,
        });

        return {
          success: false,
          message: result.message,
          shouldCloseScanner: false,
        };
      }

    } catch (error: any) {
      this.clearTimeouts();
      
      const errorMessage = error.message || 'Failed to process QR code';
      
      this.updateState({
        status: 'error',
        isProcessing: false,
        error: errorMessage,
      });

      return {
        success: false,
        message: errorMessage,
        shouldCloseScanner: false,
      };
    }
  }

  // Show success message with proper cleanup
  showSuccessMessage(message: string, onClose?: () => void): void {
    this.clearAlert();
    
    this.currentAlert = CrossPlatformAlert.alert(
      'Success! 🎉',
      message,
      [{
        text: 'OK',
        onPress: () => {
          this.clearAlert();
          this.resetScanner();
          onClose?.();
        },
      }]
    );
  }

  // Show error message with retry option
  showErrorMessage(
    message: string, 
    onRetry?: () => void, 
    onCancel?: () => void
  ): void {
    this.clearAlert();
    
    const buttons: any[] = [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          this.clearAlert();
          this.resetScanner();
          onCancel?.();
        },
      },
    ];

    if (onRetry) {
      buttons.push({
        text: 'Try Again',
        onPress: () => {
          this.clearAlert();
          this.resetForNewScan();
          onRetry();
        },
      });
    }

    this.currentAlert = CrossPlatformAlert.alert(
      'QR Code Error',
      message,
      buttons
    );
  }

  // Reset scanner for new scan
  resetForNewScan(): void {
    this.clearAlert();
    this.clearTimeouts();
    
    this.updateState({
      status: 'scanning',
      isProcessing: false,
      hasScanned: false,
      error: null,
      lastScanTime: null,
    });
  }

  // Reset scanner to idle
  resetScanner(): void {
    this.clearAlert();
    this.clearTimeouts();
    
    this.updateState({
      status: 'idle',
      isProcessing: false,
      hasScanned: false,
      error: null,
      lastScanTime: null,
    });
  }

  // Clear any existing alert
  private clearAlert(): void {
    if (this.currentAlert) {
      // CrossPlatformAlert doesn't provide dismiss method, but we track it
      this.currentAlert = null;
    }
  }

  // Clear all timeouts
  private clearTimeouts(): void {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
  }

  // Check if scanner is busy
  isBusy(): boolean {
    return this.state.isProcessing || this.state.status === 'processing';
  }

  // Get human readable status
  getStatusMessage(): string {
    switch (this.state.status) {
      case 'idle':
        return 'Ready to scan';
      case 'scanning':
        return 'Position QR code in frame';
      case 'processing':
        return 'Processing QR code...';
      case 'success':
        return 'QR code processed successfully!';
      case 'error':
        return this.state.error || 'Scan failed';
      default:
        return 'Ready to scan';
    }
  }

  // Cleanup when manager is destroyed
  destroy(): void {
    this.clearAlert();
    this.clearTimeouts();
    this.stateListeners.clear();
    this.resetScanner();
  }
}

export default ImprovedQRScannerManager;