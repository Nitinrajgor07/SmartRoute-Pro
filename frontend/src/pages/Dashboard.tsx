import React from 'react';
import { useAuth } from '../app/AuthContext';
import { AdminDashboard } from './dashboards/AdminDashboard';
import { DispatcherDashboard } from './dashboards/DispatcherDashboard';
import { ViewerDashboard } from './dashboards/ViewerDashboard';
import { LoadingState } from '../components/StateFeedback';
import { CardSkeleton } from '../components/LoadingSkeleton';

/**
 * Role-Based Dashboard Router.
 * Automatically inspects the authenticated user's verified backend role:
 * - ADMIN -> AdminDashboard (Full system overview, user management, cloud telemetry)
 * - DISPATCHER -> DispatcherDashboard (Delivery operations, status updater, Dijkstra route planning)
 * - VIEWER -> ViewerDashboard (Read-only observation, delivery monitoring, progress tracking)
 */
export const Dashboard: React.FC = () => {
  const { user, role, isLoading } = useAuth();

  // Handle loading state to prevent flash of wrong dashboard
  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingState message="Authenticating credentials and preparing role-based dashboard..." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  // Normalize role from authenticated backend identity
  const normalizedRole = (role || user?.role || 'VIEWER').toUpperCase();

  if (normalizedRole === 'ADMIN') {
    return <AdminDashboard />;
  }

  if (normalizedRole === 'DISPATCHER') {
    return <DispatcherDashboard />;
  }

  // Safe fallback to read-only viewer dashboard
  return <ViewerDashboard />;
};

export default Dashboard;
