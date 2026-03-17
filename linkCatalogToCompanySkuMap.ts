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

        // Fetch all catalog items with canonical_key
        const allCatalog = await base44.asServiceRole.entities.MaterialCatalog.list();
        const catalogByKey = new Map();
        allCatalog.forEach(cat => {
            if (cat.canonical_key) {
                catalogByKey.set(cat.canonical_key, cat);
            }
        });

        // Fetch existing CompanySkuMap for this company
        const existingMappings = await base44.asServiceRole.entities.CompanySkuMap.filter({
            companyId: companyId
        });

        // Build set of existing UCKs to avoid duplicates
        const existingUcks = new Set(existingMappings.map(m => m.uck));

        let created = 0;
        let skipped = 0;
        const results = [];

        // For each catalog item, create a CompanySkuMap entry if it doesn't exist
        for (const [canonicalKey, catalogItem] of catalogByKey.entries()) {
            if (existingUcks.has(canonicalKey)) {
                skipped++;
                results.push({
                    uck: canonicalKey,
                    status: 'SKIPPED',
                    reason: 'Already mapped'
                });
                continue;
            }

            try {
                const newMapping = await base44.asServiceRole.entities.CompanySkuMap.create({
                    companyId,
                    uck: canonicalKey,
                    materialCatalogId: catalogItem.id,
                    materialCatalogName: catalogItem.crm_name,
                    materialType: catalogItem.material_type,
                    status: 'mapped',
                    displayName: catalogItem.crm_name
                });

                created++;
                results.push({
                    uck: canonicalKey,
                    status: 'CREATED',
                    mappingId: newMapping.id,
                    catalogId: catalogItem.id
                });
            } catch (err) {
                results.push({
                    uck: canonicalKey,
                    status: 'ERROR',
                    error: err.message
                });
            }
        }

        return Response.json({
            summary: {
                total: catalogByKey.size,
                created,
                skipped,
                errors: catalogByKey.size - created - skipped
            },
            results: results.slice(0, 50)
        });

    } catch (error) {
        console.error('Error in linkCatalogToCompanySkuMap:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});