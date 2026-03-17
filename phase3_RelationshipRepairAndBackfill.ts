import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PHASE 3 — RELATIONSHIP REPAIR AND BACKFILL
 * 
 * Repairs broken/missing relationships using strict confidence buckets.
 * 
 * Operations:
 * 1. Backfill currentProposalSnapshotId on CRMJob (HIGH/MEDIUM confidence only)
 * 2. Backfill cost links (HIGH confidence only)
 * 3. Backfill missing contractValueCents from proposals
 * 
 * All repairs are reversible—stores original state in AutoFixLog.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const companies = await base44.entities.CompanySettings.filter({});
    const companyId = companies[0]?.id;

    if (!companyId) {
      return Response.json({ error: 'No company found' }, { status: 400 });
    }

    // === PHASE 3A: REPAIR PROPOSAL SNAPSHOT LINKAGE ===
    const proposalLinkageRepair = await repairProposalSnapshotLinkage(base44, companyId);

    // === PHASE 3B: REPAIR COST LINKAGE ===
    const costLinkageRepair = await repairCostLinkage(base44, companyId);

    // === PHASE 3C: BACKFILL CONTRACT VALUE ===
    const contractValueBackfill = await backfillContractValue(base44, companyId);

    // === SYNTHESIS ===
    const synthesis = {
      status: 'COMPLETE',
      timestamp: new Date().toISOString(),
      operations: {
        proposalLinkage: proposalLinkageRepair,
        costLinkage: costLinkageRepair,
        contractValue: contractValueBackfill
      },
      reversibility: {
        note: 'All repairs logged in AutoFixLog with original state.',
        undoCapability: 'Each AutoFixLog entry is reversible by restoring original values.',
        auditTrail: 'Review AutoFixLog for repair history.'
      },
      nextSteps: [
        'Phase 4: Compute pricing discipline and production stage defaults',
        'Phase 5: Migrate appointment source from CRMJob to CalendarEvent'
      ]
    };

    return Response.json(synthesis);
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});

// ============================================================
// PHASE 3A: REPAIR PROPOSAL SNAPSHOT LINKAGE
// ============================================================
async function repairProposalSnapshotLinkage(base44, companyId) {
  const result = {
    operationName: 'Repair Proposal Snapshot Linkage',
    totalJobsScanned: 0,
    repairsByConfidence: {
      HIGH: { count: 0, samples: [] },
      MEDIUM: { count: 0, samples: [] },
      LOW: { count: 0, skipped: true }
    },
    unrepaired: { count: 0, samples: [] },
    errors: []
  };

  try {
    // Fetch all signed jobs and proposals
    const signedJobs = await base44.entities.CRMJob.filter({
      companyId,
      contractStatus: 'signed'
    });
    const proposalSnapshots = await base44.entities.ProposalPricingSnapshot.list();
    const jobLookup = await base44.entities.Job.filter({ companyId });

    result.totalJobsScanned = signedJobs.length;

    for (const job of signedJobs) {
      // Already has linkage
      if (job.currentProposalSnapshotId) {
        continue;
      }

      // === CONFIDENCE STRATEGY 1: DIRECT externalJobId MATCH ===
      const highConfidenceSnapshots = proposalSnapshots.filter(ps =>
        ps.jobId === job.externalJobId && ps.status === 'signed'
      );

      if (highConfidenceSnapshots.length === 1) {
        // HIGH confidence: exactly one signed proposal found
        const snapshot = highConfidenceSnapshots[0];
        const originalValue = job.currentProposalSnapshotId;

        await base44.entities.CRMJob.update(job.id, {
          currentProposalSnapshotId: snapshot.id
        });

        await base44.entities.AutoFixLog.create({
          companyId,
          jobId: job.id,
          operationType: 'repair_proposal_linkage',
          confidence: 'HIGH',
          originalValue,
          newValue: snapshot.id,
          reasoning: 'Exact match: externalJobId → ProposalSnapshot (signed)',
          reversible: true,
          appliedAt: new Date().toISOString()
        });

        result.repairsByConfidence.HIGH.count++;
        result.repairsByConfidence.HIGH.samples.push({
          jobNumber: job.jobNumber,
          snapshotId: snapshot.id
        });
        continue;
      }

      // === CONFIDENCE STRATEGY 2: MOST RECENT externalJobId MATCH ===
      if (highConfidenceSnapshots.length > 1) {
        // MEDIUM confidence: multiple proposals—pick most recent
        const mostRecent = highConfidenceSnapshots.reduce((latest, ps) =>
          new Date(ps.sentAt || 0) > new Date(latest.sentAt || 0) ? ps : latest
        );

        const originalValue = job.currentProposalSnapshotId;

        await base44.entities.CRMJob.update(job.id, {
          currentProposalSnapshotId: mostRecent.id
        });

        await base44.entities.AutoFixLog.create({
          companyId,
          jobId: job.id,
          operationType: 'repair_proposal_linkage',
          confidence: 'MEDIUM',
          originalValue,
          newValue: mostRecent.id,
          reasoning: `Multiple proposals found; selected most recent (${mostRecent.sentAt})`,
          reversible: true,
          appliedAt: new Date().toISOString()
        });

        result.repairsByConfidence.MEDIUM.count++;
        result.repairsByConfidence.MEDIUM.samples.push({
          jobNumber: job.jobNumber,
          snapshotId: mostRecent.id
        });
        continue;
      }

      // No repair possible
      result.unrepaired.count++;
      result.unrepaired.samples.push({
        jobNumber: job.jobNumber,
        reason: 'No proposal snapshot found via externalJobId'
      });
    }
  } catch (error) {
    result.errors.push(error.message);
  }

  return result;
}

