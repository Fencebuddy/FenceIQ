import { safePct } from '../safeMath';

export function computeDataIntegrityKpis(signedDeals) {
    const ok = signedDeals.filter(d => d.integrityStatus === 'OK').length;
    const missingProposal = signedDeals.filter(d => d.integrityStatus === 'MISSING_PROPOSAL').length;
    const missingCost = signedDeals.filter(d => d.integrityStatus === 'MISSING_COST').length;
    const modelUnavailable = signedDeals.filter(d => d.integrityStatus === 'MODEL_UNAVAILABLE').length;
    
    const total = signedDeals.length;
    const completeness = safePct(ok, total);
    
    return {
        summary: {
            ok,
            missingProposal,
            missingCost,
            modelUnavailable,
            total,
            completeness
        },
        cards: [
            { label: 'Complete Records', value: ok, format: 'number' },
            { label: 'Missing Proposal', value: missingProposal, format: 'number' },
            { label: 'Missing Cost', value: missingCost, format: 'number' },
            { label: 'Model Unavailable', value: modelUnavailable, format: 'number' }
        ]
    };
}