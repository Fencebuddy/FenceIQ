import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Package } from "lucide-react";

export default function UnmappedItemsByVariant({ tierPricing }) {
  // Collect all unmapped items across variants
  const allUnmapped = [];
  
  Object.keys(tierPricing).forEach(key => {
    const pricing = tierPricing[key];
    if (pricing?.unmapped_items?.length > 0) {
      allUnmapped.push(...pricing.unmapped_items);
    }
  });

  if (allUnmapped.length === 0) {
    return null; // Nothing to show
  }

  // Group by variant_key
  const groupedByVariant = allUnmapped.reduce((acc, item) => {
    const variantKey = item.variant_key || 'unknown';
    if (!acc[variantKey]) {
      acc[variantKey] = [];
    }
    acc[variantKey].push(item);
    return acc;
  }, {});

  const variantLabels = {
    a: 'Variant A (Good)',
    b: 'Variant B (Better)',
    c: 'Variant C (Best)',
    unknown: 'Unknown Variant (BUG)'
  };

  const variantColors = {
    a: 'bg-blue-100 text-blue-800 border-blue-300',
    b: 'bg-amber-100 text-amber-800 border-amber-300',
    c: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    unknown: 'bg-red-100 text-red-800 border-red-300'
  };

  return (
    <Card className="border-2 border-red-300 bg-red-50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <CardTitle className="text-lg text-red-900">Unmapped Items Found</CardTitle>
        </div>
        <p className="text-sm text-red-800 mt-2">
          The following materials could not be priced. Map them before presenting to customers.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.keys(groupedByVariant).map(variantKey => {
          const items = groupedByVariant[variantKey];
          const label = variantLabels[variantKey] || variantKey;
          const colorClass = variantColors[variantKey] || variantColors.unknown;

          return (
            <div key={variantKey} className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge className={`${colorClass} border text-sm font-semibold`}>
                  {label}
                </Badge>
                <span className="text-sm text-slate-600 font-medium">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Canonical Key</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Display Name</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-b last:border-b-0 hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {item.canonical_key || 'N/A'}
                        </td>
                        <td className="py-2 px-3 text-slate-900">
                          {item.lineItemName || 'Unknown'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-700 font-medium">
                          {item.quantityCalculated?.toFixed(2) || '0.00'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}