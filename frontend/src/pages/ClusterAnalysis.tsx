import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Network,
  Layers,
  Activity,
  TrendingDown,
  History,
  RefreshCw,
  Play,
  AlertTriangle,
  Sparkles,
  MapPin,
  Map,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Filter,
  Sliders,
  Database,
  Trash2,
  ArrowUpRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import L from 'leaflet';
import { PageHeader } from '../components/PageHeader';
import { sdaService } from '../services/api';
import { useAuth } from '../app/AuthContext';
import type {
  SDADatasetSummary,
  KMeansResponse,
  ElbowResponse,
  ClusterHistoryItem
} from '../types';

export const ClusterAnalysis: React.FC = () => {
  const { can, isAdmin } = useAuth();
  const canDispatch = can('zones:run');

  // Dataset Overview State
  const [summary, setSummary] = useState<SDADatasetSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // K-Means Configuration State
  const [kValue, setKValue] = useState<number>(3);
  const [maxIterations, setMaxIterations] = useState<number>(300);
  const [randomSeed, setRandomSeed] = useState<number>(42);
  const [isClustering, setIsClustering] = useState<boolean>(false);
  const [clusterError, setClusterError] = useState<string | null>(null);

  // Active Cluster Result
  const [clusterResult, setClusterResult] = useState<KMeansResponse | null>(null);

  // Elbow Analysis State
  const [elbowResult, setElbowResult] = useState<ElbowResponse | null>(null);
  const [isRunningElbow, setIsRunningElbow] = useState<boolean>(false);
  const [elbowError, setElbowError] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<ClusterHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [isClearingHistory, setIsClearingHistory] = useState<boolean>(false);
  const [loadingRunId, setLoadingRunId] = useState<number | null>(null);

  // View Mode: 'scatter' vs 'map'
  const [viewMode, setViewMode] = useState<'scatter' | 'map'>('scatter');

  // Interactive Cluster Highlight State
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);

  // Leaflet Map Refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const pointsLayerRef = useRef<L.LayerGroup | null>(null);
  const centroidsLayerRef = useRef<L.LayerGroup | null>(null);
  const circlesLayerRef = useRef<L.LayerGroup | null>(null);

  // Distinct Color Palette for Clusters
  const clusterColors = [
    '#2563eb', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#ea580c'  // Orange
  ];

  // Fetch dataset summary from database
  const fetchSummary = async () => {
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      const data = await sdaService.getDatasetSummary();
      setSummary(data);
      if (data.valid_coordinates >= 2 && kValue > data.valid_coordinates) {
        setKValue(Math.min(3, data.valid_coordinates));
      }
    } catch (err: any) {
      console.error('Failed to load dataset summary', err);
      setSummaryError('Failed to fetch dataset summary from backend database.');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  // Fetch cluster history runs
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await sdaService.getClusterHistory({ per_page: 5 });
      setHistory(data.cluster_runs || []);
    } catch (err) {
      console.error('Failed to load cluster history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Clear all cluster history runs (Admin only)
  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all cluster run history?')) return;
    setIsClearingHistory(true);
    try {
      await sdaService.clearClusterHistory();
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear cluster history', err);
    } finally {
      setIsClearingHistory(false);
    }
  };

  // Run K-Means Clustering
  const handleRunKMeans = async () => {
    setIsClustering(true);
    setClusterError(null);
    try {
      const res = await sdaService.runKMeans({
        k: Number(kValue),
        max_iterations: Number(maxIterations),
        random_state: Number(randomSeed)
      });
      setClusterResult(res);
      fetchHistory(); // Refresh history audit trail
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Clustering execution failed.';
      setClusterError(msg);
    } finally {
      setIsClustering(false);
    }
  };

  // Run Elbow Method Diagnostics
  const handleRunElbow = async () => {
    setIsRunningElbow(true);
    setElbowError(null);
    try {
      const maxK = Math.min(6, summary?.valid_coordinates || 6);
      const res = await sdaService.runElbow({
        max_k: maxK,
        random_state: Number(randomSeed)
      });
      setElbowResult(res);
    } catch (err: any) {
      console.error('Zone spread analysis failed', err);
      setElbowError(err.response?.data?.message || 'Zone spread analysis failed.');
    } finally {
      setIsRunningElbow(false);
    }
  };

  // Load a historical cluster run into chart and controls
  const handleLoadHistory = async (runId: number) => {
    setLoadingRunId(runId);
    try {
      const detail = await sdaService.getClusterDetail(runId);
      const run = detail.cluster_run;
      setKValue(run.k);
      setMaxIterations(run.max_iterations);
      setRandomSeed(run.random_state);
      setClusterResult({
        k: run.k,
        max_iterations: run.max_iterations,
        random_state: run.random_state,
        total_locations: run.total_locations,
        inertia: run.inertia,
        silhouette_score: run.silhouette_score,
        iterations_run: run.iterations_run,
        execution_time_ms: run.execution_time_ms,
        centroids: run.centroids,
        assignments: run.assignments,
        projection: 'Ground-Kilometer Projection',
        cluster_run_id: run.id
      });
      setSelectedClusterId(null);
      // Smooth scroll back to visualization
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to load historical run', err);
    } finally {
      setLoadingRunId(null);
    }
  };

  // Initial load
  useEffect(() => {
    fetchSummary();
    fetchHistory();
    if (canDispatch) {
      handleRunKMeans();
      handleRunElbow();
    } else {
      // For Viewer: load latest saved result from history
      sdaService.getClusterHistory({ per_page: 1 }).then((data) => {
        if (data.cluster_runs && data.cluster_runs.length > 0) {
          handleLoadHistory(data.cluster_runs[0].id);
        }
      }).catch((e) => console.error('Failed to load latest cluster run', e));
    }
  }, [canDispatch]);

  // Format scatter points for Recharts
  const scatterData = useMemo(() => {
    return (clusterResult?.assignments || []).map((item) => ({
      x: item.longitude,
      y: item.latitude,
      name: item.location_name,
      address: item.address,
      clusterId: item.cluster_id,
      distToCentroid: item.distance_to_centroid_km,
      color: clusterColors[item.cluster_id % clusterColors.length]
    }));
  }, [clusterResult]);

  const centroidScatterData = useMemo(() => {
    return (clusterResult?.centroids || []).map((c) => ({
      x: c.longitude,
      y: c.latitude,
      name: `Centroid #${c.cluster_id}`,
      clusterId: c.cluster_id,
      size: c.size,
      radius: c.radius_km,
      avgDist: c.avg_distance_km,
      isCentroid: true
    }));
  }, [clusterResult]);

  // Leaflet Map Initialization & Reactive Rendering
  useEffect(() => {
    if (viewMode !== 'map' || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialMap = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: true
      }).setView([12.9716, 77.5946], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(initialMap);

      L.control.zoom({ position: 'topright' }).addTo(initialMap);

      circlesLayerRef.current = L.layerGroup().addTo(initialMap);
      centroidsLayerRef.current = L.layerGroup().addTo(initialMap);
      pointsLayerRef.current = L.layerGroup().addTo(initialMap);

      mapInstanceRef.current = initialMap;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // Invalidate size to ensure proper tile rendering after tab switch
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 120);

    // Clear prior layers
    circlesLayerRef.current?.clearLayers();
    centroidsLayerRef.current?.clearLayers();
    pointsLayerRef.current?.clearLayers();

    if (!clusterResult) return () => clearTimeout(resizeTimer);

    const { centroids, assignments } = clusterResult;

    // 1. Draw radius buffers and Centroid markers
    centroids.forEach((c) => {
      const isSelected = selectedClusterId === c.cluster_id;
      const isDimmed = selectedClusterId !== null && !isSelected;
      const color = clusterColors[c.cluster_id % clusterColors.length];

      // Circular coverage area
      if (circlesLayerRef.current && c.radius_km > 0) {
        const circle = L.circle([c.latitude, c.longitude], {
          radius: c.radius_km * 1000,
          color: color,
          weight: isSelected ? 2 : 1,
          dashArray: '4, 4',
          fillColor: color,
          fillOpacity: isDimmed ? 0.02 : isSelected ? 0.12 : 0.05
        });
        circle.addTo(circlesLayerRef.current);
      }

      // Centroid icon
      if (centroidsLayerRef.current) {
        const icon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `
            <div style="${isDimmed ? 'opacity: 0.3;' : 'opacity: 1;'} transition: all 0.2s;" class="relative flex items-center justify-center cursor-pointer" title="Centroid #${c.cluster_id}">
              <div style="background-color: ${color}40;" class="absolute -inset-2 rounded-xl animate-pulse"></div>
              <div style="background-color: #0f172a; border: 2.5px solid ${color};" class="relative h-8 w-8 rounded-lg flex items-center justify-center shadow-xl text-white font-black text-xs">
                <span style="color: ${color};">✕</span>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([c.latitude, c.longitude], { icon });
        marker.bindPopup(`glass-card
 <div class="p-3 text-slate-800 dark:text-slate-100 rounded-xl min-w-[210px]">
 <div class="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-2">
 <span class="font-bold text-xs" style="color: ${color}">Centroid #${c.cluster_id}</span>
 <span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">${c.size} Hubs</span>
 </div>
 <div class="text-[11px] space-y-1 font-mono">
 <div><span class="text-slate-400">Lat/Lon:</span> ${c.latitude.toFixed(4)}°N, ${Math.abs(c.longitude).toFixed(4)}°W</div>
 <div><span class="text-slate-400">Max Radius:</span> <strong>${c.radius_km} km</strong></div>
 <div><span class="text-slate-400">Avg Distance:</span> ${c.avg_distance_km} km</div>
 </div>
 </div>
 `);
        marker.addTo(centroidsLayerRef.current);
      }
    });

    // 2. Draw delivery location markers
    if (pointsLayerRef.current) {
      assignments.forEach((loc) => {
        const isSelected = selectedClusterId === loc.cluster_id;
        const isDimmed = selectedClusterId !== null && !isSelected;
        const color = clusterColors[loc.cluster_id % clusterColors.length];

        const icon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `
            <div style="${isDimmed ? 'opacity: 0.25;' : 'opacity: 1;'} transition: all 0.2s;" class="flex items-center justify-center cursor-pointer">
              <div style="background-color: ${color}; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.25);" class="h-6 w-6 rounded-full flex items-center justify-center text-white font-bold text-[10px]">
                ${loc.cluster_id}
              </div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([loc.latitude, loc.longitude], { icon });
        marker.bindPopup(`glass-card
 <div class="p-3 text-slate-800 dark:text-slate-100 rounded-xl min-w-[220px]">
 <div class="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-2">
 <span class="font-bold text-xs text-slate-900 dark:text-white">${loc.location_name}</span>
 <span class="text-[10px] px-2 py-0.5 rounded text-white font-semibold" style="background-color: ${color}">Cluster #${loc.cluster_id}</span>
 </div>
 <div class="text-[11px] space-y-1">
 <div class="text-slate-500">${loc.address}</div>
 <div class="font-mono text-[10px] text-slate-400">(${loc.latitude.toFixed(4)}°N, ${Math.abs(loc.longitude).toFixed(4)}°W)</div>
 <div class="pt-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
 Distance to Center: <span class="font-mono" style="color: ${color}">${loc.distance_to_centroid_km} km</span>
 </div>
 </div>
 </div>
 `);
        marker.addTo(pointsLayerRef.current!);
      });
    }

    // 3. Fit Bounds
    const allCoords = assignments.map((a) => [a.latitude, a.longitude] as [number, number]);
    if (allCoords.length > 0) {
      map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40], maxZoom: 14 });
    }

    return () => clearTimeout(resizeTimer);
  }, [viewMode, clusterResult, selectedClusterId]);

  // Cleanup Leaflet Map on Unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Silhouette Quality Analysis Helper
  const silhouetteInfo = useMemo(() => {
    const score = clusterResult?.silhouette_score;
    if (score === null || score === undefined) {
      return {
        scoreDisplay: 'N/A',
        label: 'Undefined',
        badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        description: 'Zone quality requires at least 2 zones and fewer than total locations.',
        gaugePercent: 50,
        color: '#94a3b8'
      };
    }
    const gaugePercent = Math.max(0, Math.min(100, Math.round(((score + 1) / 2) * 100)));
    if (score > 0.70) {
      return {
        scoreDisplay: score.toFixed(4),
        label: 'Strong',
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        description: 'Clear, well-separated zone boundaries with compact delivery areas.',
        gaugePercent,
        color: '#10b981'
      };
    }
    if (score > 0.50) {
      return {
        scoreDisplay: score.toFixed(4),
        label: 'Reasonable',
        badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        description: 'Definite geographic partition structure with acceptable separation between zones.',
        gaugePercent,
        color: '#3b82f6'
      };
    }
    if (score > 0.25) {
      return {
        scoreDisplay: score.toFixed(4),
        label: 'Weak',
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        description: 'Noticeable spatial boundary overlap between neighboring zones.',
        gaugePercent,
        color: '#f59e0b'
      };
    }
    return {
      scoreDisplay: score.toFixed(4),
      label: 'Very weak',
      badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      description: 'Weak separation between delivery zones.',
      gaugePercent,
      color: '#f43f5e'
    };
  }, [clusterResult]);

  const maxAllowedK = Math.max(summary?.valid_coordinates || 7, 2);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* 1. PROFESSIONAL PAGE HEADER                                        */}
      {/* ------------------------------------------------------------------ */}
      <PageHeader
        title="Delivery Zones"
        subtitle="Group delivery locations into zones"
        icon={Network}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                fetchSummary();
                fetchHistory();
              }}
              disabled={isLoadingSummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-blue-600 ${isLoadingSummary ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>

            <button
              onClick={() => {
                document.getElementById('cluster-history')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm transition-colors cursor-pointer"
            >
              <History className="h-3.5 w-3.5 text-slate-500" />
              <span>View History</span>
            </button>

            {canDispatch ? (
              <button
                onClick={handleRunKMeans}
                disabled={isClustering || isLoadingSummary}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                {isClustering ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Creating Zones...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-white" />
                    <span>Create Zones</span>
                  </>
                )}
              </button>
            ) : null}

            {summary && (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-600 dark:text-slate-400">
                <Database className="h-3 w-3 text-blue-600" />
                <span>N = {summary.valid_coordinates} Locations</span>
              </div>
            )}
          </div>
        }
      />

      {summaryError && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{summaryError}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. MAIN 2-COLUMN WORKSPACE: CONTROLS & VISUALIZATION               */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control Panel (~28-30% width / 4 Cols on lg) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-blue-600" />
                Zone Parameters
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure spatial partition parameters for delivery zones
              </p>
            </div>

            {/* Dataset Overview Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                <span>Active Dataset</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">Geographic Hubs</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {summary?.valid_coordinates ?? 0} Locations
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Active Packages</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {summary?.total_deliveries ?? 0} Orders
                  </span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-750">
                  <span className="text-slate-400 block text-[10px]">Bounding Coordinates</span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate block">
                    {summary?.bounding_box
                      ? `Lat: ${summary.bounding_box.min_latitude.toFixed(2)}°N to ${summary.bounding_box.max_latitude.toFixed(2)}°N, Lng: ${Math.abs(summary.bounding_box.max_longitude).toFixed(2)}°W to ${Math.abs(summary.bounding_box.min_longitude).toFixed(2)}°W`
                      : 'Local Planar Bounds'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Number of Zones Slider & Direct Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="k-slider" className="font-semibold text-slate-700 dark:text-slate-300">
                    Number of zones
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">Target:</span>
                    <input
                      type="number"
                      min={1}
                      max={maxAllowedK}
                      value={kValue}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setKValue(Math.max(1, Math.min(val, maxAllowedK)));
                        }
                      }}
                      disabled={isClustering}
                      className="w-14 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center font-mono font-bold text-blue-600 dark:text-blue-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <input
                  id="k-slider"
                  type="range"
                  min={1}
                  max={maxAllowedK}
                  value={kValue}
                  onChange={(e) => setKValue(Number(e.target.value))}
                  disabled={isClustering}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Min: 1</span>
                  <span>Bounded to sample size (N = {summary?.valid_coordinates || 7})</span>
                  <span>Max: {maxAllowedK}</span>
                </div>
              </div>

              {/* Advanced Settings Disclosure */}
              <details className="group pt-2 border-t border-slate-100 dark:border-slate-800">
                <summary className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer list-none flex items-center justify-between">
                  <span>Advanced settings</span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90 text-slate-400" />
                </summary>
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Maximum Iterations
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      step={10}
                      value={maxIterations}
                      onChange={(e) => setMaxIterations(Number(e.target.value))}
                      disabled={isClustering}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Random State (Deterministic Seed)
                    </label>
                    <input
                      type="number"
                      value={randomSeed}
                      onChange={(e) => setRandomSeed(Number(e.target.value))}
                      disabled={isClustering}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-medium"
                    />
                  </div>
                </div>
              </details>

              {clusterError && (
                <div className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                  <span>{clusterError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 space-y-2">
                {canDispatch && (
                  <>
                    <button
                      type="button"
                      onClick={handleRunKMeans}
                      disabled={isClustering || isLoadingSummary}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      {isClustering ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Creating Zones...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 fill-white" />
                          <span>Create Zones</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleRunElbow}
                      disabled={isRunningElbow}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                    >
                      {isRunningElbow ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
                          <span>Evaluating zones...</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-3.5 w-3.5 text-blue-600" />
                          <span>Suggest number of zones</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Projection Technical Note */}
            <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-[11px] text-blue-950 dark:text-blue-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-blue-800 dark:text-blue-300 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Coordinates projected to kilometres
              </span>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Coordinates are normalized to ground kilometers to ensure balanced zone boundaries and accurate geographic radius calculations.
              </p>
            </div>
          </div>
        </div>

        {/* Right Visualization Panel (~70-72% width / 8 Cols on lg) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            {/* Top Toolbar: View Toggles & Key Run Metrics */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Spatial Distribution & Clusters
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {viewMode === 'scatter'
                    ? 'Cartesian coordinate scatter plot with centroid crosses'
                    : 'Geographic map view with OpenStreetMap cluster overlays'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Segmented View Mode Toggle */}
                <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-750 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setViewMode('scatter')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'scatter'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Scatter Plot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'map'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Map className="h-3.5 w-3.5" />
                    <span>Map View</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Results KPI Summary Strip */}
            {clusterResult && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-100 dark:border-slate-800">
                <div className="text-center sm:text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Zones</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {clusterResult.k} Zones
                  </span>
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Locations</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {clusterResult.total_locations} Hubs
                  </span>
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Spread within zones</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                    {clusterResult.inertia} km²
                  </span>
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Zone quality</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {silhouetteInfo.label} <span className="text-xs font-normal text-slate-400">({silhouetteInfo.scoreDisplay})</span>
                  </span>
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Iterations</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                    {clusterResult.iterations_run}
                  </span>
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Runtime</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400 text-sm">
                    {clusterResult.execution_time_ms} ms
                  </span>
                </div>
              </div>
            )}

            {/* Filter Isolation Bar if Cluster Selected */}
            {selectedClusterId !== null && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-blue-600" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Isolating view for{' '}
                    <strong style={{ color: clusterColors[selectedClusterId % clusterColors.length] }}>
                      Zone {selectedClusterId + 1}
                    </strong>
                  </span>
                </div>
                <button
                  onClick={() => setSelectedClusterId(null)}
                  className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Show All Zones
                </button>
              </div>
            )}

            {/* Visualization Body: Scatter Chart Container */}
            <div className={viewMode === 'scatter' ? 'block' : 'hidden'}>
              <div className="w-full h-88 sm:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Longitude"
                      domain={['auto', 'auto']}
                      tickFormatter={(val: number) => `${Math.abs(val).toFixed(2)}°W`}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      label={{ value: 'Longitude', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#64748b' }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Latitude"
                      unit="°N"
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      label={{ value: 'Latitude (°N)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10, fill: '#64748b' }}
                    />
                    <ZAxis range={[110, 220]} />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isCentroid = data.isCentroid;
                          const color = clusterColors[data.clusterId % clusterColors.length];

                          return (
                            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl text-xs space-y-1.5 min-w-[190px]">
                              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                <span className="font-bold text-slate-900 dark:text-white truncate">
                                  {data.name}
                                </span>
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded text-white shrink-0"
                                  style={{ backgroundColor: color }}
                                >
                                  {isCentroid ? `Centroid #${data.clusterId}` : `Cluster #${data.clusterId}`}
                                </span>
                              </div>
                              {data.address && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {data.address}
                                </p>
                              )}
                              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                Coords: ({data.y.toFixed(4)}°N, {Math.abs(data.x).toFixed(4)}°W)
                              </div>
                              {!isCentroid && data.distToCentroid !== undefined && (
                                <div className="pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] flex justify-between">
                                  <span className="text-slate-500">Distance to Center:</span>
                                  <span className="font-mono font-bold" style={{ color }}>
                                    {data.distToCentroid} km
                                  </span>
                                </div>
                              )}
                              {isCentroid && (
                                <div className="pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Cluster Size:</span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {data.size} Locations
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Max Radius:</span>
                                    <span className="font-mono font-semibold">{data.radius} km</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {/* Location Scatter Points */}
                    <Scatter name="Locations" data={scatterData}>
                      {scatterData.map((entry, index) => {
                        const isDimmed = selectedClusterId !== null && entry.clusterId !== selectedClusterId;
                        return (
                          <Cell
                            key={`loc-cell-${index}`}
                            fill={entry.color}
                            opacity={isDimmed ? 0.2 : 1}
                            stroke="#ffffff"
                            strokeWidth={isDimmed ? 0.5 : 2}
                          />
                        );
                      })}
                    </Scatter>
                    {/* Centroid Cross Markers */}
                    <Scatter name="Centroids" data={centroidScatterData} shape="cross">
                      {centroidScatterData.map((entry, index) => {
                        const isDimmed = selectedClusterId !== null && entry.clusterId !== selectedClusterId;
                        return (
                          <Cell
                            key={`cent-cell-${index}`}
                            fill="#0f172a"
                            stroke={clusterColors[entry.clusterId % clusterColors.length]}
                            strokeWidth={isDimmed ? 1 : 3}
                            opacity={isDimmed ? 0.25 : 1}
                          />
                        );
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Visualization Body: Leaflet Map Container */}
            <div className={viewMode === 'map' ? 'block' : 'hidden'}>
              <div
                ref={mapContainerRef}
                className="w-full h-88 sm:h-96 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner relative z-0"
              />
            </div>

            {/* Cluster Legend & Interactive Highlight Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">Filter Cluster:</span>
                {(clusterResult?.centroids || []).map((c) => {
                  const isSelected = selectedClusterId === c.cluster_id;
                  const color = clusterColors[c.cluster_id % clusterColors.length];
                  return (
                    <button
                      key={`legend-btn-${c.cluster_id}`}
                      type="button"
                      onClick={() =>
                        setSelectedClusterId((prev) => (prev === c.cluster_id ? null : c.cluster_id))
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-slate-900 dark:border-white shadow-sm ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-slate-800 dark:text-slate-200">
                        Zone {c.cluster_id + 1} ({c.size})
                      </span>
                      {isSelected && <Check className="h-3 w-3 text-blue-600" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="font-bold text-sky-500">✕</span> Centroid Cross
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. ZONE DETAIL CARDS (PER-ZONE DRILLDOWN)                          */}
      {/* ------------------------------------------------------------------ */}
      {clusterResult && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1 gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Activity className="h-4 w-4" />
                </span>
                Zone Detail & Territory Allocation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Territory coverage, geographic centers, and assigned delivery hubs
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedClusterId !== null ? (
                <button
                  type="button"
                  onClick={() => setSelectedClusterId(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Showing Zone {selectedClusterId + 1} (Click to reset)</span>
                </button>
              ) : (
                <span className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-850 px-2.5 py-1 rounded-full border border-slate-100 dark:border-slate-800">
                  Click any card to isolate territory on map
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {clusterResult.centroids.map((c) => {
              const isSelected = selectedClusterId === c.cluster_id;
              const color = clusterColors[c.cluster_id % clusterColors.length];
              const members = (clusterResult.assignments || []).filter(
                (a) => a.cluster_id === c.cluster_id
              );
              const percentage = (
                (c.size / (clusterResult.total_locations || 1)) *
                100
              ).toFixed(1);

              return (
                <div
                  key={`detail-card-${c.cluster_id}`}
                  onClick={() =>
                    setSelectedClusterId((prev) => (prev === c.cluster_id ? null : c.cluster_id))
                  }
                  className={`glass-card relative rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between group hover:-translate-y-0.5 ${
 isSelected
 ? 'border-indigo-500 ring-2 ring-indigo-500/20 '
 : ' hover:border-slate-300 dark:hover:border-slate-700'
 }`}
                >
                  {/* Top Color Accent Bar */}
                  <div className="h-1.5 w-full transition-colors" style={{ backgroundColor: color }} />

                  <div className="p-5 space-y-4">
                    {/* Header: Zone Name & Pill Badges */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-3 w-3 relative">
                          <span
                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
                            style={{ backgroundColor: color }}
                          />
                          <span
                            className="relative inline-flex rounded-full h-3 w-3 ring-2 ring-white dark:ring-slate-900"
                            style={{ backgroundColor: color }}
                          />
                        </span>
                        <div>
                          <h4 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">
                            Zone {c.cluster_id + 1}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 tabular-nums">
                          {c.size} Hubs
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Fleet Territory Share Progress Track */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        <span>Fleet Network Share</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                          {percentage}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(6, Number(percentage))}%`,
                            backgroundColor: color
                          }}
                        />
                      </div>
                    </div>

                    {/* Centroid Coordinates & Radius Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-850/60 border border-slate-100 dark:border-slate-800/80 transition-colors">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                          Center Latitude
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-xs mt-0.5 block tabular-nums">
                          {c.latitude.toFixed(4)}°N
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-850/60 border border-slate-100 dark:border-slate-800/80 transition-colors">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                          Center Longitude
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-xs mt-0.5 block tabular-nums">
                          {Math.abs(c.longitude).toFixed(4)}°W
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-850/60 border border-slate-100 dark:border-slate-800/80 transition-colors">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                          Max Radius
                        </span>
                        <span
                          className="font-bold font-mono text-xs mt-0.5 block tabular-nums"
                          style={{ color }}
                        >
                          {c.radius_km} km
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-850/60 border border-slate-100 dark:border-slate-800/80 transition-colors">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                          Mean Distance
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-xs mt-0.5 block tabular-nums">
                          {c.avg_distance_km} km
                        </span>
                      </div>
                    </div>

                    {/* Members List */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        <span>Assigned Locations ({members.length})</span>
                        <span className="normal-case text-[10px] text-slate-400 font-mono">
                          Max spread: {c.radius_km} km
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                        {members.map((m) => (
                          <span
                            key={`member-${m.location_id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <MapPin className="h-3 w-3 shrink-0" style={{ color }} />
                            <span className="font-medium truncate max-w-[120px]">
                              {m.location_name}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 font-medium">
                              ({m.distance_to_centroid_km} km)
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Action Bar */}
                  <div className="px-5 py-2.5 bg-slate-50/60 dark:bg-slate-850/40 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-medium transition-colors">
                      {isSelected ? 'Click to deselect' : 'Click to isolate on map'}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. DIAGNOSTICS: ZONES VS. SPREAD                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Zones vs. Spread Diagnostic Panel (12 Cols) */}
        <div className="glass-card lg:col-span-12 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-600" />
                Zones vs. spread
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Evaluation of spread reduction trade-offs across zone counts
              </p>
            </div>
            {elbowResult && (
              <span className="text-[11px] font-mono text-slate-400">
                1..{elbowResult.total_points_evaluated} Zones Evaluated
              </span>
            )}
          </div>

          {elbowError && (
            <div className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
              <span>{elbowError}</span>
            </div>
          )}

          {elbowResult ? (
            <div className="space-y-3">
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={elbowResult.elbow_points}
                    margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                    <XAxis
                      dataKey="k"
                      name="Zones"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      label={{ value: 'Zones', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#64748b' }}
                    />
                    <YAxis
                      dataKey="wcss"
                      name="Spread"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      label={{ value: 'Spread (km²)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10, fill: '#64748b' }}
                    />
                    <Tooltip
                      formatter={(val: any) => [`${val} km²`, 'Spread']}
                      labelFormatter={(k) => `${k} Zones`}
                    />
                    <Line
                      type="monotone"
                      dataKey="wcss"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: '#2563eb' }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Data points pill row */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {elbowResult.elbow_points.map((p) => (
                  <span
                    key={`elbow-pt-${p.k}`}
                    className="px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                  >
                    {p.k} Zones: <strong className="text-slate-900 dark:text-white">{p.wcss} km²</strong>
                  </span>
                ))}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed">
                {elbowResult.interpretation_note}
              </p>
            </div>
          ) : (
            <div className="py-12 text-center space-y-3">
              <TrendingDown className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-400">
                Zone spread evaluation not loaded yet.
              </p>
              {canDispatch && (
                <button
                  onClick={handleRunElbow}
                  disabled={isRunningElbow}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition"
                >
                  {isRunningElbow ? 'Evaluating...' : 'Suggest number of zones'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. SAVED CLUSTER HISTORY & AUDIT TRAIL                             */}
      {/* ------------------------------------------------------------------ */}
      <div
        id="cluster-history"
        className="glass-card rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Zone Run History
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Historical records of created delivery zones and territory allocations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && history.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={isClearingHistory}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium text-rose-600 dark:text-rose-400 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                <span>{isClearingHistory ? 'Clearing...' : 'Clear history'}</span>
              </button>
            )}
            <button
              onClick={fetchHistory}
              disabled={isLoadingHistory}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 transition cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh Log</span>
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No zone runs recorded yet. Create zones above to generate history entries.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="pb-2.5">Run ID</th>
                  <th className="pb-2.5">Date & Time</th>
                  <th className="pb-2.5">Zones</th>
                  <th className="pb-2.5">Locations</th>
                  <th className="pb-2.5">Spread</th>
                  <th className="pb-2.5">Zone Quality</th>
                  <th className="pb-2.5">Runtime</th>
                  <th className="pb-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.slice(0, 5).map((run) => (
                  <tr
                    key={`hist-${run.id}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition-colors"
                  >
                    <td className="py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                      #{run.id}
                    </td>
                    <td className="py-2.5 text-slate-500 text-[11px]">
                      {new Date(run.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric'
                      })}{' '}
                      {new Date(run.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                      {run.k} Zones
                    </td>
                    <td className="py-2.5">{run.total_locations} Points</td>
                    <td className="py-2.5 font-mono">{run.inertia} km²</td>
                    <td className="py-2.5 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {run.silhouette_score !== null ? run.silhouette_score : 'N/A'}
                    </td>
                    <td className="py-2.5 font-mono text-slate-500">
                      {run.execution_time_ms} ms
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleLoadHistory(run.id)}
                        disabled={loadingRunId === run.id}
                        className="px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold text-[11px] transition-colors cursor-pointer"
                      >
                        {loadingRunId === run.id ? 'Loading...' : 'Load on Chart'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClusterAnalysis;
