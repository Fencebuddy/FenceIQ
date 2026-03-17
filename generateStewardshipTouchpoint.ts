import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Generate stewardship touchpoints when jobs reach key milestones
 * Triggered by entity automation on CRMJob status changes
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data, old_data } = payload;

    if (!data || !data.companyId) {
      return Response.json({ skipped: 'no_company_id' });
    }

    const crmJob = data;
    const touchpoints = [];

    // THANK_YOU: when job first marked as sold
    if (crmJob.saleStatus === 'sold' && (!old_data || old_data.saleStatus !== 'sold')) {
      const profile = await getOrCreateCustomerProfile(base44, crmJob);
      if (profile) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        touchpoints.push({
          companyId: crmJob.companyId,
          customerProfileId: profile.id,
          type: 'THANK_YOU',
          channel: 'email',
          scheduledAt: tomorrow.toISOString(),
          status: 'scheduled',
          crmJobId: crmJob.id
        });
      }
    }

    // REVIEW_REQUEST: when job installation completes
    if (crmJob.installStatus === 'installed' && (!old_data || old_data.installStatus !== 'installed')) {
      const profile = await getOrCreateCustomerProfile(base44, crmJob);
      if (profile) {
        // Schedule review request for 7 days after completion
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        
        touchpoints.push({
          companyId: crmJob.companyId,
          customerProfileId: profile.id,
          type: 'REVIEW_REQUEST',
          channel: 'email',
          scheduledAt: futureDate.toISOString(),
          status: 'scheduled',
          crmJobId: crmJob.id
        });
      }
    }

    // Create all touchpoints
    if (touchpoints.length > 0) {
      const created = await Promise.all(
        touchpoints.map(tp => base44.asServiceRole.entities.StewardshipTouchpoint.create(tp))
      );
      return Response.json({ success: true, created: created.length, touchpoints: created.map(t => t.id) });
    }

    return Response.json({ skipped: 'no_milestone_trigger' });
  } catch (error) {
    console.error('generateStewardshipTouchpoint error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Get or create a CustomerProfile from CRMJob customer data
 */
async function getOrCreateCustomerProfile(base44, crmJob) {
  try {
    // Try to find existing profile by customerId
    const existing = await base44.asServiceRole.entities.CustomerProfile.filter({
      companyId: crmJob.companyId,
      customerId: crmJob.accountId
    });

    if (existing.length > 0) {
      return existing[0];
    }

    // If no profile exists, get account/contact info to create one
    let firstName = 'Customer';
    let lastName = '';
    let preferredName = '';
    let email = '';
    let phone = '';

    if (crmJob.primaryContactId) {
      const contacts = await base44.asServiceRole.entities.CRMContact.filter({
        id: crmJob.primaryContactId
      });
      if (contacts.length > 0) {
        const contact = contacts[0];
        firstName = contact.firstName || 'Customer';
        lastName = contact.lastName || '';
        email = contact.email || '';
        phone = contact.phone || '';
      }
    }

    // Create new profile
    const profile = await base44.asServiceRole.entities.CustomerProfile.create({
      companyId: crmJob.companyId,
      customerId: crmJob.accountId,
      firstName,
      lastName,
      preferredName,
      email,
      phone
    });

    return profile;
  } catch (error) {
    console.warn(`Could not get/create profile for job ${crmJob.id}:`, error.message);
    return null;
  }
}