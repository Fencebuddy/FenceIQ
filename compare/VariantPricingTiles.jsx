import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { computePricing } from '@/components/pricing/computePricing';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * Display detailed pricing breakdown tiles for each variant (a/b/c)
 * Shows material cost, labor, delivery, allocations, margins, etc.
 */
export default function VariantPricingTiles({ tierPricing, job }) {
  const [activeKey, setActiveKey] = useState(null);

  if (!tierPricing || Object.keys(tierPricing).length === 0) {
    return null;
  }

  const toggleTier = (key) => {
    setActiveKey(prev => prev === key ? null : key);
  };

  const getTierColor = (tier) => {
    switch(tier) {
      case 'GOOD': return 'blue';
      case 'BETTER': return 'amber';
      case 'BEST': return 'emerald';
      default: return 'slate';
    }
  };

  const getTierBgClass = (tier) => {
    switch(tier) {
      case 'GOOD': return 'bg-blue-50 border-blue-200';
      case 'BETTER': return 'bg-amber-50 border-amber-200';
      case 'BEST': return 'bg-emerald-50 border-emerald-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const getTierTextClass = (tier) => {
    switch(tier) {
      case 'GOOD': return 'text-blue-900';
      case 'BETTER': return 'text-amber-900';
      case 'BEST': return 'text-emerald-900';
      default: return 'text-slate-900';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {['a', 'b', 'c'].map((key) => {
        const pricing = tierPricing[key];
        if (!pricing) return null;

        const tier = pricing.tier;
        const color = getTierColor(tier);
        const isExpanded = activeKey === key;
        
        // Compute detailed pricing breakdown
        const material_cost = pricing.material_cost || 0;
        const total_lf = pricing.total_lf || 0;
        const labor_cost = total_lf * 10;
        const delivery_cost = 75;
        const direct_cost = material_cost + labor_cost + delivery_cost;

        // Get retail price and compute allocations
        const retail_price = pricing.retail_price || 0;
        
        // Compute pricing at 0% and 15% discount
        const pricingAtZero = computePricing({
          material_cost,
          total_lf,
          labor_per_lf: 10,
          delivery_cost: 75,
          overhead_rate: 0.14,
          commission_rate: 0.10,
          max_discount: 0.15,
          material_type: pricing.material || 'Chain Link',
          discount_percentage: 0,
          tear_out_cost: 0
        });

        const pricingAt15 = computePricing({
          material_cost,
          total_lf,
          labor_per_lf: 10,
          delivery_cost: 75,
          overhead_rate: 0.14,
          commission_rate: 0.10,
          max_discount: 0.15,
          material_type: pricing.material || 'Chain Link',
          discount_percentage: 0.15,
          tear_out_cost: 0
        });

        const overhead = pricingAt15.overhead;
        const commission = pricingAt15.commission;
        const discount_capacity = retail_price * 0.15;

        // Compute divisor (retail divisor for back-solving)
        const max_discount = 0.15;
        const overhead_rate = 0.14;
        const commission_rate = 0.10;
        let required_net_margin = 0.30;
        if (pricing.material === 'Wood') {
          required_net_margin = 0.20;
        }
        const effective_net = required_net_margin + (max_discount * (overhead_rate + commission_rate));
        const divisor = 1 - overhead_rate - commission_rate - effective_net;

        const unmapped_count = pricing.unmapped_items?.length || 0;
        const has_unmapped = unmapped_count > 0;

        return (
          <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleTier(key)}>
            <Card className={`border ${getTierBgClass(tier)}`}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-opacity-80 transition-colors pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className={`text-sm font-semibold ${getTierTextClass(tier)}`}>
                        {tier} Pricing Breakdown
                      </CardTitle>
                      <Badge className={`bg-${color}-600 text-white text-xs mt-1`}>
                        {pricing.material}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                  </div>
                  {/* Summary when collapsed */}
                  {!isExpanded && (
                    <div className="mt-2 text-xs text-slate-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Direct Cost:</span>
                        <span className="font-semibold">${direct_cost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Retail Price:</span>
                        <span className="font-semibold">${retail_price.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
              {/* Cost Summary */}
              <div className="bg-white rounded border p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Material Cost</span>
                  <span className="font-semibold">${material_cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Labor ({total_lf.toFixed(1)} LF × $10)</span>
                  <span className="font-semibold">${labor_cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Delivery</span>
                  <span className="font-semibold">${delivery_cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Direct Cost</span>
                  <span className="text-lg">${direct_cost.toFixed(2)}</span>
                </div>
              </div>

              {/* Allocations */}
              <div className="bg-white rounded border p-3 space-y-1.5 text-xs">
                <div className="font-semibold text-slate-700 text-xs mb-1">Allocations (from Retail)</div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Overhead (14%)</span>
                  <span className="font-semibold">${overhead.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Commission (10%)</span>
                  <span className="font-semibold">${commission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Discount Capacity (15%)</span>
                  <span className="font-semibold">${discount_capacity.toFixed(2)}</span>
                </div>
              </div>

              {/* Margin Analysis */}
              <div className="bg-white rounded border p-3 space-y-2">
                <div className="font-semibold text-slate-700 text-xs mb-1">Margin Analysis</div>
                <div className="border-l-2 border-green-500 pl-2 text-xs space-y-1">
                  <div className="font-semibold text-slate-500 text-[10px] uppercase">0% Discount</div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Sale Price</span>
                    <span className="font-bold">${pricingAtZero.sale_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Net Margin</span>
                    <span className="font-bold text-green-600">{(pricingAtZero.net_margin * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="border-l-2 border-orange-500 pl-2 text-xs space-y-1">
                  <div className="font-semibold text-slate-500 text-[10px] uppercase">15% Discount</div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Sale Price</span>
                    <span className="font-bold">${pricingAt15.sale_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Net Margin</span>
                    <span className="font-bold text-green-600">{(pricingAt15.net_margin * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Unmapped Items Warning */}
              {has_unmapped && (
                <Alert className="border-amber-500 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900 text-sm">
                    Missing costs for {unmapped_count} item(s) - link them to catalog for accurate pricing.
                  </AlertDescription>
                </Alert>
              )}

              {/* Retail Price */}
              <div className="bg-indigo-50 rounded border border-indigo-300 p-3">
                <div className="font-semibold text-indigo-900 text-xs mb-1.5 flex items-center gap-1">
                  🔒 Retail Price (Anchor)
                </div>
                <div className="text-xl font-bold text-indigo-900 mb-1">
                  ${retail_price.toFixed(2)}
                </div>
                <div className="text-[10px] text-indigo-700">
                  DC ÷ {divisor.toFixed(2)} = Retail
                </div>
              </div>

              {/* Job Cost */}
              <div className="bg-white rounded border p-3 space-y-1.5 text-xs">
                <div className="font-semibold text-slate-700 text-xs mb-1">Job Cost (Break-Even)</div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Direct Cost</span>
                  <span>${direct_cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">+ Overhead</span>
                  <span className="text-red-600">+${overhead.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">+ Commission</span>
                  <span className="text-red-600">+${commission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-1.5 font-bold">
                  <span>Total</span>
                  <span className="text-base">${(direct_cost + overhead + commission).toFixed(2)}</span>
                </div>
              </div>

              {/* Net Profit */}
              <div className="bg-green-50 rounded border border-green-300 p-3">
                <div className="font-semibold text-green-900 text-xs mb-1.5">Net Profit @ 15% Discount</div>
                <div className="text-xl font-bold text-green-700 mb-1">
                  ${pricingAt15.net_profit.toFixed(2)}
                </div>
                <div className="text-xs font-semibold text-green-700">
                  {(pricingAt15.net_margin * 100).toFixed(1)}% margin
                </div>
              </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}