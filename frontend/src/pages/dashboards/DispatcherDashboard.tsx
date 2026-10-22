import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Truck,
  AlertCircle,
  CheckCircle2,
  Route,
  RefreshCw,
  Send,
  Loader2
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/cards/StatCard';
import { SectionCard } from '../../components/cards/SectionCard';
import { formatINR } from '../../utils/formatINR';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/StateFeedback';
import { dashboardService, deliveriesService } from '../../services/api';
import type { Delivery, DashboardSummaryResponse } from '../../types';

export const DispatcherDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dispatchingId, setDispatchingId] = useState<number | string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDispatcherData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, delRes] = await Promise.allSettled([
        dashboardService.getSummary(),
        deliveriesService.getDeliveries({ per_page: 25 }),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value);
      if (delRes.status === 'fulfilled') setDeliveries(delRes.value.deliveries || []);

      if (sumRes.status === 'rejected' && delRes.status === 'rejected') {
        setError('Could not connect to dispatch operations database.');
      }
    } catch {
      setError('An error occurred loading dispatch metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatcherData();
  }, []);

  const handleDispatch = async (deliveryId: number | string) => {
    setDispatchingId(deliveryId);
    setFeedback(null);
    try {
      await deliveriesService.updateDelivery(deliveryId, { status: 'In Transit' });
      setDeliveries((prev) =>
        prev.map((d) => (d.id === deliveryId ? { ...d, status: 'In Transit' } : d))
      );
      setFeedback('Consignment dispatched to transit.');
      const sumRes = await dashboardService.getSummary();
      setSummary(sumRes);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to dispatch shipment');
    } finally {
      setDispatchingId(null);
    }
  };

  const pendingDeliveries = summary?.metrics?.pending_deliveries ?? 0;
  const inTransitDeliveries = summary?.metrics?.in_transit_deliveries ?? 0;
  const delayedDeliveries = summary?.metrics?.delayed_deliveries ?? 0;

  const needsDispatchList = deliveries.filter((d) => d.status === 'Pending').slice(0, 6);

  if (isLoading) {
    return <LoadingState message="Loading dispatch operations..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/route-planner')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-semibold text-white shadow-sm transition-colors"
            >
              <Route className="h-4 w-4" />
              Plan route
            </button>
            <button
              onClick={fetchDispatcherData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload
            </button>
          </div>
        }
      />

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pending"
          value={pendingDeliveries}
          icon={Clock}
          accent="amber"
        />
        <StatCard
          label="In transit"
          value={inTransitDeliveries}
          icon={Truck}
          accent="blue"
        />
        <StatCard
          label="Delayed"
          value={delayedDeliveries}
          icon={AlertCircle}
          accent="rose"
        />
        <StatCard
          label="Delivered today"
          value={summary?.metrics?.delivered_today ?? 0}
          icon={CheckCircle2}
          accent="emerald"
        />
      </div>

      <SectionCard title="Revenue">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Today"
            value={formatINR(summary?.metrics?.revenue?.today)}
            hint="Delivered parcels"
            icon={CheckCircle2}
            accent="emerald"
          />
          <StatCard
            label="This week"
            value={formatINR(summary?.metrics?.revenue?.week)}
            hint="Delivered parcels"
            icon={CheckCircle2}
            accent="blue"
          />
          <StatCard
            label="This month"
            value={formatINR(summary?.metrics?.revenue?.month)}
            hint="Delivered parcels"
            icon={CheckCircle2}
            accent="indigo"
          />
          <StatCard
            label="All time"
            value={formatINR(summary?.metrics?.revenue?.all_time)}
            hint="Delivered parcels"
            icon={CheckCircle2}
            accent="indigo"
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium">
          Awaiting delivery: {formatINR(summary?.metrics?.revenue?.awaiting_delivery)}
        </p>
      </SectionCard>

      {/* Sections: Needs dispatch & Recent deliveries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <SectionCard title="Needs dispatch">
            {needsDispatchList.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {needsDispatchList.map((del) => (
                  <div key={del.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate block">
                        {del.tracking_number}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {del.destination_location?.name || del.destinationAddress || 'Hub'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDispatch(del.id)}
                      disabled={dispatchingId === del.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
                    >
                      {dispatchingId === del.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Dispatch
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                No pending deliveries.
              </div>
            )}
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <SectionCard title="Recent deliveries">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold uppercase text-slate-400">
                    <th className="pb-2.5">Tracking</th>
                    <th className="pb-2.5">Customer</th>
                    <th className="pb-2.5">To</th>
                    <th className="pb-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {deliveries.slice(0, 8).map((del) => (
                    <tr key={del.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 font-mono font-medium">
                        <button
                          data-testid="consignment-plan-route"
                          onClick={() => navigate(`/route-planner?source=${del.pickup_location_id || 1}&destination=${del.destination_location_id || 2}`)}
                          className="text-brand-600 dark:text-brand-400 hover:underline font-mono"
                        >
                          {del.tracking_number}
                        </button>
                      </td>
                      <td className="py-2.5 text-slate-700 dark:text-slate-300">
                        {del.customer_name}
                      </td>
                      <td className="py-2.5 text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                        {del.destination_location?.name || del.destinationAddress || 'Hub'}
                      </td>
                      <td className="py-2.5">
                        <StatusBadge status={del.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default DispatcherDashboard;
