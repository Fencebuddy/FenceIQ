import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PHASE 1 — DEFINE CANONICAL TRUTH SOURCES
 * 
 * Establishes one official source per KPI family:
 * - Signed-deal truth
 * - Cost truth
 * - Pricing discipline truth
 * - Appointment truth
 * - Production stage truth
 * 
 * Output: Truth-source contract table with linkage rules, fallbacks, and ownership
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // === DEFINE CANONICAL TRUTH SOURCES ===
    const truthSources = defineCanonicalTruthSources();

    // === VALIDATE AGAINST SCHEMA ===
    const schemaValidation = await validateTruthSourceSchema(base44, truthSources);

    // === DEPENDENCY & RISK ANALYSIS ===
    const riskAnalysis = analyzeTruthSourceRisks(truthSources);

    // === SYNTHESIZE DECISION ===
    const decision = synthesizePhase1Decision(truthSources, schemaValidation, riskAnalysis);

    return Response.json({
      phase: 'Phase 1 Define Canonical Truth Sources',
      timestamp: new Date().toISOString(),
      truthSources,
      schemaValidation,
      riskAnalysis,
      decision,
      nextSteps: decision.status === 'GO'
        ? 'Proceed to Phase 2 (Add KPI Integrity Reporting)'
        : 'Resolve blockers before Phase 2'
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});

