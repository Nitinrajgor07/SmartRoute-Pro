import React from 'react';

export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  noPadding = false
}) => {
  const hasHeader = title || subtitle || Icon || actions;

  return (
    <section
      className={`glass-card rounded-2xl transition-shadow duration-200 overflow-hidden ${className}`}
    >
      {hasHeader && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 ${headerClassName}`}
        >
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              </div>
            )}
            <div>
              {title && (
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-2 flex-wrap">
              {actions}
            </div>
          )}
        </div>
      )}

      <div className={noPadding ? bodyClassName : `p-5 sm:p-6 ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
};

export default SectionCard;
