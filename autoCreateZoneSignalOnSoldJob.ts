import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Auto-create ZoneSignal when a CRMJob is marked as sold
 * Triggered by entity automation on CRMJob update events
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data, old_data } = payload;

    // Only process if job status changed TO "sold"
    if (!data || data.saleStatus !== 'sold') {
      return Response.json({ skipped: 'not_sold', reason: 'Job not marked as sold' });
    }

    // Skip if it was already sold (no state change)
    if (old_data && old_data.saleStatus === 'sold') {
      return Response.json({ skipped: 'already_sold', reason: 'Already marked as sold' });
    }

    const crmJobId = data.id;
    const zoneId = data.zoneId;

    // Can't create signal without zone assignment
    if (!zoneId) {
      console.warn(`CRMJob ${crmJobId} marked sold but no zoneId assigned — skipping signal`);
      return Response.json({ skipped: 'no_zone_id', crmJobId });
    }

    // Get company from CRMJob
    const companyId = data.companyId;
    if (!companyId) {
      console.warn(`CRMJob ${crmJobId} has no companyId`);
      return Response.json({ skipped: 'no_company_id', crmJobId });
    }

    // Create ZoneSignal record
    const signal = await base44.asServiceRole.entities.ZoneSignal.create({
      companyId,
      zoneId,
      signalType: 'SOLD_JOB',
      value: 1,
      occurredAt: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      externalJobId: crmJobId
    });

    return Response.json({
      success: true,
      signalId: signal.id,
      crmJobId,
      zoneId,
      signalType: 'SOLD_JOB'
    });
  } catch (error) {
    console.error('autoCreateZoneSignalOnSoldJob error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});