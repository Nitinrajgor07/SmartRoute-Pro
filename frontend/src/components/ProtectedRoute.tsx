import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredRoles?: UserRole[];
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  requiredPermission,
}) => {
  const { isAuthenticated, isLoading, role, can } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="glass-card flex flex-col items-center gap-3 p-6 rounded-2xl max-w-sm text-center">
          <Loader2 className="h-8 w-8 text-brand-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Verifying Authentication...
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Checking session validity and permissions.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isBlockedByRole = requiredRoles && requiredRoles.length > 0 && role && !requiredRoles.includes(role);
  const isBlockedByPermission = requiredPermission ? !can(requiredPermission) : false;

  if (isBlockedByRole || isBlockedByPermission) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="glass-float w-full max-w-md rounded-2xl p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              You don't have access to this page
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your account does not have permission to view this section.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-brand-500/20 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
};
