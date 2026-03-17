/**
 * BACKFILL SIGNED JOBS TO CRM JOBS
 * Phase 4: Execute the actual sync
 * 
 * Syncs all signed Job records to CRMJob records.
 * - Idempotent (safe to run multiple times)
 * - Creates missing CRMJob records for signed Jobs
 * - Links Job → CRMJob via externalJobId
 * - Returns detailed sync report
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SIGNED_JOB_TRIGGERS = {
  proposalAccepted: true,
  hasSignatureRecord: true,
  hasSigned: true
};

function isJobSigned(job) {
  const hasProposalAccepted = job.proposalAccepted === true;
  const hasSignedField = job.signedAt || job.customerSignatureName;
  const hasSignatureRecord = job.signatureRecordId;
  
  return hasProposalAccepted || hasSignedField || hasSignatureRecord;
}

function buildCrmJobFromSignedJob(job, companyId) {
  return {
    companyId,
    jobNumber: job.jobNumber || `JOB-${job.id.slice(0, 8)}`,
    status: 'won',
    stage: 'signed',
    saleStatus: 'sold',
    contractStatus: 'signed',
    externalJobId: job.id,
    createdFrom: 'manual',
    customerName: job.customerName,
    signatureRecordId: job.signatureRecordId || null,
    wonAt: job.signedAt ? new Date(job.signedAt).toISOString() : new Date().toISOString(),
    notes: `Synced from legacy Job ${job.jobNumber} on ${new Date().toISOString()}`
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    if (user.role !== 'admin') {
      return Response.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { companyId } = await req.json();

    if (!companyId) {
      return Response.json({ error: 'companyId required' }, { status: 400 });
    }

    console.log(`[Backfill] Starting for company ${companyId}`);

    // Fetch all Jobs for company
    const allJobs = await base44.asServiceRole.entities.Job.filter({ companyId });
    console.log(`[Backfill] Fetched ${allJobs.length} Jobs`);

    // Filter to signed
    const signedJobs = allJobs.filter(job => isJobSigned(job));
    console.log(`[Backfill] Found ${signedJobs.length} signed Jobs`);

    if (signedJobs.length === 0) {
      return Response.json({
        companyId,
        success: true,
        message: 'No signed Jobs found',
        synced: 0,
        skipped: 0
      });
    }

    // Fetch all CRMJobs for company
    const allCrmJobs = await base44.asServiceRole.entities.CRMJob.filter({ companyId });
    const linkedJobIds = new Set(
      allCrmJobs
        .filter(crm => crm.externalJobId)
        .map(crm => crm.externalJobId)
    );

    console.log(`[Backfill] Found ${linkedJobIds.size} linked CRMJobs`);

    // Find unmatched signed Jobs
    const unmatchedJobs = signedJobs.filter(job => !linkedJobIds.has(job.id));
    console.log(`[Backfill] Found ${unmatchedJobs.length} unmatched signed Jobs to sync`);

    // Create CRMJobs for unmatched signed Jobs
    let synced = 0;
    let failed = 0;
    const syncedJobs = [];
    const failedJobs = [];

    for (const job of unmatchedJobs) {
      try {
        const crmJobData = buildCrmJobFromSignedJob(job, companyId);
        const newCrmJob = await base44.asServiceRole.entities.CRMJob.create(crmJobData);
        synced++;
        syncedJobs.push({
          jobId: job.id,
          jobNumber: job.jobNumber,
          crmJobId: newCrmJob.id,
          customerName: job.customerName
        });
        console.log(`[Backfill] ✓ Synced Job ${job.jobNumber} → CRMJob ${newCrmJob.id}`);
      } catch (err) {
        failed++;
        failedJobs.push({
          jobId: job.id,
          jobNumber: job.jobNumber,
          error: err.message
        });
        console.error(`[Backfill] ✗ Failed to sync Job ${job.jobNumber}:`, err.message);
      }
    }

    const skipped = signedJobs.length - unmatchedJobs.length;

    return Response.json({
      companyId,
      success: failed === 0,
      summary: {
        totalSignedJobs: signedJobs.length,
        synced,
        skipped,
        failed
      },
      syncedJobs: syncedJobs.slice(0, 10), // Show first 10
      failedJobs: failedJobs.slice(0, 10),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Backfill] ERROR:', error);
    return Response.json(
      { error: error.message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
});