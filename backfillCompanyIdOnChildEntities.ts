import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Backfill companyId onto child entities that lack it.
 * - Run, Gate, MaterialLine: join through Job.id → Job.companyId
 * - AlertEvent, MetricsEvent: set to primary company (single-tenant safe)
 *
 * Run in dryRun=true first to preview, then dryRun=false to apply.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // default true — safe
    const entityFilter = body.entity || null; // optional: run one entity at a time

    const db = base44.asServiceRole;

    // ── 1. Build jobId → companyId map ─────────────────────────────
    const jobs = await db.entities.Job.list(undefined, 500);
    const jobMap = {};
    for (const j of jobs) {
      if (j.companyId) jobMap[j.id] = j.companyId;
    }
    console.log(`[backfill] ${jobs.length} jobs loaded, ${Object.keys(jobMap).length} have companyId`);

    // Get primary companyId for entities without a jobId link
    const companies = await db.entities.CompanySettings.list(undefined, 5);
    const primaryCompanyId = companies[0]?.companyId || companies[0]?.id;
    console.log(`[backfill] primaryCompanyId = ${primaryCompanyId}`);

    const results = {};

    // ── 2. Helper: backfill job-linked entities ─────────────────────
    async function backfillJobLinked(entityName) {
      const records = await db.entities[entityName].list(undefined, 1000);
      const missing = records.filter(r => !r.companyId);
      const resolvable = missing.filter(r => jobMap[r.jobId]);
      const unresolvable = missing.filter(r => !jobMap[r.jobId]);

      console.log(`[backfill] ${entityName}: ${records.length} total, ${missing.length} missing companyId, ${resolvable.length} resolvable`);

      if (!dryRun) {
        let updated = 0;
        const BATCH = 5;
        for (let i = 0; i < resolvable.length; i += BATCH) {
          const batch = resolvable.slice(i, i + BATCH);
          await Promise.all(batch.map(r => db.entities[entityName].update(r.id, { companyId: jobMap[r.jobId] })));
          updated += batch.length;
          if (i + BATCH < resolvable.length) await new Promise(r => setTimeout(r, 800));
        }
        results[entityName] = { total: records.length, updated, unresolvable: unresolvable.length };
      } else {
        results[entityName] = { total: records.length, wouldUpdate: resolvable.length, unresolvable: unresolvable.length, dryRun: true };
      }
    }

    // ── 3. Helper: backfill platform events without jobId ───────────
    async function backfillByPrimaryCompany(entityName) {
      const records = await db.entities[entityName].list(undefined, 500);
      const missing = records.filter(r => !r.companyId);

      console.log(`[backfill] ${entityName}: ${records.length} total, ${missing.length} missing companyId`);

      if (!dryRun) {
        let updated = 0;
        const BATCH = 5;
        for (let i = 0; i < missing.length; i += BATCH) {
          const batch = missing.slice(i, i + BATCH);
          await Promise.all(batch.map(r => db.entities[entityName].update(r.id, { companyId: primaryCompanyId })));
          updated += batch.length;
          if (i + BATCH < missing.length) await new Promise(r => setTimeout(r, 800));
        }
        results[entityName] = { total: records.length, updated };
      } else {
        results[entityName] = { total: records.length, wouldUpdate: missing.length, dryRun: true };
      }
    }

    // ── 4. Run backfills ────────────────────────────────────────────
    const jobLinked = ['Run', 'Gate', 'MaterialLine'];
    const platformLinked = ['AlertEvent', 'MetricsEvent'];
    const allEntities = [...jobLinked, ...platformLinked];
    const toProcess = entityFilter ? [entityFilter] : allEntities;

    for (const e of toProcess) {
      if (jobLinked.includes(e)) await backfillJobLinked(e);
      else await backfillByPrimaryCompany(e);
    }

    return Response.json({
      status: 'ok',
      dryRun,
      primaryCompanyId,
      results,
      message: dryRun
        ? 'Dry run complete. Pass dryRun=false to apply.'
        : 'Backfill applied. Re-run tenantIsolationDiagnostic to verify.'
    });

  } catch (error) {
    console.error('[backfillCompanyIdOnChildEntities] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});