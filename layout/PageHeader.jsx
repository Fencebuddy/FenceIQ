import React from 'react';
import { cn } from '@/lib/utils';

/**
 * PageHeader - Consistent page header component
 * 
 * @param {Object} props
 * @param {'simple' | 'gradient' | 'letterhead'} props.variant - Header style
 * @param {string} props.title - Main title text
 * @param {string} props.subtitle - Optional subtitle
 * @param {React.ReactNode} props.actionsSlot - Optional action buttons
 * @param {React.ReactNode} props.badgeSlot - Optional badges/status
 * @param {string} props.className - Additional classes
 */
export default function PageHeader({ 
  variant = 'simple',
  title,
  subtitle,
  actionsSlot,
  badgeSlot,
  className 
}) {
  const variantClasses = {
    simple: 'mb-6',
    gradient: 'mb-6 p-6 rounded-xl gradient-header text-white shadow-lg relative overflow-hidden border-b border-white/10',
    letterhead: 'mb-6 pb-4 border-b border-slate-200',
  };

  const titleClasses = variant === 'gradient' 
    ? 'text-3xl font-bold text-white'
    : 'text-3xl font-bold text-slate-900';

  const subtitleClasses = variant === 'gradient'
    ? 'text-sm text-white/90 mt-1'
    : 'text-sm text-slate-600 mt-1';

  return (
    <div className={cn(variantClasses[variant], className)}>
      {variant === 'gradient' && (
        <div className="absolute inset-0 header-aura opacity-70 pointer-events-none" />
      )}
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className={titleClasses}>{title}</h1>
            {badgeSlot && <div className="flex items-center gap-2">{badgeSlot}</div>}
          </div>
          {subtitle && <p className={subtitleClasses}>{subtitle}</p>}
        </div>
        {actionsSlot && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actionsSlot}
          </div>
        )}
      </div>
    </div>
  );
}