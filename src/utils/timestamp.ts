/**
 * Timestamp conversion utilities for handling API responses
 * Converts ISO string timestamps back to Date objects
 */

const TIMESTAMP_FIELDS = [
  'createdAt',
  'updatedAt', 
  'date',
  'joinedAt',
  'leftAt',
  'lastLoginAt',
  'readAt'
];

/**
 * Converts ISO string timestamps to Date objects in API responses
 * @param data - The data to process (object, array, or primitive)
 * @returns The data with timestamp fields converted to Date objects
 */
export function convertApiTimestamps(data: any): any {
  if (!data) return data;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => convertApiTimestamps(item));
  }

  // Handle objects
  if (typeof data === 'object' && data !== null) {
    const result: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (TIMESTAMP_FIELDS.includes(key) && typeof value === 'string') {
        // Convert ISO string to Date object
        try {
          result[key] = new Date(value);
        } catch (error) {
          console.warn(`Failed to convert timestamp field ${key}:`, value);
          result[key] = value;
        }
      } else {
        // Recursively process nested objects/arrays
        result[key] = convertApiTimestamps(value);
      }
    }
    
    return result;
  }

  // Return primitive values as-is
  return data;
}

/**
 * Type guard to check if a value is a valid Date object
 */
export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Safely get timestamp from a date field that might be Date or string
 */
export function safeGetTime(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  
  if (typeof date === 'string') {
    const parsedDate = new Date(date);
    return isValidDate(parsedDate) ? parsedDate.getTime() : null;
  }
  
  return isValidDate(date) ? date.getTime() : null;
}

/**
 * Safely format any timestamp to a localized date string
 */
export const formatTimestamp = (timestamp: any, fallback = 'Unknown'): string => {
  if (!timestamp) return fallback;
  
  try {
    // Handle Date objects
    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString();
    }
    
    // Handle custom date objects with _isDate + timestamp
    if (timestamp && typeof timestamp === 'object' && timestamp._isDate && timestamp.timestamp) {
      return new Date(timestamp.timestamp).toLocaleDateString();
    }
    
    // Handle Firebase timestamps with _seconds
    if (timestamp && typeof timestamp === 'object' && timestamp._seconds) {
      return new Date(timestamp._seconds * 1000).toLocaleDateString();
    }
    
    // Handle Firebase timestamps with seconds property
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString();
    }
    
    // Handle Firebase timestamps with toDate method
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleDateString();
    }
    
    // Handle string or number timestamps
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
    }
    
    return fallback;
  } catch (error) {
    console.warn('Error formatting timestamp:', timestamp, error);
    return fallback;
  }
};

/**
 * Safely format any timestamp to a localized date and time string
 */
export const formatTimestampWithTime = (timestamp: any, fallback = 'Unknown'): string => {
  if (!timestamp) return fallback;
  
  try {
    // Handle Date objects
    if (timestamp instanceof Date) {
      return timestamp.toLocaleString();
    }
    
    // Handle custom date objects with _isDate + timestamp
    if (timestamp && typeof timestamp === 'object' && timestamp._isDate && timestamp.timestamp) {
      return new Date(timestamp.timestamp).toLocaleString();
    }
    
    // Handle Firebase timestamps with _seconds
    if (timestamp && typeof timestamp === 'object' && timestamp._seconds) {
      return new Date(timestamp._seconds * 1000).toLocaleString();
    }
    
    // Handle Firebase timestamps with seconds property
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    
    // Handle Firebase timestamps with toDate method
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleString();
    }
    
    // Handle string or number timestamps
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString();
      }
    }
    
    return fallback;
  } catch (error) {
    console.warn('Error formatting timestamp with time:', timestamp, error);
    return fallback;
  }
};
