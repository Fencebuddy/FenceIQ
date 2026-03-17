import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    
    if (event.type !== 'create') return Response.json({ success: true });
    
    const newSignature = data;
    const jobId = newSignature.jobId;
    
    // Get all signatures for this job in last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const recentSignatures = await base44.asServiceRole.entities.SignatureRecord.filter({ 
      jobId,
      created_date: { $gte: twoMinutesAgo }
    });
    
    if (recentSignatures.length > 1) {
      console.error(`[Double Sign Detection] ALERT: ${recentSignatures.length} signatures within 2 minutes for job ${jobId}`);
      
      // Create critical alert
      await base44.asServiceRole.entities.AlertRecord.create({
        alertType: 'DOUBLE_SIGN_DETECTED',
        severity: 'CRITICAL',
        title: `Double Sign Detected - Job ${jobId}`,
        description: `${recentSignatures.length} signatures created within 2 minutes`,
        detailsJson: {
          jobId,
          signatures: recentSignatures.map(s => ({
            id: s.id,
            signedAt: s.signedAt,
            customerName: s.customerSignatureName
          }))
        },
        status: 'active'
      });
    }
    
    return Response.json({ 
      success: true,
      doubleSignDetected: recentSignatures.length > 1,
      signatureCount: recentSignatures.length
    });
    
  } catch (error) {
    console.error('[Double Sign Detection] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});