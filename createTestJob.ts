import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Create test job
    const job = await base44.entities.Job.create({
      companyId: 'default-company',
      jobNumber: 'TEST-001',
      customerName: 'Test Customer',
      customerPhone: '555-0001',
      addressLine1: '123 Test St',
      city: 'Testville',
      state: 'MI',
      zip: '48000',
      materialType: 'Vinyl',
      fenceHeight: '6\'',
      style: 'Privacy',
      status: 'Draft'
    });

    // Create 2 runs
    const runs = await Promise.all([
      base44.entities.Run.create({
        jobId: job.id,
        runLabel: 'Front',
        lengthLF: 100,
        materialType: 'Vinyl',
        fenceHeight: '6\'',
        style: 'Privacy'
      }),
      base44.entities.Run.create({
        jobId: job.id,
        runLabel: 'Back',
        lengthLF: 150,
        materialType: 'Vinyl',
        fenceHeight: '6\'',
        style: 'Privacy'
      })
    ]);

    // Create 1 gate
    const gate = await base44.entities.Gate.create({
      jobId: job.id,
      runId: runs[0].id,
      gateType: 'Single',
      gateWidth_ft: 4,
      placement: 'In-line'
    });

    return Response.json({
      status: 'SUCCESS',
      jobId: job.id,
      jobNumber: job.jobNumber,
      runs: runs.length,
      gates: 1,
      totalLF: 250
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});