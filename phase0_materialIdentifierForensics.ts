import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PHASE 0 + 1: MATERIAL IDENTIFIER FORENSICS
 * 
 * Reads entity schemas and extracts real job data to determine
 * which identifiers are actually used for materials (not SKU).
 * 
 * Goal: Prove whether SKU is used or if canonicalKey/materialCatalogId
 * are the true authoritative keys.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin required' }, { status: 403 });
    }

    const companies = await base44.entities.CompanySettings.filter({});
    const company = companies[0];
    if (!company) {
      return Response.json({ error: 'No company found' }, { status: 400 });
    }

    // === PHASE 0: IDENTIFY STORAGE ENTITIES ===
    const entitySchemas = await gatherEntitySchemas(base44);

    // === PHASE 1: EXTRACT REAL JOB DATA ===
    // Get 2 jobs: 1 recent sold, 1 freshly created
    const allJobs = await base44.entities.CRMJob.filter(
      { companyId: company.id, status: 'won' },
      '-created_date',
      2
    );

    const jobForensics = [];
    for (const job of allJobs.slice(0, 2)) {
      const forensic = await extractJobForensic(base44, company.id, job);
      jobForensics.push(forensic);
    }

    return Response.json({
      status: 'MATERIAL_IDENTIFIER_FORENSICS',
      timestamp: new Date().toISOString(),
      phase: '0+1',
      company: company.companyName,
      
      // Phase 0 output: entity schemas
      entitySchemas,
      
      // Phase 1 output: real data from 2 jobs
      jobsAnalyzed: jobForensics.length,
      jobsForensics: jobForensics,
      
      // Initial hypothesis test
      hypothesisTest: {
        hypothesis: 'SKU is not used; canonicalKey is the true key',
        evidence: generateHypothesisEvidence(jobForensics)
      }
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});

// ============================================================
// PHASE 0: Entity Schema Inventory
// ============================================================
async function gatherEntitySchemas(base44) {
  const schemas = {};

  // Fetch actual schemas
  try {
    schemas['TakeoffSnapshot'] = await base44.entities.TakeoffSnapshot.schema();
  } catch (e) {
    schemas['TakeoffSnapshot'] = 'NOT FOUND';
  }

  try {
    schemas['ProposalPricingSnapshot'] = await base44.entities.ProposalPricingSnapshot.schema();
  } catch (e) {
    schemas['ProposalPricingSnapshot'] = 'NOT FOUND';
  }

  try {
    schemas['JobCostSnapshot'] = await base44.entities.JobCostSnapshot.schema();
  } catch (e) {
    schemas['JobCostSnapshot'] = 'NOT FOUND';
  }

  try {
    schemas['MaterialLine'] = await base44.entities.MaterialLine.schema();
  } catch (e) {
    schemas['MaterialLine'] = 'NOT FOUND';
  }

  return {
    storageEntities: [
      'TakeoffSnapshot (takeoff/build job → canonical line items)',
      'JobCostSnapshot (cost calculation → priced materials)',
      'ProposalPricingSnapshot (final price)',
      'MaterialLine (legacy job materials)',
      'MaterialCatalog (material catalog)',
      'CompanySkuMap (SKU→UCK mappings, if used)'
    ],
    fieldInventory: extractFieldInventory(schemas)
  };
}

function extractFieldInventory(schemas) {
  const inventory = {
    'TakeoffSnapshot.line_items[]': {
      identifierFields: ['canonical_key', 'lineItemName'],
      qtyFields: ['quantityCalculated', 'uom'],
      costFields: 'NONE in line_items',
      sourceFields: ['source']
    },
    'JobCostSnapshot.materials_resolved[]': {
      identifierFields: 'TBD (need to inspect)',
      qtyFields: 'TBD',
      costFields: 'unit_cost, extended_cost',
      sourceFields: 'TBD'
    },
    'MaterialLine': {
      identifierFields: ['lineItemName'],
      qtyFields: ['calculatedQty', 'manualOverrideQty', 'unit'],
      costFields: 'NONE in schema',
      sourceFields: 'NONE in schema'
    },
    'ProposalPricingSnapshot': {
      identifierFields: 'NONE (pricing aggregate only)',
      qtyFields: 'NONE',
      costFields: ['agreed_subtotal', 'total_with_tax'],
      sourceFields: 'NONE'
    }
  };

  return inventory;
}

// ============================================================
// PHASE 1: Extract Real Job Data
// ============================================================
async function extractJobForensic(base44, companyId, job) {
  // Fetch related snapshots
  const [takeoffs, costSnapshots] = await Promise.all([
    base44.entities.TakeoffSnapshot.filter({ jobId: job.id }, '', 1),
    base44.entities.JobCostSnapshot.filter({ jobId: job.id }, '-created_date', 1)
  ]);

  const takeoff = takeoffs[0];
  const costSnapshot = costSnapshots[0];

  // Extract line items from takeoff
  const takeoffLineItems = takeoff && takeoff.line_items ? takeoff.line_items.slice(0, 20) : [];

  // Extract materials from cost snapshot
  const costLineItems = costSnapshot && costSnapshot.materials_resolved ? costSnapshot.materials_resolved.slice(0, 20) : [];

  return {
    jobId: job.id,
    jobNumber: job.jobNumber,
    status: job.status,
    created: job.created_date,
    takeoffSnapshot: {
      id: takeoff?.id,
      foundCount: takeoffLineItems.length,
      lineItems: takeoffLineItems.map(item => ({
        // All identifier fields
        canonical_key: item.canonical_key,
        lineItemName: item.lineItemName,
        
        // Qty & unit
        qty: item.quantityCalculated,
        uom: item.uom,
        
        // Cost (absent in takeoff)
        unitCost: item.unitCost || 'N/A',
        extendedCost: item.extendedCost || 'N/A',
        
        // Source
        source: item.source || 'NONE',
        
        // Any other fields
        notes: item.notes || ''
      }))
    },
    costSnapshot: {
      id: costSnapshot?.id,
      foundCount: costLineItems.length,
      directCost: costSnapshot?.direct_cost,
      lineItems: costLineItems.map(item => ({
        // Extract all fields from materials_resolved item
        ...item
      }))
    }
  };
}

function generateHypothesisEvidence(jobForensics) {
  let skuFound = 0;
  let canonicalKeyFound = 0;
  let materialCatalogIdFound = 0;
  let catalogNameFound = 0;

  for (const job of jobForensics) {
    // Check takeoff line items
    for (const item of job.takeoffSnapshot.lineItems) {
      if (item.canonical_key && item.canonical_key !== '') canonicalKeyFound++;
      if (item.lineItemName && item.lineItemName !== '') catalogNameFound++;
    }

    // Check cost line items
    for (const item of job.costSnapshot.lineItems) {
      if (item.sku && item.sku !== '') skuFound++;
      if (item.canonicalKey && item.canonicalKey !== '') canonicalKeyFound++;
      if (item.materialCatalogId && item.materialCatalogId !== '') materialCatalogIdFound++;
    }
  }

  return {
    skuPopulated: skuFound,
    canonicalKeyPopulated: canonicalKeyFound,
    materialCatalogIdPopulated: materialCatalogIdFound,
    catalogNamePopulated: catalogNameFound,
    verdict: skuFound === 0 ? 'SKU NOT USED' : 'SKU IS USED',
    trueKey: canonicalKeyFound > 0 ? 'canonicalKey' : 'materialCatalogId'
  };
}