import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  deleteDoc,
  orderBy,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { Vehicle, MaintenanceRecord, MaintenanceSchedule, VehicleLog, Checklist, Driver, Fine, CollectionRequest, UserProfile, UserRole, GlobalSettings, PurchaseRequest } from '../types';
import { handleFirestoreError } from './error-handler';

// --- Shared Notification/Cache Manager ---
// Keeps a single active listener per collection to eliminate redundant reads
// across component mount/unmount cycles.
class CachedCollection<T> {
  private cache: T[] = [];
  private hasData = false;
  private subscribers: Set<(data: T[]) => void> = new Set();
  private unsubFirestore: (() => void) | null = null;
  private q: any;
  private collectionName: string;

  constructor(queryRef: any, collectionName: string) {
    this.q = queryRef;
    this.collectionName = collectionName;
  }

  subscribe(callback: (data: T[]) => void): () => void {
    if (this.hasData) {
      callback(this.cache);
    }

    this.subscribers.add(callback);

    if (!this.unsubFirestore) {
      this.unsubFirestore = onSnapshot(this.q, (snapshot: any) => {
        this.cache = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        })) as T[];
        this.hasData = true;
        this.subscribers.forEach(cb => cb(this.cache));
      }, (error: any) => {
        handleFirestoreError(error, 'list', this.collectionName);
      });
    }

    return () => {
      this.subscribers.delete(callback);
      // We intentionally do not unsubscribe from Firestore when subscribers hit 0
      // so the cache stays warm and we don't pay 1 read/doc on next remount.
    };
  }
}

// Global cached instances
const vehiclesCache = new CachedCollection<Vehicle>(
  query(collection(db, 'vehicles'), orderBy('updatedAt', 'desc')),
  'vehicles'
);

const maintenanceRecordsCache = new CachedCollection<MaintenanceRecord>(
  query(collection(db, 'maintenance_records'), orderBy('date', 'desc')),
  'maintenance_records'
);

const maintenanceSchedulesCache = new CachedCollection<MaintenanceSchedule>(
  query(collection(db, 'maintenance_schedules'), orderBy('scheduledDate', 'asc')),
  'maintenance_schedules'
);

const vehicleLogsCache = new CachedCollection<VehicleLog>(
  query(collection(db, 'vehicle_logs'), orderBy('startTime', 'desc')),
  'vehicle_logs'
);

const collectionRequestsCache = new CachedCollection<CollectionRequest>(
  query(collection(db, 'collection_requests'), orderBy('createdAt', 'desc')),
  'collection_requests'
);

const purchaseRequestsCache = new CachedCollection<PurchaseRequest>(
  query(collection(db, 'purchase_requests'), orderBy('createdAt', 'desc')),
  'purchase_requests'
);

const driversCache = new CachedCollection<Driver>(
  query(collection(db, 'drivers'), orderBy('createdAt', 'desc')),
  'drivers'
);

const finesCache = new CachedCollection<Fine>(
  query(collection(db, 'fines'), orderBy('date', 'desc')),
  'fines'
);

const usersCache = new CachedCollection<UserProfile>(
  query(collection(db, 'users')),
  'users'
);

const invitesCache = new CachedCollection<any>(
  query(collection(db, 'invites')),
  'invites'
);

export const vehicleService = {
  subscribeToVehicles: (callback: (vehicles: Vehicle[]) => void) => {
    return vehiclesCache.subscribe(callback);
  },

  addVehicle: async (vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>, userId: string) => {
    try {
      await addDoc(collection(db, 'vehicles'), {
        ...vehicle,
        ownerId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'vehicles');
    }
  },

  updateVehicle: async (id: string, updates: Partial<Vehicle>) => {
    try {
      await updateDoc(doc(db, 'vehicles', id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `vehicles/${id}`);
    }
  },

  deleteVehicle: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'vehicles', id));
    } catch (error) {
      handleFirestoreError(error, 'delete', `vehicles/${id}`);
    }
  }
};

