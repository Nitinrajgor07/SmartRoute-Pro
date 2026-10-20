import React, { useState, useEffect, useRef } from 'react';
import { MapPin, RotateCcw, Eye, EyeOff } from 'lucide-react';
import L from 'leaflet';
import type { GraphNode, GraphEdge } from '../../types';

interface RouteMapProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedPathNodeIds: number[];
  sourceId: number;
  destinationId: number;
  isDeliveryRun?: boolean;
  runStopOrder?: number[];
}

export const RouteMap: React.FC<RouteMapProps> = ({
  nodes,
  edges,
  selectedPathNodeIds,
  sourceId,
  destinationId,
  isDeliveryRun = false,
  runStopOrder = []
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  // Toggle "Show roads" off by default
  const [showRoads, setShowRoads] = useState(false);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([12.9716, 77.5946], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      const layersGroup = L.layerGroup().addTo(map);
      layersGroupRef.current = layersGroup;
      mapInstanceRef.current = map;
    }
  }, []);

  // Update Map Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const nodeMap = new Map<number, GraphNode>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    const pathSet = new Set(selectedPathNodeIds);

    // 1. Road network lines (only when "Show roads" is toggled ON)
    if (showRoads) {
      edges.forEach((edge) => {
        const u = nodeMap.get(edge.source_location_id);
        const v = nodeMap.get(edge.destination_location_id);
        if (u && v && u.latitude != null && v.latitude != null) {
          L.polyline([[u.latitude, u.longitude], [v.latitude, v.longitude]], {
            color: '#94a3b8',
            weight: 1.5,
            opacity: 0.4
          }).addTo(group);
        }
      });
    }

    // 2. Selected route as one solid line
    if (selectedPathNodeIds.length > 1) {
      const routeCoords: [number, number][] = [];
      selectedPathNodeIds.forEach((id) => {
        const n = nodeMap.get(id);
        if (n && n.latitude != null && n.longitude != null) {
          routeCoords.push([n.latitude, n.longitude]);
        }
      });

      if (routeCoords.length > 1) {
        L.polyline(routeCoords, {
          color: '#4f46e5',
          weight: 6,
          opacity: 0.95,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(group);
      }
    }

    // 3. Render markers
    const allLatLngs: [number, number][] = [];
    const routeLatLngs: [number, number][] = [];

    nodes.forEach((node) => {
      if (node.latitude == null || node.longitude == null) return;
      const latLng: [number, number] = [node.latitude, node.longitude];
      allLatLngs.push(latLng);

      const isInPath = pathSet.has(node.id);
      const isOrigin = node.id === sourceId;
      const isDestination = !isDeliveryRun && node.id === destinationId;
      const isRunStop = isDeliveryRun && runStopOrder.includes(node.id) && !isOrigin;
      const runStopNumber = isRunStop ? runStopOrder.indexOf(node.id) + 1 : -1;

      if (isInPath || isOrigin || isRunStop) {
        routeLatLngs.push(latLng);
        const stepIndex = selectedPathNodeIds.indexOf(node.id) + 1;

        let markerHtml = '';
        let iconSize: [number, number] = [28, 28];
        let iconAnchor: [number, number] = [14, 14];

        if (isOrigin) {
          // Green depot / start marker with name label
          iconSize = [36, 36];
          iconAnchor = [18, 18];
          markerHtml = `
            <div class="relative flex items-center justify-center cursor-pointer" title="${isDeliveryRun ? 'Depot' : 'Start'}: ${node.name}">
              <div class="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md border-2 border-white ring-2 ring-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>
              </div>
              <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-700 text-white font-extrabold text-[12px] px-2 py-0.5 rounded shadow pointer-events-none">
                ${node.name}
              </div>
            </div>
          `;
        } else if (isRunStop) {
          // Stop markers numbered 1..n in visit order
          iconSize = [30, 30];
          iconAnchor = [15, 15];
          markerHtml = `
            <div class="relative flex items-center justify-center cursor-pointer" title="Stop ${runStopNumber}: ${node.name}">
              <div class="h-8 w-8 rounded-full bg-indigo-600 text-white font-extrabold text-[13px] flex items-center justify-center shadow-md border-2 border-white ring-2 ring-indigo-400">
                ${runStopNumber}
              </div>
              <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-800 text-white font-extrabold text-[12px] px-2 py-0.5 rounded shadow pointer-events-none">
                ${node.name}
              </div>
            </div>
          `;
        } else if (isDestination) {
          // Red flag end marker with name label
          iconSize = [36, 36];
          iconAnchor = [18, 18];
          markerHtml = `
            <div class="relative flex items-center justify-center cursor-pointer" title="End: ${node.name}">
              <div class="h-8 w-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md border-2 border-white ring-2 ring-rose-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
              </div>
              <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-rose-700 text-white font-extrabold text-[12px] px-2 py-0.5 rounded shadow pointer-events-none">
                ${node.name}
              </div>
            </div>
          `;
        } else {
          // Route stops / waypoints as small numbered dots
          iconSize = [28, 28];
          iconAnchor = [14, 14];
          markerHtml = `
            <div class="relative flex items-center justify-center cursor-pointer" title="${node.name}">
              <div class="h-7 w-7 rounded-full bg-indigo-600 text-white font-extrabold text-[12px] flex items-center justify-center shadow-md border-2 border-white">
                ${stepIndex}
              </div>
              <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-800 text-white font-extrabold text-[12px] px-2 py-0.5 rounded shadow pointer-events-none">
                ${node.name}
              </div>
            </div>
          `;
        }

        const icon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: markerHtml,
          iconSize,
          iconAnchor
        });

        L.marker(latLng, { icon }).addTo(group);
      } else {
        // Other hubs as small grey dots with name on hover
        const dotIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div class="h-4 w-4 rounded-full bg-slate-500 dark:bg-slate-400 border-2 border-white shadow" title="${node.name}"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        const dot = L.marker(latLng, { icon: dotIcon }).addTo(group);
        dot.bindTooltip(node.name, { direction: 'top', offset: [0, -5] });
      }
    });

    // Zoom map to fit route after finding route
    if (routeLatLngs.length > 1) {
      map.fitBounds(L.latLngBounds(routeLatLngs), { padding: [40, 40], maxZoom: 15 });
    } else if (allLatLngs.length > 0) {
      map.fitBounds(L.latLngBounds(allLatLngs), { padding: [30, 30], maxZoom: 13 });
    }
  }, [nodes, edges, selectedPathNodeIds, sourceId, destinationId, isDeliveryRun, runStopOrder, showRoads]);

  const handleResetView = () => {
    const map = mapInstanceRef.current;
    if (!map || nodes.length === 0) return;
    const coords: [number, number][] = nodes
      .filter((n) => n.latitude != null && n.longitude != null)
      .map((n) => [n.latitude, n.longitude]);
    if (coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [30, 30], maxZoom: 13 });
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      {/* Top Map Action Bar */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Route map
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle "Show roads" */}
          <button
            type="button"
            onClick={() => setShowRoads((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              showRoads
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-semibold'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            {showRoads ? <Eye className="h-3.5 w-3.5 text-indigo-600" /> : <EyeOff className="h-3.5 w-3.5 text-slate-400" />}
            <span>Show roads</span>
          </button>

          {/* Reset View Button */}
          <button
            type="button"
            onClick={handleResetView}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3 text-slate-500" />
            <span>Reset view</span>
          </button>
        </div>
      </div>

      {/* Map Container: 480px on desktop */}
      <div
        ref={mapContainerRef}
        className="h-[320px] md:h-[480px] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 z-0"
      />
    </div>
  );
};
