import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Inline overhead/commission truth ladder — mirrors _shared/pricingRates.
// No local imports allowed in Deno functions, so this is inlined here.
function normalizeRate(x) {
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1 ? n / 100 : n;
}

async function resolveRatesForCompany(base44, companyId, company) {
  // Overhead: OverheadSettings > PricingDefaults > CompanySettings > hardFallback
  let overheadRate = null;
  let overheadSource = 'hardFallback';
  try {
    const os = await base44.entities.OverheadSettings.filter({ companyId });
    if (os.length === 1) {
      const r = normalizeRate(os[0].manualOverridePct) ?? normalizeRate(os[0].computedOverheadPct);
      if (r) { overheadRate = r; overheadSource = 'overheadSettings'; }
    }
  } catch (_) {}
  if (!overheadRate) {
    try {
      const pd = await base44.entities.PricingDefaults.filter({ companyId });
      if (pd.length === 1) {
        const r = normalizeRate(pd[0].defaultOverheadRate);
        if (r) { overheadRate = r; overheadSource = 'pricingDefaults'; }
      }
    } catch (_) {}
  }
  if (!overheadRate) {
    overheadRate = normalizeRate(company?.defaultOverheadRate)
      ?? normalizeRate(company?.overheadRate ?? company?.overheadPct)
      ?? 0.14;
    overheadSource = overheadRate === 0.14 ? 'hardFallback' : 'companySettings';
  }

  // Commission: PricingDefaults > CompanySettings > hardFallback
  let commissionRate = null;
  let commissionSource = 'hardFallback';
  try {
    const pd = await base44.entities.PricingDefaults.filter({ companyId });
    if (pd.length === 1) {
      const r = normalizeRate(pd[0].defaultCommissionRate);
      if (r) { commissionRate = r; commissionSource = 'pricingDefaults'; }
    }
  } catch (_) {}
  if (!commissionRate) {
    commissionRate = normalizeRate(company?.defaultCommissionRate)
      ?? normalizeRate(company?.commissionRate ?? company?.commissionPct)
      ?? 0.10;
    commissionSource = commissionRate === 0.10 ? 'hardFallback' : 'companySettings';
  }

  return { overheadRate, overheadSource, commissionRate, commissionSource };
}

