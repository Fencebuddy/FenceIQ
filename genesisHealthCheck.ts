import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // ADMIN-ONLY
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { companyId } = await req.json();

        if (!companyId) {
            return Response.json({ error: 'companyId is required' }, { status: 400 });
        }

        console.log(`[HealthCheck] Starting for company: ${companyId}`);

        // Fetch company settings
        const companySettings = await base44.asServiceRole.entities.CompanySettings.filter({ 
            companyId 
        });
        const company = companySettings[0];

        if (!company) {
            return Response.json({ error: `Company ${companyId} not found` }, { status: 404 });
        }

        // Count approved catalog items
        const allCatalog = await base44.asServiceRole.entities.MaterialCatalog.filter({ active: true });
        const approvedCatalog = allCatalog.filter(item => {
            if (!item.active_company_ids || item.active_company_ids.length === 0) return true;
            return item.active_company_ids.includes(companyId);
        });

        // Count CompanySkuMap
        const allMappings = await base44.asServiceRole.entities.CompanySkuMap.filter({ companyId });
        const lockedMappings = allMappings.filter(m => m.locked === true);
        const unlockedMappings = allMappings.filter(m => m.locked !== true);

        // Count unresolved items
        let unresolvedCount = 0;
        try {
            const unresolved = await base44.asServiceRole.entities.UnmappedItem.filter({ companyId });
            unresolvedCount = unresolved.length;
        } catch (err) {
            console.warn('[HealthCheck] UnmappedItem table missing');
        }

        // Check for orphaned UCKs (in jobs but not in catalog)
        const jobs = await base44.asServiceRole.entities.Job.filter({ companyId });
        const orphanedUcks = new Set();

        for (const job of jobs) {
            try {
                const takeoff = await base44.asServiceRole.entities.TakeoffSnapshot.filter({
                    jobId: job.id
                });
                
                if (takeoff.length > 0 && takeoff[0].line_items) {
                    for (const item of takeoff[0].line_items) {
                        const uck = item.canonical_key || item.uck;
                        
                        // Check if this UCK is mapped
                        const mapping = allMappings.find(m => m.uck === uck);
                        if (!mapping) {
                            orphanedUcks.add(uck);
                        }
                    }
                }
            } catch (err) {
                console.warn(`[HealthCheck] Error checking job ${job.id}:`, err.message);
            }
        }

        const report = {
            companyId,
            companyName: company.companyName,
            timestamp: new Date().toISOString(),
            counts: {
                approvedCatalogItems: approvedCatalog.length,
                totalCompanySkuMappings: allMappings.length,
                lockedMappings: lockedMappings.length,
                unlockedMappings: unlockedMappings.length,
                unmappedItemsCount: unresolvedCount,
                totalJobs: jobs.length,
                orphanedUckCount: orphanedUcks.size
            },
            settings: {
                useUniversalResolver: company.useUniversalResolver || false,
                useMaterialCatalogOnly: company.useMaterialCatalogOnly || false,
                allowResolverFallbacks: company.allowResolverFallbacks || false,
                genesisResolverMode: company.genesisResolverMode || false
            },
            orphanedUcks: Array.from(orphanedUcks).slice(0, 20) // Top 20
        };

        // Health status
        const issues = [];
        if (orphanedUcks.size > 0) {
            issues.push(`Found ${orphanedUcks.size} UCKs in jobs but not in approved catalog`);
        }
        if (unresolvedCount > 0) {
            issues.push(`${unresolvedCount} unresolved materials exist`);
        }
        if (!company.genesisResolverMode) {
            issues.push('genesisResolverMode not enabled');
        }
        if (!company.useMaterialCatalogOnly) {
            issues.push('useMaterialCatalogOnly not enabled');
        }

        report.healthStatus = issues.length === 0 ? 'HEALTHY' : 'ISSUES_DETECTED';
        report.issues = issues;

        console.log(`[HealthCheck] COMPLETE for ${companyId}`, report);

        return Response.json(report);

    } catch (error) {
        console.error('[HealthCheck] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});