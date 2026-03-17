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

        // PHASE A: Load catalog
        const allCatalog = await base44.asServiceRole.entities.MaterialCatalog.filter({ active: true });
        
        const catalogByUck = {};
        const catalogById = {};
        allCatalog.forEach(item => {
            if (item.canonical_key) {
                catalogByUck[item.canonical_key] = item;
            }
            catalogById[item.id] = item;
        });

        // PHASE B: Seed CompanySkuMap
        const uckList = Object.keys(catalogByUck);
        let upserted = 0;
        let unchanged = 0;
        
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

        for (const uck of uckList) {
            const cat = catalogByUck[uck];
            const maps = existingByUck[uck] || [];

            if (maps.length === 0) {
                // INSERT new map
                await base44.asServiceRole.entities.CompanySkuMap.create({
                    companyId,
                    uck,
                    materialCatalogId: cat.id,
                    displayName: cat.crm_name,
                    status: 'mapped'
                });
                upserted++;
            } else if (maps.length === 1) {
                if (maps[0].materialCatalogId !== cat.id) {
                    // UPDATE existing map
                    await base44.asServiceRole.entities.CompanySkuMap.update(maps[0].id, {
                        materialCatalogId: cat.id,
                        status: 'mapped'
                    });
                    upserted++;
                } else {
                    unchanged++;
                }
            } else {
                // >1 map for same UCK - handle duplicates
                const enabled = maps.filter(m => m.status === 'mapped');
                if (enabled.length > 1) {
                    // Keep newest, disable rest
                    const newest = enabled.sort((a, b) => 
                        new Date(b.updated_date) - new Date(a.updated_date)
                    )[0];

                    for (const map of enabled) {
                        if (map.id !== newest.id) {
                            await base44.asServiceRole.entities.CompanySkuMap.update(map.id, {
                                status: 'deprecated'
                            });
                        }
                    }
                }
            }
        }

        // PHASE C: Disable stale maps (catalog item deleted)
        for (const map of existing) {
            if (!catalogById[map.materialCatalogId] && map.status === 'mapped') {
                await base44.asServiceRole.entities.CompanySkuMap.update(map.id, {
                    status: 'deprecated'
                });
            }
        }

        // PHASE D: Increment cache buster version
        const busters = await base44.asServiceRole.entities.ResolverCacheBuster.filter({
            companyId
        });

        let newVersion = 1;
        if (busters.length > 0) {
            newVersion = (busters[0].version || 1) + 1;
            await base44.asServiceRole.entities.ResolverCacheBuster.update(busters[0].id, {
                version: newVersion,
                updatedAt: new Date().toISOString()
            });
        } else {
            await base44.asServiceRole.entities.ResolverCacheBuster.create({
                companyId,
                version: 2,
                updatedAt: new Date().toISOString()
            });
            newVersion = 2;
        }

        // PHASE E: Log migration
        await base44.asServiceRole.entities.MappingRepairLog.create({
            companyId,
            uck: 'MIGRATION',
            oldMaterialCatalogId: null,
            newMaterialCatalogId: null,
            repairType: 'UPDATED',
            notes: `Migration complete: ${upserted} upserted, ${unchanged} unchanged, resolver version bumped to ${newVersion}`,
            actorUserId: user.email,
            createdAt: new Date().toISOString()
        });

        // Invalidate snapshots - they must recompute
        await base44.asServiceRole.entities.Job.filter({}).then(jobs => {
            return Promise.all(jobs.map(job => 
                base44.asServiceRole.entities.Job.update(job.id, {
                    active_takeoff_snapshot_id: null,
                    active_pricing_snapshot_id: null,
                    pricing_status: 'NEEDS_RECALC'
                })
            ));
        });

        return Response.json({
            mode: 'APPLY',
            companyId,
            result: {
                upserted,
                unchanged,
                newResolverVersion: newVersion,
                snapshotsInvalidated: true
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});