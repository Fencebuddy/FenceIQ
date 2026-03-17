import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { action, companyId } = body;
    if (!companyId) return Response.json({ error: 'companyId required' }, { status: 400 });

    // ── CATALOG ───────────────────────────────────────────────────────────
    if (action === 'catalog') {
      const { materialType, category } = body;

      const [catalog, skuMaps] = await Promise.all([
        base44.asServiceRole.entities.MaterialCatalog.list('-last_updated', 2000),
        base44.asServiceRole.entities.CompanySkuMap.filter({ companyId }, null, 2000)
      ]);

      const skuMapByUck = new Map(skuMaps.map(m => [m.uck, m]));

      let items = catalog.filter(item => !!item.canonical_key);
      if (materialType && materialType !== 'all') items = items.filter(i => i.material_type === materialType);
      if (category && category !== 'all') items = items.filter(i => i.category === category);

      const result = items.map(item => {
        const mapping = skuMapByUck.get(item.canonical_key);
        let status = 'MISSING_MAP';
        if (mapping?.materialCatalogId) {
          status = (item.cost > 0) ? 'PRICED' : 'UNPRICED';
        } else if (mapping) {
          status = 'UNMAPPED';
        }
        return {
          catalogId: item.id,
          canonicalKey: item.canonical_key,
          displayName: item.crm_name || '',
          materialType: item.material_type || '',
          category: item.category || '',
          unit: item.unit || 'each',
          cost: item.cost ?? 0,
          active: item.active !== false,
          status,
          skuMapId: mapping?.id ?? null,
          skuMapStatus: mapping?.status ?? null
        };
      });

      return Response.json({ items: result });
    }

    // ── COVERAGE ──────────────────────────────────────────────────────────
    if (action === 'coverage') {
      const jobs = await base44.asServiceRole.entities.Job.filter({ companyId }, null, 1000);
      const jobIds = jobs.map(j => j.id);

      let snapshots = [];
      for (let i = 0; i < jobIds.length; i += 200) {
        const batch = jobIds.slice(i, i + 200);
        const batchSnaps = await base44.asServiceRole.entities.TakeoffSnapshot.filter(
          { jobId: { $in: batch } }, '-timestamp', 500
        );
        snapshots = snapshots.concat(batchSnaps);
      }

      const emittedUcks = new Set();
      for (const snap of snapshots) {
        for (const item of (snap.line_items || [])) {
          if (item.canonical_key) emittedUcks.add(item.canonical_key);
        }
      }

      const [skuMaps, catalog] = await Promise.all([
        base44.asServiceRole.entities.CompanySkuMap.filter({ companyId }, null, 2000),
        base44.asServiceRole.entities.MaterialCatalog.list('-last_updated', 2000)
      ]);

      const catalogById = new Map(catalog.map(c => [c.id, c]));

      const results = skuMaps.map(m => {
        const catalogItem = m.materialCatalogId ? catalogById.get(m.materialCatalogId) : null;
        const hasEmitter = emittedUcks.has(m.uck);
        const hasCatalog = !!catalogItem && catalogItem.active !== false;
        const catalogPriced = hasCatalog && (catalogItem.cost ?? 0) > 0;

        let status = 'OK';
        if (!hasEmitter && !hasCatalog) status = 'BOTH';
        else if (!hasEmitter) status = 'MISSING_EMITTER';
        else if (!hasCatalog) status = 'MISSING_CATALOG';
        else if (!catalogPriced) status = 'UNPRICED';

        return {
          skuMapId: m.id,
          uck: m.uck,
          displayName: m.displayName || m.uck,
          hasEmitter,
          hasCatalog,
          catalogPriced,
          catalogName: catalogItem?.crm_name ?? null,
          catalogCost: catalogItem?.cost ?? null,
          status
        };
      });

      return Response.json({
        results,
        emitterUniverse: emittedUcks.size,
        snapshotsScanned: snapshots.length,
        jobsScanned: jobIds.length
      });
    }

    // ── ADD TO CONFIG ─────────────────────────────────────────────────────
    if (action === 'addToConfig') {
      const { selections } = body;
      if (!Array.isArray(selections) || selections.length === 0) {
        return Response.json({ error: 'selections array required' }, { status: 400 });
      }

      const [catalog, existing] = await Promise.all([
        base44.asServiceRole.entities.MaterialCatalog.list('-last_updated', 2000),
        base44.asServiceRole.entities.CompanySkuMap.filter({ companyId }, null, 2000)
      ]);

      const catalogByKey = new Map(
        catalog.filter(c => c.canonical_key).map(c => [c.canonical_key, c])
      );
      const existingUcks = new Set(existing.map(m => m.uck));

      const created = [], skipped = [], errors = [];

      for (const sel of selections) {
        const { canonicalKey, displayName } = sel;
        if (!canonicalKey) {
          errors.push({ canonicalKey: '(missing)', reason: 'No canonicalKey provided' });
          continue;
        }
        const catalogItem = catalogByKey.get(canonicalKey);
        if (!catalogItem) {
          errors.push({ canonicalKey, reason: 'Not found in MaterialCatalog by canonical_key' });
          continue;
        }
        if (existingUcks.has(canonicalKey)) {
          skipped.push({ canonicalKey, reason: 'Already exists in CompanySkuMap' });
          continue;
        }
        const newEntry = await base44.asServiceRole.entities.CompanySkuMap.create({
          companyId,
          uck: canonicalKey,
          materialCatalogId: catalogItem.id,
          materialCatalogName: catalogItem.crm_name,
          materialType: catalogItem.material_type || 'general',
          displayName: displayName || catalogItem.crm_name,
          status: 'mapped',
          lastSeenAt: new Date().toISOString()
        });
        created.push({ canonicalKey, skuMapId: newEntry.id, displayName: catalogItem.crm_name });
      }

      return Response.json({ created, skipped, errors });
    }

    // ── PATCH TEMPLATE ────────────────────────────────────────────────────
    if (action === 'patchTemplate') {
      const { uck } = body;
      if (!uck) return Response.json({ error: 'uck required' }, { status: 400 });

      const parts = uck.split('_');
      const material = parts[0] || 'unknown';
      const component = parts.slice(1, 3).join('_') || 'unknown';
      const attrParts = parts.slice(3);

      const titleCase = s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      const emitterPatchStub = [
        `// ─── Emitter Patch for UCK: ${uck} ──────────────────────────────────`,
        `// Search for material "${material}" in:`,
        `//   components/materials/canonicalTakeoffEngine.js`,
        `//   components/materials/generate${titleCase(material).replace(/\s/g, '')}Materials.js`,
        `//`,
        `// Inside the line item emission block, add:`,
        ``,
        `{`,
        `  canonical_key: '${uck}',`,
        `  lineItemName: '${titleCase(uck)}',`,
        `  quantityCalculated: computeQtyFor_${component.replace(/-/g, '_')}(runData),`,
        `  uom: 'each',  // ← verify correct UOM for this component`,
        `  source: 'canonical_takeoff_engine'`,
        `}`,
        ``,
        `// ─── Also ensure '${uck}' appears in keySchemas.js allowedKeys ───────`
      ].join('\n');

      const testStub = [
        `// ─── Test Stub for UCK: ${uck} ───────────────────────────────────────`,
        `// Add to: components/testing/canonicalKeyValidator.test.js`,
        ``,
        `describe('UCK emission: ${uck}', () => {`,
        `  it('takeoff engine emits ${uck} when ${component} is present', () => {`,
        `    const runData = {`,
        `      materialType: '${material}',`,
        `      // TODO: configure input that triggers emission of ${component}`,
        `    };`,
        `    const result = runTakeoffEngine(runData);`,
        `    const emittedKeys = result.line_items.map(li => li.canonical_key);`,
        `    expect(emittedKeys).toContain('${uck}');`,
        `  });`,
        ``,
        `  it('${uck} is registered in keySchemas', () => {`,
        `    const schema = getKeySchema('${material}');`,
        `    expect(schema.allowedKeys).toContain('${uck}');`,
        `  });`,
        `});`
      ].join('\n');

      const notes = [
        `UCK: ${uck}`,
        `Parsed → material: "${material}", component: "${component}"${attrParts.length ? `, attrs: [${attrParts.join(', ')}]` : ''}`,
        `Search canonicalTakeoffEngine.js for the "${material}" material section`,
        `Verify '${uck}' is in keySchemas.js allowedKeys`,
        `After patching: run Emitter Coverage scan to confirm it appears in TakeoffSnapshot.line_items`,
        `If UCK is correct but missing, check if run/gate data reaches the branch that emits it`
      ];

      return Response.json({ emitterPatchStub, testStub, notes });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});