import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Copy, CheckCircle, XCircle, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * TAKEOFF DEBUG PANEL
 * Master diagnostics for runs, gates, posts, and materials integrity
 */
export default function TakeoffDebugPanel({ 
  job, 
  runs, 
  gates, 
  fenceLines, 
  takeoff, 
  materials,
  isOpen,
  setIsOpen 
}) {
  const [copied, setCopied] = useState(false);

  // Run diagnostics with material scoping
  const runDiagnostics = useMemo(() => {
    if (!runs) return null;

    const currentMaterialType = job?.materialType;
    const totalRuns = runs.length;
    
    // Eligible runs: status=new AND materialType matches current
    const eligibleRuns = runs.filter(r => {
      const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
      const materialType = r.materialType || currentMaterialType;
      return status === 'new' && materialType === currentMaterialType;
    });
    
    const excludedRuns = runs.filter(r => {
      const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
      const materialType = r.materialType || currentMaterialType;
      return !(status === 'new' && materialType === currentMaterialType);
    });

    // Check for duplicate run IDs
    const runIds = runs.map(r => r.id);
    const duplicateRunIds = runIds.filter((id, idx) => runIds.indexOf(id) !== idx);

    // Check for near-duplicate geometry (same endpoints within tolerance)
    const nearDuplicates = [];
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        const r1 = runs[i];
        const r2 = runs[j];
        if (r1.runLabel === r2.runLabel && Math.abs(r1.lengthLF - r2.lengthLF) < 0.1) {
          nearDuplicates.push({ run1: r1.id, run2: r2.id, label: r1.runLabel });
        }
      }
    }

    // Material type breakdown
    const runsByMaterial = runs.reduce((acc, r) => {
      const materialType = r.materialType || currentMaterialType || 'Unknown';
      acc[materialType] = (acc[materialType] || 0) + 1;
      return acc;
    }, {});

    return {
      totalRuns,
      eligibleRuns: eligibleRuns.length,
      excludedRuns: excludedRuns.length,
      excludedRunsByStatus: excludedRuns.reduce((acc, r) => {
        const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
      runsByMaterial,
      currentMaterialScope: currentMaterialType,
      duplicateRunIds: [...new Set(duplicateRunIds)],
      nearDuplicates,
      runsMissingMaterialType: runs.filter(r => !r.materialType).length
    };
  }, [runs]);

  // Gate diagnostics
  const gateDiagnostics = useMemo(() => {
    if (!gates || !runs) return null;

    const totalGates = gates.length;
    const eligibleRuns = runs.filter(r => {
      const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
      return status === 'new';
    });
    const eligibleRunIds = eligibleRuns.map(r => r.id);

    const eligibleGates = gates.filter(g => eligibleRunIds.includes(g.runId));
    const gatesMissingRunId = gates.filter(g => !g.runId);
    const gatesWithInvalidRunId = gates.filter(g => g.runId && !runs.find(r => r.id === g.runId));

    // Check for duplicate gate IDs
    const gateIds = gates.map(g => g.id);
    const duplicateGateIds = gateIds.filter((id, idx) => gateIds.indexOf(id) !== idx);

    // Gates per run
    const gatesPerRun = runs.map(run => ({
      runId: run.id,
      runLabel: run.runLabel,
      gateCount: gates.filter(g => g.runId === run.id).length,
      gates: gates.filter(g => g.runId === run.id).map(g => ({
        id: g.id,
        type: g.gateType,
        width: g.gateWidth_ft
      }))
    })).filter(r => r.gateCount > 0);

    return {
      totalGates,
      eligibleGates: eligibleGates.length,
      gatesMissingRunId: gatesMissingRunId.length,
      gatesWithInvalidRunId: gatesWithInvalidRunId.length,
      duplicateGateIds: [...new Set(duplicateGateIds)],
      gatesPerRun
    };
  }, [gates, runs]);

  // Post/node diagnostics from takeoff
  const postDiagnostics = useMemo(() => {
    if (!takeoff || !takeoff.postCounts) return null;

    const { endPosts, cornerPosts, gatePosts, linePosts } = takeoff.postCounts;
    const totalPosts = endPosts + cornerPosts + gatePosts + linePosts;

    // Check for gate dominance replacements
    const expectedGatePosts = gateDiagnostics ? gateDiagnostics.eligibleGates * 2 : 0;
    const gateDominanceReplacements = Math.max(0, expectedGatePosts - gatePosts);

    return {
      endPosts,
      cornerPosts,
      gatePosts,
      linePosts,
      totalPosts,
      expectedGatePosts,
      gateDominanceReplacements,
      gatePostMismatch: gatePosts !== expectedGatePosts
    };
  }, [takeoff, gateDiagnostics]);

  // Materials integrity
  const materialsIntegrity = useMemo(() => {
    if (!takeoff || !materials) return null;

    const takeoffItems = takeoff.lineItems || [];
    const dbMaterials = materials || [];

    // Compare takeoff to DB materials
    const takeoffMaterialNames = new Set(takeoffItems.map(i => i.materialDescription || i.lineItemName));
    const dbMaterialNames = new Set(dbMaterials.map(m => m.lineItemName));

    const inTakeoffNotInDB = [...takeoffMaterialNames].filter(name => !dbMaterialNames.has(name));
    const inDBNotInTakeoff = [...dbMaterialNames].filter(name => !takeoffMaterialNames.has(name));

    return {
      takeoffItemsCount: takeoffItems.length,
      dbMaterialsCount: dbMaterials.length,
      inTakeoffNotInDB,
      inDBNotInTakeoff,
      mismatch: inTakeoffNotInDB.length > 0 || inDBNotInTakeoff.length > 0
    };
  }, [takeoff, materials]);

  // Critical errors
  const criticalErrors = useMemo(() => {
    const errors = [];

    if (runDiagnostics?.duplicateRunIds.length > 0) {
      errors.push(`Duplicate run IDs detected: ${runDiagnostics.duplicateRunIds.join(', ')}`);
    }

    if (runDiagnostics?.nearDuplicates.length > 0) {
      errors.push(`${runDiagnostics.nearDuplicates.length} near-duplicate runs detected`);
    }

    if (gateDiagnostics?.duplicateGateIds.length > 0) {
      errors.push(`Duplicate gate IDs detected: ${gateDiagnostics.duplicateGateIds.join(', ')}`);
    }

    if (gateDiagnostics?.gatesMissingRunId > 0) {
      errors.push(`${gateDiagnostics.gatesMissingRunId} gates missing runId`);
    }

    if (gateDiagnostics?.gatesWithInvalidRunId > 0) {
      errors.push(`${gateDiagnostics.gatesWithInvalidRunId} gates with invalid runId`);
    }

    if (postDiagnostics?.gatePostMismatch) {
      errors.push(`Gate post count mismatch: expected ${postDiagnostics.expectedGatePosts}, got ${postDiagnostics.gatePosts}`);
    }

    if (materialsIntegrity?.mismatch) {
      errors.push(`Materials DB out of sync with takeoff`);
    }

    return errors;
  }, [runDiagnostics, gateDiagnostics, postDiagnostics, materialsIntegrity]);

  // Generate debug report
  const generateReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      jobId: job?.id,
      jobNumber: job?.jobNumber,
      materialType: job?.materialType,
      runs: runDiagnostics,
      gates: gateDiagnostics,
      posts: postDiagnostics,
      materials: materialsIntegrity,
      criticalErrors,
      takeoff: {
        materialType: takeoff?.materialType,
        postCounts: takeoff?.postCounts,
        lineItemsCount: takeoff?.lineItems?.length
      }
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasErrors = criticalErrors.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`border-2 ${hasErrors ? 'border-red-500' : 'border-amber-500'}`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-slate-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {hasErrors ? (
                  <XCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <Info className="w-5 h-5 text-amber-600" />
                )}
                Takeoff Debug Console
                {hasErrors && (
                  <Badge variant="destructive" className="ml-2">
                    {criticalErrors.length} Error{criticalErrors.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  generateReport();
                }}
              >
                {copied ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                Copy Report
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Critical Errors */}
            {criticalErrors.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2 font-semibold text-red-900">
                  <AlertTriangle className="w-5 h-5" />
                  Critical Errors (PO Blocked)
                </div>
                {criticalErrors.map((error, idx) => (
                  <div key={idx} className="text-sm text-red-800 ml-7">• {error}</div>
                ))}
              </div>
            )}

            {/* Run Diagnostics */}
            {runDiagnostics && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  Run Diagnostics
                  <Badge variant="outline" className="text-xs">
                    Scope: {runDiagnostics.currentMaterialScope}
                  </Badge>
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-slate-50 rounded">
                    <div className="text-xs text-slate-500">Total Runs</div>
                    <div className="text-2xl font-bold">{runDiagnostics.totalRuns}</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded border-2 border-green-300">
                    <div className="text-xs text-slate-500">Eligible (Scoped)</div>
                    <div className="text-2xl font-bold text-green-700">{runDiagnostics.eligibleRuns}</div>
                    <div className="text-[10px] text-green-600 mt-1">status=new + materialType={runDiagnostics.currentMaterialScope}</div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded">
                    <div className="text-xs text-slate-500">Excluded</div>
                    <div className="text-2xl font-bold text-amber-700">{runDiagnostics.excludedRuns}</div>
                  </div>
                </div>
                
                {/* Material Type Breakdown */}
                {Object.keys(runDiagnostics.runsByMaterial).length > 1 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <div className="text-xs font-semibold text-blue-900 mb-2">Material Type Distribution:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(runDiagnostics.runsByMaterial).map(([material, count]) => (
                        <div key={material} className="flex items-center justify-between text-sm">
                          <span className={material === runDiagnostics.currentMaterialScope ? 'font-bold text-blue-700' : 'text-slate-600'}>
                            {material}:
                          </span>
                          <Badge variant={material === runDiagnostics.currentMaterialScope ? 'default' : 'outline'}>
                            {count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {runDiagnostics.runsMissingMaterialType > 0 && (
                  <div className="text-sm text-red-700 p-2 bg-red-50 rounded">
                    ⚠️ {runDiagnostics.runsMissingMaterialType} run{runDiagnostics.runsMissingMaterialType !== 1 ? 's' : ''} missing materialType (INVALID)
                  </div>
                )}
                
                {Object.keys(runDiagnostics.excludedRunsByStatus).length > 0 && (
                  <div className="text-sm text-slate-600 p-2 bg-slate-50 rounded">
                    Excluded by status: {JSON.stringify(runDiagnostics.excludedRunsByStatus)}
                  </div>
                )}
              </div>
            )}

            {/* Gate Diagnostics */}
            {gateDiagnostics && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Gate Diagnostics</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-slate-50 rounded">
                    <div className="text-xs text-slate-500">Total Gates</div>
                    <div className="text-2xl font-bold">{gateDiagnostics.totalGates}</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded">
                    <div className="text-xs text-slate-500">Eligible Gates</div>
                    <div className="text-2xl font-bold text-green-700">{gateDiagnostics.eligibleGates}</div>
                  </div>
                  <div className={`p-3 rounded ${gateDiagnostics.gatesMissingRunId > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <div className="text-xs text-slate-500">Missing RunId</div>
                    <div className={`text-2xl font-bold ${gateDiagnostics.gatesMissingRunId > 0 ? 'text-red-700' : ''}`}>
                      {gateDiagnostics.gatesMissingRunId}
                    </div>
                  </div>
                </div>

                {/* Gates per run table */}
                {gateDiagnostics.gatesPerRun.length > 0 && (
                  <div className="border rounded p-3 space-y-2">
                    <div className="font-medium text-sm">Gates Per Run</div>
                    {gateDiagnostics.gatesPerRun.map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{r.runLabel}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{r.gateCount} gate{r.gateCount !== 1 ? 's' : ''}</Badge>
                          <span className="text-xs text-slate-500">
                            {r.gates.map(g => `${g.type} ${g.width}'`).join(', ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Post Diagnostics */}
            {postDiagnostics && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Post/Node Diagnostics</h3>
                <div className="grid grid-cols-5 gap-2">
                  <div className="p-2 bg-green-50 rounded text-center">
                    <div className="text-xs text-slate-500">End</div>
                    <div className="text-xl font-bold text-green-700">{postDiagnostics.endPosts}</div>
                  </div>
                  <div className="p-2 bg-red-50 rounded text-center">
                    <div className="text-xs text-slate-500">Corner</div>
                    <div className="text-xl font-bold text-red-700">{postDiagnostics.cornerPosts}</div>
                  </div>
                  <div className={`p-2 rounded text-center ${postDiagnostics.gatePostMismatch ? 'bg-red-100' : 'bg-purple-50'}`}>
                    <div className="text-xs text-slate-500">Gate</div>
                    <div className={`text-xl font-bold ${postDiagnostics.gatePostMismatch ? 'text-red-700' : 'text-purple-700'}`}>
                      {postDiagnostics.gatePosts}
                    </div>
                  </div>
                  <div className="p-2 bg-blue-50 rounded text-center">
                    <div className="text-xs text-slate-500">Line</div>
                    <div className="text-xl font-bold text-blue-700">{postDiagnostics.linePosts}</div>
                  </div>
                  <div className="p-2 bg-slate-100 rounded text-center">
                    <div className="text-xs text-slate-500">Total</div>
                    <div className="text-xl font-bold">{postDiagnostics.totalPosts}</div>
                  </div>
                </div>
                {postDiagnostics.gatePostMismatch && (
                  <div className="text-sm text-red-700 p-2 bg-red-50 rounded">
                    ⚠️ Expected {postDiagnostics.expectedGatePosts} gate posts (2 per eligible gate), got {postDiagnostics.gatePosts}
                    {postDiagnostics.gateDominanceReplacements > 0 && (
                      <span className="ml-2">
                        ({postDiagnostics.gateDominanceReplacements} gate{postDiagnostics.gateDominanceReplacements !== 1 ? 's' : ''} replaced corner/end posts)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Materials Integrity */}
            {materialsIntegrity && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Materials Integrity</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded">
                    <div className="text-xs text-slate-500">Takeoff Items</div>
                    <div className="text-2xl font-bold">{materialsIntegrity.takeoffItemsCount}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded">
                    <div className="text-xs text-slate-500">DB Materials</div>
                    <div className="text-2xl font-bold">{materialsIntegrity.dbMaterialsCount}</div>
                  </div>
                </div>
                {materialsIntegrity.mismatch && (
                  <div className="text-sm text-amber-700 p-2 bg-amber-50 rounded">
                    ⚠️ Sync needed: {materialsIntegrity.inTakeoffNotInDB.length} items missing in DB, {materialsIntegrity.inDBNotInTakeoff.length} items not in takeoff
                  </div>
                )}
              </div>
            )}

            {/* Takeoff Material Scoping Check */}
            {takeoff && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  Takeoff Material Scoping
                  <Badge className={takeoff.materialType === job?.materialType ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                    {takeoff.materialType === job?.materialType ? '✓ Match' : '✗ Mismatch'}
                  </Badge>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-xs text-slate-500">Job Material</div>
                    <div className="text-lg font-bold text-blue-700">{job?.materialType}</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded">
                    <div className="text-xs text-slate-500">Takeoff Material</div>
                    <div className="text-lg font-bold text-purple-700">{takeoff.materialType}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Takeoff Top Items */}
            {takeoff && takeoff.lineItems && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Takeoff Line Items (Top 15)</h3>
                <div className="border rounded divide-y max-h-80 overflow-y-auto">
                  {takeoff.lineItems.slice(0, 15).map((item, idx) => {
                    const itemName = (item.materialDescription || item.lineItemName || '').toLowerCase();
                    const isAudit = item.runLabel === '__AUDIT__';
                    const isSuspicious = !isAudit && (
                      (job?.materialType === 'Chain Link' && (itemName.includes('vinyl') || itemName.includes('panel') || itemName.includes('donut'))) ||
                      (job?.materialType === 'Vinyl' && (itemName.includes('chain link') || itemName.includes('tension band') || itemName.includes('brace band')))
                    );
                    
                    return (
                      <div 
                        key={idx} 
                        className={`p-2 flex items-center justify-between text-sm hover:bg-slate-50 ${
                          isAudit ? 'bg-blue-50' : isSuspicious ? 'bg-red-50 border-l-4 border-red-500' : ''
                        }`}
                      >
                        <div className="flex-1 truncate">
                          {isAudit && '📊 '}
                          {isSuspicious && '⚠️ '}
                          {item.materialDescription || item.lineItemName}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isSuspicious ? 'destructive' : 'outline'}>
                            {item.quantityCalculated || item.quantity}
                          </Badge>
                          <span className="text-xs text-slate-500 w-12">{item.uom || item.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}