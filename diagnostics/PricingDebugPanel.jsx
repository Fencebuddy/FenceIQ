import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function PricingDebugPanel({ 
  jobId, 
  companyId, 
  queryStates = {},
  lastSuccessfulStep = null,
  error = null 
}) {
  
  const getStatusIcon = (state) => {
    if (state === 'loading') return <Loader2 className="w-3 h-3 animate-spin text-blue-500" />;
    if (state === 'success') return <CheckCircle className="w-3 h-3 text-green-500" />;
    if (state === 'error') return <XCircle className="w-3 h-3 text-red-500" />;
    return <Clock className="w-3 h-3 text-slate-400" />;
  };
  
  const getStatusColor = (state) => {
    if (state === 'loading') return 'bg-blue-50 border-blue-200';
    if (state === 'success') return 'bg-green-50 border-green-200';
    if (state === 'error') return 'bg-red-50 border-red-200';
    return 'bg-slate-50 border-slate-200';
  };
  
  return (
    <Card className="border-2 border-indigo-300 bg-indigo-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">🔬 Pricing Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        
        {/* Context */}
        <div className="bg-white p-3 rounded border">
          <div className="text-xs font-semibold text-slate-900 mb-2">Context</div>
          <div className="space-y-1 text-xs">
            <div><span className="text-slate-600">Job ID:</span> <code className="bg-slate-100 px-1 rounded">{jobId || 'MISSING'}</code></div>
            <div><span className="text-slate-600">Company ID:</span> <code className="bg-slate-100 px-1 rounded">{companyId || 'MISSING'}</code></div>
          </div>
        </div>
        
        {/* Query States */}
        <div className="bg-white p-3 rounded border">
          <div className="text-xs font-semibold text-slate-900 mb-2">Query Status</div>
          <div className="space-y-1">
            {Object.entries(queryStates).map(([key, state]) => (
              <div key={key} className={`flex items-center justify-between p-2 rounded border ${getStatusColor(state)}`}>
                <div className="flex items-center gap-2">
                  {getStatusIcon(state)}
                  <span className="text-xs font-mono">{key}</span>
                </div>
                <Badge variant="outline" className="text-xs">{state}</Badge>
              </div>
            ))}
          </div>
        </div>
        
        {/* Progress Breadcrumb */}
        {lastSuccessfulStep && (
          <div className="bg-white p-3 rounded border">
            <div className="text-xs font-semibold text-slate-900 mb-2">Last Successful Step</div>
            <div className="text-xs text-green-700 font-medium">{lastSuccessfulStep}</div>
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-2 border-red-300 p-3 rounded">
            <div className="text-xs font-semibold text-red-900 mb-2">Error</div>
            <div className="text-xs text-red-800 font-mono break-all">{error.message}</div>
            {error.stack && (
              <details className="mt-2">
                <summary className="text-xs text-red-700 cursor-pointer">Stack Trace</summary>
                <pre className="text-[10px] mt-2 bg-red-100 p-2 rounded overflow-x-auto">{error.stack}</pre>
              </details>
            )}
          </div>
        )}
        
      </CardContent>
    </Card>
  );
}