import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DISCOVER ALL UCKS IN PRODUCTION JOBS
 * 
 * Scans all jobs and extracts unique UCKs from their takeoffs.
 * Shows which are mapped vs unmapped, grouped by fence type.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { companyId } = await req.json();
    if (!companyId) {
      return Response.json({ error: 'companyId required' }, { status: 400 });
    }

    // Fetch all jobs for this company
    const jobs = await base44.asServiceRole.entities.Job.filter({ companyId });
    
    // Fetch all CompanySkuMap mappings
    const mappings = await base44.asServiceRole.entities.CompanySkuMap.filter({ companyId });
    const mappedUcks = new Set(mappings.map(m => m.uck));

    const uckDiscovery = new Map(); // uck -> { count, jobs, type, isMapped }
    
    // Scan each job's takeoff snapshots
    for (const job of jobs) {
      const snapshots = await base44.asServiceRole.entities.TakeoffSnapshot.filter({ 
        jobId: job.id 
      });
      
      for (const snapshot of snapshots) {
        if (!snapshot.line_items || !Array.isArray(snapshot.line_items)) continue;
        
        for (const item of snapshot.line_items) {
          const uck = item.uck || item.canonical_key;
          if (!uck) continue;
          
          if (!uckDiscovery.has(uck)) {
            uckDiscovery.set(uck, {
              uck,
              count: 0,
              jobIds: [],
              isMapped: mappedUcks.has(uck),
              type: classifyUckType(uck),
              displayName: item.displayName || item.lineItemName || uck
            });
          }
          
          const entry = uckDiscovery.get(uck);
          entry.count++;
          if (!entry.jobIds.includes(job.id)) {
            entry.jobIds.push(job.id);
          }
        }
      }
    }

    // Group by type and map status
    const grouped = {
      wood_posts: [],
      vinyl_posts: [],
      vinyl_panels: [],
      vinyl_rails: [],
      vinyl_gates: [],
      chainlink_posts: [],
      chainlink_gates: [],
      aluminum_posts: [],
      other: []
    };

    for (const entry of uckDiscovery.values()) {
      const group = entry.isMapped ? 'mapped' : 'unmapped';
      const typeGroup = entry.type;
      
      if (!grouped[typeGroup]) grouped[typeGroup] = [];
      grouped[typeGroup].push(entry);
    }

    // Sort each group by count (unmapped first within groups)
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        // Unmapped first
        if (a.isMapped !== b.isMapped) return a.isMapped ? 1 : -1;
        // Then by count
        return b.count - a.count;
      });
    });

    return Response.json({
      success: true,
      jobsScanned: jobs.length,
      totalUniqueUcks: uckDiscovery.size,
      mappedUcks: Array.from(uckDiscovery.values()).filter(e => e.isMapped).length,
      unmappedUcks: Array.from(uckDiscovery.values()).filter(e => !e.isMapped).length,
      grouped
    });
  } catch (error) {
    console.error('[discoverAllUcks]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function classifyUckType(uck) {
  if (uck.includes('wood_post')) return 'wood_posts';
  if (uck.includes('vinyl_post')) return 'vinyl_posts';
  if (uck.includes('vinyl_panel')) return 'vinyl_panels';
  if (uck.includes('vinyl_rail')) return 'vinyl_rails';
  if (uck.includes('vinyl') && uck.includes('gate')) return 'vinyl_gates';
  if (uck.includes('chainlink_post')) return 'chainlink_posts';
  if (uck.includes('chainlink') && uck.includes('gate')) return 'chainlink_gates';
  if (uck.includes('aluminum_post')) return 'aluminum_posts';
  return 'other';
}