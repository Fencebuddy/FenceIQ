import React from 'react';
import { cn } from '@/lib/utils';

export default function SkeletonTable({ rows = 5, columns = 4, theme = 'light', className }) {
  const themeClasses = theme === 'dark' 
    ? 'bg-slate-800 border-slate-700'
    : 'bg-white border-slate-200';

  return (
    <div className={cn('rounded-xl border overflow-hidden animate-pulse', themeClasses, className)}>
      {/* Header */}
      <div className={cn('grid gap-4 p-4 border-b', theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className={cn('h-3 rounded', theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300')} style={{ width: i === 0 ? '60%' : '80%' }}></div>
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className={cn('grid gap-4 p-4 border-b last:border-b-0', theme === 'dark' ? 'border-slate-700' : 'border-slate-200')} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className={cn('h-3 rounded', theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200')} style={{ width: colIndex === 0 ? '70%' : '90%' }}></div>
          ))}
        </div>
      ))}
    </div>
  );
}