import React, { useState } from 'react';
import { ArrowRight, Zap, Lock, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * WorkflowCanvas: Renders the workflow as a horizontal flowchart
 * Each node shows module info + usage badges
 */
export default function WorkflowCanvas({ registry, selectedModule, onSelectModule, filterView }) {
  const visibleNodes = filterView === 'used'
    ? registry.workflow.filter(nodeId => {
        const module = registry.modules[nodeId];
        return module?.usage?.isUsed;
      })
    : filterView === 'removal'
    ? registry.workflow.filter(nodeId => {
        const module = registry.modules[nodeId];
        return module?.cleanup?.recommendation === 'REMOVE_CANDIDATE';
      })
    : registry.workflow;

  // Filter connections to only show visible nodes
  const visibleConnections = registry.connections.filter(conn => {
    return visibleNodes.includes(conn.from) && visibleNodes.includes(conn.to);
  });

  return (
    <div className="bg-white p-6 rounded-lg border overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max">
        {visibleNodes.map((nodeId, idx) => {
          const module = registry.modules[nodeId];
          const isSelected = selectedModule?.moduleId === nodeId;
          
          return (
            <React.Fragment key={nodeId}>
              {/* Node Tile */}
              <button
                onClick={() => onSelectModule(module)}
                className={`
                  flex flex-col items-start gap-2 p-4 rounded-lg min-w-[200px] border-2 transition-all
                  ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}
                  ${!module.usage.isUsed ? 'opacity-50' : ''}
                  ${module.state === 'LEGACY' ? 'border-dashed' : ''}
                `}
              >
                <div className="font-semibold text-sm text-slate-900">
                  {module.label}
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {/* State Badge */}
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    module.state === 'CORE' ? 'bg-emerald-100 text-emerald-800' :
                    module.state === 'OPTIONAL' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {module.state}
                  </span>
                  
                  {/* Usage Badge */}
                  <span className={`text-xs px-2 py-1 rounded font-medium flex items-center gap-1 ${
                    module.usage.isUsed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {module.usage.isUsed ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        USED
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        UNUSED
                      </>
                    )}
                  </span>
                </div>

                <div className="text-xs text-slate-500 mt-1">
                  {module.category}
                </div>
              </button>

              {/* Arrow to next node (if not last) */}
              {idx < visibleNodes.length - 1 && (
                <div className="flex items-center justify-center px-2">
                  <ArrowRight className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {visibleNodes.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No modules match the current filter.</p>
        </div>
      )}
    </div>
  );
}