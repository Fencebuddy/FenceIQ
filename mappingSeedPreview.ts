import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { companyId } = await req.json();

        // PHASE A: Build index from MaterialCatalog
        const allCatalog = await base44.asServiceRole.entities.MaterialCatalog.filter({ active: true });
        
        const catalogByUck = {};
        allCatalog.forEach(item => {
            if (item.canonical_key) {
                catalogByUck[item.canonical_key] = item;
            }
        });

        // PHASE B: Preview seeding
        const uckList = Object.keys(catalogByUck);
        
        // PHASE C: Check existing CompanySkuMap
        const existing = await base44.asServiceRole.entities.CompanySkuMap.filter({
            companyId
        });

        const existingByUck = {};
        existing.forEach(map => {
            if (!existingByUck[map.uck]) {
                existingByUck[map.uck] = [];
            }
            existingByUck[map.uck].push(map);
        });

        // PHASE D: Build preview report
        const preview = {
            totalUcks: uckList.length,
            upserts: [],
            disables: [],
            duplicates: [],
            missingCatalog: [],
            unchanged: 0
        };

        uckList.forEach(uck => {
            const cat = catalogByUck[uck];
            const maps = existingByUck[uck] || [];

            if (maps.length === 0) {
                preview.upserts.push({
                    uck,
                    action: 'INSERT',
                    materialCatalogId: cat.id,
                    catalogName: cat.crm_name
                });
            } else if (maps.length === 1) {
                if (maps[0].materialCatalogId === cat.id && maps[0].status === 'mapped') {
                    preview.unchanged++;
                } else {
                    preview.upserts.push({
                        uck,
                        action: 'UPDATE',
                        oldCatalogId: maps[0].materialCatalogId,
                        newCatalogId: cat.id,
                        oldStatus: maps[0].status,
                        newStatus: 'mapped'
                    });
                }
            } else {
                // >1 enabled map for same UCK
                const enabled = maps.filter(m => m.status === 'mapped');
                if (enabled.length > 1) {
                    preview.duplicates.push({
                        uck,
                        count: enabled.length,
                        ids: enabled.map(m => m.id)
                    });
                }
            }
        });

        // Check for stale maps (materialCatalogId not in current catalog)
        existing.forEach(map => {
            if (!allCatalog.find(c => c.id === map.materialCatalogId)) {
                preview.disables.push({
                    companySkuMapId: map.id,
                    uck: map.uck,
                    reason: 'CATALOG_ITEM_DELETED'
                });
            }
        });

        return Response.json({
            mode: 'PREVIEW',
            companyId,
            preview
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});