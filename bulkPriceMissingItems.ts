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
        const catalogByKey = new Map();
        allCatalog.forEach(cat => {
            if (cat.canonical_key) {
                catalogByKey.set(cat.canonical_key, cat);
            }
        });

        let updated = 0;
        let notFound = 0;
        const results = [];

        for (const item of updateData) {
            const key = item.uck || item.canonical_key;
            const catalogItem = catalogByKey.get(key);

            if (!catalogItem) {
                notFound++;
                results.push({
                    uck: key,
                    status: 'NOT_FOUND'
                });
                continue;
            }

            try {
                await base44.asServiceRole.entities.MaterialCatalog.update(catalogItem.id, {
                    cost: Number(item.cost)
                });
                updated++;
                results.push({
                    uck: key,
                    status: 'UPDATED',
                    catalogId: catalogItem.id,
                    newCost: item.cost
                });
            } catch (err) {
                results.push({
                    uck: key,
                    status: 'ERROR',
                    error: err.message
                });
            }
        }

        return Response.json({
            summary: { total: updateData.length, updated, notFound },
            results: results.slice(0, 100)
        });

    } catch (error) {
        console.error('Error in bulkPriceMissingItems:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});