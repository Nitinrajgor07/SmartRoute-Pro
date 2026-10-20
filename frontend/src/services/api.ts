import axios from 'axios';
import type {
  BackendHealthResponse,
  Delivery,
  DeliveriesListResponse,
  DashboardSummaryResponse,
  LocationItem,
  GraphTopologyResponse,
  ShortestPathRequest,
  ShortestPathResponse,
  DeliveryRunRequest,
  DeliveryRunResponse,
  RouteHistoryResponse,
  RouteHistoryItem,
  SDADatasetSummary,
  KMeansResponse,
  ElbowResponse,
  ClusterHistoryResponse,
  ClusterHistoryItem,
  StatisticalSummaryResponse,
  DistributionResponse,
  RegressionAnalysisResponse,
  CorrelationAnalysisResponse,
  DeliveryTrendsResponse,
  InferenceResponse,
  CloudHealthProbeResponse,
  CloudServicesCatalogResponse,
  CloudDeploymentInfoResponse,
  CloudOperationalMetricsResponse,
  ReportsOverviewResponse,
  DeliveryReportFilters,
  AuthUser,
  AuthResponse,
  TokenRefreshResponse,
  ManagedUser,
  UserListResponse,
  UserRole
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT access token to all outgoing requests if present
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('smartroute_access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiration & refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest?._retry) {
      const isAuthEndpoint =
        originalRequest?.url?.includes('/api/auth/login') ||
        originalRequest?.url?.includes('/api/auth/register') ||
        originalRequest?.url?.includes('/api/auth/refresh');

      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem('smartroute_refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('smartroute_access_token');
        localStorage.removeItem('smartroute_refresh_token');
        localStorage.removeItem('smartroute_user');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post<TokenRefreshResponse>(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
          }
        );

        const newAccessToken = response.data.access_token;
        localStorage.setItem('smartroute_access_token', newAccessToken);
        processQueue(null, newAccessToken);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('smartroute_access_token');
        localStorage.removeItem('smartroute_refresh_token');
        localStorage.removeItem('smartroute_user');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const deliveriesService = {
  /**
   * Fetch deliveries with pagination and filtering
   */
  async getDeliveries(params?: {
    page?: number;
    per_page?: number;
    status?: string;
    priority?: string;
    search?: string;
  }): Promise<DeliveriesListResponse> {
    const response = await apiClient.get<DeliveriesListResponse>('/api/deliveries', { params });
    return response.data;
  },

  /**
   * Fetch single delivery by ID
   */
  async getDelivery(id: number | string): Promise<{ delivery: Delivery }> {
    const response = await apiClient.get<{ delivery: Delivery }>(`/api/deliveries/${id}`);
    return response.data;
  },

  /**
   * Create new delivery order
   */
  async createDelivery(payload: {
    customer_name: string;
    pickup_location_id: number;
    destination_location_id: number;
    delivery_date?: string;
    priority?: string;
    status?: string;
    distance_km?: number;
    package_weight_kg?: number;
    estimated_delivery_time?: string;
    assigned_driver?: string;
    tracking_number?: string;
    customer_email?: string;
  }): Promise<{ message: string; delivery: Delivery }> {
    const response = await apiClient.post<{ message: string; delivery: Delivery }>('/api/deliveries', payload);
    return response.data;
  },

  /**
   * Update existing delivery order
   */
  async updateDelivery(
    id: number | string,
    payload: Partial<{
      customer_name: string;
      customer_email?: string | null;
      pickup_location_id: number;
      destination_location_id: number;
      priority: string;
      status: string;
      distance_km: number;
      package_weight_kg: number;
      estimated_delivery_time: string;
      assigned_driver: string;
    }>
  ): Promise<{ message: string; delivery: Delivery }> {
    const response = await apiClient.put<{ message: string; delivery: Delivery }>(`/api/deliveries/${id}`, payload);
    return response.data;
  },

  /**
   * Delete delivery order
   */
  async deleteDelivery(id: number | string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/api/deliveries/${id}`);
    return response.data;
  }
};

export const locationsService = {
  /**
   * List all geographic hubs & waypoints
   */
  async getLocations(params?: { search?: string; page?: number; per_page?: number }): Promise<{ locations: LocationItem[]; total: number }> {
    const response = await apiClient.get<{ locations: LocationItem[]; total: number }>('/api/locations', { params });
    return response.data;
  },

  /**
   * Retrieve location by ID
   */
  async getLocation(id: number | string): Promise<{ location: LocationItem }> {
    const response = await apiClient.get<{ location: LocationItem }>(`/api/locations/${id}`);
    return response.data;
  },

  /**
   * Create location
   */
  async createLocation(payload: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  }): Promise<{ message: string; location: LocationItem }> {
    const response = await apiClient.post<{ message: string; location: LocationItem }>('/api/locations', payload);
    return response.data;
  }
};

export const dashboardService = {
  /**
   * Fetch database-backed live KPI summary and distributions
   */
  async getSummary(): Promise<DashboardSummaryResponse> {
    const response = await apiClient.get<DashboardSummaryResponse>('/api/dashboard/summary');
    return response.data;
  },

  /**
   * Fetch recent deliveries from database
   */
  async getRecentDeliveries(): Promise<{ deliveries: Delivery[]; count: number }> {
    const response = await apiClient.get<{ deliveries: Delivery[]; count: number }>('/api/dashboard/recent-deliveries');
    return response.data;
  }
};

export const routesService = {
  /**
   * Fetch active graph topology (nodes, edges, road weights)
   */
  async getGraph(): Promise<GraphTopologyResponse> {
    const response = await apiClient.get<GraphTopologyResponse>('/api/graph');
    return response.data;
  },

  /**
   * Compute shortest path using Dijkstra with optional execution trace
   */
  async calculateShortestPath(payload: ShortestPathRequest): Promise<ShortestPathResponse> {
    const response = await apiClient.post<ShortestPathResponse>('/api/routes/shortest-path', payload);
    return response.data;
  },

  /**
   * Fetch saved route history
   */
  async getHistory(params?: { page?: number; per_page?: number; algorithm?: string }): Promise<RouteHistoryResponse> {
    const response = await apiClient.get<RouteHistoryResponse>('/api/routes/history', { params });
    return response.data;
  },

  /**
   * Fetch single route history detail
   */
  async getHistoryItem(id: number | string): Promise<{ route: RouteHistoryItem }> {
    const response = await apiClient.get<{ route: RouteHistoryItem }>(`/api/routes/history/${id}`);
    return response.data;
  },

  /**
   * Plan optimal multi-stop delivery run
   */
  async planDeliveryRun(payload: DeliveryRunRequest): Promise<DeliveryRunResponse> {
    const response = await apiClient.post<DeliveryRunResponse>('/api/routes/delivery-run', payload);
    return response.data;
  }
};

export const sdaService = {
  /**
   * Fetch overview of dataset points and bounding box
   */
  async getDatasetSummary(): Promise<SDADatasetSummary> {
    const response = await apiClient.get<SDADatasetSummary>('/api/sda/dataset-summary');
    return response.data;
  },

  /**
   * Execute K-Means clustering
   */
  async runKMeans(payload: { k: number; max_iterations?: number; random_state?: number }): Promise<KMeansResponse> {
    const response = await apiClient.post<KMeansResponse>('/api/sda/clusters/kmeans', payload);
    return response.data;
  },

  /**
   * Execute Elbow Method analysis across K=1..max_k
   */
  async runElbow(payload?: { max_k?: number; random_state?: number }): Promise<ElbowResponse> {
    const response = await apiClient.post<ElbowResponse>('/api/sda/clusters/elbow', payload || {});
    return response.data;
  },

  /**
   * Fetch historical clustering runs
   */
  async getClusterHistory(params?: { page?: number; per_page?: number }): Promise<ClusterHistoryResponse> {
    const response = await apiClient.get<ClusterHistoryResponse>('/api/sda/clusters/history', { params });
    return response.data;
  },

  /**
   * Clear all cluster run history (Admin only)
   */
  async clearClusterHistory(): Promise<{ message: string; deleted_count: number }> {
    const response = await apiClient.delete<{ message: string; deleted_count: number }>('/api/sda/clusters/history');
    return response.data;
  },

  /**
   * Fetch single cluster run with all location assignments
   */
  async getClusterDetail(id: number | string): Promise<{ cluster_run: ClusterHistoryItem & { assignments: any[] } }> {
    const response = await apiClient.get<{ cluster_run: ClusterHistoryItem & { assignments: any[] } }>(`/api/sda/clusters/history/${id}`);
    return response.data;
  },

  /**
   * Fetch parametric statistical summary across delivery and road metrics
   */
  async getStatisticalSummary(): Promise<StatisticalSummaryResponse> {
    const response = await apiClient.get<StatisticalSummaryResponse>('/api/sda/statistics/summary');
    return response.data;
  },

  /**
   * Fetch distribution histograms
   */
  async getDistribution(bins: number = 5): Promise<DistributionResponse> {
    const response = await apiClient.get<DistributionResponse>('/api/sda/statistics/distribution', { params: { bins } });
    return response.data;
  },

  /**
   * Fetch bivariate correlation analysis
   */
  async getCorrelation(): Promise<CorrelationAnalysisResponse> {
    const response = await apiClient.get<CorrelationAnalysisResponse>('/api/sda/statistics/correlation');
    return response.data;
  },

  /**
   * Fetch linear regression analysis with scatter and line endpoints
   */
  async getRegression(target: 'road_transit' | 'delivery_weight' = 'road_transit'): Promise<RegressionAnalysisResponse> {
    const response = await apiClient.get<RegressionAnalysisResponse>('/api/sda/statistics/regression', { params: { target } });
    return response.data;
  },

  /**
   * Fetch temporal delivery trends
   */
  async getTrends(): Promise<DeliveryTrendsResponse> {
    const response = await apiClient.get<DeliveryTrendsResponse>('/api/sda/statistics/trends');
    return response.data;
  },

  /**
   * Fetch statistical hypothesis tests and inference
   */
  async getInference(params?: {
    metric?: 'distance_km' | 'package_weight_kg';
    confidence?: number;
    group_a?: string;
    group_b?: string;
  }): Promise<InferenceResponse> {
    const response = await apiClient.get<InferenceResponse>('/api/sda/statistics/inference', { params });
    return response.data;
  }
};

export const healthService = {
  /**
   * Pings the Flask GET /api/health endpoint
   */
  async checkHealth(): Promise<BackendHealthResponse> {
    const response = await apiClient.get<BackendHealthResponse>('/api/health');
    return response.data;
  },

  /**
   * Root endpoint ping
   */
  async checkRoot(): Promise<{ name: string; version: string; status: string }> {
    const response = await apiClient.get('/');
    return response.data;
  }
};

export const cloudService = {
  /**
   * Real health probe with database roundtrip latency measurement
   */
  async getHealth(): Promise<CloudHealthProbeResponse> {
    const response = await apiClient.get<CloudHealthProbeResponse>('/api/cloud/health');
    return response.data;
  },

  /**
   * Architecture services catalog with operational status
   */
  async getServices(): Promise<CloudServicesCatalogResponse> {
    const response = await apiClient.get<CloudServicesCatalogResponse>('/api/cloud/services');
    return response.data;
  },

  /**
   * Deployment metadata, container info, and CI/CD stages
   */
  async getDeployment(): Promise<CloudDeploymentInfoResponse> {
    const response = await apiClient.get<CloudDeploymentInfoResponse>('/api/cloud/deployment');
    return response.data;
  },

  /**
   * Operational metrics, process memory RSS, and database entity counts
   */
  async getMetrics(): Promise<CloudOperationalMetricsResponse> {
    const response = await apiClient.get<CloudOperationalMetricsResponse>('/api/cloud/metrics');
    return response.data;
  }
};

/**
 * Downloads a binary or text file from the backend and triggers a browser file save.
 */
async function downloadReportBlob(url: string, defaultFilename: string, params?: Record<string, any>): Promise<void> {
  const response = await apiClient.get(url, {
    params,
    responseType: 'blob',
  });

  let filename = defaultFilename;
  const disposition = response.headers['content-disposition'];
  if (disposition && disposition.indexOf('filename=') !== -1) {
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
    const matches = filenameRegex.exec(disposition);
    if (matches != null && matches[1]) {
      filename = matches[1].replace(/['"]/g, '');
    }
  }

  const contentType = String(response.headers['content-type'] || 'application/octet-stream');
  const blob = new Blob([response.data], { type: contentType });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export const reportsService = {
  /**
   * Fetches metadata, entity counts and available reports for reporting dashboard
   */
  async getOverview(): Promise<ReportsOverviewResponse> {
    const response = await apiClient.get<ReportsOverviewResponse>('/api/reports/overview');
    return response.data;
  },

  /**
   * Downloads Delivery Operations Manifest as formula-safe CSV
   */
  async downloadDeliveriesCsv(filters?: DeliveryReportFilters): Promise<void> {
    await downloadReportBlob('/api/reports/deliveries.csv', 'smartroute_deliveries.csv', filters);
  },

  /**
   * Downloads Delivery Operations Manifest as styled A4 PDF
   */
  async downloadDeliveriesPdf(filters?: DeliveryReportFilters): Promise<void> {
    await downloadReportBlob('/api/reports/deliveries.pdf', 'smartroute_deliveries.pdf', filters);
  },

  /**
   * Downloads Route Calculations as formula-safe CSV
   */
  async downloadAdaCsv(): Promise<void> {
    await downloadReportBlob('/api/reports/ada.csv', 'smartroute_routes.csv');
  },

  /**
   * Downloads Route Planning Report as styled A4 PDF
   */
  async downloadAdaPdf(): Promise<void> {
    await downloadReportBlob('/api/reports/ada.pdf', 'smartroute_routes.pdf');
  },

  /**
   * Downloads Delivery Zone Partitions as formula-safe CSV
   */
  async downloadSdaClustersCsv(): Promise<void> {
    await downloadReportBlob('/api/reports/sda-clusters.csv', 'smartroute_zones.csv');
  },

  /**
   * Downloads Delivery Zones Report as styled A4 PDF
   */
  async downloadSdaClustersPdf(): Promise<void> {
    await downloadReportBlob('/api/reports/sda-clusters.pdf', 'smartroute_zones.pdf');
  },

  /**
   * Downloads Operational Analytics Report as styled A4 PDF
   */
  async downloadStatisticsPdf(): Promise<void> {
    await downloadReportBlob('/api/reports/statistics.pdf', 'smartroute_analytics.pdf');
  },

  /**
   * Downloads System Status Report as styled A4 PDF
   */
  async downloadCloudPdf(): Promise<void> {
    await downloadReportBlob('/api/reports/cloud.pdf', 'smartroute_system_status.pdf');
  },

  /**
   * Downloads Full Summary Report as styled A4 PDF
   */
  async downloadIntegratedPdf(): Promise<void> {
    await downloadReportBlob('/api/reports/integrated.pdf', 'smartroute_full_summary.pdf');
  },

  /**
   * Downloads Customer Parcel Records as CSV
   */
  async downloadMyParcelsCsv(): Promise<void> {
    await downloadReportBlob('/api/reports/my-parcels.csv', 'my_parcels.csv');
  },

  /**
   * Downloads Customer Parcel Tracking Report as PDF
   */
  async downloadMyParcelsPdf(): Promise<void> {
    await downloadReportBlob('/api/reports/my-parcels.pdf', 'my_parcels.pdf');
  }
};

export interface CustomerParcel {
  tracking_number: string;
  status: string;
  from?: string;
  to?: string;
  estimated_delivery_time?: string;
  last_updated?: string;
  created_date?: string;
}

export interface BookingHub {
  id: number;
  name: string;
  address: string;
}

export interface BookParcelPayload {
  pickup_location_id: number;
  destination_location_id: number;
  package_weight_kg: number;
  priority: 'Standard' | 'Express' | 'Urgent';
  recipient_name?: string;
}

export const myService = {
  async getBookingHubs(): Promise<{ hubs: BookingHub[] }> {
    const response = await apiClient.get<{ hubs: BookingHub[] }>('/api/my/hubs');
    return response.data;
  },

  async bookParcel(payload: BookParcelPayload): Promise<{ message: string; parcel: CustomerParcel }> {
    const response = await apiClient.post<{ message: string; parcel: CustomerParcel }>('/api/my/parcels', payload);
    return response.data;
  },

  async getMyParcels(search?: string): Promise<{ parcels: CustomerParcel[]; count: number }> {
    const response = await apiClient.get<{ parcels: CustomerParcel[]; count: number }>('/api/my/parcels', {
      params: search ? { search } : undefined,
    });
    return response.data;
  },

  async getMyParcelByTracking(trackingNumber: string): Promise<{ parcel: CustomerParcel }> {
    const response = await apiClient.get<{ parcel: CustomerParcel }>(`/api/my/parcels/${trackingNumber}`);
    return response.data;
  },
};

export const authService = {
  /**
   * Authenticate user with email and password
   */
  async login(payload: { email: string; password: string }): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/auth/login', payload);
    return response.data;
  },

  /**
   * Register a new user account (pending admin approval)
   */
  async register(payload: {
    name: string;
    email: string;
    password: string;
    account_type?: string;
  }): Promise<{ message: string; user: AuthUser }> {
    const response = await apiClient.post<{ message: string; user: AuthUser }>('/api/auth/register', payload);
    return response.data;
  },

  /**
   * Logout user and revoke token on backend
   */
  async logout(): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('/api/auth/logout');
      return response.data;
    } finally {
      localStorage.removeItem('smartroute_access_token');
      localStorage.removeItem('smartroute_refresh_token');
      localStorage.removeItem('smartroute_user');
    }
  },

  /**
   * Refresh expired access token
   */
  async refresh(): Promise<TokenRefreshResponse> {
    const refreshToken = localStorage.getItem('smartroute_refresh_token');
    const response = await apiClient.post<TokenRefreshResponse>(
      '/api/auth/refresh',
      {},
      {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      }
    );
    return response.data;
  },

  /**
   * Get current authenticated user profile
   */
  async getMe(): Promise<{ user: AuthUser; permissions: string[] }> {
    const response = await apiClient.get<{ user: AuthUser; permissions: string[] }>('/api/auth/me');
    return response.data;
  },

  /**
   * Update authenticated user profile name and/or email
   */
  async updateProfile(payload: { name?: string; email?: string }): Promise<{ message: string; user: AuthUser }> {
    const response = await apiClient.put<{ message: string; user: AuthUser }>('/api/auth/profile', payload);
    return response.data;
  },

  /**
   * Change current user's password
   */
  async changePassword(payload: { current_password: string; new_password: string }): Promise<{ message: string }> {
    const response = await apiClient.put<{ message: string }>('/api/auth/change-password', payload);
    return response.data;
  },

  /**
   * Admin RBAC: List all registered users
   */
  async getUsers(): Promise<UserListResponse> {
    const response = await apiClient.get<UserListResponse>('/api/auth/users');
    return response.data;
  },

  /**
   * Admin RBAC: Update user role
   */
  async updateUserRole(userId: number, role: UserRole): Promise<{ message: string; user: ManagedUser }> {
    const response = await apiClient.put<{ message: string; user: ManagedUser }>(`/api/auth/users/${userId}/role`, { role });
    return response.data;
  },

  /**
   * Admin RBAC: Activate or deactivate user
   */
  async toggleUserStatus(userId: number, is_active: boolean): Promise<{ message: string; user: ManagedUser }> {
    const response = await apiClient.put<{ message: string; user: ManagedUser }>(`/api/auth/users/${userId}/status`, { is_active });
    return response.data;
  },

  /**
   * Admin RBAC: Approve a pending/rejected registration (role becomes the requested role)
   */
  async approveUser(userId: number): Promise<{ message: string; user: ManagedUser }> {
    const response = await apiClient.post<{ message: string; user: ManagedUser }>(`/api/auth/users/${userId}/approve`);
    return response.data;
  },

  /**
   * Admin RBAC: Reject a pending registration
   */
  async rejectUser(userId: number): Promise<{ message: string; user: ManagedUser }> {
    const response = await apiClient.post<{ message: string; user: ManagedUser }>(`/api/auth/users/${userId}/reject`);
    return response.data;
  },

  /**
   * Admin RBAC: Permanently delete a user account
   */
  async deleteUser(userId: number): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/api/auth/users/${userId}`);
    return response.data;
  }
};

