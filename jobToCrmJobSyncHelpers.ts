/**
 * JOB TO CRM JOB SYNC HELPERS
 * Idempotent helpers for syncing signed Job records to CRMJob
 */

/**
 * Determine if a Job should be synced to CRMJob (signed trigger)
 * CANONICAL RULE: Job is signed if customer accepted proposal AND signature exists
 */
export function isJobSigned(job) {
  if (!job) return false;
  // Both conditions required: accepted by customer AND signature exists
  const hasAcceptance = job.proposalAccepted === true;
  const hasSignature = !!job.signatureRecordId || !!job.signedAt;
  return hasAcceptance && hasSignature;
}

/**
 * Find existing CRMJob by strict matching rules
 * Returns first match found in priority order, or null if not found / ambiguous
 * 
 * MATCH PRIORITY:
 * 1. CRMJob.externalJobId == Job.id (exact link)
 * 2. CRMJob.jobNumber == Job.jobNumber (secondary, only if jobNumber exists and is reasonably unique)
 * 3. If multiple possible matches: return AMBIGUOUS status
 */
export async function findExistingCrmJob(job, allCrmJobs = null) {
  if (!job || !job.id) {
    return { status: 'MISSING_JOB_ID', match: null };
  }

  // Lazy load if not provided
  if (!allCrmJobs) {
    const { base44 } = await import('@/api/base44Client');
    try {
      allCrmJobs = await base44.entities.CRMJob.filter({ 
        companyId: job.companyId 
      });
    } catch (err) {
      return { status: 'FETCH_ERROR', match: null, error: err.message };
    }
  }

  const matches = [];

  // RULE 1: externalJobId match (exact, single-key)
  const externalMatch = allCrmJobs.find(crm => crm.externalJobId === job.id);
  if (externalMatch) {
    matches.push({ crm: externalMatch, priority: 1, rule: 'externalJobId' });
  }

  // RULE 2: jobNumber match (only if externalJobId not found)
  if (!externalMatch && job.jobNumber) {
    const jobNumberMatches = allCrmJobs.filter(crm => crm.jobNumber === job.jobNumber);
    if (jobNumberMatches.length === 1) {
      matches.push({ crm: jobNumberMatches[0], priority: 2, rule: 'jobNumber' });
    } else if (jobNumberMatches.length > 1) {
      // Multiple matches on jobNumber alone = ambiguous
      return { 
        status: 'AMBIGUOUS_MATCH', 
        match: null,
        details: `${jobNumberMatches.length} CRMJobs match jobNumber='${job.jobNumber}'`
      };
    }
  }

  // Return highest priority match
  if (matches.length === 0) {
    return { status: 'NO_MATCH', match: null };
  }

  // Sort by priority and return first
  matches.sort((a, b) => a.priority - b.priority);
  return { 
    status: 'FOUND', 
    match: matches[0].crm,
    rule: matches[0].rule 
  };
}

/**
 * Validate essential fields before sync
 * Returns { valid: boolean, errors: string[] }
 */
