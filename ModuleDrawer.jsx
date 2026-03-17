import React, { useState } from 'react';
import { X, Code2, GitBranch, BookOpen } from 'lucide-react';

/**
 * ModuleDrawer: Right-side panel showing detailed module info
 * Tabs: Overview | Code | Inputs/Outputs
 */
export default function ModuleDrawer({ module, registry, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!module) return null;

  const refCount = module.code?.referencedBy?.length ?? 0;

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-white shadow-xl border-l z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">{module.label}</h3>
          <p className="text-xs text-slate-500">{module.moduleId}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-slate-50">
        {[
          { id: 'overview', label: 'Overview', icon: BookOpen },
          { id: 'code', label: 'Code', icon: Code2 },
          { id: 'data', label: 'Data', icon: GitBranch }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center gap-1 border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* Description */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Description</h4>
              <p className="text-sm text-slate-700 leading-relaxed">
                {module.description}
              </p>
            </div>

            {/* Badges */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Status</h4>
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-1 rounded font-medium ${
                  module.state === 'CORE' ? 'bg-emerald-100 text-emerald-800' :
                  module.state === 'OPTIONAL' ? 'bg-blue-100 text-blue-800' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {module.state}
                </span>
                <span className={`text-xs px-2 py-1 rounded font-medium ${
                  module.usage.isUsed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {module.usage.isUsed ? 'USED' : 'UNUSED'}
                </span>
              </div>
            </div>

            {/* Category */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Category</h4>
              <p className="text-sm text-slate-600">{module.category}</p>
            </div>

            {/* Usage Notes */}
            {module.usage?.notes && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Usage Notes</h4>
                <p className="text-sm text-slate-600">{module.usage.notes}</p>
              </div>
            )}

            {/* Recommendation */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-2">Cleanup Recommendation</h4>
              <div className="space-y-2">
                <div className={`text-xs px-3 py-2 rounded font-medium ${
                  module.cleanup?.recommendation === 'KEEP' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {module.cleanup?.recommendation === 'KEEP' ? '✓ Keep' : '⚠ Remove Candidate'}
                </div>
                {module.cleanup?.why && (
                  <p className="text-sm text-slate-600">{module.cleanup.why}</p>
                )}
                {module.cleanup?.replaceWith && (
                  <p className="text-sm text-slate-600">
                    <strong>Replace with:</strong> {module.cleanup.replaceWith}
                  </p>
                )}
                {module.cleanup?.risk && (
                  <p className="text-xs text-slate-500">
                    Risk: <span className="font-medium">{module.cleanup.risk}</span>
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* CODE TAB */}
        {activeTab === 'code' && (
          <>
            <div>
              <h4 className="font-semibold text-sm mb-2">Entry Points</h4>
              {module.code?.entryPoints?.length > 0 ? (
                <ul className="space-y-1">
                  {module.code.entryPoints.map((path, i) => (
                    <li key={i} className="text-xs font-mono bg-slate-100 p-2 rounded text-slate-700">
                      {path}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">None</p>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Referenced By ({refCount})</h4>
              {module.code?.referencedBy?.length > 0 ? (
                <ul className="space-y-1">
                  {module.code.referencedBy.map((ref, i) => (
                    <li key={i} className="text-xs font-mono bg-blue-50 p-2 rounded text-blue-700">
                      {ref}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Not referenced</p>
              )}
            </div>
          </>
        )}

        {/* DATA TAB */}
        {activeTab === 'data' && (
          <>
            <div>
              <h4 className="font-semibold text-sm mb-2">Inputs</h4>
              {module.data?.inputs?.length > 0 ? (
                <ul className="space-y-2">
                  {module.data.inputs.map((inp, i) => (
                    <li key={i} className="text-xs border-l-2 border-blue-300 pl-2">
                      <div className="font-mono font-medium text-blue-700">{inp.name}</div>
                      <div className="text-slate-600">{inp.type}</div>
                      {inp.notes && <div className="text-slate-500 italic">{inp.notes}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">None</p>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Outputs</h4>
              {module.data?.outputs?.length > 0 ? (
                <ul className="space-y-2">
                  {module.data.outputs.map((out, i) => (
                    <li key={i} className="text-xs border-l-2 border-emerald-300 pl-2">
                      <div className="font-mono font-medium text-emerald-700">{out.name}</div>
                      <div className="text-slate-600">{out.type}</div>
                      {out.notes && <div className="text-slate-500 italic">{out.notes}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">None</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}