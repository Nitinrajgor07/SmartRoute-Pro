import React from 'react';
import type { DeliveryStatus, DeliveryPriority } from '../types';

interface StatusBadgeProps {
  status: DeliveryStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getBadgeStyle = (statusStr: string) => {
    switch (statusStr.toLowerCase()) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800';
      case 'in transit':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800';
      case 'delayed':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800';
      case 'operational':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const dotColor = (statusStr: string) => {
    switch (statusStr.toLowerCase()) {
      case 'delivered':
      case 'operational':
        return 'bg-emerald-500';
      case 'in transit':
        return 'bg-blue-500';
      case 'pending':
        return 'bg-amber-500';
      case 'delayed':
        return 'bg-rose-500';
      default:
        return 'bg-slate-400';
    }
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClasses} ${getBadgeStyle(status)}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor(status)}`} />
      {status}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: DeliveryPriority | string }> = ({ priority }) => {
  const getPriorityStyle = (p: string) => {
    switch (p.toLowerCase()) {
      case 'urgent':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-700';
      case 'express':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700';
      default:
        return 'bg-slate-100 text-slate-750 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getPriorityStyle(priority)}`}>
      {priority}
    </span>
  );
};
