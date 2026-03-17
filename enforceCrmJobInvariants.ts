import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * CRM JOB INVARIANTS ENFORCER
 * Ensures saleStatus/stage/contractStatus consistency
 * Prevents sold status drift and KPI miscounts
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const payload = await req.json();
    const { patch } = payload; // Partial CRMJob data
    
    if (!patch || typeof patch !== 'object') {
      return Response.json({ error: 'patch object required' }, { status: 400 });
    }

    // Deep clone to avoid mutation
    const normalized = { ...patch };

    // RULE A: Determine if job is SOLD
    const isSold = 
      normalized.contractStatus === 'signed' ||
      ['signed', 'production', 'installed'].includes(normalized.stage);

    // RULE B: If SOLD → enforce saleStatus and stage consistency
    if (isSold) {
      normalized.saleStatus = 'sold';
      
      // If contract signed but stage earlier than 'signed', advance stage
      if (normalized.contractStatus === 'signed' && 
          !['signed', 'production', 'installed'].includes(normalized.stage)) {
        normalized.stage = 'signed';
      }
    }

    // RULE C: If CANCELLED/INVALIDATED → force unsold
    const isCancelled = 
      normalized.stage === 'cancelled' || 
      normalized.contractStatus === 'invalidated';

    if (isCancelled) {
      normalized.saleStatus = 'unsold';
      normalized.recognitionStatus = 'UNRECOGNIZED';
      // Optional: zero out recognized revenue
      if (normalized.recognitionStatus === 'RECOGNIZED') {
        normalized.recognizedRevenueCents = 0;
        normalized.recognizedOverheadCents = 0;
      }
    }

    // RULE D: If not sold and not cancelled → unsold
    if (!isSold && !isCancelled && normalized.saleStatus !== 'sold') {
      normalized.saleStatus = 'unsold';
    }

    // RULE E: Recognition logic - if sold AND has contract value
    if (isSold && normalized.contractValueCents && normalized.contractValueCents > 0) {
      normalized.recognitionStatus = 'RECOGNIZED';
      normalized.recognizedRevenueCents = normalized.contractValueCents;
      
      // Calculate overhead recovery (14% of contract value)
      const overheadRate = normalized.overheadRate || 0.14;
      normalized.recognizedOverheadCents = Math.round(normalized.contractValueCents * overheadRate);
    }

    return Response.json({
      success: true,
      normalized,
      invariantsApplied: {
        isSold,
        isCancelled,
        saleStatus: normalized.saleStatus,
        recognitionStatus: normalized.recognitionStatus
      }
    });
  } catch (error) {
    console.error('Invariant enforcement failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});