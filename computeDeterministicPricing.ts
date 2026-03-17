import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ─── Inlined: truthSetIntegrity ───────────────────────────────────────────────
class PricingTruthError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PricingTruthError";
    this.code = code;
    this.details = details;
  }
}

function requireUniqueOrNull({ records, code, message, details = {} }) {
  if (!records || records.length === 0) return null;
  if (records.length === 1) return records[0];
  throw new PricingTruthError(code, message, { ...details, count: records.length });
}

// ─── Inlined: resolveCompanyContext ──────────────────────────────────────────
async function resolveCompanyContext({ base44, req }) {
  const headerCompanyId = req.headers.get("x-company-id");
  if (headerCompanyId) {
    const matches = await base44.entities.CompanySettings.filter({ companyId: headerCompanyId });
    if (!matches || matches.length === 0) return { error: { code: "COMPANY_NOT_FOUND", message: "x-company-id provided but no matching CompanySettings found" } };
    if (matches.length !== 1) return { error: { code: "COMPANY_SETTINGS_DUPLICATE_FOR_COMPANYID", message: "Multiple CompanySettings records found for this companyId" } };
    const company = matches[0];
    const companyId = company.companyId ?? company.id;
    if (!companyId) return { error: { code: "COMPANY_ID_MISSING", message: "CompanySettings record found but missing companyId/id" } };
    return { companyId, company, mode: "header" };
  }

  const primaryMatches = await base44.entities.CompanySettings.filter({ isPrimary: true });
  if (primaryMatches && primaryMatches.length > 0) {
    if (primaryMatches.length !== 1) return { error: { code: "MULTIPLE_PRIMARY_COMPANIES", message: "Multiple CompanySettings records are marked isPrimary=true" } };
    const company = primaryMatches[0];
    const companyId = company.companyId ?? company.id;
    if (!companyId) return { error: { code: "COMPANY_ID_MISSING", message: "Primary CompanySettings missing companyId/id" } };
    return { companyId, company, mode: "primary" };
  }

  const all = await base44.entities.CompanySettings.list();
  if (!Array.isArray(all) || all.length === 0) return { error: { code: "COMPANY_SETTINGS_MISSING", message: "Company settings not found" } };
  if (all.length === 1) {
    const company = all[0];
    const companyId = company.companyId ?? company.id;
    if (!companyId) return { error: { code: "COMPANY_ID_MISSING", message: "CompanySettings missing companyId/id" } };
    return { companyId, company, mode: "single_record" };
  }

  return { error: { code: "MULTI_TENANT_CONTEXT_REQUIRED", message: "Multiple CompanySettings records exist. Provide x-company-id or mark one as isPrimary." } };
}

// ─── Inlined: pricingRates ────────────────────────────────────────────────────
function normalizeRate(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n > 1 ? n / 100 : n;
}

function clampRateOrDefault(rate, fallback) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return fallback;
  if (n <= 0 || n > 0.95) return fallback;
  return n;
}

async function resolveOverheadRate({ base44, companyId, company, hardFallback = 0.14 }) {
  try {
    const settings = await base44.entities.OverheadSettings.filter({ companyId });
    const s = requireUniqueOrNull({ records: settings, code: "OVERHEAD_SETTINGS_DUPLICATE", message: "Multiple OverheadSettings records found", details: { companyId } });
    const override = normalizeRate(s?.manualOverridePct);
    if (override != null) return { overheadRate: override, source: "overheadSettings.manualOverridePct" };
    const computed = normalizeRate(s?.computedOverheadPct);
    if (computed != null) return { overheadRate: computed, source: "overheadSettings.computedOverheadPct" };
  } catch (e) {
    if (e?.name === "PricingTruthError") throw e;
  }

  try {
    const defaults = await base44.entities.PricingDefaults.filter({ companyId });
    const d = requireUniqueOrNull({ records: defaults, code: "PRICING_DEFAULTS_DUPLICATE", message: "Multiple PricingDefaults records found", details: { companyId } });
    const configured = normalizeRate(d?.defaultOverheadRate);
    if (configured != null) return { overheadRate: configured, source: "pricingDefaults.defaultOverheadRate" };
  } catch (e) {
    if (e?.name === "PricingTruthError") throw e;
  }

  const configured = normalizeRate(company?.defaultOverheadRate);
  if (configured != null) return { overheadRate: configured, source: "companySettings.defaultOverheadRate" };

  const legacy = normalizeRate(company?.overheadRate ?? company?.overheadPct);
  if (legacy != null) return { overheadRate: legacy, source: "companySettings.legacyOverhead" };

  return { overheadRate: hardFallback, source: "hardFallback" };
}

