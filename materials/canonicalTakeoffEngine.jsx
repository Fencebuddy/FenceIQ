/**
 * CANONICAL TAKEOFF ENGINE
 * 
 * ⚠️ CANONICAL TAKEOFF v1.0 LOCKED (2026-01-19)
 * DO NOT MODIFY WITHOUT EXPLICIT v2 VERSIONING
 * 
 * Locked after successful field validation - all behavior frozen.
 * This is FenceBuddy-owned immutable logic.
 * 
 * 🚨 HARD CONSTRAINTS:
 * - DO NOT change quantities, counts, rounding, or waste %
 * - DO NOT change spacing rules, panel widths, or post selection logic
 * - DO NOT change gate logic, corner logic, or terminal/end post logic
 * - DO NOT change hardware doubling rules or material calculations
 * - DO NOT expose takeoff rules in onboarding UI
 * - DO NOT create admin controls for spacing/panels/post ratios
 * 
 * ✅ STRICT BOUNDARY:
 * - Behavior Layer (THIS FILE - LOCKED): Geometry → canonical quantities
 * - Mapping Layer (EDITABLE): Canonical key → supplier SKU + cost
 * 
 * Single source of truth for all material calculations
 * Uses graph-based geometry to eliminate phantom posts
 * GATE POST DOMINANCE: Gate posts replace corner/end posts when they intersect
 * CANONICAL KEY: Every line item outputs a stable canonical_key for deterministic catalog matching
 */

import { generateCanonicalKeyForItem } from '../pricing/canonicalKeyGenerator';
import { 
    CANONICAL_TAKEOFF_VERSION, 
    CANONICAL_TAKEOFF_LOCKED, 
    assertCanonicalImmutability,
    validateTakeoffSnapshot 
} from './canonicalTakeoffVersion';
import { applyRoleToUckMapping } from '../services/roleToUckMapper';
import { KeySchemas } from '../canonicalKeyEngine/keySchemas';

/**
 * HARD INVARIANT: canonical_key must ALWAYS be a non-empty string
 * Prevents null/undefined from entering persistence layer
 */
function ensureCanonicalKeyString(key, fallback) {
  const k = (typeof key === "string" ? key : "").trim();
  if (k) return k;

  const fb = (typeof fallback === "string" ? fallback : "").trim();
  if (fb) return fb;

  // Last resort: never allow null into persistence
  return "INVALID_CANONICAL_KEY";
}

/**
 * Normalize any key format to underscore-delimited catalog format
 * Converts "vinyl.panel.6ft.tan" → "vinyl_panel_6ft_tan"
 */
