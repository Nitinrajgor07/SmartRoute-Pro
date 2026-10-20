import React from 'react';

export const SkeletonBox: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return (
    <div className={`animate-pulse bg-slate-200/70 dark:bg-slate-800/80 rounded-lg ${className}`} />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-4 w-24" />
        <SkeletonBox className="h-9 w-9 rounded-xl" />
      </div>
      <SkeletonBox className="h-8 w-32" />
      <SkeletonBox className="h-3 w-40" />
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="glass-card rounded-2xl overflow-hidden p-4 space-y-3">
      <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
        <SkeletonBox className="h-5 w-36" />
        <SkeletonBox className="h-8 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <SkeletonBox className="h-4 w-16" />
          <SkeletonBox className="h-4 w-32 flex-1" />
          <SkeletonBox className="h-4 w-20" />
          <SkeletonBox className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
};
