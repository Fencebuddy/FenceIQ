import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

export default function HeightCompliancePanel({ runs, mergedRules }) {
  if (!runs || runs.length === 0) return null;

  const runsWithWarnings = runs.filter(r => r.height_compliance_status === 'WARN_TOO_TALL');
  const runsCompliant = runs.filter(r => r.height_compliance_status === 'OK');
  const runsUnknown = runs.filter(r => 
    r.height_compliance_status === 'UNKNOWN' || 
    r.height_compliance_status === 'UNKNOWN_ZONE'
  );

  const hasWarnings = runsWithWarnings.length > 0;

  return (
    <Card>
      <CardHeader className="border-b bg-slate-50 py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Info className="w-4 h-4" />
          Height Compliance Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-green-50 rounded">
            <div className="font-bold text-green-700">{runsCompliant.length}</div>
            <div className="text-green-600">Compliant</div>
          </div>
          <div className="p-2 bg-red-50 rounded">
            <div className="font-bold text-red-700">{runsWithWarnings.length}</div>
            <div className="text-red-600">Exceeds</div>
          </div>
          <div className="p-2 bg-slate-50 rounded">
            <div className="font-bold text-slate-700">{runsUnknown.length}</div>
            <div className="text-slate-600">Unknown</div>
          </div>
        </div>

        {/* Warnings Banner */}
        {hasWarnings && (
          <Alert className="border-red-500 bg-red-50">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-xs">
              <strong>{runsWithWarnings.length} run{runsWithWarnings.length !== 1 ? 's' : ''}</strong> exceed typical height limits:
              <ul className="list-disc pl-5 mt-1">
                {runsWithWarnings.map(run => (
                  <li key={run.id}>
                    <strong>{run.runLabel}:</strong> {run.fenceHeight || run.proposed_height_ft + ' ft'} 
                    {run.max_allowed_height_ft && ` (max: ${run.max_allowed_height_ft} ft)`}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Height Limits Reference */}
        {mergedRules?.height_limits && (
          <div className="p-3 bg-blue-50 rounded space-y-1 text-xs">
            <div className="font-semibold text-blue-900 mb-1">Height Limits:</div>
            <div className="flex justify-between">
              <span>Front Yard:</span>
              <span className="font-medium">{mergedRules.height_limits.front_yard_ft} ft</span>
            </div>
            <div className="flex justify-between">
              <span>Side Yard:</span>
              <span className="font-medium">{mergedRules.height_limits.side_yard_ft} ft</span>
            </div>
            <div className="flex justify-between">
              <span>Rear Yard:</span>
              <span className="font-medium">{mergedRules.height_limits.rear_yard_ft} ft</span>
            </div>
            {mergedRules.height_limits.corner_lot_street_side_ft && (
              <div className="flex justify-between">
                <span>Street Side (Corner):</span>
                <span className="font-medium">{mergedRules.height_limits.corner_lot_street_side_ft} ft</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}