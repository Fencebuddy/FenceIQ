import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const receivedAt = new Date().toISOString();

  // ── METHOD GUARD ─────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // ── CAPTURE RAW HEADERS ──────────────────────────────────────────────
  const rawHeaders = {};
  req.headers.forEach((v, k) => { rawHeaders[k] = v; });

  // ── PARSE BODY ────────────────────────────────────────────────────────
  let body = {};
  let parseError = null;
  try {
    body = await req.json();
  } catch (e) {
    parseError = e.message;
  }

  // ── AUTH CHECK ────────────────────────────────────────────────────────
  const expectedSecret = Deno.env.get('BUILDER_PRIME_WEBHOOK_SECRET');
  const apiKey = rawHeaders['x-api-key'] || body?.['x-api-key'] || body?.api_key || null;
  const authPassed = !!(expectedSecret && apiKey === expectedSecret);

  // Strip meta-fields BP injects into the body
  delete body['x-api-key'];
  delete body['Content-Type'];

  // ── GENERATE EVENT ID ────────────────────────────────────────────────
  const opportunityId = body?.opportunityId ? String(body.opportunityId) : null;
  const clientId = body?.clientId ? String(body.clientId) : null;
  const externalEventId = opportunityId || clientId || `unknown-${Date.now()}`;

  // ── LOG RAW EVENT IMMEDIATELY (log-first pattern) ─────────────────────
  let logEntry = null;
  try {
    const existingLog = await base44.asServiceRole.entities.WebhookEventLog.filter({ externalEventId });
    if (existingLog.length > 0) {
      return Response.json({
        status: 'duplicate',
        skipped: true,
        externalEventId,
        logId: existingLog[0].id,
      }, { status: 200 });
    }

    logEntry = await base44.asServiceRole.entities.WebhookEventLog.create({
      externalEventId,
      source: 'builderprime',
      eventType: body?.type || 'bp_client',
      payload: { headers: rawHeaders, body, authPassed, parseError },
      status: 'received',
      retryCount: 0,
    });
  } catch (logErr) {
    return Response.json({ error: 'Failed to create log entry', detail: logErr.message }, { status: 500 });
  }

  // Helper to fail the log and return a response
  const failLog = async (msg, status) => {
    await base44.asServiceRole.entities.WebhookEventLog.update(logEntry.id, {
      status: 'failed',
      errorMessage: msg,
    });
    return Response.json({ error: msg, logId: logEntry.id }, { status });
  };

  // ── AUTH FAILURE ──────────────────────────────────────────────────────
  if (!authPassed) {
    return failLog(`Auth failed. key received: "${apiKey}", secret ${expectedSecret ? 'is set' : 'NOT SET'}`, 401);
  }

  // ── PARSE ERROR ───────────────────────────────────────────────────────
  if (parseError) {
    return failLog(`JSON parse error: ${parseError}`, 400);
  }

  // ── TYPE FILTER: only process type === "client" ───────────────────────
  if (body.type !== 'client') {
    return failLog(`Ignored: body.type="${body.type}" (expected "client")`, 200);
  }

  // ── STATUS FILTER: only process leadStatus === "Lead Issued" ─────────
  if (body.leadStatus !== 'Lead Issued') {
    return failLog(`Ignored: body.leadStatus="${body.leadStatus}" (expected "Lead Issued")`, 200);
  }

  // ── MAP FIELDS ────────────────────────────────────────────────────────
  const firstName = (body.clientFirstName || '').trim();
  const lastName = (body.clientLastName || '').trim();
  const customerName = [firstName, lastName].filter(Boolean).join(' ') || null;
  const phone = body.mobilePhoneNumber || body.homePhoneNumber || body.officePhoneNumber || null;

  const mapped = {
    customerName,
    customerEmail: body.email || null,
    customerPhone: phone,
    addressLine1: body.addressLine1 || null,
    addressLine2: body.addressLine2 || null,
    city: body.city || null,
    state: body.state || null,
    postalCode: body.postalCode || null,
    leadSource: body.leadSource || null,
    salesRepName: body.salesPerson || null,
    leadSetterName: body.leadSetter || null,
    externalOpportunityId: opportunityId,
    externalCustomerId: clientId,
    rawPayload: body,
    webhookReceivedAt: receivedAt,
    source: 'builderprime',
    externalCRM: 'builderprime',
  };

  // ── VALIDATION ────────────────────────────────────────────────────────
  if (!opportunityId || !customerName) {
    return failLog(`Missing required fields: opportunityId=${opportunityId}, customerName=${customerName}`, 400);
  }

  // ── COMPANY ID ────────────────────────────────────────────────────────
  const companyId = Deno.env.get('DEFAULT_COMPANY_ID');
  if (!companyId) {
    return failLog('Server misconfiguration: DEFAULT_COMPANY_ID not set', 500);
  }

  // ── CREATE OR UPDATE CRMJob ───────────────────────────────────────────
  let crmJobAction = null;
  let crmJobId = null;

  try {
    const existingJobs = await base44.asServiceRole.entities.CRMJob.filter({ externalOpportunityId: opportunityId });

    if (existingJobs.length === 0) {
      // Allocate job number
      let jobNumber = `BP-${opportunityId}`;
      try {
        const res = await base44.asServiceRole.functions.invoke('jobs/allocateJobNumber', { companyId });
        if (res?.jobNumber) jobNumber = res.jobNumber;
      } catch { /* fall back */ }

      const newJob = await base44.asServiceRole.entities.CRMJob.create({
        ...mapped,
        companyId,
        jobNumber,
        externalLeadId: clientId || opportunityId,
        stage: body.upcomingMeetingStartDateTime ? 'appointment_scheduled' : 'new',
        createdFrom: 'bp_lead_sync',
        notes: body.notes || null,
        ...(body.upcomingMeetingStartDateTime ? {
          appointmentDateTime: body.upcomingMeetingStartDateTime,
          appointmentStatus: 'scheduled',
        } : {}),
      });
      crmJobAction = 'created';
      crmJobId = newJob.id;
    } else {
      const existing = existingJobs[0];
      // Always update contact/address/source fields with latest values
      const patch = {
        rawPayload: body,
        webhookReceivedAt: receivedAt,
      };
      if (mapped.customerName) patch.customerName = mapped.customerName;
      if (mapped.customerEmail) patch.customerEmail = mapped.customerEmail;
      if (mapped.customerPhone) patch.customerPhone = mapped.customerPhone;
      if (mapped.addressLine1) patch.addressLine1 = mapped.addressLine1;
      if (mapped.addressLine2) patch.addressLine2 = mapped.addressLine2;
      if (mapped.city) patch.city = mapped.city;
      if (mapped.state) patch.state = mapped.state;
      if (mapped.postalCode) patch.postalCode = mapped.postalCode;
      if (mapped.leadSource) patch.leadSource = mapped.leadSource;
      if (mapped.salesRepName) patch.salesRepName = mapped.salesRepName;
      if (mapped.leadSetterName) patch.leadSetterName = mapped.leadSetterName;

      await base44.asServiceRole.entities.CRMJob.update(existing.id, patch);
      crmJobAction = 'updated';
      crmJobId = existing.id;
    }

    // ── MARK PROCESSED ────────────────────────────────────────────────
    await base44.asServiceRole.entities.WebhookEventLog.update(logEntry.id, {
      status: 'processed',
      processedAt: new Date().toISOString(),
      errorMessage: null,
    });

    return Response.json({
      status: 'ok',
      crmJobAction,
      crmJobId,
      logId: logEntry.id,
      externalOpportunityId: opportunityId,
      customerName,
    }, { status: 200 });

  } catch (error) {
    await base44.asServiceRole.entities.WebhookEventLog.update(logEntry.id, {
      status: 'failed',
      errorMessage: error.message,
    });
    return Response.json({ error: 'Processing failed', detail: error.message, logId: logEntry.id }, { status: 500 });
  }
});