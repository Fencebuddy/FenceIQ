import React from 'react';
import { cn } from '@/lib/utils';

/**
 * TableShell - Consistent table wrapper with theming
 * 
 * @param {Object} props
 * @param {'light' | 'dark'} props.theme - Table theme
 * @param {React.ReactNode} props.header - Table header slot
 * @param {React.ReactNode} props.children - Table body content
 * @param {React.ReactNode} props.emptySlot - Empty state slot
 * @param {boolean} props.isEmpty - Whether table is empty
 * @param {string} props.className - Additional classes
 */
export default function TableShell({ 
  theme = 'light',
  header,
  children,
  emptySlot,
  isEmpty = false,
  className 
}) {
  const themeClasses = {
    light: {
      wrapper: 'bg-white border border-slate-200 rounded-xl overflow-hidden',
      table: 'w-full',
      thead: 'bg-slate-50 border-b border-slate-200',
      th: 'px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider',
      tbody: 'divide-y divide-slate-200',
      tr: 'hover:bg-slate-50 transition-colors',
      td: 'px-6 py-4 text-sm text-slate-900',
    },
    dark: {
      wrapper: 'bg-slate-800 border border-slate-700 rounded-xl overflow-hidden',
      table: 'w-full',
      thead: 'bg-slate-900/50 border-b border-slate-700',
      th: 'px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider',
      tbody: 'divide-y divide-slate-700',
      tr: 'hover:bg-slate-700/30 transition-colors',
      td: 'px-6 py-4 text-sm text-slate-100',
    },
  };

  const classes = themeClasses[theme];

  if (isEmpty && emptySlot) {
    return (
      <div className={cn(classes.wrapper, className)}>
        {emptySlot}
      </div>
    );
  }

  return (
    <div className={cn(classes.wrapper, className)}>
      <table className={classes.table}>
        {header && (
          <thead className={classes.thead}>
            {header}
          </thead>
        )}
        <tbody className={classes.tbody}>
          {children}
        </tbody>
      </table>
    </div>
  );
}

/**
 * TableRow - Consistent table row with theme support
 */
export function TableRow({ theme = 'light', children, className }) {
  const themeClasses = {
    light: 'hover:bg-slate-50 transition-colors',
    dark: 'hover:bg-slate-700/30 transition-colors',
  };

  return (
    <tr className={cn(themeClasses[theme], className)}>
      {children}
    </tr>
  );
}

/**
 * TableCell - Consistent table cell with theme support
 */
export function TableCell({ theme = 'light', children, className }) {
  const themeClasses = {
    light: 'px-6 py-4 text-sm text-slate-900',
    dark: 'px-6 py-4 text-sm text-slate-100',
  };

  return (
    <td className={cn(themeClasses[theme], className)}>
      {children}
    </td>
  );
}