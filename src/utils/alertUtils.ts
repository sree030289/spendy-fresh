import { Alert, Platform } from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

/**
 * Cross-platform alert utility that works on React Native and Web
 * Falls back to browser's native alert/confirm for web platforms
 */
export class CrossPlatformAlert {
  /**
   * Show an alert with title, message and optional buttons
   * For web: Uses browser's alert() or confirm() based on button configuration
   * For mobile: Uses React Native's Alert.alert()
   */
  static alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { cancelable?: boolean }
  ): void {
    if (Platform.OS === 'web') {
      // For web platform, use browser's native dialogs
      if (!buttons || buttons.length === 0) {
        // Simple alert with just OK button
        window.alert(`${title}${message ? '\n\n' + message : ''}`);
        return;
      }

      if (buttons.length === 1) {
        // Single button - use simple alert
        const button = buttons[0];
        window.alert(`${title}${message ? '\n\n' + message : ''}`);
        if (button.onPress) {
          button.onPress();
        }
        return;
      }

      if (buttons.length === 2) {
        // Two buttons - use confirm dialog
        const confirmText = `${title}${message ? '\n\n' + message : ''}`;
        
        // Find which button is the confirm action (not cancel style)
        const cancelButton = buttons.find(btn => btn.style === 'cancel');
        const confirmButton = buttons.find(btn => btn.style !== 'cancel');
        
        const result = window.confirm(confirmText);
        
        if (result && confirmButton?.onPress) {
          confirmButton.onPress();
        } else if (!result && cancelButton?.onPress) {
          cancelButton.onPress();
        }
        return;
      }

      // More than 2 buttons - fallback to simple alert with numbered options
      let alertText = `${title}${message ? '\n\n' + message : ''}\n\nOptions:\n`;
      buttons.forEach((button, index) => {
        alertText += `${index + 1}. ${button.text}\n`;
      });
      alertText += '\nPlease note the option and refresh the page to try again.';
      window.alert(alertText);
      
    } else {
      // For React Native platforms, use the native Alert
      Alert.alert(title, message, buttons, options);
    }
  }

  /**
   * Show a confirmation dialog with custom confirm and cancel buttons
   * Returns true if confirmed, false if cancelled
   */
  static confirm(
    title: string,
    message?: string,
    confirmText: string = 'OK',
    cancelText: string = 'Cancel'
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (Platform.OS === 'web') {
        const result = window.confirm(`${title}${message ? '\n\n' + message : ''}`);
        resolve(result);
      } else {
        Alert.alert(
          title,
          message,
          [
            {
              text: cancelText,
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: confirmText,
              onPress: () => resolve(true),
            },
          ]
        );
      }
    });
  }

  /**
   * Show a simple alert message (equivalent to Alert.alert with just title and message)
   */
  static info(title: string, message?: string): void {
    this.alert(title, message);
  }

  /**
   * Show an error alert with error styling
   */
  static error(title: string, message?: string): void {
    this.alert(title, message);
  }

  /**
   * Show a success alert
   */
  static success(title: string, message?: string): void {
    this.alert(title, message);
  }
}

// Export as default and named export for convenience
export default CrossPlatformAlert;
export { CrossPlatformAlert as Alert };
