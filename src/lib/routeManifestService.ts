import { db } from './firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { RouteManifest } from '../types';
import { handleFirestoreError } from './error-handler'; // reusing error handler

export const routeManifestService = {
  getRouteManifests: async (ownerId: string): Promise<RouteManifest[]> => {
    try {
      const q = query(
        collection(db, 'route_manifests'),
        where('ownerId', '==', ownerId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RouteManifest));
    } catch (error) {
      handleFirestoreError(error, 'list', 'route_manifests');
      return [];
    }
  },

  getDriverActiveManifest: async (ownerId: string, driverId: string): Promise<RouteManifest | null> => {
    try {
      const q = query(
        collection(db, 'route_manifests'),
        where('ownerId', '==', ownerId),
        where('driverId', '==', driverId),
        where('status', 'in', ['pending', 'in_progress'])
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as RouteManifest;
    } catch (error) {
      handleFirestoreError(error, 'get', 'route_manifests');
      return null;
    }
  },

  createRouteManifest: async (data: Omit<RouteManifest, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const docRef = await addDoc(collection(db, 'route_manifests'), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, 'create', 'route_manifests');
    }
  },

  updateRouteManifest: async (id: string, data: Partial<RouteManifest>) => {
    try {
      await updateDoc(doc(db, 'route_manifests', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `route_manifests/${id}`);
    }
  },
  
  deleteRouteManifest: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'route_manifests', id));
    } catch (error) {
      handleFirestoreError(error, 'delete', `route_manifests/${id}`);
    }
  }
};
