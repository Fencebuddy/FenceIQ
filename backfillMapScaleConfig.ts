/**
 * BACKFILL MAP SCALE CONFIG FOR LEGACY JOBS
 * 
 * One-time migration: Create MapScaleConfig for all jobs without one
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const GRID_CONTRACT = {
  config_version: 'grid_v1',
  pixels_per_foot: 10,
  world_width_px: 2000,
  world_height_px: 1500,
  grid_square_px: 40,
  grid_square_ft: 10,
  snap_threshold_px: 15,
  post_overlap_tolerance_ft: 0.25
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    // Get all jobs without mapScaleConfigId
    const allJobs = await base44.asServiceRole.entities.Job.list();
    const jobsNeedingConfig = allJobs.filter(j => !j.mapScaleConfigId);
    
    console.log(`[Backfill] Found ${jobsNeedingConfig.length} jobs needing MapScaleConfig`);
    
    let created = 0;
    let updated = 0;
    
    for (const job of jobsNeedingConfig) {
      // Create config
      const config = await base44.asServiceRole.entities.MapScaleConfig.create({
        ...GRID_CONTRACT,
        notes: `Legacy V1 config (backfilled ${new Date().toISOString()})`
      });
      
      // Link to job
      await base44.asServiceRole.entities.Job.update(job.id, {
        mapScaleConfigId: config.id
      });
      
      created++;
    }
    
    return Response.json({
      success: true,
      jobs_processed: jobsNeedingConfig.length,
      configs_created: created,
      message: `Backfilled MapScaleConfig for ${created} jobs`
    });
    
  } catch (error) {
    console.error('[Backfill] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});