function toCatalogKey(key) {
  if (typeof key !== "string") return null;
  const k = key.trim();
  if (!k) return null;

  // If already underscore format, keep it
  if (k.includes("_") && !k.includes(".")) return k;

  // Convert dots/spaces/dashes to underscores
  return k
    .toLowerCase()
    .replace(/[.\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const SNAP_TOLERANCE_PX = 30; // Merge points within this distance
const MAX_VINYL_SPACING_FT = 8; // Vinyl panel width
const MAX_WOOD_SPACING_FT = 8; // Wood bay max (matches post layout engine)
const MAX_CHAINLINK_SPACING_FT = 10; // Chain link line post spacing
const MAX_ALUMINUM_PANEL_FT = 6; // Aluminum panel width

/**
 * PATCH B: Get effective context for UCK generation
 * Uses RUN fields as priority, falls back to job header fields
 * Prevents "UI shows 4' but takeoff generates 6'" class of bugs
 */
function getEffectiveContext(activeRuns, job, variantMaterialSet = null) {
    const firstRun = activeRuns?.[0];
    
    return {
        height: firstRun?.fenceHeight || job?.fenceHeight || "6'",
        coating: variantMaterialSet?.coating || firstRun?.chainLinkCoating || job?.chainLinkCoating || 'Galvanized',
        color: firstRun?.fenceColor || job?.fenceColor || 'White',
        style: firstRun?.style || job?.style || 'Privacy'
    };
}

/**
 * Build complete takeoff from map state
 * Used by BOTH materials list and PO generation
 * Routes to material-specific takeoff engines
 * 
 * ⚠️ IMMUTABLE FUNCTION (v1.0 LOCKED)
 * Returns logical ROLES (NOT UCKs) - Role→UCK mapping applied downstream
 * Quantities, spacing, and gate logic are LOCKED
 * 
 * @param {Array} posts - Authoritative posts from postLayoutEngine (SINGLE SOURCE OF TRUTH)
 * @param {boolean} isVariant - TRUE for variant comparison takeoffs (infer material from runs)
 * @param {Object} options - Optional { variantMaterialSet, companyId, applyRoleMapping }
 */
export function buildTakeoff(job, fenceLines, runs, gates, posts = [], isVariant = false, options = {}) {
    const { variantMaterialSet, companyId, applyRoleMapping } = options;
    
    // For variants: infer material type from first run, fall back to job
    const materialType = isVariant 
        ? (runs?.[0]?.materialType || job.materialType || 'Vinyl')
        : (job.materialType || 'Vinyl');

    // Dev-only: Validate we're not modifying canonical behavior
    if (process.env.NODE_ENV !== 'production' && CANONICAL_TAKEOFF_LOCKED) {
        console.log(`[Canonical Takeoff v${CANONICAL_TAKEOFF_VERSION}] Building takeoff for ${materialType}...`);
    }

    // Route to material-specific takeoff (LOCKED BEHAVIOR)
    let result;
    if (materialType === 'Chain Link') {
        result = buildChainLinkTakeoff(job, fenceLines, runs, gates, posts, variantMaterialSet);
    } else if (materialType === 'Wood') {
        result = buildWoodTakeoff(job, fenceLines, runs, gates, posts);
    } else if (materialType === 'Aluminum') {
        result = buildAluminumTakeoff(job, fenceLines, runs, gates, posts);
    } else {
        result = buildVinylTakeoff(job, fenceLines, runs, gates, posts, isVariant);
    }
    
    // STEP X: Apply Role→UCK Mapping (downstream processor)
    // If applyRoleMapping=true and companyId provided, resolve roles to UCKs
    // Otherwise, return roles as-is (caller will apply mapping asynchronously)
    if (applyRoleMapping && companyId && result.lineItems) {
        const mapped = applyRoleToUckMappingSync(result.lineItems, companyId);
        result.lineItems = mapped.items;
        if (mapped.unmappedRoles.length > 0) {
            result.unmappedRoles = mapped.unmappedRoles;
        }
    }
    
    // Dev-only: Validate output structure hasn't changed
    if (process.env.NODE_ENV !== 'production') {
        validateTakeoffSnapshot(`${materialType}-${job.id || 'test'}`, result);
    }
    
    // HARD FAIL GUARD: Block invalid canonical keys before persistence
    const badKeys = result.lineItems?.filter(li => 
        !li.canonical_key || 
        li.canonical_key === "INVALID_CANONICAL_KEY" ||
        typeof li.canonical_key !== "string"
    ) || [];
    
    if (badKeys.length > 0) {
        const examples = badKeys.slice(0, 5).map(b => b.lineItemName || b.role || 'unknown').join(", ");
        throw new Error(
            `Takeoff produced ${badKeys.length} invalid canonical keys: ${examples}${badKeys.length > 5 ? "..." : ""}`
        );
    }
    
    return result;
}

/**
 * Synchronous Role→UCK mapping (STUB - actual mapping is async)
 * For now, just return lineItems as-is with role status
 */
function applyRoleToUckMappingSync(lineItems, companyId) {
    const unmappedRoles = [];
    const mapped = lineItems.map(item => ({
        ...item,
        role: item.canonical_key, // Store generated UCK as role (for mapping)
        roleStatus: 'PENDING_MAPPING' // Will be resolved in async step
    }));
    return { items: mapped, unmappedRoles };
}

/**
 * Phase 2 helper:
 * Export a stable map model for snapshots.
 * Call this right when you create TakeoffSnapshot.
 * IMPORTANT: This should be the exact input your takeoff builders need.
 */
export function exportTakeoffInputFromMapState(mapState) {
    return {
        version: "map_model_v1",
        ...mapState,
    };
}

/**
 * Phase 2 adapter:
 * Build takeoff using an explicit map model + material type, without needing the Job UI.
 * mapModel should be takeoff_input structure (runs, gates, constraints)
 */
export function buildTakeoffFromModel({ mapModel, materialType, overrides = {} }) {
    if (!mapModel) throw new Error("buildTakeoffFromModel: missing mapModel");

    // Convert mapModel (takeoff_input) to legacy format expected by existing builders
    const runs = (mapModel.runs || []).map(r => ({
        id: r.runId || r.id,
        runLabel: r.label || 'Run',
        lengthLF: r.length_lf,
        materialType,
        fenceHeight: overrides.fenceHeight || `${r.height_ft}'`,
        style: overrides.style || 'Privacy',
        fenceColor: overrides.fenceColor || 'White',
        chainLinkCoating: overrides.chainLinkCoating || 'Galvanized',
        chainLinkPrivacyType: overrides.chainLinkPrivacyType || 'None',
        vinylSlatColor: overrides.vinylSlatColor,
        runStatus: 'new',
        isExisting: false
    }));
    
    const gates = (mapModel.runs || []).flatMap((r, runIdx) => 
        (r.gates || []).map((g, gateIdx) => ({
            id: `gate_${runIdx}_${gateIdx}`,
            runId: r.runId || r.id,
            gateType: g.type || (g.width_ft <= 6 ? 'Single' : 'Double'),
            gateWidth_ft: g.width_ft,
            gateCenterDistance_ft: g.position_lf || (r.length_lf / 2),
            placement: g.placement || 'In-line',
            isOrphan: false
        }))
    );
    
    // Build synthetic fence lines from runs
    const fenceLines = runs.map((r, idx) => ({
        id: `line_${idx}`,
        assignedRunId: r.id,
        manualLengthFt: r.lengthLF,
        runStatus: 'new',
        isExisting: false,
        start: { x: idx * 100, y: 0 },
        end: { x: idx * 100 + r.lengthLF * 10, y: 0 }
    }));
    
    // Build synthetic job object with all material-specific overrides
    const job = {
        materialType,
        fenceHeight: overrides.fenceHeight || `${mapModel.runs?.[0]?.height_ft || 6}'`,
        style: overrides.style || 'Privacy',
        fenceColor: overrides.fenceColor || 'White',
        chainLinkCoating: overrides.chainLinkCoating || 'Galvanized',
        chainLinkPrivacyType: overrides.chainLinkPrivacyType || 'None',
        vinylSlatColor: overrides.vinylSlatColor,
        ...overrides
    };

    // Route to existing material-specific builders (they expect: job, fenceLines, runs, gates, posts)
    if (materialType === "Vinyl") return buildVinylTakeoff(job, fenceLines, runs, gates, []);
    if (materialType === "Chain Link") return buildChainLinkTakeoff(job, fenceLines, runs, gates, []);
    if (materialType === "Wood") return buildWoodTakeoff(job, fenceLines, runs, gates, []);
    if (materialType === "Aluminum") return buildAluminumTakeoff(job, fenceLines, runs, gates, []);

    throw new Error(`buildTakeoffFromModel: unsupported materialType ${materialType}`);
}

/**
 * VINYL TAKEOFF ENGINE
 * @param {Array} posts - Authoritative posts from postLayoutEngine
 * @param {boolean} isVariant - TRUE for variant takeoffs (don't filter by job.materialType)
 */
function buildVinylTakeoff(job, fenceLines, runs, gates, posts = [], isVariant = false) {
    // CRITICAL: Only NEW runs AND Vinyl material type
    const activeRuns = runs.filter(r => {
        const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
        // For variants: include runs regardless of material type
        // Gate filtering happens at the gate level, not the run level
        return status === 'new';
    });
    
    const activeLines = fenceLines.filter(line => {
        const status = line.runStatus || (line.isExisting ? 'existing' : 'new');
        const run = activeRuns.find(r => r.id === line.assignedRunId);
        return status === 'new' && line.assignedRunId && run;
    });
    
    // CRITICAL: Single deduplication point - deduplicate by ID FIRST, then filter
    // NOTE: For variants, do NOT filter gates by material - they're shared across all variants
    const uniqueGatesById = [];
    const seenIds = new Set();
    
    gates.forEach(g => {
        if (!seenIds.has(g.id)) {
            seenIds.add(g.id);
            uniqueGatesById.push(g);
        }
    });
    
    // Include gates if they belong to ANY active run (variant-agnostic)
    const activeGates = uniqueGatesById.filter(g => {
        const run = activeRuns.find(r => r.id === g.runId);
        return !!run && !g.isOrphan;
    });
    
    console.log('[buildVinylTakeoff] Gate Deduplication:', {
        gatesInput: gates.length,
        gateIds: gates.map(g => g.id),
        uniqueGatesById: uniqueGatesById.length,
        activeGates: activeGates.length,
        activeGatesDetails: activeGates.map(g => ({ id: g.id, type: g.gateType, width_ft: g.gateWidth_ft, runId: g.runId })),
        postsInput: posts.length
    });
    
    if (activeLines.length === 0) {
        return {
            materialType: 'Vinyl',
            total_lf: 0,
            postCounts: { endPosts: 0, cornerPosts: 0, gatePosts: 0, linePosts: 0, totalVinylPosts: 0 },
            lineItems: [],
            graph: null
        };
    }
    
    // Step 1: Build graph from fence lines
    const graph = buildFenceGraph(activeLines, activeRuns, activeGates);
    
    // Step 2: Count posts from MAP (single source of truth)
    const mapPostCounts = countPostsFromMap(posts, 'Vinyl');
    
    // Step 3: Compute terminal posts from graph (for gates that override corners/ends)
    const graphCounts = computeTerminalPostCounts(graph, activeGates);
    
    // CRITICAL: Use map line posts, graph terminal posts
    const postCounts = {
        endPosts: graphCounts.endPosts,
        cornerPosts: graphCounts.cornerPosts,
        gatePosts: graphCounts.gatePosts,
        linePosts: mapPostCounts.linePosts, // FROM MAP ONLY
        totalVinylPosts: graphCounts.endPosts + graphCounts.cornerPosts + graphCounts.gatePosts + mapPostCounts.linePosts
    };
    
    // Step 4: Generate material line items
    const lineItems = generateVinylMaterials(job, activeRuns, activeLines, activeGates, postCounts, graph);
    
    // Calculate total LF from all active lines
    const totalLF = activeLines.reduce((sum, line) => sum + (line.manualLengthFt || 0), 0);
    
    return {
        materialType: 'Vinyl',
        total_lf: totalLF,
        postCounts,
        lineItems,
        graph
    };
}

/**
 * CHAIN LINK TAKEOFF ENGINE
 * CRITICAL: 10' MAX SPACING, TOP RAIL YES, TENSION WIRE YES
 * @param {Array} posts - Authoritative posts from postLayoutEngine
 * @param {Object} variantMaterialSet - Phase 2 variant material set (AUTHORITY for coating)
 */
function buildChainLinkTakeoff(job, fenceLines, runs, gates, posts = [], variantMaterialSet = null) {
    // STEP 1: Filter to CHAIN LINK material type ONLY
    const activeRuns = runs.filter(r => {
        const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
        const materialType = r.materialType || job.materialType;
        return status === 'new' && materialType === 'Chain Link';
    });

    const activeLines = fenceLines.filter(line => {
        const status = line.runStatus || (line.isExisting ? 'existing' : 'new');
        const run = activeRuns.find(r => r.id === line.assignedRunId);
        return status === 'new' && line.assignedRunId && run;
    });

    const activeGates = gates.filter(g => {
        const run = activeRuns.find(r => r.id === g.runId);
        return !!run;
    });

    if (activeLines.length === 0) {
        return {
            materialType: 'Chain Link',
            total_lf: 0,
            postCounts: { endPosts: 0, cornerPosts: 0, gatePosts: 0, linePosts: 0, totalPosts: 0 },
            metrics: { totalFenceFt: 0, fabricRolls: 0, topRailSticks: 0, tensionWireFt: 0, tensionWireRolls: 0 },
            lineItems: [],
            graph: null
        };
    }

    // STEP 2: Build graph with gate post dominance
    const graph = buildFenceGraph(activeLines, activeRuns, activeGates);
    
    // STEP 2.5: Count posts from MAP (single source of truth)
    const mapPostCounts = countPostsFromMap(posts, 'Chain Link');
    
    // STEP 2.6: Compute terminal posts from graph
    const graphCounts = computeTerminalPostCounts(graph, activeGates);

    // STEP 2.7: FALLBACK - Calculate line posts from edges if map posts not available
    let linePosts = mapPostCounts.linePosts;
    if (linePosts === 0 && activeLines.length > 0) {
        // Calculate line posts from fence length with 10' spacing
        activeLines.forEach(line => {
            const lengthFt = line.manualLengthFt || 0;
            if (lengthFt > MAX_CHAINLINK_SPACING_FT) {
                const nPosts = Math.floor(lengthFt / MAX_CHAINLINK_SPACING_FT) - 1;
                linePosts += Math.max(0, nPosts);
            }
        });
    }

    // STEP 3: Calculate net fence length (subtract gate openings)
    const totalFenceFt = activeLines.reduce((sum, line) => sum + (line.manualLengthFt || 0), 0);
    const totalGateWidthFt = activeGates.reduce((sum, g) => sum + (g.gateWidth_ft || 0), 0);
    const netFenceFt = Math.max(0, totalFenceFt - totalGateWidthFt);

    // Chain Link Constants
    const wastePct = 0.05;
    const fabricRollLengthFt = 50;
    const topRailStickLengthFt = 21;
    const tensionWireRollLengthFt = 100;
    
    // PATCH B: Use effective context from runs (not job header)
    const effectiveCtx = getEffectiveContext(activeRuns, job, variantMaterialSet);
    const heightFt = parseFloat(effectiveCtx.height) || 6;
    const coatingToken = variantMaterialSet?.coating || null;
    const chainLinkCoatingDisplay = variantMaterialSet?.chainLinkCoating || effectiveCtx.coating;
    
    // Debug: Log variant materialSet usage
    if (variantMaterialSet) {
        console.log(`[buildChainLinkTakeoff] Using variant materialSet:`, {
            variantKey: variantMaterialSet.variantKey,
            coating: coatingToken,
            chainLinkCoating: chainLinkCoatingDisplay
        });
    }

    // Derived metrics
    const effectiveFenceFtWithWaste = Math.ceil(netFenceFt * (1 + wastePct));
    const effectiveTopRailFt = netFenceFt; // Top rail = net fence (no gates)
    const effectiveTopRailFtWithWaste = Math.ceil(effectiveTopRailFt * (1 + wastePct));

    // Fabric & Rails
    const fabricRolls = Math.ceil(effectiveFenceFtWithWaste / fabricRollLengthFt);
    const topRailSticks = Math.ceil(effectiveTopRailFtWithWaste / topRailStickLengthFt);
    const tensionWireFt = effectiveFenceFtWithWaste;
    const tensionWireRolls = Math.ceil(tensionWireFt / tensionWireRollLengthFt);

    // Posts - CRITICAL: Use calculated line posts, graph terminal posts
    const endPosts = graphCounts.endPosts;
    const cornerPosts = graphCounts.cornerPosts;
    const gatePosts = graphCounts.gatePosts;
    // linePosts calculated above with fallback
    const totalPosts = endPosts + cornerPosts + gatePosts + linePosts;

    // Hardware quantities - Height-based tension bands
    // 4': 3 per terminal, 6 per corner | 5': 4 per terminal, 8 per corner | 6': 5 per terminal, 10 per corner
    let tensionBandsPerTerminal = 3;
    let tensionBandsPerCorner = 6;
    if (heightFt >= 6) {
        tensionBandsPerTerminal = 5;
        tensionBandsPerCorner = 10;
    } else if (heightFt >= 5) {
        tensionBandsPerTerminal = 4;
        tensionBandsPerCorner = 8;
    }
    
    const braceBands = (endPosts * 2) + (cornerPosts * 4) + (gatePosts * 2);
    const tensionBands = (endPosts * tensionBandsPerTerminal) + (cornerPosts * tensionBandsPerCorner) + (gatePosts * tensionBandsPerTerminal);
    const railCups = (endPosts * 1) + (cornerPosts * 2) + (gatePosts * 1);
    const tensionBars = endPosts + (cornerPosts * 2) + gatePosts; // 1 per end/gate post, 2 per corner post

    // Gate hardware
    const singleGates = activeGates.filter(g => g.gateType === 'Single').length;
    const doubleGates = activeGates.filter(g => g.gateType === 'Double').length;
    const gateHingeSets = singleGates * 1 + doubleGates * 2; // Sets of 2 hinges: 1 set per single gate, 2 sets per double gate

    // Carriage bolts = ALL hardware (tension bands + brace bands + rail cups + gate hinges)
    const totalCarriageBolts = tensionBands + braceBands + railCups + (gateHingeSets * 4);
    const carriageBolts = Math.ceil(totalCarriageBolts / 50) * 50; // Round up to nearest 50

    // Post caps
    const domeCaps = endPosts + cornerPosts + gatePosts; // 1 per terminal post
    const loopCaps = linePosts; // 1 per line post
    
    // Fence Ties - height-based calculation (industry + 1 buffer)
    const tiesPerPostByHeight = { 4: 4, 5: 5, 6: 6 };
    const tiesPerRailByHeight = { 4: 4, 5: 5, 6: 6 };
    const tiesPerPost = tiesPerPostByHeight[heightFt] || 6; // Default to 6 for taller fences
    const tiesPerRail = tiesPerRailByHeight[heightFt] || 6;
    const postTies = linePosts * tiesPerPost;
    const railTies = topRailSticks * tiesPerRail;
    const totalFenceTies = postTies + railTies;
    
    // Gate hardware (continued from earlier declaration)
    const poolGateLatches = singleGates * 1; // 1 per single gate
    const caneBolts = doubleGates * 2;
    const gateCaps = singleGates * 2 + doubleGates * 4; // 2 per single, 4 per double

    // Vinyl Slats / Privacy Slats - ALL SLAT TYPES come in 10 ft bundles
    const privacyType = activeRuns[0]?.chainLinkPrivacyType || job.chainLinkPrivacyType || 'None';
    const slatColor = activeRuns[0]?.vinylSlatColor || job.vinylSlatColor;
    let slatBundles = 0;
    
    if (privacyType === 'Vinyl Slats' && slatColor) {
        // All slats (including Hedge slats) come in 10 ft bundles
        slatBundles = Math.ceil(netFenceFt / 10);
    }

    // Normalize color for catalog matching
    const colorNorm = (coatingToken || effectiveCtx.coating || 'Galvanized').toLowerCase().replace(/\s+/g, '');
    const colorToken = colorNorm === 'galvanized' ? 'galv' : colorNorm === 'blackvinylcoated' || colorNorm === 'blackvinyl' ? 'black' : 'galv';

    // Generate line items with NEW CKE canonical keys
    const lineItems = [
        // Fabric & Rails
        {
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.chainlink.fabric({ heightIn: heightFt * 12, color: colorToken })),
                'invalid_chainlink_fabric'
            ),
            runLabel: 'Overall',
            materialDescription: `${heightFt}' Chain Link Fabric (${chainLinkCoatingDisplay})`,
            lineItemName: `${heightFt}' Chain Link Fabric (${chainLinkCoatingDisplay})`,
            quantityCalculated: effectiveFenceFtWithWaste,
            uom: 'lf',
            notes: `${effectiveFenceFtWithWaste} LF total fence (includes waste)`,
            source: 'map'
        },
        {
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.chainlink.toprail({ color: colorToken, lengthFt: 10 })),
                'invalid_chainlink_toprail'
            ),
            runLabel: 'Overall',
            materialDescription: `Top Rail (${chainLinkCoatingDisplay})`,
            lineItemName: `Top Rail (${chainLinkCoatingDisplay})`,
            quantityCalculated: topRailSticks,
            uom: 'each',
            notes: `${topRailSticks} sticks (21 ft each)`,
            source: 'map'
        },
        
        // Posts (separated by type)
        {
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.chainlink.postTerminal({ heightIn: heightFt * 12, color: colorToken })),
                'invalid_chainlink_post_terminal'
            ),
            runLabel: 'Overall',
            materialDescription: `Terminal Posts ${heightFt}ft (${chainLinkCoatingDisplay})`,
            lineItemName: `Terminal Posts ${heightFt}ft (${chainLinkCoatingDisplay})`,
            quantityCalculated: endPosts + cornerPosts,
            uom: 'each',
            notes: `${endPosts} end + ${cornerPosts} corner = ${endPosts + cornerPosts} terminal posts`,
            source: 'map'
        },
        ...(gatePosts > 0 ? [{
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.chainlink.postTerminal({ heightIn: heightFt * 12, color: colorToken })),
                'invalid_chainlink_post_gate'
            ),
            runLabel: 'Overall',
            materialDescription: `Terminal Posts ${heightFt}ft Gate (${chainLinkCoatingDisplay})`,
            lineItemName: `Terminal Posts ${heightFt}ft Gate (${chainLinkCoatingDisplay})`,
            quantityCalculated: gatePosts,
            uom: 'each',
            notes: `${activeGates.length} gates × 2 = ${gatePosts} gate posts`,
            source: 'map'
        }] : []),
        ...(linePosts > 0 ? [{
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.chainlink.postLine({ heightIn: heightFt * 12, color: colorToken })),
                'invalid_chainlink_post_line'
            ),
            runLabel: 'Overall',
            materialDescription: `Line Posts ${heightFt}ft (${chainLinkCoatingDisplay})`,
            quantityCalculated: linePosts,
            uom: 'each',
            notes: `${linePosts} line posts (10' spacing)`,
            source: 'map',
            lineItemName: `Line Posts ${heightFt}ft (${chainLinkCoatingDisplay})`
        }] : []),
        
        // Post caps
        ...(domeCaps > 0 ? [{
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.chainlink.capDome({ color: colorToken })),
                'invalid_chainlink_cap_dome'
            ),
            runLabel: 'Overall',
            materialDescription: 'Dome Caps (terminal posts)',
            quantityCalculated: domeCaps,
            uom: 'pcs',
            notes: `${endPosts} end + ${cornerPosts} corner + ${gatePosts} gate = ${domeCaps} terminal posts`,
            source: 'map',
            lineItemName: 'Dome Caps (terminal posts)'
        }] : []),
        ...(loopCaps > 0 ? [{
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.chainlink.capLoop({ color: colorToken })),
                'invalid_chainlink_cap_loop'
            ),
            runLabel: 'Overall',
            materialDescription: 'Loop Caps (line posts)',
            quantityCalculated: loopCaps,
            uom: 'pcs',
            notes: `1 per line post`,
            source: 'map',
            lineItemName: 'Loop Caps (line posts)'
        }] : []),
        
        // Rail termination hardware
        {
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.chainlink.braceBand({ color: colorToken })),
                'invalid_chainlink_brace_band'
            ),
            runLabel: 'Overall',
            materialDescription: 'Brace Bands (rail termination)',
            lineItemName: 'Brace Bands (rail termination)',
            quantityCalculated: braceBands,
            uom: 'pcs',
            notes: `End: ${endPosts}×2 | Corner: ${cornerPosts}×4 | Gate: ${gatePosts}×2 = ${braceBands} total`,
            source: 'map'
        },
        {
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.chainlink.railEnd({ color: colorToken })),
                'invalid_chainlink_rail_end'
            ),
            runLabel: 'Overall',
            materialDescription: 'Rail End Cups',
            lineItemName: 'Rail End Cups',
            quantityCalculated: railCups,
            uom: 'pcs',
            notes: `End: ${endPosts}×1 | Corner: ${cornerPosts}×2 | Gate: ${gatePosts}×1 = ${railCups} total`,
            source: 'map'
        },
        
        // Fabric termination hardware
        {
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.chainlink.tensionBand({ color: colorToken })),
                'invalid_chainlink_tension_band'
            ),
            runLabel: 'Overall',
            materialDescription: 'Tension Bands',
            lineItemName: 'Tension Bands',
            quantityCalculated: tensionBands,
            uom: 'pcs',
            notes: `End: ${endPosts}×${tensionBandsPerTerminal} | Corner: ${cornerPosts}×${tensionBandsPerCorner} | Gate: ${gatePosts}×${tensionBandsPerTerminal} = ${tensionBands} total`,
            source: 'map'
        },
        {
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.chainlink.tensionBar({ heightIn: heightFt * 12, color: colorToken })),
                'invalid_chainlink_tension_bar'
            ),
            runLabel: 'Overall',
            materialDescription: `${heightFt}' Tension Bars`,
            lineItemName: `${heightFt}' Tension Bars`,
            quantityCalculated: tensionBars,
            uom: 'each',
            notes: `End: ${endPosts}×1 | Corner: ${cornerPosts}×2 | Gate: ${gatePosts}×1 = ${tensionBars} total`,
            source: 'map'
        },
        {
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.general.carriageBolt({ finish: colorToken })),
                'invalid_general_carriage_bolt'
            ),
            runLabel: 'Overall',
            materialDescription: 'Carriage Bolts (all hardware)',
            lineItemName: 'Carriage Bolts (all hardware)',
            quantityCalculated: carriageBolts,
            uom: 'pcs',
            notes: `${tensionBands} tension + ${braceBands} brace + ${railCups} rail cups + ${gateHingeSets * 4} gate → ${totalCarriageBolts} total → ${carriageBolts} (nearest 50)`,
            source: 'map'
        },

        // Fence Ties
        {
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.chainlink.tieWire({ color: colorToken })),
                'invalid_chainlink_tie_wire'
            ),
            runLabel: 'Overall',
            materialDescription: 'Chain Link Fence Ties',
            lineItemName: 'Chain Link Fence Ties',
            quantityCalculated: Math.ceil(totalFenceTies / 30),
            uom: 'pack',
            notes: `${totalFenceTies} ties ÷ 30 per pack = ${Math.ceil(totalFenceTies / 30)} packs`,
            source: 'map'
        }
    ];
    
    // Add vinyl slats OR privacy screen
    if (privacyType === 'Vinyl Slats' && slatBundles > 0) {
        lineItems.push({
            canonical_key: generateCanonicalKeyForItem({ lineItemName: 'Privacy Slats' }, 'Chain Link', effectiveCtx.height, coatingToken || effectiveCtx.coating),
            runLabel: 'Overall',
            materialDescription: `${slatColor} Privacy Slats (10 ft bundles)`,
            lineItemName: `${slatColor} Privacy Slats (10 ft bundles)`,
            quantityCalculated: slatBundles,
            uom: 'bundles',
            notes: `${netFenceFt.toFixed(1)} ft ÷ 10 ft/bundle = ${slatBundles} bundles`,
            source: 'map'
        });
    } else if (privacyType === 'Privacy Screen') {
        // Privacy Screen = 50 ft rolls, INCLUDES gate spaces (full LF)
        const screenRolls = Math.ceil(totalFenceFt / 50);
        lineItems.push({
            canonical_key: generateCanonicalKeyForItem({ lineItemName: 'Privacy Screen' }, 'Chain Link', effectiveCtx.height, coatingToken || effectiveCtx.coating),
            runLabel: 'Overall',
            materialDescription: 'Privacy Screen (50 ft rolls)',
            lineItemName: 'Privacy Screen (50 ft rolls)',
            quantityCalculated: screenRolls,
            uom: 'rolls',
            notes: `${totalFenceFt.toFixed(1)} ft (includes gates) ÷ 50 ft/roll = ${screenRolls} rolls`,
            source: 'map'
        });
    }
    
    // Gate hardware and panels section
    if (activeGates.length > 0) {
        // Gate Panels by size
        const gates4ft = activeGates.filter(g => g.gateType === 'Single' && g.gateWidth_ft === 4).length;
        const gates5ft = activeGates.filter(g => g.gateType === 'Single' && g.gateWidth_ft === 5).length;
        const gates6ft = activeGates.filter(g => g.gateType === 'Single' && g.gateWidth_ft === 6).length;
        const gates8ft = activeGates.filter(g => g.gateType === 'Double' && g.gateWidth_ft === 8).length;
        const gates10ft = activeGates.filter(g => g.gateType === 'Double' && g.gateWidth_ft === 10).length;
        const gates12ft = activeGates.filter(g => g.gateType === 'Double' && g.gateWidth_ft === 12).length;

        if (gates4ft > 0) {
            lineItems.push({
                canonical_key: ensureCanonicalKeyString(
                    toCatalogKey(KeySchemas.chainlink.gate({ heightFt, widthFt: 4, color: colorToken })),
                    'invalid_chainlink_gate_4ft'
                ),
                runLabel: 'Gates',
                materialDescription: `${heightFt}' x 4' Chain Link Gate`,
                lineItemName: `${heightFt}' x 4' Chain Link Gate`,
                quantityCalculated: gates4ft,
                uom: 'each',
                notes: `${gates4ft} single gates`,
                source: 'map'
            });
        }
        if (gates5ft > 0) {
            lineItems.push({
                canonical_key: ensureCanonicalKeyString(
                    toCatalogKey(KeySchemas.chainlink.gate({ heightFt, widthFt: 5, color: colorToken })),
                    'invalid_chainlink_gate_5ft'
                ),
                runLabel: 'Gates',
                materialDescription: `${heightFt}' x 5' Chain Link Gate`,
                lineItemName: `${heightFt}' x 5' Chain Link Gate`,
                quantityCalculated: gates5ft,
                uom: 'each',
                notes: `${gates5ft} single gates`,
                source: 'map'
            });
        }
        if (gates6ft > 0) {
            lineItems.push({
                canonical_key: ensureCanonicalKeyString(
                    toCatalogKey(KeySchemas.chainlink.gate({ heightFt, widthFt: 6, color: colorToken })),
                    'invalid_chainlink_gate_6ft'
                ),
                runLabel: 'Gates',
                materialDescription: `${heightFt}' x 6' Chain Link Gate`,
                lineItemName: `${heightFt}' x 6' Chain Link Gate`,
                quantityCalculated: gates6ft,
                uom: 'each',
                notes: `${gates6ft} single gates`,
                source: 'map'
            });
        }
        if (gates8ft > 0) {
            lineItems.push({
                canonical_key: ensureCanonicalKeyString(
                    toCatalogKey(KeySchemas.chainlink.gate({ heightFt, widthFt: 8, color: colorToken })),
                    'invalid_chainlink_gate_8ft'
                ),
                runLabel: 'Gates',
                materialDescription: `${heightFt}' x 8' Chain Link Gate (Double)`,
                lineItemName: `${heightFt}' x 8' Chain Link Gate (Double)`,
                quantityCalculated: gates8ft,
                uom: 'each',
                notes: `${gates8ft} double gates`,
                source: 'map'
            });
        }
        if (gates10ft > 0) {
            lineItems.push({
                canonical_key: ensureCanonicalKeyString(
                    toCatalogKey(KeySchemas.chainlink.gate({ heightFt, widthFt: 10, color: colorToken })),
                    'invalid_chainlink_gate_10ft'
                ),
                runLabel: 'Gates',
                materialDescription: `${heightFt}' x 10' Chain Link Gate (Double)`,
                lineItemName: `${heightFt}' x 10' Chain Link Gate (Double)`,
                quantityCalculated: gates10ft,
                uom: 'each',
                notes: `${gates10ft} double gates`,
                source: 'map'
            });
        }
        if (gates12ft > 0) {
            lineItems.push({
                canonical_key: ensureCanonicalKeyString(
                    toCatalogKey(KeySchemas.chainlink.gate({ heightFt, widthFt: 12, color: colorToken })),
                    'invalid_chainlink_gate_12ft'
                ),
                runLabel: 'Gates',
                materialDescription: `${heightFt}' x 12' Chain Link Gate (Double)`,
                lineItemName: `${heightFt}' x 12' Chain Link Gate (Double)`,
                quantityCalculated: gates12ft,
                uom: 'each',
                notes: `${gates12ft} double gates`,
                source: 'map'
            });
        }

        lineItems.push(
            {
                canonical_key: ensureCanonicalKeyString(
                    toCatalogKey(KeySchemas.chainlink.gateHardwareSet({ color: colorToken })),
                    'invalid_chainlink_gate_hardware'
                ),
                runLabel: 'Gates',
                materialDescription: 'Gate Hardware Set',
                lineItemName: 'Gate Hardware Set',
                quantityCalculated: gateHingeSets,
                uom: 'set',
                notes: `${singleGates} single × 1 set + ${doubleGates} double × 2 sets = ${gateHingeSets} sets`,
                source: 'map'
            }
        );

        if (caneBolts > 0) {
            lineItems.push({
                canonical_key: generateCanonicalKeyForItem({ lineItemName: 'Cane Bolt' }, 'Chain Link', effectiveCtx.height, coatingToken || effectiveCtx.coating),
                runLabel: 'Gates',
                materialDescription: 'Cane Bolts (double gates)',
                lineItemName: 'Cane Bolts (double gates)',
                quantityCalculated: caneBolts,
                uom: 'pcs',
                notes: `${doubleGates} double gates × 2`,
                source: 'map'
            });
        }
    }
    
    return {
        materialType: 'Chain Link',
        total_lf: totalFenceFt, // Total fence length from lines
        postCounts: { endPosts, cornerPosts, gatePosts, linePosts, totalPosts },
        metrics: { 
            totalFenceFt: netFenceFt, // Net fence length (after subtracting gates)
            fabricRolls, 
            topRailSticks, 
            tensionWireFt,
            tensionWireRolls,
            slatBundles // Privacy slats
        },
        lineItems,
        graph
    };
    }

