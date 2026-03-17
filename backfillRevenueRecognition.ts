import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PHASE 4 — Controlled Historical Backfill
 * Backfills CRMJob recognition fields and SaleSnapshot.direct_cost_cents
 * for existing sold/won records that are currently hollow.
 *
 * RULES:
 * - Idempotent: skips records already correctly populated
 * - No rollup writes
 * - No contractValueCents changes
 * - No pricing snapshot changes
 * - No guessed actual cost — only proposal_estimate from source snapshot
 * - Admin-only
 */

function normalizeRate(x) {
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1 ? n / 100 : n;
}

async function resolveOverheadRateForCompany(base44, companyId, company) {
  try {
    const os = await base44.asServiceRole.entities.OverheadSettings.filter({ companyId });
    if (os.length === 1) {
      const r = normalizeRate(os[0].manualOverridePct) ?? normalizeRate(os[0].computedOverheadPct);
      if (r) return { overheadRate: r, source: 'overheadSettings' };
    }
  } catch (_) {}
  try {
    const pd = await base44.asServiceRole.entities.PricingDefaults.filter({ companyId });
    if (pd.length === 1) {
      const r = normalizeRate(pd[0].defaultOverheadRate);
      if (r) return { overheadRate: r, source: 'pricingDefaults' };
    }
  } catch (_) {}
  const r = normalizeRate(company?.defaultOverheadRate)
    ?? normalizeRate(company?.overheadRate ?? company?.overheadPct)
    ?? 0.14;
  return { overheadRate: r, source: r === 0.14 ? 'hardFallback' : 'companySettings' };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const dryRun = payload.dryRun !== false; // default: dry run for safety

    console.log(`[backfillRevenueRecognition] START — dryRun=${dryRun}`);

    // Load company context
    const allCompanies = await base44.asServiceRole.entities.CompanySettings.list();
    const companyMap = {};
    for (const c of allCompanies) {
      const cid = c.companyId || c.id;
      companyMap[cid] = c;
    }

    // Load all won/sold CRMJobs with hollow recognition
    const wonJobs = await base44.asServiceRole.entities.CRMJob.filter({ status: 'won' });
    const hollowJobs = wonJobs.filter(j =>
      j.recognitionStatus !== 'RECOGNIZED' || !j.recognizedRevenueCents || !j.recognizedAt
    );

    console.log(`[backfillRevenueRecognition] Total won: ${wonJobs.length}, hollow: ${hollowJobs.length}`);

    let crmJobsUpdated = 0;
    let crmJobsSkipped = 0;
    const crmSkipReasons = [];

    let saleSnapshotsUpdated = 0;
    let saleSnapshotsSkipped = 0;
    const ssSkipReasons = [];

    for (const job of hollowJobs) {
      const contractValueCents = Number(job.contractValueCents || 0);
      if (contractValueCents <= 0) {
        crmJobsSkipped++;
        crmSkipReasons.push({ jobNumber: job.jobNumber, reason: 'contractValueCents=0 — cannot derive recognition' });
        continue;
      }

      // Resolve overhead rate for this company
      const companyId = job.companyId;
      const company = companyMap[companyId] || allCompanies[0];
      const { overheadRate, source: overheadSource } = await resolveOverheadRateForCompany(base44, companyId, company);
      const recognizedOverheadCents = Math.round(contractValueCents * overheadRate);
      const recognizedAt = job.wonAt || job.soldAt || new Date().toISOString();

      if (!dryRun) {
        await base44.asServiceRole.entities.CRMJob.update(job.id, {
          recognitionStatus: 'RECOGNIZED',
          recognizedRevenueCents: contractValueCents,
          recognizedOverheadCents: recognizedOverheadCents,
          recognizedAt: recognizedAt,
          recognitionSource: 'backfill.salelock.proposal'
        });
      }
      crmJobsUpdated++;
      console.log(`[backfillRevenueRecognition] CRMJob ${job.jobNumber}: recognizedRevenueCents=${contractValueCents}, overheadRate=${overheadRate} (${overheadSource}), dryRun=${dryRun}`);
    }

    // Backfill SaleSnapshot.direct_cost_cents where missing / zero
    const allSaleSnapshots = await base44.asServiceRole.entities.SaleSnapshot.filter({});
    const hollowSnapshots = allSaleSnapshots.filter(s => !s.direct_cost_cents || s.direct_cost_cents === 0);

    console.log(`[backfillRevenueRecognition] SaleSnapshots total: ${allSaleSnapshots.length}, hollow: ${hollowSnapshots.length}`);

    for (const ss of hollowSnapshots) {
      if (!ss.proposalPricingSnapshotId) {
        saleSnapshotsSkipped++;
        ssSkipReasons.push({ saleSnapshotId: ss.id, crmJobId: ss.crmJobId, reason: 'No proposalPricingSnapshotId — cannot look up source direct_cost' });
        continue;
      }

      // Load the source ProposalPricingSnapshot
      let proposalSnap = null;
      try {
        const results = await base44.asServiceRole.entities.ProposalPricingSnapshot.filter({ id: ss.proposalPricingSnapshotId });
        proposalSnap = results[0] || null;
      } catch (_) {}

      if (!proposalSnap || proposalSnap.direct_cost == null) {
        saleSnapshotsSkipped++;
        ssSkipReasons.push({ saleSnapshotId: ss.id, proposalId: ss.proposalPricingSnapshotId, reason: 'ProposalPricingSnapshot.direct_cost missing or null — skipping to avoid inventing cost' });
        continue;
      }

      const directCostCents = Math.round(proposalSnap.direct_cost * 100);
      if (directCostCents <= 0) {
        saleSnapshotsSkipped++;
        ssSkipReasons.push({ saleSnapshotId: ss.id, reason: 'Proposal direct_cost resolves to 0 — skipping' });
        continue;
      }

      if (!dryRun) {
        await base44.asServiceRole.entities.SaleSnapshot.update(ss.id, {
          direct_cost_cents: directCostCents,
          cost_truth_basis: 'proposal_estimate'
        });
      }
      saleSnapshotsUpdated++;
      console.log(`[backfillRevenueRecognition] SaleSnapshot ${ss.id}: direct_cost_cents=${directCostCents}, cost_truth_basis=proposal_estimate, dryRun=${dryRun}`);
    }

    console.log(`[backfillRevenueRecognition] COMPLETE — dryRun=${dryRun}`);
    console.log(`  CRMJobs updated: ${crmJobsUpdated}, skipped: ${crmJobsSkipped}`);
    console.log(`  SaleSnapshots updated: ${saleSnapshotsUpdated}, skipped: ${saleSnapshotsSkipped}`);

    return Response.json({
      success: true,
      dryRun,
      crmJobs: { updated: crmJobsUpdated, skipped: crmJobsSkipped, skipReasons: crmSkipReasons },
      saleSnapshots: { updated: saleSnapshotsUpdated, skipped: saleSnapshotsSkipped, skipReasons: ssSkipReasons },
      note: dryRun ? 'DRY RUN — no writes performed. Pass dryRun:false to execute.' : 'WRITES PERFORMED'
    });

  } catch (error) {
    console.error('[backfillRevenueRecognition] Fatal error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});