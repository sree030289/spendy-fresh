// src/services/optimizations/PollingService.ts
// OPTIMIZATION: Replace expensive real-time listeners with efficient polling

export class PollingService {
  private static intervals = new Map<string, NodeJS.Timeout>();
  private static cache = new Map<string, { data: any; timestamp: number }>();
  
  // OPTIMIZATION: Replace onSnapshot listeners with polling for less critical data
  static startPolling<T>(
    key: string,
    fetchFn: () => Promise<T>,
    callback: (data: T) => void,
    intervalMs: number = 30000, // Default 30 seconds
    cacheMs: number = 15000 // Cache for 15 seconds
  ): () => void {
    
    // Clear existing interval if one exists
    this.stopPolling(key);
    
    const poll = async () => {
      try {
        const cached = this.cache.get(key);
        const now = Date.now();
        
        // Use cache if fresh enough
        if (cached && (now - cached.timestamp) < cacheMs) {
          callback(cached.data);
          return;
        }
        
        // Fetch fresh data
        const data = await fetchFn();
        this.cache.set(key, { data, timestamp: now });
        callback(data);
        
      } catch (error) {
        console.error(`Polling error for ${key}:`, error);
      }
    };
    
    // Initial poll
    poll();
    
    // Set up interval
    const interval = setInterval(poll, intervalMs);
    this.intervals.set(key, interval);
    
    // Return cleanup function
    return () => this.stopPolling(key);
  }
  
  static stopPolling(key: string): void {
    const interval = this.intervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(key);
    }
    this.cache.delete(key);
  }
  
  static stopAllPolling(): void {
    for (const [key, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    this.cache.clear();
  }
  
  // OPTIMIZATION: Smart polling that adjusts frequency based on activity
  static startSmartPolling<T>(
    key: string,
    fetchFn: () => Promise<T>,
    callback: (data: T) => void,
    baseIntervalMs: number = 30000,
    fastIntervalMs: number = 10000
  ): () => void {
    
    let isActive = false;
    let currentInterval = baseIntervalMs;
    
    // Detect user activity
    const activityEvents = ['touchstart', 'mousedown', 'keydown', 'focus'];
    const onActivity = () => {
      isActive = true;
      setTimeout(() => { isActive = false; }, 60000); // Reset after 1 minute
    };
    
    activityEvents.forEach(event => {
      document?.addEventListener?.(event, onActivity, { passive: true });
    });
    
    let intervalId: NodeJS.Timeout;
    
    const poll = async () => {
      try {
        const data = await fetchFn();
        callback(data);
        
        // Adjust polling frequency based on activity
        const newInterval = isActive ? fastIntervalMs : baseIntervalMs;
        if (newInterval !== currentInterval) {
          currentInterval = newInterval;
          clearInterval(intervalId);
          intervalId = setInterval(poll, currentInterval);
        }
        
      } catch (error) {
        console.error(`Smart polling error for ${key}:`, error);
      }
    };
    
    // Initial poll and set interval
    poll();
    intervalId = setInterval(poll, currentInterval);
    this.intervals.set(key, intervalId);
    
    return () => {
      this.stopPolling(key);
      activityEvents.forEach(event => {
        document?.removeEventListener?.(event, onActivity);
      });
    };
  }
  
  // OPTIMIZATION: Batch polling for related data
  static startBatchPolling<T>(
    batchKey: string,
    fetchOperations: Array<{ key: string; fetchFn: () => Promise<T>; callback: (data: T) => void }>,
    intervalMs: number = 45000 // Slightly longer for batch operations
  ): () => void {
    
    const poll = async () => {
      try {
        // Execute all fetch operations in parallel
        const results = await Promise.allSettled(
          fetchOperations.map(async (op) => {
            const data = await op.fetchFn();
            return { ...op, data };
          })
        );
        
        // Process results and call callbacks
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const { callback, data } = result.value;
            callback(data);
          } else {
            console.error(`Batch polling error for ${fetchOperations[index].key}:`, result.reason);
          }
        });
        
      } catch (error) {
        console.error(`Batch polling error for ${batchKey}:`, error);
      }
    };
    
    // Initial poll and set interval
    poll();
    const interval = setInterval(poll, intervalMs);
    this.intervals.set(batchKey, interval);
    
    return () => this.stopPolling(batchKey);
  }
}