/**
 * WOOD TAKEOFF ENGINE
 * CRITICAL: All posts are DRIVEN except gate posts
 * ONLY gate posts receive concrete
 * @param {Array} posts - Authoritative posts from postLayoutEngine
 */
function buildWoodTakeoff(job, fenceLines, runs, gates, posts = []) {
    const activeRuns = runs.filter(r => {
        const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
        const materialType = r.materialType || job.materialType;
        return status === 'new' && materialType === 'Wood';
    });
    
    const activeLines = fenceLines.filter(line => {
        const status = line.runStatus || (line.isExisting ? 'existing' : 'new');
        const run = activeRuns.find(r => r.id === line.assignedRunId);
        return status === 'new' && line.assignedRunId && run;
    });
    
    const activeGates = gates.filter(g => {
        const run = activeRuns.find(r => r.id === g.runId);
        return !!run && !g.isOrphan;
    });
    
    console.log('[buildWoodTakeoff] Gate filtering:', {
        totalGates: gates.length,
        gatesInput: gates.map(g => ({ id: g.id, runId: g.runId, type: g.gateType, width_ft: g.gateWidth_ft, isOrphan: g.isOrphan })),
        activeRunIds: activeRuns.map(r => r.id),
        activeGates: activeGates.length,
        activeGatesDetails: activeGates.map(g => ({ id: g.id, type: g.gateType, width_ft: g.gateWidth_ft }))
    });
    
    if (activeLines.length === 0) {
        return {
            materialType: 'Wood',
            total_lf: 0,
            postCounts: { terminalPosts: 0, gatePosts: 0, linePosts: 0, totalPosts: 0 },
            metrics: { concreteBags: 0, railBoards: 0, pickets: 0 },
            lineItems: [],
            graph: null
        };
    }
    
    // Build graph
    const graph = buildFenceGraph(activeLines, activeRuns, activeGates);
    
    // Count posts from MAP (single source of truth)
    const mapPostCounts = countPostsFromMap(posts, 'Wood');
    
    // Compute terminal posts from graph
    const graphCounts = computeTerminalPostCounts(graph, activeGates);
    
    // Calculate totals
    const totalFenceFt = activeLines.reduce((sum, line) => sum + (line.manualLengthFt || 0), 0);
    const totalGateWidthFt = activeGates.reduce((sum, g) => sum + (g.gateWidth_ft || 0), 0);
    const effectiveFenceFt = totalFenceFt - totalGateWidthFt;
    
    // Constants
    const wastePct = 0.05;
    const heightFt = parseFloat(job.fenceHeight) || 6;
    const picketsPerFt = 17 / 8; // 2.125 - LF/8 * 17 = total pickets
    
    // Posts - CRITICAL: Wood uses 2 end posts + line posts (same type, ALL DRIVEN including gates)
    const endPosts = 2; // Fixed: Always 2 end posts for wood
    const gatePosts = graphCounts.gatePosts;

    // CRITICAL: Total posts = count every node on the map (authoritative source)
    const totalPosts = posts.length > 0 ? posts.length : 11; // Default to 11 if no map posts

    // Line posts = total - end posts - gate posts
    const linePosts = Math.max(0, totalPosts - endPosts - gatePosts);
    
    // Rails per section by height
    let railsPerSection = 3; // default for 5-6 ft
    if (heightFt <= 4) railsPerSection = 2;
    else if (heightFt >= 7) railsPerSection = 4;
    
    // Rail calculation - count actual bays from authoritative posts array
    // Each bay = span between two consecutive posts (post-to-post)
    let totalBays = 0;
    
    console.log('[canonicalTakeoffEngine] Wood Rails - posts:', posts?.length, 'edges:', graph.edges.length);
    
    if (posts && posts.length > 0) {
        // Try to use lineIndex property first
        const postsByLine = {};
        let postsWithLineIndex = 0;
        
        posts.forEach(post => {
            const lineIdx = post.lineIndex;
            if (lineIdx !== undefined && lineIdx !== null) {
                postsWithLineIndex++;
                if (!postsByLine[lineIdx]) postsByLine[lineIdx] = [];
                postsByLine[lineIdx].push(post);
            }
        });
        
        console.log('[canonicalTakeoffEngine] Posts with lineIndex:', postsWithLineIndex);
        
        // Count bays from grouped posts
        Object.entries(postsByLine).forEach(([lineIdx, postsOnLine]) => {
            if (postsOnLine.length >= 2) {
                const baysOnLine = postsOnLine.length - 1;
                totalBays += baysOnLine;
                console.log(`[canonicalTakeoffEngine] Line ${lineIdx}: ${postsOnLine.length} posts → ${baysOnLine} bays`);
            }
        });
        
        // If no posts have lineIndex, count ALL posts as total minus 1 (simple chain)
        if (postsWithLineIndex === 0 && posts.length >= 2) {
            totalBays = posts.length - 1;
            console.log('[canonicalTakeoffEngine] No lineIndex - using simple count:', totalBays, 'bays');
        }
    } else {
        // Fallback: estimate from line length if posts not available
        console.log('[canonicalTakeoffEngine] No posts - estimating from edges');
        graph.edges.forEach(edge => {
            const edgeLengthFt = edge.lengthFt || 0;
            const baysOnThisEdge = Math.ceil(edgeLengthFt / 7.5);
            totalBays += baysOnThisEdge;
        });
    }
    
    console.log('[canonicalTakeoffEngine] Total bays:', totalBays);
    
    // Each bay gets railsPerSection rails (3 for 6' fence)
    // Add 10% waste for cuts and overlap
    const totalRailsNeeded = totalBays * railsPerSection;
    const railBoards_2x4x8 = Math.ceil(totalRailsNeeded * 1.10);

    // Pickets - Check for style-specific calculations
    let pickets;
    const isShadowbox = activeRuns.some(r => r.style === 'Shadowbox');
    const isSemiPrivate = activeRuns.some(r => r.style === 'Semi-Private' || r.style === 'Semi-Privacy');
    const isBoardOnBoard = activeRuns.some(r => r.style === 'Board-on-Board');
    
    if (isShadowbox) {
        // SHADOWBOX FORMULA: Alternating pickets on BOTH sides
        // 1x6 actual width: 5.5", gap: 3.5", on-center: 9.0"
        // Slots per ft: 12/9 = 1.333, pickets per ft: 1.333 * 2 sides = 2.6667
        const picketsPerFt = (12 / 9) * 2; // 2.6666667
        const basePickets = effectiveFenceFt * picketsPerFt;
        pickets = Math.ceil(basePickets * 1.05); // 5% waste
    } else if (isSemiPrivate) {
        // SEMI-PRIVATE FORMULA: Consistent spacing, single-sided
        // 1x6 actual width: 5.5", gap: 1.5", on-center: 7.0"
        // Pickets per ft: 12/7.0 = 1.7142857
        const picketsPerFt = 12 / 7.0; // 1.7142857
        const basePickets = effectiveFenceFt * picketsPerFt;
        pickets = Math.ceil(basePickets * 1.05); // 5% waste
    } else if (isBoardOnBoard) {
        // BOARD-ON-BOARD FORMULA: Double-sided with centered back pickets
        // 1x6 actual width: 5.5", front gap: 1.5", on-center: 7.0"
        // Front pickets per ft: 12/7.0 = 1.7142857
        // Back pickets per ft: 1.7142857 (same as front)
        // Total per ft: 3.4285714
        const picketsPerFt = (12 / 7.0) * 2; // 3.4285714
        const basePickets = effectiveFenceFt * picketsPerFt;
        pickets = Math.ceil(basePickets * 1.05); // 5% waste
    } else {
        // STANDARD FORMULA: (LF / 8) * 17 + 5% waste
        pickets = Math.ceil((effectiveFenceFt / 8) * 17 * 1.05);
    }

    // Picket Nails (2 per picket per rail)
    const nailsPerPicket = railsPerSection * 2;
    const picketNails = pickets * nailsPerPicket;

    // Rail Screws (4 per rail) - MUST MATCH RAILS QUANTITY
    const railScrews = Math.ceil(railBoards_2x4x8) * 4;
    
    // Gate hardware
    const singleGates = activeGates.filter(g => g.gateType === 'Single').length;
    const doubleGates = activeGates.filter(g => g.gateType === 'Double').length;
    const gateHingeSets = singleGates * 1 + doubleGates * 2; // Sets of 2 hinges
    const gateLatches = singleGates + doubleGates;
    const caneBolts = doubleGates * 2;
    
    // Generate line items with ROLES (NOT catalog keys) - Role→UCK mapping applied downstream
    const lineItems = [
        // All Posts - End & Line (driven steel posts)
        {
            canonical_key: 'wood_post_4x4_steel',
            lineItemName: 'Wood Post 4x4 Driven Steel',
            runLabel: 'Overall',
            materialDescription: 'Wood Post 4x4 Driven Steel',
            quantityCalculated: endPosts + linePosts,
            uom: 'each',
            notes: `${endPosts} end + ${linePosts} line = ${endPosts + linePosts} driven posts (8' spacing)`,
            source: 'map'
        },

        // Gate Posts - 4x6 treated posts (only if gates exist)
        ...(gatePosts > 0 ? [{
            canonical_key: 'wood_post_4x6_gate',
            lineItemName: 'Wood Post Gate 4x6 Treated',
            runLabel: 'Overall',
            materialDescription: 'Wood Post Gate 4x6 Treated',
            quantityCalculated: gatePosts,
            uom: 'each',
            notes: `${gatePosts} gate posts`,
            source: 'map'
        }] : []),

        // Concrete - REMOVED for wood (all posts are driven, including gates)

        // Rails
        {
            canonical_key: 'wood_rail_2x4x8',
            lineItemName: 'Wood Rail 2x4x8 Treated',
            runLabel: 'Overall',
            materialDescription: 'Wood Rail 2x4x8 Treated',
            quantityCalculated: railBoards_2x4x8,
            uom: 'each',
            notes: `${totalBays} bays × ${railsPerSection} rails × 1.10 waste = ${railBoards_2x4x8} boards`,
            source: 'map'
        },

        // Pickets - use 6ft or 8ft based on height
        {
            canonical_key: heightFt <= 6 ? 'wood_picket_1x6_6ft' : 'wood_picket_1x6_8ft',
            lineItemName: heightFt <= 6 ? 'Wood Picket 1x6 Dog-Ear 6ft' : 'Wood Picket 1x6 Dog-Ear 8ft',
            runLabel: 'Overall',
            materialDescription: heightFt <= 6 ? 'Wood Picket 1x6 Dog-Ear 6ft' : 'Wood Picket 1x6 Dog-Ear 8ft',
            quantityCalculated: pickets,
            uom: 'each',
            notes: isShadowbox 
                ? `Shadowbox: ${effectiveFenceFt.toFixed(1)} ft × 2.67 pickets/ft × 1.05 waste = ${pickets} pickets (both sides)`
                : isSemiPrivate
                ? `Semi-Private: ${effectiveFenceFt.toFixed(1)} ft × 1.71 pickets/ft × 1.05 waste = ${pickets} pickets`
                : isBoardOnBoard
                ? `Board-on-Board: ${effectiveFenceFt.toFixed(1)} ft × 3.43 pickets/ft × 1.05 waste = ${pickets} pickets (double-sided)`
                : `(${effectiveFenceFt.toFixed(1)} ft / 8) × 17 × 1.05 waste = ${pickets} pickets`,
            source: 'map'
        },

        // Picket Nails
        {
            canonical_key: 'wood_nail_2in_galv',
            lineItemName: 'Wood Nail 2in Galv Ring-Shank',
            runLabel: 'Overall',
            materialDescription: 'Wood Nail 2in Galv Ring-Shank',
            quantityCalculated: picketNails,
            uom: 'pcs',
            notes: `${pickets} pickets × ${nailsPerPicket} nails`,
            source: 'map'
        },

        // Rail Screws
        {
            canonical_key: 'wood_screw_3in_deck',
            lineItemName: 'Wood Screw 3in Deck',
            runLabel: 'Overall',
            materialDescription: 'Wood Screw 3in Deck',
            quantityCalculated: railScrews,
            uom: 'pcs',
            notes: `${railBoards_2x4x8} rails × 4 screws`,
            source: 'map'
        }
    ];
    
    // Add gate hardware if gates exist
    if (activeGates.length > 0) {
        lineItems.push({
            canonical_key: 'wood_hinge_set',
            lineItemName: 'Wood Gate Hinge Set',
            runLabel: 'Gates',
            materialDescription: 'Wood Gate Hinge Set',
            quantityCalculated: gateHingeSets,
            uom: 'set',
            notes: `${singleGates} single × 1 set + ${doubleGates} double × 2 sets = ${gateHingeSets} sets`,
            source: 'map'
        });

        // Gate building kits - 1 for single, 2 for double
        const gateKits = singleGates * 1 + doubleGates * 2;
        lineItems.push({
            canonical_key: 'wood_gate_kit_adjust',
            lineItemName: 'Wood Gate Kit Adjust-A-Gate',
            runLabel: 'Gates',
            materialDescription: 'Wood Gate Kit Adjust-A-Gate',
            quantityCalculated: gateKits,
            uom: 'each',
            notes: `${singleGates} single gates (1 kit each) + ${doubleGates} double gates (2 kits each) = ${gateKits} kits`,
            source: 'map'
        });

        // Gate latch for all gates
        lineItems.push({
            canonical_key: 'wood_gate_latch',
            lineItemName: 'Wood Gate Latch',
            runLabel: 'Gates',
            materialDescription: 'Wood Gate Latch',
            quantityCalculated: singleGates + doubleGates,
            uom: 'each',
            notes: `${singleGates} single + ${doubleGates} double = ${singleGates + doubleGates} gates`,
            source: 'map'
        });

        if (caneBolts > 0) {
            lineItems.push({
                canonical_key: 'wood_bolt_cane',
                lineItemName: 'Wood Cane Bolt',
                runLabel: 'Gates',
                materialDescription: 'Wood Cane Bolt',
                quantityCalculated: caneBolts,
                uom: 'each',
                notes: `${doubleGates} double gates × 2 = ${caneBolts} bolts`,
                source: 'map'
            });
        }
    }
    
    return {
        materialType: 'Wood',
        total_lf: totalFenceFt,
        postCounts: { endPosts, gatePosts, linePosts, totalPosts },
        metrics: { railBoards: railBoards_2x4x8, pickets },
        lineItems,
        graph
    };
}

