import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DEPRECATED: Customer entity removed from app
 * This automation is now disabled
 */

Deno.serve(async (req) => {
  return Response.json({ 
    ok: false, 
    error: 'Customer entity no longer exists - automation disabled'
  }, { status: 200 });
});