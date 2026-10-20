import React, { useState, useEffect } from 'react';
import { Truck, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { deliveriesService } from '../../services/api';
import type { GraphNode, Delivery } from '../../types';

interface DeliveryRunPanelProps {
  nodes: GraphNode[];
  onPlanRun: (depotId: number, deliveryIds: number[], returnToDepot: boolean) => Promise<void>;
  isCalculating: boolean;
  calcError: string | null;
  onReset: () => void;
}

export const DeliveryRunPanel: React.FC<DeliveryRunPanelProps> = ({
  nodes,
  onPlanRun,
  isCalculating,
  calcError,
  onReset
}) => {
  const [depotId, setDepotId] = useState<number>(nodes[0]?.id || 1);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<number[]>([]);
  const [returnToDepot, setReturnToDepot] = useState<boolean>(true);
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      const pendingList = (res.deliveries || []).filter((d) => d.status !== 'Delivered');
      setDeliveries(pendingList);
    } catch {
      setLoadError('Failed to load pending deliveries');
    } finally {
      setIsLoadingDeliveries(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, []);

  const handleToggleDelivery = (id: number) => {
    if (selectedDeliveryIds.includes(id)) {
      setSelectedDeliveryIds(selectedDeliveryIds.filter((item) => item !== id));
    } else {
      if (selectedDeliveryIds.length < 8) {
        setSelectedDeliveryIds([...selectedDeliveryIds, id]);
      }
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
    setReturnToDepot(true);
    onReset();
  };

  const isMaxSelected = selectedDeliveryIds.length >= 8;

  return (
    <form
      onSubmit={handleFormSubmit}
      className="glass-card rounded-2xl p-5 space-y-4"
    >
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

      {/* Deliveries Checklist */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Pending deliveries ({selectedDeliveryIds.length}/8)
          </label>
          {isMaxSelected && (
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Maximum 8 stops
            </span>
          )}
        </div>

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
        ) : deliveries.length === 0 ? (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
            No pending deliveries available
          </div>
        ) : (
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
            {deliveries.map((del) => {
              const numId = Number(del.id);
              const isChecked = selectedDeliveryIds.includes(numId);
              const isDisabled = !isChecked && isMaxSelected;
              const destName =
                del.destination_location?.name ||
                nodes.find((n) => n.id === del.destination_location_id)?.name ||
                `Hub #${del.destination_location_id}`;
              const tracking = del.tracking_number || del.trackingNumber || `DEL-${del.id}`;

              return (
                <label
                  key={del.id}
                  className={`flex items-center justify-between p-2.5 text-xs transition-colors ${
                    isDisabled
                      ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate mr-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled || isCalculating}
                      onChange={() => handleToggleDelivery(numId)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className="font-mono font-medium text-slate-900 dark:text-white truncate">
                      {tracking}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {destName}
                  </span>
                </label>
              );
            })}
          </div>
        )}
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
