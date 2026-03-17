import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, RefreshCw, Loader2 } from "lucide-react";

export default function RunValidationPanel({ 
  runs, 
  onValidate, 
  isValidating,
  lastValidatedAt 
}) {
  const runsWithWarnings = runs.filter(r => 
    r.validation_status === 'WARN_OUTSIDE_PARCEL' || 
    r.validation_status === 'WARN_NEAR_EDGE'
  );

  const runsOk = runs.filter(r => r.validation_status === 'OK');
  const runsNoParcel = runs.filter(r => r.validation_status === 'NO_PARCEL');

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OK':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />OK</Badge>;
      case 'WARN_NEAR_EDGE':
        return <Badge className="bg-amber-100 text-amber-800"><AlertTriangle className="w-3 h-3 mr-1" />Near Edge</Badge>;
      case 'WARN_OUTSIDE_PARCEL':
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" />Outside</Badge>;
      case 'NO_PARCEL':
        return <Badge variant="outline">No Parcel</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="border-b bg-slate-50 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Run Validation</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={onValidate}
            disabled={isValidating}
            className="h-7"
          >
            {isValidating ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Validate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-green-50 rounded">
            <div className="font-bold text-green-700">{runsOk.length}</div>
            <div className="text-green-600">OK</div>
          </div>
          <div className="p-2 bg-amber-50 rounded">
            <div className="font-bold text-amber-700">{runsWithWarnings.length}</div>
            <div className="text-amber-600">Warnings</div>
          </div>
          <div className="p-2 bg-slate-50 rounded">
            <div className="font-bold text-slate-700">{runsNoParcel.length}</div>
            <div className="text-slate-600">Skipped</div>
          </div>
        </div>

        {/* Warnings */}
        {runsWithWarnings.length > 0 && (
          <Alert className="border-amber-500 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-xs">
              <strong>{runsWithWarnings.length} run{runsWithWarnings.length !== 1 ? 's' : ''}</strong> {runsWithWarnings.length !== 1 ? 'have' : 'has'} boundary warnings:
              <ul className="list-disc pl-5 mt-1">
                {runsWithWarnings.map(run => (
                  <li key={run.id}>
                    <strong>{run.runLabel}:</strong> {run.outside_percent !== null && run.outside_percent > 0 && `${run.outside_percent}% outside`}
                    {run.validation_messages && run.validation_messages[0] && ` - ${run.validation_messages[0]}`}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Run List */}
        <div className="space-y-2">
          {runs.map(run => (
            <div key={run.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-xs">
              <div className="flex-1">
                <span className="font-medium">{run.runLabel}</span>
                <span className="text-slate-500 ml-2">{run.lengthLF} LF</span>
              </div>
              <div className="flex items-center gap-2">
                {run.outside_percent !== null && run.outside_percent > 0 && (
                  <span className="text-amber-600 font-medium">{run.outside_percent}%</span>
                )}
                {getStatusBadge(run.validation_status)}
              </div>
            </div>
          ))}
        </div>

        {lastValidatedAt && (
          <div className="text-xs text-slate-500 text-center">
            Last validated: {new Date(lastValidatedAt).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}