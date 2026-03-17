import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { resolveSavannahLineItems } from '@/components/materials/SavannahAuditResolver';
import { resolveLineItemsWithMappings } from '@/components/materials/universalResolver';

/**
 * VariantMaterialsDetail
 * Shows full line-item list with quantities and costs for each variant (A, B, C)
 */
export default function VariantMaterialsDetail({ compareData, catalog, job, companyId }) {
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [resolvedData, setResolvedData] = useState({});

    if (!compareData?.a || !compareData?.b || !compareData?.c) {
        return null;
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
                    categoryTag: i.categoryTag || 'Other',
                    quantityCalculated: i.quantityCalculated || i.qty || 0,
                    uom: i.uom,
                    unit_cost: i.resolved ? i.unit_cost : 0,
                    ext_cost: i.resolved ? i.extended_cost : 0,
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

    /**
     * Group items by category
     */
    const groupByCategory = (items) => {
        const groups = {};
        items.forEach(item => {
            const key = item.categoryTag || 'Other';
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
        });
        return groups;
    };

    /**
     * Render a single variant's materials
     */
    const renderVariantMaterials = (variantKey) => {
        const items = resolvedData[variantKey] || [];
        const grouped = groupByCategory(items);
        const categories = Object.keys(grouped).sort();

        return (
            <div className="space-y-3">
                {categories.map(category => {
                    const categoryItems = grouped[category];
                    const categoryExpanded = expandedCategory === `${variantKey}-${category}`;
                    const categoryTotal = categoryItems.reduce((sum, item) => sum + (item.ext_cost || 0), 0);

                    return (
                        <div key={category} className="border rounded-lg overflow-hidden">
                            {/* Category Header */}
                            <button
                                onClick={() => {
                                    const key = `${variantKey}-${category}`;
                                    setExpandedCategory(categoryExpanded ? null : key);
                                }}
                                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    {categoryExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-slate-600" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-slate-600" />
                                    )}
                                    <span className="font-semibold text-slate-900">{category}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="text-xs">
                                        {categoryItems.length} items
                                    </Badge>
                                    <div className="text-sm font-semibold text-slate-700">
                                        ${categoryTotal.toFixed(2)}
                                    </div>
                                </div>
                            </button>

                            {/* Category Items */}
                            {categoryExpanded && (
                                <div className="divide-y">
                                    {categoryItems.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className={`p-3 ${!item.resolved ? 'bg-amber-50' : 'bg-white'}`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="font-medium text-slate-900">
                                                        {item.lineItemName}
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-mono mt-1">
                                                        {item.canonical_key}
                                                    </div>
                                                    {item.catalogItem && (
                                                        <div className="text-xs text-slate-600 mt-1">
                                                            {item.catalogItem.crm_name}
                                                        </div>
                                                    )}
                                                    {!item.resolved && (
                                                        <Badge className="mt-2 bg-amber-200 text-amber-900 text-xs">
                                                            Unresolved
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-right ml-4 whitespace-nowrap">
                                                    <div className="text-sm">
                                                        {item.quantityCalculated?.toFixed(2)} {item.uom}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        ${item.unit_cost.toFixed(2)}/unit
                                                    </div>
                                                    <div className="font-semibold text-slate-900 mt-1 text-base">
                                                        ${item.ext_cost.toFixed(2)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Total */}
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-blue-900">Total Material Cost</span>
                        <span className="text-xl font-bold text-blue-700">
                            ${items.reduce((sum, item) => sum + (item.ext_cost || 0), 0).toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card className="mb-4">
            <CardHeader>
                <CardTitle className="text-sm">Variant Materials (Detailed)</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="a" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="a" className="text-xs sm:text-sm">
                            A: Good
                        </TabsTrigger>
                        <TabsTrigger value="b" className="text-xs sm:text-sm">
                            B: Better
                        </TabsTrigger>
                        <TabsTrigger value="c" className="text-xs sm:text-sm">
                            C: Best
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="a" className="mt-4">
                        {renderVariantMaterials('a')}
                    </TabsContent>

                    <TabsContent value="b" className="mt-4">
                        {renderVariantMaterials('b')}
                    </TabsContent>

                    <TabsContent value="c" className="mt-4">
                        {renderVariantMaterials('c')}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}