export const maintenanceService = {
  subscribeToRecords: (callback: (records: MaintenanceRecord[]) => void) => {
    return maintenanceRecordsCache.subscribe(callback);
  },

  addRecord: async (record: Omit<MaintenanceRecord, 'id' | 'createdAt' | 'ownerId'>, userId: string) => {
    try {
      await addDoc(collection(db, 'maintenance_records'), {
        ...record,
        ownerId: userId,
        createdAt: serverTimestamp(),
      });
      // Optionally update vehicle mileage if this service is newer
      await vehicleService.updateVehicle(record.vehicleId, { 
        currentMileage: record.mileageAtService,
        lastMaintenanceKm: record.mileageAtService 
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'maintenance_records');
    }
  },

  subscribeToSchedules: (callback: (schedules: MaintenanceSchedule[]) => void) => {
    return maintenanceSchedulesCache.subscribe(callback);
  },

  addSchedule: async (schedule: Omit<MaintenanceSchedule, 'id' | 'ownerId'>, userId: string) => {
    try {
      await addDoc(collection(db, 'maintenance_schedules'), {
        ...schedule,
        ownerId: userId,
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'maintenance_schedules');
    }
  },

  deleteSchedule: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'maintenance_schedules', id));
    } catch (error) {
      handleFirestoreError(error, 'delete', `maintenance_schedules/${id}`);
    }
  }
};

export const logService = {
  subscribeToLogs: (callback: (logs: VehicleLog[]) => void) => {
    return vehicleLogsCache.subscribe(callback);
  },

  startLog: async (log: Omit<VehicleLog, 'id' | 'startTime' | 'status' | 'ownerId'>, userId: string) => {
    try {
      const docRef = await addDoc(collection(db, 'vehicle_logs'), {
        ...log,
        status: 'active',
        ownerId: userId,
        startTime: serverTimestamp(),
      });
      // Update vehicle updatedAt
      await updateDoc(doc(db, 'vehicles', log.vehicleId), {
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, 'create', 'vehicle_logs');
    }
  },

  endLog: async (id: string, vehicleId: string, endMileage: number) => {
    try {
      const batch = writeBatch(db);
      
      // Update the log
      batch.update(doc(db, 'vehicle_logs', id), {
        endMileage,
        endTime: serverTimestamp(),
        status: 'completed',
        updatedAt: serverTimestamp()
      });
      
      // Update the vehicle's current mileage
      batch.update(doc(db, 'vehicles', vehicleId), {
        currentMileage: endMileage,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, 'update', `vehicle_logs/${id}`);
    }
  },

  updateLocation: async (id: string, lat: number, lng: number, speed?: number | null) => {
    try {
      await updateDoc(doc(db, 'vehicle_logs', id), {
        currentLat: lat,
        currentLng: lng,
        currentSpeed: speed || 0,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating location:", error);
    }
  }
};

export const purchaseRequestService = {
  subscribeToRequests: (callback: (requests: PurchaseRequest[]) => void) => {
    return purchaseRequestsCache.subscribe(callback);
  },

  addRequest: async (request: Omit<PurchaseRequest, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await addDoc(collection(db, 'purchase_requests'), {
        ...request,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'purchase_requests');
    }
  },

  updateRequest: async (id: string, updates: Partial<PurchaseRequest>) => {
    try {
      const finalUpdates = { ...updates, updatedAt: serverTimestamp() };
      await updateDoc(doc(db, 'purchase_requests', id), finalUpdates);
    } catch (error) {
      handleFirestoreError(error, 'update', 'purchase_requests');
    }
  },

  deleteRequest: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'purchase_requests', id));
    } catch (error) {
      handleFirestoreError(error, 'delete', 'purchase_requests');
    }
  }
};

