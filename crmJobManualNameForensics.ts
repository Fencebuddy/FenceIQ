import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * READ-ONLY diagnostic function to investigate null customerName issues
 * across manual CRMJob creations.
 * 
 * Scopes by tenantId (canonical multi-tenant key) + optional companyKey.
 * Returns sample of recent jobs with creation context.
 * 
 * Payload: { limit?: number (default 50), companyKey?: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    // Auth
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const limitRaw = payload?.limit;
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(200, Number(limitRaw))) : 50;

    // Resolve company context (tenantId canonical)
    const tenantId = user.id; // Simplified: use user's tenant as base (adjust if multi-workspace)

    // Get company settings to understand scoping
    const companies = await base44.asServiceRole.entities.CompanySettings.list();
    const company = companies[0];

    const companyKey = company?.companyId || payload?.companyKey;
    const companyEntityId = company?.id;

    // Fetch jobs by tenantId (admin scope)
    // If company exists, also scope by companyId field in CRMJob
    let jobs = [];
    if (companyEntityId) {
      jobs = await base44.asServiceRole.entities.CRMJob.filter({ companyId: companyEntityId });
    } else {
      jobs = await base44.asServiceRole.entities.CRMJob.list();
    }

    // Slice to limit
    const samples = jobs.slice(0, limit);

    // Compute stats
    const createdFromSet = new Set();
    const createdByUserIdSet = new Set();
    let missingCustomerNameCount = 0;

    for (const job of samples) {
      if (job.createdFrom) createdFromSet.add(job.createdFrom);
      if (job.createdByUserId || job.created_by) {
        const id = job.createdByUserId || job.created_by;
        createdByUserIdSet.add(id);
      }
      if (!job.customerName || (typeof job.customerName === 'string' && job.customerName.trim() === '')) {
        missingCustomerNameCount++;
      }
    }

    // Build detailed samples
    const detailedSamples = samples.map(job => ({
      id: job.id,
      jobNumber: job.jobNumber,
      customerName: job.customerName || null,
      createdFrom: job.createdFrom || null,
      createdAt: job.created_date || null,
      createdByUserId: job.createdByUserId || job.created_by || null,
      source: job.source || null,
      externalJobId: job.externalJobId || null,
      primaryContactId: job.primaryContactId || null,
      accountId: job.accountId || null,
      jobsiteAddressId: job.jobsiteAddressId || null,
      companyId: job.companyId || null
    }));

    return Response.json({
      success: true,
      context: {
        tenantId,
        companyKey,
        companyEntityId,
        mode: companyEntityId ? 'company_scoped' : 'tenant_wide'
      },
      stats: {
        sampleCount: samples.length,
        missingCustomerNameCount,
        distinct_createdFrom: Array.from(createdFromSet),
        distinct_createdByUserIdCount: createdByUserIdSet.size
      },
      samples: detailedSamples
    });
  } catch (error) {
    console.error('[FORENSICS_ERROR]', error.message);
    return Response.json({
      success: false,
      error: 'DIAGNOSTIC_FAILED',
      details: error.message
    }, { status: 500 });
  }
});