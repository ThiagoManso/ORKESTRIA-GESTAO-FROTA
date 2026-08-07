import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { getTenantUser } from './tenant';
import { trackWrite, isCircuitBreakerTripped } from './firebaseQuotaGuard';

export interface CompanyLog {
  id?: string;
  companyId: string;
  action: string;
  details: string;
  performedBy: {
    uid: string;
    name: string;
    email: string;
  };
  timestamp: number;
}

const STORAGE_BUFFER_KEY = 'orkestria_audit_buffer';
const MAX_BATCH_SIZE = 500; // Limite oficial do Firestore por batch
const FLUSH_THRESHOLD = 5;  // Número de logs para disparar flush automático
const FLUSH_INTERVAL_MS = 30000; // 30 segundos

let inMemoryBuffer: CompanyLog[] = [];
let isFlushing = false;

// Carrega buffer pendente do localStorage ao inicializar (Zero Perda - Durabilidade)
function loadBufferFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_BUFFER_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (Array.isArray(stored)) {
        inMemoryBuffer = stored;
      }
    }
  } catch (err) {
    console.warn('[AuditBuffer] Erro ao carregar buffer do localStorage:', err);
  }
}

function saveBufferToStorage(): void {
  try {
    localStorage.setItem(STORAGE_BUFFER_KEY, JSON.stringify(inMemoryBuffer));
  } catch (err) {
    console.warn('[AuditBuffer] Erro ao persistir buffer no localStorage:', err);
  }
}

loadBufferFromStorage();

/**
 * Envia todos os logs pendentes em um único Batched Write do Firestore.
 * Garante economia de requisições de escrita e durabilidade em caso de falha de rede.
 */
export async function flushAuditBuffer(): Promise<void> {
  if (isFlushing || inMemoryBuffer.length === 0) return;
  if (isCircuitBreakerTripped()) {
    console.warn('[AuditBuffer] Circuit Breaker ativo. Lote de auditoria mantido em buffer local para economia de cota.');
    return;
  }

  isFlushing = true;
  const toFlush = inMemoryBuffer.slice(0, MAX_BATCH_SIZE);

  try {
    const batch = writeBatch(db);
    const logsCol = collection(db, 'company_logs');

    for (const logItem of toFlush) {
      const docRef = doc(logsCol);
      batch.set(docRef, logItem);
    }

    await batch.commit();
    trackWrite(toFlush.length);

    // Remove apenas os itens que foram gravados com sucesso
    inMemoryBuffer = inMemoryBuffer.slice(toFlush.length);
    saveBufferToStorage();
  } catch (error) {
    console.error('[AuditBuffer] Erro ao enviar lote de auditoria (será retido localmente):', error);
    // Em caso de falha de rede/cota, os dados permanecem intactos em inMemoryBuffer e no localStorage
  } finally {
    isFlushing = false;
  }
}

/**
 * Registra um evento de auditoria no buffer local resiliente (Zero Perda),
 * acionando gravação em lote (Batched Write) quando apropriado.
 */
export async function logCompanyAction(action: string, details: string): Promise<void> {
  try {
    const tenant = getTenantUser();
    if (!tenant || !tenant.companyId) return;

    const newLog: CompanyLog = {
      companyId: tenant.companyId,
      action,
      details,
      performedBy: {
        uid: tenant.id,
        name: tenant.name,
        email: tenant.email
      },
      timestamp: Date.now()
    };

    inMemoryBuffer.push(newLog);
    saveBufferToStorage();

    // Dispara envio se o buffer atingir o limiar ideal ou se não houver timer em execução
    if (inMemoryBuffer.length >= FLUSH_THRESHOLD) {
      void flushAuditBuffer();
    }
  } catch (error) {
    console.error('Erro ao registrar auditoria de empresa:', error);
  }
}

// Flush periódico em segundo plano para agrupar gravações
if (typeof window !== 'undefined') {
  setInterval(() => {
    void flushAuditBuffer();
  }, FLUSH_INTERVAL_MS);

  // Tenta sincronizar ao sair da página ou trocar de aba
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushAuditBuffer();
    }
  });

  window.addEventListener('beforeunload', () => {
    void flushAuditBuffer();
  });
}
