import type { Delivery, KPIStat, RouteOptimizationNode, RouteEdge, ClusterDataPoint, CloudServiceItem } from '../types';

/**
 * -----------------------------------------------------------------------------
 * SMARTROUTE PRO DEMONSTRATION DATASET
 * -----------------------------------------------------------------------------
 * Sample demonstration data structure for offline and UI layout validation.
 * -----------------------------------------------------------------------------
 */

export const IS_SAMPLE_DEMO_DATA = true;
export const DEMO_DATA_NOTICE = "SmartRoute Pro Demonstration Dataset — Local Sample Mode";

export const sampleKPIs: KPIStat[] = [
  {
    title: "Total Deliveries",
    value: "2,845",
    change: "+12.4%",
    isPositive: true,
    period: "vs last month",
    description: "Total packages processed across all urban delivery zones"
  },
  {
    title: "Active Routes",
    value: "42",
    change: "+4 routes",
    isPositive: true,
    period: "currently in transit",
    description: "Live algorithm-optimized delivery dispatch paths"
  },
  {
    title: "Avg Delivery Distance",
    value: "8.4 km",
    change: "-0.6 km",
    isPositive: true,
    period: "per completed route",
    description: "Efficiency gain achieved via shortest-path heuristic"
  },
  {
    title: "On-Time Delivery Rate",
    value: "96.4%",
    change: "+1.2%",
    isPositive: true,
    period: "30-day rolling window",
    description: "SLA compliance threshold set at 95.0%"
  }
];

export const sampleDeliveries: Delivery[] = [
  {
    id: "DEL-8401",
    trackingNumber: "TRK-902184-US",
    recipientName: "TechCorp Logistics Hub",
    recipientPhone: "+1 (555) 234-8901",
    destinationAddress: "452 Silicon Ave, North Sector",
    lat: 37.7749,
    lng: -122.4194,
    packageWeightKg: 14.2,
    status: "Delivered",
    priority: "Express",
    distanceKm: 6.2,
    estimatedDeliveryTime: "10:30 AM",
    assignedDriver: "Marcus Vance (Van 04)",
    createdAt: "2026-10-16 08:15"
  },
  {
    id: "DEL-8402",
    trackingNumber: "TRK-902185-US",
    recipientName: "Apex Medical Supplies",
    recipientPhone: "+1 (555) 872-1144",
    destinationAddress: "12 Healthcare Blvd, Suite 300",
    lat: 37.7833,
    lng: -122.4167,
    packageWeightKg: 4.8,
    status: "In Transit",
    priority: "Urgent",
    distanceKm: 9.8,
    estimatedDeliveryTime: "11:15 AM",
    assignedDriver: "Elena Rostova (Van 02)",
    createdAt: "2026-10-16 08:30"
  },
  {
    id: "DEL-8403",
    trackingNumber: "TRK-902186-US",
    recipientName: "Metro Superstore Central",
    recipientPhone: "+1 (555) 439-0922",
    destinationAddress: "889 Grand Marketplace St",
    lat: 37.7651,
    lng: -122.4241,
    packageWeightKg: 38.5,
    status: "In Transit",
    priority: "Standard",
    distanceKm: 12.4,
    estimatedDeliveryTime: "12:00 PM",
    assignedDriver: "David Kim (Truck 01)",
    createdAt: "2026-10-16 08:45"
  },
  {
    id: "DEL-8404",
    trackingNumber: "TRK-902187-US",
    recipientName: "Horizon Robotics Lab",
    recipientPhone: "+1 (555) 678-3301",
    destinationAddress: "204 Research Parkway, Bldg B",
    lat: 37.7912,
    lng: -122.4012,
    packageWeightKg: 2.1,
    status: "Pending",
    priority: "Express",
    distanceKm: 5.1,
    estimatedDeliveryTime: "01:30 PM",
    assignedDriver: "Unassigned",
    createdAt: "2026-10-16 09:00"
  },
  {
    id: "DEL-8405",
    trackingNumber: "TRK-902188-US",
    recipientName: "Blue Harbor Imports",
    recipientPhone: "+1 (555) 901-4455",
    destinationAddress: "Pier 28 Shipping Terminal",
    lat: 37.7895,
    lng: -122.3876,
    packageWeightKg: 24.0,
    status: "Delayed",
    priority: "Standard",
    distanceKm: 14.8,
    estimatedDeliveryTime: "03:45 PM (Weather Delay)",
    assignedDriver: "Marcus Vance (Van 04)",
    createdAt: "2026-10-16 09:10"
  },
  {
    id: "DEL-8406",
    trackingNumber: "TRK-902189-US",
    recipientName: "Greenleaf Bio Pharma",
    recipientPhone: "+1 (555) 345-7788",
    destinationAddress: "77 Innovation Way, West Quad",
    lat: 37.7520,
    lng: -122.4350,
    packageWeightKg: 1.5,
    status: "Delivered",
    priority: "Urgent",
    distanceKm: 7.3,
    estimatedDeliveryTime: "09:45 AM",
    assignedDriver: "Sarah Jenkins (Van 01)",
    createdAt: "2026-10-16 07:45"
  },
  {
    id: "DEL-8407",
    trackingNumber: "TRK-902190-US",
    recipientName: "OmniRetail Distribution",
    recipientPhone: "+1 (555) 612-8800",
    destinationAddress: "105 Industrial Loop Road",
    lat: 37.7401,
    lng: -122.4089,
    packageWeightKg: 52.0,
    status: "Pending",
    priority: "Standard",
    distanceKm: 18.2,
    estimatedDeliveryTime: "04:15 PM",
    assignedDriver: "Unassigned",
    createdAt: "2026-10-16 09:20"
  },
  {
    id: "DEL-8408",
    trackingNumber: "TRK-902191-US",
    recipientName: "Starlight Electronics",
    recipientPhone: "+1 (555) 777-1234",
    destinationAddress: "320 Market Street, 5th Floor",
    lat: 37.7935,
    lng: -122.3995,
    packageWeightKg: 8.6,
    status: "In Transit",
    priority: "Express",
    distanceKm: 4.5,
    estimatedDeliveryTime: "11:45 AM",
    assignedDriver: "Sarah Jenkins (Van 01)",
    createdAt: "2026-10-16 09:30"
  }
];

