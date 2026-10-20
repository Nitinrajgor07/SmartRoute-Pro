import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'blue',
  className = '',
}) => {
  const getAccent = () => {
    switch (accent) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400';
      case 'amber':
        return 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400';
      case 'rose':
        return 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400';
      case 'indigo':
        return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400';
      case 'slate':
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
      default:
        return 'bg-blue-50 text-brand-600 dark:bg-blue-950/40 dark:text-brand-400';
    }
  };

  return (
    <div
      className={`glass-card rounded-2xl p-5 transition-shadow duration-150 flex flex-col justify-between ${className}`}
      style={{ borderRadius: '16px' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
          {label}
        </span>
        {Icon && (
          <div className={`p-2 rounded-xl shrink-0 ${getAccent()}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
          {value}
        </div>
        {hint && (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
