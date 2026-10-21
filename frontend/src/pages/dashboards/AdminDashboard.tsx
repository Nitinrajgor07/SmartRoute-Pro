import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PackageCheck,
  Truck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Users,
  Server,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/cards/StatCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { LoadingState } from '../../components/StateFeedback';
import { dashboardService, authService, cloudService } from '../../services/api';
import type { DashboardSummaryResponse, ManagedUser, CloudHealthProbeResponse } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  Delivered: '#10B981',
  'In Transit': '#3B82F6',
  Pending: '#F59E0B',
  Delayed: '#EF4444',
};

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [health, setHealth] = useState<CloudHealthProbeResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, usersRes, healthRes] = await Promise.allSettled([
        dashboardService.getSummary(),
        authService.getUsers(),
        cloudService.getHealth(),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.users || []);
      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
      } else {
        setHealth(null);
      }

      if (sumRes.status === 'rejected') {
        setError('Could not connect to backend services.');
      }
    } catch {
      setError('An error occurred while loading administration metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const totalDeliveries = summary?.metrics?.total_deliveries ?? 0;
  const inTransitDeliveries = summary?.metrics?.in_transit_deliveries ?? 0;
  const completedDeliveries = summary?.metrics?.completed_deliveries ?? 0;
  const delayedDeliveries = summary?.metrics?.delayed_deliveries ?? 0;
  const pendingDeliveries = summary?.metrics?.pending_deliveries ?? 0;

  // Chart data: daily delivery orders
  const dailyData = summary?.performance_trend && summary.performance_trend.length > 0
    ? summary.performance_trend.map((p) => ({ date: p.day, orders: p.deliveries }))
    : [
        { date: 'Mon', orders: 12 },
        { date: 'Tue', orders: 19 },
        { date: 'Wed', orders: 15 },
        { date: 'Thu', orders: 22 },
        { date: 'Fri', orders: 28 },
        { date: 'Sat', orders: 14 },
        { date: 'Sun', orders: 10 },
      ];

  // Status donut data
  const statusData = [
    { name: 'Delivered', value: completedDeliveries },
    { name: 'In Transit', value: inTransitDeliveries },
    { name: 'Pending', value: pendingDeliveries },
    { name: 'Delayed', value: delayedDeliveries },
  ].filter((item) => item.value > 0);

  // User counts by role
  const adminCount = users.filter((u) => (u.role || '').toUpperCase() === 'ADMIN').length;
  const dispatcherCount = users.filter((u) => (u.role || '').toUpperCase() === 'DISPATCHER').length;
  const viewerCount = users.filter((u) => (u.role || '').toUpperCase() === 'VIEWER').length;
  const totalUsers = users.length;
  const pendingApprovalCount = users.filter((u) => u.approval_status === 'pending').length;

  // Derived live health telemetry
  let serviceStatus = 'Offline';
  let serviceColor = 'text-rose-600 dark:text-rose-400';
  let serviceIconColor = 'text-rose-500';
  let ServiceIcon = AlertCircle;

  if (health) {
    const isDbConnected = health.database?.connected !== false;
    const isHealthUp = health.status?.toUpperCase() === 'UP' || health.status?.toUpperCase() === 'HEALTHY';

    if (!isDbConnected) {
      serviceStatus = 'Degraded';
      serviceColor = 'text-amber-600 dark:text-amber-400';
      serviceIconColor = 'text-amber-500';
      ServiceIcon = AlertCircle;
    } else if (isHealthUp) {
      serviceStatus = 'Operational';
      serviceColor = 'text-emerald-600 dark:text-emerald-400';
      serviceIconColor = 'text-emerald-500';
      ServiceIcon = CheckCircle;
    } else {
      serviceStatus = 'Degraded';
      serviceColor = 'text-amber-600 dark:text-amber-400';
      serviceIconColor = 'text-amber-500';
      ServiceIcon = AlertCircle;
    }
  }

  const rawLatency = health?.total_latency_ms ?? (health as any)?.latency_ms ?? health?.database?.latency_ms;
  const latencyDisplay = (rawLatency !== null && rawLatency !== undefined && typeof rawLatency === 'number')
    ? `${rawLatency.toFixed(1)} ms`
    : '-';

  const dbEngine = health?.database?.engine || 'Unknown';
  const dbStatus = health?.database?.status;
  const dbDisplay = dbStatus ? `${dbEngine} - ${dbStatus}` : dbEngine;

  if (isLoading) {
    return <LoadingState message="Loading platform telemetry..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform telemetry and operational overview"
        actions={
          <button
            onClick={fetchAdminData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
        }
      />

      {pendingApprovalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            {pendingApprovalCount} new {pendingApprovalCount === 1 ? 'account is' : 'accounts are'} waiting for your approval.
          </p>
          <button
            onClick={() => navigate('/settings?tab=users')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
            data-testid="review-pending-users"
          >
            Review requests
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Deliveries"
          value={totalDeliveries}
          hint="All recorded consignments"
          icon={PackageCheck}
          accent="blue"
        />
        <StatCard
          label="In Transit"
          value={inTransitDeliveries}
          hint="Active on road"
          icon={Truck}
          accent="indigo"
        />
        <StatCard
          label="Delivered"
          value={completedDeliveries}
          hint="Successfully fulfilled"
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="Delayed"
          value={delayedDeliveries}
          hint="Requires monitoring"
          icon={AlertCircle}
          accent="rose"
        />
      </div>

      <SectionCard title="Revenue">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Today's Revenue" value={`₹${(summary?.metrics?.revenue?.today ?? 0).toFixed(2)}`} hint="Current calendar day" icon={CheckCircle2} accent="emerald" />
          <StatCard label="This Week's Revenue" value={`₹${(summary?.metrics?.revenue?.week ?? 0).toFixed(2)}`} hint="Monday through Sunday" icon={CheckCircle2} accent="blue" />
          <StatCard label="This Month's Revenue" value={`₹${(summary?.metrics?.revenue?.month ?? 0).toFixed(2)}`} hint="Current calendar month" icon={CheckCircle2} accent="indigo" />
        </div>
      </SectionCard>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Daily Deliveries">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
                <Bar dataKey="orders" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Delivery Status">
          <div className="h-64 w-full flex items-center justify-center">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      color: '#fff',
                      borderRadius: '8px',
                      fontSize: '12px',
                      border: 'none',
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400">No delivery status data recorded.</p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* System Status & Platform Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="System Status"
          icon={Server}
          action={
            <button
              onClick={() => navigate('/system-status')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              Details
              <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl glass-tile">
              <div className="flex items-center gap-2">
                <ServiceIcon className={`h-4 w-4 ${serviceIconColor}`} />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Backend API Service
                </span>
              </div>
              <span className={`text-xs font-bold ${serviceColor}`} data-testid="service-status">
                {serviceStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Database Engine</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5" data-testid="database-engine">{dbDisplay}</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400">API Latency</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 tabular-nums" data-testid="api-latency">
                  {latencyDisplay}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Platform Users"
          icon={Users}
          action={
            <button
              onClick={() => navigate('/settings?tab=users')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              Manage
              <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl glass-tile">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Total</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">{totalUsers}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
              <span className="text-[10px] uppercase font-semibold text-purple-600 dark:text-purple-400">Admin</span>
              <p className="text-xl font-bold text-purple-700 dark:text-purple-300 tabular-nums mt-1">{adminCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
              <span className="text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400">Dispatch</span>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300 tabular-nums mt-1">{dispatcherCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400">Viewer</span>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums mt-1">{viewerCount}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default AdminDashboard;
