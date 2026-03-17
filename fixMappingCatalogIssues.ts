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

        // Get all catalog items with zero cost
        const allCatalog = await base44.asServiceRole.entities.MaterialCatalog.list();
        const zeroCostItems = allCatalog.filter(item => !item.cost || item.cost === 0);

        // Get all items with non-zero cost to use as reference
        const pricedItems = allCatalog.filter(item => item.cost && item.cost > 0);
        
        // Build a price map by category
        const priceByCategory = {};
        pricedItems.forEach(item => {
            if (!priceByCategory[item.category]) {
                priceByCategory[item.category] = [];
            }
            priceByCategory[item.category].push(item.cost);
        });

        // Calculate average price per category
        const avgPriceByCategory = {};
        Object.entries(priceByCategory).forEach(([category, prices]) => {
            avgPriceByCategory[category] = prices.reduce((a, b) => a + b, 0) / prices.length;
        });

        // Update zero-cost items with estimated pricing
        const updates = [];
        const fixedItems = [];

        for (const item of zeroCostItems) {
            const estimatedCost = avgPriceByCategory[item.category] || 10; // Default $10 if no category match
            
            updates.push(
                base44.asServiceRole.entities.MaterialCatalog.update(item.id, {
                    cost: Math.round(estimatedCost * 100) / 100, // Round to 2 decimals
                    notes: (item.notes || '') + ' [AUTO-PRICED]'
                })
            );
            
            fixedItems.push({
                id: item.id,
                crm_name: item.crm_name,
                oldCost: 0,
                newCost: Math.round(estimatedCost * 100) / 100
            });
        }

        // Execute all updates in parallel
        if (updates.length > 0) {
            await Promise.all(updates);
        }

        return Response.json({
            success: true,
            companyId,
            zeroCostItemsFixed: fixedItems.length,
            fixedItems: fixedItems.slice(0, 20),
            avgPriceByCategory
        });

    } catch (error) {
        console.error('Error fixing catalog issues:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});