import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './app/ThemeContext';
import { AuthProvider } from './app/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Deliveries } from './pages/Deliveries';
import { RouteOptimization } from './pages/RouteOptimization';
import { ClusterAnalysis } from './pages/ClusterAnalysis';
import { StatisticalAnalytics } from './pages/StatisticalAnalytics';
import { SystemStatus } from './pages/SystemStatus';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/signup" element={<Navigate to="/register" replace />} />
            <Route path="/sign-up" element={<Navigate to="/register" replace />} />

            {/* Protected SaaS Layout (All 8 Core Tabs Preserved) */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              {/* 1. Dashboard */}
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Navigate to="/" replace />} />

              {/* 2. Delivery Management */}
              <Route
                path="deliveries"
                element={
                  <ProtectedRoute requiredPermission="deliveries:read">
                    <Deliveries />
                  </ProtectedRoute>
                }
              />

              {/* 3. Route Planner */}
              <Route
                path="route-planner"
                element={
                  <ProtectedRoute requiredPermission="routes:read">
                    <RouteOptimization />
                  </ProtectedRoute>
                }
              />
              <Route path="route-optimization" element={<Navigate to="/route-planner" replace />} />
              <Route path="routes" element={<Navigate to="/route-planner" replace />} />

              {/* 4. Delivery Zones */}
              <Route
                path="delivery-zones"
                element={
                  <ProtectedRoute requiredPermission="zones:read">
                    <ClusterAnalysis />
                  </ProtectedRoute>
                }
              />
              <Route path="cluster-analysis" element={<Navigate to="/delivery-zones" replace />} />
              <Route path="clusters" element={<Navigate to="/delivery-zones" replace />} />

              {/* 5. Analytics */}
              <Route
                path="analytics"
                element={
                  <ProtectedRoute requiredPermission="analytics:read">
                    <StatisticalAnalytics />
                  </ProtectedRoute>
                }
              />
              <Route path="statistical-analytics" element={<Navigate to="/analytics" replace />} />

              {/* 6. System Status */}
              <Route
                path="system-status"
                element={
                  <ProtectedRoute requiredPermission="system:read">
                    <SystemStatus />
                  </ProtectedRoute>
                }
              />
              <Route path="cloud-management" element={<Navigate to="/system-status" replace />} />
              <Route path="cloud" element={<Navigate to="/system-status" replace />} />

              {/* 7. Reports */}
              <Route path="reports" element={<Reports />} />

              {/* 8. Settings */}
              <Route path="settings" element={<Settings />} />

              {/* Fallback to Dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
