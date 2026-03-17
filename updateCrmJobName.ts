/**
 * crm/updateCrmJobName.js
 * Manual name repair endpoint: update CRMJob.customerName + nameStatus + timestamp
 * Payload: { crmJobId, customerName, email?, phone? }
 */

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

async function resolveCompanyContext(base44, req) {
  const headerCompanyId = req.headers.get("x-company-id");
  if (headerCompanyId) {
    const matches = await base44.entities.CompanySettings.filter({ companyId: headerCompanyId });
    if (Array.isArray(matches) && matches.length === 1) {
      return { tenantId: matches[0].id, mode: "header" };
    }
  }

  const primary = await base44.entities.CompanySettings.filter({ isPrimary: true });
  if (Array.isArray(primary) && primary.length === 1) {
    return { tenantId: primary[0].id, mode: "primary" };
  }

  const all = await base44.entities.CompanySettings.list();
  if (Array.isArray(all) && all.length === 1) {
    return { tenantId: all[0].id, mode: "single_record" };
  }

  throw new Error("COMPANY_CONTEXT_AMBIGUOUS");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = await req.json();
    const { crmJobId, customerName, email, phone } = payload;

    if (!crmJobId || !customerName) {
      return Response.json(
        { success: false, error: "crmJobId and customerName required" },
        { status: 400 }
      );
    }

    const ctx = await resolveCompanyContext(base44, req);
    const { tenantId } = ctx;

    // Read job to verify ownership
    const job = await base44.asServiceRole.entities.CRMJob.read(crmJobId);
    if (!job || job.companyId !== tenantId) {
      return Response.json({ success: false, error: "Job not found or access denied" }, { status: 404 });
    }

    const trimmedName = (customerName ?? "").toString().trim();
    if (!trimmedName) {
      return Response.json({ success: false, error: "customerName cannot be empty" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updateData = {
      customerName: trimmedName,
      nameStatus: "RESOLVED",
      nameLastUpdatedAt: now
    };

    // Optionally link a contact if email/phone provided and no contact exists
    if (!job.primaryContactId && (email || phone)) {
      const cleanEmail = (email ?? "").toString().trim();
      const cleanPhone = (phone ?? "").toString().trim();

      if (cleanEmail || cleanPhone) {
        try {
          // Find or create CRMContact
          let contacts = [];
          if (cleanEmail) {
            contacts = await base44.asServiceRole.entities.CRMContact.filter({
              companyId: tenantId,
              email: cleanEmail
            });
          }

          let contact;
          if (Array.isArray(contacts) && contacts.length > 0) {
            contact = contacts[0];
          } else {
            contact = await base44.asServiceRole.entities.CRMContact.create({
              companyId: tenantId,
              email: cleanEmail,
              phone: cleanPhone,
              firstName: trimmedName.split(" ")[0],
              lastName: trimmedName.split(" ").slice(1).join(" ")
            });
          }

          if (contact) {
            updateData.primaryContactId = contact.id;
          }
        } catch {
          // Silently fail contact creation; don't block the name update
        }
      }
    }

    // Update the job
    const updated = await base44.asServiceRole.entities.CRMJob.update(crmJobId, updateData);

    return Response.json({
      success: true,
      crmJob: updated
    });
  } catch (e) {
    return Response.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
});