/**
 * Compute Wood posts from graph
 * CRITICAL: Terminal and line posts are DRIVEN (no concrete)
 * ONLY gate posts are concrete-set
 * GATE POSTS counted from purple nodes, LINE POSTS from 8' spacing
 */
function computeWoodPosts(graph, gates) {
    const { nodes, edges } = graph;
    
    // Terminal posts = ends + corners (EXCLUDING gate posts)
    let terminalPosts = 0;
    let gatePostNodes = 0; // Purple nodes on map
    
    nodes.forEach(node => {
        if (node.gatePost || node.type === 'GATE_POST') {
            // Purple nodes = gate posts (CONCRETE ONLY)
            gatePostNodes++;
        } else if (node.type === 'END' || node.type === 'CORNER') {
            // Green/Red nodes = terminal posts (DRIVEN)
            terminalPosts++;
        }
        // Don't count LINE nodes here - calculated from spacing below
    });
    
    // Line posts from 8' spacing along edges (blue nodes)
    const linePosts = computeLinePosts(edges, gates, MAX_WOOD_SPACING_FT);
    
    return {
        terminalPosts,
        gatePosts: gatePostNodes, // Count from purple nodes on map
        linePosts // Calculated from 8' spacing (blue nodes)
    };
}

/**
 * ALUMINUM TAKEOFF ENGINE
 * CRITICAL: Panelized with equalized panel widths
 * ALL posts are concrete-set
 * @param {Array} posts - Authoritative posts from postLayoutEngine
 */
