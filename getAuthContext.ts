/**
 * GET AUTH CONTEXT
 * 
 * Resolves the current user's available contexts and active context.
 * Called on login and page load to hydrate the session.
 * 
 * Returns:
 *   - user identity
 *   - available contexts (platform + all company memberships)
 *   - active context (from UserSessionContext or default logic)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Must be authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const userEmail = user.email;

    // Load platform membership
    const platformMemberships = await base44.asServiceRole.entities.PlatformMembership.filter({
      user_id: userId,
      status: 'active'
    });

    // Load company memberships
    const companyMemberships = await base44.asServiceRole.entities.CompanyMembership.filter({
      user_id: userId,
      status: 'active'
    });

    // Build available contexts list
    const availableContexts = [];

    if (platformMemberships.length > 0) {
      availableContexts.push({
        type: 'platform',
        id: null,
        label: 'FenceIQ Platform',
        role: platformMemberships[0].role,
        displayAs: `FenceIQ Platform (${platformMemberships[0].role})`
      });
    }

    // Load TenantCompany details for each membership
    for (const membership of companyMemberships) {
      const companies = await base44.asServiceRole.entities.TenantCompany.filter({
        id: membership.tenant_company_id,
        status: 'active'
      });
      const company = companies[0];
      if (company) {
        availableContexts.push({
          type: 'company',
          id: membership.tenant_company_id,
          label: company.company_name,
          role: membership.role,
          displayAs: `${company.company_name} (${membership.role})`
        });
      }
    }

    // Find or create session context
    let sessionContexts = await base44.asServiceRole.entities.UserSessionContext.filter({
      user_id: userId
    });

    let sessionContext = sessionContexts[0] || null;

    // Validate existing context is still valid
    if (sessionContext) {
      const stillValid = availableContexts.find(c =>
        c.type === sessionContext.active_context_type &&
        (c.type === 'platform' ? true : c.id === sessionContext.active_context_id)
      );
      if (!stillValid) sessionContext = null;
    }

    // Apply default context rules if no valid session
    if (!sessionContext && availableContexts.length > 0) {
      let defaultContext;

      // Rule: platform membership → default to platform
      if (platformMemberships.length > 0) {
        defaultContext = availableContexts.find(c => c.type === 'platform');
      }
      // Rule: single company → default to that company
      else if (availableContexts.length === 1) {
        defaultContext = availableContexts[0];
      }
      // Rule: multiple companies → first one (last-used logic would require storing it)
      else {
        defaultContext = availableContexts[0];
      }

      if (defaultContext) {
        const contextData = {
          user_id: userId,
          user_email: userEmail,
          active_context_type: defaultContext.type,
          active_context_id: defaultContext.id || null,
          active_role: defaultContext.role,
          active_company_name: defaultContext.type === 'company' ? defaultContext.label : null,
          last_switched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        // Upsert session context
        if (sessionContexts.length > 0) {
          sessionContext = await base44.asServiceRole.entities.UserSessionContext.update(
            sessionContexts[0].id, contextData
          );
        } else {
          sessionContext = await base44.asServiceRole.entities.UserSessionContext.create(contextData);
        }
      }
    }

    return Response.json({
      status: 'ok',
      user: {
        id: userId,
        email: userEmail,
        full_name: user.full_name
      },
      availableContexts,
      activeContext: sessionContext ? {
        type: sessionContext.active_context_type,
        id: sessionContext.active_context_id,
        role: sessionContext.active_role,
        companyName: sessionContext.active_company_name,
        label: sessionContext.active_context_type === 'platform'
          ? 'FenceIQ Platform'
          : sessionContext.active_company_name
      } : null,
      isPlatformAdmin: platformMemberships.some(m => m.role === 'PLATFORM_SUPER_ADMIN')
    });

  } catch (error) {
    console.error('[getAuthContext] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});