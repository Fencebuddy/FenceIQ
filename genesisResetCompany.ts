import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // ADMIN-ONLY
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { companyId, confirmed = false } = await req.json();

        if (!companyId) {
            return Response.json({ error: 'companyId is required' }, { status: 400 });
        }

        // SAFETY: Require explicit confirmation
        if (!confirmed) {
            return Response.json({
                error: 'Genesis reset requires confirmation',
                message: `This will delete ALL unresolved materials, snapshots, and unlocked mappings for company ${companyId}. Pass confirmed=true to proceed.`,
                requiresConfirmation: true
            }, { status: 400 });
        }

        console.log(`[GenesisReset] Starting for company: ${companyId}`);

        // 1) Delete unresolved state (if UnmappedItem entity exists)
        try {
            const unmappedItems = await base44.asServiceRole.entities.UnmappedItem.filter({ companyId });
            if (unmappedItems.length > 0) {
                console.log(`[GenesisReset] Deleting ${unmappedItems.length} unmapped items`);
                for (const item of unmappedItems) {
                    await base44.asServiceRole.entities.UnmappedItem.delete(item.id);
                }
            }
        } catch (err) {
            console.warn('[GenesisReset] UnmappedItem table missing or error:', err.message);
        }

        // 2) Delete ALL derived snapshots (company-scoped)
        const deleteCounts = {};

        // Delete TakeoffSnapshot
        try {
            const takeoffSnaps = await base44.asServiceRole.entities.TakeoffSnapshot.filter({ companyId });
            deleteCounts.takeoffSnapshot = takeoffSnaps.length;
            for (const snap of takeoffSnaps) {
                await base44.asServiceRole.entities.TakeoffSnapshot.delete(snap.id);
            }
            console.log(`[GenesisReset] Deleted ${takeoffSnaps.length} TakeoffSnapshot records`);
        } catch (err) {
            console.warn('[GenesisReset] TakeoffSnapshot error:', err.message);
        }

        // Delete JobCostSnapshot
        try {
            const costSnaps = await base44.asServiceRole.entities.JobCostSnapshot.filter({ companyId });
            deleteCounts.jobCostSnapshot = costSnaps.length;
            for (const snap of costSnaps) {
                await base44.asServiceRole.entities.JobCostSnapshot.delete(snap.id);
            }
            console.log(`[GenesisReset] Deleted ${costSnaps.length} JobCostSnapshot records`);
        } catch (err) {
            console.warn('[GenesisReset] JobCostSnapshot error:', err.message);
        }

        // Delete PricingSnapshot
        try {
            const pricingSnaps = await base44.asServiceRole.entities.PricingSnapshot.filter({ companyId });
            deleteCounts.pricingSnapshot = pricingSnaps.length;
            for (const snap of pricingSnaps) {
                await base44.asServiceRole.entities.PricingSnapshot.delete(snap.id);
            }
            console.log(`[GenesisReset] Deleted ${pricingSnaps.length} PricingSnapshot records`);
        } catch (err) {
            console.warn('[GenesisReset] PricingSnapshot error:', err.message);
        }

        // Delete MaterialLine
        try {
            const matLines = await base44.asServiceRole.entities.MaterialLine.filter({ companyId });
            deleteCounts.materialLine = matLines.length;
            for (const line of matLines) {
                await base44.asServiceRole.entities.MaterialLine.delete(line.id);
            }
            console.log(`[GenesisReset] Deleted ${matLines.length} MaterialLine records`);
        } catch (err) {
            console.warn('[GenesisReset] MaterialLine error:', err.message);
        }

        // 3) Delete ONLY unlocked CompanySkuMap
        try {
            const mappings = await base44.asServiceRole.entities.CompanySkuMap.filter({ 
                companyId,
                locked: false 
            });
            deleteCounts.companySkuMap = mappings.length;
            for (const map of mappings) {
                await base44.asServiceRole.entities.CompanySkuMap.delete(map.id);
            }
            console.log(`[GenesisReset] Deleted ${mappings.length} unlocked CompanySkuMap records`);
        } catch (err) {
            console.warn('[GenesisReset] CompanySkuMap error:', err.message);
        }

        // 4) Clear Job.active_takeoff_snapshot_id and Job.active_pricing_snapshot_id
        try {
            const jobs = await base44.asServiceRole.entities.Job.filter({ companyId });
            let jobsCleared = 0;
            for (const job of jobs) {
                await base44.asServiceRole.entities.Job.update(job.id, {
                    active_takeoff_snapshot_id: null,
                    active_pricing_snapshot_id: null,
                    pricing_status: 'NEEDS_RECALC'
                });
                jobsCleared++;
            }
            deleteCounts.jobsCleared = jobsCleared;
            console.log(`[GenesisReset] Cleared snapshot references from ${jobsCleared} jobs`);
        } catch (err) {
            console.warn('[GenesisReset] Job update error:', err.message);
        }

        console.log(`[GenesisReset] COMPLETE for company ${companyId}`, deleteCounts);

        return Response.json({
            success: true,
            message: `Genesis reset completed for company ${companyId}`,
            deletedRecords: deleteCounts
        });

    } catch (error) {
        console.error('[GenesisReset] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});