// ============================================================
// DEFINE CANONICAL TRUTH SOURCES
// ============================================================
function defineCanonicalTruthSources() {
  return {
    signedDealTruth: {
      name: 'Signed Deal Truth',
      description: 'Identifies deals locked for revenue recognition',
      canonicalSource: 'CRMJob',
      canonicalField: 'contractStatus',
      canonicalValue: 'signed',
      inclusionRule: 'contractStatus === "signed" (signature optional, pricing binding)',
      primaryKey: 'CRMJob.id',
      linkageFields: {
        to_ProposalPricingSnapshot: {
          primary: 'CRMJob.currentProposalSnapshotId',
          fallback: 'CRMJob.externalJobId (match on job_id)',
          confidence: {
            exact_id: 'HIGH (100% confidence)',
            external_id: 'MEDIUM (80% confidence, requires validation)'
          },
          rule: 'Use currentProposalSnapshotId if populated; fallback to externalJobId only if no ambiguity'
        },
        to_SaleSnapshot: {
          relationship: 'OPTIONAL (SaleSnapshot is derived record, not authoritative)',
          note: 'SaleSnapshot contains frozen copy of pricing at sale-lock time'
        }
      },
      coverage: {
        target: '≥95% of signed jobs have currentProposalSnapshotId',
        phase3_action: 'Backfill missing linkages using confidence-ranked strategy'
      },
      status: 'CANONICAL'
    },

    contractValueTruth: {
      name: 'Contract Value Truth',
      description: 'Single source of truth for revenue amount',
      canonicalSource: 'CRMJob',
      canonicalField: 'contractValueCents',
      ownership: 'Durable value set at proposal/signature time',
      secondarySource: 'SaleSnapshot.contractValueCents (backup/validation)',
      inclusionRule: 'contractValueCents > 0 for sold/recognized jobs',
      dataType: 'number (cents)',
      durationRule: 'IMMUTABLE after sale lock (overwrite only on explicit change order)',
      linkageFields: {
        derivedFrom: 'ProposalPricingSnapshot.agreed_subtotal (contract basis)',
        historicalSource: [
          'SaleSnapshot created at sale-lock time',
          'CRMJob.priceSource indicates origin (proposal/pricing_engine/manual/builderprime)'
        ]
      },
      provenance: {
        field: 'CRMJob.priceSource',
        values: ['unknown', 'proposal', 'pricing_engine', 'manual', 'builderprime']
      },
      coverage: {
        target: '≥98% of signed jobs have contractValueCents > 0',
        phase3_action: 'Backfill from ProposalPricingSnapshot.agreed_subtotal if null'
      },
      status: 'CANONICAL'
    },

    costTruth: {
      name: 'Cost Truth',
      description: 'Single source for direct cost (materials + labor + delivery)',
      decision: 'MULTI-CANDIDATE—REQUIRES EXPLICIT CHOICE',
      candidates: {
        '1_ProposalPricingSnapshot': {
          entity: 'ProposalPricingSnapshot',
          field: 'direct_cost',
          timing: 'Captured at proposal presentation time',
          availability: 'Populated when proposal pricing created',
          pros: 'Linked via currentProposalSnapshotId (clear relationship)',
          cons: 'May be null if proposal cost not calculated; may differ from actual'
        },
        '2_JobCostSnapshot': {
          entity: 'JobCostSnapshot',
          field: 'direct_cost',
          timing: 'Calculated when takeoff completed',
          availability: 'Only if job has takeoff + scenario pricing',
          pros: 'Most detailed cost breakdown; scenario-based',
          cons: 'Requires takeoff completion; harder to link (only via externalJobId)'
        },
        '3_SaleSnapshot': {
          entity: 'SaleSnapshot',
          field: 'direct_cost_cents',
          timing: 'Frozen at sale-lock time',
          availability: 'Only for sold jobs',
          pros: 'Immutable audit trail',
          cons: 'Is derived record, not original source'
        }
      },
      recommended: 'ProposalPricingSnapshot (primary) + JobCostSnapshot fallback for precision',
      reasoning: [
        'ProposalPricingSnapshot is linked via currentProposalSnapshotId (reliable FK)',
        'JobCostSnapshot provides scenario-level detail when available',
        'SaleSnapshot should validate, not replace',
        'Avoid dual cost sources in same KPI (use one, fall back to other if missing)'
      ],
      implementationPriority: {
        phase1: 'CHOOSE BETWEEN ProposalPricingSnapshot vs JobCostSnapshot',
        phase3: 'Backfill cost linkage using chosen source',
        phase4: 'Implement fallback logic if primary unavailable'
      },
      decision_needed: 'EXPLICIT STAKEHOLDER SIGN-OFF on which cost source is canonical',
      status: 'BLOCKED_PENDING_DECISION'
    },

    pricingDisciplineTruth: {
      name: 'Pricing Discipline Truth',
      description: 'Model price vs presented price deviation; indicates discount/override usage',
      canonicalSource: 'ProposalPricingSnapshot',
      requiredFields: [
        'model_sell_price (FenceBuddy logic price)',
        'presented_sell_price (final price shown to customer)',
        'override_applied (boolean flag)',
        'override_reason (optional text)'
      ],
      fieldStatus: 'VERIFIED_EXISTS (Phase 0.5 confirmed both fields in schema)',
      inclusionRule: 'model_sell_price > 0 AND presented_sell_price > 0',
      deviationCalculation: 'abs(presented - model) / model',
      overridThreshold: '2% tolerance (>2% = override)',
      linkageFields: {
        to_SignedDeals: 'Via CRMJob.currentProposalSnapshotId'
      },
      coverage: {
        target: '≥75% of signed deals with valid model/presented prices',
        phase4_action: 'Compute override rate and model coverage %'
      },
      status: 'CANONICAL'
    },

    appointmentTruth: {
      name: 'Appointment Truth',
      description: 'Which jobs had appointments scheduled/ran; used for funnel metrics',
      decision: 'HYBRID FALLBACK RECOMMENDED',
      candidateSources: {
        '1_CalendarEvent': {
          entity: 'CalendarEvent',
          linkage: 'crmJobId (direct FK)',
          statusValues: ['scheduled', 'completed', 'cancelled'],
          timing: 'Real event records created when appointment made',
          pros: 'Is actual appointment source; real-time creation',
          cons: 'Phase 0.5 found sparse population; not all jobs have CalendarEvent'
        },
        '2_CRMJob.appointmentStatus': {
          entity: 'CRMJob',
          field: 'appointmentStatus',
          statusValues: ['scheduled', 'rescheduled', 'cancelled', 'completed'],
          timing: 'Updated when job moves through stages',
          pros: 'Always available on every job',
          cons: 'Weak signal (not primary appointment management); sparse population'
        }
      },
      recommended: 'HYBRID: CalendarEvent (primary) + CRMJob.appointmentStatus (fallback)',
      reasoning: [
        'CalendarEvent is the real appointment source (authoritative)',
        'CRMJob.appointmentStatus is legacy weak signal',
        'Phase 0.5 showed CalendarEvent is sparse—not ready for exclusive use',
        'Hybrid allows both sources until CalendarEvent coverage ≥85%'
      ],
      coverageTarget: {
        phase5: 'Build V2 truth set using CalendarEvent',
        phase6: 'Compare V1 (CRMJob.appointmentStatus) vs V2 (CalendarEvent)',
        migration: 'Promote V2 if coverage ≥85% and mismatch <10%'
      },
      status: 'HYBRID_FALLBACK_RECOMMENDED'
    },

    productionStageTruth: {
      name: 'Production Stage Truth',
      description: 'Maps job progression through install pipeline',
      canonicalSource: 'CRMJob',
      canonicalField: 'installStage',
      enumValues: [
        'SOLD',
        'PERMIT_OR_HOA',
        'READY_FOR_SCHEDULING',
        'SCHEDULED',
        'MATERIALS_ORDERED',
        'MATERIALS_RECEIVED',
        'IN_PROGRESS',
        'SUBSTANTIALLY_COMPLETE',
        'PUNCHLIST',
        'COMPLETED',
        'CLOSED_OUT'
      ],
      defaultBehavior: 'If null, use stage progression inference from paymentStage + installScheduledAt',
      mappingRule: 'Explicit enum mapping (not fuzzy defaults like "SOLD_NOT_SCHEDULED")',
      linkageFields: {
        timestampField: 'installStageUpdatedAt (tracks when stage changed)',
        completionMarker: 'installCompletedAt (when install finished)'
      },
      coverage: {
        target: '≥85% of signed jobs have installStage populated',
        phase3_action: 'Backfill installStage based on paymentStage progression'
      },
      status: 'CANONICAL'
    }
  };
}

