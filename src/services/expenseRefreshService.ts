class ExpenseRefreshService {
  private static instance: ExpenseRefreshService;
  private listeners: Set<() => void> = new Set();

  static getInstance(): ExpenseRefreshService {
    if (!ExpenseRefreshService.instance) {
      ExpenseRefreshService.instance = new ExpenseRefreshService();
    }
    return ExpenseRefreshService.instance;
  }

  // Add a listener for expense updates
  addListener(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners that expenses have been updated
  notifyExpenseAdded() {
    console.log('Notifying expense added to', this.listeners.size, 'listeners');
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in expense refresh listener:', error);
      }
    });
  }
}

export default ExpenseRefreshService;