export const samplePerformanceData = [
  { day: "Mon", deliveries: 340, onTimeRate: 95.8, target: 95 },
  { day: "Tue", deliveries: 410, onTimeRate: 96.2, target: 95 },
  { day: "Wed", deliveries: 480, onTimeRate: 94.9, target: 95 },
  { day: "Thu", deliveries: 420, onTimeRate: 97.1, target: 95 },
  { day: "Fri", deliveries: 560, onTimeRate: 96.8, target: 95 },
  { day: "Sat", deliveries: 390, onTimeRate: 97.5, target: 95 },
  { day: "Sun", deliveries: 245, onTimeRate: 98.2, target: 95 },
];

export const sampleStatusDistribution = [
  { name: "Delivered", value: 1934, color: "#10b981" },
  { name: "In Transit", value: 512, color: "#3b82f6" },
  { name: "Pending", value: 285, color: "#f59e0b" },
  { name: "Delayed", value: 114, color: "#ef4444" },
];

// Graph Nodes for Route Planner
export const sampleGraphNodes: RouteOptimizationNode[] = [
  { id: "NODE-DEPOT", name: "Majestic Depot", x: 80, y: 180, type: 'depot', demandKg: 0 },
  { id: "NODE-N1", name: "Koramangala", x: 220, y: 90, type: 'waypoint', demandKg: 14.2 },
  { id: "NODE-N2", name: "Jayanagar", x: 250, y: 270, type: 'waypoint', demandKg: 4.8 },
  { id: "NODE-N3", name: "Malleshwaram", x: 410, y: 80, type: 'waypoint', demandKg: 38.5 },
  { id: "NODE-N4", name: "Indiranagar", x: 440, y: 220, type: 'waypoint', demandKg: 2.1 },
  { id: "NODE-DEST", name: "Whitefield", x: 600, y: 160, type: 'destination', demandKg: 24.0 },
];

