import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Search,
  Plus,
  X,
  CheckCircle2,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Clock,
  PackageCheck,
  AlertTriangle,
  User,
  Route
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { EmptyState, LoadingState, ErrorState } from '../components/StateFeedback';
import { PrimaryButton } from '../components/Buttons';
import { deliveriesService, locationsService, dashboardService } from '../services/api';
import { useAuth } from '../app/AuthContext';
import type { Delivery, DeliveryPriority, DeliveryStatus, LocationItem, DashboardSummaryResponse } from '../types';

export const Deliveries: React.FC = () => {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canDispatch = can('deliveries:write');

  // Deliveries, Metrics & Locations State
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter, Search, Sort & Pagination State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('created_desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [perPage, setPerPage] = useState<number>(8);

  // Modals & Active Delivery State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    pickup_location_id: 0,
    destination_location_id: 0,
    priority: 'Standard' as DeliveryPriority,
    status: 'Pending' as DeliveryStatus,
    package_weight_kg: 5.0,
    estimated_delivery_time: '02:00 PM',
    assigned_driver: 'Marcus Vance (Van 04)',
    delivery_date: new Date().toISOString().substring(0, 10)
  });
  const [formValidationErrors, setFormValidationErrors] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Fetch Locations for dropdown selectors
  const loadLocations = async () => {
    try {
      const data = await locationsService.getLocations();
      setLocations(data.locations || []);
      if (data.locations && data.locations.length >= 2 && formData.pickup_location_id === 0) {
        setFormData((prev) => ({
          ...prev,
          pickup_location_id: data.locations[0].id,
          destination_location_id: data.locations[1].id
        }));
      }
    } catch (err: any) {
      console.error('Failed to load locations', err);
    }
  };

  // Fetch Live Database KPI Metrics
  const loadMetrics = async () => {
    try {
      const data = await dashboardService.getSummary();
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load dashboard metrics', err);
    }
  };

  // Fetch Deliveries from REST API
  const loadDeliveries = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await deliveriesService.getDeliveries({
        page: currentPage,
        per_page: perPage,
        status: statusFilter,
        priority: priorityFilter,
        search: searchQuery
      });
      setDeliveries(data.deliveries || []);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.total || 0);
    } catch (err: any) {
      setFetchError(
        err.response?.data?.message || err.message || 'Failed to fetch deliveries from database.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, perPage, statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    loadLocations();
    loadMetrics();
  }, []);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  // Refresh All Data
  const handleRefresh = async () => {
    await Promise.all([loadDeliveries(), loadMetrics()]);
    showNotification('Delivery records and operational metrics refreshed.');
  };

  // Handle Search Input Change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  // Client-side Sort of Currently Displayed Deliveries
  const sortedDeliveries = useMemo(() => {
    const list = [...deliveries];
    switch (sortBy) {
      case 'created_asc':
        return list.sort((a, b) => (a.created_at || a.createdAt || '').localeCompare(b.created_at || b.createdAt || ''));
      case 'customer_asc':
        return list.sort((a, b) => (a.customer_name || a.recipientName || '').localeCompare(b.customer_name || b.recipientName || ''));
      case 'distance_desc':
        return list.sort((a, b) => (b.distance_km || b.distanceKm || 0) - (a.distance_km || a.distanceKm || 0));
      case 'weight_desc':
        return list.sort((a, b) => (b.package_weight_kg || b.packageWeightKg || 0) - (a.package_weight_kg || a.packageWeightKg || 0));
      case 'created_desc':
      default:
        return list; // Server returns created_at desc by default
    }
  }, [deliveries, sortBy]);

  // Open Create Delivery Modal
  const openCreateModal = () => {
    setFormValidationErrors([]);
    setFormData({
      customer_name: '',
      customer_email: '',
      pickup_location_id: locations[0]?.id || 1,
      destination_location_id: locations[1]?.id || 2,
      priority: 'Standard',
      status: 'Pending',
      package_weight_kg: 5.0,
      estimated_delivery_time: '02:00 PM',
      assigned_driver: 'Marcus Vance (Van 04)',
      delivery_date: new Date().toISOString().substring(0, 10)
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (del: Delivery) => {
    setSelectedDelivery(del);
    setFormValidationErrors([]);
    setFormData({
      customer_name: del.customer_name || del.recipientName || '',
      customer_email: del.customer_email || del.customerEmail || '',
      pickup_location_id: del.pickup_location_id || del.pickup_location?.id || locations[0]?.id || 1,
      destination_location_id: del.destination_location_id || del.destination_location?.id || locations[1]?.id || 2,
      priority: del.priority,
      status: del.status,
      package_weight_kg: del.package_weight_kg || del.packageWeightKg || 1.0,
      estimated_delivery_time: del.estimated_delivery_time || del.estimatedDeliveryTime || '02:00 PM',
      assigned_driver: del.assigned_driver || del.assignedDriver || '',
      delivery_date: del.delivery_date || del.deliveryDate || new Date().toISOString().substring(0, 10)
    });
    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const openDeleteModal = (del: Delivery) => {
    setSelectedDelivery(del);
    setIsDeleteModalOpen(true);
  };

  // Open Details Modal
  const openDetailsModal = (del: Delivery) => {
    setSelectedDelivery(del);
    setIsDetailsModalOpen(true);
  };

  // Submit Create Delivery
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    if (!formData.customer_name.trim()) errors.push('Customer / Recipient Name is required.');
    if (formData.customer_email && formData.customer_email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.customer_email.trim())) {
        errors.push('Customer Email must be a valid email address.');
      }
    }
    if (formData.pickup_location_id === formData.destination_location_id) {
      errors.push('Pickup and destination hubs cannot be the same location.');
    }
    if (formData.package_weight_kg <= 0) {
      errors.push('Package weight must be greater than 0 kg.');
    }

    if (errors.length > 0) {
      setFormValidationErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const res = await deliveriesService.createDelivery({
        customer_name: formData.customer_name.trim(),
        customer_email: formData.customer_email.trim() ? formData.customer_email.trim().toLowerCase() : undefined,
        pickup_location_id: Number(formData.pickup_location_id),
        destination_location_id: Number(formData.destination_location_id),
        priority: formData.priority,
        status: formData.status,
        package_weight_kg: Number(formData.package_weight_kg),
        estimated_delivery_time: formData.estimated_delivery_time,
        assigned_driver: formData.assigned_driver,
        delivery_date: formData.delivery_date
      });

      setIsAddModalOpen(false);
      showNotification(`Delivery #${res.delivery.tracking_number} created successfully.`);
      await Promise.all([loadDeliveries(), loadMetrics()]);
    } catch (err: any) {
      const msg = err.response?.data?.details?.join(', ') || err.response?.data?.message || err.message;
      setFormValidationErrors([msg]);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Edit Delivery
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDelivery) return;

    const errors: string[] = [];
    if (formData.customer_email && formData.customer_email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.customer_email.trim())) {
        errors.push('Customer Email must be a valid email address.');
      }
    }
    if (formData.pickup_location_id === formData.destination_location_id) {
      errors.push('Pickup and destination hubs cannot be identical.');
    }
    if (formData.package_weight_kg <= 0) {
      errors.push('Package weight must be greater than 0 kg.');
    }

    if (errors.length > 0) {
      setFormValidationErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const res = await deliveriesService.updateDelivery(selectedDelivery.id, {
        customer_name: formData.customer_name.trim(),
        customer_email: formData.customer_email.trim() ? formData.customer_email.trim().toLowerCase() : null,
        pickup_location_id: Number(formData.pickup_location_id),
        destination_location_id: Number(formData.destination_location_id),
        priority: formData.priority,
        status: formData.status,
        package_weight_kg: Number(formData.package_weight_kg),
        estimated_delivery_time: formData.estimated_delivery_time,
        assigned_driver: formData.assigned_driver
      });

      setIsEditModalOpen(false);
      showNotification(`Delivery #${res.delivery.tracking_number} updated successfully.`);
      await Promise.all([loadDeliveries(), loadMetrics()]);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      setFormValidationErrors([msg]);
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!selectedDelivery) return;
    setIsSaving(true);
    try {
      await deliveriesService.deleteDelivery(selectedDelivery.id);
      setIsDeleteModalOpen(false);
      showNotification(
        `Delivery #${selectedDelivery.trackingNumber || selectedDelivery.tracking_number} permanently removed.`
      );
      await Promise.all([loadDeliveries(), loadMetrics()]);
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Failed to delete delivery order', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Status Transition (Authorized Only)
  const handleQuickStatusChange = async (del: Delivery, nextStatus: DeliveryStatus) => {
    try {
      await deliveriesService.updateDelivery(del.id, { status: nextStatus });
      showNotification(
        `Delivery #${del.trackingNumber || del.tracking_number} advanced to ${nextStatus}.`
      );
      if (selectedDelivery && selectedDelivery.id === del.id) {
        setSelectedDelivery((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
      await Promise.all([loadDeliveries(), loadMetrics()]);
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Status transition failed', 'error');
    }
  };

  // KPI Metrics (Real Database Values)
  const kpiTotal = summary?.metrics?.total_deliveries ?? totalCount;
  const kpiPending = summary?.metrics?.pending_deliveries ?? 0;
  const kpiInTransit = summary?.metrics?.in_transit_deliveries ?? 0;
  const kpiCompleted = summary?.metrics?.completed_deliveries ?? 0;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* 1. STANDARDIZED PAGE HEADER                                         */}
      {/* ------------------------------------------------------------------ */}
      <PageHeader
        title="Delivery Management"
        subtitle="Manage delivery records and monitor their progress"
        icon={Truck}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh records from database"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-brand-600' : ''}`} />
              <span className="hidden sm:inline">Refresh Deliveries</span>
            </button>

            {canDispatch && (
              <PrimaryButton
                size="sm"
                icon={Plus}
                onClick={openCreateModal}
              >
                Add Delivery
              </PrimaryButton>
            )}
          </div>
        }
      />

      {/* Global Toast / Feedback Alert */}
      {notification && (
        <div
          className={`flex items-center gap-2 p-3.5 rounded-xl border text-xs font-medium shadow-sm transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. REAL DATABASE KPI CARDS (4 Essential Counts)                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Deliveries */}
        <div className="glass-card rounded-2xl p-5 transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Deliveries
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <PackageCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {isLoading && !summary ? '...' : kpiTotal}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            All deliveries
          </p>
        </div>

        {/* Card 2: Pending Deliveries */}
        <div className="glass-card rounded-2xl p-5 transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pending Deliveries
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
              {isLoading && !summary ? '...' : kpiPending}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            Awaiting dispatch
          </p>
        </div>

        {/* Card 3: In-Transit Deliveries */}
        <div className="glass-card rounded-2xl p-5 transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              In-Transit Deliveries
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Truck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400">
              {isLoading && !summary ? '...' : kpiInTransit}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            In transit to destination
          </p>
        </div>

        {/* Card 4: Completed Deliveries */}
        <div className="glass-card rounded-2xl p-5 transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Completed Deliveries
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
              {isLoading && !summary ? '...' : kpiCompleted}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            Successfully delivered
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. SEARCH, FILTERS & SORT CONTROLS                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
          {/* Search Bar */}
          <div className="sm:col-span-5 relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by Tracking ID, customer, address..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Transit">In Transit</option>
              <option value="Delivered">Delivered</option>
              <option value="Delayed">Delayed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="sm:col-span-2">
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="Standard">Standard</option>
              <option value="Express">Express</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="sm:col-span-3">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none cursor-pointer"
              >
                <option value="created_desc">Sort: Newest First</option>
                <option value="created_asc">Sort: Oldest First</option>
                <option value="customer_asc">Sort: Customer (A-Z)</option>
                <option value="distance_desc">Sort: Distance (High to Low)</option>
                <option value="weight_desc">Sort: Weight (High to Low)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filters Summary Strip */}
        {(statusFilter !== 'ALL' || priorityFilter !== 'ALL' || searchQuery) && (
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Active Filters:</span>
              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Status: {statusFilter}
                  <button onClick={() => setStatusFilter('ALL')} className="hover:text-blue-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {priorityFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Priority: {priorityFilter}
                  <button onClick={() => setPriorityFilter('ALL')} className="hover:text-purple-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-slate-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              onClick={() => {
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 font-semibold cursor-pointer underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. DELIVERIES DATA TABLE                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {isLoading ? (
          <LoadingState message="Connecting to database & loading delivery records..." />
        ) : fetchError ? (
          <ErrorState
            title="Unable to load deliveries"
            message={fetchError}
            onRetry={loadDeliveries}
          />
        ) : sortedDeliveries.length === 0 ? (
          <EmptyState
            title="No delivery records found"
            message={
              searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                ? 'No orders match your active filter criteria. Try adjusting your search query or reset filters.'
                : 'No delivery records are currently stored in the database.'
            }
            actionText={
              searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                ? 'Clear Filters'
                : canDispatch
                ? 'Add Delivery'
                : undefined
            }
            onAction={() => {
              if (searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL') {
                setSearchQuery('');
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setCurrentPage(1);
              } else if (canDispatch) {
                openCreateModal();
              }
            }}
          />
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Tracking Code</th>
                    <th className="py-3.5 px-4">Recipient & Destination</th>
                    <th className="py-3.5 px-4 hidden md:table-cell">Hub Route</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4 hidden sm:table-cell">Metrics</th>
                    <th className="py-3.5 px-4 hidden lg:table-cell">Carrier</th>
                    <th className="py-3.5 px-4 text-right w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedDeliveries.map((del) => {
                    const trackingId = del.trackingNumber || del.tracking_number || `TRK-${del.id}`;
                    const recipient = del.customer_name || del.recipientName || 'Unknown Recipient';
                    const address = del.destinationAddress || del.destination_location?.address || 'Waypoint Destination';
                    const pickupName = del.pickup_location?.name || `Hub #${del.pickup_location_id}`;
                    const destName = del.destination_location?.name || `Waypoint #${del.destination_location_id}`;
                    const distance = del.distance_km ?? del.distanceKm ?? 0;
                    const weightVal = del.package_weight_kg ?? del.packageWeightKg ?? 1.0;
                    const driver = del.assigned_driver || del.assignedDriver || 'Unassigned';

                    return (
                      <tr
                        key={del.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Tracking Code */}
                        <td className="py-3 px-4 font-mono font-medium text-brand-600 dark:text-brand-400 whitespace-nowrap">
                          <button
                            onClick={() => openDetailsModal(del)}
                            className="hover:underline font-bold text-left cursor-pointer"
                          >
                            {trackingId}
                          </button>
                          <span className="block text-[10px] text-slate-400 font-sans mt-0.5">
                            {del.createdAt || del.created_at?.substring(0, 10) || 'Database record'}
                          </span>
                        </td>

                        {/* Customer & Destination Address */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {recipient}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate">{address}</span>
                          </div>
                        </td>

                        {/* Route Segment (Hubs) - Stacked 2 lines with tooltip */}
                        <td className="py-3 px-4 hidden md:table-cell max-w-[200px]" title={`From: ${pickupName}\nTo: ${destName}`}>
                          <div className="text-[11px] space-y-0.5">
                            <div className="truncate text-slate-700 dark:text-slate-300">
                              <span className="text-[10px] font-semibold text-slate-400 mr-1">From:</span>
                              <span className="font-medium" title={pickupName}>{pickupName}</span>
                            </div>
                            <div className="truncate text-slate-700 dark:text-slate-300">
                              <span className="text-[10px] font-semibold text-slate-400 mr-1">To:</span>
                              <span className="font-medium" title={destName}>{destName}</span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={del.status} size="sm" />
                            {canDispatch && del.status === 'Pending' && (
                              <button
                                onClick={() => handleQuickStatusChange(del, 'In Transit')}
                                title="Dispatch consignment to road transit"
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
                              >
                                Dispatch
                              </button>
                            )}
                            {canDispatch && del.status === 'In Transit' && (
                              <button
                                onClick={() => handleQuickStatusChange(del, 'Delivered')}
                                title="Mark consignment as delivered"
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                              >
                                Mark delivered
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Priority */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <PriorityBadge priority={del.priority} />
                        </td>

                        {/* Metrics (Weight & Distance) */}
                        <td className="py-3 px-4 hidden sm:table-cell whitespace-nowrap">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {distance > 0 ? `${distance} km` : 'Pending calc'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {weightVal} kg consignment
                          </div>
                        </td>

                        {/* Carrier / Driver */}
                        <td className="py-3 px-4 hidden lg:table-cell whitespace-nowrap text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate max-w-[130px]">{driver}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap w-36">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* 1. View Details */}
                            <button
                              onClick={() => openDetailsModal(del)}
                              title="View consignment details and progress"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* 2. Route Optimization Shortcut */}
                            <button
                              onClick={() => navigate(`/route-planner?source=${del.pickup_location_id}&destination=${del.destination_location_id}`)}
                              title="Calculate shortest route for this consignment"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                            >
                              <Route className="h-3.5 w-3.5" />
                            </button>

                            {/* 3. Authorized Operations (Admin & Dispatcher only) */}
                            {canDispatch && (
                              <>
                                {/* Edit Button */}
                                <button
                                  onClick={() => openEditModal(del)}
                                  title="Edit delivery attributes"
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>

                                {/* Delete Button */}
                                <button
                                  onClick={() => openDeleteModal(del)}
                                  title="Delete consignment order"
                                  className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination & Rows-Per-Page Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-200/90 dark:border-slate-800 text-xs bg-slate-50/50 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <span>
                  Showing <strong className="text-slate-900 dark:text-white">{sortedDeliveries.length}</strong> of{' '}
                  <strong className="text-slate-900 dark:text-white">{totalCount}</strong> total deliveries
                </span>
                <span className="hidden sm:inline">·</span>
                <div className="hidden sm:flex items-center gap-1.5">
                  <span>Per page:</span>
                  <select
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="px-3 py-1 font-medium text-slate-700 dark:text-slate-300">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. VIEW DELIVERY DETAILS MODAL                                      */}
      {/* ------------------------------------------------------------------ */}
      {isDetailsModalOpen && selectedDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-float w-full max-w-xl rounded-2xl p-6 my-8 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Delivery Details
                    </h3>
                    <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
                      #{selectedDelivery.trackingNumber || selectedDelivery.tracking_number}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Order ID: {selectedDelivery.id} · Database Consignment Record
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Delivery Progress Bar (Real Database Status - No Fake GPS) */}
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Fulfillment Stage
              </span>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {/* Step 1: Pending */}
                <div
                  className={`p-2.5 rounded-xl border transition-all ${
                    selectedDelivery.status === 'Pending'
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-[11px]">1. Queued</span>
                  </div>
                  <span className="text-[10px] block font-normal">Pending Dispatch</span>
                </div>

                {/* Step 2: In Transit */}
                <div
                  className={`p-2.5 rounded-xl border transition-all ${
                    selectedDelivery.status === 'In Transit'
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300 font-bold'
                      : selectedDelivery.status === 'Delivered'
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Truck className="h-3.5 w-3.5" />
                    <span className="text-[11px]">2. Road Transit</span>
                  </div>
                  <span className="text-[10px] block font-normal">In Transit</span>
                </div>

                {/* Step 3: Delivered */}
                <div
                  className={`p-2.5 rounded-xl border transition-all ${
                    selectedDelivery.status === 'Delivered'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-[11px]">3. Fulfilled</span>
                  </div>
                  <span className="text-[10px] block font-normal">Delivered</span>
                </div>
              </div>
            </div>

            {/* Consignment Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Customer / Recipient */}
              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/30">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Recipient Organization
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-sm block">
                  {selectedDelivery.customer_name || selectedDelivery.recipientName}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Scheduled: {selectedDelivery.delivery_date || selectedDelivery.deliveryDate || 'Standard Window'}
                </span>
              </div>

              {/* Status & Priority */}
              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/30">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Order Status & Priority
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={selectedDelivery.status} size="sm" />
                  <PriorityBadge priority={selectedDelivery.priority} />
                </div>
              </div>

              {/* Source Hub */}
              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/30">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Origin Hub (Source)
                </span>
                <span className="font-semibold text-slate-900 dark:text-white block">
                  {selectedDelivery.pickup_location?.name || `Hub #${selectedDelivery.pickup_location_id}`}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {selectedDelivery.pickup_location?.address || 'Primary Logistics Depot'}
                </span>
              </div>

              {/* Destination Hub */}
              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/30">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Destination Waypoint
                </span>
                <span className="font-semibold text-slate-900 dark:text-white block">
                  {selectedDelivery.destination_location?.name || `Waypoint #${selectedDelivery.destination_location_id}`}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {selectedDelivery.destinationAddress || selectedDelivery.destination_location?.address || 'Designated recipient address'}
                </span>
              </div>

              {/* Package Specs */}
              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/30">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Consignment Specifications
                </span>
                <div className="space-y-1 text-slate-700 dark:text-slate-300">
                  <div>Weight: <strong>{selectedDelivery.package_weight_kg || selectedDelivery.packageWeightKg || 1.0} kg</strong></div>
                  <div>Road Distance: <strong>{selectedDelivery.distance_km || selectedDelivery.distanceKm || 0} km</strong></div>
                </div>
              </div>

              {/* Assigned Carrier */}
              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/30">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Logistics Carrier Assignment
                </span>
                <div className="space-y-1 text-slate-700 dark:text-slate-300">
                  <div>Driver: <strong>{selectedDelivery.assigned_driver || selectedDelivery.assignedDriver || 'Unassigned'}</strong></div>
                  <div>ETA: <strong>{selectedDelivery.estimated_delivery_time || selectedDelivery.estimatedDeliveryTime || '02:00 PM'}</strong></div>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <span>Created: {selectedDelivery.created_at || selectedDelivery.createdAt || 'N/A'}</span>
              <span>Last Modified: {selectedDelivery.updated_at || 'N/A'}</span>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {canDispatch && selectedDelivery.status === 'Pending' && (
                  <button
                    onClick={() => handleQuickStatusChange(selectedDelivery, 'In Transit')}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Dispatch Consignment
                  </button>
                )}
                {canDispatch && selectedDelivery.status === 'In Transit' && (
                  <button
                    onClick={() => handleQuickStatusChange(selectedDelivery, 'Delivered')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Confirm Delivery
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {canDispatch && (
                  <button
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      openEditModal(selectedDelivery);
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
                  >
                    Edit Order
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    navigate(`/route-planner?source=${selectedDelivery.pickup_location_id}&destination=${selectedDelivery.destination_location_id}`);
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Route className="h-3.5 w-3.5" />
                  <span>Optimize Route</span>
                </button>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 7. CREATE DELIVERY MODAL (Authorized Only)                         */}
      {/* ------------------------------------------------------------------ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-float w-full max-w-lg rounded-2xl p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Add New Consignment Delivery
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Creates order record in database with automated distance calculation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formValidationErrors.length > 0 && (
              <div className="my-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
                <ul className="list-disc pl-4 space-y-1">
                  {formValidationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs mt-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Customer / Recipient Organization <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Biotech Laboratories"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Email (optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as DeliveryStatus })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Delayed">Delayed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as DeliveryPriority })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Express">Express</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Source & Destination Locations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pickup Location (Depot Hub) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.pickup_location_id}
                    onChange={(e) => setFormData({ ...formData, pickup_location_id: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Destination Waypoint <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.destination_location_id}
                    onChange={(e) => setFormData({ ...formData, destination_location_id: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Weight & ETA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Package Weight (kg) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={formData.package_weight_kg}
                    onChange={(e) => setFormData({ ...formData, package_weight_kg: parseFloat(e.target.value) || 1.0 })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Estimated Time (ETA)
                  </label>
                  <input
                    type="text"
                    value={formData.estimated_delivery_time}
                    onChange={(e) => setFormData({ ...formData, estimated_delivery_time: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Driver & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Driver
                  </label>
                  <input
                    type="text"
                    value={formData.assigned_driver}
                    onChange={(e) => setFormData({ ...formData, assigned_driver: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold shadow-md shadow-brand-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Saving to Database...' : 'Save Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 8. EDIT DELIVERY MODAL (Authorized Only)                           */}
      {/* ------------------------------------------------------------------ */}
      {isEditModalOpen && selectedDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-float w-full max-w-lg rounded-2xl p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <Edit2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Edit Delivery #{selectedDelivery.trackingNumber || selectedDelivery.tracking_number}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Update consignment attributes and transit status
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formValidationErrors.length > 0 && (
              <div className="my-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
                <ul className="list-disc pl-4 space-y-1">
                  {formValidationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs mt-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Customer / Recipient Organization
                </label>
                <input
                  type="text"
                  required
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Email (optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Transit Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as DeliveryStatus })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Delayed">Delayed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as DeliveryPriority })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Express">Express</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Locations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pickup Location
                  </label>
                  <select
                    value={formData.pickup_location_id}
                    onChange={(e) => setFormData({ ...formData, pickup_location_id: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Destination Waypoint
                  </label>
                  <select
                    value={formData.destination_location_id}
                    onChange={(e) => setFormData({ ...formData, destination_location_id: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none cursor-pointer"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Weight & ETA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Package Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.package_weight_kg}
                    onChange={(e) => setFormData({ ...formData, package_weight_kg: parseFloat(e.target.value) || 1.0 })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Estimated Time (ETA)
                  </label>
                  <input
                    type="text"
                    value={formData.estimated_delivery_time}
                    onChange={(e) => setFormData({ ...formData, estimated_delivery_time: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Driver
                </label>
                <input
                  type="text"
                  value={formData.assigned_driver}
                  onChange={(e) => setFormData({ ...formData, assigned_driver: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-md shadow-brand-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 9. DELETE CONFIRMATION DIALOG (Authorized Only)                    */}
      {/* ------------------------------------------------------------------ */}
      {isDeleteModalOpen && selectedDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="glass-float w-full max-w-md rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Permanent Deletion
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Database Referential Integrity Action
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete consignment order{' '}
              <strong className="font-mono text-brand-600 dark:text-brand-400">
                #{selectedDelivery.trackingNumber || selectedDelivery.tracking_number}
              </strong>{' '}
              for{' '}
              <strong className="text-slate-900 dark:text-white">
                {selectedDelivery.customer_name || selectedDelivery.recipientName}
              </strong>?
            </p>
            <p className="text-[11px] text-slate-400 mt-2">
              This record will be permanently deleted from the relational database table.
            </p>

            <div className="pt-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-md shadow-rose-500/20 transition-colors disabled:opacity-50 text-xs cursor-pointer"
              >
                {isSaving ? 'Deleting...' : 'Delete Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Deliveries;
