import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Backfill stewardship touchpoints for existing sold/installed jobs
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { companyId } = payload;

    if (!companyId) {
      return Response.json({ error: 'companyId required' }, { status: 400 });
    }

    // Verify user is admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all sold jobs
    const soldJobs = await base44.asServiceRole.entities.CRMJob.filter({
      companyId,
      saleStatus: 'sold'
    });

    console.log(`Found ${soldJobs.length} sold jobs`);

    let touchpointsCreated = 0;
    let profilesCreated = 0;

    for (const job of soldJobs) {
      // Get or create profile
      const profile = await getOrCreateProfile(base44, job);
      if (!profile) continue;

      profilesCreated++;

      // Check if THANK_YOU touchpoint already exists
      const existing = await base44.asServiceRole.entities.StewardshipTouchpoint.filter({
        companyId,
        customerProfileId: profile.id,
        crmJobId: job.id,
        type: 'THANK_YOU'
      });

      if (existing.length === 0) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        await base44.asServiceRole.entities.StewardshipTouchpoint.create({
          companyId,
          customerProfileId: profile.id,
          type: 'THANK_YOU',
          channel: 'email',
          scheduledAt: tomorrow.toISOString(),
          status: 'scheduled',
          crmJobId: job.id
        });
        touchpointsCreated++;
      }

      // If installed, add REVIEW_REQUEST
      if (job.installStatus === 'installed') {
        const reviewExisting = await base44.asServiceRole.entities.StewardshipTouchpoint.filter({
          companyId,
          customerProfileId: profile.id,
          crmJobId: job.id,
          type: 'REVIEW_REQUEST'
        });

        if (reviewExisting.length === 0) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 7);

          await base44.asServiceRole.entities.StewardshipTouchpoint.create({
            companyId,
            customerProfileId: profile.id,
            type: 'REVIEW_REQUEST',
            channel: 'email',
            scheduledAt: futureDate.toISOString(),
            status: 'scheduled',
            crmJobId: job.id
          });
          touchpointsCreated++;
        }
      }
    }

    return Response.json({
      success: true,
      jobsProcessed: soldJobs.length,
      profilesCreated,
      touchpointsCreated
    });
  } catch (error) {
    console.error('backfillStewardshipTouchpoints error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getOrCreateProfile(base44, crmJob) {
  try {
    const existing = await base44.asServiceRole.entities.CustomerProfile.filter({
      companyId: crmJob.companyId,
      customerId: crmJob.accountId
    });

    if (existing.length > 0) {
      return existing[0];
    }

    let firstName = crmJob.customerName ? crmJob.customerName.split(' ')[0] : 'Customer';
    let lastName = crmJob.customerName ? crmJob.customerName.split(' ').slice(1).join(' ') : '';

    return await base44.asServiceRole.entities.CustomerProfile.create({
      companyId: crmJob.companyId,
      customerId: crmJob.accountId,
      firstName,
      lastName,
      email: crmJob.email || '',
      phone: crmJob.phone || ''
    });
  } catch (error) {
    console.warn(`Could not create profile for job ${crmJob.id}:`, error.message);
    return null;
  }
}