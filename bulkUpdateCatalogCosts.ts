import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { updateData } = await req.json();
        if (!Array.isArray(updateData) || updateData.length === 0) {
            return Response.json({ error: 'updateData array required' }, { status: 400 });
        }

        // Fetch all catalog items
        const allCatalog = await base44.asServiceRole.entities.MaterialCatalog.list();

        // Build lookup by canonical_key
        const catalogByKey = new Map();
        allCatalog.forEach(cat => {
            if (cat.canonical_key) {
                catalogByKey.set(cat.canonical_key, cat);
            }
        });

        let updated = 0;
        let notFound = 0;
        const results = [];

        // Process each update
        for (const item of updateData) {
            const { uck, cost } = item;
            const catalogItem = catalogByKey.get(uck);

            if (!catalogItem) {
                notFound++;
                results.push({
                    uck,
                    status: 'NOT_FOUND',
                    message: `No catalog item with canonical_key="${uck}"`
                });
                continue;
            }

            // Update cost
            await base44.asServiceRole.entities.MaterialCatalog.update(catalogItem.id, {
                cost: Number(cost)
            });

            updated++;
            results.push({
                uck,
                status: 'UPDATED',
                catalogId: catalogItem.id,
                oldCost: catalogItem.cost,
                newCost: Number(cost)
            });
        }

        return Response.json({
            summary: {
                total: updateData.length,
                updated,
                notFound
            },
            results: results.slice(0, 50) // Return first 50 for preview
        });

    } catch (error) {
        console.error('Error in bulkUpdateCatalogCosts:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});