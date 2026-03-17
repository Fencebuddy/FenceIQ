import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { buildTakeoff } from '@/components/materials/canonicalTakeoffEngine';
import { getOrCreateTakeoffSnapshot } from '@/components/pricing/snapshotService';
import { base44 } from '@/api/base44Client';

export default function JobCostButton({ 
  job, 
  jobId, 
  fenceLines, 
  runs, 
  gates, 
  jobPosts, 
  pricingStatus, 
  mapSaveStatus,
  setTakeoff 
}) {
  const navigate = useNavigate();

  const handleJobCostClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // PATCH C: Block if unsaved map changes (Frozen Contract enforcement)
    if (mapSaveStatus === 'unsaved') {
      toast.error('Save Map before calculating Job Cost');
      return;
    }
    
    // Build and store live takeoff immediately
    const takeoffResult = buildTakeoff(job, fenceLines, runs, gates || [], jobPosts);
    
    if (takeoffResult?.lineItems?.length > 0) {
      setTakeoff(jobId, takeoffResult.lineItems, {
        materialType: job.materialType,
        total_lf: fenceLines.reduce((sum, line) => sum + (line.manualLengthFt || 0), 0),
        postCounts: takeoffResult.postCounts,
        source: 'MAP_DRIVEN'
      });
      
      // CRITICAL FIX: Wait for snapshot creation before navigating
      const loadingToast = toast.loading('Creating snapshot...');
      try {
        const snapshot = await getOrCreateTakeoffSnapshot({
          jobId,
          job,
          fenceLines,
          runs,
          gates,
          takeoffResult
        });
        
        await base44.entities.Job.update(jobId, {
          active_takeoff_snapshot_id: snapshot.id,
          map_state_hash: snapshot.map_state_hash
        });
        
        toast.success('Snapshot created', { id: loadingToast });
        navigate(createPageUrl(`PricingIntelligence?jobId=${jobId}`));
      } catch (err) {
        toast.error('Failed to create snapshot', { id: loadingToast });
        console.error('[JobDetail] Snapshot creation failed:', err);
      }
    } else {
      toast.error('No materials to calculate');
    }
  };

  return (
    <Button 
      className={`${pricingStatus === 'NEEDS_RECALC' || pricingStatus === 'OUTDATED' ? 'bg-blue-600 hover:bg-blue-700' : ''} h-9 sm:h-10 lg:text-xs`}
      variant={pricingStatus === 'SAVED' ? 'outline' : 'default'}
      onClick={handleJobCostClick}
    >
      <DollarSign className="w-4 h-4 sm:w-4 sm:h-4 mr-2" />
      <span className="hidden sm:inline">Job Cost</span>
    </Button>
  );
}