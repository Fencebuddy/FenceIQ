import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { upsertCrmJob } from './crm/upsertCrmJob.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Parse payload
        const payload = await req.json();

        // Get company context (scoped)
        const ctxRes = await base44.asServiceRole.functions.invoke('getCompanyContext', {});
        if (!ctxRes?.data?.success || !ctxRes?.data?.companyId) {
            return Response.json({ error: 'Company context unavailable' }, { status: 400 });
        }
        const companyId = ctxRes.data.companyId;
        const settings = ctxRes.data.company;

        if (!settings[0]?.crmEnabled) {
            return Response.json({ error: 'CRM not enabled' }, { status: 403 });
        }

        // Validate required fields
        if (!payload.externalAppointmentId) {
            return Response.json({ error: 'externalAppointmentId is required' }, { status: 400 });
        }

        // Check if CRMJob exists
        const existingJobs = await base44.asServiceRole.entities.CRMJob.filter({
            companyId,
            externalCRM: 'builder_prime',
            externalAppointmentId: payload.externalAppointmentId
        });

        let crmJob;

        if (existingJobs.length > 0) {
            // Non-destructive update: only update appointment/sync fields
            crmJob = existingJobs[0];
            
            const updates = {
                appointmentDateTime: payload.appointmentDateTime,
                appointmentStatus: payload.appointmentStatus || 'scheduled',
                assignedRepUserId: payload.assignedSalesRep || crmJob.assignedRepUserId
            };

            // Handle status changes
            if (payload.appointmentStatus === 'cancelled') {
                updates.stage = 'cancelled';
                updates.lossType = 'demo_no_sale';
                updates.lostAt = new Date().toISOString();
            } else if (payload.appointmentStatus === 'rescheduled') {
                updates.stage = 'appointment_scheduled';
            }

            // Non-destructive notes
            if (payload.notes && !crmJob.notes) {
                updates.notes = payload.notes;
            }

            // Apply invariants
            const invariantRes = await base44.asServiceRole.functions.invoke('enforceCrmJobInvariants', {
                patch: { ...crmJob, ...updates }
            });
            const normalizedUpdates = invariantRes?.data?.success 
                ? invariantRes.data.normalized 
                : updates;

            crmJob = await base44.asServiceRole.entities.CRMJob.update(crmJob.id, normalizedUpdates);

            // Emit activity event
            await base44.asServiceRole.entities.CRMActivityEvent.create({
                companyId,
                jobId: crmJob.id,
                type: 'appointment_synced',
                occurredAt: new Date().toISOString(),
                metadata: {
                    externalAppointmentId: payload.externalAppointmentId,
                    action: 'updated',
                    appointmentStatus: payload.appointmentStatus
                }
            });
        } else {
            // Allocate job number atomically
            const jobNumRes = await base44.asServiceRole.functions.invoke('allocateJobNumber', { companyId });
            const jobNumber = jobNumRes?.data?.success 
                ? jobNumRes.data.jobNumber 
                : `BP-${payload.externalAppointmentId}`;

            // Build CRM patch for upsertCrmJob (invariant will compute customerName)
            const crmPatch = {
                 jobNumber,
                 externalCRM: 'builder_prime',
                 externalAppointmentId: payload.externalAppointmentId,
                 externalCustomerId: payload.externalCustomerId,
                 appointmentDateTime: payload.appointmentDateTime,
                 appointmentStatus: payload.appointmentStatus || 'scheduled',
                 createdFrom: 'appointment_sync',
                 stage: 'appointment_scheduled',
                 saleStatus: 'unsold',
                 contractStatus: 'unsigned',
                 lossType: 'na',
                 paymentStatus: 'na',
                 installStatus: 'na',
                 assignedRepUserId: payload.assignedSalesRep,
                 source: payload.leadSource || 'other',
                 contractValueCents: 0,
                 priceSource: 'unknown',
                 // Pass firstName, lastName, email, phone for invariant to compute customerName
                 firstName: payload.firstName,
                 lastName: payload.lastName,
                 email: payload.email,
                 phone: payload.phone,
                 customerName: payload.customerName // explicit override if provided
             };

            // Upsert via invariant (enforces customerName + idempotency)
            const upsertRes = await upsertCrmJob({
              base44: base44.asServiceRole,
              tenantId: companyId,
              patch: crmPatch,
              mode: 'appointment_sync'
            });

            if (!upsertRes?.success) {
              throw new Error(`CRMJob upsert failed: ${upsertRes?.error?.message || 'unknown'}`);
            }

            crmJob = upsertRes.crmJob;

            // Create/upsert contact and account idempotently
            let contactId = null;
            let accountId = null;

            // Compute customerName for account/contact creation
            const customerName = crmJob.customerName || 'Unknown Customer';

            // Find or create account (idempotent by externalRef or name)
            let existingAccounts = [];
            if (payload.externalCustomerId) {
                existingAccounts = await base44.asServiceRole.entities.CRMAccount.filter({
                    companyId,
                    externalRef: payload.externalCustomerId
                });
            }
            if (existingAccounts.length === 0 && customerName && customerName !== 'Unknown Customer') {
                existingAccounts = await base44.asServiceRole.entities.CRMAccount.filter({
                    companyId,
                    name: customerName
                });
            }

            let account;
            if (existingAccounts.length > 0) {
                account = existingAccounts[0];
            } else {
                const accountData = {
                    companyId,
                    name: customerName,
                    externalRef: payload.externalCustomerId
                };
                account = await base44.asServiceRole.entities.CRMAccount.create(accountData);
            }
            accountId = account.id;

             // Find or create contact (idempotent by externalCustomerId, email, or phone)
             if (payload.phone || payload.email) {
                 let existingContacts = [];
                 if (payload.externalCustomerId) {
                     existingContacts = await base44.asServiceRole.entities.CRMContact.filter({
                         companyId,
                         accountId: account.id,
                         externalRef: payload.externalCustomerId
                     });
                 }
                 if (existingContacts.length === 0 && payload.email) {
                     existingContacts = await base44.asServiceRole.entities.CRMContact.filter({
                         companyId,
                         accountId: account.id,
                         email: payload.email
                     });
                 }
                 if (existingContacts.length === 0 && payload.phone) {
                     existingContacts = await base44.asServiceRole.entities.CRMContact.filter({
                         companyId,
                         accountId: account.id,
                         phone: payload.phone
                     });
                 }

                 let contact;
                 if (existingContacts.length > 0) {
                     contact = existingContacts[0];
                 } else {
                     const [firstName, ...lastNameParts] = customerName.split(' ');
                     const contactData = {
                         companyId,
                         accountId: account.id,
                         firstName: firstName || 'Unknown',
                         lastName: lastNameParts.join(' ') || '',
                         phone: payload.phone,
                         email: payload.email,
                         externalRef: payload.externalCustomerId,
                         isPrimary: true
                     };
                     contact = await base44.asServiceRole.entities.CRMContact.create(contactData);
                 }
                 contactId = contact.id;
             }

             // Handle service address
             if (payload.serviceAddress) {
                 const addressData = {
                     companyId,
                     accountId: account.id,
                     addressType: 'service',
                     addressLine1: payload.serviceAddress,
                     isPrimary: true
                 };
                 const address = await base44.asServiceRole.entities.CRMAddress.create(addressData);
             }

             // Link contact and account back to CRMJob (only if missing)
             const jobLinkPatch = {};
             if (accountId && !crmJob.accountId) jobLinkPatch.accountId = accountId;
             if (contactId && !crmJob.primaryContactId) jobLinkPatch.primaryContactId = contactId;

             if (Object.keys(jobLinkPatch).length > 0) {
                 await base44.asServiceRole.entities.CRMJob.update(crmJob.id, jobLinkPatch);
                 crmJob = { ...crmJob, ...jobLinkPatch };
             }

            // Emit activity event
            await base44.asServiceRole.entities.CRMActivityEvent.create({
                companyId,
                jobId: crmJob.id,
                type: 'appointment_synced',
                occurredAt: new Date().toISOString(),
                metadata: {
                    externalAppointmentId: payload.externalAppointmentId,
                    action: 'created',
                    appointmentStatus: payload.appointmentStatus
                }
            });
        }

        return Response.json({
            success: true,
            crmJob
        });
    } catch (error) {
        console.error('Appointment ingest failed:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});