export const collectionRequestService = {
  subscribeToRequests: (callback: (requests: CollectionRequest[]) => void) => {
    return collectionRequestsCache.subscribe(callback);
  },

  addRequest: async (request: Omit<CollectionRequest, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>, userId: string) => {
    try {
      await addDoc(collection(db, 'collection_requests'), {
        ...request,
        ownerId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'collection_requests');
    }
  },

  updateRequest: async (id: string, updates: Partial<CollectionRequest>) => {
    try {
      const finalUpdates = { ...updates, updatedAt: serverTimestamp() };
      
      // If status is being updated to a completed state, set completedAt
      if (updates.status === 'completed' || updates.status === 'delivered_manual') {
        (finalUpdates as any).completedAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'collection_requests', id), finalUpdates);
    } catch (error) {
      handleFirestoreError(error, 'update', `collection_requests/${id}`);
    }
  },

  assignDriver: async (requestId: string, driverId: string, vehicleId: string) => {
    try {
      await updateDoc(doc(db, 'collection_requests', requestId), {
        status: 'assigned',
        assignedDriverId: driverId,
        assignedVehicleId: vehicleId,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `collection_requests/${requestId}`);
    }
  },

  unassignRequest: async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'collection_requests', requestId), {
        status: 'pending',
        assignedDriverId: '',
        assignedVehicleId: '',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `collection_requests/${requestId}`);
    }
  },

  batchAssignDrivers: async (requestIds: string[], driverId: string, vehicleId: string) => {
    try {
      const batch = writeBatch(db);
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      requestIds.forEach(id => {
        const ref = doc(db, 'collection_requests', id);
        batch.update(ref, {
          status: 'assigned',
          assignedDriverId: driverId,
          assignedVehicleId: vehicleId,
          batchId: batchId,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, 'write', 'collection_requests_batch');
    }
  },

  deleteRequest: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'collection_requests', id));
    } catch (error) {
      handleFirestoreError(error, 'delete', `collection_requests/${id}`);
    }
  }
};

export const checklistService = {
  saveChecklist: async (checklist: Omit<Checklist, 'id' | 'createdAt' | 'ownerId'>, userId: string) => {
    try {
      await addDoc(collection(db, 'checklists'), {
        ...checklist,
        ownerId: userId,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'checklists');
    }
  }
};

export const driverService = {
  subscribeToDrivers: (callback: (drivers: Driver[]) => void) => {
    return driversCache.subscribe(callback);
  },

  addDriver: async (driver: Omit<Driver, 'id' | 'createdAt' | 'ownerId'>, userId: string) => {
    try {
      await addDoc(collection(db, 'drivers'), {
        ...driver,
        ownerId: userId,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'drivers');
    }
  },

  updateDriver: async (id: string, updates: Partial<Driver>) => {
    try {
      await updateDoc(doc(db, 'drivers', id), { ...updates });
    } catch (error) {
      handleFirestoreError(error, 'update', `drivers/${id}`);
    }
  },

  deleteDriver: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'drivers', id));
    } catch (error) {
      handleFirestoreError(error, 'delete', `drivers/${id}`);
    }
  }
};

export const geoUtils = {
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }
};

