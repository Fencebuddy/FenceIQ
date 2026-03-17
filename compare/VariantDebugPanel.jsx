/**
 * Variant Debug Panel
 * Displays raw variant data sources for diagnosis
 * TEMP: Remove once variant coating wiring is verified
 */

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function VariantDebugPanel({ variantKey, job, variantConfig, variantMaterialSet, variantData }) {
  const renderObj = (obj, depth = 0) => {
    if (!obj) return <span className="text-slate-400">null</span>;
    
    const indent = depth * 1.5;
    return (
      <div style={{ marginLeft: `${indent}rem` }} className="font-mono text-[10px] space-y-0">
        {typeof obj === 'object' ? (
          <>
            <span className="text-slate-500">{'{'}</span>
            {Object.entries(obj).slice(0, 15).map(([key, val]) => (
              <div key={key} className="text-slate-600">
                <span className="text-amber-600">{key}</span>
                <span className="text-slate-500">: </span>
                {typeof val === 'object' ? (
                  renderObj(val, depth + 1)
                ) : (
                  <span className={val === null ? 'text-slate-400' : 'text-blue-600'}>
                    {JSON.stringify(val)}
                  </span>
                )}
              </div>
            ))}
            {Object.keys(obj).length > 15 && (
              <div className="text-slate-500">... ({Object.keys(obj).length - 15} more)</div>
            )}
            <span className="text-slate-500">{'}'}</span>
          </>
        ) : (
          <span className="text-blue-600">{JSON.stringify(obj)}</span>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-slate-900 border-slate-700 mt-2">
      <CardContent className="p-2 space-y-1.5">
        <div className="text-xs font-bold text-amber-400 mb-1">
          🔍 VARIANT {variantKey.toUpperCase()} DEBUG (TEMP)
        </div>

        {/* Row 1: Job Defaults */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="bg-slate-800 p-2 rounded border border-slate-700">
            <div className="text-[10px] font-semibold text-slate-300 mb-1">job.materialType</div>
            <div className="text-[10px] text-blue-400">{job?.materialType || 'undefined'}</div>
          </div>
          <div className="bg-slate-800 p-2 rounded border border-slate-700">
            <div className="text-[10px] font-semibold text-slate-300 mb-1">job.chainLinkCoating</div>
            <div className="text-[10px] text-blue-400">{job?.chainLinkCoating || 'undefined'}</div>
          </div>
        </div>

        {/* Row 2: Variant Config */}
        <div className="bg-slate-800 p-2 rounded border border-slate-700">
          <div className="text-[10px] font-semibold text-slate-300 mb-1">variantConfig (from compareVariantsService)</div>
          {variantConfig ? (
            <div className="overflow-x-auto max-h-32 overflow-y-auto">
              {renderObj(variantConfig)}
            </div>
          ) : (
            <div className="text-[10px] text-red-400">❌ MISSING!</div>
          )}
        </div>

        {/* Row 3: Variant Material Set (SHOULD BE USED) */}
        <div className={`bg-slate-800 p-2 rounded border-2 ${variantMaterialSet ? 'border-green-600' : 'border-red-600'}`}>
          <div className="text-[10px] font-semibold mb-1">
            <span className={variantMaterialSet ? 'text-green-400' : 'text-red-400'}>
              {variantMaterialSet ? '✓' : '❌'} variantMaterialSet (PHASE2 SOURCE OF TRUTH)
            </span>
          </div>
          {variantMaterialSet ? (
            <div className="overflow-x-auto max-h-32 overflow-y-auto">
              {renderObj(variantMaterialSet)}
            </div>
          ) : (
            <div className="text-[10px] text-red-400">MISSING - UI WILL FALLBACK TO JOB DEFAULTS!</div>
          )}
        </div>

        {/* Row 4: Variant Data (from compareData) */}
        {variantData && (
          <div className="bg-slate-800 p-2 rounded border border-slate-700">
            <div className="text-[10px] font-semibold text-slate-300 mb-1">variantData.runs[0] (map state)</div>
            <div className="overflow-x-auto max-h-32 overflow-y-auto">
              {variantData.runs?.[0] ? (
                renderObj(variantData.runs[0])
              ) : (
                <span className="text-slate-400">No runs in variant data</span>
              )}
            </div>
          </div>
        )}

        {/* Critical Check */}
        <div className="bg-amber-950 border border-amber-700 p-2 rounded">
          <div className="text-[10px] font-semibold text-amber-200 mb-1">⚠️ CRITICAL CHECK</div>
          <div className="text-[10px] space-y-0.5">
            {variantKey === 'b' && (
              <>
                <div>
                  Variant B Expected Coating:
                  <span className={variantMaterialSet?.coating === 'black_vinyl' ? ' text-green-400' : ' text-red-400'}>
                    {' '}black_vinyl
                  </span>
                </div>
                <div>
                  Actual variantMaterialSet.coating:
                  <span className="text-blue-400"> {variantMaterialSet?.coating || 'undefined'}</span>
                </div>
                <div>
                  Display Value (chainLinkCoating):
                  <span className={variantMaterialSet?.chainLinkCoating === 'Black Vinyl Coated' ? ' text-green-400' : ' text-red-400'}>
                    {' '}{variantMaterialSet?.chainLinkCoating || 'undefined'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}