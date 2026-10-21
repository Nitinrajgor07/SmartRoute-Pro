import React from 'react';
import { Route, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { ShortestPathResponse } from '../../types';

interface RouteResultProps {
  routeResult: ShortestPathResponse | null;
  activeRouteIndex: number;
  onSelectRouteIndex: (index: number) => void;
  calculatedAt?: string | null;
}

export const RouteResult: React.FC<RouteResultProps> = ({
  routeResult,
  activeRouteIndex,
  onSelectRouteIndex,
}) => {
  // A search ran but no active road connects the two hubs
  if (routeResult && !routeResult.has_route) {
    const fromName = routeResult.source_location?.name ?? 'the start hub';
    const toName = routeResult.destination_location?.name ?? 'the destination hub';
    return (
      <div className="glass-card rounded-2xl p-6 text-center space-y-2" data-testid="no-route-found">
        <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 inline-flex">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No road route found</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
          No open road connects <span className="font-semibold">{fromName}</span> to{' '}
          <span className="font-semibold">{toName}</span>. Closed (inactive) roads are skipped, so pick another hub
          or reopen a road.
        </p>
      </div>
    );
  }

  if (!routeResult) {
    return (
      <div className="glass-card rounded-2xl p-6 text-center space-y-1.5">
        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 inline-flex">
          <Route className="h-5 w-5" />
        </div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          No route yet
        </h3>
        <p className="text-[11px] text-slate-400">
          Select two hubs
        </p>
      </div>
    );
  }

  // Alternative routes excluding primary (index 0)
  const otherRoutes = (routeResult.routes || []).filter((r) => r.route_index !== 0).slice(0, 2);

  const displayDistance =
    activeRouteIndex === 0
      ? routeResult.total_distance_km
      : routeResult.routes?.find((r) => r.route_index === activeRouteIndex)?.total_distance_km ??
        routeResult.total_distance_km;

  // Build route string formatted as: Majestic Depot -> Malleshwaram -> Whitefield
  const routeString = routeResult.path_nodes && routeResult.path_nodes.length > 0
    ? routeResult.path_nodes.map((n) => n.name).join(' -> ')
    : routeResult.path.join(' -> ');

  const stopsCount = routeResult.path_nodes?.length ?? routeResult.path.length;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Shortest route
          </h3>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
          Optimal
        </span>
      </div>

      {/* 3 Metric Cards: Distance, Stops, Time */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-3 rounded-xl glass-tile">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Distance
          </span>
          <span className="font-extrabold text-base md:text-lg text-indigo-600 dark:text-indigo-400 font-mono mt-1 block">
            {displayDistance != null ? `${displayDistance.toFixed(1)} km` : '0 km'}
          </span>
        </div>

        <div className="p-3 rounded-xl glass-tile">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Stops
          </span>
          <span className="font-extrabold text-base md:text-lg text-slate-900 dark:text-white mt-1 block">
            {stopsCount}
          </span>
        </div>

        <div className="p-3 rounded-xl glass-tile">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Time
          </span>
          <span className="font-extrabold text-base md:text-lg text-indigo-600 dark:text-indigo-400 font-mono mt-1 block">
            {routeResult.execution_time_ms} ms
          </span>
        </div>
      </div>

      {/* Route shown as: Majestic Depot -> Malleshwaram -> Whitefield */}
      <div className="p-3 rounded-xl glass-tile">
        <div className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed break-words">
          {routeString}
        </div>
      </div>

      {/* Alternative Routes List */}
      {otherRoutes.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            Other routes
          </span>
          <div className="space-y-1.5">
            {otherRoutes.map((alt) => (
              <div
                key={alt.route_index}
                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                  activeRouteIndex === alt.route_index
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/40'
                }`}
              >
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Route #{alt.route_index}
                  </span>
                  <span className="text-[11px] text-slate-500 ml-2 font-mono">
                    {alt.total_distance_km.toFixed(1)} km
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectRouteIndex(alt.route_index)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                >
                  {activeRouteIndex === alt.route_index ? 'Active' : 'Show'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
