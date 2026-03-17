import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { resolveCompanyContext } from "./_shared/resolveCompanyContext.js";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const ctx = await resolveCompanyContext({ base44, req });
    if (ctx.error) {
      return Response.json({ error: ctx.error.message, code: ctx.error.code }, { status: 500 });
    }

    const { companyId, company, mode } = ctx;

    return Response.json({
      success: true,
      companyId,
      mode,
      company: {
        id: company.id,
        companyId: company.companyId ?? company.id,
        isPrimary: company.isPrimary ?? false,
        defaultOverheadRate: company.defaultOverheadRate ?? null,
        defaultCommissionRate: company.defaultCommissionRate ?? null,
        allowInternalPricingOverrides: company.allowInternalPricingOverrides ?? false,
        discountPolicy: company.discountPolicy ?? null,
        createdAt: company.created_date
      }
    });
  } catch (e) {
    console.error('[getCompanyContext] error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});