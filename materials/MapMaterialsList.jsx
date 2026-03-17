import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Map, Info, ChevronDown, ChevronUp, RefreshCw, Plus, Pencil, Trash2, RotateCcw, Calculator } from "lucide-react";
import {
    Alert,
    AlertDescription,
} from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { buildTakeoff } from './canonicalTakeoffEngine';
import TakeoffAuditCard from './TakeoffAuditCard';
import { resolveSavannahLineItems } from './SavannahAuditResolver';

export default function MapMaterialsList({ mapMaterials, materials, jobId, job, fenceLines, gates, onRefresh, onAddMaterial, onEditMaterial, onDeleteMaterial, onCalculate, isCalculating, isOpen = false, setIsOpen }) {
  const queryClient = useQueryClient();
  const [totalMaterialsOpen, setTotalMaterialsOpen] = React.useState(true);
  const [additionalOpen, setAdditionalOpen] = React.useState(false);

  // Fetch runs to get includeInCalculation status
  const { data: runs = [] } = useQuery({
    queryKey: ['runs', jobId],
    queryFn: () => base44.entities.Run.filter({ jobId }),
    enabled: !!jobId,
  });
  
  // Get canonical takeoff for audit (with posts from window)
  const takeoff = React.useMemo(() => {
    if (!job || !fenceLines || fenceLines.length === 0) return null;
    const posts = (typeof window !== 'undefined' && window.jobPostsForTakeoff) ? window.jobPostsForTakeoff : [];
    console.log('MapMaterialsList - Posts for takeoff:', posts.length);
    return buildTakeoff(job, fenceLines, runs, gates || [], posts);
  }, [job, fenceLines, runs, gates]);
  
  // Filter gates to current material scope
  const eligibleGates = React.useMemo(() => {
    if (!gates || !runs) return [];
    const currentMaterialType = job?.materialType;
    const eligibleRunIds = new Set(
      runs
        .filter(r => {
          const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
          const materialType = r.materialType || currentMaterialType;
          return status === 'new' && materialType === currentMaterialType;
        })
        .map(r => r.id)
    );
    return gates.filter(g => eligibleRunIds.has(g.runId));
  }, [gates, runs, job?.materialType]);

  // Merge map materials with database materials
  const mergedMaterials = React.useMemo(() => {
    if (!mapMaterials || mapMaterials.length === 0) return [];
    const merged = mapMaterials.map(mapMat => {
      const dbMat = materials?.find(m => m.lineItemName === mapMat.materialDescription);
      return {
        ...mapMat,
        id: dbMat?.id,
        manualOverrideQty: dbMat?.manualOverrideQty,
        calculatedQty: dbMat?.calculatedQty || mapMat.quantityCalculated,
        source: dbMat?.source || 'map'
      };
    });
    
    // CRITICAL: If vinyl, resolve through Savannah resolver
    if (job?.materialType === 'Vinyl') {
      return resolveSavannahLineItems(merged, job);
    }
    
    return merged;
  }, [mapMaterials, materials, job]);

  if (!mapMaterials || mapMaterials.length === 0) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="border-emerald-200 bg-emerald-50">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-emerald-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Map className="w-5 h-5 text-emerald-600" />
                  Materials List
                  {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </CardTitle>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Draw fence runs and add gates on the map above to see auto-calculated materials.
                </AlertDescription>
              </Alert>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

    // Group by run (filter out audit blocks)
    const materialsByRun = mergedMaterials
        .filter(item => item.runLabel !== '__AUDIT__')
        .reduce((acc, item) => {
            const key = item.runLabel || 'General';
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});

    // Filter additional (manual) materials
    const additionalMaterials = materials?.filter(m => m.source === 'manual') || [];

    // Calculate total materials (aggregate same items across all runs, exclude audit blocks)
    // Keep corner, end, and line posts separate for Aluminum
    const totalMaterials = [...mergedMaterials, ...additionalMaterials]
        .filter(item => item.runLabel !== '__AUDIT__')
        .reduce((acc, item) => {
            // CRITICAL: Use Savannah displayName for vinyl items
            const itemName = item.savannahName || item.displayName || item.materialDescription || item.lineItemName;
            const qty = item.manualOverrideQty ?? item.quantityCalculated ?? item.calculatedQty ?? item.quantity ?? 0;
            
            // Create unique keys for different post types to prevent aggregation
            const isCornerPost = itemName.toLowerCase().includes('corner');
            const isEndPost = itemName.toLowerCase().includes('end') && !itemName.toLowerCase().includes('corner');
            const isLinePost = itemName.toLowerCase().includes('line post');
            
            let key = itemName;
            if (isCornerPost) {
              key = itemName + '__CORNER__';
            } else if (isEndPost) {
              key = itemName + '__END__';
            } else if (isLinePost) {
              key = itemName + '__LINE__';
            }
            
            if (!acc[key]) {
                acc[key] = {
                    materialDescription: itemName, // Use original name for display
                    totalQty: 0,
                    uom: item.uom || item.unit,
                    sources: []
                };
            }
            
            acc[key].totalQty += qty;
            if (!acc[key].sources.includes(item.runLabel || 'Additional')) {
                acc[key].sources.push(item.runLabel || 'Additional');
            }
            
            return acc;
        }, {});

    const totalMaterialsArray = Object.values(totalMaterials).sort((a, b) => 
        a.materialDescription.localeCompare(b.materialDescription)
    );

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className="border-emerald-200 bg-emerald-50">
            <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 border-b border-emerald-200 cursor-pointer hover:bg-emerald-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Map className="w-5 h-5 text-emerald-600" />
                            <CardTitle className="text-sm">Materials List</CardTitle>
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
                                {mergedMaterials.length + additionalMaterials.length} items
                            </Badge>
                            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                        <div className="flex gap-2">
                            {onCalculate && (
                                <Button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCalculate();
                                    }}
                                    size="sm"
                                    disabled={isCalculating}
                                    className="bg-emerald-600 hover:bg-emerald-700 h-7 px-2 text-xs"
                                >
                                    {isCalculating ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Calculator className="w-3 h-3" />
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <CardContent className="p-0">
                {/* Takeoff Audit Card */}
                {takeoff && (
                  <div className="p-4 border-b border-emerald-200">
                    <TakeoffAuditCard 
                      takeoff={takeoff}
                      gates={eligibleGates}
                    />
                  </div>
                )}
                
                {/* Gate Information Summary */}
                {eligibleGates && eligibleGates.length > 0 && (
                  <div className="p-4 border-b border-emerald-200 bg-emerald-50">
                    <div className="mb-2">
                      <h4 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                        🚪 Gates Included ({eligibleGates.length})
                      </h4>
                    </div>
                    <div className="space-y-1 text-sm text-emerald-800">
                      {eligibleGates.filter(g => g.gateType === 'Single').length > 0 && (
                        <p className="font-medium">
                          • {eligibleGates.filter(g => g.gateType === 'Single').length} Single Gate{eligibleGates.filter(g => g.gateType === 'Single').length !== 1 ? 's' : ''}: {
                            eligibleGates.filter(g => g.gateType === 'Single').map(g => `${g.gateWidth_ft || g.gateWidth}'`).join(', ')
                          }
                        </p>
                      )}
                      {eligibleGates.filter(g => g.gateType === 'Double').length > 0 && (
                        <p className="font-medium">
                          • {eligibleGates.filter(g => g.gateType === 'Double').length} Double Gate{eligibleGates.filter(g => g.gateType === 'Double').length !== 1 ? 's' : ''}: {
                            eligibleGates.filter(g => g.gateType === 'Double').map(g => `${g.gateWidth_ft || g.gateWidth}'`).join(', ')
                          }
                        </p>
                      )}
                    </div>
                  </div>
                )}


                {/* Total Materials Section */}
                {totalMaterialsArray.length > 0 && (
                    <Collapsible open={totalMaterialsOpen} onOpenChange={setTotalMaterialsOpen}>
                        <div className="border-b-4 border-emerald-300">
                            <CollapsibleTrigger asChild>
                                <div className="bg-emerald-600 px-4 py-3 font-bold text-white text-sm flex items-center justify-between cursor-pointer hover:bg-emerald-700">
                                    <span>TOTAL MATERIALS (All Runs)</span>
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-white text-emerald-700">
                                            {totalMaterialsArray.length} items
                                        </Badge>
                                        {totalMaterialsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-emerald-100 border-b border-emerald-200">
                                        <th className="text-left p-3 font-semibold text-emerald-900">Material</th>
                                        <th className="text-right p-3 font-semibold text-emerald-900">Total Qty</th>
                                        <th className="text-left p-3 font-semibold text-emerald-900">Unit</th>
                                        <th className="text-left p-3 font-semibold text-emerald-900">Sources</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {totalMaterialsArray.map((item, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50'}>
                                            <td className="p-3 text-slate-900 font-medium">{item.materialDescription}</td>
                                            <td className="p-3 text-right font-bold text-emerald-700 text-base">
                                                {item.totalQty}
                                            </td>
                                            <td className="p-3 text-slate-600">{item.uom}</td>
                                            <td className="p-3 text-slate-600 text-xs">
                                                {item.sources.join(', ')}
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                    </table>
                                    </div>
                                    </CollapsibleContent>
                                    </div>
                                    </Collapsible>
                                    )}

                {/* Additional Materials Section */}
                {additionalMaterials.length > 0 && (
                    <Collapsible open={additionalOpen} onOpenChange={setAdditionalOpen}>
                        <div className="border-b border-emerald-200 last:border-b-0">
                            <CollapsibleTrigger asChild>
                                <div className="bg-amber-100 px-4 py-2 font-semibold text-amber-900 text-sm flex items-center gap-2 cursor-pointer hover:bg-amber-200">
                                    <span>Additional Materials</span>
                                    {additionalOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-white border-b border-emerald-200">
                                        <th className="text-left p-3 font-semibold text-emerald-900">Material</th>
                                        <th className="text-right p-3 font-semibold text-emerald-900">Qty</th>
                                        <th className="text-left p-3 font-semibold text-emerald-900">Unit</th>
                                        <th className="text-left p-3 font-semibold text-emerald-900">Notes</th>
                                        <th className="text-right p-3 font-semibold text-emerald-900">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {additionalMaterials.map((item, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50'}>
                                            <td className="p-3 text-slate-900">{item.lineItemName}</td>
                                            <td className="p-3 text-right font-semibold text-slate-900">
                                                {item.manualOverrideQty ?? item.calculatedQty ?? item.quantity}
                                            </td>
                                            <td className="p-3 text-slate-600">{item.unit}</td>
                                            <td className="p-3 text-slate-600 text-xs">{item.calculationDetails}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex gap-1 justify-end">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditMaterial(item)}>
                                                        <Pencil className="w-3 h-3" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => onDeleteMaterial(item)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                </table>
                                </div>
                                </CollapsibleContent>
                                </div>
                                </Collapsible>
                                )}

                                {/* Add Material Button */}
                <div className="p-4 border-t border-emerald-200 bg-white">
                    <Button 
                        onClick={onAddMaterial}
                        size="sm"
                        variant="outline"
                        className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Additional Material
                    </Button>
                </div>
                </CardContent>
            </CollapsibleContent>
        </Card>
        </Collapsible>
    );
}