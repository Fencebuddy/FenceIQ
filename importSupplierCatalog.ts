import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { catalogData } = await req.json();

    if (!catalogData || !catalogData.items) {
      return Response.json({ error: 'Invalid catalog data' }, { status: 400 });
    }

    const imported = [];
    const errors = [];

    for (const item of catalogData.items) {
      try {
        const record = await base44.asServiceRole.entities.MaterialCatalog.create({
          crm_name: item.sku || item.canonicalKey,
          material_id: item.canonicalKey,
          sku: item.sku,
          canonical_key: item.canonicalKey,
          manufacturer: item.manufacturer,
          system: item.system,
          component_family: item.componentFamily,
          unit: item.uom,
          cost: item.unitCost,
          attributes: item.attributes || {},
          aliases: item.aliases || [],
          allowed_fence_types: item.allowedFenceTypes || [],
          disallowed_fence_types: item.disallowedFenceTypes || [],
          allowed_usage_contexts: item.allowedUsageContexts || [],
          resolver_guards: item.resolverGuards || {},
          price_history: item.priceHistory || [],
          category: item.componentFamily || 'misc',
          material_type: item.system || 'general',
          active: true,
          source: 'supplier_import'
        });
        
        imported.push(record.id);
      } catch (error) {
        errors.push({ item: item.canonicalKey, error: error.message });
      }
    }

    return Response.json({
      success: true,
      imported: imported.length,
      errors: errors.length,
      errorDetails: errors.slice(0, 10)
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});