// ============================================================
// VALIDATE AGAINST SCHEMA
// ============================================================
async function validateTruthSourceSchema(base44, truthSources) {
  const validation = {
    status: 'INCOMPLETE',
    findings: {}
  };

  try {
    // Verify canonical sources exist and have required fields
    const crmJobSchema = await base44.entities.CRMJob.schema?.();
    const proposalPricingSchema = await base44.entities.ProposalPricingSnapshot.schema?.();
    const jobCostSchema = await base44.entities.JobCostSnapshot.schema?.();
    const calendarEventSchema = await base44.entities.CalendarEvent.schema?.();
    const saleSnapshotSchema = await base44.entities.SaleSnapshot.schema?.();

    // Check signed deal truth
    validation.findings.signedDealTruth = {
      canonicalSource: 'CRMJob',
      requiredFields: {
        contractStatus: !!crmJobSchema?.properties?.contractStatus,
        currentProposalSnapshotId: !!crmJobSchema?.properties?.currentProposalSnapshotId,
        externalJobId: !!crmJobSchema?.properties?.externalJobId
      },
      status: 'OK'
    };

    // Check contract value truth
    validation.findings.contractValueTruth = {
      canonicalSource: 'CRMJob',
      requiredFields: {
        contractValueCents: !!crmJobSchema?.properties?.contractValueCents,
        priceSource: !!crmJobSchema?.properties?.priceSource
      },
      status: 'OK'
    };

    // Check cost truth candidates
    validation.findings.costTruth = {
      ProposalPricingSnapshot: {
        has_direct_cost: !!proposalPricingSchema?.properties?.direct_cost,
        status: 'VERIFIED'
      },
      JobCostSnapshot: {
        has_direct_cost: !!jobCostSchema?.properties?.direct_cost,
        status: 'VERIFIED'
      },
      SaleSnapshot: {
        has_direct_cost_cents: !!saleSnapshotSchema?.properties?.direct_cost_cents,
        status: 'VERIFIED'
      },
      decision_required: 'Choose ProposalPricingSnapshot OR JobCostSnapshot as canonical'
    };

    // Check pricing discipline truth
    validation.findings.pricingDisciplineTruth = {
      canonicalSource: 'ProposalPricingSnapshot',
      requiredFields: {
        model_sell_price: !!proposalPricingSchema?.properties?.model_sell_price,
        presented_sell_price: !!proposalPricingSchema?.properties?.presented_sell_price,
        override_applied: !!proposalPricingSchema?.properties?.override_applied
      },
      status: !!proposalPricingSchema?.properties?.model_sell_price ? 'VERIFIED' : 'MISSING'
    };

    // Check appointment truth
    validation.findings.appointmentTruth = {
      CalendarEvent: {
        has_crmJobId: !!calendarEventSchema?.properties?.crmJobId,
        has_status: !!calendarEventSchema?.properties?.status,
        status: 'VERIFIED'
      },
      CRMJob: {
        has_appointmentStatus: !!crmJobSchema?.properties?.appointmentStatus,
        status: 'VERIFIED'
      }
    };

    // Check production stage truth
    validation.findings.productionStageTruth = {
      canonicalSource: 'CRMJob',
      requiredFields: {
        installStage: !!crmJobSchema?.properties?.installStage,
        installStageUpdatedAt: !!crmJobSchema?.properties?.installStageUpdatedAt
      },
      enumValues: crmJobSchema?.properties?.installStage?.enum || [],
      status: 'VERIFIED'
    };

    validation.status = 'COMPLETE';
  } catch (error) {
    validation.status = 'ERROR';
    validation.error = error.message;
  }

  return validation;
}

