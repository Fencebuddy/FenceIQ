import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    const { confirmationText } = await req.json();

    if (confirmationText !== 'DELETE') {
      return Response.json({ error: 'Invalid confirmation text' }, { status: 400 });
    }

    // Get company context
    const contextRes = await base44.functions.invoke('getCompanyContext', {});
    if (!contextRes.data?.success) {
      return Response.json({ error: 'Failed to get company context' }, { status: 500 });
    }

    const companyId = contextRes.data.companyId;
    const companyKey = contextRes.data.company?.companyId;

    if (!companyId && !companyKey) {
      return Response.json({ error: 'No company found to delete' }, { status: 400 });
    }

    // Use service role for deletion
    const deleteScope = companyId ? { companyId } : { companyKey };

    // Delete all company-scoped entities in dependency order
    // Child entities first, then parents
    const entitiesToDelete = [
      // Leaf entities (no foreign key dependencies)
      'AutoFixLog', 'CRMActivityEvent', 'CRMTask', 'CRMNote', 'CRMJobStageHistory',
      'CRMExternalLink', 'InstallPhoto', 'ActualLabor', 'ActualMaterialUsage',
      'VarianceSummary', 'ProductBenchmarkDaily', 'PricingAdjustmentSuggestion',
      'DashboardGoalSettings', 'DiagnosticsLog', 'FlowTrace', 'MappingAuditLog',
      'MappingRepairLog', 'IntegrityCheckResult', 'AgentRunLog', 'AlertRecord',
      'SuggestionRecord', 'ReportRunLog', 'UsageEvent',
      
      // Mid-level entities
      'MaterialLine', 'Gate', 'Run', 'SignatureRecord', 'ProposalSnapshot',
      'JobCostSnapshot', 'TakeoffSnapshot', 'PurchaseOrder', 'SupplierSkuMap',
      'CatalogLinkMap', 'CompanySkuMap', 'SupplierMaterialMap', 'CompanyMaterialMapping',
      'CompanyUckAlias', 'InstallSession', 'CrewMember', 'WorkOrder',
      'ReportRollupDaily', 'ReportRollupWeekly', 'BreakevenMonthlyRollup',
      'SaleSnapshot',
      
      // Job-related entities
      'Job', 'CRMJob', 'CRMContact', 'CRMAddress', 'CRMAccount',
      
      // Reference data
      'MaterialRule', 'MaterialCost', 'PriceCatalogLine', 'MaterialCatalog',
      'JurisdictionOverride', 'CountyParcelService', 'CanonicalMaterialRole',
      'MaterialAttributeSchema', 'FenceRoleConfig', 'UnitConversionMap',
      'MapScaleConfig', 'ResolverCacheBuster',
      
      // Company configuration
      'Supplier', 'Crew', 'OverheadLineItem', 'OverheadSettings', 'BreakevenSettings',
      'PricingDefaults', 'CompanyCounter'
    ];

    let deletedCounts = {};
    let errors = [];

    for (const entityName of entitiesToDelete) {
      try {
        const records = await base44.asServiceRole.entities[entityName].filter(deleteScope);
        if (records.length > 0) {
          for (const record of records) {
            try {
              await base44.asServiceRole.entities[entityName].delete(record.id);
            } catch (deleteErr) {
              console.error(`Failed to delete ${entityName} record ${record.id}:`, deleteErr.message);
              errors.push(`${entityName}:${record.id} - ${deleteErr.message}`);
            }
          }
          deletedCounts[entityName] = records.length;
        }
      } catch (err) {
        console.error(`Failed to query ${entityName}:`, err.message);
        errors.push(`${entityName} query failed - ${err.message}`);
      }
    }

    // Delete CompanySettings last
    try {
      const companySettings = await base44.asServiceRole.entities.CompanySettings.filter(deleteScope);
      if (companySettings.length > 0) {
        for (const setting of companySettings) {
          await base44.asServiceRole.entities.CompanySettings.delete(setting.id);
        }
        deletedCounts.CompanySettings = companySettings.length;
      }
    } catch (err) {
      console.error('Failed to delete CompanySettings:', err.message);
      errors.push(`CompanySettings - ${err.message}`);
    }

    // Delete all company users (except the current admin executing the deletion)
    let usersDeleted = 0;
    let userDeletionErrors = [];
    
    try {
      const allUsers = await base44.asServiceRole.entities.User.list();
      const companyUsers = allUsers.filter(u => {
        if (companyId) return u.companyId === companyId;
        if (companyKey) return u.companyKey === companyKey;
        return false;
      });

      for (const companyUser of companyUsers) {
        // Skip current user - they will be logged out but not deleted until after response
        if (companyUser.id === user.id) continue;
        
        try {
          await base44.asServiceRole.entities.User.delete(companyUser.id);
          usersDeleted++;
        } catch (userDelErr) {
          console.error(`Failed to delete user ${companyUser.id}:`, userDelErr.message);
          userDeletionErrors.push(`User ${companyUser.email} - ${userDelErr.message}`);
        }
      }

      if (usersDeleted > 0) {
        deletedCounts.User = usersDeleted;
      }
    } catch (err) {
      console.error('Failed to query users:', err.message);
      userDeletionErrors.push(`User query failed - ${err.message}`);
    }

    // Combine all errors
    const allErrors = [...errors, ...userDeletionErrors];

    return Response.json({
      success: true,
      message: 'Company data deleted successfully',
      deletedCounts,
      errors: allErrors.length > 0 ? allErrors : undefined,
      warnings: [
        `Deleted ${usersDeleted} team member(s)`,
        'Current user session will be invalidated - logging out in 3 seconds'
      ]
    });

  } catch (error) {
    console.error('Delete company error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});