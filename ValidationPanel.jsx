import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, AlertTriangle, XCircle } from "lucide-react";
import { getValidationBadge } from './jobValidator';

export default function ValidationPanel({ validation }) {
  if (!validation) return null;
  
  const badge = getValidationBadge(validation.validationStatus);
  
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'BLOCKER': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'CRITICAL': return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'WARNING': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'INFO': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      default: return null;
    }
  };
  
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'BLOCKER': return 'border-red-500 bg-red-50';
      case 'CRITICAL': return 'border-orange-500 bg-orange-50';
      case 'WARNING': return 'border-yellow-500 bg-yellow-50';
      case 'INFO': return 'border-blue-500 bg-blue-50';
      default: return '';
    }
  };
  
  return (
    <Card>
      <CardHeader className="border-b bg-slate-50 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Validation</CardTitle>
          <Badge className={`${badge.color} border`}>
            {badge.icon} {badge.text}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {validation.issues.length === 0 ? (
          <div className="text-center py-4 text-green-700">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <p className="font-medium">All checks passed</p>
            <p className="text-sm text-slate-600 mt-1">Ready to send to office</p>
          </div>
        ) : (
          <div className="space-y-3">
            {validation.issues.map((issue, idx) => (
              <Alert key={idx} className={getSeverityColor(issue.severity)}>
                <div className="flex items-start gap-2">
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-sm">{issue.message}</p>
                      {issue.autoFixed && (
                        <Badge className="bg-green-100 text-green-800 text-xs ml-2">Auto-fixed</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      <strong>Fix:</strong> {issue.suggestedFix}
                    </p>
                    {issue.location && (
                      <p className="text-xs text-slate-500 mt-1">
                        <strong>Location:</strong> {issue.location}
                      </p>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}
        
        {validation.autoFixApplied && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>✓ Auto-fixes applied:</strong> FenceBuddy automatically corrected standard violations.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}