import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataService } from './dataService';
import { Expense, Income, Reminder } from '@/types';

export class MigrationService {
  private static instance: MigrationService;

  static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  /**
   * Migrates old Smart Money data (without user IDs) to user-specific data
   * This should be called when a user logs in for the first time after the update
   */
  async migrateToUserSpecificData(userId: string): Promise<boolean> {
    try {
      console.log('🔄 Starting Smart Money data migration for user:', userId);

      // Check if migration has already been done for this user
      const migrationKey = `smart_money_migrated_${userId}`;
      const alreadyMigrated = await AsyncStorage.getItem(migrationKey);
      
      if (alreadyMigrated === 'true') {
        console.log('✅ Migration already completed for user:', userId);
        return true;
      }

      // Get old data from legacy keys
      const [oldExpenses, oldIncome, oldReminders] = await Promise.all([
        this.getLegacyData('smart_money_expenses'),
        this.getLegacyData('smart_money_income'),
        this.getLegacyData('smart_money_reminders')
      ]);

      let migratedCount = 0;
      const dataService = DataService.getInstance();

      // Migrate expenses
      if (oldExpenses && oldExpenses.length > 0) {
        console.log('📦 Migrating', oldExpenses.length, 'expenses...');
        for (const expense of oldExpenses) {
          await dataService.saveExpense(expense as Expense, userId);
          migratedCount++;
        }
      }

      // Migrate income
      if (oldIncome && oldIncome.length > 0) {
        console.log('💰 Migrating', oldIncome.length, 'income entries...');
        for (const income of oldIncome) {
          await dataService.saveIncome(income as Income, userId);
          migratedCount++;
        }
      }

      // Migrate reminders
      if (oldReminders && oldReminders.length > 0) {
        console.log('⏰ Migrating', oldReminders.length, 'reminders...');
        for (const reminder of oldReminders) {
          await dataService.saveReminder(reminder as Reminder, userId);
          migratedCount++;
        }
      }

      // Mark migration as complete
      await AsyncStorage.setItem(migrationKey, 'true');

      // Clean up old data after successful migration
      if (migratedCount > 0) {
        await this.cleanupLegacyData();
        console.log('✅ Migration completed successfully! Migrated', migratedCount, 'items');
      } else {
        console.log('📝 No legacy data found to migrate');
      }

      return true;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return false;
    }
  }

  /**
   * Get legacy data from old storage keys
   */
  private async getLegacyData(key: string): Promise<any[] | null> {
    try {
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error(`Failed to get legacy data for ${key}:`, error);
      return null;
    }
  }

  /**
   * Clean up old storage keys after migration
   */
  private async cleanupLegacyData(): Promise<void> {
    try {
      console.log('🧹 Cleaning up legacy data...');
      await Promise.all([
        AsyncStorage.removeItem('smart_money_expenses'),
        AsyncStorage.removeItem('smart_money_income'),
        AsyncStorage.removeItem('smart_money_reminders')
      ]);
      console.log('✅ Legacy data cleanup completed');
    } catch (error) {
      console.error('❌ Failed to cleanup legacy data:', error);
    }
  }

  /**
   * Check if migration is needed for a user
   */
  async isMigrationNeeded(userId: string): Promise<boolean> {
    try {
      const migrationKey = `smart_money_migrated_${userId}`;
      const alreadyMigrated = await AsyncStorage.getItem(migrationKey);
      
      if (alreadyMigrated === 'true') {
        return false;
      }

      // Check if there's any legacy data to migrate
      const [oldExpenses, oldIncome, oldReminders] = await Promise.all([
        this.getLegacyData('smart_money_expenses'),
        this.getLegacyData('smart_money_income'),
        this.getLegacyData('smart_money_reminders')
      ]);

      const hasLegacyData = Boolean((oldExpenses && oldExpenses.length > 0) ||
                                   (oldIncome && oldIncome.length > 0) ||
                                   (oldReminders && oldReminders.length > 0));

      return hasLegacyData;
    } catch (error) {
      console.error('Failed to check migration status:', error);
      return false;
    }
  }

  /**
   * Force clear all user-specific data (for development/testing)
   */
  async clearUserData(userId: string): Promise<void> {
    try {
      console.log('🧹 Clearing user-specific Smart Money data for:', userId);
      const dataService = DataService.getInstance();
      await dataService.clearAllData(userId);
      
      // Also remove migration flag to allow re-migration if needed
      await AsyncStorage.removeItem(`smart_money_migrated_${userId}`);
      
      console.log('✅ User data cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear user data:', error);
    }
  }
}
