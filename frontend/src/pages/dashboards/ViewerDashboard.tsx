import React, { useState, useEffect } from 'react';
import {
  Search,
  Package,
  FileDown,
  RefreshCw,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
  X,
  Calendar,
  MapPin,
  Plus
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/StateFeedback';
import { myService, reportsService } from '../../services/api';
import type { CustomerParcel } from '../../services/api';
import { useAuth } from '../../app/AuthContext';
import { AddParcelModal } from './AddParcelModal';

export const ViewerDashboard: React.FC = () => {
  const [parcels, setParcels] = useState<CustomerParcel[]>([]);
  const [search, setSearch] = useState<string>('');
  const [selectedParcel, setSelectedParcel] = useState<CustomerParcel | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddParcel, setShowAddParcel] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchParcels = async (searchQuery?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await myService.getMyParcels(searchQuery);
      setParcels(res.parcels || []);
    } catch {
      setError('Could not retrieve your parcel shipments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParcels();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchParcels(search.trim());
  };

  const handleDownloadReport = async () => {
    setIsDownloading(true);
    try {
      await reportsService.downloadMyParcelsPdf();
    } catch {
      setError('Could not download your parcel report.');
    } finally {
      setIsDownloading(false);
    }
  };

  // 3-step progress bar helper:
  // Step 1: Pending (Ordered)
  // Step 2: In Transit (On Route)
  // Step 3: Delivered (Fulfilled)
  const getStepProgress = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'DELIVERED') return 3;
    if (s === 'IN TRANSIT') return 2;
    if (s === 'DELAYED') return 2; // In transit but delayed
    return 1; // Pending
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Track your parcel"
        subtitle="Track the status of your shipments"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddParcel(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
              data-testid="open-add-parcel"
            >
              <Plus className="h-4 w-4" />
              Add parcel
            </button>
            <button
              onClick={handleDownloadReport}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              {isDownloading ? 'Downloading...' : 'Download my parcel report'}
            </button>
            <button
              onClick={() => fetchParcels(search.trim())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload
            </button>
          </div>
        }
      />

      {successMessage && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
          <span className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            {successMessage}
          </span>
          <button onClick={() => setSuccessMessage(null)} aria-label="Dismiss message" className="p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="relative max-w-md">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by tracking number..."
          className="glass-card w-full pl-9 pr-20 py-2 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <button
          type="submit"
          className="absolute right-1.5 top-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Parcels List */}
      {isLoading ? (
        <LoadingState message="Retrieving your shipments..." />
      ) : parcels.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
            <Package className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
            No parcels yet
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Book your first parcel, or parcels sent to your registered email will appear here.
          </p>
          <button
            onClick={() => setShowAddParcel(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add your first parcel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {parcels.map((parcel) => {
            const step = getStepProgress(parcel.status);
            const isDelayed = (parcel.status || '').toUpperCase() === 'DELAYED';

            return (
              <div
                key={parcel.tracking_number}
                onClick={() => setSelectedParcel(parcel)}
                className="glass-card cursor-pointer rounded-2xl p-5 hover:border-brand-500/50 transition-all duration-150 flex flex-col justify-between"
                style={{ borderRadius: '16px' }}
              >
                <div>
                  {/* Top Bar: Tracking number and Status */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {parcel.tracking_number}
                    </span>
                    <StatusBadge status={parcel.status} />
                  </div>

                  {/* 3-Step Progress Bar */}
                  <div className="py-4">
                    <div className="relative flex items-center justify-between">
                      {/* Step 1: Pending */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            step >= 1
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                          }`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                        </div>
                        <span className="mt-1 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                          Pending
                        </span>
                      </div>

                      {/* Connecting Line 1 */}
                      <div
                        className={`h-0.5 flex-1 mx-2 ${
                          step >= 2
                            ? isDelayed
                              ? 'bg-rose-500'
                              : 'bg-brand-600'
                            : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      />

                      {/* Step 2: In Transit */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            step >= 2
                              ? isDelayed
                                ? 'bg-rose-500 text-white'
                                : 'bg-brand-600 text-white'
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                          }`}
                        >
                          {isDelayed ? (
                            <AlertCircle className="h-3.5 w-3.5" />
                          ) : (
                            <Truck className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <span className="mt-1 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                          {isDelayed ? 'Delayed' : 'In Transit'}
                        </span>
                      </div>

                      {/* Connecting Line 2 */}
                      <div
                        className={`h-0.5 flex-1 mx-2 ${
                          step >= 3
                            ? 'bg-emerald-600'
                            : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      />

                      {/* Step 3: Delivered */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            step >= 3
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                          }`}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </div>
                        <span className="mt-1 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                          Delivered
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Route & ETA */}
                  <div className="space-y-1.5 pt-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {parcel.from || 'Origin Hub'} <span className="text-slate-400 font-bold">&rarr;</span> {parcel.to || 'Destination Hub'}
                      </span>
                    </div>

                    {parcel.estimated_delivery_time && (
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>Estimated: {parcel.estimated_delivery_time}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                    View timeline &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Drawer / Modal */}
      {selectedParcel && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => setSelectedParcel(null)}
        >
          <div
            className="glass-float w-full max-w-md rounded-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            style={{ borderRadius: '16px' }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Parcel Details
                </h3>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {selectedParcel.tracking_number}
                </span>
              </div>
              <button
                onClick={() => setSelectedParcel(null)}
                aria-label="Close parcel details modal"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">Current Status</span>
                <StatusBadge status={selectedParcel.status} />
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">Origin</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {selectedParcel.from || 'Origin Hub'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400">Destination</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {selectedParcel.to || 'Destination Hub'}
                </span>
              </div>
              {selectedParcel.estimated_delivery_time && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-400">Estimated Delivery</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedParcel.estimated_delivery_time}
                  </span>
                </div>
              )}
              {selectedParcel.last_updated && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-400">Last Updated</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedParcel.last_updated}
                  </span>
                </div>
              )}
              {selectedParcel.created_date && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-400">Order Placed</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedParcel.created_date}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedParcel(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <AddParcelModal
        open={showAddParcel}
        defaultRecipient={user?.name || ''}
        onClose={() => setShowAddParcel(false)}
        onBooked={(_tracking, message) => {
          setShowAddParcel(false);
          setSuccessMessage(message);
          setSearch('');
          fetchParcels();
        }}
      />
    </div>
  );
};

export default ViewerDashboard;
