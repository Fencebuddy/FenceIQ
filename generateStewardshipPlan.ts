import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { customerProfileId } = await req.json();
  if (!customerProfileId) return Response.json({ error: 'customerProfileId required' }, { status: 400 });

  // Load company for tenant guard
  const companies = await base44.entities.CompanySettings.list();
  const companyId = companies[0]?.companyId;
  if (!companyId) return Response.json({ error: 'Company not configured' }, { status: 400 });

  // Load profile + enforce companyId scope
  const profiles = await base44.asServiceRole.entities.CustomerProfile.filter({ id: customerProfileId, companyId });
  const profile = profiles[0];
  if (!profile) return Response.json({ error: 'CustomerProfile not found or access denied' }, { status: 404 });

  // Load existing touchpoints to avoid duplicate plan
  const existing = await base44.asServiceRole.entities.StewardshipTouchpoint.filter({ customerProfileId, companyId });
  if (existing.length > 0) {
    return Response.json({ error: 'Plan already exists. Delete existing touchpoints first to regenerate.' }, { status: 409 });
  }

  // Load relationship facts
  const facts = await base44.asServiceRole.entities.RelationshipFacts.filter({ customerProfileId, companyId });
  const getFact = (type) => facts.find(f => f.factType === type);

  const today = new Date();
  const addDays = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  const touchpoints = [];

  // Core 6-month schedule
  touchpoints.push({ type: 'THANK_YOU',     channel: 'email', scheduledAt: addDays(1),  status: 'scheduled' });
  touchpoints.push({ type: 'REVIEW_REQUEST', channel: 'email', scheduledAt: addDays(7),  status: 'scheduled' });
  touchpoints.push({ type: 'REFERRAL_ASK',  channel: 'email', scheduledAt: addDays(14), status: 'scheduled' });
  touchpoints.push({ type: 'CHECK_IN',      channel: 'email', scheduledAt: addDays(90), status: 'scheduled' });

  // Warranty reminder (30 days before warranty end)
  const warrantyFact = getFact('FENCE_WARRANTY_END');
  if (warrantyFact?.dateValue) {
    const warrantyEnd = new Date(warrantyFact.dateValue);
    const reminderDate = new Date(warrantyEnd);
    reminderDate.setDate(reminderDate.getDate() - 30);
    if (reminderDate > today) {
      touchpoints.push({
        type: 'WARRANTY_REMINDER',
        channel: 'email',
        scheduledAt: reminderDate.toISOString(),
        status: 'scheduled',
        payload: { warrantyEndDate: warrantyFact.dateValue }
      });
    }
  }

  // Birthday (next occurrence within 180 days)
  const birthdayFact = getFact('BIRTHDAY');
  if (birthdayFact?.dateValue) {
    const bday = new Date(birthdayFact.dateValue);
    let next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    if (next <= today) next.setFullYear(today.getFullYear() + 1);
    const limit = new Date(today); limit.setDate(limit.getDate() + 180);
    if (next <= limit) {
      touchpoints.push({ type: 'BIRTHDAY', channel: 'email', scheduledAt: next.toISOString(), status: 'scheduled' });
    }
  }

  // Install anniversary (next occurrence within 180 days)
  const installFact = getFact('FENCE_INSTALL_DATE');
  if (installFact?.dateValue) {
    const install = new Date(installFact.dateValue);
    let next = new Date(today.getFullYear(), install.getMonth(), install.getDate());
    if (next <= today) next.setFullYear(today.getFullYear() + 1);
    const limit = new Date(today); limit.setDate(limit.getDate() + 180);
    if (next <= limit) {
      const yearsAgo = today.getFullYear() - install.getFullYear();
      touchpoints.push({
        type: 'ANNIVERSARY',
        channel: 'email',
        scheduledAt: next.toISOString(),
        status: 'scheduled',
        payload: { yearsAgo }
      });
    }
  }

  // Create all touchpoints
  const created = [];
  for (const tp of touchpoints) {
    const result = await base44.asServiceRole.entities.StewardshipTouchpoint.create({
      companyId,
      customerProfileId,
      ...tp
    });
    created.push(result);
  }

  return Response.json({ success: true, created: created.length, touchpoints: created });
});