async function resolveCommissionRate({ base44, companyId, company, hardFallback = 0.10 }) {
  try {
    const defaults = await base44.entities.PricingDefaults.filter({ companyId });
    const d = requireUniqueOrNull({ records: defaults, code: "PRICING_DEFAULTS_DUPLICATE", message: "Multiple PricingDefaults records found", details: { companyId } });
    const configured = normalizeRate(d?.defaultCommissionRate);
    if (configured != null) return { commissionRate: configured, source: "pricingDefaults.defaultCommissionRate" };
  } catch (e) {
    if (e?.name === "PricingTruthError") throw e;
  }

  const configured = normalizeRate(company?.defaultCommissionRate);
  if (configured != null) return { commissionRate: configured, source: "companySettings.defaultCommissionRate" };

  const legacy = normalizeRate(company?.commissionRate ?? company?.commissionPct);
  if (legacy != null) return { commissionRate: legacy, source: "companySettings.legacyCommission" };

  return { commissionRate: hardFallback, source: "hardFallback" };
}

// ─── Money utilities ──────────────────────────────────────────────────────────
function toCents(dollars) {
  if (dollars === null || dollars === undefined) return 0;
  return Math.round(dollars * 100);
}

function toDollars(cents) {
  if (cents === null || cents === undefined) return 0;
  return cents / 100;
}

function addCents(...centValues) {
  return centValues.reduce((sum, val) => sum + (val || 0), 0);
}

function multiplyCentsByPercent(cents, percent) {
  return Math.round(cents * percent);
}

function divideCents(cents, divisor) {
  if (divisor === 0) return 0;
  return Math.round(cents / divisor);
}

function computePercentage(partCents, totalCents) {
  if (totalCents === 0) return 0;
  return partCents / totalCents;
}

function roundPercent(decimal) {
  return Math.round(decimal * 10000) / 100;
}

// ─── Token validator ──────────────────────────────────────────────────────────
function validateDiscountTokens(selectedTokensPct, tokensAvailablePct) {
  if (!Array.isArray(selectedTokensPct) || !Array.isArray(tokensAvailablePct)) {
    return { valid: false, error: 'Invalid token arrays' };
  }
  const availableFreq = {};
  tokensAvailablePct.forEach(token => { availableFreq[token] = (availableFreq[token] || 0) + 1; });
  const selectedFreq = {};
  for (const token of selectedTokensPct) {
    selectedFreq[token] = (selectedFreq[token] || 0) + 1;
    if (!availableFreq[token]) return { valid: false, error: `Token ${token}% not available in policy` };
    if (selectedFreq[token] > availableFreq[token]) return { valid: false, error: `Token ${token}% used ${selectedFreq[token]} times, only ${availableFreq[token]} available` };
  }
  return { valid: true };
}

function computeEffectiveDiscount(selectedTokensPct) {
  if (!Array.isArray(selectedTokensPct)) return 0;
  return selectedTokensPct.reduce((sum, token) => sum + token, 0);
}

function computeMaxEffectiveDiscount(tokensAvailablePct) {
  if (!Array.isArray(tokensAvailablePct)) return 0;
  return tokensAvailablePct.reduce((sum, token) => sum + token, 0);
}

// ─── Pricing engine ───────────────────────────────────────────────────────────
function deriveMaterialTypes(resolvedLineItems) {
  const materialTypes = new Set();
  resolvedLineItems.forEach(item => { if (item.material_type) materialTypes.add(item.material_type); });
  return Array.from(materialTypes);
}

function computeRequiredNetAfterDiscount(materialTypesInJob, discountPolicy) {
  const { requiredNetAfterDiscountByMaterial, mixedMaterialPolicy } = discountPolicy;
  if (materialTypesInJob.length === 0) return 25;
  if (mixedMaterialPolicy === 'STRICTEST_WINS') {
    const requirements = materialTypesInJob.map(mat => requiredNetAfterDiscountByMaterial[mat] || 25);
    return Math.max(...requirements);
  }
  return requiredNetAfterDiscountByMaterial[materialTypesInJob[0]] || 25;
}

