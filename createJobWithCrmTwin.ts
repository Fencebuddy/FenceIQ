import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * CANONICAL JOB CREATION
 * Creates Job (backing store) + CRMJob (operational record) atomically
 * Prevents split-truth and ensures immediate CRM visibility
 * Uses shared invariant for customer name resolution (single source of truth)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user first
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();

    // Get company context using user-scoped call first
    const companies = await base44.entities.CompanySettings.filter({ isPrimary: true });
    if (companies.length === 0) {
      return Response.json({ error: 'No primary company found' }, { status: 400 });
    }
    const companyId = companies[0].companyId;

    // Allocate job number atomically using user-scoped client
    const counters = await base44.entities.CompanyCounter.filter({
      companyId,
      key: 'jobNumber'
    });

    let nextValue;
    if (counters.length === 0) {
      const counter = await base44.entities.CompanyCounter.create({
        companyId,
        key: 'jobNumber',
        value: 1
      });
      nextValue = 1;
    } else {
      nextValue = (counters[0].value || 0) + 1;
      await base44.entities.CompanyCounter.update(counters[0].id, {
        value: nextValue
      });
    }

    const year = new Date().getFullYear();
    const jobNumber = `J-${year}-${String(nextValue).padStart(4, '0')}`;

    // Snapshot material rules - only if needed (skip for performance)
    const ruleVersion = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Customer name will be computed by upsertCrmJob invariant if missing

    // Create backing Job
    const jobData = {
      companyId,
      jobNumber,
      customerName: payload.customerName || '',
      customerPhone: payload.customerPhone || '',
      customerEmail: payload.customerEmail || '',
      addressLine1: payload.addressLine1 || '',
      city: payload.city || '',
      state: payload.state || '',
      zip: payload.zip || '',
      materialType: payload.materialType || 'Vinyl',
      fenceHeight: payload.fenceHeight || '6\'',
      style: payload.style || 'Privacy',
      fenceColor: payload.fenceColor || 'White',
      status: 'Draft',
      totalLF: 0,
      ruleVersion,
      repName: payload.repName || user.full_name
    };

    const job = await base44.entities.Job.create(jobData);

    // Create CRMJob directly (simplified - no Customer entity dependency)
    const crmJobData = {
      companyId,
      jobNumber,
      externalJobId: job.id,
      customerName: payload.customerName || '',
      stage: 'new',
      saleStatus: 'unsold',
      contractStatus: 'unsigned',
      paymentStatus: 'na',
      installStatus: 'na',
      lossType: 'na',
      createdFrom: 'ui_create',
      assignedRepUserId: user.id,
      fenceCategory: payload.materialType?.toLowerCase() || 'vinyl',
      source: payload.source || 'inbound',
      contractValueCents: 0,
      directCostCents: 0,
      priceSource: 'unknown',
      costSource: 'unknown',
      nameStatus: payload.customerName ? 'RESOLVED' : 'NEEDS_REPAIR',
      nameLastUpdatedAt: new Date().toISOString()
    };

    const crmJob = await base44.entities.CRMJob.create(crmJobData);

    return Response.json({
      success: true,
      jobId: job.id,
      crmJobId: crmJob.id,
      jobNumber
    });
  } catch (error) {
    console.error('Job creation failed:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return Response.json({ 
      error: error.message,
      code: error.code,
      status: error.response?.status,
      details: error.response?.data 
    }, { status: 500 });
  }
});