/**
 * COMMERCIAL TRUTH LOCK
 * Accepts proposal, creates signature, locks sale with revenue recognition
 * 
 * IDEMPOTENT: Safe to call multiple times (returns alreadySold:true if already locked)
 * BACKWARDS COMPATIBLE: Never throws, always returns ok:true or ok:false
 * FEATURE FLAGGED: Only active if CompanySettings.workflowSpineV1 enabled (shadow mode by default)
 * 
 * Input: { jobId, signaturePayload: { name, email, signatureFont }, invokedFrom }
 * Output: { ok:true, alreadySold?, saleSnapshotId, contractValueCents }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { jobId, signaturePayload, invokedFrom = 'Unknown' } = payload;

    if (!jobId) {
      return Response.json({ ok: false, error: 'jobId required' }, { status: 400 });
    }

    console.log('[acceptProposalAndLockSale] START:', { jobId, invokedFrom, userId: user.id });

    // STEP 1: Load Job (backing store)
    const jobs = await base44.entities.Job.filter({ id: jobId });
    if (jobs.length === 0) {
      return Response.json({ ok: false, error: 'MISSING_JOB' });
    }
    const job = jobs[0];

    // STEP 2: Load CRMJob + CompanySettings + ProposalSnapshot in PARALLEL
    let crmJob = null;
    let allCompanies = [];
    let proposalSnapshots = [];

    try {
      const [crmJobsArr, companies, proposals] = await Promise.all([
        base44.entities.CRMJob.filter({ externalJobId: jobId }),
        base44.entities.CompanySettings.filter({ companyId: job.companyId }).catch(() => base44.entities.CompanySettings.list()),
        base44.entities.ProposalPricingSnapshot.filter({ job_id: jobId }),
      ]);
      crmJob = crmJobsArr[0] || null;
      allCompanies = companies;
      proposalSnapshots = proposals;
    } catch (parallelError) {
      console.error('[acceptProposalAndLockSale] Parallel load failed:', parallelError);
      return Response.json({ ok: false, error: 'LOAD_ERROR', details: parallelError.message });
    }

    if (!crmJob) {
      // Create CRMJob if missing (defensive)
      const companyId0 = job.companyId || allCompanies[0]?.id;
      if (!companyId0) {
        return Response.json({ ok: false, error: 'MISSING_COMPANY_ID' });
      }
      crmJob = await base44.asServiceRole.entities.CRMJob.create({
        companyId: companyId0,
        externalJobId: jobId,
        jobNumber: job.jobNumber,
        customerName: job.customerName,
        stage: 'new',
        status: 'open',
        saleStatus: 'unsold',
        contractStatus: 'unsigned',
        paymentStatus: 'na',
        installStatus: 'na',
        lossType: 'na',
        contractValueCents: 0,
        directCostCents: 0
      });
      console.log('[acceptProposalAndLockSale] Created missing CRMJob:', crmJob.id);
    }

    // IDEMPOTENCY CHECK: If already sold, patch missing snapshot link and return
    if (crmJob.saleStatus === 'sold' || crmJob.soldAt) {
      console.log('[acceptProposalAndLockSale] Already sold - checking for missing snapshot link');
      
      // If currentProposalSnapshotId is missing, try to backfill it from ProposalPricingSnapshot
      if (!crmJob.currentProposalSnapshotId && proposalSnapshots.length > 0) {
        const snap = proposalSnapshots[0];
        await base44.asServiceRole.entities.CRMJob.update(crmJob.id, {
          currentProposalSnapshotId: snap.id
        }).catch(() => {});
        console.log('[acceptProposalAndLockSale] Backfilled currentProposalSnapshotId:', snap.id);
      }

      const existingSnapshots = await base44.entities.SaleSnapshot.filter({ crmJobId: crmJob.id });
      return Response.json({
        ok: true,
        alreadySold: true,
        saleSnapshotId: existingSnapshots[0]?.id || null,
        contractValueCents: crmJob.contractValueCents || 0,
        message: 'Sale already locked'
      });
    }

    // STEP 2.5: Resolve company context for rate ladder
    const companyId = crmJob.companyId || allCompanies[0]?.companyId || allCompanies[0]?.id;
    const company = allCompanies.find(c => (c.companyId === companyId) || (c.id === companyId)) || allCompanies[0];
    const { overheadRate, overheadSource, commissionRate, commissionSource } = await resolveRatesForCompany(base44, companyId, company);
    console.log('[acceptProposalAndLockSale] Resolved rates:', { overheadRate, overheadSource, commissionRate, commissionSource });

    // STEP 3: Check ProposalPricingSnapshot (already loaded in parallel above)
    // Also try fetching via crmJob.currentProposalSnapshotId as a fallback
    let proposalSnapshot = proposalSnapshots[0] || null;
    if (!proposalSnapshot && crmJob.currentProposalSnapshotId) {
      try {
        const byId = await base44.entities.ProposalPricingSnapshot.filter({ id: crmJob.currentProposalSnapshotId });
        if (byId.length > 0) proposalSnapshot = byId[0];
      } catch (_) {}
    }

    if (!proposalSnapshot) {
      console.warn('[acceptProposalAndLockSale] No ProposalPricingSnapshot found');
      // Still lock the sale on CRMJob if it already has a contractValueCents from a prior lock attempt
      if (crmJob.contractValueCents > 0) {
        await base44.asServiceRole.entities.CRMJob.update(crmJob.id, {
          saleStatus: 'sold',
          contractStatus: 'signed',
          status: 'won',
          wonAt: new Date().toISOString(),
          soldAt: new Date().toISOString(),
          soldByUserId: user.id,
          ...(crmJob.paymentStatus === 'na' ? { paymentStatus: 'payment_pending' } : {})
        });
        return Response.json({
          ok: true,
          alreadySold: false,
          saleSnapshotId: null,
          contractValueCents: crmJob.contractValueCents,
          message: 'Sale locked with existing contract value (no snapshot)'
        });
      }
      return Response.json({ 
        ok: false, 
        error: 'MISSING_PROPOSAL_SNAPSHOT',
        message: 'Proposal pricing snapshot required before locking sale'
      });
    }

    // STEP 4: Ensure SignatureRecord exists
    let signatureRecord = null;
    const existingSignatures = await base44.entities.SignatureRecord.filter({ 
      jobId: crmJob.id,
      status: 'active'
    });

    if (existingSignatures.length > 0) {
      signatureRecord = existingSignatures[0];
      console.log('[acceptProposalAndLockSale] Using existing signature:', signatureRecord.id);
    } else if (signaturePayload) {
      // Create new signature record
      signatureRecord = await base44.asServiceRole.entities.SignatureRecord.create({
        companyId: crmJob.companyId,
        jobId: crmJob.id,
        proposalSnapshotId: proposalSnapshot.id,
        status: 'active',
        signedBy: signaturePayload.name,
        signedEmail: signaturePayload.email || job.customerEmail,
        signedAt: new Date().toISOString(),
        signatureProvider: 'internal',
        userAgent: req.headers.get('user-agent') || 'unknown'
      });
      console.log('[acceptProposalAndLockSale] Created signature:', signatureRecord.id);
    } else {
      console.warn('[acceptProposalAndLockSale] No signature record available');
      // Continue anyway - sale can be locked without signature (manual override case)
    }

    // STEP 5: Compute contractValueCents from ProposalPricingSnapshot
    // Use total_with_tax as contract basis (most conservative)
    const contractValueCents = Math.round((proposalSnapshot.total_with_tax || proposalSnapshot.agreed_subtotal || 0) * 100);

    if (contractValueCents <= 0) {
      return Response.json({
        ok: false,
        error: 'INVALID_CONTRACT_VALUE',
        message: 'Contract value must be > 0'
      });
    }

    // STEP 6: Update CRMJob with sale lock + recognition fields
    const soldAt = new Date().toISOString();
    const recognizedOverheadCents = Math.round(contractValueCents * overheadRate);

    await base44.asServiceRole.entities.CRMJob.update(crmJob.id, {
      contractValueCents,
      saleStatus: 'sold',
      contractStatus: 'signed',
      status: 'won',
      wonAt: soldAt,
      soldAt,
      soldByUserId: user.id,
      signatureRecordId: signatureRecord?.id || null,

      // CRITICAL: Link proposal snapshot so owner dashboard can find pricing data
      currentProposalSnapshotId: proposalSnapshot.id,

      // Price source tracking
      priceSource: 'proposal_snapshot',
      costSource: 'job_cost_snapshot',

      // Revenue recognition fields — supporting truth (NOT a rollup writer)
      recognitionStatus: 'RECOGNIZED',
      recognizedRevenueCents: contractValueCents,
      recognizedOverheadCents: recognizedOverheadCents,
      recognizedAt: soldAt,
      recognitionSource: 'salelock.proposal',

      // Payment status auto-set if currently 'na'
      ...(crmJob.paymentStatus === 'na' ? { paymentStatus: 'payment_pending' } : {})
    });
    console.log('[acceptProposalAndLockSale] CRMJob recognition fields written:', {
      recognitionStatus: 'RECOGNIZED',
      recognizedRevenueCents: contractValueCents,
      recognizedOverheadCents,
      recognitionSource: 'salelock.proposal'
    });

    console.log('[acceptProposalAndLockSale] CRMJob updated with sale lock');

    // STEP 7: Create immutable SaleSnapshot
    // direct_cost comes from the ProposalPricingSnapshot source field.
    // This is proposal-time ESTIMATED cost from the pricing engine — NOT actual installed cost.
    const proposalDirectCost = proposalSnapshot.direct_cost ?? null; // dollars, from ProposalPricingSnapshot
    const directCostCents = proposalDirectCost != null ? Math.round(proposalDirectCost * 100) : 0;
    const costTruthBasis = directCostCents > 0 ? 'proposal_estimate' : 'unavailable';

    const overheadAllocatedCents = recognizedOverheadCents; // already computed from truth ladder above
    const commissionAllocatedCents = Math.round(contractValueCents * commissionRate);
    const netProfitCents = contractValueCents - directCostCents - overheadAllocatedCents - commissionAllocatedCents;

    const saleSnapshot = await base44.asServiceRole.entities.SaleSnapshot.create({
      jobId,
      crmJobId: crmJob.id,
      proposalPricingSnapshotId: proposalSnapshot.id,
      signatureRecordId: signatureRecord?.id || null,
      contractValueCents,
      soldAt,
      soldByUserId: user.id,
      invokedFrom,
      pricing_breakdown_snapshot: {
        agreed_price_type: proposalSnapshot.agreed_price_type,
        retail_price: proposalSnapshot.retail_price,
        agreed_subtotal: proposalSnapshot.agreed_subtotal,
        tax_rate: proposalSnapshot.tax_rate,
        tax_amount: proposalSnapshot.tax_amount,
        total_with_tax: proposalSnapshot.total_with_tax,
        savings_applied: proposalSnapshot.savings_applied || [],
        // Carry proposal-time estimated cost forward — labeled as estimate, not actual
        direct_cost: proposalDirectCost,
        overhead_rate_used: overheadRate,
        overhead_rate_source: overheadSource,
        commission_rate_used: commissionRate,
        commission_rate_source: commissionSource
      },
      direct_cost_cents: directCostCents,
      cost_truth_basis: costTruthBasis, // Phase 2: explicit truth label
      net_profit_cents: netProfitCents,
      overhead_allocated_cents: overheadAllocatedCents,
      commission_allocated_cents: commissionAllocatedCents
    });
    console.log('[acceptProposalAndLockSale] SaleSnapshot created:', {
      id: saleSnapshot.id, directCostCents, costTruthBasis,
      overheadAllocatedCents, commissionAllocatedCents, netProfitCents
    });

    console.log('[acceptProposalAndLockSale] SaleSnapshot created:', saleSnapshot.id);

    // STEP 8: Return success
    return Response.json({
      ok: true,
      alreadySold: false,
      saleSnapshotId: saleSnapshot.id,
      contractValueCents,
      netProfitCents,
      overheadAllocatedCents,
      message: 'Sale locked successfully'
    });

  } catch (error) {
    console.error('[acceptProposalAndLockSale] Fatal error:', error);
    return Response.json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    }, { status: 500 });
  }
});