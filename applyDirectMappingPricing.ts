import { createGuardedClientFromRequest } from './_shared/base44GuardFactory.js';

Deno.serve(async (req) => {
    try {
        const base44 = await createGuardedClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Direct mappings: pattern → { target_uck, cost }
        const mappings = {
            // VINYL
            'vinyl_post_terminal_': { target: 'vinyl_post_terminal_5x5_6ft_savannah_white', cost: 43.23 },
            'vinyl_post_end_5x5_': { target: 'vinyl_post_terminal_5x5_6ft_savannah_white', cost: 43.23 },
            'vinyl_post_support_': { target: 'vinyl_post_terminal_5x5_6ft_savannah_white', cost: 43.23 },
            'vinyl_post_cap_': { target: 'vinyl_hardware_post_cap_5x5_newengland_savannah_white', cost: 6.75 },
            'vinyl_concrete_': { target: 'concrete_fast_set_50lb', cost: 7.96 },
            'vinyl_cane_bolt_': { target: 'vinyl_hardware_gate_cane_bolt_locking', cost: 12.00 },
            'vinyl_gate_hardware_': { target: 'vinyl_hardware_gate_hinge_set_heavy_duty', cost: 83.82 },
            'vinyl_gate_latch_pool_': { target: 'vinyl_hardware_gate_latch_pool_trident', cost: 71.44 },
            'vinyl_gate_latch_single_': { target: 'vinyl_hardware_gate_latch_locklatch_4in', cost: 12.50 },
            'vinyl_gate_latch_double_': { target: 'vinyl_hardware_gate_latch_locklatch_4in', cost: 12.50 },
            'vinyl_gate_single_': { target: 'vinyl_gate_single_6ft', cost: 503.44 },
            'vinyl_gate_double_': { target: 'vinyl_gate_double_6ft', cost: 1115.99 },
            'vinyl_panel_privacy_4ft_': { target: 'vinyl_panel_privacy_4ft', cost: 75.00 },
            'vinyl_panel_privacy_5ft_': { target: 'vinyl_panel_privacy_5ft', cost: 37.50 },
            'vinyl_panel_privacy_6ft_': { target: 'vinyl_panel_privacy_6ft', cost: 45.00 },

            // WOOD
            'wood_post_end_': { target: 'wood_post_6ft', cost: 23.75 },
            'wood_post_corner_': { target: 'wood_post_6ft', cost: 23.75 },
            'wood_post_line_': { target: 'wood_post_6ft', cost: 23.75 },
            'wood_post_gate_': { target: 'wood_post_gate_6ft', cost: 55.00 },
            'wood_rail_top_': { target: 'wood_rail_2x4x8', cost: 8.50 },
            'wood_rail_mid_': { target: 'wood_rail_2x4x8', cost: 8.50 },
            'wood_rail_bottom_': { target: 'wood_rail_2x4x8', cost: 8.50 },
            'wood_picket_': { target: 'wood_picket_6ft_treated', cost: 3.25 },
            'wood_fasteners_nails_': { target: 'wood_nail_galv_3in', cost: 0.08 },
            'wood_nail_galv_': { target: 'wood_nail_galv_3in', cost: 0.08 },
            'wood_fasteners_screws_': { target: 'wood_screw_deck_3in', cost: 0.08 },
            'wood_screw_deck_': { target: 'wood_screw_deck_3in', cost: 0.08 },
            'wood_gate_single_': { target: 'vinyl_gate_single_6ft', cost: 503.44 },
            'wood_gate_double_': { target: 'vinyl_gate_double_6ft', cost: 1115.99 },
            'wood_gate_hinge_set': { target: 'wood_gate_hinge_set', cost: 18.50 },
            'wood_gate_locklatch_': { target: 'vinyl_hardware_gate_latch_locklatch_4in', cost: 12.50 },
            'wood_gate_build_kit': { target: 'wood_gate_build_kit', cost: 178.00 },
            'wood_concrete_': { target: 'concrete_fast_set_50lb', cost: 7.96 },

            // CHAIN LINK
            'chainlink_post_terminal_': { target: 'chainlink_post_terminal_8ft_galvanized', cost: 35.00 },
            'chainlink_post_line_': { target: 'chainlink_post_line_8ft_galvanized', cost: 31.97 },
            'chainlink_rail_top_': { target: 'chainlink_top_rail_6ft_galvanized', cost: 24.88 },
            'chainlink_bottom_rail_': { target: 'chainlink_top_rail_6ft_galvanized', cost: 24.88 },
            'chainlink_fabric_4ft_': { target: 'chainlink_fabric_4ft_galvanized', cost: 85.00 },
            'chainlink_fabric_5ft_': { target: 'chainlink_fabric_5ft_galvanized', cost: 121.00 },
            'chainlink_fabric_6ft_': { target: 'chainlink_fabric_6ft_galvanized', cost: 127.50 },
            'chainlink_cap_dome_': { target: 'chainlink_cap_dome_galvanized', cost: 2.93 },
            'chainlink_cap_loop_': { target: 'chainlink_cap_loop_galvanized', cost: 2.23 },
            'chainlink_band_tension_': { target: 'chainlink_band_tension_galvanized', cost: 3.36 },
            'chainlink_band_brace_': { target: 'chainlink_band_brace_galvanized', cost: 2.71 },
            'chainlink_drop_rod_': { target: 'chainlink_drop_rod_3_8x30', cost: 5.82 },
            'chainlink_carriage_bolt_': { target: 'chainlink_hardware_carriage_bolt_galvanized', cost: 7.49 },
            'chainlink_tension_wire_': { target: 'chainlink_tension_wire_galvanized', cost: 18.25 },
            'chainlink_gate_single_': { target: 'chainlink_gate_single_6ft_galvanized', cost: 491.26 },
            'chainlink_gate_double_': { target: 'chainlink_gate_double_6ft_galvanized', cost: 978.40 },
            'chainlink_gate_kit_': { target: 'chainlink_gate_kit_expandable', cost: 178.00 },

            // ALUMINUM
            'aluminum_post_': { target: 'aluminum_post_6_black', cost: 75.00 },
            'aluminum_cap_': { target: 'aluminum_post_cap_4ft', cost: 8.50 },
            'aluminum_panel_': { target: 'aluminum_panel_6_black', cost: 120.00 },
            'aluminum_gate_single_': { target: 'aluminum_gate_single_6ft_black', cost: 689.00 },
            'aluminum_gate_latch_': { target: 'vinyl_hardware_gate_latch_pool_trident', cost: 71.44 },
            'aluminum_concrete_': { target: 'concrete_fast_set_50lb', cost: 7.96 },

            // GENERIC
            'general_concrete_': { target: 'concrete_fast_set_50lb', cost: 7.96 },
            'general_post_galv': { target: 'chainlink_post_terminal_8ft_galvanized', cost: 35.00 },
            'general_post_white': { target: 'vinyl_post_terminal_5x5_6ft_savannah_white', cost: 43.23 },
            'general_post_5ft_': { target: 'vinyl_post_terminal_5x5_6ft_savannah_white', cost: 43.23 },
            'general_panel_': { target: 'vinyl_panel_privacy_6ft', cost: 45.00 }
        };

        // Fetch all catalog items
        const allCatalog = await base44.asServiceRole.entities.MaterialCatalog.list();

        let updated = 0;
        let skipped = 0;
        const results = [];

        for (const item of allCatalog) {
            const uck = item.canonical_key;
            if (!uck || item.cost > 0) continue; // Skip if already priced or no UCK

            // Find matching pattern
            let matchedCost = null;
            for (const [pattern, mapping] of Object.entries(mappings)) {
                if (uck.startsWith(pattern) || uck.includes(pattern)) {
                    matchedCost = mapping.cost;
                    break;
                }
            }

            if (!matchedCost) {
                skipped++;
                continue;
            }

            try {
                await base44.asServiceRole.entities.MaterialCatalog.update(item.id, {
                    cost: matchedCost
                });
                updated++;
                results.push({
                    uck,
                    status: 'UPDATED',
                    newCost: matchedCost
                });
            } catch (err) {
                results.push({
                    uck,
                    status: 'ERROR',
                    error: err.message
                });
            }
        }

        return Response.json({
            summary: { total: allCatalog.length, updated, skipped },
            results: results.slice(0, 50)
        });

    } catch (error) {
        console.error('Error in applyDirectMappingPricing:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});