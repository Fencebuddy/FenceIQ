import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, ClipboardList } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getEligibleRuns, calculatePostsForRun, calculateRailsForRun } from './bayRulesEngine';
import { buildTakeoff } from './canonicalTakeoffEngine';
import { resolveSavannahLineItems } from './SavannahAuditResolver';

export default function TakeoffAuditPanel({ fenceLines, runs, gates = [], job, isOpen, setIsOpen }) {
    
    // CRITICAL: Filter runs by status AND material type
    const allRuns = runs || fenceLines || [];
    const currentMaterialType = job?.materialType || 'Vinyl';
    
    // Get eligible runs using rules engine - SCOPED TO CURRENT MATERIAL
    const eligibleRuns = getEligibleRuns(allRuns).filter(r => 
        r.materialType === currentMaterialType
    );
    
    // Categorize runs - existing runs are VISUAL ONLY (not included)
    const newRuns = allRuns.filter(r => {
        if (!r.assignedRunId && !r.id) return false; // Skip unassigned visual lines
        const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
        return status === 'new' && r.materialType === currentMaterialType;
    });
    
    // Existing runs are for visual reference only - not counted
    const existingRuns = [];
    
    const removeRuns = allRuns.filter(r => {
        if (!r.assignedRunId && !r.id) return false; // Skip unassigned visual lines
        const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
        return status === 'remove';
    });
    
    // Calculate totals
    const totalRuns = allRuns.length;
    const newCount = newRuns.length;
    const existingCount = existingRuns.length;
    const removeCount = removeRuns.length;
    
    // Calculate footage and bay-based metrics
    const totalNewFootage = newRuns.reduce((sum, r) => sum + (r.lengthLF || r.manualLengthFt || r.length || 0), 0);
    const totalExistingFootage = existingRuns.reduce((sum, r) => sum + (r.lengthLF || r.manualLengthFt || r.length || 0), 0);
    const totalRemoveFootage = removeRuns.reduce((sum, r) => sum + (r.lengthLF || r.manualLengthFt || r.length || 0), 0);
    
    // Calculate total gates - ONLY for eligible runs of current material
    const eligibleRunIds = new Set(eligibleRuns.map(r => r.id));
    const eligibleGates = gates.filter(g => eligibleRunIds.has(g.runId));
    const totalGates = eligibleGates.length;
    const totalSingleGates = eligibleGates.filter(g => g.gateType === 'Single').length;
    const totalDoubleGates = eligibleGates.filter(g => g.gateType === 'Double').length;
    
    // Build canonical takeoff to get material-specific audit (with posts from window)
    const posts = (typeof window !== 'undefined' && window.jobPostsForTakeoff) ? window.jobPostsForTakeoff : [];
    const takeoff = job && fenceLines.length > 0 ? buildTakeoff(job, fenceLines, runs, gates, posts) : null;
    const materialType = job?.materialType || 'Vinyl';
    
    // CRITICAL: If vinyl, resolve ALL lineItems through Savannah resolver
    const resolvedLineItems = materialType === 'Vinyl' && takeoff?.lineItems 
        ? resolveSavannahLineItems(takeoff.lineItems, job)
        : takeoff?.lineItems || [];
    
    // Debug logging
    console.log('TakeoffAuditPanel - Posts count:', posts.length, 'Takeoff:', takeoff);
    
    // Calculate bay-based metrics for eligible runs (for legacy view)
    const runDetails = eligibleRuns.map(run => {
        // Match gates by runId - only eligible gates
        const runGates = eligibleGates.filter(g => g.runId === run.id);
        
        const postCalc = calculatePostsForRun(run, runGates);
        const railCalc = calculateRailsForRun(run, runGates, run.style);
        
        return {
            id: run.id,
            label: run.runLabel || run.orientationLabel || 'Run',
            lengthFt: run.lengthLF || run.manualLengthFt || run.length || 0,
            bays: railCalc.totalFenceBays, // Fence bays (excludes gate openings)
            posts: postCalc.totalPosts,
            rails: railCalc.fenceRails, // Show only fence rails in audit
            gateRails: railCalc.gateFrameRails,
            gateCount: runGates.length
        };
    });
    
    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className="border-blue-200 bg-blue-50">
                <CollapsibleTrigger asChild>
                    <CardHeader className="pb-3 cursor-pointer hover:bg-blue-100">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <ClipboardList className="w-5 h-5 text-blue-600" />
                                📊 Takeoff Audit — {materialType.toUpperCase()} (New Runs Only)
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
                                    {newCount} New
                                </Badge>
                                {existingCount > 0 && (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                                        {existingCount} Existing
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="p-4 space-y-4">
                        {/* Material-Specific Audit */}
                        {takeoff && materialType === 'Chain Link' && takeoff.postCounts && (
                            <div className="bg-white rounded-lg border-2 border-blue-300 p-4 space-y-3">
                                <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                                    🔗 Chain Link Post Summary (10' Max Spacing)
                                </h4>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                                        <div className="text-lg font-bold text-green-700">{takeoff.postCounts.endPosts}</div>
                                        <div className="text-[10px] text-green-600 font-medium">End</div>
                                        <div className="w-2 h-2 bg-green-500 rounded-full mx-auto mt-1"></div>
                                    </div>
                                    <div className="text-center p-2 bg-red-50 rounded border border-red-200">
                                        <div className="text-lg font-bold text-red-700">{takeoff.postCounts.cornerPosts}</div>
                                        <div className="text-[10px] text-red-600 font-medium">Corner</div>
                                        <div className="w-2 h-2 bg-red-500 rounded-full mx-auto mt-1"></div>
                                    </div>
                                    <div className="text-center p-2 bg-purple-50 rounded border-2 border-purple-300">
                                        <div className="text-lg font-bold text-purple-700">{takeoff.postCounts.gatePosts}</div>
                                        <div className="text-[10px] text-purple-600 font-medium">Gate</div>
                                        <div className="w-2 h-2 bg-purple-500 rounded-full mx-auto mt-1"></div>
                                    </div>
                                    <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                                        <div className="text-lg font-bold text-blue-700">{takeoff.postCounts.linePosts}</div>
                                        <div className="text-[10px] text-blue-600 font-medium">Line (10')</div>
                                        <div className="w-2 h-2 bg-blue-500 rounded-full mx-auto mt-1"></div>
                                    </div>
                                </div>
                                <div className="pt-2 border-t-2 text-center bg-slate-50 rounded p-2">
                                    <div className="text-2xl font-bold text-slate-900">{takeoff.postCounts.totalPosts}</div>
                                    <div className="text-xs text-slate-500 font-semibold">Total Posts</div>
                                    <div className="text-[10px] text-slate-400 mt-1">
                                        Terminal: {takeoff.postCounts.endPosts + takeoff.postCounts.cornerPosts + takeoff.postCounts.gatePosts} | Line: {takeoff.postCounts.linePosts}
                                    </div>
                                </div>

                                {takeoff.metrics && (
                                    <div className="pt-3 border-t-2 space-y-2 bg-blue-50 rounded p-3">
                                        <h5 className="text-xs font-bold text-blue-900 mb-2">Core Materials (Chain Link)</h5>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-700 font-medium">Net Fence Length:</span>
                                            <span className="font-bold text-blue-700">{takeoff.metrics.totalFenceFt?.toFixed(1) || 0} LF</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Fabric Rolls (50 ft):</span>
                                            <span className="font-semibold">{takeoff.metrics.fabricRolls}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Top Rail Sticks (21 ft):</span>
                                            <span className="font-semibold">{takeoff.metrics.topRailSticks}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Tension Wire Rolls (100 ft):</span>
                                            <span className="font-semibold">{takeoff.metrics.tensionWireRolls}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {takeoff && materialType === 'Vinyl' && takeoff.postCounts && (
                            <>
                                <div className="bg-white rounded-lg border p-4 space-y-3">
                                    <h4 className="font-semibold text-sm text-slate-900">Savannah Vinyl Post Summary</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="text-center p-2 bg-green-50 rounded">
                                            <div className="text-2xl font-bold text-green-700">{takeoff.postCounts.endPosts}</div>
                                            <div className="text-xs text-green-600 font-medium">End Posts</div>
                                            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mt-1"></div>
                                        </div>
                                        <div className="text-center p-2 bg-purple-50 rounded">
                                            <div className="text-2xl font-bold text-purple-700">{takeoff.postCounts.gatePosts}</div>
                                            <div className="text-xs text-purple-600 font-medium">Gate Posts</div>
                                            <div className="w-3 h-3 bg-purple-500 rounded-full mx-auto mt-1"></div>
                                        </div>
                                        <div className="text-center p-2 bg-red-50 rounded">
                                            <div className="text-2xl font-bold text-red-700">{takeoff.postCounts.cornerPosts}</div>
                                            <div className="text-xs text-red-600 font-medium">Corner Posts</div>
                                            <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mt-1"></div>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t text-center">
                                        <div className="text-2xl font-bold text-slate-900">{takeoff.postCounts.totalVinylPosts}</div>
                                        <div className="text-xs text-slate-500">Total Savannah Posts (includes {takeoff.postCounts.linePosts} line posts)</div>
                                    </div>
                                </div>
                                
                                {/* Savannah Line Items Audit */}
                                <div className="bg-white rounded-lg border-2 border-emerald-300 p-4 space-y-3">
                                    <h4 className="font-semibold text-sm text-emerald-900 flex items-center gap-2">
                                        📦 Savannah Material Audit
                                    </h4>
                                    <div className="space-y-2">
                                        {resolvedLineItems.filter(item => item.blockPricing).length > 0 && (
                                            <div className="bg-red-50 border-2 border-red-300 rounded p-3 space-y-1">
                                                <div className="font-semibold text-red-900 text-sm">⚠️ Unresolved Items</div>
                                                {resolvedLineItems.filter(item => item.blockPricing).map((item, idx) => (
                                                    <div key={idx} className="text-xs text-red-700">
                                                        • {item.lineItemName} - {item.savannahReason}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {resolvedLineItems.filter(item => item.savannahResolved).slice(0, 10).map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded">
                                                <div className="flex-1">
                                                    <div className="font-medium text-slate-900">{item.savannahName || item.displayName || item.lineItemName}</div>
                                                    <div className="text-slate-500">Qty: {item.quantityCalculated} {item.uom}</div>
                                                </div>
                                                {item.savannahCost && (
                                                    <div className="text-right">
                                                        <div className="font-semibold text-emerald-700">${item.savannahCost.toFixed(2)}</div>
                                                        <div className="text-slate-500">${(item.savannahCost * item.quantityCalculated).toFixed(2)}</div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        
                                        {resolvedLineItems.filter(item => item.savannahResolved).length > 10 && (
                                            <div className="text-xs text-slate-500 text-center pt-2">
                                                + {resolvedLineItems.filter(item => item.savannahResolved).length - 10} more items...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {takeoff && materialType === 'Wood' && takeoff.postCounts && (
                            <div className="bg-white rounded-lg border-2 border-amber-300 p-4 space-y-3">
                                <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                                    🪵 Wood Post Summary (4x4 Lifetime Steel)
                                </h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center p-2 bg-amber-50 rounded border border-amber-200">
                                        <div className="text-lg font-bold text-amber-700">{takeoff.postCounts.terminalPosts}</div>
                                        <div className="text-[10px] text-amber-600 font-medium">Terminal</div>
                                        <div className="text-[9px] text-amber-500 mt-1">DRIVEN</div>
                                    </div>
                                    <div className="text-center p-2 bg-blue-50 rounded border-2 border-blue-300">
                                        <div className="text-lg font-bold text-blue-700">{takeoff.postCounts.gatePosts}</div>
                                        <div className="text-[10px] text-blue-600 font-medium">Gate</div>
                                        <div className="text-[9px] text-blue-500 mt-1">CONCRETE</div>
                                    </div>
                                    <div className="text-center p-2 bg-emerald-50 rounded border border-emerald-200">
                                        <div className="text-lg font-bold text-emerald-700">{takeoff.postCounts.totalPosts - takeoff.postCounts.terminalPosts - takeoff.postCounts.gatePosts}</div>
                                        <div className="text-[10px] text-emerald-600 font-medium">Line (8')</div>
                                        <div className="text-[9px] text-emerald-500 mt-1">DRIVEN</div>
                                    </div>
                                </div>
                                <div className="pt-2 border-t-2 text-center bg-slate-50 rounded p-2">
                                    <div className="text-2xl font-bold text-slate-900">{takeoff.postCounts.totalPosts}</div>
                                    <div className="text-xs text-slate-500 font-semibold">Total 4x4 Lifetime Steel Posts</div>
                                    <div className="text-[10px] text-slate-400 mt-1">
                                        Terminal: {takeoff.postCounts.terminalPosts} | Gate: {takeoff.postCounts.gatePosts} | Line: {takeoff.postCounts.totalPosts - takeoff.postCounts.terminalPosts - takeoff.postCounts.gatePosts}
                                    </div>
                                </div>
                                
                                {takeoff.metrics && (
                                    <div className="pt-3 border-t space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Concrete Bags (gate posts only):</span>
                                            <span className="font-semibold text-blue-700">{takeoff.metrics.concreteBags}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Rail Boards (2x4x8):</span>
                                            <span className="font-semibold">{takeoff.metrics.railBoards}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Pickets:</span>
                                            <span className="font-semibold">{takeoff.metrics.pickets}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {takeoff && materialType === 'Aluminum' && takeoff.postCounts && (
                            <div className="bg-white rounded-lg border p-4 space-y-3">
                                <h4 className="font-semibold text-sm text-slate-900">Aluminum Post & Panel Summary</h4>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="text-center p-2 bg-green-50 rounded">
                                        <div className="text-lg font-bold text-green-700">{takeoff.postCounts.endPosts}</div>
                                        <div className="text-[10px] text-green-600 font-medium">End</div>
                                        <div className="w-2 h-2 bg-green-500 rounded-full mx-auto mt-1"></div>
                                    </div>
                                    <div className="text-center p-2 bg-purple-50 rounded">
                                        <div className="text-lg font-bold text-purple-700">{takeoff.postCounts.gatePosts}</div>
                                        <div className="text-[10px] text-purple-600 font-medium">Gate</div>
                                        <div className="w-2 h-2 bg-purple-500 rounded-full mx-auto mt-1"></div>
                                    </div>
                                    <div className="text-center p-2 bg-red-50 rounded">
                                        <div className="text-lg font-bold text-red-700">{takeoff.postCounts.cornerPosts}</div>
                                        <div className="text-[10px] text-red-600 font-medium">Corner</div>
                                        <div className="w-2 h-2 bg-red-500 rounded-full mx-auto mt-1"></div>
                                    </div>
                                    <div className="text-center p-2 bg-blue-50 rounded">
                                        <div className="text-lg font-bold text-blue-700">{takeoff.postCounts.linePosts}</div>
                                        <div className="text-[10px] text-blue-600 font-medium">Line</div>
                                        <div className="w-2 h-2 bg-blue-500 rounded-full mx-auto mt-1"></div>
                                    </div>
                                </div>
                                <div className="pt-2 border-t text-center">
                                    <div className="text-2xl font-bold text-slate-900">{takeoff.postCounts.totalPosts}</div>
                                    <div className="text-xs text-slate-500">Total Posts (ALL CONCRETE)</div>
                                </div>
                                
                                {takeoff.metrics && (
                                    <div className="pt-3 border-t space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Aluminum Panels (6' max):</span>
                                            <span className="font-semibold text-blue-700">{takeoff.metrics.totalPanels}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Concrete Bags (all posts):</span>
                                            <span className="font-semibold">{takeoff.metrics.concreteBags}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-white rounded-lg border">
                                <div className="text-xs text-slate-500 mb-1">Total Runs on Map</div>
                                <div className="text-2xl font-bold text-slate-900">{totalRuns}</div>
                            </div>
                            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                <div className="text-xs text-emerald-600 mb-1">Included in Takeoff</div>
                                <div className="text-2xl font-bold text-emerald-700">{newCount}</div>
                                <div className="text-xs text-emerald-600 mt-1">{totalNewFootage.toFixed(1)} LF</div>
                            </div>
                        </div>
                        

                        {/* New Runs (Included) with Bay Details */}
                        {runDetails.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                                    <h4 className="font-semibold text-sm text-emerald-900">
                                        Eligible Runs (Included in Materials & PO)
                                    </h4>
                                </div>
                                <div className="space-y-1 pl-6">
                                    {runDetails.map((run, idx) => (
                                        <div key={idx} className="text-xs bg-white p-3 rounded border">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-semibold text-slate-700">
                                                    {run.label}
                                                </span>
                                                <span className="text-slate-500">
                                                    {run.lengthFt.toFixed(1)} LF
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 text-slate-600">
                                                <div>
                                                    <div className="text-[10px] text-slate-400">BAYS</div>
                                                    <div className="font-semibold">{run.bays}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-400">POSTS</div>
                                                    <div className="font-semibold">{run.posts}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-400">F.RAILS</div>
                                                    <div className="font-semibold">{run.rails}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-400">GATES</div>
                                                    <div className="font-semibold">{run.gateCount}{run.gateRails > 0 ? ` (${run.gateRails}R)` : ''}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Existing Runs (Excluded) */}
                        {existingRuns.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <XCircle className="w-4 h-4 text-slate-500" />
                                    <h4 className="font-semibold text-sm text-slate-700">
                                        Existing Runs (Excluded from Takeoff)
                                    </h4>
                                </div>
                                <div className="space-y-1 pl-6">
                                    {existingRuns.map((run, idx) => (
                                        <div key={idx} className="text-sm flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200">
                                            <span className="text-slate-600">
                                                {run.orientationLabel || `Run ${idx + 1}`}
                                            </span>
                                            <span className="text-slate-400">
                                                {(run.manualLengthFt || run.length || 0).toFixed(1)} LF
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-xs text-slate-500 italic pl-6">
                                    Total excluded: {totalExistingFootage.toFixed(1)} LF
                                </div>
                            </div>
                        )}
                        
                        {/* Remove Runs (Excluded) */}
                        {removeRuns.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                    <h4 className="font-semibold text-sm text-red-700">
                                        Remove/Tear Out (Not in Takeoff)
                                    </h4>
                                </div>
                                <div className="space-y-1 pl-6">
                                    {removeRuns.map((run, idx) => (
                                        <div key={idx} className="text-sm flex items-center justify-between bg-red-50 p-2 rounded border border-red-200">
                                            <span className="text-red-600">
                                                {run.orientationLabel || `Run ${idx + 1}`}
                                            </span>
                                            <span className="text-red-400">
                                                {(run.manualLengthFt || run.length || 0).toFixed(1)} LF
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Safety Check */}
                        {totalRuns > 0 && newCount === 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-amber-900">
                                        <strong>Warning:</strong> No new runs included in takeoff. 
                                        All runs are marked as Existing or Remove. No materials will be ordered.
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}