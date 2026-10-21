export type DeliveryStatus = 'Delivered' | 'In Transit' | 'Pending' | 'Delayed';
export type DeliveryPriority = 'Standard' | 'Express' | 'Urgent';

export interface LocationItem {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  created_at?: string;
}

export interface Delivery {
  id: number | string;
  trackingNumber: string;
  tracking_number?: string;
  recipientName: string;
  customer_name?: string;
  customer_email?: string;
  customerEmail?: string;
  recipientPhone?: string;
  destinationAddress: string;
  pickup_location_id?: number;
  destination_location_id?: number;
  pickup_location?: LocationItem;
  destination_location?: LocationItem;
  lat: number;
  lng: number;
  packageWeightKg: number;
  package_weight_kg?: number;
  status: DeliveryStatus;
  priority: DeliveryPriority;
  distanceKm: number;
  distance_km?: number;
  deliveryDate?: string;
  delivery_date?: string;
  estimatedDeliveryTime?: string;
  estimated_delivery_time?: string;
  assignedDriver?: string;
  assigned_driver?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface DeliveriesListResponse {
  deliveries: Delivery[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface DashboardSummaryResponse {
  metrics: {
    total_deliveries: number;
    active_deliveries: number;
    completed_deliveries: number;
    delayed_deliveries: number;
    in_transit_deliveries: number;
    pending_deliveries: number;
    avg_distance_km: number | null;
    on_time_rate: number | null;
    has_sufficient_data: boolean;
    total_route_calculations?: number;
    avg_shortest_path_km?: number | null;
    avg_dijkstra_runtime_ms?: number | null;
    total_clustering_runs?: number;
    latest_k?: number | null;
    latest_silhouette_score?: number | null;
    revenue?: {
      today: number;
      week: number;
      month: number;
    };
  };
  status_distribution: {
    name: string;
    value: number;
    color: string;
  }[];
  performance_trend: {
    day: string;
    deliveries: number;
    onTimeRate: number;
    target: number;
  }[];
  timestamp: string;
}

// Route Optimization Types
export interface GraphNode {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  created_at?: string;
  // Computed canvas coordinates for SVG layout
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: number;
  source_location_id: number;
  destination_location_id: number;
  source_name?: string;
  destination_name?: string;
  distance_km: number;
  estimated_duration_minutes: number;
  is_active: boolean;
}

export interface GraphTopologyResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  total_nodes: number;
  total_edges: number;
  description: string;
}

export interface DijkstraTraceStep {
  step: number;
  action: string;
  current_node: number | null;
  pq_snapshot: [number, number][];
  visited_nodes: number[];
  distances: Record<number, number | null>;
  predecessors: Record<number, number | null>;
  description: string;
  relaxed_edge?: {
    source: number;
    target: number;
    weight_km: number;
    old_distance: number | null;
    new_distance: number;
  };
  final_path?: number[];
}

export interface ShortestPathRequest {
  source_location_id: number;
  destination_location_id: number;
  include_steps?: boolean;
}

export interface AlternativeRoute {
  route_index: number;
  label: string;
  is_primary: boolean;
  path: number[];
  total_distance_km: number;
  total_duration_minutes: number;
  path_nodes?: GraphNode[];
  path_edges?: GraphEdge[];
}

export interface ShortestPathResponse {
  source_location_id: number;
  destination_location_id: number;
  source_location?: GraphNode;
  destination_location?: GraphNode;
  algorithm: string;
  has_route: boolean;
  total_distance_km: number | null;
  path: number[];
  path_nodes: GraphNode[];
  path_edges: GraphEdge[];
  execution_time_ms: number;
  visited_nodes_count: number;
  total_nodes_in_graph: number;
  trace?: DijkstraTraceStep[] | null;
  route_run_id?: number | null;
  message?: string;
  routes?: AlternativeRoute[];
}

export interface RouteHistoryItem {
  id: number;
  source_location_id: number;
  destination_location_id: number;
  source_name: string;
  destination_name: string;
  algorithm: string;
  total_distance_km: number;
  path: number[];
  path_nodes?: GraphNode[];
  execution_time_ms: number;
  created_at: string;
  kind?: 'single' | 'run';
  stop_count?: number;
}

export interface DeliveryRunRequest {
  depot_location_id: number;
  delivery_ids?: number[];
  stop_location_ids?: number[];
  return_to_depot?: boolean;
}

export interface DeliveryRunLeg {
  leg_index: number;
  from_hub_id: number;
  to_hub_id: number;
  from_name: string;
  to_name: string;
  distance_km: number;
  duration_min?: number;
  road_path?: number[];
  via_names?: string[];
}

export interface DeliveryRunMethodSummary {
  order?: number[];
  distance_km: number;
  execution_time_ms: number;
}

export interface DeliveryRunResponse {
  depot_id: number;
  depot_name: string;
  stop_count: number;
  stops: number[];
  return_to_depot: boolean;
  recommended_order: number[];
  recommended_distance_km: number;
  total_distance_km?: number;
  as_listed?: {
    order: number[];
    order_names?: string[];
    distance_km: number;
  };
  recommended_order_names?: string[];
  recommended_duration_min?: number;
  hubs_in_matrix?: number;
  pairs_computed?: number;
  orders_checked_exact?: number | null;
  savings: {
    saved_km: number;
    saved_percent: number;
  };
  fast_method: DeliveryRunMethodSummary;
  exact_method?: DeliveryRunMethodSummary | null;
  gap_percent?: number;
  legs: DeliveryRunLeg[];
  expanded_node_path: number[];
  full_path?: number[];
  total_execution_time_ms?: number;
  route_run_id?: number | null;
  service_minutes_per_stop?: number;
  arrival_offsets_min?: number[];
}

export interface DispatchRunRequest {
  delivery_ids: number[];
  driver_name: string;
}

export interface DispatchRunResponse {
  message: string;
  updated: Delivery[];
}

export interface TestDetails {
  test_name: string;
  h0: string;
  h1: string;
  significance_level: number;
  statistic: number | null;
  statistic_label?: string;
  degrees_of_freedom: number | null;
  p_value: number | null;
  p_value_display: string;
  effect_size: number | null;
  effect_size_label?: string;
  sample_sizes: string;
}

export interface ConfidenceIntervalBlock {
  available: boolean;
  metric?: string;
  unit?: string;
  confidence?: number;
  n?: number;
  mean?: number;
  sample_sd?: number;
  standard_error?: number;
  degrees_of_freedom?: number;
  critical_t?: number;
  margin_of_error?: number;
  lower_limit?: number;
  upper_limit?: number;
  summary: string;
  reason?: string;
  details?: TestDetails;
}

export interface TTestBlock {
  available: boolean;
  group_a: string;
  group_b: string;
  unit?: string;
  n_a?: number;
  n_b?: number;
  mean_a?: number;
  mean_b?: number;
  difference_of_means?: number;
  ci_lower?: number;
  ci_upper?: number;
  t_statistic?: number;
  degrees_of_freedom?: number;
  p_value?: number;
  p_value_display?: string;
  is_significant?: boolean;
  cohens_d?: number;
  warning?: string | null;
  summary: string;
  reason?: string;
  details?: TestDetails;
}

export interface ChiSquareBlock {
  available: boolean;
  variable_x?: string;
  variable_y?: string;
  n?: number;
  chi2_statistic?: number;
  degrees_of_freedom?: number;
  p_value?: number;
  p_value_display?: string;
  is_significant?: boolean;
  cramers_v?: number;
  smallest_expected?: number;
  reliable?: boolean;
  collapsed?: boolean;
  summary: string;
  reason?: string;
  details?: TestDetails;
}

export interface InferenceResponse {
  available: boolean;
  reason?: string;
  metric: 'distance_km' | 'package_weight_kg';
  confidence_level: number;
  group_a: string;
  group_b: string;
  confidence_interval: ConfidenceIntervalBlock;
  t_test: TTestBlock;
  chi_square: ChiSquareBlock;
}

export interface RouteHistoryResponse {
  routes: RouteHistoryItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface KPIStat {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  period: string;
  description: string;
}

export interface BackendHealthResponse {
  status: string;
  service: string;
  version: string;
  phase?: string;
  timestamp: string;
  environment: string;
  database: {
    engine: string;
    status: string;
    connected: boolean;
    note: string;
    error?: string | null;
  };
  academic_modules: Record<string, {
    title: string;
    scope: string;
    status: string;
  }>;
}

export interface RouteOptimizationNode {
  id: string;
  name: string;
  x: number;
  y: number;
  type: 'depot' | 'waypoint' | 'destination';
  demandKg: number;
}

export interface RouteEdge {
  from: string;
  to: string;
  weightKm: number;
  trafficFactor: number;
  optimal?: boolean;
}

export interface ClusterDataPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cluster: number;
  distanceKm: number;
  weightKg: number;
}

export interface CloudServiceItem {
  id: string;
  name: string;
  category: 'API' | 'Compute' | 'Storage' | 'Database' | 'Cache' | 'Queue';
  status: 'Operational' | 'Not Configured' | 'Connecting' | 'Offline';
  latency: string;
  phase: string;
  description: string;
  host: string;
}

// Cluster Analysis & Statistical Types
export interface SDADatasetSummary {
  total_locations: number;
  valid_coordinates: number;
  total_deliveries: number;
  total_active_roads: number;
  total_route_runs: number;
  total_cluster_runs: number;
  bounding_box: {
    min_latitude: number;
    max_latitude: number;
    min_longitude: number;
    max_longitude: number;
    center_latitude: number;
    center_longitude: number;
  } | null;
  dataset_status: string;
}

export interface KMeansCentroid {
  cluster_id: number;
  latitude: number;
  longitude: number;
  size: number;
  radius_km: number;
  avg_distance_km: number;
}

export interface KMeansAssignment {
  location_id: number;
  location_name: string;
  address: string;
  latitude: number;
  longitude: number;
  cluster_id: number;
  distance_to_centroid_km: number;
}

export interface KMeansResponse {
  k: number;
  max_iterations: number;
  random_state: number;
  total_locations: number;
  inertia: number;
  silhouette_score: number | null;
  iterations_run: number;
  execution_time_ms: number;
  centroids: KMeansCentroid[];
  assignments: KMeansAssignment[];
  projection: string;
  cluster_run_id?: number;
}

export interface ElbowPoint {
  k: number;
  wcss: number;
  inertia: number;
}

export interface ElbowResponse {
  elbow_points: ElbowPoint[];
  total_points_evaluated: number;
  max_k_requested: number;
  interpretation_note: string;
}

export interface ClusterHistoryItem {
  id: number;
  k: number;
  max_iterations: number;
  random_state: number;
  inertia: number;
  silhouette_score: number | null;
  iterations_run: number;
  total_locations: number;
  centroids: KMeansCentroid[];
  execution_time_ms: number;
  created_at: string;
}

export interface ClusterHistoryResponse {
  cluster_runs: ClusterHistoryItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface UnivariateMetric {
  metric_name: string;
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  variance: number | null;
  std_dev: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  p10: number | null;
  p90: number | null;
  status: string;
}

export interface StatisticalSummaryResponse {
  delivery_distances: UnivariateMetric;
  delivery_weights: UnivariateMetric;
  road_distances: UnivariateMetric;
  route_distances: UnivariateMetric;
  total_deliveries_analyzed: number;
  total_roads_analyzed: number;
  total_routes_analyzed: number;
  notes: Record<string, string>;
}

export interface HistogramBin {
  range: string;
  min: number;
  max: number;
  count: number;
  frequency: number;
}

export interface DistributionResponse {
  distance_distribution: HistogramBin[];
  weight_distribution: HistogramBin[];
  sample_size: number;
}

export interface RegressionAnalysisResponse {
  x_label: string;
  y_label: string;
  sample_size: number;
  has_sufficient_data: boolean;
  correlation: number | null;
  p_value: number | null;
  slope: number | null;
  intercept: number | null;
  r_squared: number | null;
  equation: string | null;
  interpretation?: string;
  scatter_points?: { x: number; y: number }[];
  line_points?: { x: number; y: number }[];
  disclaimer: string;
  message?: string;
}

export interface CorrelationAnalysisResponse {
  delivery_distance_vs_weight: RegressionAnalysisResponse;
  road_distance_vs_duration: RegressionAnalysisResponse;
  disclaimer: string;
}

export interface DeliveryTrendPoint {
  day: string;
  full_day: string;
  deliveries: number;
  avg_distance_km: number;
  on_time_rate: number;
}

export interface DeliveryTrendsResponse {
  trends: DeliveryTrendPoint[];
  total_deliveries_evaluated: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

// Cloud Computing & Telemetry Types
export interface CloudHealthProbeResponse {
  status: string;
  service: string;
  version: string;
  phase?: string;
  timestamp: string;
  environment: string;
  total_latency_ms: number;
  database: {
    engine: string;
    status?: string;
    connected: boolean;
    latency_ms: number | null;
    target: string;
    error: string | null;
    pool_pre_ping: boolean;
    pool_recycle_sec: number;
    note?: string;
  };
  academic_modules: Record<string, {
    title: string;
    scope: string;
    status: string;
  }>;
}

export interface CloudServiceComponent {
  id: string;
  name: string;
  category: string;
  tier: string;
  provider: string;
  status: 'Operational' | 'Degraded' | 'Offline / Standby' | 'Not Configured';
  url?: string;
  technology: string;
  latency_ms?: number | null;
  target?: string;
  metrics?: string;
  note?: string;
  is_measured: boolean;
}

export interface CloudServicesCatalogResponse {
  services: CloudServiceComponent[];
  total_services: number;
  operational_count: number;
  timestamp: string;
}

export interface CloudDeploymentInfoResponse {
  environment: string;
  version: string;
  phase?: string;
  backend_url: string;
  frontend_url: string;
  git_commit: string;
  deployed_at: string;
  hosting_platform: string;
  runtime: {
    python_version: string;
    wsgi_server: string;
    containerized: boolean;
    os_platform: string;
  };
  ci_cd_pipeline: {
    platform: string;
    workflow_file: string;
    stages: string[];
  };
  timestamp: string;
}

export interface CloudOperationalMetricsResponse {
  process_metrics: {
    uptime_seconds: number;
    uptime_formatted: string;
    memory_rss_mb: number | null;
    cpu_percent: number | null;
    pid: number;
    status: string;
  };
  database_metrics: {
    total_deliveries: number;
    total_locations: number;
    total_active_roads: number;
    total_dijkstra_runs: number;
    total_cluster_runs: number;
    status: string;
  };
  metric_transparency: Record<string, string>;
  timestamp: string;
}

// -----------------------------------------------------------------------------
// Reporting & Export Types
// -----------------------------------------------------------------------------

export interface ReportAvailableItem {
  id: string;
  title: string;
  formats: ('PDF' | 'CSV')[];
  category: 'Operations' | 'ADA' | 'SDA' | 'CC' | 'Integrated';
}

export interface ReportsOverviewResponse {
  total_deliveries: number;
  total_locations: number;
  total_active_roads: number;
  total_route_runs: number;
  total_cluster_runs: number;
  latest_route_timestamp: string | null;
  latest_cluster_timestamp: string | null;
  timestamp: string;
  available_reports: ReportAvailableItem[];
}

export interface DeliveryReportFilters {
  status?: string;
  priority?: string;
  search?: string;
}

// -----------------------------------------------------------------------------
// Authentication & RBAC Types
// -----------------------------------------------------------------------------

export type UserRole = 'ADMIN' | 'DISPATCHER' | 'VIEWER';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  message: string;
  user: AuthUser;
  access_token: string;
  refresh_token: string;
}

export interface TokenRefreshResponse {
  message: string;
  access_token: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ManagedUser extends AuthUser {
  approval_status?: ApprovalStatus;
  requested_role?: UserRole | null;
}

export interface UserListResponse {
  users: ManagedUser[];
  total: number;
}