function buildAluminumTakeoff(job, fenceLines, runs, gates, posts = []) {
    // CRITICAL: When job is Aluminum, IGNORE run.materialType (use job-level only)
    const activeRuns = runs.filter(r => {
        const status = r.runStatus || (r.isExisting ? 'existing' : 'new');
        return status === 'new';
    });
    
    const activeLines = fenceLines.filter(line => {
        const status = line.runStatus || (line.isExisting ? 'existing' : 'new');
        const run = activeRuns.find(r => r.id === line.assignedRunId);
        return status === 'new' && line.assignedRunId && run;
    });
    
    const activeGates = gates.filter(g => {
        const run = activeRuns.find(r => r.id === g.runId);
        return !!run && !g.isOrphan;
    });
    
    if (activeLines.length === 0) {
        return {
            materialType: 'Aluminum',
            total_lf: 0,
            postCounts: { cornerPosts: 0, endPosts: 0, gatePosts: 0, linePosts: 0, totalPosts: 0 },
            metrics: { totalPanels: 0, concreteBags: 0 },
            lineItems: [],
            graph: null
        };
    }
    
    // Build graph
    const graph = buildFenceGraph(activeLines, activeRuns, activeGates);
    
    // Count posts from MAP (single source of truth)
    const mapPostCounts = countPostsFromMap(posts, 'Aluminum');
    
    // Compute terminal posts from graph
    const graphCounts = computeTerminalPostCounts(graph, activeGates);
    
    // Calculate totals
    const totalFenceFt = activeLines.reduce((sum, line) => sum + (line.manualLengthFt || 0), 0);
    const totalGateWidthFt = activeGates.reduce((sum, g) => sum + (g.gateWidth_ft || 0), 0);
    const effectiveFenceFt = totalFenceFt - totalGateWidthFt;
    
    // PATCH B: Use effective context from runs
    const alEffectiveCtx = getEffectiveContext(activeRuns, job, null);
    const heightFt = parseFloat(alEffectiveCtx.height) || 4;
    const bagsPerPost = 2;

    // Posts and panels - CRITICAL: Use map line posts, compute panels from graph
    const cornerPosts = graphCounts.cornerPosts;
    const endPosts = graphCounts.endPosts;
    const gatePosts = graphCounts.gatePosts;
    const linePosts = mapPostCounts.linePosts; // FROM MAP ONLY
    const totalPanels = computeAluminumPanels(graph);
    const totalPosts = cornerPosts + endPosts + gatePosts + linePosts;

    // Concrete - ALL posts (aluminum is all concrete-set)
    const concreteBags = totalPosts * bagsPerPost;
    
    // Gate hardware
    const singleGates = activeGates.filter(g => g.gateType === 'Single').length;
    const doubleGates = activeGates.filter(g => g.gateType === 'Double').length;
    const gatePanels = singleGates * 1 + doubleGates * 2;
    const gateHingeSets = singleGates * 1 + doubleGates * 2; // Sets of 2 hinges
    const gateLatches = singleGates + doubleGates;
    const caneBolts = doubleGates * 2;
    
    // Generate line items
    const lineItems = [];
    
    // Posts - SEPARATED BY TYPE (ALL CONCRETE-SET)
    if (endPosts > 0) {
        lineItems.push({
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.aluminum.post({ role: 'end', size: '2x2', heightFt: 7 })),
                'invalid_aluminum_post_end'
            ),
            runLabel: 'Overall',
            materialDescription: `Aluminum End Posts (7' height)`,
            quantityCalculated: endPosts,
            uom: 'each',
            notes: `${endPosts} end posts (concrete-set)`,
            source: 'map'
        });
    }

    if (cornerPosts > 0) {
        lineItems.push({
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.aluminum.post({ role: 'corner', size: '2x2', heightFt: 7 })),
                'invalid_aluminum_post_corner'
            ),
            runLabel: 'Overall',
            materialDescription: `Aluminum Corner Posts (7' height)`,
            quantityCalculated: cornerPosts,
            uom: 'each',
            notes: `${cornerPosts} corner posts (concrete-set)`,
            source: 'map'
        });
    }

    if (gatePosts > 0) {
        lineItems.push({
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.aluminum.post({ role: 'gate', size: '2x2', heightFt: 7 })),
                'invalid_aluminum_post_gate'
            ),
            runLabel: 'Overall',
            materialDescription: `Aluminum Gate Posts (7' height)`,
            quantityCalculated: gatePosts,
            uom: 'each',
            notes: `${gatePosts} gate posts (concrete-set)`,
            source: 'map'
        });
    }

    if (linePosts > 0) {
        lineItems.push({
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.aluminum.post({ role: 'line', size: '2x2', heightFt: 7 })),
                'invalid_aluminum_post_line'
            ),
            runLabel: 'Overall',
            materialDescription: `Aluminum Line Posts (7' height)`,
            quantityCalculated: linePosts,
            uom: 'each',
            notes: `${linePosts} line posts (concrete-set)`,
            source: 'map'
        });
    }

    // Concrete - ALL POSTS
    lineItems.push({
        canonical_key: ensureCanonicalKeyString(
            toCatalogKey(KeySchemas.general.concrete()),
            'invalid_concrete'
        ),
        runLabel: 'Overall',
        materialDescription: 'Fast-Set Concrete (50 lb bags)',
        quantityCalculated: concreteBags,
        uom: 'bag',
        notes: `${totalPosts} posts × ${bagsPerPost} bags = ${concreteBags} bags`,
        source: 'map'
    });

    // Panels
    lineItems.push({
        canonical_key: ensureCanonicalKeyString(
            toCatalogKey(KeySchemas.aluminum.panel({ style: 'pacific', heightFt: 4.5, widthFt: 6 })),
            'invalid_aluminum_panel'
        ),
        runLabel: 'Overall',
        materialDescription: `Aluminum Fence Panels (4.5' height)`,
        quantityCalculated: totalPanels,
        uom: 'each',
        notes: `${totalPanels} panels (equalized 6' max width)`,
        source: 'map'
    });
    
    // Add gate materials if gates exist
    if (activeGates.length > 0) {
        // Gate panels by size
        const gates48in = activeGates.filter(g => g.gateType === 'Single' && g.gateWidth_ft === 4).length;
        const gates60in = activeGates.filter(g => g.gateType === 'Single' && g.gateWidth_ft === 5).length;
        const gatesDouble48 = activeGates.filter(g => g.gateType === 'Double' && g.gateWidth_ft === 8).length;
        const gatesDouble60 = activeGates.filter(g => g.gateType === 'Double' && g.gateWidth_ft === 10).length;

        if (gates48in > 0) {
            lineItems.push({
                canonical_key: ensureCanonicalKeyString(
                    toCatalogKey(KeySchemas.aluminum.gate({ swing: 'single', widthIn: 48 })),
                    'invalid_aluminum_gate_48'
                ),
                runLabel: 'Gates',
                materialDescription: 'Aluminum Gate Single 4.5x48in',
                quantityCalculated: gates48in,
                uom: 'each',
                notes: `${gates48in} single 4' gates`,
                source: 'map'
            });
        }

        if (gates60in > 0) {
            lineItems.push({
                canonical_key: ensureCanonicalKeyString(
                    toCatalogKey(KeySchemas.aluminum.gate({ swing: 'single', widthIn: 60 })),
                    'invalid_aluminum_gate_60'
                ),
                runLabel: 'Gates',
                materialDescription: 'Aluminum Gate Single 4.5x60in',
                quantityCalculated: gates60in,
                uom: 'each',
                notes: `${gates60in} single 5' gates`,
                source: 'map'
            });
        }

        if (gatesDouble48 > 0) {
            lineItems.push({
                canonical_key: ensureCanonicalKeyString(
                    toCatalogKey(KeySchemas.aluminum.gate({ swing: 'double', widthIn: 48 })),
                    'invalid_aluminum_gate_double_48'
                ),
                runLabel: 'Gates',
                materialDescription: 'Aluminum Gate Double 4.5x48in',
                quantityCalculated: gatesDouble48,
                uom: 'each',
                notes: `${gatesDouble48} double 8' gates`,
                source: 'map'
            });
        }

        if (gatesDouble60 > 0) {
            lineItems.push({
                canonical_key: ensureCanonicalKeyString(
                    toCatalogKey(KeySchemas.aluminum.gate({ swing: 'double', widthIn: 60 })),
                    'invalid_aluminum_gate_double_60'
                ),
                runLabel: 'Gates',
                materialDescription: 'Aluminum Gate Double 4.5x60in',
                quantityCalculated: gatesDouble60,
                uom: 'each',
                notes: `${gatesDouble60} double 10' gates`,
                source: 'map'
            });
        }

        lineItems.push({
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.aluminum.hingeCornerstone()),
                'invalid_aluminum_hinge'
            ),
            runLabel: 'Gates',
            materialDescription: 'Aluminum Gate Hinges',
            quantityCalculated: gateHingeSets,
            uom: 'pair',
            notes: `${singleGates} single × 1 pair + ${doubleGates} double × 2 pairs = ${gateHingeSets} pairs`,
            source: 'map'
        });

        lineItems.push({
            canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.aluminum.latchPool()),
                'invalid_aluminum_latch'
            ),
            runLabel: 'Gates',
            materialDescription: 'Aluminum Pool Latch',
            quantityCalculated: singleGates + doubleGates,
            uom: 'each',
            notes: `${singleGates} single + ${doubleGates} double = ${singleGates + doubleGates} gates`,
            source: 'map'
        });
    }
    
    return {
        materialType: 'Aluminum',
        total_lf: totalFenceFt,
        postCounts: { cornerPosts, endPosts, gatePosts, linePosts, totalPosts },
        metrics: { totalPanels, concreteBags },
        lineItems,
        graph
    };
}

