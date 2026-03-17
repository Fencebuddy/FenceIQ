import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const MARGIN_FLOOR = 0.25; // 25% net margin floor
const DISCOUNT_THRESHOLD = 0.10; // 10% discount from presented price
const CHANGE_ORDER_THRESHOLD = 2;
const MIN_JOBS_FOR_AGG = 2; // minimum jobs before flagging a rep/zone/crew

function netMarginPct(contractCents, costCents) {
  if (!contractCents || contractCents <= 0) return null;
  return (contractCents - costCents) / contractCents;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function groupBy(arr, keyFn) {
  const map = {};
  for (const item of arr) {
    const k = keyFn(item);
    if (!k) continue;
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { companyId, dateStart, dateEnd } = body;
  if (!companyId) return Response.json({ error: 'companyId required' }, { status: 400 });

  const end = dateEnd || today();
  const start = dateStart || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const dateBucket = end;

  // Fetch data
  const [jobs, proposals, saleSnapshots] = await Promise.all([
    base44.asServiceRole.entities.CRMJob.filter({ companyId }),
    base44.asServiceRole.entities.ProposalPricingSnapshot ? 
      base44.asServiceRole.entities.ProposalPricingSnapshot.filter({ companyId }).catch(() => []) : 
      Promise.resolve([]),
    base44.asServiceRole.entities.SaleSnapshot ?
      base44.asServiceRole.entities.SaleSnapshot.filter({ companyId }).catch(() => []) :
      Promise.resolve([])
  ]);

  // Filter jobs to date range (by wonAt or created_date)
  const rangeJobs = jobs.filter(j => {
    const dt = j.wonAt || j.created_date || '';
    return dt >= start && dt <= end + 'Z';
  });

  const signals = [];

  // Helper: upsert signal (dedupe by dedupeKey+dateBucket)
  const existingSignals = await base44.asServiceRole.entities.ProfitSignal.filter({ companyId, dateBucket });
  const existingKeys = new Set(existingSignals.map(s => s.dedupeKey));

  async function emitSignal(sig) {
    if (!sig.dedupeKey || existingKeys.has(sig.dedupeKey)) return;
    existingKeys.add(sig.dedupeKey);
    const created = await base44.asServiceRole.entities.ProfitSignal.create({
      ...sig,
      companyId,
      dateBucket,
      createdAt: new Date().toISOString()
    });
    signals.push(created);
  }

  // ─── 1. Per-job signals ───────────────────────────────────────────────────
  for (const job of rangeJobs) {
    if (job.recognitionStatus !== 'RECOGNIZED') continue;

    const contract = job.contractValueCents || 0;
    const cost = job.directCostCents || 0;
    const margin = netMarginPct(contract, cost);

    // MARGIN_FLOOR_BREACH
    if (margin !== null && margin < MARGIN_FLOOR && contract > 0) {
      await emitSignal({
        type: 'MARGIN_FLOOR_BREACH',
        severity: margin < 0.10 ? 'critical' : 'warn',
        crmJobId: job.id,
        repUserId: job.assignedRepUserId,
        zoneId: job.zoneId,
        crewId: job.crewId,
        message: `Job ${job.jobNumber} margin ${(margin * 100).toFixed(1)}% below ${(MARGIN_FLOOR * 100).toFixed(0)}% floor`,
        dedupeKey: `MARGIN_FLOOR_BREACH:${job.id}:${dateBucket}`,
        evidence: { jobNumber: job.jobNumber, contractValueCents: contract, directCostCents: cost, marginPct: margin, customerName: job.customerName }
      });
    }

    // CHANGE_ORDER_RISK
    if ((job.changeOrdersCount || 0) >= CHANGE_ORDER_THRESHOLD) {
      await emitSignal({
        type: 'CHANGE_ORDER_RISK',
        severity: (job.changeOrdersCount || 0) >= 4 ? 'critical' : 'warn',
        crmJobId: job.id,
        repUserId: job.assignedRepUserId,
        crewId: job.crewId,
        message: `Job ${job.jobNumber} has ${job.changeOrdersCount} change orders`,
        dedupeKey: `CHANGE_ORDER_RISK:${job.id}:${dateBucket}`,
        evidence: { jobNumber: job.jobNumber, changeOrdersCount: job.changeOrdersCount, customerName: job.customerName }
      });
    }

    // REWORK_RISK
    if (job.reworkFlag && margin !== null && margin < 0.30) {
      await emitSignal({
        type: 'REWORK_RISK',
        severity: 'warn',
        crmJobId: job.id,
        crewId: job.crewId,
        repUserId: job.assignedRepUserId,
        message: `Job ${job.jobNumber} flagged for rework with ${margin !== null ? (margin * 100).toFixed(1) + '% margin' : 'unknown margin'}`,
        dedupeKey: `REWORK_RISK:${job.id}:${dateBucket}`,
        evidence: { jobNumber: job.jobNumber, reworkFlag: true, marginPct: margin, customerName: job.customerName }
      });
    }
  }

  // ─── 2. Discount signals (from SaleSnapshot / ProposalPricingSnapshot) ────
  for (const job of rangeJobs) {
    const contract = job.contractValueCents || 0;
    if (!contract) continue;

    // Look for matching proposal snapshot
    const snap = proposals.find(p => p.crmJobId === job.id || p.jobId === job.externalJobId);
    if (!snap) continue;

    const presented = snap.totalPriceCents || snap.sellPriceCents || snap.agreedSubtotalCents || 0;
    if (!presented || presented <= contract) continue;

    const discountPct = (presented - contract) / presented;
    if (discountPct >= DISCOUNT_THRESHOLD) {
      await emitSignal({
        type: 'DISCOUNT_OVER_THRESHOLD',
        severity: discountPct >= 0.20 ? 'critical' : 'warn',
        crmJobId: job.id,
        repUserId: job.assignedRepUserId,
        message: `Job ${job.jobNumber} discounted ${(discountPct * 100).toFixed(1)}% from presented price`,
        dedupeKey: `DISCOUNT_OVER_THRESHOLD:${job.id}:${dateBucket}`,
        evidence: { jobNumber: job.jobNumber, presentedCents: presented, contractCents: contract, discountPct, customerName: job.customerName }
      });
    }
  }

  // ─── 3. Aggregate signals (by rep, zone, crew) ───────────────────────────
  const recognizedJobs = rangeJobs.filter(j => j.recognitionStatus === 'RECOGNIZED' && j.contractValueCents > 0);

  // By Rep
  const byRep = groupBy(recognizedJobs, j => j.assignedRepUserId);
  for (const [repId, repJobs] of Object.entries(byRep)) {
    if (repJobs.length < MIN_JOBS_FOR_AGG) continue;
    const totalContract = repJobs.reduce((s, j) => s + (j.contractValueCents || 0), 0);
    const totalCost = repJobs.reduce((s, j) => s + (j.directCostCents || 0), 0);
    const avgMargin = netMarginPct(totalContract, totalCost);
    if (avgMargin !== null && avgMargin < MARGIN_FLOOR) {
      await emitSignal({
        type: 'LOW_NET_MARGIN_BY_REP',
        severity: avgMargin < 0.15 ? 'critical' : 'warn',
        repUserId: repId,
        message: `Rep avg net margin ${(avgMargin * 100).toFixed(1)}% on ${repJobs.length} jobs (below ${(MARGIN_FLOOR * 100).toFixed(0)}% floor)`,
        dedupeKey: `LOW_NET_MARGIN_BY_REP:${repId}:${dateBucket}`,
        evidence: { repUserId: repId, jobCount: repJobs.length, avgMarginPct: avgMargin, totalContractCents: totalContract }
      });
    }
  }

  // By Zone
  const byZone = groupBy(recognizedJobs, j => j.zoneId);
  for (const [zoneId, zoneJobs] of Object.entries(byZone)) {
    if (zoneJobs.length < MIN_JOBS_FOR_AGG) continue;
    const totalContract = zoneJobs.reduce((s, j) => s + (j.contractValueCents || 0), 0);
    const totalCost = zoneJobs.reduce((s, j) => s + (j.directCostCents || 0), 0);
    const avgMargin = netMarginPct(totalContract, totalCost);
    if (avgMargin !== null && avgMargin < MARGIN_FLOOR) {
      await emitSignal({
        type: 'LOW_NET_MARGIN_BY_ZONE',
        severity: avgMargin < 0.15 ? 'critical' : 'warn',
        zoneId,
        message: `Zone avg net margin ${(avgMargin * 100).toFixed(1)}% on ${zoneJobs.length} jobs`,
        dedupeKey: `LOW_NET_MARGIN_BY_ZONE:${zoneId}:${dateBucket}`,
        evidence: { zoneId, jobCount: zoneJobs.length, avgMarginPct: avgMargin, totalContractCents: totalContract }
      });
    }
  }

  // By Crew
  const byCrew = groupBy(recognizedJobs, j => j.crewId);
  for (const [crewId, crewJobs] of Object.entries(byCrew)) {
    if (crewJobs.length < MIN_JOBS_FOR_AGG) continue;
    const totalContract = crewJobs.reduce((s, j) => s + (j.contractValueCents || 0), 0);
    const totalCost = crewJobs.reduce((s, j) => s + (j.directCostCents || 0), 0);
    const avgMargin = netMarginPct(totalContract, totalCost);
    if (avgMargin !== null && avgMargin < MARGIN_FLOOR) {
      await emitSignal({
        type: 'LOW_NET_MARGIN_BY_CREW',
        severity: avgMargin < 0.15 ? 'critical' : 'warn',
        crewId,
        message: `Crew avg net margin ${(avgMargin * 100).toFixed(1)}% on ${crewJobs.length} jobs`,
        dedupeKey: `LOW_NET_MARGIN_BY_CREW:${crewId}:${dateBucket}`,
        evidence: { crewId, jobCount: crewJobs.length, avgMarginPct: avgMargin, totalContractCents: totalContract }
      });
    }
  }

  // High cancellation by zone
  const allZoneJobs = groupBy(jobs.filter(j => j.zoneId), j => j.zoneId);
  for (const [zoneId, zJobs] of Object.entries(allZoneJobs)) {
    if (zJobs.length < MIN_JOBS_FOR_AGG) continue;
    const cancelled = zJobs.filter(j => j.status === 'canceled' || j.status === 'lost').length;
    const cancelRate = cancelled / zJobs.length;
    if (cancelRate >= 0.30) {
      await emitSignal({
        type: 'HIGH_CANCELLATION_ZONE',
        severity: cancelRate >= 0.50 ? 'critical' : 'warn',
        zoneId,
        message: `Zone cancellation rate ${(cancelRate * 100).toFixed(0)}% (${cancelled}/${zJobs.length} jobs)`,
        dedupeKey: `HIGH_CANCELLATION_ZONE:${zoneId}:${dateBucket}`,
        evidence: { zoneId, cancelRate, cancelledJobs: cancelled, totalJobs: zJobs.length }
      });
    }
  }

  // ─── Build summary stats ─────────────────────────────────────────────────
  const totalContract = recognizedJobs.reduce((s, j) => s + (j.contractValueCents || 0), 0);
  const totalCost = recognizedJobs.reduce((s, j) => s + (j.directCostCents || 0), 0);
  const overallMargin = netMarginPct(totalContract, totalCost);

  return Response.json({
    success: true,
    dateRange: { start, end },
    summary: {
      recognizedJobs: recognizedJobs.length,
      totalContractCents: totalContract,
      totalCostCents: totalCost,
      overallMarginPct: overallMargin,
      signalsEmitted: signals.length
    },
    signals: signals.map(s => ({ type: s.type, severity: s.severity, message: s.message })),
    thresholds: { MARGIN_FLOOR, DISCOUNT_THRESHOLD, CHANGE_ORDER_THRESHOLD, MIN_JOBS_FOR_AGG }
  });
});