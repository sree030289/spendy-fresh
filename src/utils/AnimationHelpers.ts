// src/utils/AnimationHelpers.ts
import { Alert } from 'react-native';

export interface FullScreenSuccessOptions {
  title: string;
  message: string;
  subtitle?: string;
  buttonText?: string;
  onContinue?: () => void;
}

export interface FullScreenErrorOptions {
  title: string;
  message: string;
  subtitle?: string;
  errorCode?: string;
  onRestart?: () => void;
}

/**
 * Predefined success animations for common app actions
 */
export const SuccessAnimations = {
  // Expense related
  expenseAdded: (groupName?: string, onViewGroup?: () => void): FullScreenSuccessOptions => ({
    title: 'Expense Added! 🧾',
    message: 'Expense has been split successfully!',
    subtitle: groupName ? `Added to ${groupName}` : 'Check your groups for updates',
    buttonText: groupName ? 'View Group' : 'Continue',
    onContinue: onViewGroup,
  }),

  expenseUpdated: (onViewGroup?: () => void): FullScreenSuccessOptions => ({
    title: 'Expense Updated! ✏️',
    message: 'Changes have been saved successfully!',
    subtitle: 'All group members have been notified',
    buttonText: 'View Group',
    onContinue: onViewGroup,
  }),

  expenseDeleted: (): FullScreenSuccessOptions => ({
    title: 'Expense Deleted! 🗑️',
    message: 'Expense has been removed successfully!',
    subtitle: 'Group balances have been updated',
    buttonText: 'Continue',
  }),

  // Group related
  groupCreated: (groupName: string, memberCount: number, onViewGroups?: () => void): FullScreenSuccessOptions => ({
    title: 'Group Created! 🎉',
    message: `"${groupName}" is ready to use!`,
    subtitle: `${memberCount} member${memberCount > 1 ? 's' : ''} ready to split expenses`,
    buttonText: 'View Groups',
    onContinue: onViewGroups,
  }),

  groupJoined: (groupName: string, onViewGroup?: () => void): FullScreenSuccessOptions => ({
    title: 'Welcome! 🎊',
    message: `You've joined "${groupName}"!`,
    subtitle: 'Start splitting expenses with your group',
    buttonText: 'View Group',
    onContinue: onViewGroup,
  }),

  groupLeft: (): FullScreenSuccessOptions => ({
    title: 'Group Left',
    message: 'You have left the group successfully',
    subtitle: 'Your balances have been cleared',
    buttonText: 'Continue',
  }),

  // Friend related
  friendAdded: (friendName: string, onViewFriends?: () => void): FullScreenSuccessOptions => ({
    title: 'Friend Added! 🤝',
    message: `${friendName} is now your friend!`,
    subtitle: 'You can now split expenses together',
    buttonText: 'View Friends',
    onContinue: onViewFriends,
  }),

  friendRequestSent: (onViewFriends?: () => void): FullScreenSuccessOptions => ({
    title: 'Request Sent! 📤',
    message: 'Friend request has been sent!',
    subtitle: 'They will be notified about your request',
    buttonText: 'View Friends',
    onContinue: onViewFriends,
  }),

  friendRequestAccepted: (friendName: string, onViewFriends?: () => void): FullScreenSuccessOptions => ({
    title: 'Success! 🤝',
    message: `You're now friends with ${friendName}!`,
    subtitle: 'You can now split expenses together',
    buttonText: 'View Friends',
    onContinue: onViewFriends,
  }),

  friendInviteSent: (method: string): FullScreenSuccessOptions => ({
    title: 'Invitation Sent! 📧',
    message: `Invitation sent via ${method}!`,
    subtitle: 'They will receive a link to join Spendy',
    buttonText: 'Continue',
  }),

  friendRemoved: (): FullScreenSuccessOptions => ({
    title: 'Friend Removed',
    message: 'Friend has been removed from your list',
    subtitle: 'Shared balances have been cleared',
    buttonText: 'Continue',
  }),

  // Payment related
  paymentSent: (amount: string, currency: string, friendName: string): FullScreenSuccessOptions => ({
    title: 'Payment Sent! 💰',
    message: `${currency}${amount} sent to ${friendName}`,
    subtitle: 'Payment has been processed successfully',
    buttonText: 'Continue',
  }),

  paymentReceived: (amount: string, currency: string, friendName: string): FullScreenSuccessOptions => ({
    title: 'Payment Received! 💳',
    message: `${currency}${amount} received from ${friendName}`,
    subtitle: 'Your balance has been updated',
    buttonText: 'Continue',
  }),

  settlementComplete: (groupName?: string): FullScreenSuccessOptions => ({
    title: 'Settled Up! ✅',
    message: 'All balances have been settled!',
    subtitle: groupName ? `"${groupName}" is now settled` : 'You\'re all caught up',
    buttonText: 'Continue',
  }),

  reminderSent: (friendName: string, method: string): FullScreenSuccessOptions => ({
    title: 'Reminder Sent! 🔔',
    message: `Reminder sent to ${friendName}`,
    subtitle: `Notification sent via ${method}`,
    buttonText: 'Continue',
  }),

  // Data related
  dataExported: (format: string): FullScreenSuccessOptions => ({
    title: 'Export Complete! 📄',
    message: `Data exported as ${format.toUpperCase()} file`,
    subtitle: 'Check your downloads folder',
    buttonText: 'Continue',
  }),

  dataImported: (source: string, itemCount: number): FullScreenSuccessOptions => ({
    title: 'Import Complete! 📥',
    message: `Imported ${itemCount} items from ${source}`,
    subtitle: 'Your data has been synchronized',
    buttonText: 'Continue',
  }),
};

