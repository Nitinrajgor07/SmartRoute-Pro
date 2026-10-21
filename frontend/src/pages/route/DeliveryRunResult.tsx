import React, { useMemo, useState } from 'react';
import {
  Route,
  CheckCircle2,
  Clock,
  Fuel,
  MapPin,
  Flag,
  Warehouse,
  Lightbulb,
  ChevronDown,
  Send,
  Loader2,
  X,
  AlertCircle
} from 'lucide-react';
import { routesService } from '../../services/api';
import type { DeliveryRunResponse } from '../../types';

interface DeliveryRunResultProps {
  runResult: DeliveryRunResponse | null;
  plannedDeliveryIds?: number[];
  startTime?: string;
  onStartTimeChange?: (newTime: string) => void;
  onDispatched?: (driverName: string) => void;
}

// Simple, clearly-labelled estimate inputs for the fuel card.
const VAN_KM_PER_LITRE = 12; // typical small diesel delivery van
const DIESEL_PRICE_PER_LITRE = 90; // approx. Bengaluru diesel price (₹)
const FALLBACK_CITY_SPEED_KMH = 22; // used only if the server sends no drive time

export const getDefaultStartTime = (): string => {
  const now = new Date();
  const minutes = now.getMinutes();
  const remainder = minutes % 5;
  if (remainder !== 0) {
    now.setMinutes(minutes + (5 - remainder));
  }
  now.setSeconds(0, 0);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

export const addMinutesToClock = (clock: string, mins: number): string => {
  const [hhStr, mmStr] = (clock || '09:00').split(':');
  const hh = parseInt(hhStr, 10) || 0;
  const mm = parseInt(mmStr, 10) || 0;
  const total = Math.round(hh * 60 + mm + mins) % (24 * 60);
  const normalized = total < 0 ? total + 24 * 60 : total;
  const h24 = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatMinutes = (mins: number): string => {
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

export const DeliveryRunResult: React.FC<DeliveryRunResultProps> = ({
  runResult,
  plannedDeliveryIds = [],
  startTime: controlledStartTime,
  onStartTimeChange,
  onDispatched
}) => {
  const [localStartTime, setLocalStartTime] = useState<string>(getDefaultStartTime());
  const startTime = controlledStartTime ?? localStartTime;
  const handleStartTimeChange = (val: string) => {
    setLocalStartTime(val);
    if (onStartTimeChange) {
      onStartTimeChange(val);
    }
  };

  const [showExplain, setShowExplain] = useState<boolean>(true);

  // Dispatch modal and submission state
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [driverName, setDriverName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchedDriver, setDispatchedDriver] = useState<string | null>(null);

  // Timeline rows: depot start, each stop, optional return to depot.
  const timeline = useMemo(() => {
    if (!runResult?.legs?.length) return [];
    const rows: {
      name: string;
      kind: 'start' | 'stop' | 'end';
      stopNumber?: number;
      legKm?: number;
      legMin?: number;
      via?: string[];
      arriveAt: number; // minutes after start
    }[] = [];

    rows.push({
      name: runResult.legs[0].from_name,
      kind: 'start',
      arriveAt: 0
    });

    const offsets = runResult.arrival_offsets_min || [];
    let fallbackClock = 0;

    runResult.legs.forEach((leg, i) => {
      const legMin = leg.duration_min ?? (leg.distance_km / FALLBACK_CITY_SPEED_KMH) * 60;
      fallbackClock += legMin;
      const isReturn = runResult.return_to_depot && i === runResult.legs.length - 1;
      const arriveOffset = offsets[i] !== undefined ? offsets[i] : fallbackClock;
      if (!isReturn && offsets[i] === undefined) {
        fallbackClock += (runResult.service_minutes_per_stop ?? 5);
      }

      rows.push({
        name: leg.to_name,
        kind: isReturn ? 'end' : 'stop',
        stopNumber: isReturn ? undefined : i + 1,
        legKm: leg.distance_km,
        legMin,
        via: leg.via_names ?? [],
        arriveAt: arriveOffset
      });
    });

    return rows;
  }, [runResult]);

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = driverName.trim();
    if (!trimmed) {
      setDispatchError('Driver name is required.');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 100) {
      setDispatchError('Driver name must be between 2 and 100 characters.');
      return;
    }
    if (plannedDeliveryIds.length === 0) {
      setDispatchError('No deliveries selected to dispatch.');
      return;
    }

    setIsSubmitting(true);
    setDispatchError(null);

    try {
      await routesService.dispatchRun({
        delivery_ids: plannedDeliveryIds,
        driver_name: trimmed
      });
      setDispatchedDriver(trimmed);
      setIsDialogOpen(false);
      if (onDispatched) {
        onDispatched(trimmed);
      }
    } catch (err: any) {
      setDispatchError(err?.response?.data?.message || 'Failed to dispatch delivery run');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!runResult) {
    return (
      <div className="glass-card rounded-2xl p-6 text-center space-y-1.5">
        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 inline-flex">
          <Route className="h-5 w-5" />
        </div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">No run planned yet</h3>
        <p className="text-[11px] text-slate-400">Pick a depot, tick 2 to 8 deliveries, then press Plan run</p>
      </div>
    );
  }

  const totalDistance = runResult.recommended_distance_km ?? runResult.total_distance_km ?? 0;
  const listedDistance = runResult.as_listed?.distance_km ?? totalDistance;
  const savedKm = runResult.savings?.saved_km ?? 0;
  const savedPercent = runResult.savings?.saved_percent ?? 0;
  const hasSaving = savedKm > 0.05;
  const savedText = hasSaving ? `${savedKm.toFixed(1)} km (${Math.round(savedPercent)}%)` : 'Already optimal';

  const driveMinutes =
    runResult.recommended_duration_min ??
    runResult.legs.reduce((sum, l) => sum + (l.duration_min ?? (l.distance_km / FALLBACK_CITY_SPEED_KMH) * 60), 0);
  const totalTripMinutes = timeline.length ? timeline[timeline.length - 1].arriveAt : driveMinutes;

  const fuelLitres = totalDistance / VAN_KM_PER_LITRE;
  const fuelCost = fuelLitres * DIESEL_PRICE_PER_LITRE;
  const fuelSaved = (savedKm / VAN_KM_PER_LITRE) * DIESEL_PRICE_PER_LITRE;

  const fastMethod = runResult.fast_method;
  const bestPossible = runResult.exact_method || runResult.fast_method;
  const stopCount = runResult.stop_count;
  const hubsInMatrix = runResult.hubs_in_matrix ?? stopCount + 1;
  const pairsComputed = runResult.pairs_computed ?? hubsInMatrix * (hubsInMatrix - 1);
  const ordersChecked = runResult.orders_checked_exact ?? (runResult.exact_method ? factorial(stopCount) : null);
  const gap = runResult.gap_percent ?? 0;

  const listedNames = runResult.as_listed?.order_names ?? [];
  const smartNames = runResult.recommended_order_names ?? timeline.filter((r) => r.kind !== 'end').map((r) => r.name);
  const maxBar = Math.max(listedDistance, totalDistance, 0.1);

  return (
    <div className="glass-card rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Delivery run plan</h3>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
          {hasSaving ? `Saved ${savedText}` : 'Already optimal'}
        </span>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
        <div className="p-3 rounded-xl glass-tile">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Total distance</span>
          <span className="font-extrabold text-lg text-indigo-600 dark:text-indigo-400 font-mono mt-1 block">
            {totalDistance.toFixed(1)} km
          </span>
        </div>
        <div className="p-3 rounded-xl glass-tile">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Drive time</span>
          <span className="font-extrabold text-lg text-slate-900 dark:text-white mt-1 block">{formatMinutes(driveMinutes)}</span>
        </div>
        <div className="p-3 rounded-xl glass-tile">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Stops</span>
          <span className="font-extrabold text-lg text-slate-900 dark:text-white mt-1 block">{stopCount}</span>
        </div>
        <div className="p-3 rounded-xl glass-tile">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Saved</span>
          <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 mt-1.5 block" title={savedText}>
            {savedText}
          </span>
        </div>
      </div>

      {/* Before vs after */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Your order vs smart order</div>
        <div className="space-y-2 p-3 rounded-xl glass-tile">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Order you ticked</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{listedDistance.toFixed(1)} km</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-rose-400" style={{ width: `${(listedDistance / maxBar) * 100}%` }} />
            </div>
            {listedNames.length > 0 && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {[...listedNames, ...(runResult.return_to_depot ? [listedNames[0]] : [])].join(' → ')}
              </div>
            )}
          </div>
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Smart order (SmartRoute)</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{totalDistance.toFixed(1)} km</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(totalDistance / maxBar) * 100}%` }} />
            </div>
            {smartNames.length > 0 && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {[...smartNames, ...(runResult.return_to_depot ? [smartNames[0]] : [])].join(' → ')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Driver schedule & visit order */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Visit order and driver schedule</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Includes 5 min at each stop.</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <label className="flex items-center gap-1 font-semibold">
              Start time:
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value || '09:00')}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                data-testid="run-start-time"
              />
            </label>
          </div>
        </div>

        <ol className="relative p-3 rounded-xl glass-tile">
          {timeline.map((row, idx) => {
            const isLast = idx === timeline.length - 1;
            const badge =
              row.kind === 'start' ? (
                <span className="h-7 w-7 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-2 ring-emerald-300">
                  <Warehouse className="h-3.5 w-3.5" />
                </span>
              ) : row.kind === 'end' ? (
                <span className="h-7 w-7 rounded-full bg-rose-600 text-white flex items-center justify-center ring-2 ring-rose-300">
                  <Flag className="h-3.5 w-3.5" />
                </span>
              ) : (
                <span className="h-7 w-7 rounded-full bg-indigo-600 text-white font-extrabold text-[12px] flex items-center justify-center ring-2 ring-indigo-300">
                  {row.stopNumber}
                </span>
              );

            const arriveClock = addMinutesToClock(startTime, row.arriveAt);
            const timeLabel =
              row.kind === 'start'
                ? `Leave ${arriveClock}`
                : row.kind === 'end'
                ? `Back at depot ${arriveClock}`
                : `Arrive ${arriveClock}`;

            return (
              <li key={`${row.name}-${idx}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  {badge}
                  {!isLast && <span className="w-0.5 flex-1 bg-slate-300 dark:bg-slate-600 my-1 min-h-[18px]" />}
                </div>
                <div className={`flex-1 ${isLast ? '' : 'pb-3'}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-[13px] font-extrabold text-slate-900 dark:text-white">
                      {row.kind === 'start' ? `Start at ${row.name}` : row.kind === 'end' ? `Back to ${row.name}` : row.name}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                      <Clock className="h-3 w-3 inline mr-0.5 -mt-0.5" />
                      {timeLabel}
                    </span>
                  </div>
                  {row.kind !== 'start' && row.legKm != null && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {row.legKm.toFixed(1)} km · {formatMinutes(row.legMin ?? 0)} drive
                      {row.via && row.via.length > 0 && <> · via {row.via.join(', ')}</>}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="text-[11px] text-slate-600 dark:text-slate-300">
          Whole trip including stops: <span className="font-bold">{formatMinutes(totalTripMinutes)}</span>
          {timeline.length > 0 && (
            <> · finishes around <span className="font-bold">{addMinutesToClock(startTime, totalTripMinutes)}</span></>
          )}
        </div>
      </div>

      {/* Fuel estimate */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900">
        <Fuel className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-[11px] text-slate-700 dark:text-slate-300">
          <div>
            Fuel estimate: <span className="font-bold">{fuelLitres.toFixed(1)} L</span> ≈{' '}
            <span className="font-bold">₹{Math.round(fuelCost)}</span>
            {hasSaving && (
              <>
                {' '}· saves about <span className="font-bold text-emerald-700 dark:text-emerald-400">₹{Math.round(fuelSaved)}</span> on this trip
              </>
            )}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Assumes a diesel van at {VAN_KM_PER_LITRE} km/L and ₹{DIESEL_PRICE_PER_LITRE}/L.
          </div>
        </div>
      </div>

      {/* Method comparison */}
      {fastMethod && bestPossible && (
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Comparison</div>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 text-[11px]">
                  <th className="py-1.5 px-3 font-semibold">Method</th>
                  <th className="py-1.5 px-3 font-semibold">How it works</th>
                  <th className="py-1.5 px-3 font-semibold">Distance</th>
                  <th className="py-1.5 px-3 font-semibold text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">Fast method</td>
                  <td className="py-2 px-3 text-[11px] text-slate-500 dark:text-slate-400">Nearest stop first, then fix crossings (2-opt)</td>
                  <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">{fastMethod.distance_km.toFixed(1)} km</td>
                  <td className="py-2 px-3 font-mono text-right text-slate-500 dark:text-slate-400">{fastMethod.execution_time_ms.toFixed(1)} ms</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">Best possible</td>
                  <td className="py-2 px-3 text-[11px] text-slate-500 dark:text-slate-400">
                    {runResult.exact_method && ordersChecked ? `Tries all ${ordersChecked.toLocaleString()} orders` : 'Same as fast method'}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{bestPossible.distance_km.toFixed(1)} km</td>
                  <td className="py-2 px-3 font-mono text-right text-slate-500 dark:text-slate-400">{bestPossible.execution_time_ms.toFixed(1)} ms</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plain-language explanation */}
      <div className="rounded-xl border border-indigo-200/70 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30">
        <button
          type="button"
          onClick={() => setShowExplain((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-indigo-800 dark:text-indigo-200"
          aria-expanded={showExplain}
        >
          <span className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            How SmartRoute found this plan
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showExplain ? 'rotate-180' : ''}`} />
        </button>
        {showExplain && (
          <ol className="px-3 pb-3 space-y-2 text-[11px] text-slate-700 dark:text-slate-300 list-none">
            <li className="flex gap-2">
              <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                <span className="font-bold">Step 1, measure every road distance.</span> Dijkstra's shortest-path algorithm worked
                out the real road distance between every pair of the {hubsInMatrix} places (depot + {stopCount} stops), which is{' '}
                {pairsComputed} distances in total.
              </span>
            </li>
            <li className="flex gap-2">
              <Route className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                <span className="font-bold">Step 2, find the best order.</span>{' '}
                {runResult.exact_method && ordersChecked ? (
                  <>
                    With {stopCount} stops there are {stopCount}! = {ordersChecked.toLocaleString()} possible orders. The exact method
                    checked all of them in {bestPossible.execution_time_ms.toFixed(1)} ms. The fast method guessed in{' '}
                    {fastMethod.execution_time_ms.toFixed(1)} ms and was {gap > 0 ? `${gap.toFixed(1)}% longer` : 'just as good'}.
                  </>
                ) : (
                  <>The fast method (nearest stop first, then 2-opt fixes) built the order in {fastMethod.execution_time_ms.toFixed(1)} ms.</>
                )}
              </span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                <span className="font-bold">Step 3, pick the shortest.</span> The shortest order is {totalDistance.toFixed(1)} km.
                {hasSaving
                  ? ` Driving in the order you ticked would be ${listedDistance.toFixed(1)} km, so the driver saves ${savedText}.`
                  : ' The order you ticked was already the best one.'}
              </span>
            </li>
          </ol>
        )}
      </div>

      {/* Dispatched green status label */}
      {dispatchedDriver && (
        <div
          data-testid="dispatched-label"
          className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold text-xs flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Dispatched to {dispatchedDriver}</span>
        </div>
      )}

      {/* Dispatch Run Button */}
      <button
        type="button"
        data-testid="dispatch-run-btn"
        onClick={() => setIsDialogOpen(true)}
        disabled={Boolean(dispatchedDriver) || isSubmitting}
        className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-2 ${
          dispatchedDriver
            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
            : 'bg-brand-600 hover:bg-brand-700 text-white cursor-pointer hover:shadow'
        }`}
      >
        <Send className="h-3.5 w-3.5" />
        <span>Dispatch run</span>
      </button>

      {/* Confirmation Dialog Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl glass-card border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Dispatch this run</h4>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmitting) setIsDialogOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-900 dark:text-white">{plannedDeliveryIds.length}</span>{' '}
              {plannedDeliveryIds.length === 1 ? 'parcel' : 'parcels'} will change to In Transit.
            </p>

            <form onSubmit={handleDispatchSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="dispatch-driver-name"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 block"
                >
                  Driver name
                </label>
                <input
                  id="dispatch-driver-name"
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Marcus Vance"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              {dispatchError && (
                <div className="p-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{dispatchError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !driverName.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs hover:shadow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <span>Confirm Dispatch</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
