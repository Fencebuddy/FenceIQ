import React from 'react';
import { cn } from '@/lib/utils';

/**
 * PageLayout - Presentational wrapper for consistent page surfaces
 * 
 * @param {Object} props
 * @param {'light' | 'dark' | 'customer'} props.variant - Surface style
 * @param {'4xl' | '5xl' | '6xl' | '7xl'} props.maxWidth - Max container width
 * @param {'sm' | 'md' | 'lg'} props.padding - Container padding
 * @param {React.ReactNode} props.children
 * @param {string} props.className - Additional classes
 */
export default function PageLayout({ 
  variant = 'light', 
  maxWidth = '6xl', 
  padding = 'md',
  children,
  className 
}) {
  const baseClasses = 'min-h-screen transition-colors duration-200';
  
  const variantClasses = {
    light: 'bg-slate-50',
    dark: 'bg-slate-900',
    customer: 'bg-gradient-to-br from-blue-100 to-blue-50',
  };

  const maxWidthClasses = {
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
  };

  const paddingClasses = {
    sm: 'px-4 py-4',
    md: 'px-6 py-6',
    lg: 'px-8 py-8',
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      <div className={cn('mx-auto', maxWidthClasses[maxWidth], paddingClasses[padding])}>
        {children}
      </div>
    </div>
  );
}