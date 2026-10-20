import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface SectionCardProps {
  title?: string;
  icon?: LucideIcon | React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  icon: Icon,
  action,
  children,
  className = '',
  bodyClassName = '',
  noPadding = false,
}) => {
  const hasHeader = !!title || !!action || !!Icon;

  return (
    <section
      className={`glass-card rounded-2xl transition-shadow duration-150 overflow-hidden ${className}`}
      style={{ borderRadius: '16px' }}
    >
      {hasHeader && (
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5 truncate">
            {Icon && (
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              </div>
            )}
            {title && (
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                {title}
              </h2>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      <div className={noPadding ? bodyClassName : `p-5 ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
};

export default SectionCard;
