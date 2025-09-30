// src/services/database/index.ts - Environment-aware database service
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Firestore
} from 'firebase/firestore';
import { getFirebaseFirestore } from '../firebase/config';
import { ENV } from '../../config/environment';

class DatabaseService {
  private static instance: DatabaseService;
  private firestore: Firestore | null = null;

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Initialize the database service
   */
  async initialize(): Promise<void> {
    if (!this.firestore) {
      this.firestore = await getFirebaseFirestore();
      console.log(`📊 Database service initialized for: ${ENV.environment}`);
    }
  }

  /**
   * Get Firestore instance
   */
  private async getFirestore(): Promise<Firestore> {
    if (!this.firestore) {
      await this.initialize();
    }
    return this.firestore!;
  }

  /**
   * Create a new document
   */
  async create(collectionName: string, data: any, documentId?: string): Promise<string> {
    const db = await this.getFirestore();
    
    if (documentId) {
      await setDoc(doc(db, collectionName, documentId), data);
      return documentId;
    } else {
      const docRef = await addDoc(collection(db, collectionName), data);
      return docRef.id;
    }
  }

  /**
   * Read a document by ID
   */
  async read(collectionName: string, documentId: string): Promise<any | null> {
    const db = await this.getFirestore();
    const docRef = doc(db, collectionName, documentId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  }

  /**
   * Update a document
   */
  async update(collectionName: string, documentId: string, data: any): Promise<void> {
    const db = await this.getFirestore();
    const docRef = doc(db, collectionName, documentId);
    await updateDoc(docRef, data);
  }

  /**
   * Delete a document
   */
  async delete(collectionName: string, documentId: string): Promise<void> {
    const db = await this.getFirestore();
    const docRef = doc(db, collectionName, documentId);
    await deleteDoc(docRef);
  }

  /**
   * Query documents with filters
   */
  async query(
    collectionName: string, 
    filters: Array<{ field: string; operator: any; value: any }> = [],
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'asc',
    limitCount?: number
  ): Promise<any[]> {
    const db = await this.getFirestore();
    let q = collection(db, collectionName);
    
    // Apply filters
    for (const filter of filters) {
      q = query(q, where(filter.field, filter.operator, filter.value)) as any;
    }
    
    // Apply ordering
    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDirection)) as any;
    }
    
    // Apply limit
    if (limitCount) {
      q = query(q, limit(limitCount)) as any;
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get all documents in a collection
   */
  async getAll(collectionName: string): Promise<any[]> {
    return this.query(collectionName);
  }

  /**
   * Check if a document exists
   */
  async exists(collectionName: string, documentId: string): Promise<boolean> {
    const db = await this.getFirestore();
    const docRef = doc(db, collectionName, documentId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  }

  /**
   * Get environment information
   */
  getEnvironmentInfo() {
    return {
      environment: ENV.environment,
      projectId: ENV.firebase.projectId,
      useEmulator: ENV.firebase.useEmulator,
    };
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();

// Export convenience methods
export const initializeDatabase = () => databaseService.initialize();
export const createDocument = (collection: string, data: any, id?: string) => 
  databaseService.create(collection, data, id);
export const readDocument = (collection: string, id: string) => 
  databaseService.read(collection, id);
export const updateDocument = (collection: string, id: string, data: any) => 
  databaseService.update(collection, id, data);
export const deleteDocument = (collection: string, id: string) => 
  databaseService.delete(collection, id);
export const queryDocuments = (
  collection: string, 
  filters?: Array<{ field: string; operator: any; value: any }>,
  orderByField?: string,
  orderDirection?: 'asc' | 'desc',
  limitCount?: number
) => databaseService.query(collection, filters, orderByField, orderDirection, limitCount);

// Export the class for advanced usage
export { DatabaseService };
