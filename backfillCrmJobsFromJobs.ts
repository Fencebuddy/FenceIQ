import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * BACKFILL CRM JOBS FROM LEGACY JOBS
 * Creates CRMJob twins for existing Jobs
 * Scoped, safe, repeatable, non-destructive
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const dryRun = payload.dryRun || false;

    // Get company context
    const ctxRes = await base44.functions.invoke('getCompanyContext', {});
    if (!ctxRes?.data?.success || !ctxRes?.data?.companyId) {
      return Response.json({ error: 'Company context unavailable' }, { status: 400 });
    }
    const companyId = ctxRes.data.companyId;

    // SCOPED: Only fetch Jobs for this company
    const allJobs = await base44.asServiceRole.entities.Job.filter({ companyId });
    
    // Existing CRM jobs for this company
    const existingCrmJobs = await base44.asServiceRole.entities.CRMJob.filter({ companyId });
    const existingByExternalId = new Map(
      existingCrmJobs
        .filter(c => c.externalJobId)
        .map(c => [c.externalJobId, c])
    );

    const results = {
      scanned: allJobs.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const job of allJobs) {
      try {
        const existing = existingByExternalId.get(job.id);

        // Prepare CRM patch
        const crmPatch = {
          companyId,
          jobNumber: job.jobNumber,
          externalJobId: job.id,
          customerName: job.customerName || '',
          stage: mapJobStatusToStage(job.status),
          contractStatus: job.proposalAccepted ? 'signed' : 'unsigned',
          assignedRepUserId: job.created_by || user.id,
          fenceCategory: (job.materialType || 'Vinyl').toLowerCase(),
          source: 'legacy_sync',
          createdFrom: 'manual'
        };

        // Apply invariants
        const invariantRes = await base44.asServiceRole.functions.invoke('enforceCrmJobInvariants', {
          patch: crmPatch
        });
        const normalizedPatch = invariantRes?.data?.success 
          ? invariantRes.data.normalized 
          : crmPatch;

        if (existing) {
          // Non-destructive update: only fill empty fields
          const updates = {};
          Object.keys(normalizedPatch).forEach(key => {
            if (!existing[key] || existing[key] === '' || existing[key] === 0) {
              updates[key] = normalizedPatch[key];
            }
          });

          if (!dryRun && Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.CRMJob.update(existing.id, updates);
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          // Create new CRMJob
          if (!dryRun) {
            await base44.asServiceRole.entities.CRMJob.create(normalizedPatch);
            results.created++;
          } else {
            results.created++; // Dry run count
          }
        }
      } catch (err) {
        results.errors.push({
          jobNumber: job.jobNumber,
          error: err.message
        });
      }
    }

    return Response.json({
      success: true,
      companyId,
      dryRun,
      results
    });
  } catch (error) {
    console.error('Backfill failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper: map Job.status to CRMJob.stage
function mapJobStatusToStage(status) {
  const mapping = {
    'Draft': 'new',
    'Inspection Complete': 'mapped',
    'Sent to Office': 'job_cost_ready',
    'Proposal Signed': 'signed',
    'Sold': 'signed',
    'Installed': 'installed',
    'Closed': 'installed',
    'Cancelled': 'cancelled'
  };
  return mapping[status] || 'new';
}