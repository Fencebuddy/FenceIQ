/**
 * GATE POST SNAP & REPLACE ENGINE
 * 
 * Handles gate post snapping to existing posts and replacement logic.
 * Ensures no overlapping posts and proper material count updates.
 * 
 * RULES:
 * - Gate posts CAN snap to posts within tolerance (OPTIONAL, not forced)
 * - Gate posts REPLACE intersected posts (no overlap)
 * - Perfect fit: 12' gate in 12' space snaps to BOTH line ends
 * - Priority: GATE > CORNER > END > LINE
 * - Material counts update immediately
 */

const SNAP_TOLERANCE_PX = 30; // Pixels for post snapping (optional snap radius)
const PERFECT_FIT_TOLERANCE_FT = 0.25; // Perfect fit detection (3 inches)

/**
 * Find all posts that should snap to gate posts
 * SNAPS TO: End posts, Corner posts (terminal posts)
 * DOES NOT SNAP TO: Line posts
 * PERFECT FIT: 12' gate in 12' space snaps to BOTH ends
 * 
 * @param {Array} jobPosts - All posts from postLayoutEngine
 * @param {Object} gatePost1 - First gate post {x, y}
 * @param {Object} gatePost2 - Second gate post {x, y}
 * @param {Object} fenceLine - Fence line object for perfect fit detection
 * @param {Number} gateWidthFt - Gate width in feet
 * @returns {Object} { post1Snap, post2Snap, isPerfectFit } - snap targets
 */
export function findGatePostSnaps(jobPosts, gatePost1, gatePost2, fenceLine = null, gateWidthFt = null) {
    if (!jobPosts || jobPosts.length === 0) {
        return { post1Snap: null, post2Snap: null, isPerfectFit: false };
    }

    // PERFECT FIT DETECTION: Gate exactly fits segment (snap to BOTH ends)
    let isPerfectFit = false;
    if (fenceLine && gateWidthFt && fenceLine.manualLengthFt) {
        const lineLengthFt = fenceLine.manualLengthFt;
        const fitDiff = Math.abs(lineLengthFt - gateWidthFt);
        
        if (fitDiff < PERFECT_FIT_TOLERANCE_FT) {
            // Perfect fit - snap to BOTH line endpoints
            isPerfectFit = true;
            
            // Find posts at line start and end
            let startPost = null;
            let endPost = null;
            let minStartDist = 20; // Small tolerance for line endpoints
            let minEndDist = 20;
            
            jobPosts.forEach(post => {
                // Distance to line start
                const distStart = Math.sqrt(
                    Math.pow(post.x - fenceLine.start.x, 2) + 
                    Math.pow(post.y - fenceLine.start.y, 2)
                );
                if (distStart < minStartDist) {
                    minStartDist = distStart;
                    startPost = post;
                }
                
                // Distance to line end
                const distEnd = Math.sqrt(
                    Math.pow(post.x - fenceLine.end.x, 2) + 
                    Math.pow(post.y - fenceLine.end.y, 2)
                );
                if (distEnd < minEndDist) {
                    minEndDist = distEnd;
                    endPost = post;
                }
            });
            
            return { post1Snap: startPost, post2Snap: endPost, isPerfectFit: true };
        }
    }

    // SELECTIVE SNAPPING: Snap to END and CORNER posts only (NOT line posts)
    let post1Snap = null;
    let post2Snap = null;
    let post1MinDist = SNAP_TOLERANCE_PX;
    let post2MinDist = SNAP_TOLERANCE_PX;

    jobPosts.forEach(post => {
        // CRITICAL: Only snap to terminal posts (end, corner), NOT line posts
        const isTerminalPost = 
            post.kind === 'end' || 
            post.kind === 'corner' || 
            post.kind === 'junction' ||
            post.terminalType === 'end' || 
            post.terminalType === 'corner';
        
        // Skip gate posts
        if (post.kind === 'gate' || post.terminalType === 'gate' || post.isGatePost) {
            return;
        }
        
        // Skip line posts
        if (post.kind === 'line' || post.kind === 'inline') {
            return;
        }

        // Check distance to gate post 1
        const dist1 = Math.sqrt(
            Math.pow(post.x - gatePost1.x, 2) + 
            Math.pow(post.y - gatePost1.y, 2)
        );
        if (dist1 < post1MinDist) {
            post1MinDist = dist1;
            post1Snap = post;
        }

        // Check distance to gate post 2
        const dist2 = Math.sqrt(
            Math.pow(post.x - gatePost2.x, 2) + 
            Math.pow(post.y - gatePost2.y, 2)
        );
        if (dist2 < post2MinDist) {
            post2MinDist = dist2;
            post2Snap = post;
        }
    });

    console.log('[gatePostSnapEngine] Snap detection:', {
        post1Found: post1Snap ? `${post1Snap.kind} at ${post1MinDist.toFixed(1)}px` : 'none',
        post2Found: post2Snap ? `${post2Snap.kind} at ${post2MinDist.toFixed(1)}px` : 'none',
        isPerfectFit,
        totalPosts: jobPosts.length,
        terminalPosts: jobPosts.filter(p => p.kind === 'end' || p.kind === 'corner').length
    });

    // CRITICAL: Prevent both gate posts from snapping to the SAME post
    if (post1Snap && post2Snap && post1Snap.id === post2Snap.id) {
        // Pick closest gate post, clear the other
        if (post1MinDist <= post2MinDist) {
            post2Snap = null;
        } else {
            post1Snap = null;
        }
    }

    return { post1Snap, post2Snap, isPerfectFit };
}

