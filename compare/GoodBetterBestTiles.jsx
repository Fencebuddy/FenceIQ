import React, { useMemo } from 'react';
import { useCompareTakeoffStore } from '@/components/stores/useCompareTakeoffStore';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from 'lucide-react';
import EngineAdapter from '@/components/engine/EngineAdapterV2';

export default function GoodBetterBestTiles({ jobId, selectedTier, onTierSelect, onSelectTier, onPricingComputed }) {
  const { getCompare } = useCompareTakeoffStore();
  const compareData = getCompare(jobId);
  const [tierPricing, setTierPricing] = React.useState({});

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => base44.entities.Job.filter({ id: jobId }),
    enabled: !!jobId,
  });
  const job = jobs[0];

  const { data: companySettings = [] } = useQuery({
    queryKey: ['companySettings'],
    queryFn: () => base44.entities.CompanySettings.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ['materialCatalog'],
    queryFn: () => base44.entities.MaterialCatalog.filter({ active: true }),
    staleTime: 5 * 60 * 1000,
  });

  // Extract stable values to prevent dependency churn
  const companyId = job?.companyId || companySettings[0]?.companyId || 'default';
  const catalogLength = catalog.length;

  // Build tier pricing using Universal Resolver
  React.useEffect(() => {
    if (!catalogLength || !compareData || !job) {
      setTierPricing({});
      return;
    }

    (async () => {
        const pricing = {};
        const tierNames = { a: 'GOOD', b: 'BETTER', c: 'BEST' };
        const tierColors = { a: 'blue', b: 'yellow', c: 'green' };

        for (const key of ['a', 'b', 'c']) {
          const variantData = compareData[key];
          if (!variantData?.lineItems?.length) continue;

          // Stagger API calls to avoid rate limits (500ms between tiers)
          await new Promise(resolve => setTimeout(resolve, 500));

          const variantMaterialType = variantData?.runs?.[0]?.materialType || job?.materialType;
          const variant_total_lf = variantData?.total_lf || 0;

          // V2 PIPELINE: Resolve via EngineAdapter
          const takeoffResult = {
            line_items: variantData.lineItems,
            total_lf: variant_total_lf,
            status: 'COMPLETE'
          };

          const resolveResult = await EngineAdapter.resolveTakeoff({
            jobId,
            variantKey: key.toUpperCase(),
            takeoffResult,
            companyId,
            catalog,
            job
          });

          const resolvedItems = (resolveResult.resolved_items || []).map(i => ({
            ...i,
            unit_cost: i.catalog_unit_cost || i.unit_cost,
            ext_cost: i.extended_cost || i.ext_cost
          }));

          const unresolvedItems = (resolveResult.unresolved_items || []).map(i => ({
            uck: i.uck,
            lineItemName: i.displayName || i.lineItemName,
            qty: i.qty || 0,
            unit: i.unit,
            reason: i.reason || 'UNMAPPED_UCK',
            variant_key: key.toUpperCase()
          }));

          // V2 PIPELINE: Compute pricing via EngineAdapter
          const pricingResult = await EngineAdapter.computePricing({
            jobId,
            variantKey: key.toUpperCase(),
            resolvedItems,
            unresolvedItems,
            takeoff_hash: `gbb_${key}`,
            total_lf: variant_total_lf,
            material_type: variantMaterialType,
            labor_per_lf: 10,
            tear_out_cost: 0,
            delivery_cost: 75,
            discount_percentage: 0,
            retail_anchor_override: null
          });

          // Block pricing if unresolved items exist
          const hasUnresolved = unresolvedItems.length > 0;

          pricing[key] = {
            tier: tierNames[key],
            color: tierColors[key],
            material_cost: !hasUnresolved && pricingResult.pricingStatus === 'COMPLETE' ? (pricingResult.pricing_breakdown?.material_cost || 0) : 0,
            retail_price: !hasUnresolved && pricingResult.pricingStatus === 'COMPLETE' ? (pricingResult.pricing_breakdown?.retail_price || pricingResult.pricing_breakdown?.sell_price || 0) : 0,
            total_lf: variant_total_lf,
            material: variantMaterialType || '?',
            pricing_status: hasUnresolved ? 'INCOMPLETE' : pricingResult.pricingStatus,
            unmapped_items: unresolvedItems,
            unresolved_count: unresolvedItems.length,
            blocked_reasons: pricingResult.blockedReasons || (hasUnresolved ? [{code: 'UNRESOLVED_ITEMS', message: `${unresolvedItems.length} items not mapped`}] : [])
          };
        }

        setTierPricing(pricing);
        if (onPricingComputed) {
          onPricingComputed(pricing);
        }
      })();
  }, [compareData, job?.id, job?.companyId, catalogLength, catalog, companyId, onPricingComputed]);

  const getMaterialImage = (variantData) => {
    const materialType = variantData.runs?.[0]?.materialType;
    const vinylColor = variantData.runs?.[0]?.fenceColor;
    const chainLinkCoating = variantData.runs?.[0]?.chainLinkCoating;

    console.log('[GBB Image Debug]', { materialType, vinylColor, chainLinkCoating });

    // Vinyl images
    if (materialType === 'Vinyl') {
      if (vinylColor === 'Black') {
        return 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/3e5bda36e_Untitleddesigncopy9.png';
      } else if (vinylColor === 'Two Tone') {
        return 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/a6ecab495_Untitleddesigncopy8.png';
      } else if (vinylColor === 'Grey' || vinylColor === 'Coastal Grey') {
        return 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/20abe1571_Untitleddesigncopy5.png';
      } else if (vinylColor === 'Tan') {
        return 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/985c8447a_Untitleddesigncopy6.png';
      } else if (vinylColor === 'Khaki') {
        return 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/541c7a1bd_Untitleddesigncopy7.png';
      } else if (vinylColor === 'Cedar Tone') {
        return 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/b6bfe6965_IMG_5803.jpeg';
      } else {
        // Default white vinyl
        return 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/ee0f7ac53_Untitleddesign.png';
      }
    }

    // Chain Link images
    if (materialType === 'Chain Link') {
      if (chainLinkCoating === 'Galvanized' || chainLinkCoating === 'Aluminized') {
        return 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/ffae133e2_IMG_5799.png';
      }
      if (chainLinkCoating === 'Black Vinyl Coated') {
        return 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/d8d3f944e_IMG_5798.png';
      }
      return null; // Other coatings will show placeholder
    }

    // Wood images
    if (materialType === 'Wood') {
      // Wood fence - default image (no color variations for wood)
      return 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/61a9c3538_IMG_5796.png';
    }

    // Aluminum images
    if (materialType === 'Aluminum') {
      if (vinylColor === 'Black') {
        return 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/14f0d675b_IMG_5795.png';
      }
      return null; // Other aluminum colors will show placeholder
    }

    return null;
  };

  const getTierStyles = (tier, isSelected) => {
    const baseStyles = 'border-2 transition-all duration-300 cursor-pointer transform hover:scale-105';
    switch(tier) {
      case 'GOOD':
        return `${baseStyles} ${isSelected ? 'border-blue-500 bg-blue-50 shadow-xl' : 'border-blue-200 bg-white hover:bg-blue-50 shadow-md hover:shadow-xl'}`;
      case 'BETTER':
        return `${baseStyles} ${isSelected ? 'border-amber-500 bg-amber-50 shadow-xl' : 'border-amber-200 bg-white hover:bg-amber-50 shadow-md hover:shadow-xl'}`;
      case 'BEST':
        return `${baseStyles} ${isSelected ? 'border-emerald-500 bg-emerald-50 shadow-xl' : 'border-emerald-200 bg-white hover:bg-emerald-50 shadow-md hover:shadow-xl'}`;
      default:
        return `${baseStyles} border-slate-200`;
    }
  };

  const getTierGradient = (tier) => {
    switch(tier) {
      case 'GOOD':
        return 'from-blue-600 to-blue-500';
      case 'BETTER':
        return 'from-amber-600 to-amber-500';
      case 'BEST':
        return 'from-emerald-600 to-emerald-500';
      default:
        return 'from-slate-600 to-slate-500';
    }
  };

  const getTierPriceColor = (tier) => {
    switch(tier) {
      case 'GOOD':
        return 'text-blue-700';
      case 'BETTER':
        return 'text-amber-700';
      case 'BEST':
        return 'text-emerald-700';
      default:
        return 'text-slate-700';
    }
  };

  const getTierPriceLabel = (tier) => {
    switch(tier) {
      case 'GOOD':
        return 'Entry Investment';
      case 'BETTER':
        return 'Smart Value Investment';
      case 'BEST':
        return 'Lifetime Investment';
      default:
        return 'Retail Price';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-black bg-gradient-to-r from-blue-600 via-amber-600 to-emerald-600 bg-clip-text text-transparent mb-2">Choose Your Package</h2>
        <p className="text-base text-slate-600">Select which material option works best for you</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['a', 'b', 'c'].map((key) => {
          const pricing = tierPricing[key];
          if (!pricing) return null;

          const variantData = compareData[key];
          const materialImage = getMaterialImage(variantData);

          return (
            <button
              key={key}
              onClick={() => (onTierSelect || onSelectTier)?.(key, pricing)}
              className={`rounded-2xl overflow-hidden transition-all duration-300 ${getTierStyles(pricing.tier, selectedTier === key)}`}
            >
              <div className="h-full flex flex-col">
                {/* Header with gradient background */}
                <div className={`bg-gradient-to-r ${getTierGradient(pricing.tier)} text-white px-6 py-4 relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                  
                  {/* Most Popular Badge for BETTER tier */}
                  {pricing.tier === 'BETTER' && (
                    <div className="absolute -top-1 -right-1">
                      <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-2xl shadow-lg">
                        MOST POPULAR
                      </div>
                    </div>
                  )}
                  
                  <div className="relative flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white/90 uppercase tracking-wider">Option {key === 'a' ? '1' : key === 'b' ? '2' : '3'}</div>
                      <div className="text-3xl font-black text-white mt-1">{pricing.tier}</div>
                    </div>
                    {selectedTier === key && (
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                        <Check className="w-5 h-5 text-emerald-600" />
                      </div>
                    )}
                  </div>
                </div>



                {/* Content */}
                <div className="flex-1 p-6 space-y-6">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Material Type</div>
                    <div className="text-lg font-semibold text-slate-900">{pricing.material}</div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3">{getTierPriceLabel(pricing.tier)}</div>
                    <div className={`text-4xl font-black ${getTierPriceColor(pricing.tier)}`}>
                      ${Math.round(pricing.retail_price || 0).toLocaleString('en-US')}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}