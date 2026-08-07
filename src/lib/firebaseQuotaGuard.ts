/**
 * Orkestria OS - Firebase Quota Guard & Circuit Breaker
 * 
 * Implementa controle estrito de consumo do plano Spark (gratuito) do Firebase,
 * monitorando estimativa de leituras (Reads) e gravações (Writes) diárias em localStorage,
 * disparando alertas em limiares críticos e ativando o Circuit Breaker para evitar
 * estouros de cota ou cobranças indevidas.
 */

export interface QuotaStats {
  date: string; // YYYY-MM-DD
  reads: number;
  writes: number;
  deletes: number;
  circuitBreakerTripped: boolean;
}

// Limites seguros para o plano Spark Gratuito (com margem de segurança de ~20%)
const DEFAULT_MAX_DAILY_READS = 40000;  // Teto gratuito oficial é 50.000/dia
const DEFAULT_MAX_DAILY_WRITES = 16000; // Teto gratuito oficial é 20.000/dia

const QUOTA_STORAGE_PREFIX = 'orkestria_firebase_quota_';

function getTodayKey(): string {
  const now = new Date();
  return `${QUOTA_STORAGE_PREFIX}${now.toISOString().split('T')[0]}`;
}

export function getQuotaStats(): QuotaStats {
  try {
    const key = getTodayKey();
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as QuotaStats;
    }
  } catch (err) {
    console.warn('[FirebaseQuotaGuard] Erro ao ler stats do localStorage:', err);
  }

  const defaultStats: QuotaStats = {
    date: new Date().toISOString().split('T')[0],
    reads: 0,
    writes: 0,
    deletes: 0,
    circuitBreakerTripped: false
  };

  return defaultStats;
}

function saveQuotaStats(stats: QuotaStats): void {
  try {
    const key = getTodayKey();
    localStorage.setItem(key, JSON.stringify(stats));
  } catch (err) {
    console.warn('[FirebaseQuotaGuard] Erro ao salvar stats no localStorage:', err);
  }
}

/**
 * Registra o consumo estimado de leituras (reads).
 */
export function trackRead(count = 1): void {
  const stats = getQuotaStats();
  stats.reads += count;

  if (stats.reads >= DEFAULT_MAX_DAILY_READS && !stats.circuitBreakerTripped) {
    stats.circuitBreakerTripped = true;
    console.error(
      `[FirebaseQuotaGuard] ALERTA CRÍTICO: Limite diário seguro de Leituras atingido (${stats.reads}/${DEFAULT_MAX_DAILY_READS}). Circuit Breaker ativado para modo Cache/Offline.`
    );
  } else if (stats.reads === Math.floor(DEFAULT_MAX_DAILY_READS * 0.8)) {
    console.warn(
      `[FirebaseQuotaGuard] ATENÇÃO: 80% da cota diária de Leituras foi consumida (${stats.reads}/${DEFAULT_MAX_DAILY_READS}).`
    );
  }

  saveQuotaStats(stats);
}

/**
 * Registra o consumo estimado de gravações (writes).
 */
export function trackWrite(count = 1): void {
  const stats = getQuotaStats();
  stats.writes += count;

  if (stats.writes >= DEFAULT_MAX_DAILY_WRITES && !stats.circuitBreakerTripped) {
    stats.circuitBreakerTripped = true;
    console.error(
      `[FirebaseQuotaGuard] ALERTA CRÍTICO: Limite diário seguro de Gravações atingido (${stats.writes}/${DEFAULT_MAX_DAILY_WRITES}). Circuit Breaker ativado para gravações em buffer local.`
    );
  } else if (stats.writes === Math.floor(DEFAULT_MAX_DAILY_WRITES * 0.8)) {
    console.warn(
      `[FirebaseQuotaGuard] ATENÇÃO: 80% da cota diária de Gravações foi consumida (${stats.writes}/${DEFAULT_MAX_DAILY_WRITES}).`
    );
  }

  saveQuotaStats(stats);
}

/**
 * Verifica se o Circuit Breaker foi acionado (limiar atingido).
 */
export function isCircuitBreakerTripped(): boolean {
  const stats = getQuotaStats();
  return stats.circuitBreakerTripped;
}

/**
 * Força o desarme/reset manual do Circuit Breaker (ex: intervenção de administrador).
 */
export function resetCircuitBreaker(): void {
  const stats = getQuotaStats();
  stats.circuitBreakerTripped = false;
  saveQuotaStats(stats);
}