export const sampleGraphEdges: RouteEdge[] = [
  { from: "NODE-DEPOT", to: "NODE-N1", weightKm: 6.2, trafficFactor: 1.1, optimal: true },
  { from: "NODE-DEPOT", to: "NODE-N2", weightKm: 8.5, trafficFactor: 1.4 },
  { from: "NODE-N1", to: "NODE-N3", weightKm: 5.4, trafficFactor: 1.0, optimal: true },
  { from: "NODE-N1", to: "NODE-N4", weightKm: 7.9, trafficFactor: 1.2 },
  { from: "NODE-N2", to: "NODE-N4", weightKm: 6.8, trafficFactor: 1.3 },
  { from: "NODE-N3", to: "NODE-DEST", weightKm: 4.3, trafficFactor: 1.1, optimal: true },
  { from: "NODE-N4", to: "NODE-DEST", weightKm: 5.7, trafficFactor: 1.5 },
];

// Spatial Delivery Zones
export const sampleClusterPoints: ClusterDataPoint[] = [
  // Cluster 0: Downtown North
  { id: "C0-1", name: "Delivery #101", lat: 37.785, lng: -122.410, cluster: 0, distanceKm: 4.2, weightKg: 12.0 },
  { id: "C0-2", name: "Delivery #102", lat: 37.792, lng: -122.405, cluster: 0, distanceKm: 4.8, weightKg: 8.5 },
  { id: "C0-3", name: "Delivery #103", lat: 37.788, lng: -122.415, cluster: 0, distanceKm: 5.1, weightKg: 15.2 },
  { id: "C0-4", name: "Delivery #104", lat: 37.795, lng: -122.401, cluster: 0, distanceKm: 5.6, weightKg: 6.0 },

  // Cluster 1: South Commercial
  { id: "C1-1", name: "Delivery #201", lat: 37.745, lng: -122.420, cluster: 1, distanceKm: 11.2, weightKg: 28.0 },
  { id: "C1-2", name: "Delivery #202", lat: 37.738, lng: -122.412, cluster: 1, distanceKm: 12.5, weightKg: 34.0 },
  { id: "C1-3", name: "Delivery #203", lat: 37.750, lng: -122.428, cluster: 1, distanceKm: 10.8, weightKg: 22.4 },

  // Cluster 2: West Residential
  { id: "C2-1", name: "Delivery #301", lat: 37.762, lng: -122.460, cluster: 2, distanceKm: 8.9, weightKg: 5.4 },
  { id: "C2-2", name: "Delivery #302", lat: 37.769, lng: -122.452, cluster: 2, distanceKm: 7.7, weightKg: 9.1 },
  { id: "C2-3", name: "Delivery #303", lat: 37.758, lng: -122.468, cluster: 2, distanceKm: 9.4, weightKg: 4.2 },

  // Cluster 3: East Waterfront
  { id: "C3-1", name: "Delivery #401", lat: 37.778, lng: -122.389, cluster: 3, distanceKm: 7.2, weightKg: 18.0 },
  { id: "C3-2", name: "Delivery #402", lat: 37.782, lng: -122.384, cluster: 3, distanceKm: 6.9, weightKg: 14.5 },
  { id: "C3-3", name: "Delivery #403", lat: 37.771, lng: -122.392, cluster: 3, distanceKm: 7.8, weightKg: 21.0 },
];

// Distribution and Operational Trends for Analytics
export const sampleDeliveryTimeDistribution = [
  { bin: "10-20 min", count: 180, normalCurve: 160 },
  { bin: "20-30 min", count: 640, normalCurve: 610 },
  { bin: "30-40 min", count: 980, normalCurve: 950 },
  { bin: "40-50 min", count: 690, normalCurve: 720 },
  { bin: "50-60 min", count: 280, normalCurve: 310 },
  { bin: "> 60 min", count: 75, normalCurve: 95 },
];

