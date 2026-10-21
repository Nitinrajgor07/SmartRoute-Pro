import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { KPIStat } from '../types';

interface KPICardProps {
  stat: KPIStat;
  icon: LucideIcon;
  accentColor?: 'blue' | 'indigo' | 'emerald' | 'amber';
}

export const KPICard: React.FC<KPICardProps> = ({
  stat,
  icon: Icon,
  accentColor = 'blue'
}) => {
  const getAccentStyles = () => {
    switch (accentColor) {
      case 'indigo':
        return {
          bg: 'bg-indigo-50 dark:bg-indigo-950/40',
          text: 'text-indigo-600 dark:text-indigo-400',
          border: 'border-indigo-100 dark:border-indigo-900/40',
          bar: 'bg-indigo-500'
        };
      case 'emerald':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40',
          text: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-100 dark:border-emerald-900/40',
          bar: 'bg-emerald-500'
        };
      case 'amber':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/40',
          text: 'text-amber-600 dark:text-amber-400',
          border: 'border-amber-100 dark:border-amber-900/40',
          bar: 'bg-amber-500'
        };
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/40',
          text: 'text-blue-600 dark:text-blue-400',
          border: 'border-blue-100 dark:border-blue-900/40',
          bar: 'bg-blue-500'
        };
    }
  };

  const styles = getAccentStyles();

  return (
    <div className="glass-card relative overflow-hidden rounded-2xl p-5 transition-all duration-200">
      <div className={`absolute top-0 left-0 right-0 h-1 ${styles.bar}`} />
      
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {stat.title}
        </span>
        <div className={`p-2 rounded-xl ${styles.bg} ${styles.text}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {stat.value}
        </span>
        <div className={`flex items-center text-xs font-medium ${stat.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {stat.isPositive ? <TrendingUp className="h-3.5 w-3.5 mr-0.5" /> : <TrendingDown className="h-3.5 w-3.5 mr-0.5" />}
          <span>{stat.change}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{stat.period}</span>
      </div>

      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 line-clamp-1 border-t border-slate-100 dark:border-slate-800 pt-2">
        {stat.description}
      </p>
    </div>
  );
};
