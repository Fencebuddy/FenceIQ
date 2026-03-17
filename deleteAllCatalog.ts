import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all catalog items
    const catalog = await base44.asServiceRole.entities.MaterialCatalog.list();
    
    // Delete in batches to avoid rate limits
    const batchSize = 50;
    let deleted = 0;
    
    for (let i = 0; i < catalog.length; i += batchSize) {
      const batch = catalog.slice(i, i + batchSize);
      await Promise.all(
        batch.map(item => base44.asServiceRole.entities.MaterialCatalog.delete(item.id))
      );
      deleted += batch.length;
    }
    
    return Response.json({ 
      success: true, 
      deleted,
      message: `Deleted ${deleted} items from catalog` 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});