// ============================================================
// PHASE 3B: REPAIR COST LINKAGE
// ============================================================
async function repairCostLinkage(base44, companyId) {
  const result = {
    operationName: 'Repair Cost Linkage',
    totalJobsScanned: 0,
    costSourceDecision: null,
    repairsByConfidence: {
      HIGH: { count: 0, samples: [] },
      MEDIUM: { count: 0, samples: [] }
    },
    unrepaired: { count: 0, samples: [] },
    errors: []
  };

  try {
    // === READ CANONICAL COST SOURCE DECISION FROM CompanySettings ===
    const companies = await base44.entities.CompanySettings.filter({ id: companyId });
    const company = companies[0];
    const canonicalCostSource = company?.canonicalCostSource || 'proposal';
    result.costSourceDecision = canonicalCostSource;

    const signedJobs = await base44.entities.CRMJob.filter({
      companyId,
      contractStatus: 'signed'
    });
    const proposalSnapshots = await base44.entities.ProposalPricingSnapshot.list();
    const jobCostSnapshots = await base44.entities.JobCostSnapshot.list();

    result.totalJobsScanned = signedJobs.length;

    for (const job of signedJobs) {
      // Skip if cost already populated
      if (job.directCostCents && job.directCostCents > 0) {
        continue;
      }

      let costCents = null;
      let source = null;

      // === CANONICAL SOURCE: PROPOSAL ===
      if (canonicalCostSource === 'proposal') {
        if (job.currentProposalSnapshotId) {
          const snapshot = proposalSnapshots.find(ps => ps.id === job.currentProposalSnapshotId);
          if (snapshot && snapshot.direct_cost) {
            costCents = Math.round(snapshot.direct_cost * 100);
            source = 'proposal';
          }
        }
      }

      // === CANONICAL SOURCE: JOBCOST ===
      else if (canonicalCostSource === 'jobcost') {
        if (job.externalJobId) {
          const jobCostSnapshot = jobCostSnapshots.find(jc => jc.jobId === job.externalJobId);
          if (jobCostSnapshot && jobCostSnapshot.direct_cost) {
            costCents = Math.round(jobCostSnapshot.direct_cost * 100);
            source = 'jobcost';
          }
        }
      }

      // Apply repair if cost was found
      if (costCents && costCents > 0) {
        const originalValue = job.directCostCents;

        await base44.entities.CRMJob.update(job.id, {
          directCostCents: costCents,
          costSource: source
        });

        await base44.entities.AutoFixLog.create({
          companyId,
          jobId: job.id,
          operationType: 'backfill_cost',
          confidence: 'HIGH',
          originalValue,
          newValue: costCents,
          reasoning: `Derived from canonical cost source (${source}) per CompanySettings.canonicalCostSource`,
          reversible: true,
          appliedAt: new Date().toISOString()
        });

        result.repairsByConfidence.HIGH.count++;
        result.repairsByConfidence.HIGH.samples.push({
          jobNumber: job.jobNumber,
          costCents,
          source
        });
        continue;
      }

      // No repair possible
      result.unrepaired.count++;
      result.unrepaired.samples.push({
        jobNumber: job.jobNumber,
        reason: `No cost data found in canonical source (${canonicalCostSource})`
      });
    }
  } catch (error) {
    result.errors.push(error.message);
  }

  return result;
}

