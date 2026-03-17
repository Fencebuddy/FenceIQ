import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ADMIN-ONLY: Delete all unlocked mappings (safe cleanup)
 * Preserves locked mappings (user-selected)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { companyId } = await req.json();

    if (!companyId) {
      return Response.json({ error: 'companyId is required' }, { status: 400 });
    }

    console.log(`[deleteUnlockedMappings] Starting cleanup for company: ${companyId}`);

    // Fetch unlocked mappings only
    const unlockedMappings = await base44.entities.CompanySkuMap.filter({
      companyId,
      locked: false
    });

    console.log(`[deleteUnlockedMappings] Found ${unlockedMappings.length} unlocked mappings`);

    // Delete each unlocked mapping
    let deletedCount = 0;
    for (const mapping of unlockedMappings) {
      await base44.entities.CompanySkuMap.delete(mapping.id);
      deletedCount++;
    }

    console.log(`[deleteUnlockedMappings] ✅ Deleted ${deletedCount} unlocked mappings`);

    return Response.json({
      success: true,
      companyId,
      deletedCount,
      message: 'Unlocked mappings deleted - locked mappings preserved'
    });
  } catch (error) {
    console.error('[deleteUnlockedMappings] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});