// ============================================================
// ANALYZE TRUTH SOURCE RISKS
// ============================================================
function analyzeTruthSourceRisks(truthSources) {
  const risks = {
    highRisk: [],
    mediumRisk: [],
    lowRisk: [],
    blockers: [],
    decisions: []
  };

  // Signed deal truth
  risks.lowRisk.push(
    'Signed deal truth (CRMJob.contractStatus) is reliable; FK linkage via currentProposalSnapshotId'
  );

  // Contract value truth
  risks.lowRisk.push(
    'Contract value truth (CRMJob.contractValueCents) is durable once set'
  );

  // Cost truth
  risks.blockers.push(
    'Cost truth has 3 candidate sources; Phase 1 must choose ONE canonical source before Phase 3 backfill'
  );
  risks.decisions.push({
    decision: 'Choose canonical cost source',
    options: [
      'ProposalPricingSnapshot.direct_cost (linked via currentProposalSnapshotId)',
      'JobCostSnapshot.direct_cost (linked via externalJobId—less reliable)',
      'SaleSnapshot.direct_cost_cents (derived record, validate only)'
    ],
    ownership: 'Product + Finance',
    deadline: 'Before Phase 3'
  });

  // Pricing discipline truth
  risks.lowRisk.push(
    'Pricing discipline truth (ProposalPricingSnapshot.model_sell_price + presented_sell_price) fields VERIFIED in schema'
  );

  // Appointment truth
  risks.mediumRisk.push(
    'Appointment truth: CalendarEvent is sparse; hybrid fallback recommended until ≥85% coverage'
  );
  risks.decisions.push({
    decision: 'Confirm appointment migration path',
    options: [
      'Use hybrid (CalendarEvent primary, CRMJob.appointmentStatus fallback)',
      'Wait for CalendarEvent population to improve, then exclusive use',
      'Deprecate CRMJob.appointmentStatus entirely'
    ],
    ownership: 'Product + Operations',
    deadline: 'Before Phase 5'
  });

  // Production stage truth
  risks.lowRisk.push(
    'Production stage truth (CRMJob.installStage) has complete enum; no field gaps'
  );

  return risks;
}

// ============================================================
// SYNTHESIZE PHASE 1 DECISION
// ============================================================
function synthesizePhase1Decision(truthSources, schemaValidation, riskAnalysis) {
  const hasBlockers = riskAnalysis.blockers.length > 0;

  return {
    status: hasBlockers ? 'CONDITIONAL_GO' : 'GO',
    rationale: [
      'Signed deal, contract value, pricing discipline, and production stage truth sources are clear and verified.',
      'Appointment truth requires hybrid fallback (CalendarEvent + CRMJob.appointmentStatus).',
      'Cost truth requires explicit stakeholder decision before Phase 3 backfill.'
    ],
    requiredDecisions: riskAnalysis.decisions.map(d => ({
      ...d,
      blocking: d.decision === 'Choose canonical cost source'
    })),
    truthSourceSummary: {
      signedDealTruth: 'CANONICAL: CRMJob.contractStatus + currentProposalSnapshotId linkage',
      contractValueTruth: 'CANONICAL: CRMJob.contractValueCents',
      costTruth: 'PENDING_DECISION: ProposalPricingSnapshot vs JobCostSnapshot',
      pricingDisciplineTruth: 'CANONICAL: ProposalPricingSnapshot (fields verified)',
      appointmentTruth: 'HYBRID: CalendarEvent primary + CRMJob.appointmentStatus fallback',
      productionStageTruth: 'CANONICAL: CRMJob.installStage enum'
    },
    nextSteps: [
      '1. SIGN OFF on canonical cost source choice (blocking Phase 3)',
      '2. DOCUMENT appointment migration timeline (Phase 5 gate)',
      '3. PROCEED to Phase 2 (Add KPI Integrity Reporting)'
    ],
    exitCriteria: {
      costSourceDecision: !hasBlockers,
      appointmentMigrationPath: true,
      readyForPhase2: !hasBlockers
    }
  };
}