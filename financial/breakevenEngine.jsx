/**
 * BREAKEVEN INTELLIGENCE ENGINE
 * Deterministic survival + goal line computation
 * Depends on Overhead Intelligence Engine
 */

import { base44 } from '@/api/base44Client';

/**
 * Compute breakeven packet for executive intelligence
 */
export async function computeBreakevenPacket(companyId) {
  if (!companyId) {
    throw new Error('companyId required');
  }

  // Get overhead (single source of truth)
  const overheadSettings = await base44.entities.OverheadSettings.filter({ companyId });
  if (!overheadSettings || overheadSettings.length === 0 || !overheadSettings[0].totalAnnualOverhead) {
    throw new Error('Complete Overhead Settings first to compute breakeven.');
  }

  const annualOverhead = overheadSettings[0].totalAnnualOverhead;

  // Get breakeven settings
  const breakevenSettings = await base44.entities.BreakevenSettings.filter({ companyId });
  let settings = breakevenSettings[0];

  // Initialize if missing
  if (!settings) {
    settings = await base44.entities.BreakevenSettings.create({
      companyId,
      targetContributionMarginPct: 45,
      targetNetProfitPct: 20,
      periodMode: 'ANNUAL'
    });
  }

  const cmPct = settings.targetContributionMarginPct / 100;
  const targetNetProfitPct = settings.targetNetProfitPct / 100;

  // Guardrails
  if (cmPct <= 0) {
    throw new Error('Contribution margin must be greater than 0%');
  }

  if (cmPct <= targetNetProfitPct) {
    throw new Error('Target profit is impossible at this contribution margin.');
  }

  // A) Bare minimum breakeven (zero profit)
  const breakevenRevenueAnnual = annualOverhead / cmPct;

  // B) Revenue required for target profit
  const targetRevenueAnnual = annualOverhead / (cmPct - targetNetProfitPct);

  // C) Run-rate conversions
  const breakevenRunRate = {
    monthly: breakevenRevenueAnnual / 12,
    weekly: breakevenRevenueAnnual / 52,
    daily: breakevenRevenueAnnual / 260
  };

  const targetRunRate = {
    monthly: targetRevenueAnnual / 12,
    weekly: targetRevenueAnnual / 52,
    daily: targetRevenueAnnual / 260
  };

  return {
    companyId,
    annualOverhead,
    cmPct: cmPct * 100,
    targetNetProfitPct: targetNetProfitPct * 100,
    breakevenRevenueAnnual,
    targetRevenueAnnual,
    breakevenRunRate,
    targetRunRate,
    computedAt: new Date().toISOString()
  };
}

/**
 * Compute current pace status
 */
export async function computePaceStatus(companyId, actualRevenueYTD, daysElapsedThisYear) {
  const packet = await computeBreakevenPacket(companyId);

  if (!actualRevenueYTD || !daysElapsedThisYear) {
    return { ...packet, paceStatus: null };
  }

  const currentRunRateAnnual = actualRevenueYTD / (daysElapsedThisYear / 365);

  let status = 'GREEN';
  let message = 'Above goal pace';

  if (currentRunRateAnnual < packet.breakevenRevenueAnnual) {
    status = 'RED';
    message = 'Below breakeven pace';
  } else if (currentRunRateAnnual < packet.targetRevenueAnnual) {
    status = 'AMBER';
    message = 'Above breakeven, below goal';
  }

  return {
    ...packet,
    currentRunRateAnnual,
    paceStatus: status,
    paceMessage: message
  };
}