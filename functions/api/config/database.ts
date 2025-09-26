// src/config/database.ts
import { db } from './firebase';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  FRIENDS: 'friends',
  FRIEND_REQUESTS: 'friendRequests',
  GROUPS: 'groups',
  EXPENSES: 'expenses',
  NOTIFICATIONS: 'notifications',
  REMINDERS: 'reminders',
  PAYMENTS: 'payments',
  BANK_ACCOUNTS: 'bankAccounts',
  TRANSACTIONS: 'transactions',
  SUBSCRIPTIONS: 'subscriptions',
  DEALS: 'deals',
  PENDING_INVITATIONS: 'pendingInvitations',
  GROUP_MESSAGES: 'groupMessages',
  SETTLEMENTS: 'settlements',
  ANALYTICS: 'analytics',
  UNIFIED_INVITES: 'unifiedInvites'
} as const;

// Helper functions for Firestore operations
export class DatabaseService {
  static async createDocument(collection: string, data: any, id?: string) {
    try {
      const timestamp = new Date();
      const docData = {
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      if (id) {
        await db.collection(collection).doc(id).set(docData);
        return id;
      } else {
        const docRef = await db.collection(collection).add(docData);
        return docRef.id;
      }
    } catch (error) {
      console.error(`Error creating document in ${collection}:`, error);
      throw error;
    }
  }

  static async updateDocument(collection: string, id: string, data: any) {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date()
      };
      await db.collection(collection).doc(id).update(updateData);
      return true;
    } catch (error) {
      console.error(`Error updating document ${id} in ${collection}:`, error);
      throw error;
    }
  }

  static async getDocument(collection: string, id: string) {
    try {
      const doc = await db.collection(collection).doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error(`Error getting document ${id} from ${collection}:`, error);
      throw error;
    }
  }

  static async deleteDocument(collection: string, id: string) {
    try {
      await db.collection(collection).doc(id).delete();
      return true;
    } catch (error) {
      console.error(`Error deleting document ${id} from ${collection}:`, error);
      throw error;
    }
  }

  static async queryDocuments(
    collection: string, 
    filters: Array<{ field: string; operator: any; value: any }> | Record<string, any> = [],
    orderBy?: { field: string; direction: 'asc' | 'desc' },
    limit?: number
  ) {
    try {
      let query: any = db.collection(collection);

      // Handle both array and object filters
      if (Array.isArray(filters)) {
        // Apply filters
        filters.forEach(filter => {
          query = query.where(filter.field, filter.operator, filter.value);
        });
      } else {
        // Handle object-style queries (simpler format)
        Object.entries(filters).forEach(([field, value]) => {
          if (field === '$or') {
            // Handle $or queries by creating multiple queries and combining results
            // Note: Firestore doesn't support OR queries directly, so we need to handle this differently
            throw new Error('$or queries need special handling in this implementation');
          } else if (typeof value === 'object' && value !== null) {
            // Handle operators like { $ne: value }, { $in: array }, etc.
            Object.entries(value).forEach(([operator, operatorValue]) => {
              let firestoreOperator = operator.replace('$', '');
              if (firestoreOperator === 'ne') firestoreOperator = '!=';
              if (firestoreOperator === 'in') firestoreOperator = 'in';
              if (firestoreOperator === 'regex') {
                // For regex, we'll use >= and < for text search
                query = query.where(field, '>=', operatorValue)
                             .where(field, '<', operatorValue + '\uf8ff');
                return;
              }
              query = query.where(field, firestoreOperator, operatorValue);
            });
          } else {
            query = query.where(field, '==', value);
          }
        });
      }

      // Apply ordering
      if (orderBy) {
        query = query.orderBy(orderBy.field, orderBy.direction);
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`Error querying documents from ${collection}:`, error);
      throw error;
    }
  }

  // Special method to handle $or queries
  static async queryDocumentsWithOr(
    collection: string,
    orConditions: Array<Record<string, any>>,
    orderBy?: { field: string; direction: 'asc' | 'desc' },
    limit?: number
  ) {
    try {
      // Execute multiple queries for OR conditions
      const promises = orConditions.map(condition => 
        this.queryDocuments(collection, condition, orderBy, limit)
      );
      
      const results = await Promise.all(promises);
      
      // Combine and deduplicate results
      const combined = results.flat();
      const uniqueResults = combined.filter((item, index, arr) => 
        arr.findIndex(i => i.id === item.id) === index
      );
      
      // Apply limit to combined results if specified
      return limit ? uniqueResults.slice(0, limit) : uniqueResults;
    } catch (error) {
      console.error(`Error querying documents with OR from ${collection}:`, error);
      throw error;
    }
  }

  static async batchWrite(operations: Array<{
    type: 'create' | 'update' | 'delete';
    collection: string;
    id?: string;
    data?: any;
  }>) {
    try {
      const batch = db.batch();
      const timestamp = new Date();

      operations.forEach(op => {
        const docRef = op.id 
          ? db.collection(op.collection).doc(op.id)
          : db.collection(op.collection).doc();

        switch (op.type) {
          case 'create':
            batch.set(docRef, {
              ...op.data,
              createdAt: timestamp,
              updatedAt: timestamp
            });
            break;
          case 'update':
            batch.update(docRef, {
              ...op.data,
              updatedAt: timestamp
            });
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error in batch write:', error);
      throw error;
    }
  }
}

export { db };
