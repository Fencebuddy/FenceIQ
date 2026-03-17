import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { resolveSavannahLineItems } from "@/components/materials/SavannahAuditResolver";
import { resolveLineItemsWithMappings } from "@/components/materials/universalResolver";

export default function VariantMaterialsComparison({ compareData, catalog, job, companyId }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [resolvedData, setResolvedData] = useState({});

    if (!compareData?.a || !compareData?.b || !compareData?.c) {
        return (
            <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                    <div className="text-sm text-amber-800">No comparison data available</div>
                </CardContent>
            </Card>
        );
    }

    // Resolve variants using Universal Resolver
    React.useEffect(() => {
        (async () => {
            const resolved = {};

            for (const variantKey of ['a', 'b', 'c']) {
                const variant = compareData[variantKey];
                const variantMaterial = variant?.runs?.[0]?.materialType;

                if (!variant?.lineItems?.length) continue;

                // Normalize to UCK for resolution
                let variantLineItems = variant.lineItems;
                if (variantMaterial === 'Vinyl') {
                    const fenceColor = variant?.runs?.[0]?.fenceColor;
                    variantLineItems = resolveSavannahLineItems(variant.lineItems, job, fenceColor).map(item => ({
                        ...item,
                        uck: item.savannahResolved ? item.savannahName : (item.canonical_key || item.canonicalKey)
                    }));
                } else {
                    variantLineItems = variant.lineItems.map(item => ({
                        ...item,
                        uck: item.uck || item.canonical_key || item.canonicalKey
                    }));
                }

                // Universal Resolver
                const result = await resolveLineItemsWithMappings({
                    companyId: companyId || job?.companyId || 'default',
                    lineItems: variantLineItems,
                    catalog
                });

                resolved[variantKey] = result.lineItems.map(i => ({
                    canonical_key: i.uck || i.canonical_key,
                    lineItemName: i.lineItemName || i.displayName,
                    quantityCalculated: i.quantityCalculated || i.qty || 0,
                    uom: i.uom,
                    unitCost: i.resolved ? i.unit_cost : 0,
                    extCost: i.resolved ? i.extended_cost : 0,
                    catalogItem: i.resolved ? {
                        id: i.catalog_id,
                        crm_name: i.catalog_name,
                        finish: i.finish || ''
                    } : null,
                    resolved: i.resolved
                }));
            }

            setResolvedData(resolved);
        })();
    }, [compareData, job, companyId, catalog]);

    const materialsA = resolvedData.a || [];
    const materialsB = resolvedData.b || [];
    const materialsC = resolvedData.c || [];

    // Get all unique canonical keys across variants
    const allKeys = new Set([
        ...materialsA.map(m => m.canonical_key),
        ...materialsB.map(m => m.canonical_key),
        ...materialsC.map(m => m.canonical_key)
    ]);

    // Group by canonical key for comparison
    const comparisonRows = Array.from(allKeys).map(key => {
        const a = materialsA.find(m => m.canonical_key === key);
        const b = materialsB.find(m => m.canonical_key === key);
        const c = materialsC.find(m => m.canonical_key === key);
        return { key, a, b, c };
    });

    // Calculate totals
    const totalA = materialsA.reduce((sum, m) => sum + (m.extCost || 0), 0);
    const totalB = materialsB.reduce((sum, m) => sum + (m.extCost || 0), 0);
    const totalC = materialsC.reduce((sum, m) => sum + (m.extCost || 0), 0);

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm">Full Material Comparison (Side-by-Side)</CardTitle>
                        <div className="text-xs text-slate-500 mt-2">
                            Verify each variant has correct material costs for its color/type
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                </div>
            </CardHeader>
            {isExpanded && (
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[1200px]">
                        <thead>
                            <tr className="border-b-2">
                                <th className="text-left py-2 px-3 font-semibold bg-slate-50">Material (Canonical Key)</th>
                                
                                {/* Variant A */}
                                <th colSpan="4" className="text-center py-2 px-3 font-semibold bg-blue-50 border-l border-l-slate-200">
                                    <Badge className="bg-blue-600">Variant A: {compareData.a?.variantMaterial} {compareData.a?.variantColor}</Badge>
                                </th>

                                {/* Variant B */}
                                <th colSpan="4" className="text-center py-2 px-3 font-semibold bg-amber-50 border-l border-l-slate-200">
                                    <Badge className="bg-amber-600">Variant B: {compareData.b?.variantMaterial} {compareData.b?.variantColor}</Badge>
                                </th>

                                {/* Variant C */}
                                <th colSpan="4" className="text-center py-2 px-3 font-semibold bg-slate-100 border-l border-l-slate-200">
                                    <Badge className="bg-slate-700">Variant C: {compareData.c?.variantMaterial} {compareData.c?.variantColor}</Badge>
                                </th>
                            </tr>
                            <tr className="border-b">
                                <th className="text-left py-2 px-3 text-xs font-semibold bg-slate-50">Item Name</th>
                                
                                <th className="text-right py-2 px-2 text-xs font-semibold bg-blue-50">Qty</th>
                                <th className="text-right py-2 px-2 text-xs font-semibold bg-blue-50">Unit Cost</th>
                                <th className="text-right py-2 px-2 text-xs font-semibold bg-blue-50">Catalog</th>
                                <th className="text-right py-2 px-2 text-xs font-semibold bg-blue-50">Ext Cost</th>
                                
                                <th className="text-right py-2 px-2 text-xs font-semibold bg-amber-50 border-l">Qty</th>
                                <th className="text-right py-2 px-2 text-xs font-semibold bg-amber-50">Unit Cost</th>
                                <th className="text-right py-2 px-2 text-xs font-semibold bg-amber-50">Catalog</th>
                                <th className="text-right py-2 px-2 text-xs font-semibold bg-amber-50">Ext Cost</th>
                                
                                <th className="text-right py-2 px-2 text-xs font-semibold bg-slate-100 border-l">Qty</th>
                                <th className="text-right py-2 px-2 text-xs font-semibold bg-slate-100">Unit Cost</th>
                                <th className="text-right py-2 px-2 text-xs font-semibold bg-slate-100">Catalog</th>
                                <th className="text-right py-2 px-2 text-xs font-semibold bg-slate-100">Ext Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparisonRows.map((row, idx) => (
                                <tr key={idx} className="border-b hover:bg-slate-50">
                                    <td className="py-2 px-3">
                                        <div className="font-mono text-xs text-slate-600">{row.key}</div>
                                    </td>
                                    
                                    {/* Variant A Cells */}
                                    <td className="text-right py-2 px-2 bg-blue-50">{row.a?.quantityCalculated?.toFixed(2) || "-"}</td>
                                    <td className="text-right py-2 px-2 bg-blue-50">${row.a?.unitCost?.toFixed(2) || "0.00"}</td>
                                    <td className="py-2 px-2 bg-blue-50">
                                        {(() => {
                                            const qtyNum = Number(row.a?.quantityCalculated);
                                            if (!row.a?.quantityCalculated || !isFinite(qtyNum) || qtyNum <= 0) {
                                                return "—";
                                            }
                                            return row.a?.catalogItem ? (
                                                <div className="text-xs">
                                                    <div className="font-medium text-slate-900">{row.a.catalogItem.crm_name}</div>
                                                    <div className="text-slate-500">{row.a.catalogItem.finish || "-"}</div>
                                                </div>
                                            ) : (
                                                <span className="text-red-600 font-semibold">MISSING</span>
                                            );
                                        })()}
                                    </td>
                                    <td className="text-right py-2 px-2 bg-blue-50 font-semibold">${row.a?.extCost?.toFixed(2) || "0.00"}</td>
                                    
                                    {/* Variant B Cells */}
                                    <td className="text-right py-2 px-2 bg-amber-50 border-l">{row.b?.quantityCalculated?.toFixed(2) || "-"}</td>
                                    <td className="text-right py-2 px-2 bg-amber-50">${row.b?.unitCost?.toFixed(2) || "0.00"}</td>
                                    <td className="py-2 px-2 bg-amber-50">
                                        {(() => {
                                            const qtyNum = Number(row.b?.quantityCalculated);
                                            if (!row.b?.quantityCalculated || !isFinite(qtyNum) || qtyNum <= 0) {
                                                return "—";
                                            }
                                            return row.b?.catalogItem ? (
                                                <div className="text-xs">
                                                    <div className="font-medium text-slate-900">{row.b.catalogItem.crm_name}</div>
                                                    <div className="text-slate-500">{row.b.catalogItem.finish || "-"}</div>
                                                </div>
                                            ) : (
                                                <span className="text-red-600 font-semibold">MISSING</span>
                                            );
                                        })()}
                                    </td>
                                    <td className="text-right py-2 px-2 bg-amber-50 font-semibold">${row.b?.extCost?.toFixed(2) || "0.00"}</td>
                                    
                                    {/* Variant C Cells */}
                                    <td className="text-right py-2 px-2 bg-slate-100 border-l">{row.c?.quantityCalculated?.toFixed(2) || "-"}</td>
                                    <td className="text-right py-2 px-2 bg-slate-100">${row.c?.unitCost?.toFixed(2) || "0.00"}</td>
                                    <td className="py-2 px-2 bg-slate-100">
                                        {(() => {
                                            const qtyNum = Number(row.c?.quantityCalculated);
                                            if (!row.c?.quantityCalculated || !isFinite(qtyNum) || qtyNum <= 0) {
                                                return "—";
                                            }
                                            return row.c?.catalogItem ? (
                                                <div className="text-xs">
                                                    <div className="font-medium text-slate-900">{row.c.catalogItem.crm_name}</div>
                                                    <div className="text-slate-500">{row.c.catalogItem.finish || "-"}</div>
                                                </div>
                                            ) : (
                                                <span className="text-red-600 font-semibold">MISSING</span>
                                            );
                                        })()}
                                    </td>
                                    <td className="text-right py-2 px-2 bg-slate-100 font-semibold">${row.c?.extCost?.toFixed(2) || "0.00"}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 font-bold">
                                <td className="py-3 px-3">TOTAL MATERIAL COST</td>
                                <td colSpan="4" className="text-right py-3 px-2 bg-blue-50 text-blue-700 text-sm">
                                    ${totalA.toFixed(2)}
                                </td>
                                <td colSpan="4" className="text-right py-3 px-2 bg-amber-50 text-amber-700 text-sm border-l">
                                    ${totalB.toFixed(2)}
                                </td>
                                <td colSpan="4" className="text-right py-3 px-2 bg-slate-100 text-slate-700 text-sm border-l">
                                    ${totalC.toFixed(2)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                
                {/* Price Variance Check */}
                <div className="mt-6 p-4 bg-slate-50 rounded border border-slate-200">
                    <div className="text-sm font-semibold text-slate-900 mb-3">Price Verification</div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <div className="font-semibold text-blue-700">Variant A ({compareData.a?.variantMaterial} {compareData.a?.variantColor})</div>
                            <div className="text-slate-600">${totalA.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="font-semibold text-amber-700">Variant B ({compareData.b?.variantMaterial} {compareData.b?.variantColor})</div>
                            <div className="text-slate-600">${totalB.toFixed(2)}</div>
                            <div className="text-xs text-slate-500 mt-1">
                                {totalB > totalA ? `+$${(totalB - totalA).toFixed(2)} vs A` : `$${Math.abs(totalB - totalA).toFixed(2)} vs A`}
                            </div>
                        </div>
                        <div>
                            <div className="font-semibold text-slate-700">Variant C ({compareData.c?.variantMaterial} {compareData.c?.variantColor})</div>
                            <div className="text-slate-600">${totalC.toFixed(2)}</div>
                            <div className="text-xs text-slate-500 mt-1">
                                {totalC > totalA ? `+$${(totalC - totalA).toFixed(2)} vs A` : `$${Math.abs(totalC - totalA).toFixed(2)} vs A`}
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
            )}
        </Card>
    );
}