export function validateJobForSync(job) {
  const errors = [];

  if (!job.companyId) errors.push('missing_companyId');
  if (!job.id) errors.push('missing_job_id');
  if (!job.jobNumber) errors.push('missing_jobNumber');
  if (!job.customerName) errors.push('missing_customerName');
  if (!job.addressLine1) errors.push('missing_address');
  if (!job.signedAt && !job.signatureRecordId) errors.push('missing_signed_timestamp');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Build CRMJob payload from Job
 * Returns minimal payload for create/update
 */
export function buildCrmJobPayload(job) {
  return {
    companyId: job.companyId,
    jobNumber: job.jobNumber,
    customerName: job.customerName,
    externalJobId: job.id, // Primary link back to Job
    contractStatus: 'signed',
    saleStatus: 'sold',
    stage: 'signed',
    wonAt: job.signedAt || new Date().toISOString(),
    signatureRecordId: job.signatureRecordId,
    notes: job.jobNotes || `Synced from Job ${job.jobNumber}`,
    createdFrom: 'ui_create',
    jobType: 'fence', // Default for fence business
    // Snapshot references if available
    ...(job.active_pricing_snapshot_id && { 
      currentPricingSnapshotId: job.active_pricing_snapshot_id 
    }),
    ...(job.active_takeoff_snapshot_id && { 
      takeoffSnapshotId: job.active_takeoff_snapshot_id 
    })
  };
}

/**
 * Sync a single Job to CRMJob
 * Idempotent: query first, then create or update exactly once
 * 
 * Returns: { 
 *   action: 'CREATED' | 'UPDATED' | 'SKIPPED', 
 *   crmJobId: string,
 *   reason: string,
 *   error?: string
 * }
 */
export async function syncJobToCrmJob(job, { dryRun = false } = {}) {
  const log = (msg, obj = {}) => {
    console.log(`[SyncJob ${job.id}]`, msg, obj);
  };

  try {
    // STEP 1: Check if job is signed
    if (!isJobSigned(job)) {
      return { action: 'SKIPPED', reason: 'JOB_NOT_SIGNED', crmJobId: null };
    }

    // STEP 2: Validate required fields
    const validation = validateJobForSync(job);
    if (!validation.valid) {
      return { 
        action: 'SKIPPED', 
        reason: 'MISSING_REQUIRED_FIELDS',
        errors: validation.errors,
        crmJobId: null
      };
    }

    // STEP 3: Find existing CRMJob
    const { base44 } = await import('@/api/base44Client');
    const findResult = await findExistingCrmJob(job);
    
    if (findResult.status === 'AMBIGUOUS_MATCH') {
      log('AMBIGUOUS_MATCH', { details: findResult.details });
      return { 
        action: 'SKIPPED', 
        reason: 'AMBIGUOUS_MATCH',
        details: findResult.details,
        crmJobId: null
      };
    }

    if (findResult.status === 'FETCH_ERROR') {
      log('FETCH_ERROR', { error: findResult.error });
      return { 
        action: 'SKIPPED', 
        reason: 'FETCH_ERROR',
        error: findResult.error,
        crmJobId: null
      };
    }

    // STEP 4: Prepare payload
    const payload = buildCrmJobPayload(job);

    // STEP 5: Create or update
    let crmJobId = null;
    let action = 'SKIPPED';
    let reason = 'UNKNOWN';

    if (findResult.status === 'FOUND' && findResult.match) {
      // UPDATE existing
      crmJobId = findResult.match.id;
      if (!dryRun) {
        await base44.entities.CRMJob.update(crmJobId, payload);
      }
      action = 'UPDATED';
      reason = `matched_by_${findResult.rule}`;
      log('UPDATED', { crmJobId, rule: findResult.rule });
    } else if (findResult.status === 'NO_MATCH') {
      // CREATE new
      if (!dryRun) {
        const created = await base44.entities.CRMJob.create(payload);
        crmJobId = created.id;
      } else {
        crmJobId = '[DRY_RUN]';
      }
      action = 'CREATED';
      reason = 'no_existing_match';
      log('CREATED', { crmJobId });
    }

    return { action, crmJobId, reason };

  } catch (err) {
    console.error(`[SyncJob ${job.id}] ERROR:`, err.message);
    return { 
      action: 'FAILED',
      reason: err.message,
      crmJobId: null,
      error: err.message
    };
  }
}

/**
 * Backfill: Sync all signed Jobs to CRMJob
 * Supports dry-run mode for validation before commit
 * 
 * Options: { companyId, dryRun, limit?, startDate?, endDate? }
 * 
 * Returns summary report with counts and per-record details
 */
export async function backfillSignedJobsToCrmJobs(opts = {}) {
  const { 
    companyId, 
    dryRun = true, 
    limit = null, 
    startDate = null, 
    endDate = null 
  } = opts;

  console.log('[Backfill] Starting', { dryRun, companyId, limit });

  const { base44 } = await import('@/api/base44Client');

  try {
    // Fetch all Jobs for company
    const allJobs = await base44.entities.Job.filter({ companyId });
    console.log(`[Backfill] Fetched ${allJobs.length} total Jobs`);

    // Filter to signed jobs only
    let signedJobs = allJobs.filter(job => isJobSigned(job));
    console.log(`[Backfill] Found ${signedJobs.length} signed Jobs`);

    // Apply date filters if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      signedJobs = signedJobs.filter(job => {
        const jobDate = new Date(job.signedAt || job.updated_date);
        if (start && jobDate < start) return false;
        if (end && jobDate > end) return false;
        return true;
      });
      console.log(`[Backfill] After date filter: ${signedJobs.length} Jobs`);
    }

    // Apply limit
    if (limit) {
      signedJobs = signedJobs.slice(0, limit);
      console.log(`[Backfill] Limited to ${signedJobs.length} Jobs`);
    }

    // Process each job
    const results = [];
    for (const job of signedJobs) {
      const result = await syncJobToCrmJob(job, { dryRun });
      results.push({
        jobId: job.id,
        jobNumber: job.jobNumber,
        customerName: job.customerName,
        ...result
      });
    }

    // Build summary
    const summary = {
      dryRun,
      timestamp: new Date().toISOString(),
      scanned: signedJobs.length,
      created: results.filter(r => r.action === 'CREATED').length,
      updated: results.filter(r => r.action === 'UPDATED').length,
      skipped: results.filter(r => r.action === 'SKIPPED').length,
      failed: results.filter(r => r.action === 'FAILED').length,
      details: results
    };

    console.log('[Backfill] Summary', {
      scanned: summary.scanned,
      created: summary.created,
      updated: summary.updated,
      skipped: summary.skipped,
      failed: summary.failed
    });

    return summary;

  } catch (err) {
    console.error('[Backfill] FATAL ERROR', err);
    return {
      dryRun,
      error: err.message,
      scanned: 0,
      details: []
    };
  }
}