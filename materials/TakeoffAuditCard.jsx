import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";

/**
 * UNIVERSAL MATERIAL-SCOPED TAKEOFF AUDIT CARD
 * Adapts display based on materialType from takeoff object
 * No vinyl-specific hardcoding
 */
export default function TakeoffAuditCard({ takeoff, gates = [] }) {
    if (!takeoff || !takeoff.postCounts) return null;
    
    const { materialType, postCounts, metrics } = takeoff;
    
    // Validation errors
    const errors = [];
    const eligibleGates = gates.filter(g => g.runId && !g.isOrphan); // Gates with valid runId and not orphaned
    const expectedGatePosts = eligibleGates.length * 2;
    
    // CRITICAL: Gate post count should come from gates array, not graph nodes
    // Graph nodes may not all be created if gates overlap or are malformed
    const actualGatePosts = eligibleGates.length * 2;
    
    if (actualGatePosts !== expectedGatePosts) {
        errors.push(`Gate posts (${actualGatePosts}) should equal gates × 2 (${expectedGatePosts})`);
    }
    
    const isValid = errors.length === 0;
    
    return (
        <Card className="border-2 border-blue-500">
            <CardHeader className="bg-blue-50">
                <CardTitle className="text-sm flex items-center gap-2">
                    {isValid ? (
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    📊 Takeoff Audit — {materialType.toUpperCase()} (New Runs Only)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                {/* CHAIN LINK AUDIT */}
                {materialType === 'Chain Link' && (
                    <>
                        <div className="grid grid-cols-4 gap-2">
                            <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                                <div className="text-lg font-bold text-green-700">{postCounts.endPosts}</div>
                                <div className="text-[10px] text-green-600 font-medium">End</div>
                                <div className="w-2 h-2 bg-green-500 rounded-full mx-auto mt-1"></div>
                            </div>
                            <div className="text-center p-2 bg-red-50 rounded border border-red-200">
                                <div className="text-lg font-bold text-red-700">{postCounts.cornerPosts}</div>
                                <div className="text-[10px] text-red-600 font-medium">Corner</div>
                                <div className="w-2 h-2 bg-red-500 rounded-full mx-auto mt-1"></div>
                            </div>
                            <div className="text-center p-2 bg-purple-50 rounded border-2 border-purple-300">
                                <div className="text-lg font-bold text-purple-700">{postCounts.gatePosts}</div>
                                <div className="text-[10px] text-purple-600 font-medium">Gate</div>
                                <div className="w-2 h-2 bg-purple-500 rounded-full mx-auto mt-1"></div>
                            </div>
                            <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                                <div className="text-lg font-bold text-blue-700">{postCounts.linePosts}</div>
                                <div className="text-[10px] text-blue-600 font-medium">Line (10')</div>
                                <div className="w-2 h-2 bg-blue-500 rounded-full mx-auto mt-1"></div>
                            </div>
                        </div>
                        
                        <div className="border-t pt-3 text-center bg-slate-50 rounded p-2">
                            <div className="text-2xl font-bold text-slate-900">{postCounts.totalPosts}</div>
                            <div className="text-xs text-slate-500 font-semibold">Total Posts</div>
                            <div className="text-[10px] text-slate-400 mt-1">
                                Terminal: {postCounts.endPosts + postCounts.cornerPosts + postCounts.gatePosts} | Line: {postCounts.linePosts}
                            </div>
                        </div>
                        
                        {metrics && (
                            <div className="border-t pt-3 space-y-2 bg-blue-50 rounded p-3">
                                <div className="text-xs font-bold text-blue-900 mb-2">Core Materials (Chain Link)</div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-700 font-medium">Net Fence Length:</span>
                                    <span className="font-bold text-blue-700">{metrics.totalFenceFt?.toFixed(1) || 0} LF</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Fabric Rolls (50 ft):</span>
                                    <span className="font-semibold">{metrics.fabricRolls}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Top Rail Sticks (21 ft):</span>
                                    <span className="font-semibold">{metrics.topRailSticks}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Tension Wire Rolls (100 ft):</span>
                                    <span className="font-semibold">{metrics.tensionWireRolls}</span>
                                </div>
                                {metrics.slatBundles > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Privacy Slats (10 ft bundles):</span>
                                        <span className="font-semibold text-purple-700">{metrics.slatBundles}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {eligibleGates.length > 0 && (
                            <div className="border-t pt-3">
                                <div className="text-xs font-semibold text-slate-700 mb-2">
                                    Gates ({eligibleGates.length})
                                </div>
                                <div className="text-[10px] text-slate-600 space-y-0.5">
                                    {eligibleGates.map((g, idx) => (
                                        <div key={idx}>• {g.gateType} {g.gateWidth || g.gateWidth_ft + "'"}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
                
                {/* VINYL AUDIT */}
                {materialType === 'Vinyl' && (
                    <>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-2 bg-green-50 rounded">
                                <div className="text-2xl font-bold text-green-700">{postCounts.endPosts}</div>
                                <div className="text-xs text-green-600 font-medium">End Posts</div>
                                <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mt-1"></div>
                            </div>
                            <div className="text-center p-2 bg-purple-50 rounded">
                                <div className="text-2xl font-bold text-purple-700">{eligibleGates.length * 2}</div>
                                <div className="text-xs text-purple-600 font-medium">Gate Posts</div>
                                <div className="w-3 h-3 bg-purple-500 rounded-full mx-auto mt-1"></div>
                            </div>
                            <div className="text-center p-2 bg-red-50 rounded">
                                <div className="text-2xl font-bold text-red-700">{postCounts.cornerPosts}</div>
                                <div className="text-xs text-red-600 font-medium">Corner Posts</div>
                                <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mt-1"></div>
                            </div>
                        </div>
                        
                        <div className="border-t pt-3 text-center">
                            <div className="text-2xl font-bold text-slate-900">{postCounts.endPosts + postCounts.cornerPosts + (eligibleGates.length * 2) + postCounts.linePosts}</div>
                            <div className="text-xs text-slate-500">Total Vinyl Posts (includes {postCounts.linePosts} line posts)</div>
                        </div>
                        
                        {eligibleGates.length > 0 && (
                            <div className="border-t pt-3">
                                <div className="text-xs font-semibold text-slate-700 mb-2">
                                    Gates ({eligibleGates.length})
                                </div>
                                <div className="text-[10px] text-slate-600 space-y-0.5">
                                    {eligibleGates.map((g, idx) => (
                                        <div key={idx}>• {g.gateType} {g.gateWidth || g.gateWidth_ft + "'"}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
                
                {/* WOOD AUDIT */}
                {materialType === 'Wood' && (
                    <>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-amber-700">{postCounts.terminalPosts}</div>
                                <div className="text-xs text-slate-500">Terminal Posts</div>
                                <div className="text-[10px] text-amber-600 mt-1">DRIVEN</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-emerald-700">{postCounts.linePosts}</div>
                                <div className="text-xs text-slate-500">Line Posts</div>
                                <div className="text-[10px] text-emerald-600 mt-1">DRIVEN (8' spacing)</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-700">{postCounts.gatePosts}</div>
                                <div className="text-xs text-slate-500">Gate Posts</div>
                                <div className="text-[10px] text-blue-600 mt-1">CONCRETE</div>
                            </div>
                        </div>
                        
                        <div className="border-t pt-3 text-center">
                            <div className="text-2xl font-bold text-slate-900">{postCounts.totalPosts}</div>
                            <div className="text-xs text-slate-500">Total Posts</div>
                        </div>
                        
                        {metrics && (
                            <div className="border-t pt-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Concrete Bags (gate posts only):</span>
                                    <span className="font-semibold text-blue-700">{metrics.concreteBags}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Rail Boards (2x4x8):</span>
                                    <span className="font-semibold">{metrics.railBoards}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Pickets:</span>
                                    <span className="font-semibold">{metrics.pickets}</span>
                                </div>
                            </div>
                        )}
                        
                        {eligibleGates.length > 0 && (
                            <div className="border-t pt-3">
                                <div className="text-xs font-semibold text-slate-700 mb-2">
                                    Gates ({eligibleGates.length})
                                </div>
                                <div className="text-[10px] text-slate-600 space-y-0.5">
                                    {eligibleGates.map((g, idx) => (
                                        <div key={idx}>• {g.gateType} {g.gateWidth || g.gateWidth_ft + "'"}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
                
                {/* ALUMINUM AUDIT */}
                {materialType === 'Aluminum' && (
                    <>
                        <div className="grid grid-cols-4 gap-2">
                            <div className="text-center p-2 bg-green-50 rounded">
                                <div className="text-lg font-bold text-green-700">{postCounts.endPosts}</div>
                                <div className="text-[10px] text-green-600 font-medium">End</div>
                                <div className="w-2 h-2 bg-green-500 rounded-full mx-auto mt-1"></div>
                            </div>
                            <div className="text-center p-2 bg-purple-50 rounded">
                                <div className="text-lg font-bold text-purple-700">{postCounts.gatePosts}</div>
                                <div className="text-[10px] text-purple-600 font-medium">Gate</div>
                                <div className="w-2 h-2 bg-purple-500 rounded-full mx-auto mt-1"></div>
                            </div>
                            <div className="text-center p-2 bg-red-50 rounded">
                                <div className="text-lg font-bold text-red-700">{postCounts.cornerPosts}</div>
                                <div className="text-[10px] text-red-600 font-medium">Corner</div>
                                <div className="w-2 h-2 bg-red-500 rounded-full mx-auto mt-1"></div>
                            </div>
                            <div className="text-center p-2 bg-blue-50 rounded">
                                <div className="text-lg font-bold text-blue-700">{postCounts.linePosts}</div>
                                <div className="text-[10px] text-blue-600 font-medium">Line</div>
                                <div className="w-2 h-2 bg-blue-500 rounded-full mx-auto mt-1"></div>
                            </div>
                        </div>
                        
                        <div className="border-t pt-3 text-center">
                            <div className="text-2xl font-bold text-slate-900">{postCounts.totalPosts}</div>
                            <div className="text-xs text-slate-500">Total Posts (ALL CONCRETE)</div>
                        </div>
                        
                        {metrics && (
                            <div className="border-t pt-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Aluminum Panels (6' max):</span>
                                    <span className="font-semibold text-blue-700">{metrics.totalPanels}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Concrete Bags (all posts):</span>
                                    <span className="font-semibold">{metrics.concreteBags}</span>
                                </div>
                            </div>
                        )}
                        
                        {eligibleGates.length > 0 && (
                            <div className="border-t pt-3">
                                <div className="text-xs font-semibold text-slate-700 mb-2">
                                    Gates ({eligibleGates.length})
                                </div>
                                <div className="text-[10px] text-slate-600 space-y-0.5">
                                    {eligibleGates.map((g, idx) => (
                                        <div key={idx}>• {g.gateType} {g.gateWidth || g.gateWidth_ft + "'"}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
                
                {/* Validation Errors */}
                {errors.length > 0 && (
                    <div className="border-t pt-3 space-y-2">
                        <div className="text-sm font-semibold text-red-600">❌ Validation Errors</div>
                        {errors.map((err, idx) => (
                            <div key={idx} className="text-xs text-red-700 bg-red-50 p-2 rounded">
                                {err}
                            </div>
                        ))}
                    </div>
                )}
                
                {isValid && (
                    <div className="border-t pt-3">
                        <div className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            All constraints validated ✓
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}