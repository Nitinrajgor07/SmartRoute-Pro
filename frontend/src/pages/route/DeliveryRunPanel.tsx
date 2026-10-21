import React, { useState, useEffect, useMemo } from 'react';
import { Truck, RotateCcw, AlertCircle, Loader2, Search } from 'lucide-react';
import { deliveriesService } from '../../services/api';
import { PriorityBadge } from '../../components/StatusBadge';
import { ZonePicker } from './ZonePicker';
import type { GraphNode, Delivery } from '../../types';

interface DeliveryRunPanelProps {
  nodes: GraphNode[];
  onPlanRun: (depotId: number, deliveryIds: number[], returnToDepot: boolean) => Promise<void>;
  isCalculating: boolean;
  calcError: string | null;
  onReset: () => void;
  startTime: string;
  onStartTimeChange: (time: string) => void;
  refreshTrigger?: number;
}

const priorityRank: Record<string, number> = {
  urgent: 1,
  express: 2,
  standard: 3
};

export const DeliveryRunPanel: React.FC<DeliveryRunPanelProps> = ({
  nodes,
  onPlanRun,
  isCalculating,
  calcError,
  onReset,
  startTime,
  onStartTimeChange,
  refreshTrigger = 0
}) => {
  const [depotId, setDepotId] = useState<number>(nodes[0]?.id || 1);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<number[]>([]);
  const [returnToDepot, setReturnToDepot] = useState<boolean>(true);
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search and Zone filtering state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [zoneHubIds, setZoneHubIds] = useState<number[] | null>(null);

  useEffect(() => {
    if (nodes.length > 0 && !nodes.some((n) => n.id === depotId)) {
      setDepotId(nodes[0].id);
    }
  }, [nodes, depotId]);

  const loadDeliveries = async () => {
    setIsLoadingDeliveries(true);
    setLoadError(null);
    try {
      const res = await deliveriesService.getDeliveries({ per_page: 100 });
      // Only Pending deliveries are eligible for delivery run planning & dispatch
      const pendingList = (res.deliveries || []).filter((d) => d.status === 'Pending');
      setDeliveries(pendingList);
    } catch {
      setLoadError('Failed to load pending deliveries');
    } finally {
      setIsLoadingDeliveries(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [refreshTrigger]);

  // When refreshTrigger changes (e.g. after dispatch), clear ticked selection
  useEffect(() => {
    if (refreshTrigger > 0) {
      setSelectedDeliveryIds([]);
    }
  }, [refreshTrigger]);

  // Handle zone selection change
  const handleSelectZone = (zoneId: string, hubIds: number[] | null) => {
    setSelectedZone(zoneId);
    setZoneHubIds(hubIds);

    if (zoneId === 'all' || !hubIds) {
      return;
    }

    // Filter pending list to deliveries whose destination hub belongs to that zone
    const inZone = deliveries.filter((d) => d.destination_location_id && hubIds.includes(d.destination_location_id));

    // Sort by priority (Urgent, Express, Standard), then oldest first
    const sorted = [...inZone].sort((a, b) => {
      const pA = priorityRank[(a.priority || 'standard').toLowerCase()] ?? 3;
      const pB = priorityRank[(b.priority || 'standard').toLowerCase()] ?? 3;
      if (pA !== pB) return pA - pB;
      const tA = new Date(a.created_at || a.createdAt || 0).getTime();
      const tB = new Date(b.created_at || b.createdAt || 0).getTime();
      if (tA !== tB) return tA - tB;
      return Number(a.id) - Number(b.id);
    });

    // Automatically tick up to 8 of them
    const autoTicked = sorted.slice(0, 8).map((d) => Number(d.id));
    setSelectedDeliveryIds(autoTicked);
  };

  // Deliveries filtered by zone
  const zoneDeliveries = useMemo(() => {
    if (selectedZone === 'all' || !zoneHubIds) {
      return deliveries;
    }
    return deliveries.filter((d) => d.destination_location_id && zoneHubIds.includes(d.destination_location_id));
  }, [deliveries, selectedZone, zoneHubIds]);

  // Client-side search filtered list
  const filteredDeliveries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return zoneDeliveries;

    return zoneDeliveries.filter((del) => {
      const tracking = (del.tracking_number || del.trackingNumber || `DEL-${del.id}`).toLowerCase();
      const customer = (del.customer_name || del.recipientName || '').toLowerCase();
      const destName = (
        del.destination_location?.name ||
        nodes.find((n) => n.id === del.destination_location_id)?.name ||
        `Hub #${del.destination_location_id}`
      ).toLowerCase();

      return tracking.includes(q) || customer.includes(q) || destName.includes(q);
    });
  }, [zoneDeliveries, searchQuery, nodes]);

  // Selected count & unique stops count
  const selectedDeliveries = useMemo(() => {
    return deliveries.filter((d) => selectedDeliveryIds.includes(Number(d.id)));
  }, [deliveries, selectedDeliveryIds]);

  const uniqueStopCount = useMemo(() => {
    return new Set(selectedDeliveries.map((d) => d.destination_location_id)).size;
  }, [selectedDeliveries]);

  const isMaxSelected = selectedDeliveryIds.length >= 8 || uniqueStopCount >= 8;

  const handleToggleDelivery = (id: number) => {
    if (selectedDeliveryIds.includes(id)) {
      setSelectedDeliveryIds(selectedDeliveryIds.filter((item) => item !== id));
    } else {
      if (selectedDeliveryIds.length >= 8) return;
      const target = deliveries.find((d) => Number(d.id) === id);
      const targetDest = target?.destination_location_id;
      const alreadyHasStop = selectedDeliveries.some((d) => d.destination_location_id === targetDest);
      if (!alreadyHasStop && uniqueStopCount >= 8) return;

      setSelectedDeliveryIds([...selectedDeliveryIds, id]);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDeliveryIds.length < 2 || isCalculating) return;
    await onPlanRun(depotId, selectedDeliveryIds, returnToDepot);
  };

  const handleResetForm = () => {
    if (nodes.length > 0) setDepotId(nodes[0].id);
    setSelectedDeliveryIds([]);
    setSearchQuery('');
    setSelectedZone('all');
    setZoneHubIds(null);
    setReturnToDepot(true);
    onReset();
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className="glass-card rounded-2xl p-5 space-y-4"
    >
      {/* Helper Line */}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Tick the parcels for one driver. We find the shortest order.
      </p>

      {/* Depot Select */}
      <div className="space-y-1.5">
        <label
          htmlFor="run-depot-select"
          className="text-xs font-semibold text-slate-700 dark:text-slate-300 block"
        >
          Depot
        </label>
        <select
          id="run-depot-select"
          value={depotId}
          onChange={(e) => setDepotId(Number(e.target.value))}
          disabled={isCalculating || nodes.length === 0}
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
        >
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.name}
            </option>
          ))}
        </select>
      </div>

      {/* Zone Picker */}
      <ZonePicker
        selectedZone={selectedZone}
        onSelectZone={handleSelectZone}
        disabled={isCalculating}
      />

      {/* Deliveries Checklist Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Pending deliveries
          </label>
          {selectedZone !== 'all' && zoneDeliveries.length > 8 && (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Showing 8 of {zoneDeliveries.length} in this zone.
            </span>
          )}
        </div>

        {/* Client-side search box */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracking, customer, or hub..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Deliveries list */}
        {isLoadingDeliveries ? (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
            <span>Loading deliveries...</span>
          </div>
        ) : loadError ? (
          <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs text-red-600 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{loadError}</span>
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
            {searchQuery ? 'No deliveries match your search' : 'No pending deliveries available'}
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
            {filteredDeliveries.map((del) => {
              const numId = Number(del.id);
              const isChecked = selectedDeliveryIds.includes(numId);
              const targetDest = del.destination_location_id;
              const alreadyHasStop = selectedDeliveries.some((d) => d.destination_location_id === targetDest);
              const wouldExceedStopLimit = !alreadyHasStop && uniqueStopCount >= 8;
              const isDisabled = !isChecked && (selectedDeliveryIds.length >= 8 || wouldExceedStopLimit);

              const destName =
                del.destination_location?.name ||
                nodes.find((n) => n.id === del.destination_location_id)?.name ||
                `Hub #${del.destination_location_id}`;
              const tracking = del.tracking_number || del.trackingNumber || `DEL-${del.id}`;
              const customerName = del.customer_name || del.recipientName || 'Customer';

              return (
                <label
                  key={del.id}
                  className={`flex items-center justify-between p-2.5 text-xs transition-colors ${
                    isDisabled
                      ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 mr-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled || isCalculating}
                      onChange={() => handleToggleDelivery(numId)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
                    />
                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono font-bold text-slate-900 dark:text-white truncate">
                          {tracking}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 text-[10px]">·</span>
                        <span className="text-slate-600 dark:text-slate-300 truncate text-[11px]" title={customerName}>
                          {customerName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PriorityBadge priority={del.priority || 'Standard'} />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[110px] truncate" title={destName}>
                      {destName}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* Live count & Max 8 stops warning */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300" data-testid="delivery-run-count">
            {selectedDeliveryIds.length} {selectedDeliveryIds.length === 1 ? 'parcel' : 'parcels'}, {uniqueStopCount} {uniqueStopCount === 1 ? 'stop' : 'stops'}
          </span>
          {isMaxSelected && (
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              Maximum 8 stops
            </span>
          )}
        </div>
      </div>

      {/* Start Time Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="run-start-time"
          className="text-xs font-semibold text-slate-700 dark:text-slate-300 block"
        >
          Start time
        </label>
        <input
          id="run-start-time"
          type="time"
          value={startTime}
          onChange={(e) => onStartTimeChange(e.target.value || '09:00')}
          disabled={isCalculating}
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
          data-testid="run-start-time-input"
        />
      </div>

      {/* Return to Depot Toggle */}
      <div className="flex items-center justify-between pt-1">
        <label
          htmlFor="return-to-depot"
          className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
        >
          Return to depot
        </label>
        <input
          id="return-to-depot"
          type="checkbox"
          checked={returnToDepot}
          onChange={(e) => setReturnToDepot(e.target.checked)}
          disabled={isCalculating}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
        />
      </div>

      {/* Error message */}
      {calcError && (
        <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{calcError}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={handleResetForm}
          disabled={isCalculating}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-semibold shadow-xs transition-colors flex items-center justify-center cursor-pointer"
          title="Reset"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <button
          type="submit"
          disabled={selectedDeliveryIds.length < 2 || isCalculating}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isCalculating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Planning...</span>
            </>
          ) : (
            <>
              <Truck className="h-3.5 w-3.5" />
              <span>Plan run</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
