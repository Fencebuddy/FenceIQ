import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * IMPORT MATERIAL ATTRIBUTE SCHEMAS FROM CSV
 * 
 * Admin-only function to import V2 attribute schema CSVs.
 * Payload: { csvData: string, family: string }
 * 
 * Expected CSV format:
 * attribute,type,description
 * height,enum,Fence height in feet
 * coating,enum,Surface coating type
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

        if (!csvData || !family) {
            return Response.json({ error: 'csvData and family required' }, { status: 400 });
        }

        const lines = csvData.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
            return Response.json({ error: 'CSV must have header and data rows' }, { status: 400 });
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const attributeIndex = headers.indexOf('attribute');
        const typeIndex = headers.indexOf('type');
        const descriptionIndex = headers.indexOf('description');

        if (attributeIndex === -1 || typeIndex === -1) {
            return Response.json({ error: 'Missing required columns: attribute, type' }, { status: 400 });
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
            const attributeKey = values[attributeIndex];
            const type = values[typeIndex];
            const description = descriptionIndex >= 0 ? values[descriptionIndex] : '';

            if (!attributeKey || !type) {
                results.errors.push(`Row ${i}: Missing attribute_key or type`);
                results.failed++;
                continue;
            }

            try {
                // Check if exists
                const existing = await base44.asServiceRole.entities.MaterialAttributeSchema.filter({
                    family: family,
                    attribute_key: attributeKey
                });

                const schemaData = {
                    family: family,
                    attribute_key: attributeKey,
                    type: type,
                    description: description,
                    status: 'system',
                    editable: false
                };

                if (existing.length > 0) {
                    // Update existing
                    await base44.asServiceRole.entities.MaterialAttributeSchema.update(
                        existing[0].id,
                        schemaData
                    );
                    results.updated++;
                } else {
                    // Create new
                    await base44.asServiceRole.entities.MaterialAttributeSchema.create(schemaData);
                    results.created++;
                }

                results.success++;
            } catch (error) {
                results.errors.push(`Row ${i} (${attributeKey}): ${error.message}`);
                results.failed++;
            }
        }

        return Response.json({
            message: 'Import complete',
            family,
            results
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});