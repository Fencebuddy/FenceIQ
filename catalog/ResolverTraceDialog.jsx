import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function ResolverTraceDialog({ trace, onClose }) {
  if (!trace) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resolver Debug Trace</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Input Section */}
          <div className="bg-slate-100 p-4 rounded">
            <div className="font-semibold text-sm mb-2">Input</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-slate-600">Line Item:</span> <span className="font-mono">{trace.input.lineItemName}</span></div>
              <div><span className="text-slate-600">Canonical Key:</span> <span className="font-mono">{trace.input.canonicalKey}</span></div>
              <div><span className="text-slate-600">Fence Type:</span> <span className="font-mono">{trace.input.fenceType}</span></div>
              <div><span className="text-slate-600">Height:</span> <span className="font-mono">{trace.input.height_ft}'</span></div>
              <div><span className="text-slate-600">Material:</span> <span className="font-mono">{trace.input.materialType}</span></div>
              <div><span className="text-slate-600">Context:</span> <span className="font-mono">{trace.input.usageContext}</span></div>
            </div>
          </div>

          {/* Candidates Section */}
          <div>
            <div className="font-semibold text-sm mb-2">Candidates Considered ({trace.candidates?.length || 0})</div>
            <div className="space-y-2">
              {trace.candidates?.map((candidate, idx) => (
                <div key={idx} className="border rounded p-3 text-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium">{candidate.item?.crm_name || candidate.item?.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        SKU: {candidate.item?.sku || 'N/A'} | System: {candidate.item?.system}
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {candidate.method} ({candidate.score})
                    </Badge>
                  </div>
                </div>
              ))}
              {trace.candidates?.length === 0 && (
                <div className="text-xs text-slate-500 italic">No candidates found</div>
              )}
            </div>
          </div>

          {/* Guards Section */}
          {trace.guards && (
            <div>
              <div className="font-semibold text-sm mb-2">Guardrail Checks</div>
              <div className="space-y-2">
                {trace.guards.guardResults?.allowedFenceTypes?.checked && (
                  <div className="flex items-center gap-2 text-sm">
                    {trace.guards.guardResults.allowedFenceTypes.passed ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span>Allowed Fence Types</span>
                    <Badge className={trace.guards.guardResults.allowedFenceTypes.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {trace.guards.guardResults.allowedFenceTypes.passed ? 'PASS' : 'FAIL'}
                    </Badge>
                  </div>
                )}

                {trace.guards.guardResults?.disallowedFenceTypes?.checked && (
                  <div className="flex items-center gap-2 text-sm">
                    {trace.guards.guardResults.disallowedFenceTypes.passed ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span>Disallowed Fence Types</span>
                    <Badge className={trace.guards.guardResults.disallowedFenceTypes.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {trace.guards.guardResults.disallowedFenceTypes.passed ? 'PASS' : 'FAIL'}
                    </Badge>
                  </div>
                )}

                {trace.guards.guardResults?.vinylSupportRule?.checked && (
                  <div className="border-2 border-purple-200 bg-purple-50 p-3 rounded">
                    <div className="flex items-center gap-2 text-sm mb-2">
                      {trace.guards.guardResults.vinylSupportRule.passed ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="font-semibold">VINYL SUPPORT POST RULE</span>
                      <Badge className={trace.guards.guardResults.vinylSupportRule.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {trace.guards.guardResults.vinylSupportRule.passed ? 'ALLOWED' : 'DENIED'}
                      </Badge>
                    </div>
                    <div className="text-xs font-mono">
                      {trace.guards.guardResults.vinylSupportRule.log}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Selected Item */}
          {trace.selected && (
            <div className="bg-green-50 p-4 rounded border border-green-200">
              <div className="font-semibold text-sm mb-2 text-green-800">Selected Catalog Item</div>
              <div className="text-xs space-y-1">
                <div><span className="text-slate-600">SKU:</span> <span className="font-mono">{trace.selected.sku}</span></div>
                <div><span className="text-slate-600">Canonical Key:</span> <span className="font-mono">{trace.selected.canonicalKey}</span></div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <div className="font-semibold text-sm mb-2">Resolution Reason</div>
            <div className="text-sm bg-slate-100 p-3 rounded">
              {trace.reason || 'No reason provided'}
            </div>
          </div>

          {/* Suggestions (for failed matches) */}
          {trace.suggestions && trace.suggestions.length > 0 && (
            <div>
              <div className="font-semibold text-sm mb-2">Suggestions (Top 3)</div>
              <div className="space-y-2">
                {trace.suggestions.map((suggestion, idx) => (
                  <div key={idx} className="border rounded p-2 text-xs">
                    <div className="font-medium">{suggestion.name}</div>
                    <div className="text-slate-500">SKU: {suggestion.sku} | Score: {suggestion.score}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}