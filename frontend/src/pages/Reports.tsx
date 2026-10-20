import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Package
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/cards/SectionCard';
import { reportsService } from '../services/api';
import { useAuth } from '../app/AuthContext';
import type { DeliveryReportFilters } from '../types';

export const Reports: React.FC = () => {
  const { role, can } = useAuth();
  const normalizedRole = (role || 'VIEWER').toUpperCase();

  const canOperational = can('reports:operational') || normalizedRole === 'DISPATCHER';
  const canAnalytics = can('reports:analytics') || normalizedRole === 'ADMIN' || normalizedRole === 'DISPATCHER';
  const canSystem = can('reports:system') || normalizedRole === 'ADMIN';
  const canMyParcels = can('reports:my_parcels') || normalizedRole === 'VIEWER';

  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Delivery filter state
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const triggerDownload = async (key: string, downloadFn: () => Promise<void>, reportName: string) => {
    try {
      setDownloading((prev) => ({ ...prev, [key]: true }));
      setFeedback(null);
      await downloadFn();
      setFeedback({
        type: 'success',
        message: `Downloaded: ${reportName}`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: `Failed to download ${reportName}.`,
      });
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
      setTimeout(() => {
        setFeedback((prev) => (prev?.message.includes(reportName) ? null : prev));
      }, 5000);
    }
  };

  const deliveryFilters: DeliveryReportFilters = {
    status: statusFilter,
    priority: priorityFilter,
    search: searchQuery.trim(),
  };

  const btnClass =
    'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-brand-600 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Export operational and analytics reports"
        icon={FileSpreadsheet}
      />

      {feedback && (
        <div
          className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* VIEWER VIEW: My Parcels Report only */}
      {normalizedRole === 'VIEWER' && canMyParcels && (
        <div className="max-w-xl">
          <SectionCard title="My Parcels Report" icon={Package}>
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Download an export of all parcels addressed to your registered account email.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    triggerDownload(
                      'my-parcels-pdf',
                      () => reportsService.downloadMyParcelsPdf(),
                      'My Parcels Report (PDF)'
                    )
                  }
                  disabled={downloading['my-parcels-pdf']}
                  className={`flex-1 ${btnClass}`}
                >
                  {downloading['my-parcels-pdf'] ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={() =>
                    triggerDownload(
                      'my-parcels-csv',
                      () => reportsService.downloadMyParcelsCsv(),
                      'My Parcels Report (CSV)'
                    )
                  }
                  disabled={downloading['my-parcels-csv']}
                  className={`flex-1 ${btnClass}`}
                >
                  {downloading['my-parcels-csv'] ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>Download CSV</span>
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* DISPATCHER & ADMIN VIEWS */}
      {normalizedRole !== 'VIEWER' && (
        <div className="space-y-6">
          {/* Dispatcher Delivery Report Card */}
          {canOperational && (
            <SectionCard title="Delivery Report">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="In Transit">In Transit</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Delayed">Delayed</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Priority
                    </label>
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="Standard">Standard</option>
                      <option value="Express">Express</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Search
                    </label>
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Recipient or tracking #..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 pl-8 pr-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3 flex items-end gap-2">
                    <button
                      onClick={() =>
                        triggerDownload(
                          'deliveries-pdf',
                          () => reportsService.downloadDeliveriesPdf(deliveryFilters),
                          'Delivery Report (PDF)'
                        )
                      }
                      disabled={downloading['deliveries-pdf']}
                      className={`flex-1 ${btnClass}`}
                    >
                      {downloading['deliveries-pdf'] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      <span>Download PDF</span>
                    </button>
                    <button
                      onClick={() =>
                        triggerDownload(
                          'deliveries-csv',
                          () => reportsService.downloadDeliveriesCsv(deliveryFilters),
                          'Delivery Report (CSV)'
                        )
                      }
                      disabled={downloading['deliveries-csv']}
                      className={`flex-1 ${btnClass}`}
                    >
                      {downloading['deliveries-csv'] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Grid of Other Reports */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Route Report: Dispatcher */}
            {canOperational && (
              <SectionCard title="Route Report">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        triggerDownload(
                          'ada-pdf',
                          () => reportsService.downloadAdaPdf(),
                          'Route Report (PDF)'
                        )
                      }
                      disabled={downloading['ada-pdf']}
                      className={`flex-1 ${btnClass}`}
                    >
                      {downloading['ada-pdf'] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      <span>Download PDF</span>
                    </button>
                    <button
                      onClick={() =>
                        triggerDownload(
                          'ada-csv',
                          () => reportsService.downloadAdaCsv(),
                          'Route Report (CSV)'
                        )
                      }
                      disabled={downloading['ada-csv']}
                      className={`flex-1 ${btnClass}`}
                    >
                      {downloading['ada-csv'] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Zones Report: Dispatcher */}
            {canOperational && (
              <SectionCard title="Zones Report">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        triggerDownload(
                          'sda-pdf',
                          () => reportsService.downloadSdaClustersPdf(),
                          'Zones Report (PDF)'
                        )
                      }
                      disabled={downloading['sda-pdf']}
                      className={`flex-1 ${btnClass}`}
                    >
                      {downloading['sda-pdf'] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      <span>Download PDF</span>
                    </button>
                    <button
                      onClick={() =>
                        triggerDownload(
                          'sda-csv',
                          () => reportsService.downloadSdaClustersCsv(),
                          'Zones Report (CSV)'
                        )
                      }
                      disabled={downloading['sda-csv']}
                      className={`flex-1 ${btnClass}`}
                    >
                      {downloading['sda-csv'] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Analytics Report: Admin and Dispatcher */}
            {canAnalytics && (
              <SectionCard title="Analytics Report">
                <div className="space-y-4">
                  <button
                    onClick={() =>
                      triggerDownload(
                        'stats-pdf',
                        () => reportsService.downloadStatisticsPdf(),
                        'Analytics Report (PDF)'
                      )
                    }
                    disabled={downloading['stats-pdf']}
                    className={`w-full ${btnClass}`}
                  >
                    {downloading['stats-pdf'] ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    <span>Download PDF</span>
                  </button>
                </div>
              </SectionCard>
            )}

            {/* System Status Report: Admin only */}
            {canSystem && (
              <SectionCard title="System Status Report">
                <div className="space-y-4">
                  <button
                    onClick={() =>
                      triggerDownload(
                        'cloud-pdf',
                        () => reportsService.downloadCloudPdf(),
                        'System Status Report (PDF)'
                      )
                    }
                    disabled={downloading['cloud-pdf']}
                    className={`w-full ${btnClass}`}
                  >
                    {downloading['cloud-pdf'] ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    <span>Download PDF</span>
                  </button>
                </div>
              </SectionCard>
            )}

            {/* Full Summary Report: Admin only */}
            {canSystem && (
              <SectionCard title="Full Summary Report">
                <div className="space-y-4">
                  <button
                    onClick={() =>
                      triggerDownload(
                        'integrated-pdf',
                        () => reportsService.downloadIntegratedPdf(),
                        'Full Summary Report (PDF)'
                      )
                    }
                    disabled={downloading['integrated-pdf']}
                    className={`w-full ${btnClass}`}
                  >
                    {downloading['integrated-pdf'] ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    <span>Download PDF</span>
                  </button>
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
