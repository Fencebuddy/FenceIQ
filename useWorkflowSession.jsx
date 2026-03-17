/**
 * useWorkflowSession
 *
 * Centralized authoritative session hook for the WorkflowTopBar-driven job flow.
 * Fetches all prerequisite data for step unlock evaluation so that:
 *   - Unlock state is derived from server/persisted data, not transient component state
 *   - Backward navigation doesn't break unlock indicators
 *   - WorkflowTopBar stays in sync with actual job state
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useWorkflowSession(jobId, jobFromParent = null) {
  // Fetch job if not provided by parent (or use parent's cached version)
  const { data: fetchedJob } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => base44.entities.Job.filter({ id: jobId }).then(r => r[0]),
    enabled: !!jobId && !jobFromParent,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const job = jobFromParent || fetchedJob;

  // Fetch ProposalPricingSnapshot — authoritative source for "proposal" step unlock
  const { data: proposalSnapshots = [] } = useQuery({
    queryKey: ['proposalPricingSnapshot', jobId],
    queryFn: () => base44.entities.ProposalPricingSnapshot.filter({ job_id: jobId }),
    enabled: !!jobId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
  const proposalSnapshot = proposalSnapshots[0] || null;

  // Evaluate authoritative unlock state
  const unlockedSteps = useMemo(() => {
    if (!jobId) return new Set(['job-card']);

    const unlocked = new Set(['job-card']);

    // job-edit: job exists
    if (job) {
      unlocked.add('job-edit');
    }

    // job-cost: takeoff snapshot exists (server-only — no localStorage fallback to prevent stale unlocks)
    const hasTakeoff = !!job?.active_takeoff_snapshot_id;
    if (hasTakeoff) {
      unlocked.add('job-cost');
    }

    // present-price: pricing is saved
    const hasSavedPricing =
      job?.pricing_status === 'SAVED' ||
      !!job?.active_pricing_snapshot_id;
    if (hasTakeoff && hasSavedPricing) {
      unlocked.add('present-price');
    }

    // proposal: ProposalPricingSnapshot exists (server-only)
    const hasProposalSnapshot =
      !!proposalSnapshot ||
      !!job?.proposalAccepted;
    if (hasProposalSnapshot) {
      unlocked.add('proposal');
    }

    // signature: proposal accepted
    if (job?.proposalAccepted === true) {
      unlocked.add('signature');
    }

    return unlocked;
  }, [jobId, job, proposalSnapshot]);

  // Determine last valid step (highest unlocked step)
  const STEP_ORDER = [
    'job-card',
    'job-edit',
    'job-cost',
    'present-price',
    'proposal',
    'signature',
  ];

  const lastValidStepId = useMemo(() => {
    let last = 'job-card';
    for (const stepId of STEP_ORDER) {
      if (unlockedSteps.has(stepId)) last = stepId;
    }
    return last;
  }, [unlockedSteps]);

  return {
    job,
    proposalSnapshot,
    unlockedSteps,
    lastValidStepId,
    isStepUnlocked: (stepId) => unlockedSteps.has(stepId),
  };
}