/**
 * Predefined error animations for common app failures
 */
export const ErrorAnimations = {
  // Critical errors that require app restart
  criticalError: (details?: string): FullScreenErrorOptions => ({
    title: 'Critical Error',
    message: 'The app encountered a critical error and needs to restart.',
    subtitle: 'Please restart the app to continue safely.',
    errorCode: 'CRITICAL_001',
  }),

  memoryError: (): FullScreenErrorOptions => ({
    title: 'Memory Issue',
    message: 'The app is using too much memory.',
    subtitle: 'Please restart for optimal performance.',
    errorCode: 'MEMORY_001',
  }),

  syncError: (): FullScreenErrorOptions => ({
    title: 'Sync Error',
    message: 'There was a problem syncing your data.',
    subtitle: 'A restart will help resolve this issue.',
    errorCode: 'SYNC_001',
  }),

  networkCritical: (): FullScreenErrorOptions => ({
    title: 'Connection Lost',
    message: 'The app lost connection and needs to restart.',
    subtitle: 'Please check your internet and restart the app.',
    errorCode: 'NETWORK_001',
  }),

  updateRequired: (): FullScreenErrorOptions => ({
    title: 'Update Required',
    message: 'This version of the app is no longer supported.',
    subtitle: 'Please restart to check for available updates.',
    errorCode: 'VERSION_001',
  }),

  securityError: (): FullScreenErrorOptions => ({
    title: 'Security Issue',
    message: 'A security check failed and the app needs to restart.',
    subtitle: 'This helps keep your data safe.',
    errorCode: 'SECURITY_001',
  }),
};

/**
 * Helper function to show standard confirmation dialogs before critical actions
 */
export const showConfirmationDialog = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  confirmText: string = 'Confirm',
  cancelText: string = 'Cancel'
) => {
  Alert.alert(
    title,
    message,
    [
      { text: cancelText, style: 'cancel', onPress: onCancel },
      { text: confirmText, style: 'default', onPress: onConfirm },
    ]
  );
};

/**
 * Helper function to show destructive action confirmations
 */
export const showDestructiveConfirmation = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  confirmText: string = 'Delete'
) => {
  Alert.alert(
    title,
    message,
    [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: confirmText, style: 'destructive', onPress: onConfirm },
    ]
  );
};