function computeRequiredRetailNetPct(requiredNetAfterDiscountPct, maxEffectiveDiscountPct) {
  const netAfterDecimal = requiredNetAfterDiscountPct / 100;
  const maxDiscountDecimal = maxEffectiveDiscountPct / 100;
  return (1 - (1 - netAfterDecimal) * (1 - maxDiscountDecimal)) * 100;
}

function runPricingEngine(params) {
  const { materialCost, laborCost, deliveryCost, discountPolicy, selectedTokensPct = [], resolvedLineItems = [], overheadRate, commissionRate, retailAnchorOverride = null } = params;

  if (!Number.isFinite(overheadRate) || overheadRate <= 0 || overheadRate > 0.95) {
    return { success: false, error: "INVALID_OVERHEAD_RATE", message: "Invalid overheadRate" };
  }
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 0.95) {
    return { success: false, error: "INVALID_COMMISSION_RATE", message: "Invalid commissionRate" };
  }

  const tokenValidation = validateDiscountTokens(selectedTokensPct, discountPolicy.tokensAvailablePct);
  if (!tokenValidation.valid) return { success: false, error: 'DISCOUNT_TOKENS_INVALID', message: tokenValidation.error };

  const materialTypesInJob = deriveMaterialTypes(resolvedLineItems);
  const effectiveDiscountPct = computeEffectiveDiscount(selectedTokensPct);
  const maxEffectiveDiscountPct = computeMaxEffectiveDiscount(discountPolicy.tokensAvailablePct);
  const requiredNetAfterDiscountPct = computeRequiredNetAfterDiscount(materialTypesInJob, discountPolicy);
  const requiredRetailNetPct = computeRequiredRetailNetPct(requiredNetAfterDiscountPct, maxEffectiveDiscountPct);

  const directCostCents = addCents(toCents(materialCost), toCents(laborCost), toCents(deliveryCost));

  let retailPriceCents, overheadAmountCents, commissionAmountCents;

  if (retailAnchorOverride !== null) {
    retailPriceCents = toCents(retailAnchorOverride);
    overheadAmountCents = multiplyCentsByPercent(retailPriceCents, overheadRate);
    commissionAmountCents = multiplyCentsByPercent(retailPriceCents, commissionRate);
  } else {
    const divisor = 1 - overheadRate - commissionRate - (requiredRetailNetPct / 100);
    if (!Number.isFinite(divisor) || divisor <= 0.02) {
      return { success: false, error: 'DIVISOR_UNSAFE', message: 'Pricing divisor unsafe — overhead/commission/net targets too high', details: { divisor, overheadRate, commissionRate, requiredRetailNetPct } };
    }
    retailPriceCents = divideCents(directCostCents, divisor);
    overheadAmountCents = multiplyCentsByPercent(retailPriceCents, overheadRate);
    commissionAmountCents = multiplyCentsByPercent(retailPriceCents, commissionRate);
  }

  const costBasisForNetCents = addCents(directCostCents, overheadAmountCents, commissionAmountCents);
  const discountedPriceCents = retailPriceCents - multiplyCentsByPercent(retailPriceCents, effectiveDiscountPct / 100);
  const netPctRetail = roundPercent(computePercentage(retailPriceCents - costBasisForNetCents, retailPriceCents));
  const netPctAfterDiscount = roundPercent(computePercentage(discountedPriceCents - costBasisForNetCents, discountedPriceCents));

  if (netPctAfterDiscount + 0.0001 < requiredNetAfterDiscountPct) {
    return { success: false, error: 'PRICING_DISCOUNT_NET_FLOOR_VIOLATION', message: `Net margin after discount (${netPctAfterDiscount.toFixed(2)}%) below required floor (${requiredNetAfterDiscountPct.toFixed(2)}%)`, details: { netPctAfterDiscount, requiredNetAfterDiscountPct, selectedTokensPct, effectiveDiscountPct } };
  }

  return {
    success: true,
    snapshot: {
      stackingMode: discountPolicy.stackingMode,
      tokensAvailablePct: [...discountPolicy.tokensAvailablePct],
      selectedTokensPct: [...selectedTokensPct],
      effectiveDiscountPct, maxEffectiveDiscountPct, mixedMaterialPolicy: discountPolicy.mixedMaterialPolicy,
      materialTypesInJob, requiredNetAfterDiscountPct, requiredRetailNetPct,
      costBasisForNetCents, retailPriceCents, discountedPriceCents, directCostCents,
      overheadAmountCents, commissionAmountCents, netPctRetail, netPctAfterDiscount,
      roundingPolicy: discountPolicy.roundingPolicy,
      materialCost, laborCost, deliveryCost,
      directCost: toDollars(directCostCents),
      retailPrice: toDollars(retailPriceCents),
      discountAmount: toDollars(retailPriceCents - discountedPriceCents),
      sellPriceSubtotal: toDollars(discountedPriceCents),
      overheadAmount: toDollars(overheadAmountCents),
      commissionAmount: toDollars(commissionAmountCents),
      netProfitAmount: toDollars(discountedPriceCents - costBasisForNetCents)
    }
  };
}