/**
 * Apply snapping to gate posts
 * @param {Object} gatePost1 - {x, y}
 * @param {Object} gatePost2 - {x, y}
 * @param {Object} snapResult - { post1Snap, post2Snap }
 * @returns {Object} { snappedPost1, snappedPost2 } - Updated coordinates
 */
export function applyGatePostSnapping(gatePost1, gatePost2, snapResult) {
    const snappedPost1 = snapResult.post1Snap 
        ? { x: snapResult.post1Snap.x, y: snapResult.post1Snap.y }
        : gatePost1;

    const snappedPost2 = snapResult.post2Snap
        ? { x: snapResult.post2Snap.x, y: snapResult.post2Snap.y }
        : gatePost2;

    return { snappedPost1, snappedPost2 };
}

/**
 * Replace existing posts with gate posts
 * @param {Array} jobPosts - All posts from postLayoutEngine
 * @param {Object} snapResult - { post1Snap, post2Snap }
 * @param {String} gateId - ID of gate for tracking
 * @returns {Array} Updated posts array with replacements
 */
export function replacePostsWithGatePosts(jobPosts, snapResult, gateId) {
    if (!jobPosts || jobPosts.length === 0) {
        return jobPosts;
    }

    const postsToReplace = [];
    if (snapResult.post1Snap) postsToReplace.push(snapResult.post1Snap.id);
    if (snapResult.post2Snap) postsToReplace.push(snapResult.post2Snap.id);

    if (postsToReplace.length === 0) {
        return jobPosts; // No replacement needed
    }

    // Replace posts: change kind to 'gate', preserve position
    return jobPosts.map(post => {
        if (postsToReplace.includes(post.id)) {
            return {
                ...post,
                kind: 'terminal',
                terminalType: 'gate',
                color: '#A855F7', // Purple for gate posts
                replacedFrom: post.kind || post.terminalType || 'unknown', // Track what was replaced
                gateId: gateId // Link to gate
            };
        }
        return post;
    });
}

/**
 * Calculate post count changes from replacement
 * @param {Object} snapResult - { post1Snap, post2Snap }
 * @returns {Object} { cornerDelta, endDelta, lineDelta, gateDelta }
 */
export function calculatePostCountDeltas(snapResult) {
    let cornerDelta = 0;
    let endDelta = 0;
    let lineDelta = 0;
    let gateDelta = 0;

    [snapResult.post1Snap, snapResult.post2Snap].forEach(post => {
        if (!post) {
            // New gate post (not replacing anything)
            gateDelta += 1;
        } else {
            // Replacing existing post
            if (post.kind === 'corner' || post.terminalType === 'corner') {
                cornerDelta -= 1;
                gateDelta += 1;
            } else if (post.kind === 'end' || post.terminalType === 'end') {
                endDelta -= 1;
                gateDelta += 1;
            } else if (post.kind === 'line') {
                lineDelta -= 1;
                gateDelta += 1;
            } else {
                // Unknown type - still count as gate post added
                gateDelta += 1;
            }
        }
    });

    return { cornerDelta, endDelta, lineDelta, gateDelta };
}

/**
 * Remove posts within gate opening (between gate posts)
 * @param {Array} jobPosts - All posts
 * @param {Object} gatePost1 - {x, y}
 * @param {Object} gatePost2 - {x, y}
 * @param {Number} gateWidthFt - Gate width in feet
 * @returns {Array} Posts with gate-internal posts removed
 */
