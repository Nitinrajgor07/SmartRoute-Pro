/**
 * SmartRoute Pro Permission Evaluator
 * Reads granted permissions from the session (populated from /api/auth/me).
 * No role tables or role checks are duplicated here.
 */

let activePermissions: string[] = [];

/**
 * Update active permissions cache in memory and persistence.
 */
export function setCachedPermissions(permissions: string[]) {
  activePermissions = Array.isArray(permissions) ? permissions : [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('smartroute_permissions', JSON.stringify(activePermissions));
    } catch {
      // storage unavailable
    }
  }
}

/**
 * Retrieve current permissions list.
 */
export function getCachedPermissions(): string[] {
  if (activePermissions.length > 0) {
    return activePermissions;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem('smartroute_permissions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          activePermissions = parsed;
          return activePermissions;
        }
      }
    } catch {
      // invalid JSON
    }
  }
  return [];
}

/**
 * Check if the current authenticated user has the specified permission.
 * Reads the list from AuthContext / /api/auth/me cached in memory/localStorage.
 */
export function can(permission: string, userPermissions?: string[]): boolean {
  if (!permission) return false;
  const list = userPermissions && userPermissions.length > 0 ? userPermissions : getCachedPermissions();
  return list.includes(permission);
}
