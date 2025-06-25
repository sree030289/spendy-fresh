// src/services/BalanceManager.ts - SIMPLIFIED VERSION
import { useBalances } from '@/hooks/useBalances';

export default class BalanceManager {
  private static instance: BalanceManager;
  
  static getInstance(): BalanceManager {
    if (!BalanceManager.instance) {
      BalanceManager.instance = new BalanceManager();
    }
    return BalanceManager.instance;
  }

  // Simplified notification method - delegates to useBalances hook
  notifyBalanceChange(userId: string): void {
    console.log('🔔 BalanceManager: Balance change notification for user:', userId);
    // The actual refresh is now handled by the useBalances hook
    // This method exists for backward compatibility
  }

  // Cleanup method for compatibility
  dispose(): void {
    console.log('🧹 BalanceManager: Cleanup called');
  }
}