export function removePostsInGateOpening(jobPosts, gatePost1, gatePost2, gateWidthFt) {
    // Calculate gate opening line segment
    const gateVector = {
        x: gatePost2.x - gatePost1.x,
        y: gatePost2.y - gatePost1.y
    };
    const gateLength = Math.sqrt(gateVector.x ** 2 + gateVector.y ** 2);
    
    if (gateLength === 0) return jobPosts;

    // Filter out posts that are within the gate opening
    return jobPosts.filter(post => {
        // Don't remove gate posts themselves
        if (post.kind === 'gate' || post.terminalType === 'gate') {
            return true;
        }

        // Check if post is between gate posts
        const toPost = {
            x: post.x - gatePost1.x,
            y: post.y - gatePost1.y
        };

        // Project onto gate vector
        const dot = (toPost.x * gateVector.x + toPost.y * gateVector.y) / (gateLength ** 2);
        
        // If projection is between 0 and 1, and distance to line is small, remove it
        if (dot > 0.05 && dot < 0.95) {
            const projX = gatePost1.x + dot * gateVector.x;
            const projY = gatePost1.y + dot * gateVector.y;
            const distToLine = Math.sqrt(
                Math.pow(post.x - projX, 2) + 
                Math.pow(post.y - projY, 2)
            );
            
            // Remove if very close to gate line (within 5px tolerance)
            if (distToLine < 5) {
                return false; // Remove this post
            }
        }

        return true; // Keep post
    });
}

/**
 * Calculate adjusted gate position based on snapping
 * @param {Object} gate - Gate object with x, y, width, rotation
 * @param {Object} fenceLine - Fence line object
 * @param {Object} snapResult - { post1Snap, post2Snap }
 * @returns {Object} { centerX, centerY, centerFt } - Adjusted gate center
 */
export function calculateSnappedGateCenter(gate, fenceLine, snapResult) {
    // If both posts snap, use their midpoint
    if (snapResult.post1Snap && snapResult.post2Snap) {
        const centerX = (snapResult.post1Snap.x + snapResult.post2Snap.x) / 2;
        const centerY = (snapResult.post1Snap.y + snapResult.post2Snap.y) / 2;
        
        // Calculate center distance in feet
        const dx = fenceLine.end.x - fenceLine.start.x;
        const dy = fenceLine.end.y - fenceLine.start.y;
        const linePixels = Math.sqrt(dx * dx + dy * dy);
        const lineFeet = fenceLine.manualLengthFt || fenceLine.length || 0;
        
        if (linePixels === 0 || lineFeet === 0) {
            return { centerX: gate.x, centerY: gate.y, centerFt: gate.snapPositionFt || 0 };
        }
        
        const centerDx = centerX - fenceLine.start.x;
        const centerDy = centerY - fenceLine.start.y;
        const centerPixelDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
        const centerFt = (centerPixelDist / linePixels) * lineFeet;
        
        return { centerX, centerY, centerFt };
    }
    
    // If only one post snaps, adjust center to maintain gate width
    if (snapResult.post1Snap || snapResult.post2Snap) {
        const snappedPost = snapResult.post1Snap || snapResult.post2Snap;
        const gateWidthFt = parseFloat(gate.width?.replace(/'/g, '')) || 4;
        const halfWidthFt = gateWidthFt / 2;
        
        // Calculate line direction
        const dx = fenceLine.end.x - fenceLine.start.x;
        const dy = fenceLine.end.y - fenceLine.start.y;
        const linePixels = Math.sqrt(dx * dx + dy * dy);
        const lineFeet = fenceLine.manualLengthFt || fenceLine.length || 0;
        
        if (linePixels === 0 || lineFeet === 0) {
            return { centerX: gate.x, centerY: gate.y, centerFt: gate.snapPositionFt || 0 };
        }
        
        const pixelsPerFt = linePixels / lineFeet;
        const dirX = dx / linePixels;
        const dirY = dy / linePixels;
        
        // Calculate center based on which post snapped
        const offsetPixels = halfWidthFt * pixelsPerFt;
        const centerX = snapResult.post1Snap 
            ? snappedPost.x + dirX * offsetPixels
            : snappedPost.x - dirX * offsetPixels;
        const centerY = snapResult.post1Snap
            ? snappedPost.y + dirY * offsetPixels
            : snappedPost.y - dirY * offsetPixels;
        
        // Calculate center distance in feet
        const centerDx = centerX - fenceLine.start.x;
        const centerDy = centerY - fenceLine.start.y;
        const centerPixelDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
        const centerFt = (centerPixelDist / linePixels) * lineFeet;
        
        return { centerX, centerY, centerFt };
    }
    
    // No snapping - return original gate position
    return { 
        centerX: gate.x, 
        centerY: gate.y, 
        centerFt: gate.snapPositionFt || 0 
    };
}