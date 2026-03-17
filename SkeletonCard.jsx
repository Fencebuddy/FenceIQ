import React from 'react';
import { cn } from '@/lib/utils';

export default function SkeletonCard({ className }) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 p-6 animate-pulse', className)}>
      <div className="h-4 bg-slate-200 rounded w-1/4 mb-4"></div>
      <div className="space-y-3">
        <div className="h-3 bg-slate-200 rounded"></div>
        <div className="h-3 bg-slate-200 rounded w-5/6"></div>
        <div className="h-3 bg-slate-200 rounded w-4/6"></div>
      </div>
    </div>
  );
}