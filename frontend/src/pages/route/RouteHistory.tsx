import React from 'react';
import { History } from 'lucide-react';
import type { RouteHistoryItem } from '../../types';

interface RouteHistoryProps {
  history: RouteHistoryItem[];
  isLoading: boolean;
  totalSavedRoutes: number;
  onLoadRoute: (item: RouteHistoryItem) => void;
}

export const RouteHistory: React.FC<RouteHistoryProps> = ({
  history,
  isLoading,
  totalSavedRoutes,
  onLoadRoute
}) => {
  // Deduplicate items calculated within 60 seconds of each other with identical source, destination, distance
  const deduplicatedHistory = React.useMemo(() => {
    const list: RouteHistoryItem[] = [];
    for (let i = 0; i < history.length; i++) {
      const cur = history[i];
      const isDupe = list.some((prev) => {
        if (
          prev.source_location_id === cur.source_location_id &&
          prev.destination_location_id === cur.destination_location_id &&
          prev.total_distance_km === cur.total_distance_km
        ) {
          const t1 = prev.created_at ? new Date(prev.created_at).getTime() : 0;
          const t2 = cur.created_at ? new Date(cur.created_at).getTime() : 0;
          return Math.abs(t1 - t2) < 60000;
        }
        return false;
      });
      if (!isDupe) {
        list.push(cur);
      }
    }
    return list.slice(0, 5);
  }, [history]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Recent routes
          </h3>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {totalSavedRoutes > 0 ? totalSavedRoutes : deduplicatedHistory.length} saved
        </span>
      </div>

      {isLoading && deduplicatedHistory.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400">Loading routes</div>
      ) : deduplicatedHistory.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400">No routes</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-2 px-3">From</th>
                <th className="py-2 px-3">To</th>
                <th className="py-2 px-3">Distance</th>
                <th className="py-2 px-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {deduplicatedHistory.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onLoadRoute(item)}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
                  title="Load route"
                >
                  <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                    {item.source_name || `Hub #${item.source_location_id}`}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                    {item.kind === 'run' || item.algorithm === 'TSP'
                      ? `Run - ${item.stop_count ?? 'N'} stops`
                      : (item.destination_name || `Hub #${item.destination_location_id}`)}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {item.total_distance_km.toFixed(1)} km
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                    {formatDate(item.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
