import AsyncStorage from '@react-native-async-storage/async-storage';

// Debug helper to check and reset tour state
export class TourDebugger {
  static async checkTourState() {
    try {
      const tourCompleted = await AsyncStorage.getItem('app_tour_completed');
      console.log('🔍 Tour Debug - Tour completed:', tourCompleted);
      return tourCompleted;
    } catch (error) {
      console.log('❌ Tour Debug - Error checking tour state:', error);
      return null;
    }
  }

  static async resetTourState() {
    try {
      await AsyncStorage.removeItem('app_tour_completed');
      console.log('✅ Tour Debug - Tour state reset');
      return true;
    } catch (error) {
      console.log('❌ Tour Debug - Error resetting tour state:', error);
      return false;
    }
  }

  static async markTourCompleted() {
    try {
      await AsyncStorage.setItem('app_tour_completed', 'true');
      console.log('✅ Tour Debug - Tour marked as completed');
      return true;
    } catch (error) {
      console.log('❌ Tour Debug - Error marking tour completed:', error);
      return false;
    }
  }
}
