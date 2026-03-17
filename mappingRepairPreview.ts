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

        const { companyId } = await req.json();
        if (!companyId) {
            return Response.json({ error: 'companyId required' }, { status: 400 });
        }

        // Load all MaterialCatalog items (active only)
        const allCatalog = await base44.asServiceRole.entities.MaterialCatalog.list();
        const activeCatalog = allCatalog.filter(c => c.active !== false);

        // Build catalogByNormKey: Map<normKey, array<row>>
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

        // Load CompanySkuMap for this company
        const mapsByCompany = await base44.asServiceRole.entities.CompanySkuMap.filter({
            companyId: companyId
        });

        // Build mapCountsByNormUck: Map<normKey, count>
        const mapCountsByNormUck = new Map();
        mapsByCompany.forEach(map => {
            const uNorm = normalizeKey(map.uck);
            mapCountsByNormUck.set(uNorm, (mapCountsByNormUck.get(uNorm) || 0) + 1);
        });

        // Classify each map
        const items = [];
        const totals = {
            totalMaps: mapsByCompany.length,
            missingFkCount: 0,
            wrongTargetCount: 0,
            fixableCount: 0,
            noMatchCount: 0,
            duplicateTargetsCount: 0,
            duplicateMapsCount: 0
        };

        for (const map of mapsByCompany) {
            const uNorm = normalizeKey(map.uck);
            const duplicateMapCount = mapCountsByNormUck.get(uNorm) || 0;
            const targets = catalogByNormKey.get(uNorm) || [];
            const oldTarget = map.materialCatalogId ? catalogById.get(map.materialCatalogId) : null;

            let failureType = null;
            let status = null;
            let suggestedNewMaterialCatalogId = null;
            let suggestedNewCanonicalKey = null;
            let suggestedNewCatalogName = null;

            // Check for duplicate map first (highest priority blocker)
            if (duplicateMapCount > 1) {
                failureType = 'DUPLICATE_MAP';
                status = 'BLOCKED';
                totals.duplicateMapsCount++;
            }
            // Then check target count
            else if (targets.length === 0) {
                failureType = 'NO_MATCH';
                status = 'BLOCKED';
                totals.noMatchCount++;
            }
            else if (targets.length > 1) {
                failureType = 'DUPLICATE_TARGET';
                status = 'BLOCKED';
                totals.duplicateTargetsCount++;
            }
            // Single valid target: check if FK is missing or wrong
            else {
                const newTarget = targets[0];
                const oldMissing = oldTarget == null;
                const oldWrong = oldTarget != null && 
                    normalizeKey(oldTarget.canonical_key) !== uNorm;

                if (oldMissing) {
                    failureType = 'MISSING_FK';
                    status = 'FIXABLE';
                    suggestedNewMaterialCatalogId = newTarget.id;
                    suggestedNewCanonicalKey = newTarget.canonical_key;
                    suggestedNewCatalogName = newTarget.crm_name;
                    totals.missingFkCount++;
                    totals.fixableCount++;
                }
                else if (oldWrong) {
                    failureType = 'WRONG_TARGET';
                    status = 'FIXABLE';
                    suggestedNewMaterialCatalogId = newTarget.id;
                    suggestedNewCanonicalKey = newTarget.canonical_key;
                    suggestedNewCatalogName = newTarget.crm_name;
                    totals.wrongTargetCount++;
                    totals.fixableCount++;
                }
                // else: OK, skip
            }

            // Only include non-OK rows
            if (failureType) {
                items.push({
                    companySkuMapId: map.id,
                    uck: map.uck,
                    oldMaterialCatalogId: map.materialCatalogId,
                    oldTargetCanonicalKey: oldTarget ? oldTarget.canonical_key : null,
                    failureType,
                    status,
                    suggestedNewMaterialCatalogId,
                    suggestedNewCanonicalKey,
                    suggestedNewCatalogName
                });
            }
        }

        return Response.json({
            totals,
            items: items.slice(0, 100) // Return first 100 for preview
        });

    } catch (error) {
        console.error('Error in mappingRepairPreview:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});