import React from 'react';
import { cn } from '@/lib/utils';

/**
 * SectionCard - Consistent card component for page sections
 * 
 * @param {Object} props
 * @param {'light' | 'dark' | 'glass'} props.variant - Card style
 * @param {'sm' | 'md' | 'lg'} props.padding - Card padding
 * @param {React.ReactNode} props.children
 * @param {string} props.className - Additional classes
 */
export default function SectionCard({ 
  variant = 'light',
  padding = 'md',
  children,
  className 
}) {
  const baseClasses = 'rounded-xl transition-all duration-200';
  
  const variantClasses = {
    light: 'bg-white border border-slate-200 shadow-sm hover:shadow-md',
    dark: 'bg-slate-800 border border-slate-700 text-slate-100',
    glass: 'bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 text-slate-100',
  };

  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], paddingClasses[padding], className)}>
      {children}
    </div>
  );
}