import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function normalizeKey(s) {
    if (s == null) return null;
    return s.toString().trim().toLowerCase();
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { companyId, mode = 'DRY_RUN', includeMissingFk = true, includeWrongTarget = true, batchSize = 25 } = body;

        if (!companyId) {
            return Response.json({ error: 'companyId required' }, { status: 400 });
        }

        // Get preview to determine what to fix
        const previewResp = await fetch(new URL('/preview', req.url), {
            method: 'POST',
            body: JSON.stringify({ companyId })
        });

        if (!previewResp.ok) {
            // Call preview locally
            const allCatalog = await base44.asServiceRole.entities.MaterialCatalog.list();
            const activeCatalog = allCatalog.filter(c => c.active !== false);
            const catalogByNormKey = new Map();
            const catalogById = new Map();
            
            activeCatalog.forEach(cat => {
                catalogById.set(cat.id, cat);
                const nKey = normalizeKey(cat.canonical_key);
                if (nKey) {
                    if (!catalogByNormKey.has(nKey)) {
                        catalogByNormKey.set(nKey, []);
                    }
                    catalogByNormKey.get(nKey).push(cat);
                }
            });

            const mapsByCompany = await base44.asServiceRole.entities.CompanySkuMap.filter({
                companyId: companyId
            });

            const mapCountsByNormUck = new Map();
            mapsByCompany.forEach(map => {
                const uNorm = normalizeKey(map.uck);
                mapCountsByNormUck.set(uNorm, (mapCountsByNormUck.get(uNorm) || 0) + 1);
            });

            // Build repair items
            const repairItems = [];
            for (const map of mapsByCompany) {
                const uNorm = normalizeKey(map.uck);
                const duplicateMapCount = mapCountsByNormUck.get(uNorm) || 0;
                const targets = catalogByNormKey.get(uNorm) || [];
                const oldTarget = map.materialCatalogId ? catalogById.get(map.materialCatalogId) : null;

                let shouldRepair = false;
                let suggestedNewId = null;
                let repairType = null;

                if (duplicateMapCount <= 1 && targets.length === 1) {
                    const newTarget = targets[0];
                    const oldMissing = oldTarget == null;
                    const oldWrong = oldTarget != null && normalizeKey(oldTarget.canonical_key) !== uNorm;

                    if (oldMissing && includeMissingFk) {
                        shouldRepair = true;
                        suggestedNewId = newTarget.id;
                        repairType = 'MISSING_FK';
                    }
                    else if (oldWrong && includeWrongTarget) {
                        shouldRepair = true;
                        suggestedNewId = newTarget.id;
                        repairType = 'WRONG_TARGET';
                    }
                }

                if (shouldRepair) {
                    repairItems.push({
                        companySkuMapId: map.id,
                        uck: map.uck,
                        oldMaterialCatalogId: map.materialCatalogId,
                        newMaterialCatalogId: suggestedNewId,
                        repairType
                    });
                }
            }

            const attempted = repairItems.length;
            let updated = 0;
            const changedRows = [];

            if (mode === 'COMMIT') {
                // Apply updates in batches
                for (let i = 0; i < repairItems.length; i += batchSize) {
                    const batch = repairItems.slice(i, i + batchSize);
                    
                    for (const item of batch) {
                        // Idempotent: only update if new != old
                        if (item.newMaterialCatalogId !== item.oldMaterialCatalogId) {
                            await base44.asServiceRole.entities.CompanySkuMap.update(item.companySkuMapId, {
                                materialCatalogId: item.newMaterialCatalogId
                            });

                            // Log the repair
                            await base44.asServiceRole.entities.MappingRepairLog.create({
                                companyId,
                                companySkuMapId: item.companySkuMapId,
                                uck: item.uck,
                                oldMaterialCatalogId: item.oldMaterialCatalogId,
                                newMaterialCatalogId: item.newMaterialCatalogId,
                                repairType: 'UPDATED',
                                actorUserId: user.email,
                                createdAt: new Date().toISOString()
                            });

                            changedRows.push({
                                uck: item.uck,
                                oldId: item.oldMaterialCatalogId,
                                newId: item.newMaterialCatalogId
                            });
                            updated++;
                        }
                    }
                }

                // Increment cache buster version
                const existing = await base44.asServiceRole.entities.ResolverCacheBuster.filter({
                    companyId: companyId
                });

                if (existing.length > 0) {
                    await base44.asServiceRole.entities.ResolverCacheBuster.update(existing[0].id, {
                        version: (existing[0].version || 1) + 1,
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    await base44.asServiceRole.entities.ResolverCacheBuster.create({
                        companyId,
                        version: 2,
                        updatedAt: new Date().toISOString()
                    });
                }
            }

            // Re-run preview to get remaining counts
            let remainingCounts = {
                missingFkCount: 0,
                wrongTargetCount: 0,
                noMatchCount: 0,
                duplicateTargetsCount: 0,
                duplicateMapsCount: 0
            };

            if (mode === 'COMMIT' && updated > 0) {
                // Refetch maps to get updated state
                const updatedMaps = await base44.asServiceRole.entities.CompanySkuMap.filter({
                    companyId: companyId
                });

                const mapCountsByNormUckAfter = new Map();
                updatedMaps.forEach(map => {
                    const uNorm = normalizeKey(map.uck);
                    mapCountsByNormUckAfter.set(uNorm, (mapCountsByNormUckAfter.get(uNorm) || 0) + 1);
                });

                for (const map of updatedMaps) {
                    const uNorm = normalizeKey(map.uck);
                    const duplicateMapCount = mapCountsByNormUckAfter.get(uNorm) || 0;
                    const targets = catalogByNormKey.get(uNorm) || [];
                    const oldTarget = map.materialCatalogId ? catalogById.get(map.materialCatalogId) : null;

                    if (duplicateMapCount > 1) {
                        remainingCounts.duplicateMapsCount++;
                    } else if (targets.length === 0) {
                        remainingCounts.noMatchCount++;
                    } else if (targets.length > 1) {
                        remainingCounts.duplicateTargetsCount++;
                    } else {
                        const newTarget = targets[0];
                        const oldMissing = oldTarget == null;
                        const oldWrong = oldTarget != null && normalizeKey(oldTarget.canonical_key) !== uNorm;

                        if (oldMissing) {
                            remainingCounts.missingFkCount++;
                        } else if (oldWrong) {
                            remainingCounts.wrongTargetCount++;
                        }
                    }
                }
            }

            return Response.json({
                commitSummary: {
                    attempted,
                    updated,
                    skippedAlreadyCorrect: attempted - updated,
                    blocked: 0,
                    mode
                },
                remaining: remainingCounts,
                sampleRemaining: [],
                changed: changedRows.slice(0, 50)
            });
        }

        // If preview call worked, use that response
        const preview = await previewResp.json();
        return Response.json(preview);

    } catch (error) {
        console.error('Error in mappingRepairApply:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});