/**
 * Compute Aluminum posts and panels from graph
 * Uses equalized panel widths (max 6 ft)
 */
function computeAluminumPostsAndPanels(graph, gates) {
    const { nodes, edges } = graph;
    
    // Count posts by type (separate corner and end)
    let cornerPosts = 0;
    let endPosts = 0;
    
    nodes.forEach(node => {
        if (node.gatePost) {
            // Gate posts counted separately below
            return;
        }
        
        if (node.type === 'CORNER') {
            cornerPosts++;
        } else if (node.type === 'END') {
            endPosts++;
        }
    });
    
    // Gate posts = 2 per gate
    const gatePosts = gates.length * 2;
    
    // Line posts and panels from edges
    let linePosts = 0;
    let totalPanels = 0;
    
    edges.forEach(edge => {
        const segmentLength = edge.lengthFt;
        if (segmentLength <= 0) return;
        
        // Equalized panels (max 6 ft)
        const nPanels = Math.ceil(segmentLength / MAX_ALUMINUM_PANEL_FT);
        totalPanels += nPanels;
        
        // Line posts = panels - 1 (intermediate posts)
        const linePostsInSegment = Math.max(0, nPanels - 1);
        linePosts += linePostsInSegment;
    });
    
    const totalPosts = cornerPosts + endPosts + gatePosts + linePosts;
    
    return {
        cornerPosts,
        endPosts,
        gatePosts,
        linePosts,
        totalPosts,
        totalPanels
    };
}

/**
 * Build fence graph from fence lines with gate post dominance
 */
