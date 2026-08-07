import { SystemUser, ViewState } from '../types';

export const ALL_PERMISSIONS: ViewState[] = [
  'dashboard',
  'routes',
  'drivers',
  'vehicles',
  'financial',
  'issues',
  'map',
  'settings',
  'requests',
  'users',
  'my_requests',
];

export const DEFAULT_ADMIN_PERMISSIONS: ViewState[] = [
  'dashboard',
  'routes',
  'drivers',
  'vehicles',
  'financial',
  'issues',
  'map',
  'settings',
  'requests',
  'users',
  'my_requests',
];

export const DEFAULT_INTERNAL_PERMISSIONS: ViewState[] = [
  'my_requests',
  'dashboard',
  'routes',
  'drivers',
  'vehicles',
  'map',
  'requests',
];

/**
 * Retorna a lista exata de telas permitidas para um usuário.
 */
export function getUserPermissions(user: SystemUser | null | undefined): ViewState[] {
  if (!user) return [];

  const email = user.email?.toLowerCase();
  const isAdmin =
    user.role === 'admin' ||
    (user.role as string) === 'super_admin' ||
    email === 'thiago.manso@orkestriaos.com.br' ||
    email === 'admin@orkestriaos.com.br';

  if (isAdmin) {
    return DEFAULT_ADMIN_PERMISSIONS;
  }

  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    const validPerms = user.permissions.filter(p => ALL_PERMISSIONS.includes(p));
    if (validPerms.length > 0) {
      return validPerms;
    }
  }

  return DEFAULT_INTERNAL_PERMISSIONS;
}

/**
 * Verifica se o usuário tem permissão de acesso a uma tela específica.
 */
export function hasViewPermission(user: SystemUser | null | undefined, view: ViewState): boolean {
  const permissions = getUserPermissions(user);
  return permissions.includes(view);
}

/**
 * Determina uma tela padrão segura para redirecionamento.
 * Se currentView for permitida, retorna currentView.
 * Caso contrário, retorna 'dashboard' se permitida ou a primeira tela disponível na lista de permissões.
 */
export function getSafeDefaultView(
  user: SystemUser | null | undefined,
  currentView?: ViewState
): ViewState {
  const perms = getUserPermissions(user);
  if (currentView && perms.includes(currentView)) {
    return currentView;
  }
  if (perms.includes('dashboard')) {
    return 'dashboard';
  }
  const firstValid = perms.find(p => ALL_PERMISSIONS.includes(p));
  return firstValid || 'dashboard';
}