export const sampleDistanceVsTimeScatter = [
  { distance: 2.1, time: 14.2, fit: 13.8 },
  { distance: 3.5, time: 19.0, fit: 18.5 },
  { distance: 4.8, time: 23.5, fit: 22.9 },
  { distance: 6.2, time: 28.1, fit: 27.6 },
  { distance: 7.4, time: 31.0, fit: 31.7 },
  { distance: 8.9, time: 38.2, fit: 36.8 },
  { distance: 10.3, time: 42.5, fit: 41.5 },
  { distance: 12.0, time: 49.0, fit: 47.3 },
  { distance: 14.5, time: 54.2, fit: 55.8 },
  { distance: 16.8, time: 64.0, fit: 63.6 },
  { distance: 19.2, time: 70.5, fit: 71.7 }
];

// Infrastructure Services for System Status
export const sampleCloudServices: CloudServiceItem[] = [
  {
    id: "SRV-API",
    name: "Flask REST API Gateway",
    category: "API",
    status: "Operational",
    latency: "12 ms",
    phase: "Operational",
    description: "Modular Flask factory serving /api/health and client endpoints",
    host: "http://127.0.0.1:5000"
  },
  {
    id: "SRV-ALGO",
    name: "Route Optimization Service",
    category: "Compute",
    status: "Operational",
    latency: "Standby",
    phase: "Operational",
    description: "Routing service executing shortest path solvers",
    host: "container-routing.smartroute.internal"
  },
  {
    id: "SRV-STAT",
    name: "Statistical Computing Engine",
    category: "Compute",
    status: "Operational",
    latency: "Standby",
    phase: "Operational",
    description: "Worker service calculating delivery zones and operational trends",
    host: "container-stats.smartroute.internal"
  },
  {
    id: "SRV-DB",
    name: "PostgreSQL Database",
    category: "Database",
    status: "Operational",
    latency: "Configured",
    phase: "Operational",
    description: "Relational database for persistent logistics data",
    host: "postgresql://localhost:5432/smartroute_db"
  },
  {
    id: "SRV-CACHE",
    name: "Redis Routing Cache",
    category: "Cache",
    status: "Not Configured",
    latency: "Standby",
    phase: "Not Configured",
    description: "In-memory caching for precomputed routes and zone centroids",
    host: "redis://localhost:6379/0"
  },
  {
    id: "SRV-STORAGE",
    name: "Cloud Object Storage (S3 / MinIO)",
    category: "Storage",
    status: "Not Configured",
    latency: "Standby",
    phase: "Not Configured",
    description: "Stores generated analytical reports, PDF summaries, and geospatial maps",
    host: "s3.smartroute.internal"
  }
];

// Reports Catalog
export const sampleReportsList = [
  {
    id: "REP-2026-001",
    title: "Daily Fleet Operational Dispatch Summary",
    category: "Operations",
    module: "General",
    format: "CSV",
    size: "148 KB",
    generatedDate: "2026-10-16 08:00",
    recordCount: 2845
  },
  {
    id: "REP-2026-002",
    title: "Shortest Path Route Benchmarks & Execution Time",
    category: "Routing Efficiency",
    module: "Routing",
    format: "JSON",
    size: "84 KB",
    generatedDate: "2026-10-15 18:30",
    recordCount: 520
  },
  {
    id: "REP-2026-003",
    title: "Delivery Zone Coverage & Spread Audit",
    category: "Zones",
    module: "Zones",
    format: "CSV",
    size: "210 KB",
    generatedDate: "2026-10-15 12:00",
    recordCount: 1240
  },
  {
    id: "REP-2026-004",
    title: "Delivery Duration vs Distance Trend Diagnostics",
    category: "Analytics",
    module: "Analytics",
    format: "PDF",
    size: "1.2 MB",
    generatedDate: "2026-10-14 20:00",
    recordCount: 2845
  },
  {
    id: "REP-2026-005",
    title: "Service Availability & API Latency SLA Log",
    category: "System Health",
    module: "System",
    format: "JSON",
    size: "62 KB",
    generatedDate: "2026-10-16 06:00",
    recordCount: 8640
  }
];
