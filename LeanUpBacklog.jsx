import React from 'react';
import { Trash2, AlertTriangle, Info } from 'lucide-react';
import { getRemovalCandidates } from '@/components/registry/workflowBlueprintRegistry';

/**
 * LeanUpBacklog: Lists removal candidates with cleanup details
 */
export default function LeanUpBacklog({ registry }) {
  const candidates = getRemovalCandidates(registry);

  if (candidates.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
        <div className="flex justify-center mb-2">
          <div className="text-4xl">✓</div>
        </div>
        <h3 className="font-semibold text-emerald-900 mb-1">No Cleanup Candidates</h3>
        <p className="text-sm text-emerald-700">Your system is clean!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Trash2 className="w-5 h-5 text-amber-600" />
        <h3 className="font-bold text-lg">Lean-Up Backlog</h3>
        <span className="bg-amber-100 text-amber-800 text-sm px-2 py-1 rounded font-medium">
          {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid gap-3">
        {candidates.map(module => {
          const riskColor = {
            LOW: 'text-green-700 bg-green-50 border-green-200',
            MED: 'text-amber-700 bg-amber-50 border-amber-200',
            HIGH: 'text-red-700 bg-red-50 border-red-200'
          }[module.cleanup?.risk || 'LOW'];

          return (
            <div key={module.moduleId} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              {/* Title */}
              <div className="flex items-start gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900">{module.label}</h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{module.moduleId}</p>
                </div>
              </div>

              {/* Why */}
              {module.cleanup?.why && (
                <div className="mb-3 pl-8">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Why:</span> {module.cleanup.why}
                  </p>
                </div>
              )}

              {/* Replace With */}
              {module.cleanup?.replaceWith && (
                <div className="mb-3 pl-8">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Replace with:</span> {module.cleanup.replaceWith}
                  </p>
                </div>
              )}

              {/* Risk Badge */}
              <div className="flex items-center gap-2 pl-8">
                <span className={`text-xs px-2 py-1 rounded font-medium border ${riskColor}`}>
                  Risk: {module.cleanup?.risk || 'LOW'}
                </span>

                {/* File Count */}
                {module.code?.entryPoints?.length > 0 && (
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-medium">
                    {module.code.entryPoints.length} file{module.code.entryPoints.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <div className="flex gap-2">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">How to Use This List</p>
            <ul className="text-xs space-y-1 ml-4">
              <li>• Review each candidate's "why" and "replace with" notes</li>
              <li>• Check risk level before removal (HIGH = affects core workflow)</li>
              <li>• Remove LOW/MED risk items iteratively to improve maintainability</li>
              <li>• Update this registry as modules are removed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}