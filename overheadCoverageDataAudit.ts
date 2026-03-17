import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * OVERHEAD COVERAGE DATA AUDIT
 * Investigates why overhead coverage shows 0%
 * Checks what pricing data exists on sold jobs
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get company context
    const companies = await base44.entities.CompanySettings.list();
    if (companies.length === 0) {
      return Response.json({ error: 'No company found' }, { status: 404 });
    }
    
    const companyEntityId = companies[0].id;
    
    // Get all CRM jobs
    const allJobs = await base44.entities.CRMJob.filter({ companyId: companyEntityId });
    
    // Determine sold status for each job
    const isSold = (job) => {
      return job.contractStatus === 'signed' || 
             ['signed', 'production', 'installed'].includes(job.stage) ||
             job.saleStatus === 'sold';
    };
    
    const soldJobs = allJobs.filter(isSold);
    
    // Analyze what data exists
    const analysis = soldJobs.map(job => ({
      jobNumber: job.jobNumber,
      saleStatus: job.saleStatus,
      contractStatus: job.contractStatus,
      stage: job.stage,
      paymentStatus: job.paymentStatus,
      installStatus: job.installStatus,
      
      // Pricing data availability
      hasRecognizedOverheadCents: !!(job.recognizedOverheadCents && job.recognizedOverheadCents > 0),
      recognizedOverheadCents: job.recognizedOverheadCents || 0,
      
      hasContractValueCents: !!(job.contractValueCents && job.contractValueCents > 0),
      contractValueCents: job.contractValueCents || 0,
      priceSource: job.priceSource || 'unknown',
      
      hasRecognizedRevenueCents: !!(job.recognizedRevenueCents && job.recognizedRevenueCents > 0),
      recognizedRevenueCents: job.recognizedRevenueCents || 0,
      
      hasExternalJobId: !!job.externalJobId,
      externalJobId: job.externalJobId || null,
      
      hasProposalSnapshot: !!job.currentProposalSnapshotId,
      currentProposalSnapshotId: job.currentProposalSnapshotId || null,
      
      hasPricingSnapshot: !!job.currentPricingSnapshotId,
      currentPricingSnapshotId: job.currentPricingSnapshotId || null,
      
      wonAt: job.wonAt,
      saleStatusUpdatedAt: job.saleStatusUpdatedAt,
      created_date: job.created_date
    }));
    
    // Count issues
    const summary = {
      totalSoldJobs: soldJobs.length,
      jobsWithRecognizedOverhead: analysis.filter(j => j.hasRecognizedOverheadCents).length,
      jobsWithContractValue: analysis.filter(j => j.hasContractValueCents).length,
      jobsWithRecognizedRevenue: analysis.filter(j => j.hasRecognizedRevenueCents).length,
      jobsWithExternalJobId: analysis.filter(j => j.hasExternalJobId).length,
      jobsWithProposalSnapshot: analysis.filter(j => j.hasProposalSnapshot).length,
      jobsWithPricingSnapshot: analysis.filter(j => j.hasPricingSnapshot).length,
      jobsWithNoPricingData: analysis.filter(j => 
        !j.hasRecognizedOverheadCents && 
        !j.hasContractValueCents && 
        !j.hasRecognizedRevenueCents &&
        !j.hasExternalJobId
      ).length
    };
    
    return Response.json({
      success: true,
      summary,
      soldJobsDetails: analysis,
      recommendation: summary.jobsWithNoPricingData > 0 
        ? `${summary.jobsWithNoPricingData} sold jobs have NO pricing data. Need to backfill contractValueCents from proposals/pricing snapshots.`
        : 'All sold jobs have pricing data available.'
    });
    
  } catch (error) {
    console.error('Audit failed:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});