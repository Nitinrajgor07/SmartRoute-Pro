import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Route, RefreshCw, AlertCircle } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { routesService } from '../../services/api';
import { useAuth } from '../../app/AuthContext';
import { RouteForm } from './RouteForm';
import { RouteResult } from './RouteResult';
import { DeliveryRunPanel } from './DeliveryRunPanel';
import { DeliveryRunResult } from './DeliveryRunResult';
import { RouteMap } from './RouteMap';
import { SearchSteps } from './SearchSteps';
import { RouteHistory } from './RouteHistory';
import type {
  GraphNode,
  GraphEdge,
  ShortestPathResponse,
  DeliveryRunResponse,
  RouteHistoryItem
} from '../../types';

export const RoutePlanner: React.FC = () => {
  const { can, isAdmin, isDispatcher } = useAuth();
  const canDispatch = can('routes:calculate');
  const [searchParams] = useSearchParams();

  // Graph topology state
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(true);
  const [graphError, setGraphError] = useState<string | null>(null);

  // Form selection state
  const [sourceId, setSourceId] = useState<number>(1);
  const [destinationId, setDestinationId] = useState<number>(6);

  // Calculation & results state
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<ShortestPathResponse | null>(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState<number>(0);
  const [calculatedAt, setCalculatedAt] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<RouteHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [totalSavedRoutes, setTotalSavedRoutes] = useState<number>(0);

  // Mode: Single route vs Delivery run
  const [planMode, setPlanMode] = useState<'single' | 'run'>('single');

  // Delivery run state
  const [deliveryRunResult, setDeliveryRunResult] = useState<DeliveryRunResponse | null>(null);
  const [isPlanningRun, setIsPlanningRun] = useState<boolean>(false);
  const [runCalcError, setRunCalcError] = useState<string | null>(null);
  const [runDepotId, setRunDepotId] = useState<number>(1);

  // Duplicate calculation throttle (60s)
  const lastCalcRef = useRef<{ sourceId: number; destinationId: number; time: number } | null>(null);

  // Load Graph Topology
  const loadGraphData = async () => {
    setIsLoadingGraph(true);
    setGraphError(null);
    try {
      const data = await routesService.getGraph();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      if (data.nodes && data.nodes.length >= 2) {
        const querySource = Number(searchParams.get('source'));
        const queryDest = Number(searchParams.get('destination'));
        if (querySource && data.nodes.some((n) => n.id === querySource)) {
          setSourceId(querySource);
        } else {
          setSourceId(data.nodes[0].id);
        }
        if (queryDest && data.nodes.some((n) => n.id === queryDest)) {
          setDestinationId(queryDest);
        } else {
          setDestinationId(data.nodes[data.nodes.length - 1].id);
        }
      }
    } catch {
      setGraphError('Network load failed');
    } finally {
      setIsLoadingGraph(false);
    }
  };

  // Load Route History
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await routesService.getHistory({ per_page: 15 });
      setHistory(data.routes || []);
      setTotalSavedRoutes(data.total || data.routes?.length || 0);
    } catch {
      // Quiet fail for history
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadGraphData();
    loadHistory();
  }, []);

  // Swap Origin and Destination
  const handleSwap = () => {
    setSourceId(destinationId);
    setDestinationId(sourceId);
  };

  // Reset to default
  const handleReset = () => {
    if (nodes.length >= 2) {
      setSourceId(nodes[0].id);
      setDestinationId(nodes[nodes.length - 1].id);
    }
    setRouteResult(null);
    setCalcError(null);
    setActiveRouteIndex(0);
  };

  // Calculate Shortest Path
  const handleFindRoute = async () => {
    if (sourceId === destinationId) return;
    setIsCalculating(true);
    setCalcError(null);

    try {
      const includeSteps = isAdmin || isDispatcher;
      const res = await routesService.calculateShortestPath({
        source_location_id: sourceId,
        destination_location_id: destinationId,
        include_steps: includeSteps
      });

      setRouteResult(res);
      setActiveRouteIndex(0);
      setCalculatedAt(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );

      // Track duplicate within 60s
      lastCalcRef.current = { sourceId, destinationId, time: Date.now() };

      // Refresh history
      loadHistory();
    } catch (err: any) {
      setCalcError(err?.response?.data?.message || 'Route calculation failed');
    } finally {
      setIsCalculating(false);
    }
  };

  // Plan Delivery Run
  const handlePlanDeliveryRun = async (
    depotId: number,
    deliveryIds: number[],
    returnToDepot: boolean
  ) => {
    setIsPlanningRun(true);
    setRunCalcError(null);
    setRunDepotId(depotId);

    try {
      const res = await routesService.planDeliveryRun({
        depot_location_id: depotId,
        delivery_ids: deliveryIds,
        return_to_depot: returnToDepot
      });
      setDeliveryRunResult(res);
      loadHistory();
    } catch (err: any) {
      setRunCalcError(err?.response?.data?.message || 'Delivery run planning failed');
    } finally {
      setIsPlanningRun(false);
    }
  };

  const handleResetRun = () => {
    setDeliveryRunResult(null);
    setRunCalcError(null);
  };

  // Load Route from History
  const handleLoadHistoryRoute = (item: RouteHistoryItem) => {
    setSourceId(item.source_location_id);
    setDestinationId(item.destination_location_id);
    setRouteResult({
      source_location_id: item.source_location_id,
      destination_location_id: item.destination_location_id,
      algorithm: item.algorithm,
      has_route: true,
      total_distance_km: item.total_distance_km,
      path: item.path || [item.source_location_id, item.destination_location_id],
      path_nodes: (item.path || []).map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as GraphNode[],
      path_edges: [],
      execution_time_ms: item.execution_time_ms || 1,
      visited_nodes_count: item.path?.length || 2,
      total_nodes_in_graph: nodes.length
    });
    setActiveRouteIndex(0);
    setCalculatedAt('From history');
  };

  // Determine which path node IDs to draw on map
  const activePathNodeIds = React.useMemo(() => {
    if (!routeResult || !routeResult.has_route) return [];
    if (activeRouteIndex === 0) return routeResult.path || [];
    const alt = routeResult.routes?.find((r) => r.route_index === activeRouteIndex);
    return alt?.path || routeResult.path || [];
  }, [routeResult, activeRouteIndex]);

  return (
    <div className="space-y-6">
      {/* Header: Title, Subtitle, Reload Button Only */}
      <PageHeader
        title="Route Planner"
        subtitle="Find the shortest route between two hubs."
        icon={Route}
        actions={
          <button
            type="button"
            onClick={() => {
              loadGraphData();
              loadHistory();
            }}
            disabled={isLoadingGraph}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingGraph ? 'animate-spin text-brand-600' : ''}`} />
            <span>Reload</span>
          </button>
        }
      />

      {graphError && (
        <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{graphError}</span>
        </div>
      )}

      {/* Main Two-Column Layout (1/3 Form & Result, 2/3 Map) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (1/3): Plan a Route & Result Card */}
        <div className="lg:col-span-4 space-y-5">
          {/* Segmented Control: Single route | Delivery run */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setPlanMode('single')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                planMode === 'single'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Single route
            </button>
            <button
              type="button"
              onClick={() => setPlanMode('run')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                planMode === 'run'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Delivery run
            </button>
          </div>

          {planMode === 'single' ? (
            <>
              <RouteForm
                nodes={nodes}
                sourceId={sourceId}
                destinationId={destinationId}
                onSourceChange={setSourceId}
                onDestinationChange={setDestinationId}
                onSwap={handleSwap}
                onFindRoute={handleFindRoute}
                onReset={handleReset}
                isCalculating={isCalculating}
                isLoadingGraph={isLoadingGraph}
                canDispatch={canDispatch}
                calcError={calcError}
              />

              <RouteResult
                routeResult={routeResult}
                activeRouteIndex={activeRouteIndex}
                onSelectRouteIndex={setActiveRouteIndex}
                calculatedAt={calculatedAt}
              />
            </>
          ) : (
            <>
              <DeliveryRunPanel
                nodes={nodes}
                onPlanRun={handlePlanDeliveryRun}
                isCalculating={isPlanningRun}
                calcError={runCalcError}
                onReset={handleResetRun}
              />

              <DeliveryRunResult runResult={deliveryRunResult} />
            </>
          )}
        </div>

        {/* Right Column (2/3): Route Map */}
        <div className="lg:col-span-8">
          <RouteMap
            nodes={nodes}
            edges={edges}
            selectedPathNodeIds={planMode === 'single' ? activePathNodeIds : (deliveryRunResult?.expanded_node_path || [])}
            sourceId={planMode === 'single' ? sourceId : (deliveryRunResult?.depot_id ?? runDepotId)}
            destinationId={planMode === 'single' ? destinationId : 0}
            isDeliveryRun={planMode === 'run'}
            runStopOrder={deliveryRunResult?.recommended_order ? deliveryRunResult.recommended_order.slice(1) : []}
          />
        </div>
      </div>

      {/* Step-by-Step Search (Collapsed, Admin & Dispatcher only) */}
      {planMode === 'single' && canDispatch && routeResult?.trace && (
        <SearchSteps trace={routeResult.trace} nodes={nodes} />
      )}

      {/* Recent Routes Table */}
      <RouteHistory
        history={history}
        isLoading={isLoadingHistory}
        totalSavedRoutes={totalSavedRoutes}
        onLoadRoute={handleLoadHistoryRoute}
      />
    </div>
  );
};

export default RoutePlanner;
