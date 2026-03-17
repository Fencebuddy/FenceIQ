/**
 * COMPUTE CURRENT PRICING (Source of Truth)
 * Uses MaterialCatalog ONLY - simple direct matching
 */

import { priceScenario } from "../../pricing/pricingService";
import { base44 } from "@/api/base44Client";

/**
 * Compute pricing for current takeoff snapshot
 * @param {string} jobId - Job ID
 * @param {object} takeoffSnapshot - TakeoffSnapshot with line_items
 * @param {array} catalog - MaterialCatalog array
 * @returns {object} { status, materials_resolved, unresolved_items, pricing_breakdown }
 */
export async function computeCurrentPricing({ jobId, takeoffSnapshot, catalog, companyId, supplierId = null }) {
  // Validate inputs
  if (!takeoffSnapshot?.line_items?.length) {
    throw new Error('takeoffSnapshot.line_items is required');
  }

  // Fetch job for context
  const jobs = await base44.entities.Job.filter({ id: jobId });
  const job = jobs[0];

  // Fetch MaterialCatalog if not provided
  if (!catalog || catalog.length === 0) {
    catalog = await base44.entities.MaterialCatalog.filter({ active: true });
  }

  // Build catalog lookup by canonical_key
  const catalogByKey = {};
  catalog.forEach(item => {
    if (item.canonical_key) {
      catalogByKey[item.canonical_key] = item;
    }
  });

  console.log('[computeCurrentPricing CATALOG] Starting', {
    jobId,
    lineItemsCount: takeoffSnapshot.line_items.length,
    catalogItemsCount: catalog.length,
    materialType: job?.materialType
  });

  // Resolve line items against catalog
  const resolved = [];
  const unpriced = [];

  for (const lineItem of takeoffSnapshot.line_items) {
    const canonicalKey = lineItem.canonical_key || lineItem.canonicalKey;
    const qty = Number(lineItem.quantityCalculated ?? lineItem.qty ?? 0);
    const lineItemName = lineItem.lineItemName || lineItem.materialDescription;

    if (!canonicalKey) {
      unpriced.push({
        canonical_key: null,
        lineItemName,
        quantityCalculated: qty,
        uom: lineItem.uom,
        reason: 'No canonical key'
      });
      continue;
    }

    const catalogItem = catalogByKey[canonicalKey];

    if (!catalogItem || !catalogItem.cost) {
      unpriced.push({
        canonical_key: canonicalKey,
        lineItemName,
        quantityCalculated: qty,
        uom: lineItem.uom,
        reason: catalogItem ? 'No cost in catalog' : 'Not found in catalog'
      });
      continue;
    }

    // Successfully resolved
    const unit_cost = catalogItem.cost;
    const ext_cost = Number((qty * unit_cost).toFixed(2));

    resolved.push({
      canonical_key: canonicalKey,
      lineItemName: catalogItem.crm_name || lineItemName,
      quantityCalculated: qty,
      uom: catalogItem.unit || lineItem.uom,
      unit_cost,
      ext_cost,
      catalog_id: catalogItem.id,
      notes: lineItem.notes,
      source: lineItem.source,
      runLabel: lineItem.runLabel
    });
  }

  console.log('[computeCurrentPricing CATALOG] Resolution complete', {
    resolved: resolved.length,
    unpriced: unpriced.length
  });

  // Compute material_cost
  const material_cost = resolved.reduce((sum, item) => sum + item.ext_cost, 0);

  // Derive status
  const status = unpriced.length === 0 ? "complete" : "incomplete";

  // Compute pricing breakdown
  let pricing_breakdown;

  if (status === "complete") {
    // CRITICAL: Use total_lf from takeoff snapshot (authoritative source from map)
    // Calculate tear-out labor from runs if job data is available
    // Tear-out is split: $3/LF labor cost + $2/LF net profit
    let tearoutLaborCost = 0;
    let tearoutNetProfit = 0;
    if (job?.id && takeoffSnapshot.run_breakdown && Array.isArray(takeoffSnapshot.run_breakdown)) {
      const tearoutLF = takeoffSnapshot.run_breakdown.reduce((sum, run) => {
        if (run.hasTearout && run.lengthLF) {
          return sum + run.lengthLF;
        }
        return sum;
      }, 0);
      tearoutLaborCost = tearoutLF * 3; // $3/LF for tear-out labor (direct cost)
      tearoutNetProfit = tearoutLF * 2; // $2/LF for tear-out profit
    }

    const safeMetrics = { 
      totalFenceFt: takeoffSnapshot.total_lf || 0,
      total_lf: takeoffSnapshot.total_lf || 0,
      tearout_labor_cost: tearoutLaborCost,
      tearout_net_profit: tearoutNetProfit,
      ...(takeoffSnapshot.metrics || {})
    };
    pricing_breakdown = priceScenario(resolved, safeMetrics);
  } else {
    pricing_breakdown = {
      status: "incomplete",
      unresolved_count: unresolved.length
    };
  }

  return {
    status,
    materials_resolved: resolved,
    unresolved_items: unpriced.length ? unpriced : undefined,
    pricing_breakdown,
    material_cost
  };
}