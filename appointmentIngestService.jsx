import { base44 } from '@/api/base44Client';
import { emitCRMActivityEvent } from './crmService';

/**
 * Appointment Ingest Service - Syncs Builder Prime appointments to FenceBuddy CRM
 */

/**
 * Ingest Builder Prime appointment
 */
export async function ingestBuilderPrimeAppointment({ 
    companyId,
    externalAppointmentId,
    externalCustomerId,
    customerName,
    phone,
    email,
    serviceAddress,
    appointmentDateTime,
    assignedSalesRep,
    leadSource,
    appointmentStatus = 'scheduled',
    notes
}) {
    if (!externalAppointmentId) {
        throw new Error('externalAppointmentId is required');
    }

    // Check if CRMJob exists
    const existingJobs = await base44.entities.CRMJob.filter({
        companyId,
        externalCRM: 'builder_prime',
        externalAppointmentId
    });

    let crmJob;

    if (existingJobs.length > 0) {
        // Update existing job
        crmJob = existingJobs[0];
        
        const updates = {
            appointmentDateTime,
            appointmentStatus,
            assignedRepUserId: assignedSalesRep
        };

        // Handle status changes
        if (appointmentStatus === 'cancelled') {
            updates.stage = 'cancelled';
            updates.lossType = 'demo_no_sale';
        }

        if (notes) {
            updates.notes = notes;
        }

        crmJob = await base44.entities.CRMJob.update(crmJob.id, updates);

        // Emit activity event
        await emitCRMActivityEvent({
            companyId,
            jobId: crmJob.id,
            type: 'appointment_synced',
            actorUserId: null,
            metadata: {
                externalAppointmentId,
                action: 'updated',
                appointmentStatus
            }
        });
    } else {
        // Create new CRMJob
        const jobNumber = `BP-${externalAppointmentId}`;
        
        crmJob = await base44.entities.CRMJob.create({
            companyId,
            jobNumber,
            externalCRM: 'builder_prime',
            externalAppointmentId,
            externalCustomerId,
            appointmentDateTime,
            appointmentStatus,
            createdFrom: 'appointment_sync',
            stage: 'appointment_scheduled',
            saleStatus: 'unsold',
            contractStatus: 'unsigned',
            lossType: 'na',
            paymentStatus: 'na',
            installStatus: 'na',
            assignedRepUserId: assignedSalesRep,
            source: leadSource || 'other'
        });

        // Create contact and account if needed
        if (customerName || phone || email) {
            const accountData = {
                companyId,
                name: customerName || 'Unknown Customer',
                externalRef: externalCustomerId
            };
            
            const account = await base44.entities.CRMAccount.create(accountData);
            
            if (phone || email) {
                const contactData = {
                    companyId,
                    accountId: account.id,
                    firstName: customerName?.split(' ')[0] || 'Unknown',
                    lastName: customerName?.split(' ').slice(1).join(' ') || '',
                    phone,
                    email,
                    isPrimary: true
                };
                
                await base44.entities.CRMContact.create(contactData);
            }
            
            if (serviceAddress) {
                const addressData = {
                    companyId,
                    accountId: account.id,
                    addressType: 'service',
                    addressLine1: serviceAddress,
                    isPrimary: true
                };
                
                const address = await base44.entities.CRMAddress.create(addressData);
                
                await base44.entities.CRMJob.update(crmJob.id, {
                    accountId: account.id,
                    jobsiteAddressId: address.id
                });
            }
        }

        // Emit activity event
        await emitCRMActivityEvent({
            companyId,
            jobId: crmJob.id,
            type: 'appointment_synced',
            actorUserId: null,
            metadata: {
                externalAppointmentId,
                action: 'created',
                appointmentStatus
            }
        });
    }

    return crmJob;
}

/**
 * Handle appointment cancellation
 */
export async function cancelBuilderPrimeAppointment({ companyId, externalAppointmentId, reason }) {
    const existingJobs = await base44.entities.CRMJob.filter({
        companyId,
        externalCRM: 'builder_prime',
        externalAppointmentId
    });

    if (existingJobs.length === 0) {
        throw new Error('Appointment not found');
    }

    const crmJob = existingJobs[0];

    await base44.entities.CRMJob.update(crmJob.id, {
        appointmentStatus: 'cancelled',
        stage: 'cancelled',
        lossType: 'demo_no_sale',
        lostReason: 'cancelled',
        lostAt: new Date().toISOString()
    });

    // Emit activity event
    await emitCRMActivityEvent({
        companyId,
        jobId: crmJob.id,
        type: 'appointment_cancelled',
        actorUserId: null,
        metadata: {
            externalAppointmentId,
            reason
        }
    });

    return crmJob;
}