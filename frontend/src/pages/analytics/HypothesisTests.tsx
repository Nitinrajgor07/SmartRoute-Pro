import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { sdaService } from '../../services/api';
import type { InferenceResponse, TestDetails } from '../../types';

interface DetailsDisclosureProps {
  details?: TestDetails;
}

const DetailsDisclosure: React.FC<DetailsDisclosureProps> = ({ details }) => {
  if (!details) return null;

  return (
    <details className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs group">
      <summary className="font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none">
        Details
      </summary>
      <div className="mt-2.5 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
        <div><span className="font-sans font-semibold text-slate-700 dark:text-slate-300">Test:</span> {details.test_name}</div>
        <div><span className="font-sans font-semibold text-slate-700 dark:text-slate-300">H0:</span> {details.h0}</div>
        <div><span className="font-sans font-semibold text-slate-700 dark:text-slate-300">H1:</span> {details.h1}</div>
        <div><span className="font-sans font-semibold text-slate-700 dark:text-slate-300">Significance level:</span> α = {details.significance_level}</div>
        <div><span className="font-sans font-semibold text-slate-700 dark:text-slate-300">Statistic:</span> {details.statistic ?? 'N/A'}</div>
        <div><span className="font-sans font-semibold text-slate-700 dark:text-slate-300">Degrees of freedom:</span> {details.degrees_of_freedom ?? 'N/A'}</div>
        <div><span className="font-sans font-semibold text-slate-700 dark:text-slate-300">p-value:</span> {details.p_value_display}</div>
        <div><span className="font-sans font-semibold text-slate-700 dark:text-slate-300">Effect size:</span> {details.effect_size != null ? `${details.effect_size} (${details.effect_size_label || 'Effect'})` : 'N/A'}</div>
        <div><span className="font-sans font-semibold text-slate-700 dark:text-slate-300">Sample sizes:</span> {details.sample_sizes}</div>
      </div>
    </details>
  );
};

export const HypothesisTests: React.FC = () => {
  const [metric, setMetric] = useState<'distance_km' | 'package_weight_kg'>('distance_km');
  const [data, setData] = useState<InferenceResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInference = async (m: 'distance_km' | 'package_weight_kg') => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await sdaService.getInference({ metric: m });
      setData(res);
    } catch {
      setError('Could not fetch hypothesis tests from server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInference(metric);
  }, [metric]);

  const ci = data?.confidence_interval;
  const tt = data?.t_test;
  const chi = data?.chi_square;

  return (
    <div className="space-y-4">
      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
        Hypothesis tests
      </h2>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass-card rounded-2xl p-5 flex items-center justify-center min-h-[180px]"
            >
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : !data || !data.available ? (
        <div className="glass-card p-6 rounded-2xl text-center text-xs text-slate-500">
          Hypothesis testing is not available: {data?.reason || 'No data found.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {/* Card 1: Average distance / Average weight */}
          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {metric === 'distance_km' ? 'Average distance' : 'Average weight'}
                </span>
                <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setMetric('distance_km')}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      metric === 'distance_km'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Distance
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('package_weight_kg')}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      metric === 'package_weight_kg'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Weight
                  </button>
                </div>
              </div>

              <div className="mt-1">
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  {ci && ci.lower_limit != null && ci.upper_limit != null
                    ? `${ci.lower_limit.toFixed(1)} – ${ci.upper_limit.toFixed(1)} ${ci.unit || 'km'}`
                    : 'N/A'}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {ci?.summary}
                </p>
              </div>
            </div>

            <DetailsDisclosure details={ci?.details} />
          </div>

          {/* Card 2: Express vs Standard */}
          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Express vs Standard
                </span>
                {tt && tt.available && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      tt.is_significant
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {tt.is_significant ? 'Significant' : 'Not significant'}
                  </span>
                )}
              </div>

              <div className="mt-1">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {tt?.summary}
                </p>
                {tt && tt.available && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-2">
                    {tt.group_a} {tt.mean_a?.toFixed(1)} h (n = {tt.n_a}), {tt.group_b} {tt.mean_b?.toFixed(1)} h (n = {tt.n_b})
                  </p>
                )}
                {tt?.warning && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                    {tt.warning}
                  </p>
                )}
              </div>
            </div>

            <DetailsDisclosure details={tt?.details} />
          </div>

          {/* Card 3: Status and priority */}
          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Status and priority
                </span>
                {chi && chi.available && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      chi.is_significant
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {chi.is_significant ? 'Significant' : 'Not significant'}
                  </span>
                )}
              </div>

              <div className="mt-1">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {chi?.summary}
                </p>
                {chi?.collapsed && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Compared Delivered with Not delivered
                  </p>
                )}
              </div>
            </div>

            <DetailsDisclosure details={chi?.details} />
          </div>
        </div>
      )}
    </div>
  );
};

export default HypothesisTests;
