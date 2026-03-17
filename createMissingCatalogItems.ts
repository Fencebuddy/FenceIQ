import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { companyId } = await req.json();
        if (!companyId) {
            return Response.json({ error: 'companyId required' }, { status: 400 });
        }

        // Get all CompanySkuMap entries that point to missing catalog
        const allMappings = await base44.asServiceRole.entities.CompanySkuMap.filter({
            companyId: companyId
        });

        // Get all catalog items to check what exists
        const catalogItems = await base44.asServiceRole.entities.MaterialCatalog.list();
        const catalogByUck = new Map();
        catalogItems.forEach(item => {
            if (item.canonical_key) catalogByUck.set(item.canonical_key.toLowerCase(), item);
        });

        // Find mappings pointing to missing catalog IDs
        const missingMappings = [];
        for (const mapping of allMappings) {
            if (!mapping.materialCatalogId || mapping.status === 'unmapped') {
                missingMappings.push(mapping);
            } else {
                // Check if the catalog item actually exists
                try {
                    const item = await base44.asServiceRole.entities.MaterialCatalog.get(mapping.materialCatalogId);
                    if (!item) {
                        missingMappings.push(mapping);
                    }
                } catch {
                    missingMappings.push(mapping);
                }
            }
        }

        // Create catalog items from missing mappings
        const toCreate = [];
        const created = [];
        const skipped = [];

        for (const mapping of missingMappings) {
            const uckLower = (mapping.uck || '').toLowerCase();
            
            // Skip if already exists
            if (catalogByUck.has(uckLower)) {
                skipped.push({ uck: mapping.uck, reason: 'already_exists' });
                continue;
            }

            // Parse UCK to generate catalog item
            const item = {
                crm_name: mapping.displayName || mapping.uck || 'Unknown Item',
                canonical_key: uckLower,
                aliases: [],
                keywords: [],
                category: parseCategory(mapping.uck),
                material_type: parseMaterialType(mapping.uck),
                unit: mapping.attributes?.unit || 'each',
                cost: 0, // Will need manual pricing
                source: 'manual',
                active: true,
                last_updated: new Date().toISOString()
            };

            toCreate.push(item);
        }

        // Bulk create if items to create
        let createdCount = 0;
        if (toCreate.length > 0) {
            const result = await base44.asServiceRole.entities.MaterialCatalog.bulkCreate(toCreate);
            createdCount = result.length || toCreate.length;
            created.push(...result);
        }

        return Response.json({
            success: true,
            companyId,
            totalMissing: missingMappings.length,
            createdCount,
            skippedCount: skipped.length,
            created: created.slice(0, 10), // First 10 for display
            skipped: skipped.slice(0, 10)
        });

    } catch (error) {
        console.error('Error creating missing catalog items:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function parseCategory(uck) {
    if (!uck) return 'misc';
    const lower = uck.toLowerCase();
    if (lower.includes('post')) return 'post';
    if (lower.includes('panel')) return 'panel';
    if (lower.includes('rail')) return 'rail';
    if (lower.includes('fabric')) return 'fabric';
    if (lower.includes('hardware')) return 'hardware';
    if (lower.includes('gate')) return 'gate';
    if (lower.includes('concrete')) return 'concrete';
    if (lower.includes('nail') || lower.includes('screw')) return 'hardware';
    if (lower.includes('picket')) return 'panel';
    return 'misc';
}

function parseMaterialType(uck) {
    if (!uck) return 'general';
    const lower = uck.toLowerCase();
    if (lower.includes('vinyl')) return 'vinyl';
    if (lower.includes('wood')) return 'wood';
    if (lower.includes('chainlink')) return 'chain_link';
    if (lower.includes('aluminum')) return 'aluminum';
    if (lower.includes('concrete')) return 'general';
    return 'general';
}