// ============================================================
// PHASE 3C: BACKFILL CONTRACT VALUE
// ============================================================
async function backfillContractValue(base44, companyId) {
  const result = {
    operationName: 'Backfill Contract Value',
    totalJobsScanned: 0,
    repairsByConfidence: {
      HIGH: { count: 0, samples: [] },
      MEDIUM: { count: 0, samples: [] }
    },
    unrepaired: { count: 0, samples: [] },
    errors: []
  };

  try {
    const soldJobs = await base44.entities.CRMJob.filter({
      companyId,
      saleStatus: 'sold'
    });
    const proposalSnapshots = await base44.entities.ProposalPricingSnapshot.list();
    const saleSnapshots = await base44.entities.SaleSnapshot.list();

    result.totalJobsScanned = soldJobs.length;

    for (const job of soldJobs) {
      // Skip if contract value already populated
      if (job.contractValueCents && job.contractValueCents > 0) {
        continue;
      }

      // === STRATEGY 1: HIGH CONFIDENCE - Use linked proposal snapshot ===
      if (job.currentProposalSnapshotId) {
        const proposal = proposalSnapshots.find(ps => ps.id === job.currentProposalSnapshotId);
        if (proposal && proposal.agreed_subtotal) {
          const contractValueCents = Math.round(proposal.agreed_subtotal * 100);
          const originalValue = job.contractValueCents;

          await base44.entities.CRMJob.update(job.id, {
            contractValueCents,
            priceSource: 'proposal'
          });

          await base44.entities.AutoFixLog.create({
            companyId,
            jobId: job.id,
            operationType: 'backfill_contract_value',
            confidence: 'HIGH',
            originalValue,
            newValue: contractValueCents,
            reasoning: 'Derived from linked ProposalPricingSnapshot.agreed_subtotal',
            reversible: true,
            appliedAt: new Date().toISOString()
          });

          result.repairsByConfidence.HIGH.count++;
          result.repairsByConfidence.HIGH.samples.push({
            jobNumber: job.jobNumber,
            contractValueCents,
            source: 'proposal'
          });
          continue;
        }
      }

      // === STRATEGY 2: MEDIUM CONFIDENCE - Use SaleSnapshot backup ===
      const saleSnapshot = saleSnapshots.find(ss => ss.jobId === job.id || ss.crmJobId === job.id);
      if (saleSnapshot && saleSnapshot.contractValueCents > 0) {
        const originalValue = job.contractValueCents;

        await base44.entities.CRMJob.update(job.id, {
          contractValueCents: saleSnapshot.contractValueCents,
          priceSource: 'sale_snapshot'
        });

        await base44.entities.AutoFixLog.create({
          companyId,
          jobId: job.id,
          operationType: 'backfill_contract_value',
          confidence: 'MEDIUM',
          originalValue,
          newValue: saleSnapshot.contractValueCents,
          reasoning: 'Derived from SaleSnapshot (backup source)',
          reversible: true,
          appliedAt: new Date().toISOString()
        });

        result.repairsByConfidence.MEDIUM.count++;
        result.repairsByConfidence.MEDIUM.samples.push({
          jobNumber: job.jobNumber,
          contractValueCents: saleSnapshot.contractValueCents,
          source: 'sale_snapshot'
        });
        continue;
      }

      // No repair possible
      result.unrepaired.count++;
      result.unrepaired.samples.push({
        jobNumber: job.jobNumber,
        reason: 'No proposal or sale snapshot with contract value'
      });
    }
  } catch (error) {
    result.errors.push(error.message);
  }

  return result;
}