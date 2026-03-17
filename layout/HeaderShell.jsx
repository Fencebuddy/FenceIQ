import React from 'react';
import { cn } from '@/lib/utils';

/**
 * HeaderShell - Presentational wrapper for blue header enforcement
 * 
 * Wraps any header content in a consistent blue gradient bar.
 * Use this when a page has custom header logic but needs blue styling.
 */
export default function HeaderShell({ children, className }) {
  return (
    <div className={cn(
      "gradient-header text-white shadow-2xl relative overflow-hidden border-b border-white/10",
      className
    )}>
      <div className="absolute inset-0 header-aura opacity-70 pointer-events-none" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}