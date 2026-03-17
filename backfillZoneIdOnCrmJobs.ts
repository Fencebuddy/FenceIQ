import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { companyId } = body;
  if (!companyId) return Response.json({ error: 'companyId required' }, { status: 400 });

  const zones = await base44.asServiceRole.entities.NeighborhoodZone.filter({ companyId, active: true });
  const addresses = await base44.asServiceRole.entities.CRMAddress.filter({ companyId });
  const jobs = await base44.asServiceRole.entities.CRMJob.filter({ companyId });

  // Build zip→zone map
  const zipToZone = {};
  for (const zone of zones) {
    for (const zip of (zone.zipCodes || [])) {
      zipToZone[zip.trim()] = zone.id;
    }
  }

  // Build addressId→zip map
  const addrToZip = {};
  for (const addr of addresses) {
    if (addr.zip) addrToZip[addr.id] = addr.zip.trim();
  }

  let assigned = 0;
  let skipped = 0;

  for (const job of jobs) {
    if (job.zoneId) { skipped++; continue; } // already assigned

    const zip = job.jobsiteAddressId ? addrToZip[job.jobsiteAddressId] : null;
    if (!zip) { skipped++; continue; }

    const zoneId = zipToZone[zip];
    if (!zoneId) { skipped++; continue; }

    await base44.asServiceRole.entities.CRMJob.update(job.id, { zoneId });
    assigned++;
  }

  return Response.json({ success: true, assigned, skipped, totalJobs: jobs.length });
});