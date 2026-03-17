import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

/**
 * PRO MODE TOGGLE
 * Toggle between Classic and Pro mapping modes
 */
export default function ProModeToggle({ isProMode, onToggle, proModeAvailable }) {
  if (!proModeAvailable) return null;

  return (
    <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg border border-slate-200 p-1 flex gap-1">
      <Button
        variant={!isProMode ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onToggle(false)}
        className={!isProMode ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
      >
        Classic Mode
      </Button>
      <Button
        variant={isProMode ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onToggle(true)}
        className={isProMode ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
      >
        <Sparkles className="w-4 h-4 mr-1" />
        Pro Mode
      </Button>
    </div>
  );
}