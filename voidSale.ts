import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * voidSale — Admin-only endpoint to void a previously sold job
 * Sets saleVoidedAt, saleVoidedReason, saleVoidedByUserId on CRMJob
 * This immediately removes the job from all revenue reporting (isSoldForReporting returns false)
 * 
 * Input: { crmJobId, reason }
 * Output: { ok, crmJobId, voidedAt }
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin') {
            return Response.json({ ok: false, error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { crmJobId, reason } = await req.json();

        if (!crmJobId) {
            return Response.json({ ok: false, error: 'crmJobId required' }, { status: 400 });
        }

        if (!reason || reason.trim().length < 5) {
            return Response.json({ ok: false, error: 'Reason required (min 5 characters)' }, { status: 400 });
        }

        // Load the CRMJob
        const jobs = await base44.asServiceRole.entities.CRMJob.filter({ id: crmJobId });
        if (jobs.length === 0) {
            return Response.json({ ok: false, error: 'CRMJob not found' }, { status: 404 });
        }

        const job = jobs[0];

        // Guard: already voided
        if (job.saleVoidedAt) {
            return Response.json({
                ok: false,
                error: 'ALREADY_VOIDED',
                message: `Sale was already voided at ${job.saleVoidedAt}`
            });
        }

        // Guard: must have been sold to be voided
        if (job.saleStatus !== 'sold' && job.contractStatus !== 'signed') {
            return Response.json({
                ok: false,
                error: 'NOT_SOLD',
                message: 'Job must be sold before it can be voided'
            });
        }

        const voidedAt = new Date().toISOString();

        await base44.asServiceRole.entities.CRMJob.update(crmJobId, {
            saleVoidedAt: voidedAt,
            saleVoidedReason: reason.trim(),
            saleVoidedByUserId: user.id,
            // Keep saleStatus/contractStatus as historical record — isSoldForReporting checks voidedAt first
        });

        console.log('[voidSale] Sale voided:', { crmJobId, jobNumber: job.jobNumber, reason, voidedBy: user.id });

        return Response.json({
            ok: true,
            crmJobId,
            jobNumber: job.jobNumber,
            voidedAt,
            message: `Sale for ${job.customerName || job.jobNumber} voided successfully`
        });

    } catch (error) {
        console.error('[voidSale] Error:', error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
});