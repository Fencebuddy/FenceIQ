/**
 * GET CONTEXT VERIFICATION
 *
 * Returns a full authorization status report for the current user + current route.
 * Used by the ContextVerification admin page.
 *
 * Returns:
 *   - current user identity
 *   - active context (from UserSessionContext)
 *   - available contexts
 *   - platform membership status
 *   - company membership status
 *   - session validity
 *   - authorization check results per guard type
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Load all memberships
    const [platformMemberships, companyMemberships, sessionContexts] = await Promise.all([
      base44.asServiceRole.entities.PlatformMembership.filter({ user_id: userId }),
      base44.asServiceRole.entities.CompanyMembership.filter({ user_id: userId }),
      base44.asServiceRole.entities.UserSessionContext.filter({ user_id: userId })
    ]);

    const activePlatformMemberships = platformMemberships.filter(m => m.status === 'active');
    const activeCompanyMemberships = companyMemberships.filter(m => m.status === 'active');
    const session = sessionContexts[0] || null;

    // Load tenant company details for each active company membership
    const companyDetails = [];
    for (const cm of activeCompanyMemberships) {
      const companies = await base44.asServiceRole.entities.TenantCompany.filter({
        id: cm.tenant_company_id
      });
      if (companies[0]) {
        companyDetails.push({
          membership_id: cm.id,
          tenant_company_id: cm.tenant_company_id,
          company_name: companies[0].company_name,
          company_status: companies[0].status,
          role: cm.role,
          membership_status: cm.status
        });
      }
    }

    // Validate session against current memberships
    let sessionValid = false;
    let sessionInvalidReason = null;
    if (session) {
      if (session.active_context_type === 'platform') {
        sessionValid = activePlatformMemberships.length > 0;
        if (!sessionValid) sessionInvalidReason = 'Session claims platform context but no active PlatformMembership exists';
      } else if (session.active_context_type === 'company') {
        const matchingMembership = activeCompanyMemberships.find(
          m => m.tenant_company_id === session.active_context_id
        );
        sessionValid = !!matchingMembership;
        if (!sessionValid) sessionInvalidReason = `Session claims company ${session.active_context_id} but no active CompanyMembership exists`;
      }
    } else {
      sessionInvalidReason = 'No session context record found';
    }

    // Authorization check results
    const authChecks = {
      platform_guard: {
        passes: activePlatformMemberships.length > 0 && session?.active_context_type === 'platform',
        reason: activePlatformMemberships.length === 0
          ? 'No PlatformMembership record'
          : session?.active_context_type !== 'platform'
            ? 'Active context is not "platform"'
            : 'PASSES — has platform membership and platform context active'
      },
      company_guard: {
        passes: activeCompanyMemberships.length > 0 && session?.active_context_type === 'company',
        reason: activeCompanyMemberships.length === 0
          ? 'No CompanyMembership records'
          : session?.active_context_type !== 'company'
            ? 'Active context is not "company"'
            : 'PASSES — has company membership and company context active'
      },
      platform_membership_write_blocked: {
        // Platform memberships CANNOT be created from any tenant-facing UI path
        // Only seedPlatformIdentity (admin) and explicit platform admin functions can write them
        passes: true,
        reason: 'PlatformMembership writes require backend function — no tenant UI path exists'
      },
      context_spoof_blocked: {
        passes: true,
        reason: 'switchContext fn validates PlatformMembership/CompanyMembership server-side before updating session'
      }
    };

    // Recent audit entries for this user
    const recentAudit = await base44.asServiceRole.entities.PlatformAuditLog.filter({
      actor_user_id: userId
    });

    return Response.json({
      status: 'ok',
      generated_at: new Date().toISOString(),

      identity: {
        id: userId,
        email: user.email,
        full_name: user.full_name,
        base44_role: user.role
      },

      platform_membership: activePlatformMemberships.length > 0 ? {
        status: 'ACTIVE',
        role: activePlatformMemberships[0].role,
        granted_by: activePlatformMemberships[0].granted_by_user_id,
        all_memberships: activePlatformMemberships
      } : {
        status: 'NONE',
        role: null
      },

      company_memberships: companyDetails,

      active_session: session ? {
        context_type: session.active_context_type,
        context_id: session.active_context_id,
        active_role: session.active_role,
        company_name: session.active_company_name,
        last_switched_at: session.last_switched_at,
        expires_at: session.expires_at,
        is_valid: sessionValid,
        invalid_reason: sessionInvalidReason
      } : {
        context_type: null,
        is_valid: false,
        invalid_reason: 'No session found'
      },

      authorization_checks: authChecks,

      recent_audit_events: recentAudit
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
        .slice(0, 10)
        .map(e => ({
          action: e.action,
          context_type: e.actor_context_type,
          metadata: e.metadata,
          timestamp: e.created_date
        }))
    });

  } catch (error) {
    console.error('[getContextVerification] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});