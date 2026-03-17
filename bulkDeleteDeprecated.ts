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

    // Fetch all deprecated UCKs
    const deprecated = await base44.asServiceRole.entities.CompanySkuMap.filter({ 
      companyId, 
      status: 'deprecated' 
    });

    console.log(`[bulkDeleteDeprecated] Found ${deprecated.length} deprecated UCKs`);

    // Delete in bulk
    let deletedCount = 0;
    for (const map of deprecated) {
      try {
        await base44.asServiceRole.entities.CompanySkuMap.delete(map.id);
        deletedCount++;
      } catch (err) {
        console.error(`[bulkDeleteDeprecated] Failed to delete ${map.id}:`, err);
      }
    }

    return Response.json({
      success: true,
      deletedCount,
      total: deprecated.length
    });

  } catch (error) {
    console.error('[bulkDeleteDeprecated] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});