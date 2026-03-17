import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ATOMIC JOB NUMBER ALLOCATOR
 * Race-safe server-side job number generation
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { companyId } = payload;

    if (!companyId) {
      return Response.json({ error: 'companyId is required' }, { status: 400 });
    }

    // Atomic fetch + increment pattern
    const counters = await base44.asServiceRole.entities.CompanyCounter.filter({
      companyId,
      key: 'jobNumber'
    });

    let counter;
    let nextValue;

    if (counters.length === 0) {
      // Initialize counter
      counter = await base44.asServiceRole.entities.CompanyCounter.create({
        companyId,
        key: 'jobNumber',
        value: 1
      });
      nextValue = 1;
    } else {
      counter = counters[0];
      nextValue = (counter.value || 0) + 1;
      
      // Increment atomically
      await base44.asServiceRole.entities.CompanyCounter.update(counter.id, {
        value: nextValue
      });
    }

    // Format job number: J-YYYY-NNNN
    const year = new Date().getFullYear();
    const jobNumber = `J-${year}-${String(nextValue).padStart(4, '0')}`;

    return Response.json({
      success: true,
      jobNumber,
      sequence: nextValue
    });
  } catch (error) {
    console.error('Job number allocation failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});