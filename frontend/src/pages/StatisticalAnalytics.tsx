import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  Activity,
  Calculator,
  Sigma,
  RefreshCw,
  AlertTriangle,
  Table,
  FileText,
  Database,
  Truck,
  Network
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ComposedChart,
  Scatter
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { HypothesisTests } from './analytics/HypothesisTests';
import { sdaService, dashboardService } from '../services/api';
import { useAuth } from '../app/AuthContext';
import { SectionCard } from '../components/cards/SectionCard';
import { LoadingState, ErrorState, EmptyState } from '../components/StateFeedback';
import { formatINR } from '../utils/formatINR';
import type { RevenueBreakdownResponse } from '../types';
import type {
  StatisticalSummaryResponse,
  DistributionResponse,
  RegressionAnalysisResponse,
  DeliveryTrendsResponse,
  UnivariateMetric
} from '../types';

// Formatting helpers
const fmt1 = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return 'N/A';
  return Number(val).toFixed(1);
};

const fmt2 = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return 'N/A';
  return Number(val).toFixed(2);
};

export const StatisticalAnalytics: React.FC = () => {
  const navigate = useNavigate();

  // Primary API Data States
  const [statsSummary, setStatsSummary] = useState<StatisticalSummaryResponse | null>(null);
  const [distribution, setDistribution] = useState<DistributionResponse | null>(null);
  const [regression, setRegression] = useState<RegressionAnalysisResponse | null>(null);
  const [trends, setTrends] = useState<DeliveryTrendsResponse | null>(null);

  // Interactive Filter & Variable Selector States
  const [selectedDistVar, setSelectedDistVar] = useState<'distance' | 'weight'>('distance');
  const [numBins, setNumBins] = useState<number>(5);
  const [bivariateTab, setBivariateTab] = useState<'road_transit' | 'delivery_weight'>('road_transit');

  // Loading, Refresh & Error States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Revenue Breakdown State (ADMIN & DISPATCHER)
  const { can } = useAuth();
  const canViewRevenue = can('dashboard:revenue');
  const [revenueData, setRevenueData] = useState<RevenueBreakdownResponse | null>(null);
  const [isRevenueLoading, setIsRevenueLoading] = useState<boolean>(false);
  const [revenueError, setRevenueError] = useState<string | null>(null);

  const fetchRevenue = async () => {
    if (!canViewRevenue) return;
    setIsRevenueLoading(true);
    setRevenueError(null);
    try {
      const data = await dashboardService.getRevenueBreakdown(30);
      setRevenueData(data);
    } catch (err: any) {
      setRevenueError(err.response?.data?.message || 'Failed to load revenue breakdown');
    } finally {
      setIsRevenueLoading(false);
    }
  };

  // Fetch all statistical datasets concurrently from backend
  const fetchAllStatistics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, distRes, regRes, trendRes] = await Promise.all([
        sdaService.getStatisticalSummary(),
        sdaService.getDistribution(numBins),
        sdaService.getRegression(bivariateTab),
        sdaService.getTrends()
      ]);
      setStatsSummary(sumRes);
      setDistribution(distRes);
      setRegression(regRes);
      setTrends(trendRes);
    } catch (err: any) {
      console.error('Failed to load statistical analytics', err);
      setError('Could not fetch statistical analytics from backend database.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBivariateTabChange = async (target: 'road_transit' | 'delivery_weight') => {
    setBivariateTab(target);
    try {
      const regRes = await sdaService.getRegression(target);
      setRegression(regRes);
    } catch (err) {
      console.error('Failed to update regression target', err);
    }
  };

  // Re-fetch distribution bins when bin count changes
  const handleBinsChange = async (binsValue: number | string) => {
    const bins = Number(binsValue);
    setNumBins(bins);
    try {
      const distRes = await sdaService.getDistribution(bins);
      setDistribution(distRes);
    } catch (err) {
      console.error('Failed to update distribution bins', err);
    }
  };

  useEffect(() => {
    fetchAllStatistics();
  }, []);

  useEffect(() => {
    if (canViewRevenue) {
      fetchRevenue();
    }
  }, [canViewRevenue]);

  // Compute Overview KPI Metrics from real database records
  const meanDist = statsSummary?.delivery_distances?.mean;
  const stdDist = statsSummary?.delivery_distances?.std_dev;
  const medianDist = statsSummary?.delivery_distances?.median;
  const totalDeliveries = statsSummary?.total_deliveries_analyzed || 0;

  // Active distribution histogram data
  const activeDistributionData = useMemo(() => {
    if (!distribution) return [];
    const rawList = selectedDistVar === 'distance'
      ? distribution.distance_distribution
      : distribution.weight_distribution;
    if (!Array.isArray(rawList)) return [];
    return rawList.map((item) => ({
      range: String(item.range || `${item.min ?? 0} - ${item.max ?? 0}`),
      min: Number(item.min) || 0,
      max: Number(item.max) || 0,
      count: Number(item.count) || 0,
      frequency: Number(item.frequency) || 0,
    }));
  }, [distribution, selectedDistVar]);

  // Active distribution metric summary
  const activeDistMetric: UnivariateMetric | undefined = useMemo(() => {
    if (!statsSummary) return undefined;
    return selectedDistVar === 'distance'
      ? statsSummary.delivery_distances
      : statsSummary.delivery_weights;
  }, [statsSummary, selectedDistVar]);

  // Overview KPI Card definitions (without bottom badge row)
  const statKPIs = [
    {
      title: 'Average Trip Distance',
      value: meanDist !== null && meanDist !== undefined ? `${fmt1(meanDist)} km` : 'N/A',
      subtext: `Across ${totalDeliveries} consignments`,
      icon: Activity,
      colorClass: 'text-blue-600 dark:text-blue-400',
      bgClass: 'bg-blue-50 dark:bg-blue-950/40'
    },
    {
      title: 'Median Trip Distance',
      value: medianDist !== null && medianDist !== undefined ? `${fmt1(medianDist)} km` : 'N/A',
      subtext: 'Middle value across delivery trips',
      icon: Calculator,
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-50 dark:bg-emerald-950/40'
    },
    {
      title: 'Distance Standard Deviation',
      value: stdDist !== null && stdDist !== undefined ? `±${fmt1(stdDist)} km` : 'N/A',
      subtext: 'Dispersion across delivery trips',
      icon: Sigma,
      colorClass: 'text-indigo-600 dark:text-indigo-400',
      bgClass: 'bg-indigo-50 dark:bg-indigo-950/40'
    },
    {
      title: 'Distance vs. Time Correlation',
      value: regression?.correlation !== null && regression?.correlation !== undefined
        ? `r = ${fmt2(regression.correlation)}`
        : 'N/A',
      subtext: regression?.r_squared !== null && regression?.r_squared !== undefined
        ? `${(regression.r_squared * 100).toFixed(1)}% variance explained`
        : 'Awaiting paired data',
      icon: TrendingUp,
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-50 dark:bg-amber-950/40'
    }
  ];

  // Helper for equation with units
  const equationText = useMemo(() => {
    if (!regression) return '';
    const intercept = fmt1(regression.intercept);
    const slope = fmt2(regression.slope);
    if (bivariateTab === 'road_transit') {
      return `Time (min) = ${intercept} + ${slope} x distance (km)`;
    }
    return `Weight (kg) = ${intercept} + ${slope} x distance (km)`;
  }, [regression, bivariateTab]);

  // Formatted p-value text
  const pValText = useMemo(() => {
    if (!regression) return '';
    if (regression.p_value != null) {
      if (regression.p_value === 0 || regression.p_value < 0.001) {
        return 'p < 0.001';
      }
      return `p = ${fmt2(regression.p_value)}`;
    }
    return 'p < 0.001';
  }, [regression]);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* 1. PROFESSIONAL PAGE HEADER                                        */}
      {/* ------------------------------------------------------------------ */}
      <PageHeader
        title="Analytics"
        subtitle="Delivery volume distributions, transit metrics, and operational trends"
        icon={BarChart3}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchAllStatistics}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Analytics</span>
            </button>

            <button
              onClick={() => navigate('/reports')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm transition-colors cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <span>View Reports</span>
            </button>

            {statsSummary && (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-600 dark:text-slate-400">
                <Database className="h-3 w-3 text-blue-600" />
                <span>N = {statsSummary.total_deliveries_analyzed} Consignments</span>
              </div>
            )}
          </div>
        }
      />

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. STATISTICAL SUMMARY CARDS (BOTTOM ROW REMOVED)                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statKPIs.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.title}
              className="glass-card rounded-2xl p-5 space-y-2 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="truncate pr-1">{kpi.title}</span>
                <div className={`p-2 rounded-xl ${kpi.bgClass} ${kpi.colorClass} shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tracking-tight">
                  {kpi.value}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {kpi.subtext}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. TWO CLEAN SCOPE STATS: NUMBER OF DELIVERIES & ROADS             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Deliveries Analyzed</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
              {statsSummary?.total_deliveries_analyzed ?? 0}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Truck className="h-4 w-4" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Road Network Edges</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
              {statsSummary?.total_roads_analyzed ?? 0}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <Network className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* REVENUE SECTION (ADMIN & DISPATCHER ONLY)                         */}
      {/* ------------------------------------------------------------------ */}
      {canViewRevenue && (
        <SectionCard
          title="Revenue (Last 30 Days)"
          icon={TrendingUp}
          action={
            <button
              onClick={fetchRevenue}
              disabled={isRevenueLoading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh revenue"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRevenueLoading ? 'animate-spin' : ''}`} />
            </button>
          }
        >
          {isRevenueLoading ? (
            <LoadingState message="Loading revenue analytics..." />
          ) : revenueError ? (
            <ErrorState
              title="Failed to load revenue data"
              message={revenueError}
              onRetry={fetchRevenue}
            />
          ) : !revenueData || revenueData.totals.parcels === 0 ? (
            <EmptyState
              title="No delivered parcels in the last 30 days"
              message="Revenue is recorded when parcels are successfully delivered."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Daily Bar Chart (7 Cols) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Daily Delivered Revenue (INR)
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Total: {formatINR(revenueData.totals.revenue)} ({revenueData.totals.parcels} parcels)
                  </span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={revenueData.daily}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(d: string) => d.slice(5)}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: number) => `₹${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1E293B',
                          color: '#fff',
                          borderRadius: '8px',
                          fontSize: '12px',
                          border: 'none',
                        }}
                        formatter={(value: any, _name: any, item: any) => [
                          `${formatINR(Number(value))} (${item.payload.parcels} parcels)`,
                          'Revenue'
                        ]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Priority Table (5 Cols) */}
              <div className="lg:col-span-5 space-y-3">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Revenue by Priority Speed
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3 text-right">Parcels</th>
                        <th className="py-2.5 px-3 text-right">Revenue</th>
                        <th className="py-2.5 px-3 text-right">Avg / Parcel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {revenueData.by_priority.map((p) => (
                        <tr key={p.priority} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                            {p.priority}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            {p.parcels}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {formatINR(p.revenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatINR(p.average_per_parcel)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 dark:bg-slate-800/80 font-semibold border-t-2 border-slate-200 dark:border-slate-700">
                        <td className="py-2.5 px-3 text-slate-900 dark:text-white">
                          Total
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-white">
                          {revenueData.totals.parcels}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {formatINR(revenueData.totals.revenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-white">
                          {formatINR(revenueData.totals.average_per_parcel)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. DISTRIBUTION VISUALIZATION & FREQUENCY HISTOGRAMS               */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Frequency Distribution Histogram (7 Cols) */}
        <div className="glass-card lg:col-span-7 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                Frequency Distribution Histogram
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Frequency distribution across operational metric intervals
              </p>
            </div>

            {/* Variable & Bin Count Selectors */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Metric Variable Switcher */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSelectedDistVar('distance')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    selectedDistVar === 'distance'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Distance (km)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDistVar('weight')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    selectedDistVar === 'weight'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Weight (kg)
                </button>
              </div>

              {/* Bin Count Dropdown */}
              <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                <span>Bins:</span>
                <select
                  value={numBins}
                  onChange={(e) => handleBinsChange(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs cursor-pointer focus:outline-none"
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={7}>7</option>
                  <option value={10}>10</option>
                </select>
              </div>
            </div>
          </div>

          {/* Histogram Bar Chart */}
          <div className="w-full h-[288px]" style={{ height: '288px', minHeight: '288px' }}>
            {isLoading ? (
              <div className="h-full w-full flex flex-col justify-end gap-3 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl animate-pulse">
                <div className="flex items-end gap-4 h-48 w-full justify-around px-4">
                  <div className="w-12 bg-slate-200 dark:bg-slate-700 rounded-t h-24"></div>
                  <div className="w-12 bg-slate-200 dark:bg-slate-700 rounded-t h-40"></div>
                  <div className="w-12 bg-slate-200 dark:bg-slate-700 rounded-t h-32"></div>
                  <div className="w-12 bg-slate-200 dark:bg-slate-700 rounded-t h-20"></div>
                  <div className="w-12 bg-slate-200 dark:bg-slate-700 rounded-t h-16"></div>
                </div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
              </div>
            ) : activeDistributionData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activeDistributionData}
                  margin={{ top: 10, right: 15, bottom: 25, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={40}
                    label={{
                      value: selectedDistVar === 'distance' ? 'Distance (km)' : 'Weight (kg)',
                      position: 'insideBottom',
                      offset: -8,
                      fontSize: 11,
                      fill: '#64748b'
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    allowDecimals={false}
                    label={{
                      value: 'Number of deliveries',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 0,
                      style: { textAnchor: 'middle', fill: '#64748b', fontSize: 11 }
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        const count = Number(item.count) || 0;
                        const pct = Math.round((Number(item.frequency) || 0) * 100);
                        return (
                          <div className="rounded-lg bg-slate-900 text-white p-2.5 text-xs shadow-lg border border-slate-700 pointer-events-none">
                            <p className="font-semibold text-slate-300">{item.range}</p>
                            <p className="font-bold text-blue-400 mt-0.5">{count} deliveries ({pct}%)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Metric Highlights Strip */}
          {activeDistMetric && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-center font-mono">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850">
                <span className="text-[10px] text-slate-400 block font-sans">Mean</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{fmt1(activeDistMetric.mean)}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850">
                <span className="text-[10px] text-slate-400 block font-sans">Median</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt1(activeDistMetric.median)}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850">
                <span className="text-[10px] text-slate-400 block font-sans">Std Dev</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">±{fmt1(activeDistMetric.std_dev)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Temporal Dispatch Volume Trend (5 Cols) */}
        <div className="glass-card lg:col-span-5 rounded-2xl p-5 space-y-4">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" />
              Weekday Dispatch Volume
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Orders and mean trip distances grouped by weekday
            </p>
          </div>

          <div className="w-full h-[288px]" style={{ height: '288px', minHeight: '288px' }}>
            {isLoading ? (
              <div className="h-full w-full flex items-end gap-3 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl animate-pulse">
                <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-t flex-1"></div>
                <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-t flex-1"></div>
                <div className="h-28 bg-slate-200 dark:bg-slate-700 rounded-t flex-1"></div>
                <div className="h-36 bg-slate-200 dark:bg-slate-700 rounded-t flex-1"></div>
                <div className="h-44 bg-slate-200 dark:bg-slate-700 rounded-t flex-1"></div>
                <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-t flex-1"></div>
                <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded-t flex-1"></div>
              </div>
            ) : (!trends?.trends || trends.trends.length === 0) ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={trends.trends}
                  margin={{ top: 10, right: 10, bottom: 10, left: -10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: '#10b981' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px'
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="deliveries"
                    name="Orders"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avg_distance_km"
                    name="Mean Distance (km)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. DELIVERY & ROUTE METRICS DISTRIBUTION TABLE                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2">
            <Table className="h-4 w-4 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Delivery & Route Metrics Distribution Table
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Operational metrics covering delivery distances, cargo weights, and transit durations
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 uppercase font-semibold">
              <tr>
                <th className="pb-2.5">Metric Variable</th>
                <th className="pb-2.5">Records (N)</th>
                <th className="pb-2.5">Average</th>
                <th className="pb-2.5">Median</th>
                <th className="pb-2.5">Std Dev</th>
                <th className="pb-2.5">Min - Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {[
                statsSummary?.delivery_distances,
                statsSummary?.delivery_weights,
                statsSummary?.road_distances,
                statsSummary?.route_distances
              ].filter(Boolean).map((metric: any) => {
                const metricName =
                  metric.metric_name === 'Dijkstra Optimal Path Cost (km)'
                    ? 'Planned route distance (km)'
                    : metric.metric_name;
                return (
                  <tr
                    key={metric.metric_name}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition-colors"
                  >
                    <td className="py-3 font-sans font-semibold text-slate-900 dark:text-white">
                      {metricName}
                    </td>
                    <td className="py-3">{metric.count}</td>
                    <td className="py-3 font-bold text-blue-600 dark:text-blue-400">
                      {fmt1(metric.mean)}
                    </td>
                    <td className="py-3 text-emerald-600 dark:text-emerald-400">
                      {fmt1(metric.median)}
                    </td>
                    <td className="py-3 font-medium">
                      ±{fmt1(metric.std_dev)}
                    </td>
                    <td className="py-3">
                      {fmt1(metric.min)} - {fmt1(metric.max)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 6. MERGED BIVARIATE SECTION: DISTANCE VS TRAVEL TIME / WEIGHT       */}
      {/* ------------------------------------------------------------------ */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              Distance vs Travel Time
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Fitted linear relationship and observed distribution
            </p>
          </div>

          {/* Target Tabs */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleBivariateTabChange('road_transit')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                bivariateTab === 'road_transit'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Distance vs Travel Time
            </button>
            <button
              type="button"
              onClick={() => handleBivariateTabChange('delivery_weight')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                bivariateTab === 'delivery_weight'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Distance vs Weight
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="w-full h-[288px] flex items-center justify-center bg-slate-50/50 dark:bg-slate-800/30 rounded-xl animate-pulse">
            <div className="h-44 w-3/4 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        ) : !regression || !regression.scatter_points || regression.scatter_points.length === 0 ? (
          <div className="w-full h-[288px] flex items-center justify-center text-xs text-slate-400">
            No data yet
          </div>
        ) : (
          <div className="space-y-4">
            {/* Equation Strip */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Fitted Equation
                </span>
                <span className="text-base font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {equationText}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-sans">Correlation</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">r = {fmt2(regression.correlation)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-sans">Significance</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{pValText}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-sans">Variance</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {regression.r_squared !== null ? `${(regression.r_squared * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Scatter Plot with Trend Line & Fixed Legend Overlap */}
            <div className="w-full h-[288px]" style={{ height: '288px', minHeight: '288px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  margin={{ top: 10, right: 20, bottom: 25, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis
                    dataKey="x"
                    type="number"
                    name={regression.x_label}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    domain={['auto', 'auto']}
                    label={{
                      value: regression.x_label,
                      position: 'insideBottom',
                      offset: -12,
                      fontSize: 10,
                      fill: '#64748b'
                    }}
                  />
                  <YAxis
                    dataKey="y"
                    type="number"
                    name={regression.y_label}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    domain={['auto', 'auto']}
                    label={{
                      value: regression.y_label,
                      angle: -90,
                      position: 'insideLeft',
                      offset: 0,
                      fontSize: 10,
                      fill: '#64748b'
                    }}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      `${fmt1(val)}`,
                      name === 'Fitted Trend Line' ? 'Trend Line' : 'Observed Pair'
                    ]}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                  />
                  <Scatter
                    name="Observed Pairs"
                    data={regression.scatter_points || []}
                    fill="#6366f1"
                  />
                  <Line
                    name="Fitted Trend Line"
                    data={regression.line_points || []}
                    type="linear"
                    dataKey="y"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Short sentence of result */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              {bivariateTab === 'road_transit' ? (
                <p>
                  Travel time increases consistently with road distance (r = {fmt2(regression.correlation)}, {pValText}).
                </p>
              ) : (
                <p>
                  Package weight is distributed across dispatch distances (r = {fmt2(regression.correlation)}, {pValText}).
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hypothesis Tests */}
      <HypothesisTests />
    </div>
  );
};

export default StatisticalAnalytics;
