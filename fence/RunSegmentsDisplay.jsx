import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ruler, DoorOpen } from "lucide-react";

export default function RunSegmentsDisplay({ fenceLines, selectedLineIndex, isDragging }) {
    if (selectedLineIndex === null || !fenceLines[selectedLineIndex]) {
        return null;
    }
    
    // Hide breakdown while dragging
    if (isDragging) {
        return null;
    }

    const line = fenceLines[selectedLineIndex];
    
    // Get segments from window function
    const segments = typeof window !== 'undefined' && window.getGateSegments 
        ? window.getGateSegments(selectedLineIndex)
        : null;

    if (!segments) {
        return null;
    }

    // Calculate totals
    const totalFenceLF = segments
        .filter(s => s.type === 'fence')
        .reduce((sum, s) => sum + s.lengthFt, 0);
    
    const totalGateLF = segments
        .filter(s => s.type === 'gate')
        .reduce((sum, s) => sum + s.lengthFt, 0);

    return (
        <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Ruler className="w-5 h-5 text-emerald-600" />
                    Run Segment Breakdown
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-4 gap-3">
                    {line.isPerimeter && line.orientationLabel && (
                        <div className="bg-emerald-100 p-3 rounded-lg border border-emerald-300">
                            <div className="text-xs text-emerald-700 mb-1">Side</div>
                            <div className="text-sm font-bold text-emerald-900">{line.orientationLabel}</div>
                        </div>
                    )}
                    <div className="bg-white p-3 rounded-lg border border-emerald-200">
                        <div className="text-xs text-slate-500 mb-1">Total Length</div>
                        <div className="text-lg font-bold text-slate-900">{line.length.toFixed(1)} ft</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-emerald-200">
                        <div className="text-xs text-slate-500 mb-1">Fence LF</div>
                        <div className="text-lg font-bold text-emerald-600">{totalFenceLF.toFixed(1)} ft</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-emerald-200">
                        <div className="text-xs text-slate-500 mb-1">Gate LF</div>
                        <div className="text-lg font-bold text-amber-600">{totalGateLF.toFixed(1)} ft</div>
                    </div>
                </div>

                {/* Segments Table */}
                <div className="bg-white rounded-lg border border-emerald-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-emerald-100 border-b border-emerald-200">
                                <th className="text-left p-2 font-semibold text-emerald-900">#</th>
                                <th className="text-left p-2 font-semibold text-emerald-900">Type</th>
                                <th className="text-right p-2 font-semibold text-emerald-900">Start (ft)</th>
                                <th className="text-right p-2 font-semibold text-emerald-900">End (ft)</th>
                                <th className="text-right p-2 font-semibold text-emerald-900">Length (ft)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {segments.map((segment, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                                    <td className="p-2 text-slate-600">{idx + 1}</td>
                                    <td className="p-2">
                                        {segment.type === 'fence' ? (
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                                                <Ruler className="w-3 h-3 mr-1" />
                                                Fence
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                                <DoorOpen className="w-3 h-3 mr-1" />
                                                Gate ({segment.gate.widthFt}')
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="p-2 text-right text-slate-600">{segment.startFt.toFixed(1)}</td>
                                    <td className="p-2 text-right text-slate-600">{segment.endFt.toFixed(1)}</td>
                                    <td className="p-2 text-right font-semibold text-slate-900">{segment.lengthFt.toFixed(1)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Gate Details */}
                {segments.filter(s => s.type === 'gate').length > 0 && (
                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-slate-700 mb-3">Gate Fence Breakdown:</div>
                        {segments.filter(s => s.type === 'gate').map((segment, idx) => (
                            <div key={idx} className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg border-2 border-amber-300 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <DoorOpen className="w-5 h-5 text-amber-600" />
                                        <span className="font-bold text-slate-900">
                                            {segment.gate.type === 'gate' ? 'Single' : 'Double'} Gate ({segment.gate.widthFt} ft)
                                        </span>
                                    </div>
                                    <Badge className="bg-amber-600 text-white">
                                        {segment.startFt.toFixed(1)} - {segment.endFt.toFixed(1)} ft
                                    </Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white p-3 rounded-lg border border-emerald-300">
                                        <div className="text-xs text-slate-500 mb-1">← Fence Before Gate</div>
                                        <div className="text-2xl font-bold text-emerald-600">
                                            {segment.fenceImmediatelyBefore.toFixed(1)} ft
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            (Immediate fence segment before this gate)
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-emerald-300">
                                        <div className="text-xs text-slate-500 mb-1">Fence After Gate →</div>
                                        <div className="text-2xl font-bold text-emerald-600">
                                            {segment.fenceImmediatelyAfter.toFixed(1)} ft
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            (Immediate fence segment after this gate)
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mt-3 pt-3 border-t border-amber-200">
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-slate-600">Total fence from start to gate:</span>
                                            <span className="ml-2 font-semibold text-slate-700">
                                                {segment.leftFenceLengthFt.toFixed(1)} ft
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-600">Total fence from gate to end:</span>
                                            <span className="ml-2 font-semibold text-slate-700">
                                                {segment.rightFenceLengthFt.toFixed(1)} ft
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}