import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Initialize OverheadSettings for a company based on CompanySettings
 * Calculates monthly/annual overhead from configured rates
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch primary company settings
    const companySettingsArr = await base44.entities.CompanySettings.filter({ isPrimary: true }, undefined, 1);
    if (!companySettingsArr || companySettingsArr.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'No primary company found',
        message: 'Please configure CompanySettings first.'
      }, { status: 400 });
    }

    const company = companySettingsArr[0];
    const companyId = company.id;
    const crmCompanyId = company.companyId;

    // Check if OverheadSettings already exists
    let existing = null;
    try {
      const arr = await base44.entities.OverheadSettings.filter({ companyId });
      existing = arr && arr.length > 0 ? arr[0] : null;
    } catch (e) {
      console.warn('[initializeOverheadSettings] Check for existing failed:', e.message);
    }

    // Use sensible defaults
    // Assume: $120k annual overhead / 12 months = $10k/month
    // This is a starting point; admin should adjust via OverheadIntelligence UI
    const defaultAnnualOverheadCents = 12000000; // $120,000
    const defaultMonthlyOverheadCents = 1000000; // $10,000
    const projectedAnnualRevenue = 500000; // $500k baseline

    let result;
    if (existing) {
      // Update existing with monthly/annual if missing
      const monthlyOverheadCents = existing.monthlyOverheadCents || defaultMonthlyOverheadCents;
      const annualOverheadCents = existing.annualOverheadCents || defaultAnnualOverheadCents;
      
      await base44.entities.OverheadSettings.update(existing.id, {
        monthlyOverheadCents,
        annualOverheadCents,
        lastComputedAt: new Date().toISOString()
      });
      
      result = {
        success: true,
        action: 'updated',
        companyId,
        crmCompanyId,
        message: 'OverheadSettings updated with overhead amounts',
        overhead: {
          monthlyOverheadCents,
          annualOverheadCents,
          monthlyUSD: monthlyOverheadCents / 100,
          annualUSD: annualOverheadCents / 100
        }
      };
    } else {
      // Create new OverheadSettings
      const newSettings = await base44.entities.OverheadSettings.create({
        companyId,
        projectedAnnualRevenue,
        monthlyOverheadCents: defaultMonthlyOverheadCents,
        annualOverheadCents: defaultAnnualOverheadCents,
        lastComputedAt: new Date().toISOString()
      });
      
      result = {
        success: true,
        action: 'created',
        companyId,
        crmCompanyId,
        id: newSettings.id,
        message: 'OverheadSettings initialized with default overhead amounts',
        overhead: {
          monthlyOverheadCents: defaultMonthlyOverheadCents,
          annualOverheadCents: defaultAnnualOverheadCents,
          monthlyUSD: defaultMonthlyOverheadCents / 100,
          annualUSD: defaultAnnualOverheadCents / 100
        },
        note: 'Adjust these amounts in Overhead Intelligence page based on your actual expenses'
      };
    }

    return Response.json(result);
  } catch (error) {
    console.error('[initializeOverheadSettings] Error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});