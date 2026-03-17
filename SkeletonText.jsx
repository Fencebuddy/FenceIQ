import React from 'react';
import { cn } from '@/lib/utils';

export default function SkeletonText({ lines = 3, theme = 'light', className }) {
  const bgClass = theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200';

  return (
    <div className={cn('space-y-2 animate-pulse', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i} 
          className={cn('h-3 rounded', bgClass)} 
          style={{ width: i === lines - 1 ? '70%' : '100%' }}
        ></div>
      ))}
    </div>
  );
}