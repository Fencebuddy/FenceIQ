import React from 'react';
import { cn } from '@/lib/utils';

export default function SkeletonMetric({ theme = 'light', className }) {
  const themeClasses = theme === 'dark'
    ? 'bg-slate-800 border-slate-700'
    : 'bg-white border-slate-200';

  return (
    <div className={cn('rounded-xl border p-6 animate-pulse', themeClasses, className)}>
      <div className={cn('h-3 rounded w-1/3 mb-4', theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200')}></div>
      <div className={cn('h-8 rounded w-2/3 mb-2', theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200')}></div>
      <div className={cn('h-2 rounded w-1/4', theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200')}></div>
    </div>
  );
}