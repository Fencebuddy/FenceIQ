import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Assign all jobs to default zone (bypassing address matching)
 * Used when jobsiteAddressId is missing across all jobs
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { companyId, zoneId } = body;
    
    if (!companyId || !zoneId) {
      return Response.json({ error: 'companyId and zoneId required' }, { status: 400 });
    }

    // Get all unassigned jobs
    const jobs = await base44.asServiceRole.entities.CRMJob.filter({ companyId, zoneId: null });

    let assigned = 0;
    for (const job of jobs) {
      await base44.asServiceRole.entities.CRMJob.update(job.id, { zoneId });
      assigned++;
    }

    return Response.json({
      success: true,
      assigned,
      message: `Assigned ${assigned} jobs to zone ${zoneId}`
    });
  } catch (error) {
    console.error('assignAllJobsToDefaultZone error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});