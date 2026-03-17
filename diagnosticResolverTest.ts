import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { jobId } = await req.json();

    if (!jobId) {
      return Response.json({ error: 'jobId required' }, { status: 400 });
    }

    // Fetch job
    const jobs = await base44.asServiceRole.entities.Job.filter({ id: jobId });
    const job = jobs[0];

    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    const companyId = job.companyId;
    if (!companyId) {
      return Response.json({ error: 'Job missing companyId' }, { status: 400 });
    }

    // Fetch active takeoff snapshot
    const snapshots = await base44.asServiceRole.entities.TakeoffSnapshot.filter({ 
      id: job.active_takeoff_snapshot_id 
    });
    const snapshot = snapshots[0];

    if (!snapshot) {
      return Response.json({ error: 'No active takeoff snapshot' }, { status: 404 });
    }

    const lineItems = snapshot.line_items || [];

    // Fetch CompanySkuMap
    const companySkuMap = await base44.asServiceRole.entities.CompanySkuMap.filter({ 
      companyId, 
      status: 'mapped' 
    });

    // Fetch MaterialCatalog
    const catalog = await base44.asServiceRole.entities.MaterialCatalog.filter({ 
      active: true 
    });

    const catalogById = {};
    catalog.forEach(c => {
      catalogById[c.id] = c;
    });

    // Build mapping lookup
    const mappingByUck = {};
    companySkuMap.forEach(m => {
      mappingByUck[m.uck] = m;
    });

    // Resolve each line item
    const results = [];
    let resolvedCount = 0;
    let unresolvedCount = 0;

    for (const item of lineItems) {
      const uck = item.uck || item.canonical_key;
      
      if (!uck) {
        unresolvedCount++;
        results.push({
          lineItemName: item.lineItemName,
          uck: null,
          status: 'NO_UCK',
          qty: item.quantityCalculated,
          uom: item.uom
        });
        continue;
      }

      const mapping = mappingByUck[uck];

      if (!mapping) {
        unresolvedCount++;
        results.push({
          lineItemName: item.lineItemName,
          uck,
          status: 'NO_MAPPING',
          qty: item.quantityCalculated,
          uom: item.uom,
          note: 'Configure in Fence System Config'
        });
        continue;
      }

      const catalogItem = catalogById[mapping.materialCatalogId];

      if (!catalogItem) {
        unresolvedCount++;
        results.push({
          lineItemName: item.lineItemName,
          uck,
          status: 'BROKEN_MAPPING',
          qty: item.quantityCalculated,
          uom: item.uom,
          mappingId: mapping.id,
          note: 'Catalog item deleted'
        });
        continue;
      }

      // Check unit match
      if (item.uom !== catalogItem.unit) {
        unresolvedCount++;
        results.push({
          lineItemName: item.lineItemName,
          uck,
          status: 'UNIT_MISMATCH',
          qty: item.quantityCalculated,
          uom: item.uom,
          catalogUnit: catalogItem.unit,
          catalogName: catalogItem.crm_name,
          note: 'Unit conversion needed'
        });
        continue;
      }

      // RESOLVED
      resolvedCount++;
      results.push({
        lineItemName: item.lineItemName,
        uck,
        status: 'RESOLVED',
        qty: item.quantityCalculated,
        uom: item.uom,
        catalogName: catalogItem.crm_name,
        unitCost: catalogItem.cost,
        extendedCost: item.quantityCalculated * catalogItem.cost
      });
    }

    return Response.json({
      jobNumber: job.jobNumber,
      companyId,
      total: lineItems.length,
      resolved: resolvedCount,
      unresolved: unresolvedCount,
      resolutionRate: ((resolvedCount / lineItems.length) * 100).toFixed(1),
      results
    });

  } catch (error) {
    console.error('[diagnosticResolverTest] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});