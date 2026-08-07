import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, doc, deleteDoc, where, Query } from 'firebase/firestore';
import { db } from './firebase';
import { getTenantUser, canAccessTenantData, subscribeTenantUser } from './tenant';
import { trackRead, trackWrite, isCircuitBreakerTripped } from './firebaseQuotaGuard';

function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  if (obj.constructor && obj.constructor.name !== 'Object') return obj;

  const cleaned: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      cleaned[key] = cleanUndefined(val);
    }
  }
  return cleaned;
}

// TTL de cache local por padrão: 15 minutos para economia agressiva de leituras
const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  timestamp: number;
  data: any[];
}

// Sistema de inscrição compartilhada para evitar ouvintes duplicados no mesmo documento/coleção
interface SharedListener {
  data: any[];
  subscribers: Set<(data: any[]) => void>;
  unsubscribe: () => void;
  lastFetched: number;
}

const sharedListeners = new Map<string, SharedListener>();

function getCacheKey(collectionName: string, companyId?: string): string {
  return `orkestria_cache_${collectionName}_${companyId || 'global'}`;
}

function getLocalCache<T>(cacheKey: string): T[] | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > DEFAULT_CACHE_TTL_MS) {
      return null;
    }
    return entry.data as T[];
  } catch {
    return null;
  }
}

function setLocalCache(cacheKey: string, data: any[]): void {
  try {
    const entry: CacheEntry = {
      timestamp: Date.now(),
      data
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (err) {
    console.warn('[useCollection] Falha ao gravar cache no localStorage:', err);
  }
}

export function useCollection<T>(collectionName: string) {
  const tenant = getTenantUser();
  const cacheKey = getCacheKey(collectionName, tenant?.companyId);

  // Inicializa com cache local de baixa latência e zero leitura de rede (se disponível)
  const [data, setData] = useState<T[]>(() => {
    const cached = getLocalCache<T>(cacheKey);
    return cached || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = getLocalCache<T>(cacheKey);
    return !cached;
  });
  const [tenantVersion, setTenantVersion] = useState(0);

  useEffect(() => {
    const unsubTenant = subscribeTenantUser(() => {
      setTenantVersion(v => v + 1);
    });
    return () => unsubTenant();
  }, []);

  useEffect(() => {
    const currentTenant = getTenantUser();
    const currentCacheKey = getCacheKey(collectionName, currentTenant?.companyId);

    // Se o Circuit Breaker foi disparado, operamos estritamente no modo offline/cache
    if (isCircuitBreakerTripped()) {
      const cached = getLocalCache<T>(currentCacheKey);
      if (cached) {
        setData(cached);
      }
      setLoading(false);
      return;
    }

    // Padrão de Deduplicação de Inscrições: Compartilha ouvinte se já estiver aberto para a coleção+tenant
    let listener = sharedListeners.get(currentCacheKey);

    if (!listener) {
      let q: Query = collection(db, collectionName);

      // Filtro Multi-Tenant Automático: Economia dramática evitando varredura de toda a coleção
      if (canAccessTenantData() && currentTenant?.companyId) {
        q = query(collection(db, collectionName), where('companyId', '==', currentTenant.companyId));
      }

      const subscribers = new Set<(data: any[]) => void>();

      const unsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: false },
        (snapshot) => {
          const docs = snapshot.docs.map(docSnap => ({
            ...docSnap.data(),
            id: docSnap.id
          })) as T[];

          // Contabiliza leituras de rede (apenas quando não servido diretamente do cache offline nativo do SDK)
          if (!snapshot.metadata.fromCache) {
            trackRead(snapshot.docs.length || 1);
          }

          setLocalCache(currentCacheKey, docs);

          const currentListener = sharedListeners.get(currentCacheKey);
          if (currentListener) {
            currentListener.data = docs;
            currentListener.lastFetched = Date.now();
            currentListener.subscribers.forEach(cb => cb(docs));
          }
        },
        (error) => {
          console.error(`[useCollection] Erro ao buscar coleção ${collectionName}:`, error);
          const cached = getLocalCache<T>(currentCacheKey);
          if (cached && listener) {
            listener.subscribers.forEach(cb => cb(cached));
          }
        }
      );

      listener = {
        data: getLocalCache<T>(currentCacheKey) || [],
        subscribers,
        unsubscribe,
        lastFetched: Date.now()
      };

      sharedListeners.set(currentCacheKey, listener);
    }

    // Registra o componente atual como assinante do ouvinte compartilhado
    const updateCallback = (newData: any[]) => {
      setData(newData as T[]);
      setLoading(false);
    };

    listener.subscribers.add(updateCallback);
    if (listener.data.length > 0) {
      setData(listener.data as T[]);
      setLoading(false);
    }

    return () => {
      const currentListener = sharedListeners.get(currentCacheKey);
      if (currentListener) {
        currentListener.subscribers.delete(updateCallback);
        if (currentListener.subscribers.size === 0) {
          currentListener.unsubscribe();
          sharedListeners.delete(currentCacheKey);
        }
      }
    };
  }, [collectionName, tenantVersion]);

  const add = async (item: Omit<T, 'id'>) => {
    const payload = cleanUndefined({
      ...item,
    });
    const res = await addDoc(collection(db, collectionName), payload);
    trackWrite(1);
    return res;
  };

  const update = async (id: string, item: Partial<T>) => {
    const docRef = doc(db, collectionName, id);
    const res = await updateDoc(docRef, cleanUndefined(item));
    trackWrite(1);
    return res;
  };

  const remove = async (id: string) => {
    const docRef = doc(db, collectionName, id);
    const res = await deleteDoc(docRef);
    trackWrite(1);
    return res;
  };

  return { data, loading, add, update, remove };
}
