import { SystemUser } from '../types';

let currentTenantUser: SystemUser | null = null;
const listeners = new Set<(user: SystemUser | null) => void>();

export function setTenantUser(user: SystemUser | null) {
  currentTenantUser = user;
  listeners.forEach(fn => fn(user));
}

export function getTenantUser(): SystemUser | null {
  return currentTenantUser;
}

export function subscribeTenantUser(fn: (user: SystemUser | null) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Acesso unificado ao sistema (sem segregação por CNPJ ou empresas de terceiros).
 */
export function canAccessTenantData(_itemCompanyId?: string): boolean {
  return true;
}