// ─── Hash helpers ─────────────────────────────────────────────────────────────
function generatePricingHash(inputs) {
  return JSON.stringify({
    mc: toCents(inputs.materialCost), lc: toCents(inputs.laborCost), dc: toCents(inputs.deliveryCost),
    or: Math.round(inputs.overheadRate * 10000), cr: Math.round(inputs.commissionRate * 10000),
    tk: inputs.selectedTokensPct.slice().sort().join(',')
  });
}

function generateTakeoffHash(resolvedLineItems) {
  return JSON.stringify(resolvedLineItems.map(item => ({
    n: item.name, q: Math.round((item.quantity || 0) * 1000) / 1000, c: toCents(item.unitCost || 0)
  })));
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await req.json();
    const { materialCost, laborCost, deliveryCost, selectedTokensPct = [], resolvedLineItems = [], retailAnchorOverride = null, overheadRate: overheadRateFromPayload, commissionRate: commissionRateFromPayload } = payload;

    const ctx = await resolveCompanyContext({ base44, req });
    if (ctx.error) return Response.json({ error: ctx.error.message, code: ctx.error.code }, { status: 500 });
    const { companyId, company, mode } = ctx;

    const discountPolicy = company.discountPolicy || {
      stackingMode: "ADDITIVE",
      tokensAvailablePct: [2, 3, 5, 5],
      requiredNetAfterDiscountByMaterial: { "Chain Link": 25, "Vinyl": 25, "Aluminum": 25, "Wood": 30 },
      mixedMaterialPolicy: "STRICTEST_WINS",
      roundingPolicy: { currency: "USD", precision: "CENTS", mode: "HALF_UP" }
    };

    const overheadResolved = await resolveOverheadRate({ base44, companyId, company, hardFallback: 0.14 });
    let overheadRate = clampRateOrDefault(overheadResolved.overheadRate, 0.14);

    const commissionResolved = await resolveCommissionRate({ base44, companyId, company, hardFallback: 0.10 });
    let commissionRate = clampRateOrDefault(commissionResolved.commissionRate, 0.10);

    const allowOverrides = company.allowInternalPricingOverrides === true;
    const userIsAdmin = user?.role === "admin";

    if (allowOverrides && userIsAdmin) {
      if (typeof overheadRateFromPayload === "number") overheadRate = clampRateOrDefault(overheadRateFromPayload, overheadRate);
      if (typeof commissionRateFromPayload === "number") commissionRate = clampRateOrDefault(commissionRateFromPayload, commissionRate);
    }

    const result = runPricingEngine({ materialCost, laborCost, deliveryCost, discountPolicy, selectedTokensPct, resolvedLineItems, overheadRate, commissionRate, retailAnchorOverride });

    if (!result.success) return Response.json({ success: false, error: result.error, message: result.message, details: result.details }, { status: 400 });

    const pricingInputsHash = generatePricingHash({ materialCost, laborCost, deliveryCost, overheadRate, commissionRate, selectedTokensPct });
    const takeoffInputsHash = generateTakeoffHash(resolvedLineItems);

    return Response.json({
      success: true,
      snapshot: {
        ...result.snapshot,
        pricingInputsHash, takeoffInputsHash,
        pricingModelVersion: "DETERMINISTIC_V1",
        computedAt: new Date().toISOString(),
        meta: { companyId, tenantResolutionMode: mode, overheadRateUsed: overheadRate, overheadRateSource: overheadResolved.source, commissionRateUsed: commissionRate, commissionRateSource: commissionResolved.source }
      }
    });

  } catch (error) {
    if (error?.name === "PricingTruthError") {
      return Response.json({ success: false, error: error.code, message: error.message, details: error.details }, { status: 500 });
    }
    console.error("[computeDeterministicPricing] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});