function buildFenceGraph(fenceLines, runs, gates) {
    const nodes = [];
    const edges = [];
    
    // Helper to find or create node with gate dominance
    function findOrCreateNode(x, y, isGatePost = false) {
        // Check if node exists within tolerance
        for (let node of nodes) {
            const dist = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
            
            if (dist < SNAP_TOLERANCE_PX) {
                // CRITICAL: NEVER snap gate posts to other gate posts
                if (isGatePost && node.gatePost) {
                    continue; // Skip this node, create new one instead
                }
                
                // GATE POST DOMINANCE: Gate posts replace corner/end posts
                if (isGatePost) {
                    node.gatePost = true;
                    node.type = 'GATE_POST';
                    node.color = '#A855F7'; // Purple for gate posts
                }
                return node;
            }
        }
        
        // Create new node
        const newNode = {
            id: nodes.length,
            x,
            y,
            connectedEdges: [],
            type: isGatePost ? 'GATE_POST' : 'LINE',
            gatePost: isGatePost,
            color: isGatePost ? '#A855F7' : null // Will be set during classification
        };
        nodes.push(newNode);
        return newNode;
    }
    
    // Step 1: Create nodes and edges from fence lines
    fenceLines.forEach((line, lineIdx) => {
        const startNode = findOrCreateNode(line.start.x, line.start.y, false);
        const endNode = findOrCreateNode(line.end.x, line.end.y, false);
        
        // Create edge
        edges.push({
            lineIdx,
            startNodeId: startNode.id,
            endNodeId: endNode.id,
            lengthFt: line.manualLengthFt || 0,
            assignedRunId: line.assignedRunId
        });
        
        // Connect nodes to edges
        startNode.connectedEdges.push(edges.length - 1);
        endNode.connectedEdges.push(edges.length - 1);
    });
    
    // Step 2: Add gate posts with DOMINANCE (gate posts replace corner/end posts)
    gates.forEach(gate => {
        if (!gate.gateWidth_ft || !gate.runId) return;
        
        // Find fence line for this gate
        const gateLine = fenceLines.find(line => line.assignedRunId === gate.runId);
        if (!gateLine) return;
        
        // Calculate gate post positions in pixels
        const dx = gateLine.end.x - gateLine.start.x;
        const dy = gateLine.end.y - gateLine.start.y;
        const linePixels = Math.sqrt(dx * dx + dy * dy);
        const lineFeet = gateLine.manualLengthFt || 0;
        
        if (linePixels === 0 || lineFeet === 0) return;
        
        const pixelsPerFt = linePixels / lineFeet;
        const dirX = dx / linePixels;
        const dirY = dy / linePixels;
        
        const centerFt = gate.gateCenterDistance_ft || (lineFeet / 2);
        const halfWidthFt = gate.gateWidth_ft / 2;
        
        const post1DistPixels = (centerFt - halfWidthFt) * pixelsPerFt;
        const post2DistPixels = (centerFt + halfWidthFt) * pixelsPerFt;
        
        const post1X = gateLine.start.x + dirX * post1DistPixels;
        const post1Y = gateLine.start.y + dirY * post1DistPixels;
        const post2X = gateLine.start.x + dirX * post2DistPixels;
        const post2Y = gateLine.start.y + dirY * post2DistPixels;
        
        // CRITICAL: Create BOTH gate posts - mark the first one to prevent snapping second to it
        const post1 = findOrCreateNode(post1X, post1Y, true);
        post1.gateId = gate.id;
        post1.gatePostIndex = 1;
        
        // Create second post - will NOT snap to first because of gate dominance check
        const post2 = findOrCreateNode(post2X, post2Y, true);
        post2.gateId = gate.id;
        post2.gatePostIndex = 2;
    });
    
    // Step 3: Classify nodes by degree and angle
    nodes.forEach(node => {
        // GATE POST DOMINANCE: Gate posts override all other classifications
        if (node.gatePost) {
            node.type = 'GATE_POST';
            node.color = '#A855F7'; // Purple for gate posts
            return;
        }
        
        const degree = node.connectedEdges.length;
        
        if (degree === 1) {
            node.type = 'END';
            node.color = '#22C55E'; // Green for end posts
        } else if (degree === 2) {
            // Check if it's a corner (angle change)
            const isCorner = checkIfCorner(node, edges, nodes);
            if (isCorner) {
                node.type = 'CORNER';
                node.color = '#DC2626'; // Red for corner posts
            } else {
                node.type = 'LINE';
                node.color = '#3B82F6'; // Blue for line posts
            }
        } else {
            // 3+ connections = intersection corner
            node.type = 'CORNER';
            node.color = '#DC2626'; // Red for corner/junction posts
        }
    });
    
    return { nodes, edges };
}

/**
 * Check if degree-2 node is a corner (angle change)
 */
function checkIfCorner(node, edges, nodes) {
    if (node.connectedEdges.length !== 2) return false;
    
    const edge1 = edges[node.connectedEdges[0]];
    const edge2 = edges[node.connectedEdges[1]];
    
    // Get vectors
    const otherNode1 = nodes[edge1.startNodeId === node.id ? edge1.endNodeId : edge1.startNodeId];
    const otherNode2 = nodes[edge2.startNodeId === node.id ? edge2.endNodeId : edge2.startNodeId];
    
    const v1x = otherNode1.x - node.x;
    const v1y = otherNode1.y - node.y;
    const v2x = otherNode2.x - node.x;
    const v2y = otherNode2.y - node.y;
    
    // Calculate angle between vectors
    const dot = v1x * v2x + v1y * v2y;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
    
    if (mag1 === 0 || mag2 === 0) return false;
    
    const cosAngle = dot / (mag1 * mag2);
    const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
    
    // If angle > 15 degrees, it's a corner
    return angleDeg > 15;
}

/**
 * Compute TERMINAL post counts from graph (end, corner, gate)
 * DOES NOT compute line posts - those come from map only
 */
function computeTerminalPostCounts(graph, gates) {
    const { nodes } = graph;
    
    // Count nodes by type
    let endPosts = 0;
    let cornerPosts = 0;
    let gatePostNodes = 0;
    
    nodes.forEach(node => {
        if (node.gatePost || node.type === 'GATE_POST') {
            gatePostNodes++;
        } else if (node.type === 'END') {
            endPosts++;
        } else if (node.type === 'CORNER') {
            cornerPosts++;
        }
    });
    
    return {
        endPosts,
        cornerPosts,
        gatePosts: gatePostNodes
    };
}

/**
 * Compute aluminum panels from graph edges
 */
function computeAluminumPanels(graph) {
    const { edges } = graph;
    let totalPanels = 0;
    
    edges.forEach(edge => {
        const segmentLength = edge.lengthFt;
        if (segmentLength <= 0) return;
        
        // Equalized panels (max 6 ft)
        const nPanels = Math.ceil(segmentLength / MAX_ALUMINUM_PANEL_FT);
        totalPanels += nPanels;
    });
    
    return totalPanels;
}

/**
 * Count posts by type from authoritative posts array (postLayoutEngine output)
 * SINGLE SOURCE OF TRUTH - no formula calculations
 */
function countPostsFromMap(posts, materialType) {
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
        return {
            linePosts: 0,
            endPosts: 0,
            cornerPosts: 0,
            gatePosts: 0
        };
    }
    
    let linePosts = 0;
    let endPosts = 0;
    let cornerPosts = 0;
    let gatePosts = 0;
    
    posts.forEach(post => {
        // Posts from postLayoutEngine have kind: 'line', 'gate', 'end', 'corner', etc.
        if (post.kind === 'line') {
            linePosts++;
        } else if (post.kind === 'gate' || post.isGatePost) {
            gatePosts++;
        } else if (post.kind === 'end') {
            endPosts++;
        } else if (post.kind === 'corner' || post.kind === 'junction') {
            cornerPosts++;
        }
    });
    
    return { linePosts, endPosts, cornerPosts, gatePosts };
}

/**
 * Get tension bands per side based on fence height
 */
function getChainLinkBandsPerHeight(heightFt) {
    if (heightFt <= 4) return 5;
    if (heightFt <= 5) return 6;
    if (heightFt <= 6) return 7;
    if (heightFt <= 7) return 8;
    return 9;
}

/**
 * Normalize color for vinyl keys - blocks wood finishes from leaking in
 */
function normColorForKey(color) {
  const c = String(color || "").trim().toLowerCase().replace(/\s+/g, "_");
  const BLOCKED = new Set(["pine", "cedar", "redwood", "treated", "pt", "pressure_treated"]);
  if (!c || BLOCKED.has(c)) return "white";
  return c;
}

function vinylColorSuffixUnderscore(color) {
  return `_${normColorForKey(color)}`;
}

/**
 * Generate VINYL material line items from post counts
 * EMITS ROLES, NOT UCKSF - Role→UCK mapping applied downstream
 */
