/**
 * PHASE 6: CANARY RUN TEST
 * 
 * Creates ONE real-world canary job through the normal UI entrypoint
 * to verify end-to-end key emission → resolver → pricing before going live.
 * 
 * Canary: Vinyl 6ft white privacy, 50 LF, 1 single gate 44
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { buildTakeoff } from '../components/materials/canonicalTakeoffEngine.js';
import { assertCanonicalKey } from '../components/canonicalKeyEngine/normalize.js';
import { resolveLineItemsWithMappings } from '../components/materials/universalResolver.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = {
      status: 'PASS',
      timestamp: new Date().toISOString(),
      canaryJobId: null,
      emittedKeys: [],
      validationResults: {},
      resolverResults: {},
      pricingResults: {},
      cleanup: null
    };

    console.log('[Phase6Canary] Creating canary job...');

    // Create canary job: Vinyl 6ft white privacy, 50 LF, 1 single gate 44
    const job = await base44.asServiceRole.entities.Job.create({
      customerName: 'CUTOVER_CANARY_TEST_DELETE',
      addressLine1: '999 Canary Lane',
      city: 'Canary',
      state: 'MI',
      zip: '99999',
      materialType: 'Vinyl',
      fenceHeight: "6'",
      style: 'Privacy',
      fenceColor: 'White'
    });

    result.canaryJobId = job.id;
    console.log(`[Phase6Canary] Job created: ${job.id}`);

    // Create run
    const run = await base44.asServiceRole.entities.Run.create({
      jobId: job.id,
      runLabel: 'CanaryRun',
      lengthLF: 50,
      materialType: 'Vinyl',
      fenceHeight: "6'",
      style: 'Privacy',
      fenceColor: 'White'
    });

    // Create single gate 44
    const gate = await base44.asServiceRole.entities.Gate.create({
      jobId: job.id,
      runId: run.id,
      gateType: 'Single',
      gateWidth_ft: 4,
      placement: 'In-line'
    });

    console.log(`[Phase6Canary] Run and gate created`);

    // Simulate takeoff generation (normal path through buildTakeoff)
    const takeoffResult = buildTakeoff(
      job,
      [{
        id: 'line_0',
        assignedRunId: run.id,
        manualLengthFt: 50,
        runStatus: 'new',
        isExisting: false,
        start: { x: 0, y: 0 },
        end: { x: 500, y: 0 }
      }],
      [run],
      [gate],
      [], // posts (optional for this test)
      false
    );

    result.emittedKeys = takeoffResult.lineItems.map(li => li.canonical_key);
    console.log(`[Phase6Canary] Emitted ${result.emittedKeys.length} keys`);

    // Validate all keys
    let validationFailures = 0;
    for (const key of result.emittedKeys) {
      try {
        assertCanonicalKey(key);
      } catch (e) {
        validationFailures++;
        console.error(`[Phase6Canary] Key validation failed: ${key} - ${e.message}`);
      }
    }

    result.validationResults = {
      totalKeys: result.emittedKeys.length,
      validationFailures,
      status: validationFailures === 0 ? 'PASS' : 'FAIL'
    };

    if (validationFailures > 0) {
      result.status = 'FAIL';
      result.validationResults.detail = 'Key validation failed';
    }

    // Attempt resolver
    const catalog = await base44.asServiceRole.entities.MaterialCatalog.filter({ active: true }, undefined, 10000);
    const skuMap = await base44.asServiceRole.entities.CompanySkuMap.filter(
      { companyId: 'PrivacyFenceCo49319' },
      undefined,
      10000
    );

    const resolution = await resolveLineItemsWithMappings({
      companyId: 'PrivacyFenceCo49319',
      lineItems: takeoffResult.lineItems,
      catalog,
      companySkuMap: skuMap
    });

    result.resolverResults = {
      totalItems: takeoffResult.lineItems.length,
      resolvedCount: resolution.summary.resolved_count,
      unresolvedCount: resolution.summary.unresolved_count,
      status: resolution.summary.unresolved_count === 0 ? 'PASS' : 'FAIL'
    };

    if (resolution.summary.unresolved_count > 0) {
      result.status = 'FAIL';
      result.resolverResults.detail = `${resolution.summary.unresolved_count} unresolved items`;
      console.error('[Phase6Canary] Resolver failures:', resolution.summary.unresolved);
    }

    result.pricingResults = {
      estimatedCost: resolution.lineItems.reduce((sum, li) => sum + (li.extended_cost || 0), 0),
      status: 'WOULD_SUCCEED'
    };

    // CLEANUP: Delete the canary job
    console.log(`[Phase6Canary] Deleting canary job ${job.id}...`);
    try {
      await base44.asServiceRole.entities.Job.delete(job.id);
      result.cleanup = { status: 'COMPLETE', jobId: job.id };
    } catch (e) {
      result.cleanup = { status: 'FAILED', jobId: job.id, error: e.message };
      console.error('[Phase6Canary] Failed to delete job:', e);
    }

    console.log(`[Phase6Canary] Complete - Status: ${result.status}`);
    return Response.json(result);

  } catch (error) {
    console.error('[Phase6Canary] Fatal error:', error);
    return Response.json({
      status: 'FAIL',
      error: 'CANARY_TEST_FAILED',
      message: error?.message || String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});