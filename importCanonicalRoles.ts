import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * IMPORT CANONICAL ROLES FROM CSV
 * 
 * Admin-only function to import V2 canonical role CSVs.
 * Payload: { csvData: string, family: string }
 * 
 * Expected CSV format:
 * canonical_role,family
 * vinyl_panel,vinyl
 * vinyl_post_end,vinyl
 * ...
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { csvData, family } = await req.json();

        if (!csvData) {
            return Response.json({ error: 'csvData required' }, { status: 400 });
        }

        const lines = csvData.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
            return Response.json({ error: 'CSV must have header and data rows' }, { status: 400 });
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const roleIndex = headers.indexOf('canonical_role');
        const familyIndex = headers.indexOf('family');

        if (roleIndex === -1) {
            return Response.json({ error: 'Missing canonical_role column' }, { status: 400 });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [],
            created: 0,
            updated: 0
        };

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const roleKey = values[roleIndex];
            const rowFamily = familyIndex >= 0 ? values[familyIndex] : family;

            if (!roleKey) {
                results.errors.push(`Row ${i}: Missing role_key`);
                results.failed++;
                continue;
            }

            if (!rowFamily) {
                results.errors.push(`Row ${i}: Missing family`);
                results.failed++;
                continue;
            }

            try {
                // Check if exists
                const existing = await base44.asServiceRole.entities.CanonicalMaterialRole.filter({
                    role_key: roleKey
                });

                const roleData = {
                    role_key: roleKey,
                    family: rowFamily,
                    status: 'system',
                    editable: false
                };

                if (existing.length > 0) {
                    // Update existing
                    await base44.asServiceRole.entities.CanonicalMaterialRole.update(
                        existing[0].id,
                        roleData
                    );
                    results.updated++;
                } else {
                    // Create new
                    await base44.asServiceRole.entities.CanonicalMaterialRole.create(roleData);
                    results.created++;
                }

                results.success++;
            } catch (error) {
                results.errors.push(`Row ${i} (${roleKey}): ${error.message}`);
                results.failed++;
            }
        }

        return Response.json({
            message: 'Import complete',
            results
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});