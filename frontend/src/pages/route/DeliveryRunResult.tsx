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
  ChevronDown
} from 'lucide-react';
import type { DeliveryRunResponse } from '../../types';

interface DeliveryRunResultProps {
  runResult: DeliveryRunResponse | null;
}

// Simple, clearly-labelled estimate inputs for the fuel card.
const VAN_KM_PER_LITRE = 12; // typical small diesel delivery van
const DIESEL_PRICE_PER_LITRE = 90; // approx. Bengaluru diesel price (₹)
const FALLBACK_CITY_SPEED_KMH = 22; // used only if the server sends no drive time

const formatMinutes = (mins: number): string => {
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

const addMinutesToClock = (clock: string, mins: number): string => {
  const [hh, mm] = clock.split(':').map((v) => parseInt(v, 10));
  const base = (Number.isFinite(hh) ? hh : 9) * 60 + (Number.isFinite(mm) ? mm : 0);
  const t = Math.round(base + mins) % (24 * 60);
  const h24 = Math.floor(t / 60);
  const m = t % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
};

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

export const DeliveryRunResult: React.FC<DeliveryRunResultProps> = ({ runResult }) => {
  const [startTime, setStartTime] = useState<string>('09:00');
  const [minutesPerStop, setMinutesPerStop] = useState<number>(10);
  const [showExplain, setShowExplain] = useState<boolean>(true);

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
      leaveAt: number;
    }[] = [];

    rows.push({ name: runResult.legs[0].from_name, kind: 'start', arriveAt: 0, leaveAt: 0 });
    let clock = 0;
    runResult.legs.forEach((leg, i) => {
      const legMin = leg.duration_min ?? (leg.distance_km / FALLBACK_CITY_SPEED_KMH) * 60;
      clock += legMin;
      const isReturn = runResult.return_to_depot && i === runResult.legs.length - 1;
      const arrive = clock;
      if (!isReturn) clock += minutesPerStop;
      rows.push({
        name: leg.to_name,
        kind: isReturn ? 'end' : 'stop',
        stopNumber: isReturn ? undefined : i + 1,
        legKm: leg.distance_km,
        legMin,
        via: leg.via_names ?? [],
        arriveAt: arrive,
        leaveAt: clock
      });
    });
    return rows;
  }, [runResult, minutesPerStop]);

  if (!runResult) {
    return (
      <div className="glass-card rounded-2xl p-6 text-center space-y-1.5">
        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 inline-flex">
          <Route className="h-5 w-5" />
        </div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">No run planned yet</h3>
        <p className="text-[11px] text-slate-400">Pick a depot, tick 2 to 8 deliveries, then press Optimize</p>
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

      {/* Driver schedule */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Visit order and driver schedule</div>
          <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
            <label className="flex items-center gap-1">
              Start
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value || '09:00')}
                className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                data-testid="run-start-time"
              />
            </label>
            <label className="flex items-center gap-1">
              Unload
              <input
                type="number"
                min={0}
                max={60}
                value={minutesPerStop}
                onChange={(e) => setMinutesPerStop(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
                className="w-12 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                data-testid="run-unload-minutes"
              />
              min/stop
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
                      {row.kind === 'start'
                        ? `Leave ${addMinutesToClock(startTime, 0)}`
                        : `Arrive ${addMinutesToClock(startTime, row.arriveAt)}`}
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
          Whole trip including unloading: <span className="font-bold">{formatMinutes(totalTripMinutes)}</span>
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

    </div>
  );
};