export const fineService = {
  subscribeToFines: (callback: (fines: Fine[]) => void) => {
    return finesCache.subscribe(callback);
  },

  addFine: async (fine: Omit<Fine, 'id' | 'createdAt' | 'ownerId'>, userId: string) => {
    try {
      await addDoc(collection(db, 'fines'), {
        ...fine,
        ownerId: userId,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'fines');
    }
  },

  updateFine: async (id: string, updates: Partial<Fine>) => {
    try {
      await updateDoc(doc(db, 'fines', id), { ...updates });
    } catch (error) {
      handleFirestoreError(error, 'update', `fines/${id}`);
    }
  }
};

export const userService = {
  getUserProfile: (uid: string, callback: (profile: UserProfile | null) => void) => {
    return onSnapshot(doc(db, 'users', uid), (snapshot) => {
      if (snapshot.exists()) {
        callback({ uid: snapshot.id, ...snapshot.data() } as UserProfile);
      } else {
        callback(null);
      }
    }, (error) => handleFirestoreError(error, 'get', `users/${uid}`, true));
  },

  createUserProfile: async (uid: string, email: string, name?: string) => {
    try {
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: email.toLowerCase(),
        name: name || '',
        role: 'driver', 
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, 'create', `users/${uid}`);
    }
  },

  ensureProfileExists: async (uid: string, email: string, name?: string) => {
    const { getDoc, setDoc, updateDoc, query, collection, where, getDocs, deleteDoc } = await import('firebase/firestore');
    const userDocRef = doc(db, 'users', uid);
    const lowerEmail = email.toLowerCase();
    
    // Wrap in a retry mechanism for offline issues
    let userDoc: any = null;
    let inviteSnap: any = null;
    let attempts = 0;
    const maxAttempts = 8; // Increased from 6 to 8

    while (attempts < maxAttempts) {
      try {
        // Individual fetches instead of Promise.all to isolate failures
        userDoc = await getDoc(userDocRef);
        
        try {
          inviteSnap = await getDocs(query(collection(db, 'invites'), where('email', '==', lowerEmail)));
        } catch (inviteErr) {
          console.warn("[userService] Fallback on invites check:", inviteErr);
          inviteSnap = { empty: true, docs: [] };
        }
        
        break; // Success
      } catch (err: any) {
        attempts++;
        const errMsg = err?.message?.toLowerCase() || '';
        const isOffline = errMsg.includes('offline') || 
                         errMsg.includes('network') || 
                         err?.code === 'unavailable';
        
        if (isOffline && attempts < maxAttempts) {
          const delay = Math.min(1500 * Math.pow(1.5, attempts), 10000);
          console.warn(`[userService] Sincronização pendente (Rede instável: tentativa ${attempts}/${maxAttempts})...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          // If we reach here, we either have a non-offline error or exhausted retries
          if (isOffline) {
            console.warn("[userService] Sincronização cancelada após exaustão de retries de rede.");
          } else {
            console.error("[userService] Erro ao validar perfil:", err);
          }
          return;
        }
      }
    }

    if (!userDoc) {
      console.warn("[userService] Sincronização de perfil suspensa (offline prolongado).");
      return;
    }

    let invitedRole: UserRole | null = null;
    let invitedName: string | null = null;
    if (inviteSnap && !inviteSnap.empty) {
      const inviteData = inviteSnap.docs[0].data();
      invitedRole = inviteData.role as UserRole;
      invitedName = inviteData.name || null;
    }

    if (!userDoc.exists()) {
      let initialRole: UserRole = invitedRole || 'driver';
      
      // Developer/Owner override
      if (lowerEmail === 'thiago.altriman.man@gmail.com') {
        initialRole = 'admin';
      }
      
      const { limit } = await import('firebase/firestore');
      // If no invite and not specifically overridden, check if it's the very first user
      if (!invitedRole && initialRole === 'driver') {
        try {
          const allUsersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
          if (allUsersSnap.empty) {
            initialRole = 'admin';
          }
        } catch (e) {
          console.warn("Could not check if first user:", e);
        }
      }

      await setDoc(userDocRef, {
        uid,
        email: lowerEmail,
        name: name || invitedName || '',
        role: initialRole,
        status: (invitedRole || initialRole === 'admin') ? 'active' : 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (invitedRole && inviteSnap && !inviteSnap.empty) {
        await deleteDoc(inviteSnap.docs[0].ref).catch(console.error);
      }
    } else {
      const currentData = userDoc.data() as UserProfile;
    // Promotion logic for developer or invited role
    const shouldBeAdmin = lowerEmail === 'thiago.altriman.man@gmail.com';
    const targetRole = invitedRole || (shouldBeAdmin ? 'admin' as UserRole : currentData.role);

    if (currentData.role !== targetRole) {
      console.log(`[userService] Sincronizando role do usuário: ${currentData.role} -> ${targetRole}`);
      await updateDoc(userDocRef, { 
        role: targetRole,
        updatedAt: serverTimestamp(),
        ...(name && !currentData.name ? { name } : {})
      });
      if (invitedRole && inviteSnap && !inviteSnap.empty) {
        await deleteDoc(inviteSnap.docs[0].ref).catch(console.error);
      }
    }
  }
},

  inviteUser: async (email: string, role: UserRole, name?: string) => {
    try {
      const { setDoc, getDocs, query, collection, where } = await import('firebase/firestore');
      const lowerEmail = email.toLowerCase();
      
      // Strict uniqueness check
      const existingUser = await getDocs(query(collection(db, 'users'), where('email', '==', lowerEmail)));
      if (!existingUser.empty) {
        throw new Error("Este e-mail já está cadastrado como um usuário ativo.");
      }

      // Use email as ID to prevent duplicates in the invites collection itself
      const inviteId = lowerEmail.replace(/[^a-z0-9]/g, '_');
      await setDoc(doc(db, 'invites', inviteId), {
        email: lowerEmail,
        name: name || '',
        role,
        status: 'active',
        invitedAt: serverTimestamp()
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("cadastrado")) {
        throw error;
      }
      handleFirestoreError(error, 'write', 'invites');
    }
  },

  listUsers: (callback: (users: UserProfile[]) => void) => {
    return usersCache.subscribe((users) => {
      // Ensure uid matches doc id as per previous logic (CachedCollection handles id mapping)
      const mapped = users.map(u => ({ ...u, uid: (u as any).id }));
      // Deduplicate by email to prevent UI duplication from legacy dirty data
      const uniqueUsers = Array.from(new Map(mapped.map(u => [u.email.toLowerCase(), u])).values());
      callback(uniqueUsers);
    });
  },

  subscribeToUsers: (callback: (users: UserProfile[]) => void) => {
    return userService.listUsers(callback);
  },

  listInvites: (callback: (invites: any[]) => void) => {
    return invitesCache.subscribe((invites) => {
      // Deduplicate by email
      const uniqueInvites = Array.from(new Map(invites.map(i => [(i.email || '').toLowerCase(), i])).values());
      callback(uniqueInvites);
    });
  },

  deleteInvite: async (id: string) => {
    try {
      await deleteDoc(doc(db, 'invites', id));
    } catch (error) {
      handleFirestoreError(error, 'delete', `invites/${id}`);
    }
  },

  deleteUserProfile: async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, 'delete', `users/${uid}`);
    }
  },

  checkEmailExists: async (email: string) => {
    try {
      const { getDocs, query, collection, where } = await import('firebase/firestore');
      const lowerEmail = email.toLowerCase();
      
      const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', lowerEmail)));
      if (!userSnap.empty) return { exists: true, type: 'user' };
      
      const inviteSnap = await getDocs(query(collection(db, 'invites'), where('email', '==', lowerEmail)));
      if (!inviteSnap.empty) return { exists: true, type: 'invite' };
      
      return { exists: false, type: null };
    } catch (error) {
      console.error("Error checking email uniqueness:", error);
      return { exists: false, type: null };
    }
  },

  updateUser: async (uid: string, updates: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
    } catch (error) {
      handleFirestoreError(error, 'update', `users/${uid}`);
    }
  },

  updateUserRole: async (uid: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
    } catch (error) {
      handleFirestoreError(error, 'update', `users/${uid}`);
    }
  },

  updateLocation: async (uid: string, lat: number, lng: number, speed?: number | null) => {
    const { updateDoc, serverTimestamp } = await import('firebase/firestore');
    try {
      await updateDoc(doc(db, 'users', uid), {
        lastLocation: { lat, lng, speed: speed || 0 },
        locationUpdatedAt: serverTimestamp(),
        isTrackingActive: true
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `users/${uid}`);
    }
  }
};

export const settingsService = {
  getSettings: (callback: (settings: GlobalSettings | null) => void) => {
    return onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() } as GlobalSettings);
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, 'get', 'settings/global');
    });
  },

  updateHeadquarter: async (address: string) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        headquarterAddress: address,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, 'write', 'settings/global');
    }
  }
};
