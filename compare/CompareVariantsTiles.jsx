import React, { useMemo, useState } from 'react';
import { useCompareTakeoffStore } from '@/components/stores/useCompareTakeoffStore';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { computePricing } from '@/components/pricing/computePricing';
import { resolveSavannahLineItems } from '@/components/materials/SavannahAuditResolver';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

// ============================================================================
// HELPERS
// ============================================================================

const toNum = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
const isResolvedCost = (unitCost) => toNum(unitCost) > 0;

/**
 * Map coating token to UI display label
 * @param {string} coatingToken - 'galv', 'black_vinyl', 'aluminized'
 * @returns {string} Display label
 */
const mapCoatingTokenToLabel = (coatingToken) => {
  const token = String(coatingToken || '').trim().toLowerCase();
  const map = {
    'galv': 'Galvanized',
    'black_vinyl': 'Black Vinyl Coated',
    'aluminized': 'Aluminized'
  };
  return map[token] || 'Unknown';
};

/**
 * Count gates by type from variant lineItems
 */
function getGateCountsFromVariant(variantData) {
  const items = variantData?.lineItems || [];
  const single = items.filter(i =>
    String(i.canonical_key || "").includes("gate_single")
  ).length;
  const dbl = items.filter(i =>
    String(i.canonical_key || "").includes("gate_double")
  ).length;
  return { single, double: dbl, total: single + dbl };
}

/**
 * Gate parity check removed — variants can have different gate counts
 * Gates resolve independently by canonical key
 */
function checkGateParity(variantsByKey) {
  return {
    same: true,
    counts: {},
    error: null,
  };
}

/**
 * Build pricing view for a single variant
 */
function buildVariantPricingView(
  variantKey,
  variantData,
  job,
  catalog,
  catalogLinkMap,
  gateParityError
) {
  const linkLookup = new Map();
  catalogLinkMap.forEach(link => linkLookup.set(link.canonical_key, link));

  const runs0 = variantData?.runs?.[0] || {};
  const material_type = runs0.materialType || job?.materialType;
  const fenceHeight = runs0.fenceHeight || job?.fenceHeight;
  const fenceColor = runs0.fenceColor || job?.fenceColor;

  // Resolve line items with costs
  let resolvedLineItems = variantData?.lineItems || [];
  if (material_type === 'Vinyl') {
    resolvedLineItems = resolveSavannahLineItems(
      variantData.lineItems,
      job,
      fenceColor,
      fenceHeight
    );
  }

  const unresolved = [];
  const resolvedForPricing = [];
  let totalMaterialCost = 0;

  resolvedLineItems.forEach(item => {
    const key = String(item.canonical_key || item.canonicalKey || "").trim();
    const qty = toNum(item.quantityCalculated || item.qty || 0);

    if (!key || qty <= 0) return;

    let unitCost = 0;
    let isResolved = false;

    if (item.savannahResolved && item.savannahCost !== undefined) {
      unitCost = item.savannahCost;
      isResolved = true;
    } else {
      const link = linkLookup.get(key);
      let catalogItem = null;

      if (link) {
        const matches = catalog.filter(c => c.id === link.catalog_item_id);
        catalogItem = matches[0];
      }



      if (catalogItem) {
        unitCost = catalogItem.cost || 0;
        isResolved = true;
      }
    }

    if (isResolvedCost(unitCost)) {
      const ext_cost = qty * unitCost;
      resolvedForPricing.push({ ...item, unitCost, qty, ext_cost });
      totalMaterialCost += ext_cost;
    } else {
      unresolved.push({
        canonical_key: key,
        qty,
        label: item.lineItemName || "",
      });
    }
  });

  // Determine if blocked
  const blockedReasons = [];
  if (unresolved.length > 0) blockedReasons.push(`${unresolved.length} unresolved items`);

  const isBlocked = blockedReasons.length > 0;

  let retailPricing = null;
  let discountedPricing = null;

  if (!isBlocked) {
    retailPricing = computePricing({
      material_cost: totalMaterialCost,
      total_lf: variantData?.total_lf || 0,
      labor_per_lf: 10,
      delivery_cost: 75,
      overhead_rate: 0.14,
      commission_rate: 0.10,
      max_discount: 0.15,
      material_type,
      discount_percentage: 0,
      tear_out_cost: 0,
      include_tear_out: false,
    });

    discountedPricing = computePricing({
      material_cost: totalMaterialCost,
      total_lf: variantData?.total_lf || 0,
      labor_per_lf: 10,
      delivery_cost: 75,
      overhead_rate: 0.14,
      commission_rate: 0.10,
      max_discount: 0.15,
      material_type,
      discount_percentage: 0.15,
      tear_out_cost: 0,
      include_tear_out: false,
    });
  }

  return {
    variantKey,
    material_type,
    fenceHeight,
    fenceColor,
    totalMaterialCost,
    unresolved,
    isBlocked,
    blockedReasons,
    retailPricing,
    discountedPricing,
  };
}

