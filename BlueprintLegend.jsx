import React from 'react';
import { CheckCircle, AlertCircle, Lock, Zap } from 'lucide-react';

/**
 * BlueprintLegend: Status + usage badges explanation
 */
export default function BlueprintLegend() {
  return (
    <div className="bg-slate-50 border rounded-lg p-4 space-y-4">
      <h3 className="font-bold text-sm">Legend</h3>

      {/* State Badges */}
      <div>
        <p className="text-xs font-semibold text-slate-700 mb-2">Module State</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded font-medium bg-emerald-100 text-emerald-800">CORE</span>
            <span className="text-xs text-slate-600">Required for current workflow</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded font-medium bg-blue-100 text-blue-800">OPTIONAL</span>
            <span className="text-xs text-slate-600">Feature that can be enabled/disabled</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded font-medium bg-slate-100 text-slate-600">LEGACY</span>
            <span className="text-xs text-slate-600">Deprecated; candidate for removal</span>
          </div>
        </div>
      </div>

      {/* Usage Badges */}
      <div className="border-t pt-4">
        <p className="text-xs font-semibold text-slate-700 mb-2">Usage Status</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-xs px-2 py-1 rounded font-medium bg-green-100 text-green-800">USED</span>
            <span className="text-xs text-slate-600">Referenced in current system</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-xs px-2 py-1 rounded font-medium bg-amber-100 text-amber-800">UNUSED</span>
            <span className="text-xs text-slate-600">Not referenced; candidate for removal</span>
          </div>
        </div>
      </div>

      {/* Visual Indicators */}
      <div className="border-t pt-4">
        <p className="text-xs font-semibold text-slate-700 mb-2">Visual Indicators</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-2 border-slate-300 rounded opacity-100" />
            <span className="text-xs text-slate-600">Used (full opacity)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-2 border-slate-300 rounded opacity-50" />
            <span className="text-xs text-slate-600">Unused (faded)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-2 border-dashed border-slate-300 rounded" />
            <span className="text-xs text-slate-600">Legacy (dashed border)</span>
          </div>
        </div>
      </div>
    </div>
  );
}