import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get company context (both tenantId and companyKey)
    const ctxRes = await base44.asServiceRole.functions.invoke('getCompanyContext', {});
    if (!ctxRes?.data?.success) {
      return Response.json({ error: 'Company context unavailable' }, { status: 400 });
    }

    const tenantId = ctxRes.data.company?.id;           // entity id
    const companyKey = ctxRes.data.company?.companyId;  // string identifier
    const company = ctxRes.data.company;

    if (!tenantId) {
      return Response.json({ error: 'tenantId not found' }, { status: 400 });
    }

    // Helper: compute stats from job array
    function computeStats(jobs) {
      const count = jobs.length;
      const missingCustomerNameCount = jobs.filter(j =>
        !j.customerName || j.customerName.trim() === '' || j.customerName === 'Unknown Customer'
      ).length;
      const hasCustomerNameCount = count - missingCustomerNameCount;
      const distinctCompanyIdValues = [...new Set(jobs.map(j => j.companyId))];

      return {
        count,
        missingCustomerNameCount,
        hasCustomerNameCount,
        distinctCompanyIdValues
      };
    }

    // Helper: sample formatter
    function sampleJob(j) {
      return {
        id: j.id,
        companyId: j.companyId,
        jobNumber: j.jobNumber,
        customerName: j.customerName,
        externalCRM: j.externalCRM,
        externalAppointmentId: j.externalAppointmentId,
        externalCustomerId: j.externalCustomerId,
        createdAt: j.created_date || j.createdAt,
        updatedAt: j.updated_date || j.updatedAt,
        possibleOverwrite: j.updated_date > j.created_date ? true : false
      };
    }

    // Scope 1: Pull jobs by tenantId
    const jobsByTenant = await base44.asServiceRole.entities.CRMJob.filter({
      companyId: tenantId
    });

    // Scope 2: Pull jobs by companyKey (if different from tenantId)
    let jobsByKey = [];
    if (companyKey && companyKey !== tenantId) {
      try {
        jobsByKey = await base44.asServiceRole.entities.CRMJob.filter({
          companyId: companyKey
        });
      } catch (e) {
        // companyKey scope may not exist
      }
    }

    // Sort by createdAt and slice last 30
    const tenantSorted = jobsByTenant
      .sort((a, b) => new Date(a.created_date || a.createdAt) - new Date(b.created_date || b.createdAt))
      .slice(-30);
    const keySorted = jobsByKey
      .sort((a, b) => new Date(a.created_date || a.createdAt) - new Date(b.created_date || b.createdAt))
      .slice(-30);

    // Compute stats
    const tenantStats = computeStats(tenantSorted);
    const keyStats = computeStats(keySorted);

    // Sample: top 10 from each
    const tenantSamples = tenantSorted.slice(-10).map(sampleJob);
    const keySamples = keySorted.slice(-10).map(sampleJob);

    // Determine verdict
    let verdict = 'UNKNOWN';
    const tenantHasJobs = tenantStats.count > 0;
    const keyHasJobs = keyStats.count > 0;
    const tenantHasNames = tenantStats.hasCustomerNameCount > 0;
    const keyHasNames = keyStats.hasCustomerNameCount > 0;

    if (tenantHasJobs && !keyHasJobs) {
      verdict = tenantHasNames ? 'WRITE_OK_TENANT_CANONICAL' : 'WRITE_MISSING_CUSTOMER_NAMES';
    } else if (keyHasJobs && !tenantHasJobs) {
      verdict = 'SCOPE_MISMATCH_KEY_HAS_JOBS_TENANT_EMPTY';
    } else if (tenantHasJobs && keyHasJobs) {
      if (tenantHasNames && !keyHasNames) {
        verdict = 'SCOPE_MISMATCH_TENANT_HAS_NAMES_KEY_EMPTY';
      } else if (!tenantHasNames && keyHasNames) {
        verdict = 'SCOPE_MISMATCH_KEY_HAS_NAMES_TENANT_MISSING';
      } else if (tenantHasNames && keyHasNames) {
        verdict = 'WRITE_OK_BOTH_SCOPES_HAVE_NAMES';
      } else {
        verdict = 'OVERWRITE_SUSPECTED_BOTH_MISSING';
      }
    } else {
      // No jobs in either scope
      verdict = 'NO_JOBS_FOUND';
    }

    return Response.json({
      success: true,
      context: {
        tenantId,
        companyKey,
        companyName: company?.companyName
      },
      byTenant: {
        ...tenantStats,
        samples: tenantSamples
      },
      byKey: {
        ...keyStats,
        samples: keySamples
      },
      verdict
    });
  } catch (error) {
    console.error('Verify CRM job names failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});