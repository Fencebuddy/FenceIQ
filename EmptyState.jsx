import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * EmptyState - Consistent empty state component
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Icon component (from lucide-react)
 * @param {string} props.title - Main title
 * @param {string} props.description - Description text
 * @param {React.ReactNode} props.action - Optional CTA button
 * @param {'light' | 'dark'} props.theme - Theme variant
 * @param {string} props.className - Additional classes
 */
export default function EmptyState({ 
  icon: Icon,
  title,
  description,
  action,
  theme = 'light',
  className 
}) {
  const themeClasses = {
    light: {
      wrapper: 'text-slate-600',
      icon: 'text-slate-300',
      title: 'text-slate-900',
      description: 'text-slate-600',
    },
    dark: {
      wrapper: 'text-slate-400',
      icon: 'text-slate-600',
      title: 'text-slate-100',
      description: 'text-slate-400',
    },
  };

  const classes = themeClasses[theme];

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-6 text-center', classes.wrapper, className)}>
      {Icon && (
        <Icon className={cn('w-16 h-16 mb-4', classes.icon)} />
      )}
      <h3 className={cn('text-lg font-semibold mb-2', classes.title)}>
        {title}
      </h3>
      <p className={cn('text-sm max-w-md mb-6', classes.description)}>
        {description}
      </p>
      {action && (
        <div>{action}</div>
      )}
    </div>
  );
}