export default function CompareVariantsTiles({ jobId, runs }) {
  const [expandedDebug, setExpandedDebug] = useState({});
  const { getCompare } = useCompareTakeoffStore();
  const compareData = getCompare(jobId);

  // Fetch job and catalog for pricing
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => base44.entities.Job.filter({ id: jobId }),
    enabled: !!jobId,
  });
  const job = jobs[0];

  const { data: catalog = [] } = useQuery({
    queryKey: ['materialCatalog'],
    queryFn: () => base44.entities.MaterialCatalog.filter({ active: true }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: catalogLinkMap = [] } = useQuery({
    queryKey: ['catalogLinkMap'],
    queryFn: () => base44.entities.CatalogLinkMap.filter({ active: true }),
    staleTime: 5 * 60 * 1000,
  });

  // Calculate pricing for each variant
  const variantPricing = useMemo(() => {
    if (!compareData || !job || !catalog.length || !catalogLinkMap.length) return {};

    const variantsByKey = {
      a: compareData?.a,
      b: compareData?.b,
      c: compareData?.c,
    };

    // 1) Global gate parity check
    const gateParity = checkGateParity(variantsByKey);

    // 2) Build per-variant views
    const views = {
      a: buildVariantPricingView('a', variantsByKey.a, job, catalog, catalogLinkMap, gateParity.error),
      b: buildVariantPricingView('b', variantsByKey.b, job, catalog, catalogLinkMap, gateParity.error),
      c: buildVariantPricingView('c', variantsByKey.c, job, catalog, catalogLinkMap, gateParity.error),
    };

    return { views, gateParity };
  }, [compareData, job, catalog, catalogLinkMap]);

  if (!compareData) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p className="text-sm">Comparison variants not yet generated</p>
        <p className="text-xs mt-1">Edit runs to configure compare variants</p>
      </div>
    );
  }

  const { views: variantViews, gateParity } = variantPricing || {};

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-900">Material Comparison</h3>



      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['a', 'b', 'c'].map((key) => {
           const view = variantViews?.[key];
           const variantData = compareData?.[key];

           if (!view || !variantData) return null;

           // CRITICAL: Use variant materialSet (phase2 source of truth)
           const variantMaterialSet = variantData.variantMaterialSet;
           const runsVariant = variantData.runs?.[0];

           let variantAttribute = '';
           let debugInfo = null;

           if (variantMaterialSet?.materialType === 'Chain Link') {
             // Chain Link: ALWAYS compute from variantMaterialSet only
             // NO fallback to job or runs state
             const coatingLabel =
               variantMaterialSet.chainLinkCoating ||
               (variantMaterialSet.coating === 'black_vinyl' ? 'Black Vinyl Coated' :
                variantMaterialSet.coating === 'aluminized' ? 'Aluminized' :
                variantMaterialSet.coating === 'galv' ? 'Galvanized' :
                'Unknown');

             variantAttribute = coatingLabel;

             debugInfo = {
               source: 'variantMaterialSet',
               coating_token: variantMaterialSet.coating,
               chainLinkCoating_display: variantMaterialSet.chainLinkCoating,
               computed_label: variantAttribute,
               job_default: job?.chainLinkCoating,
               runs_fallback: runsVariant?.chainLinkCoating
             };
           } else if (variantMaterialSet?.materialType === 'Vinyl') {
             variantAttribute = variantMaterialSet.fenceColor || 'White';
           } else if (variantMaterialSet?.materialType === 'Wood') {
             variantAttribute = variantMaterialSet.fenceColor || 'Pine';
           } else if (variantMaterialSet?.materialType === 'Aluminum') {
             variantAttribute = variantMaterialSet.fenceColor || 'Black';
           } else {
             variantAttribute = 'Unknown';
           }

          return (
            <Card
              key={key}
              className={`border-2 ${
                view.isBlocked ? 'border-red-300 bg-red-50' : 'border-blue-200'
              } hover:shadow-lg transition-shadow`}
            >
              <CardHeader
                className={`pb-3 ${
                  view.isBlocked
                    ? 'bg-red-100'
                    : 'bg-gradient-to-br from-blue-50 to-white'
                }`}
              >
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="capitalize">Variant {key.toUpperCase()}</span>
                  <Badge variant="outline" className="text-xs">
                    {view.material_type}
                  </Badge>
                </CardTitle>
                <div className="text-xs text-slate-600 mt-1">
                  {view.fenceHeight} • {variantAttribute}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-sm">
                {/* Blocked Status Alert */}
                {view.isBlocked && (
                  <Alert className="border-red-400 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 text-xs">
                      <div className="font-semibold">⚠️ Pricing blocked</div>
                      <div className="mt-1 space-y-0.5">
                        {view.blockedReasons.map((reason, idx) => (
                          <div key={idx} className="text-[10px] text-red-700">
                            • {reason}
                          </div>
                        ))}
                        {view.unresolved.length > 0 && (
                          <>
                            <div className="text-[10px] text-red-700 mt-1 font-semibold">
                              Unresolved items:
                            </div>
                            {view.unresolved.map((item, idx) => (
                              <div key={idx} className="text-[10px] text-red-700 ml-2">
                                • {item.label || item.canonical_key} (qty: {item.qty})
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-600 font-semibold">Total LF</div>
                    <div className="text-lg font-bold text-slate-900">
                      {variantData.total_lf?.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600 font-semibold">Line Items</div>
                    <div className="text-lg font-bold text-blue-600">
                      {variantData.lineItems?.length || 0}
                    </div>
                  </div>
                </div>

                {/* Pricing Section */}
                {!view.isBlocked && view.retailPricing && view.discountedPricing && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="text-xs text-slate-600 font-semibold">Pricing</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Material:</span>
                        <span className="font-semibold">
                          ${view.totalMaterialCost?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Labor:</span>
                        <span className="font-semibold">
                          ${view.retailPricing.labor_cost?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span className="text-slate-600 text-[11px]">Retail:</span>
                        <span className="font-semibold text-purple-600">
                          ${view.retailPricing.retail_price?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-700 font-semibold">Your Price (15%):</span>
                        <span className="font-bold text-green-600">
                          ${view.discountedPricing.sale_price?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="text-xs text-slate-600 font-semibold mb-2">Post Breakdown</div>
                  {variantData.postCounts ? (
                    <div className="grid grid-cols-2 gap-y-1.5 text-xs font-mono">
                      <div className="text-slate-600">End:</div>
                      <div className="text-right font-semibold">
                        {variantData.postCounts.endPosts || 0}
                      </div>

                      <div className="text-slate-600">Corner:</div>
                      <div className="text-right font-semibold">
                        {variantData.postCounts.cornerPosts || 0}
                      </div>

                      <div className="text-slate-600">Gate:</div>
                      <div className="text-right font-semibold">
                        {variantData.postCounts.gatePosts || 0}
                      </div>

                      <div className="text-slate-600">Line:</div>
                      <div className="text-right font-semibold">
                        {variantData.postCounts.linePosts || 0}
                      </div>

                      <div className="border-t pt-1.5 font-semibold text-slate-900">
                        Total:
                      </div>
                      <div className="border-t pt-1.5 text-right font-bold text-blue-700">
                        {(variantData.postCounts.endPosts || 0) +
                          (variantData.postCounts.cornerPosts || 0) +
                          (variantData.postCounts.gatePosts || 0) +
                          (variantData.postCounts.linePosts || 0)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No post data</div>
                  )}
                </div>

                {/* Debug Toggle */}
                {view && (
                  <div className="border-t pt-3">
                    <button
                      onClick={() =>
                        setExpandedDebug(prev => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                      className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                    >
                      {expandedDebug[key] ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      Show pricing inputs
                    </button>
                    {expandedDebug[key] && (
                       <div className="mt-2 p-2 bg-slate-900 rounded text-[10px] space-y-0.5 font-mono border border-slate-700">
                         <div className="text-amber-400 font-semibold mb-1">🔍 PRICING INPUTS (TEMP DEBUG)</div>
                         <div>
                           <span className="text-slate-400">Material:</span>{' '}
                           <span className="text-blue-400">{view.material_type}</span>
                         </div>
                         <div>
                           <span className="text-slate-400">Height:</span>{' '}
                           <span className="text-blue-400">{view.fenceHeight}</span>
                         </div>

                         {/* Chain Link: Show variant materialSet vs map state */}
                         {view.material_type === 'Chain Link' && debugInfo && (
                           <>
                             <div className="border-t border-slate-600 pt-1 mt-1">
                               <div className="text-emerald-400 font-semibold text-[9px]">✅ VARIANT MATERIALSET (AUTHORITY):</div>
                               <div>
                                 <span className="text-slate-400">coating token:</span>{' '}
                                 <span className="text-emerald-400">{debugInfo.coating_token || '?'}</span>
                               </div>
                               <div>
                                 <span className="text-slate-400">chainLinkCoating (display):</span>{' '}
                                 <span className={debugInfo.coating_token === 'black_vinyl' ? 'text-emerald-300' : 'text-slate-300'}>
                                   {debugInfo.chainLinkCoating_display || '?'}
                                 </span>
                               </div>
                               <div className="mt-0.5">
                                 <span className="text-slate-400">→ COMPUTED LABEL:</span>{' '}
                                 <span className="text-lime-400 font-semibold">{debugInfo.computed_label}</span>
                               </div>
                             </div>
                             <div className="border-t border-slate-600 pt-1 mt-1">
                               <div className="text-red-400 font-semibold text-[9px]">⚠️ MAP STATE (FALLBACK ONLY):</div>
                               <div>
                                 <span className="text-slate-400">runs[0].chainLinkCoating:</span>{' '}
                                 <span className="text-red-400">{debugInfo.runs_fallback || '?'}</span>
                               </div>
                             </div>
                             <div className="border-t border-slate-600 pt-1 mt-1">
                               <div className="text-yellow-600 font-semibold text-[9px]">❌ JOB DEFAULT (SHOULD NOT BE USED):</div>
                               <div>
                                 <span className="text-slate-400">job.chainLinkCoating:</span>{' '}
                                 <span className="text-yellow-600">{debugInfo.job_default || '?'}</span>
                               </div>
                             </div>
                           </>
                         )}

                         {/* Vinyl: Show color */}
                         {(view.material_type === 'Vinyl' || view.material_type === 'Aluminum') && (
                           <div className="mt-1 border-t border-slate-600 pt-1">
                             <div>
                               <span className="text-slate-400">Color (fenceColor):</span>{' '}
                               <span className="text-blue-400">{variantData.runs?.[0]?.fenceColor || view.fenceColor || '?'}</span>
                             </div>
                           </div>
                         )}

                         <div className="border-t border-slate-600 pt-1 mt-1">
                           <span className="text-slate-400">Total LF:</span>{' '}
                           <span className="text-blue-400">{variantData.total_lf}</span>
                         </div>
                         <div>
                           <span className="text-slate-400">Material Cost:</span> $
                           <span className="text-blue-400">{view.totalMaterialCost?.toFixed(2)}</span>
                         </div>
                       </div>
                     )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}