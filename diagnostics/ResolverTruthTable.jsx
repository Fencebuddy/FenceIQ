import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ResolverTruthTable({ jobId, companyId, lineItems, title = "Resolver Truth Table" }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState(new Set());
  
  // Fetch CompanySkuMap for truth checking
  const { data: companySkuMap = [] } = useQuery({
    queryKey: ['companySkuMap_truth', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return await base44.entities.CompanySkuMap.filter({ 
        companyId, 
        status: 'mapped' 
      });
    },
    enabled: !!companyId && expanded,
    staleTime: Infinity
  });
  
  const { data: allCompanySkuMap = [] } = useQuery({
    queryKey: ['companySkuMap_all_truth', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return await base44.entities.CompanySkuMap.filter({ companyId });
    },
    enabled: !!companyId && expanded,
    staleTime: Infinity
  });
  
  // Build mapping lookup
  const mappingLookup = React.useMemo(() => {
    const lookup = new Map();
    companySkuMap.forEach(m => lookup.set(m.uck, m));
    return lookup;
  }, [companySkuMap]);
  
  const unresolvedLookup = React.useMemo(() => {
    const lookup = new Map();
    allCompanySkuMap.filter(m => m.status === 'unmapped').forEach(m => lookup.set(m.uck, m));
    return lookup;
  }, [allCompanySkuMap]);
  
  // Build truth table data
  const truthData = React.useMemo(() => {
    if (!lineItems || !expanded) return [];
    
    return lineItems.slice(0, 50).map(item => {
      const uck = item.uck || item.canonical_key;
      const mapping = mappingLookup.get(uck);
      const unresolvedRow = unresolvedLookup.get(uck);
      
      return {
        display_name: item.displayName || item.lineItemName,
        uck,
        unit: item.uom || item.unit,
        qty: item.quantityCalculated || item.qty || 0,
        mappingFound: item.mappingFound,
        mappedMaterialCatalogId: item.catalog_id,
        resolverOutcome: item.resolverOutcome,
        resolverBranch: item.resolverBranch,
        unresolvedRowExists: !!unresolvedRow,
        staleRow: !!unresolvedRow && item.mappingFound,
        errorMessage: item.errorMessage,
        errorStack: item.errorStack,
        errorStackTop: item.errorStackTop,
        errorDetails: item.errorDetails
      };
    });
  }, [lineItems, mappingLookup, unresolvedLookup, expanded]);
  
  // Summary stats
  const stats = React.useMemo(() => {
    if (!truthData.length) return null;
    
    return {
      total: truthData.length,
      resolved: truthData.filter(t => t.resolverOutcome === 'RESOLVED').length,
      no_mapping: truthData.filter(t => t.resolverOutcome === 'NO_MAPPING').length,
      no_uck: truthData.filter(t => t.resolverOutcome === 'NO_UCK').length,
      unit_mismatch: truthData.filter(t => t.resolverOutcome === 'UNIT_MISMATCH').length,
      stale_rows: truthData.filter(t => t.staleRow).length
    };
  }, [truthData]);
  
  return (
    <Card className="border-purple-200 bg-purple-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-purple-600" />
            {title}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent className="space-y-4">
          
          {/* Context Info */}
          <div className="bg-white p-3 rounded border space-y-2 text-xs">
            <div className="font-semibold text-purple-900">Resolver Context</div>
            <div>
              <span className="text-slate-600">Company ID:</span> 
              <code className={`${companyId ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} px-1 rounded font-semibold`}>
                {companyId || 'BLOCKED - MISSING'}
              </code>
            </div>
            {!companyId && (
              <div className="bg-red-50 border border-red-200 p-2 rounded">
                <div className="font-semibold text-red-900">⚠️ RESOLVER BLOCKED</div>
                <div className="text-red-700 text-xs">job.companyId is required. No fallbacks allowed.</div>
              </div>
            )}
            <div><span className="text-slate-600">CompanySkuMap Rows (mapped):</span> {companySkuMap.length}</div>
            <div><span className="text-slate-600">CompanySkuMap Rows (all):</span> {allCompanySkuMap.length}</div>
            <div className="border-t pt-2 mt-2">
              <div className="font-semibold text-slate-600 mb-1">First 20 Mapping UCKs:</div>
              <div className="space-y-0.5 font-mono text-[10px] max-h-32 overflow-y-auto">
                {companySkuMap.slice(0, 20).map((m, idx) => (
                  <div key={idx} className="text-blue-700">{m.uck}</div>
                ))}
              </div>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="font-semibold text-slate-600 mb-1">First 20 Takeoff UCKs:</div>
              <div className="space-y-0.5 font-mono text-[10px] max-h-32 overflow-y-auto">
                {lineItems?.slice(0, 20).map((item, idx) => (
                  <div key={idx} className="text-green-700">{item.uck || item.canonical_key}</div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Summary Stats */}
          {stats && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <div className="bg-white p-2 rounded text-center">
                <div className="text-xs text-slate-600">Total</div>
                <div className="text-lg font-bold">{stats.total}</div>
              </div>
              <div className="bg-green-50 p-2 rounded text-center border border-green-200">
                <div className="text-xs text-green-700">Resolved</div>
                <div className="text-lg font-bold text-green-600">{stats.resolved}</div>
              </div>
              <div className="bg-amber-50 p-2 rounded text-center border border-amber-200">
                <div className="text-xs text-amber-700">No Mapping</div>
                <div className="text-lg font-bold text-amber-600">{stats.no_mapping}</div>
              </div>
              <div className="bg-red-50 p-2 rounded text-center border border-red-200">
                <div className="text-xs text-red-700">No UCK</div>
                <div className="text-lg font-bold text-red-600">{stats.no_uck}</div>
              </div>
              <div className="bg-red-50 p-2 rounded text-center border border-red-200">
                <div className="text-xs text-red-700">Unit Mismatch</div>
                <div className="text-lg font-bold text-red-600">{stats.unit_mismatch}</div>
              </div>
              <div className="bg-purple-50 p-2 rounded text-center border border-purple-200">
                <div className="text-xs text-purple-700">Stale Rows</div>
                <div className="text-lg font-bold text-purple-600">{stats.stale_rows}</div>
              </div>
            </div>
          )}
          
          {/* Truth Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead className="bg-purple-100">
                <tr>
                  <th className="text-left py-2 px-2 border">#</th>
                  <th className="text-left py-2 px-2 border">Display Name</th>
                  <th className="text-left py-2 px-2 border">UCK</th>
                  <th className="text-left py-2 px-2 border">Unit</th>
                  <th className="text-right py-2 px-2 border">Qty</th>
                  <th className="text-left py-2 px-2 border">Mapping Found</th>
                  <th className="text-left py-2 px-2 border">Catalog ID</th>
                  <th className="text-left py-2 px-2 border">Resolver Outcome</th>
                  <th className="text-left py-2 px-2 border">Branch</th>
                  <th className="text-left py-2 px-2 border">Unresolved Row</th>
                  <th className="text-left py-2 px-2 border">Error</th>
                </tr>
              </thead>
              <tbody>
                {truthData.map((row, idx) => (
                  <React.Fragment key={idx}>
                    <tr 
                      className={`border-b ${
                        row.staleRow ? 'bg-purple-100' : 
                        row.resolverOutcome === 'RESOLVED' ? 'bg-green-50' : 
                        row.resolverOutcome === 'ERROR' ? 'bg-red-50' :
                        'bg-amber-50'
                      }`}
                    >
                      <td className="py-2 px-2 border">{idx + 1}</td>
                      <td className="py-2 px-2 border">{row.display_name}</td>
                      <td className="py-2 px-2 border">
                        <code className="text-[10px] bg-slate-100 px-1 rounded">{row.uck}</code>
                      </td>
                      <td className="py-2 px-2 border">{row.unit}</td>
                      <td className="py-2 px-2 border text-right">{row.qty}</td>
                      <td className="py-2 px-2 border">
                        {row.mappingFound ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">✓ Found</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">✗ Not Found</Badge>
                        )}
                      </td>
                      <td className="py-2 px-2 border">
                        <code className="text-[10px]">{row.mappedMaterialCatalogId?.slice(0, 8) || '-'}</code>
                      </td>
                      <td className="py-2 px-2 border">
                        <Badge className={
                          row.resolverOutcome === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                          row.resolverOutcome === 'NO_MAPPING' ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }>
                          {row.resolverOutcome}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 border">
                        <code className="text-[10px] bg-slate-100 px-1 rounded">{row.resolverBranch}</code>
                      </td>
                      <td className="py-2 px-2 border">
                        {row.unresolvedRowExists ? '✓' : '-'}
                      </td>
                      <td className="py-2 px-2 border">
                        {row.errorMessage ? (
                          <div className="space-y-1">
                            <div className="text-[10px] text-red-700 max-w-xs truncate">
                              {row.errorMessage}
                              {row.errorStackTop && ` — ${row.errorStackTop}`}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newSet = new Set(expandedErrors);
                                if (newSet.has(idx)) {
                                  newSet.delete(idx);
                                } else {
                                  newSet.add(idx);
                                }
                                setExpandedErrors(newSet);
                              }}
                              className="h-5 px-1 text-[10px]"
                            >
                              {expandedErrors.has(idx) ? 'Hide' : 'Expand'}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                    {expandedErrors.has(idx) && row.errorMessage && (
                      <tr className="bg-red-50 border-b">
                        <td colSpan="11" className="py-2 px-4 border">
                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="font-semibold text-red-900">Error Message:</span>
                              <div className="text-red-800 mt-1">{row.errorMessage}</div>
                            </div>
                            {row.errorStack && (
                              <div>
                                <span className="font-semibold text-red-900">Stack Trace:</span>
                                <pre className="text-[10px] bg-red-100 p-2 rounded mt-1 overflow-x-auto">
                                  {row.errorStack}
                                </pre>
                              </div>
                            )}
                            {row.errorDetails && (
                              <div>
                                <span className="font-semibold text-red-900">Debug Info:</span>
                                <pre className="text-[10px] bg-red-100 p-2 rounded mt-1 overflow-x-auto">
                                  {JSON.stringify(row.errorDetails, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Stale Row Warning */}
          {stats && stats.stale_rows > 0 && (
            <div className="bg-purple-100 border-2 border-purple-500 p-3 rounded">
              <div className="font-semibold text-purple-900 mb-1">
                ⚠️ {stats.stale_rows} Stale Unresolved Rows Detected
              </div>
              <div className="text-xs text-purple-800">
                These items have mappings in CompanySkuMap but also have stale unmapped rows. 
                They should be cleaned up automatically by the resolver.
              </div>
            </div>
          )}
          
        </CardContent>
      )}
    </Card>
  );
}