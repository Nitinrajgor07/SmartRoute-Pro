import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from '../services/api';
import type { AuthUser, UserRole } from '../types';
import { setCachedPermissions, getCachedPermissions, can as canHelper } from '../auth/permissions';

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  isAdmin: boolean;
  isDispatcher: boolean;
  canDispatch: boolean; // True for DISPATCHER
  permissions: string[];
  can: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, account_type?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name?: string, email?: string) => Promise<void>;
  changePassword: (current_password: string, new_password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('smartroute_access_token');
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    const savedUser = localStorage.getItem('smartroute_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser) as AuthUser;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [permissions, setPermissionsState] = useState<string[]>(() => {
    return getCachedPermissions();
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Normalize role
  const normalizedRole: UserRole | null = user?.role
    ? (user.role.toUpperCase() as UserRole)
    : null;

  const isAdmin = normalizedRole === 'ADMIN';
  const isDispatcher = normalizedRole === 'DISPATCHER';
  const canDispatch = isDispatcher; // Only DISPATCHER performs operational dispatch

  const can = useCallback((permission: string) => {
    return canHelper(permission, permissions);
  }, [permissions]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await authService.getMe();
      if (data?.user) {
        setUser(data.user);
        localStorage.setItem('smartroute_user', JSON.stringify(data.user));
      }
      if (data?.permissions) {
        setPermissionsState(data.permissions);
        setCachedPermissions(data.permissions);
      }
    } catch {
      // If fetching me fails and token is invalid, clear state
      const existingToken = localStorage.getItem('smartroute_access_token');
      if (!existingToken) {
        setUser(null);
        setToken(null);
        setPermissionsState([]);
        setCachedPermissions([]);
      }
    }
  }, []);

  // Initialize and validate session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('smartroute_access_token');
      if (storedToken) {
        setToken(storedToken);
        try {
          const data = await authService.getMe();
          if (data?.user) {
            setUser(data.user);
            localStorage.setItem('smartroute_user', JSON.stringify(data.user));
          }
          if (data?.permissions) {
            setPermissionsState(data.permissions);
            setCachedPermissions(data.permissions);
          }
        } catch {
          // Token invalid or revoked
          localStorage.removeItem('smartroute_access_token');
          localStorage.removeItem('smartroute_refresh_token');
          localStorage.removeItem('smartroute_user');
          localStorage.removeItem('smartroute_permissions');
          setCachedPermissions([]);
          setPermissionsState([]);
          setToken(null);
          setUser(null);
        }
      } else {
        setToken(null);
        setUser(null);
        setPermissionsState([]);
        setCachedPermissions([]);
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    localStorage.setItem('smartroute_access_token', response.access_token);
    localStorage.setItem('smartroute_refresh_token', response.refresh_token);
    localStorage.setItem('smartroute_user', JSON.stringify(response.user));
    setToken(response.access_token);
    setUser(response.user);
    // Fetch fresh permissions
    try {
      const meData = await authService.getMe();
      if (meData?.permissions) {
        setPermissionsState(meData.permissions);
        setCachedPermissions(meData.permissions);
      }
    } catch {
      // ignore
    }
  };

  const register = async (name: string, email: string, password: string, account_type?: string) => {
    await authService.register({ name, email, password, account_type });
    // Account is inactive until admin approves — do not auto-login
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Clear storage even if backend call fails
      localStorage.removeItem('smartroute_access_token');
      localStorage.removeItem('smartroute_refresh_token');
      localStorage.removeItem('smartroute_user');
      localStorage.removeItem('smartroute_permissions');
    } finally {
      localStorage.removeItem('smartroute_permissions');
      setPermissionsState([]);
      setCachedPermissions([]);
      setToken(null);
      setUser(null);
    }
  };

  const updateProfile = async (name?: string, email?: string) => {
    const response = await authService.updateProfile({ name, email });
    setUser(response.user);
    localStorage.setItem('smartroute_user', JSON.stringify(response.user));
  };

  const changePassword = async (current_password: string, new_password: string) => {
    await authService.changePassword({ current_password, new_password });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        role: normalizedRole,
        isAdmin,
        isDispatcher,
        canDispatch,
        permissions,
        can,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
