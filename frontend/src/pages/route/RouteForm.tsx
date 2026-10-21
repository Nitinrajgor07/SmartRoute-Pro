import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Compass, ArrowLeftRight, Search, ChevronDown, RefreshCw, AlertTriangle } from 'lucide-react';
import type { GraphNode } from '../../types';

interface HubComboboxProps {
  label: string;
  nodes: GraphNode[];
  selectedId: number;
  excludeId?: number;
  onSelect: (id: number) => void;
  disabled?: boolean;
  triggerTestId?: string;
  searchInputTestId?: string;
}

export const HubCombobox: React.FC<HubComboboxProps> = ({
  label,
  nodes,
  selectedId,
  excludeId,
  onSelect,
  disabled = false,
  triggerTestId,
  searchInputTestId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) || null,
    [nodes, selectedId]
  );

  // Filter out excluded ID to prevent selecting the same hub in both dropdowns
  const availableNodes = useMemo(() => {
    return nodes.filter((n) => n.id !== excludeId);
  }, [nodes, excludeId]);

  const filteredNodes = useMemo(() => {
    if (!query.trim()) return availableNodes;
    const q = query.toLowerCase().trim();
    return availableNodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.address && n.address.toLowerCase().includes(q))
    );
  }, [availableNodes, query]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (id: number) => {
    onSelect(id);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
        {label}
      </label>

      <button
        type="button"
        data-testid={triggerTestId}
        onClick={handleOpen}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
          disabled
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
            : isOpen
            ? 'border-indigo-500 bg-white dark:bg-slate-800 ring-2 ring-indigo-500/20 text-slate-900 dark:text-white'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="min-w-0 flex-1">
          {selectedNode ? (
            <div>
              <div className="font-semibold text-slate-900 dark:text-white truncate">
                {selectedNode.name}
              </div>
              {selectedNode.address && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {selectedNode.address}
                </div>
              )}
            </div>
          ) : (
            <span className="text-slate-400">Select hub</span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/70 dark:bg-slate-900/50">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              data-testid={searchInputTestId}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hub"
              className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/40">
            {filteredNodes.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">No hubs found</div>
            ) : (
              filteredNodes.map((node) => (
                <button
                  key={node.id}
                  data-testid={`hub-option-${node.id}`}
                  type="button"
                  onClick={() => handleSelect(node.id)}
                  className={`w-full p-2.5 text-left text-xs transition-colors cursor-pointer ${
                    node.id === selectedId
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                    {node.name}
                  </div>
                  {node.address && (
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {node.address}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface RouteFormProps {
  nodes: GraphNode[];
  sourceId: number;
  destinationId: number;
  onSourceChange: (id: number) => void;
  onDestinationChange: (id: number) => void;
  onSwap: () => void;
  onFindRoute: () => void;
  onReset: () => void;
  isCalculating: boolean;
  isLoadingGraph: boolean;
  canDispatch: boolean;
  calcError: string | null;
}

export const RouteForm: React.FC<RouteFormProps> = ({
  nodes,
  sourceId,
  destinationId,
  onSourceChange,
  onDestinationChange,
  onSwap,
  onFindRoute,
  onReset,
  isCalculating,
  isLoadingGraph,
  canDispatch,
  calcError
}) => {
  const isSameHub = sourceId === destinationId && nodes.length > 0;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Compass className="h-4 w-4 text-indigo-600" />
          Plan a route
        </h2>
      </div>

      <div className="space-y-3">
        <HubCombobox
          label="From"
          nodes={nodes}
          selectedId={sourceId}
          excludeId={destinationId}
          onSelect={onSourceChange}
          disabled={isLoadingGraph || isCalculating}
          triggerTestId="origin-hub-select"
          searchInputTestId="origin-hub-search"
        />

        <div className="flex justify-center -my-1">
          <button
            type="button"
            onClick={onSwap}
            disabled={isLoadingGraph || isCalculating}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-400 transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <ArrowLeftRight className="h-3 w-3 text-indigo-600" />
            <span>Swap</span>
          </button>
        </div>

        <HubCombobox
          label="To"
          nodes={nodes}
          selectedId={destinationId}
          excludeId={sourceId}
          onSelect={onDestinationChange}
          disabled={isLoadingGraph || isCalculating}
          triggerTestId="destination-hub-select"
          searchInputTestId="destination-hub-search"
        />

        {isSameHub && (
          <div className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>Choose different hubs</span>
          </div>
        )}

        {calcError && (
          <div className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
            <span>{calcError}</span>
          </div>
        )}

        {canDispatch && (
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onFindRoute}
              disabled={isLoadingGraph || isCalculating || isSameHub}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
            >
              {isCalculating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Calculating</span>
                </>
              ) : (
                <span>Find route</span>
              )}
            </button>

            <button
              type="button"
              onClick={onReset}
              disabled={isCalculating}
              className="px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
