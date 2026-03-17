/**
 * OVERHEAD INTELLIGENCE ENGINE
 * Deterministic overhead computation for FenceIQ
 * Single source of truth for pricing engine
 */

import { base44 } from '@/api/base44Client';

/**
 * Annualize expense based on cadence
 */
function annualizeExpense(amount, cadence) {
  const multipliers = {
    MONTHLY: 12,
    WEEKLY: 52,
    QUARTERLY: 4,
    ANNUAL: 1,
    ONE_TIME: 1
  };
  
  return amount * (multipliers[cadence] || 1);
}

/**
 * Compute overhead percentage from line items
 */
export async function computeOverhead(companyId) {
  if (!companyId) {
    throw new Error('companyId required');
  }

  // Fetch active line items
  const lineItems = await base44.entities.OverheadLineItem.filter({
    companyId,
    isActive: true
  });

  // Fetch settings
  const settings = await base44.entities.OverheadSettings.filter({ companyId });
  const overheadSettings = settings[0];

  if (!overheadSettings || !overheadSettings.projectedAnnualRevenue) {
    throw new Error('Projected revenue required to compute overhead.');
  }

  // Sum annualized expenses
  const totalAnnualOverhead = lineItems.reduce((sum, item) => {
    return sum + annualizeExpense(item.amount, item.cadence);
  }, 0);

  // Compute percentage
  const computedOverheadPct = 
    (totalAnnualOverhead / overheadSettings.projectedAnnualRevenue) * 100;

  // Update snapshot
  await base44.entities.OverheadSettings.update(overheadSettings.id, {
    computedOverheadPct,
    totalAnnualOverhead,
    lastComputedAt: new Date().toISOString()
  });

  return {
    computedOverheadPct,
    totalAnnualOverhead,
    projectedAnnualRevenue: overheadSettings.projectedAnnualRevenue,
    lineItemCount: lineItems.length
  };
}

/**
 * Get effective overhead percentage for pricing
 * SINGLE SOURCE OF TRUTH
 */
export async function getEffectiveOverheadPct(companyId) {
  if (!companyId) {
    // Fallback to CompanySettings for migration
    const settings = await base44.entities.CompanySettings.list();
    return (settings[0]?.overheadPct || 14) / 100;
  }

  const settings = await base44.entities.OverheadSettings.filter({ companyId });
  const overheadSettings = settings[0];

  if (!overheadSettings) {
    // Fallback to CompanySettings
    const companySettings = await base44.entities.CompanySettings.list();
    return (companySettings[0]?.overheadPct || 14) / 100;
  }

  // Use manual override if locked, otherwise use computed
  const effectivePct = overheadSettings.lockOverride && overheadSettings.manualOverridePct !== null
    ? overheadSettings.manualOverridePct
    : overheadSettings.computedOverheadPct;

  return effectivePct / 100;
}

/**
 * Get overhead health status
 */
export function getOverheadHealth(overheadPct) {
  if (overheadPct > 35) {
    return {
      status: 'DANGER',
      color: 'red',
      message: 'Your cost structure is dangerous. Either increase revenue or reduce fixed expenses.'
    };
  }
  
  if (overheadPct > 25) {
    return {
      status: 'WARNING',
      color: 'amber',
      message: 'Overhead is consuming a large portion of revenue. Monitor pricing discipline.'
    };
  }
  
  if (overheadPct < 10) {
    return {
      status: 'LEAN',
      color: 'blue',
      message: 'Lean operation detected. Ensure infrastructure can support growth.'
    };
  }
  
  return {
    status: 'HEALTHY',
    color: 'emerald',
    message: 'Overhead is within healthy range.'
  };
}

/**
 * Initialize overhead settings for a company
 */
export async function initializeOverheadSettings(companyId, projectedRevenue = 1000000) {
  const existing = await base44.entities.OverheadSettings.filter({ companyId });
  
  if (existing.length > 0) {
    return existing[0];
  }

  return await base44.entities.OverheadSettings.create({
    companyId,
    projectedAnnualRevenue: projectedRevenue,
    computedOverheadPct: 0,
    totalAnnualOverhead: 0,
    lastComputedAt: new Date().toISOString()
  });
}