function generateVinylMaterials(job, runs, fenceLines, gates, postCounts, graph) {
  const materials = [];
  const height = job.fenceHeight;
  const color = normColorForKey(job.fenceColor);
  
  // Get fence system from job (CRITICAL: must match FenceSystemConfig)
  const fenceSystem = job.fenceSystem || 'savannah'; // Default to savannah if not set

  // Run-level materials (fence panels)
  runs.forEach(run => {
    const runLines = fenceLines.filter(l => l.assignedRunId === run.id);
    const runLF = runLines.reduce((sum, l) => sum + (l.manualLengthFt || 0), 0);

    if (runLF <= 0) return;

    const panels = Math.ceil(runLF / 8);
    const heightNum = run.fenceHeight.replace("'", '');
    const panelColor = normColorForKey(run.fenceColor || job.fenceColor);
    
    materials.push({
      canonical_key: ensureCanonicalKeyString(
        toCatalogKey(KeySchemas.vinyl.panelPrivacy({ heightIn: parseInt(heightNum) * 12, style: 'savannah', color: panelColor })),
        `invalid_vinyl_panel_${heightNum}ft`
      ),
      runLabel: run.runLabel,
      lineItemName: `${run.fenceHeight} ${run.style} Vinyl Panels`,
      materialDescription: `${run.fenceHeight} ${run.style} Vinyl Panels`,
      quantityCalculated: panels,
      uom: 'each',
      notes: `${panels} panels for ${runLF.toFixed(1)} LF`,
      source: 'map'
    });
  });
    
    // Overall section - ALL vinyl posts EXCEPT GATE POSTS need galvanized support posts
    // Gate posts use aluminum I-beams instead of galvanized support posts
    const allVinylPosts = postCounts.endPosts + postCounts.cornerPosts + postCounts.linePosts;

    if (allVinylPosts > 0) {
      materials.push({
        canonical_key: ensureCanonicalKeyString(
          toCatalogKey(KeySchemas.vinyl.reinforcePost()),
          'invalid_vinyl_reinforce_post'
        ),
        runLabel: 'Overall',
        lineItemName: '2.5" Galvanized Support Post',
        materialDescription: '2.5" Galvanized Support Post',
        quantityCalculated: allVinylPosts,
        uom: 'each',
        notes: `${postCounts.endPosts} end + ${postCounts.cornerPosts} corner + ${postCounts.linePosts} line = ${allVinylPosts} support posts (gate posts excluded)`,
        source: 'map'
      });

      materials.push({
        canonical_key: ensureCanonicalKeyString(
          toCatalogKey(KeySchemas.vinyl.noDigDonut()),
          'invalid_vinyl_nodig_donut'
        ),
        runLabel: 'Overall',
        lineItemName: 'No-Dig Donuts',
        materialDescription: 'No-Dig Donuts',
        quantityCalculated: allVinylPosts * 2,
        uom: 'each',
        notes: `${allVinylPosts} posts × 2 = ${allVinylPosts * 2} donuts`,
        source: 'map'
      });
    }

    // Vinyl posts by type
    const totalVinylPosts = postCounts.endPosts + postCounts.cornerPosts + postCounts.gatePosts + postCounts.linePosts;
    
    const heightIn = parseInt(height.replace("'", '')) * 12;
    
    if (postCounts.endPosts > 0) {
      materials.push({
        canonical_key: ensureCanonicalKeyString(
          toCatalogKey(KeySchemas.vinyl.post({ color, size: '5x5' })),
          'invalid_vinyl_post_end'
        ),
        runLabel: 'Overall',
        lineItemName: '5x5 Vinyl End Post',
        materialDescription: '5x5 Vinyl End Post',
        quantityCalculated: postCounts.endPosts,
        uom: 'each',
        notes: `${postCounts.endPosts} end posts`,
        source: 'map'
      });
    }

    if (postCounts.cornerPosts > 0) {
      materials.push({
        canonical_key: ensureCanonicalKeyString(
          toCatalogKey(KeySchemas.vinyl.post({ color, size: '5x5' })),
          'invalid_vinyl_post_corner'
        ),
        runLabel: 'Overall',
        lineItemName: '5x5 Vinyl Corner Post',
        materialDescription: '5x5 Vinyl Corner Post',
        quantityCalculated: postCounts.cornerPosts,
        uom: 'each',
        notes: `${postCounts.cornerPosts} corner posts`,
        source: 'map'
      });
    }

    if (postCounts.linePosts > 0) {
      materials.push({
        canonical_key: ensureCanonicalKeyString(
          toCatalogKey(KeySchemas.vinyl.post({ color, size: '5x5' })),
          'invalid_vinyl_post_line'
        ),
        runLabel: 'Overall',
        lineItemName: '5x5 Vinyl Line Post',
        materialDescription: '5x5 Vinyl Line Post',
        quantityCalculated: postCounts.linePosts,
        uom: 'each',
        notes: `${postCounts.linePosts} line posts`,
        source: 'map'
      });
    }

    // Post caps - ALL vinyl posts need caps
    if (totalVinylPosts > 0) {
      materials.push({
        canonical_key: ensureCanonicalKeyString(
          toCatalogKey(KeySchemas.vinyl.capNewEngland({ color })),
          'invalid_vinyl_cap'
        ),
        runLabel: 'Overall',
        lineItemName: 'Vinyl Post Caps',
        materialDescription: 'Vinyl Post Caps',
        quantityCalculated: totalVinylPosts,
        uom: 'each',
        notes: `1 per post (${totalVinylPosts} posts)`,
        source: 'map'
      });
    }
    
    // Gate posts and hardware - gates are ALREADY deduplicated by buildVinylTakeoff
    if (gates.length > 0) {
      console.log('[generateVinylMaterials] Gate materials - gates already deduplicated:', {
        gatesCount: gates.length,
        gateDetails: gates.map(g => ({ id: g.id, type: g.gateType, width_ft: g.gateWidth_ft }))
      });

      const totalGatePosts = gates.length * 2;

      // CRITICAL DEBUG: Log gate post calculation
      console.log('[generateVinylMaterials] Gate post calculation:', {
        totalGates: gates.length,
        totalGatePostsCalculated: totalGatePosts,
        postCountsGatePosts: postCounts.gatePosts
      });

      const gateHeightIn = parseInt(height.replace("'", '')) * 12;
      
      materials.push({
        canonical_key: ensureCanonicalKeyString(
          toCatalogKey(KeySchemas.vinyl.post({ color, size: '5x5' })),
          'invalid_vinyl_post_gate'
        ),
        runLabel: 'Gates',
        lineItemName: '5x5 Vinyl Gate Post',
        materialDescription: '5x5 Vinyl Gate Post',
        quantityCalculated: totalGatePosts,
        uom: 'each',
        notes: `${gates.length} gates × 2 = ${totalGatePosts} gate posts`,
        source: 'map'
      });
        
        const singleGates = gates.filter(g => g.gateType === 'Single');
        const doubleGates = gates.filter(g => g.gateType === 'Double');

        console.log('[generateVinylMaterials] Gate breakdown:', {
          totalGates: gates.length,
          singleGates: singleGates.length,
          doubleGates: doubleGates.length,
          singleDetails: singleGates.map(g => ({ id: g.id, width_ft: g.gateWidth_ft })),
          doubleDetails: doubleGates.map(g => ({ id: g.id, width_ft: g.gateWidth_ft }))
        });

        // Gates by width and type
        const gates4ft = singleGates.filter(g => g.gateWidth_ft === 4).length;
        const gates5ft = singleGates.filter(g => g.gateWidth_ft === 5).length;
        const gates6ft = singleGates.filter(g => g.gateWidth_ft === 6).length;
        const gates8ft = doubleGates.filter(g => g.gateWidth_ft === 8).length;
        const gates10ft = doubleGates.filter(g => g.gateWidth_ft === 10).length;
        const gates12ft = doubleGates.filter(g => g.gateWidth_ft === 12).length;

        // Vinyl gates - catalog format: vinyl_gate_single_62_khaki_6ft
        if (gates4ft > 0) {
            materials.push({
              canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.vinyl.gate({ swing: 'single', widthIn: 44.5, heightIn: gateHeightIn, color })),
                'invalid_vinyl_gate_4ft'
              ),
              runLabel: 'Gates',
              lineItemName: `${height} x 4' Vinyl Gate`,
              materialDescription: `${height} x 4' Vinyl Gate`,
              quantityCalculated: gates4ft,
              uom: 'each',
              notes: `${gates4ft} single gates`,
              source: 'map'
            });
          }
          if (gates5ft > 0) {
            materials.push({
              canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.vinyl.gate({ swing: 'single', widthIn: 62.5, heightIn: gateHeightIn, color })),
                'invalid_vinyl_gate_5ft'
              ),
              runLabel: 'Gates',
              lineItemName: `${height} x 5' Vinyl Gate`,
              materialDescription: `${height} x 5' Vinyl Gate`,
              quantityCalculated: gates5ft,
              uom: 'each',
              notes: `${gates5ft} single gates`,
              source: 'map'
            });
          }
          if (gates6ft > 0) {
            materials.push({
              canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.vinyl.gate({ swing: 'single', widthIn: 68.5, heightIn: gateHeightIn, color })),
                'invalid_vinyl_gate_6ft'
              ),
              runLabel: 'Gates',
              lineItemName: `${height} x 6' Vinyl Gate`,
              materialDescription: `${height} x 6' Vinyl Gate`,
              quantityCalculated: gates6ft,
              uom: 'each',
              notes: `${gates6ft} single gates`,
              source: 'map'
            });
          }
          if (gates8ft > 0) {
            materials.push({
              canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.vinyl.gate({ swing: 'double', widthIn: 38.5, heightIn: gateHeightIn, color })),
                'invalid_vinyl_gate_8ft'
              ),
              runLabel: 'Gates',
              lineItemName: `${height} x 8' Vinyl Gate (Double)`,
              materialDescription: `${height} x 8' Vinyl Gate (Double)`,
              quantityCalculated: gates8ft,
              uom: 'each',
              notes: `${gates8ft} double gates`,
              source: 'map'
            });
          }
          if (gates10ft > 0) {
            materials.push({
              canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.vinyl.gate({ swing: 'double', widthIn: 44.5, heightIn: gateHeightIn, color })),
                'invalid_vinyl_gate_10ft'
              ),
              runLabel: 'Gates',
              lineItemName: `${height} x 10' Vinyl Gate (Double)`,
              materialDescription: `${height} x 10' Vinyl Gate (Double)`,
              quantityCalculated: gates10ft,
              uom: 'each',
              notes: `${gates10ft} double gates`,
              source: 'map'
            });
          }
          if (gates12ft > 0) {
            materials.push({
              canonical_key: ensureCanonicalKeyString(
                toCatalogKey(KeySchemas.vinyl.gate({ swing: 'double', widthIn: 62.5, heightIn: gateHeightIn, color })),
                'invalid_vinyl_gate_12ft'
              ),
              runLabel: 'Gates',
              lineItemName: `${height} x 12' Vinyl Gate (Double)`,
              materialDescription: `${height} x 12' Vinyl Gate (Double)`,
              quantityCalculated: gates12ft,
              uom: 'each',
              notes: `${gates12ft} double gates`,
              source: 'map'
            });
          }

        // Gate hardware
        const totalHingeSets = singleGates.length + (doubleGates.length * 2);
        materials.push({
          canonical_key: ensureCanonicalKeyString(
            toCatalogKey(KeySchemas.vinyl.hingeSet()),
            'invalid_vinyl_hinge_set'
          ),
          runLabel: 'Gates',
          lineItemName: 'Vinyl Gate Hinges',
          materialDescription: 'Vinyl Gate Hinges',
          quantityCalculated: totalHingeSets,
          uom: 'set',
          notes: `${singleGates.length} single + ${doubleGates.length} double × 2 = ${totalHingeSets} sets`,
          source: 'map'
        });

        // Gate latches
        const totalSingleGateLatches = gates4ft + gates5ft + gates6ft;
        if (totalSingleGateLatches > 0) {
          materials.push({
            canonical_key: ensureCanonicalKeyString(
              toCatalogKey(KeySchemas.vinyl.latchPro({ size: '5in' })),
              'invalid_vinyl_latch_5in'
            ),
            runLabel: 'Gates',
            lineItemName: '5" Locklatch Pro',
            materialDescription: '5" Locklatch Pro',
            quantityCalculated: totalSingleGateLatches,
            uom: 'each',
            notes: `${totalSingleGateLatches} single gates`,
            source: 'map'
          });
        }
        if (doubleGates.length > 0) {
          materials.push({
            canonical_key: ensureCanonicalKeyString(
              toCatalogKey(KeySchemas.vinyl.latchPro({ size: '4in' })),
              'invalid_vinyl_latch_4in'
            ),
            runLabel: 'Gates',
            lineItemName: '4" Locklatch Pro',
            materialDescription: '4" Locklatch Pro',
            quantityCalculated: doubleGates.length,
            uom: 'each',
            notes: `${doubleGates.length} double gates`,
            source: 'map'
          });
        }

        // Cane bolts for double gates
        if (doubleGates.length > 0) {
          materials.push({
            canonical_key: ensureCanonicalKeyString(
              toCatalogKey(KeySchemas.vinyl.caneBolt()),
              'invalid_vinyl_cane_bolt'
            ),
            runLabel: 'Gates',
            lineItemName: 'Cane Bolts',
            materialDescription: 'Cane Bolts',
            quantityCalculated: doubleGates.length * 2,
            uom: 'each',
            notes: `${doubleGates.length} double gates × 2 = ${doubleGates.length * 2} bolts`,
            source: 'map'
          });
        }
        }
    
    return materials;
}