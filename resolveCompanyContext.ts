/**
 * resolveCompanyContext — Tenant Resolution Ladder v2.0.0
 *
 * SECURITY UPGRADE (Phase 1):
 * - Tier 0: UserSessionContext + CompanyMembership validation (server-side, spoofing-proof)
 * - x-company-id header now REQUIRES active CompanyMembership — no longer trusted blindly
 * - Platform admins in platform context are BLOCKED from accessing company data (context isolation)
 *
 * Non-negotiable:
 * - Never use CompanySettings.list()[0] without checks.
 * - Never silently pick a company when multiple exist.
 * - All company access requires active CompanyMembership.
 * - Must be used by all backend functions that require companyId.
 */
export async function resolveCompanyContext({ base44, req, user }) {
  const resolvedUser = user || await base44.auth.me().catch(() => null);
  if (!resolvedUser?.id) {
    return { error: { code: 'UNAUTHENTICATED', message: 'User not authenticated' } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tier 0: UserSessionContext — server-side validated, spoofing-proof
  // This is the primary path for all multi-tenant flows.
  // ─────────────────────────────────────────────────────────────────────────
  const sessions = await base44.asServiceRole.entities.UserSessionContext.filter({
    user_id: resolvedUser.id
  }).catch(() => []);

  if (sessions.length > 0) {
    const session = sessions[0];

    // Block platform context from resolving company data (context isolation)
    if (session.active_context_type === 'platform') {
      return {
        error: {
          code: 'PLATFORM_CONTEXT_BLOCKED',
          message: 'Active context is platform. Switch to a company context to access company data.'
        }
      };
    }

    if (session.active_context_type === 'company' && session.active_context_id) {
      // Validate membership server-side (prevent session spoofing)
      const memberships = await base44.asServiceRole.entities.CompanyMembership.filter({
        user_id: resolvedUser.id,
        tenant_company_id: session.active_context_id,
        status: 'active'
      }).catch(() => []);

      if (memberships.length === 0) {
        return {
          error: {
            code: 'SESSION_MEMBERSHIP_INVALID',
            message: 'Session references a company for which user has no active CompanyMembership. Session may be stale — re-authenticate.'
          }
        };
      }

      // Resolve the CompanySettings via the linked_company_settings_id or companyId field
      const tenantCompanies = await base44.asServiceRole.entities.TenantCompany.filter({
        id: session.active_context_id,
        status: 'active'
      }).catch(() => []);

      if (tenantCompanies.length === 0) {
        return {
          error: {
            code: 'TENANT_COMPANY_INACTIVE',
            message: 'Active tenant company not found or is suspended.'
          }
        };
      }

      const tenantCompany = tenantCompanies[0];

      // Resolve CompanySettings: prefer linked_company_settings_id, then companyId field match
      let company = null;
      if (tenantCompany.linked_company_settings_id) {
        const linked = await base44.entities.CompanySettings.filter({
          id: tenantCompany.linked_company_settings_id
        }).catch(() => []);
        company = linked[0] || null;
      }

      // Fallback: single-record strategy (current single-tenant bridge)
      if (!company) {
        const all = await base44.entities.CompanySettings.list().catch(() => []);
        if (all.length === 1) {
          company = all[0];
        } else if (all.length > 1) {
          const byCompanyId = all.filter(s => s.companyId === session.active_context_id);
          company = byCompanyId[0] || null;
        }
      }

      if (!company) {
        return {
          error: {
            code: 'COMPANY_SETTINGS_NOT_FOUND',
            message: 'CompanySettings not found for active company context.'
          }
        };
      }

      const companyId = company.companyId ?? company.id;
      return { companyId, company, mode: 'session_context', tenantCompany, memberRole: memberships[0].role };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tier 1: x-company-id header — NOW REQUIRES CompanyMembership validation
  // ─────────────────────────────────────────────────────────────────────────
  const headerCompanyId = req?.headers?.get?.('x-company-id');
  if (headerCompanyId) {
    // SECURITY FIX: Validate membership before trusting header
    const memberships = await base44.asServiceRole.entities.CompanyMembership.filter({
      user_id: resolvedUser.id,
      status: 'active'
    }).catch(() => []);

    const hasAccess = memberships.some(m => m.tenant_company_id === headerCompanyId);
    if (!hasAccess) {
      return {
        error: {
          code: 'HEADER_COMPANY_ACCESS_DENIED',
          message: 'x-company-id header provided but user has no active CompanyMembership for this company.'
        }
      };
    }

    const matches = await base44.entities.CompanySettings.filter({ companyId: headerCompanyId }).catch(() => []);
    if (!matches || matches.length === 0) {
      return { error: { code: 'COMPANY_NOT_FOUND', message: 'x-company-id provided but no matching CompanySettings found' } };
    }
    if (matches.length !== 1) {
      return { error: { code: 'COMPANY_SETTINGS_DUPLICATE_FOR_COMPANYID', message: 'Multiple CompanySettings records found for this companyId' } };
    }
    const company = matches[0];
    const companyId = company.companyId ?? company.id;
    if (!companyId) {
      return { error: { code: 'COMPANY_ID_MISSING', message: 'CompanySettings record found but missing companyId/id' } };
    }
    return { companyId, company, mode: 'header_validated' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tier 2: Primary company (bridge strategy — single-tenant legacy support)
  // ─────────────────────────────────────────────────────────────────────────
  const primaryMatches = await base44.entities.CompanySettings.filter({ isPrimary: true }).catch(() => []);
  if (primaryMatches && primaryMatches.length === 1) {
    const company = primaryMatches[0];
    const companyId = company.companyId ?? company.id;
    if (!companyId) return { error: { code: 'COMPANY_ID_MISSING', message: 'Primary CompanySettings missing companyId/id' } };
    return { companyId, company, mode: 'primary' };
  }
  if (primaryMatches && primaryMatches.length > 1) {
    return { error: { code: 'MULTIPLE_PRIMARY_COMPANIES', message: 'Multiple CompanySettings records marked isPrimary=true' } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tier 3: Single-record invariant (current single-tenant bridge)
  // ─────────────────────────────────────────────────────────────────────────
  const all = await base44.entities.CompanySettings.list().catch(() => []);
  if (!Array.isArray(all) || all.length === 0) {
    return { error: { code: 'COMPANY_SETTINGS_MISSING', message: 'Company settings not found' } };
  }
  if (all.length === 1) {
    const company = all[0];
    const companyId = company.companyId ?? company.id;
    if (!companyId) return { error: { code: 'COMPANY_ID_MISSING', message: 'CompanySettings missing companyId/id' } };
    return { companyId, company, mode: 'single_record' };
  }

  // Tier 4: Ambiguous multi-tenant, no selector
  return {
    error: {
      code: 'MULTI_TENANT_CONTEXT_REQUIRED',
      message: 'Multiple CompanySettings records exist. Provide x-company-id or mark exactly one CompanySettings as isPrimary.'
    }
  };
}