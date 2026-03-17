/**
 * POST LAYOUT ENGINE
 * Pure post generation based on material spacing rules
 * NO overlays - generates REAL post objects
 * GATE POST SNAP & REPLACE: Gate posts snap to and replace existing posts
 */

import { 
    findGatePostSnaps, 
    applyGatePostSnapping, 
    replacePostsWithGatePosts,
    removePostsInGateOpening
} from '../gates/gatePostSnapEngine';

const SNAP_TOLERANCE_PX = 30; // Merge nodes within this distance
const OVERLAP_TOLERANCE_FT = 0.25; // Gate posts replace line posts within 3 inches

/**
 * Material spacing rules
 */
const MATERIAL_SPACING = {
  'Vinyl': { maxSpanFt: 8, label: '8\' Panel' },
  'Chain Link': { maxSpanFt: 10, label: '10\' Line Post' },
  'Wood': { maxSpanFt: 8, label: '8\' Bay' },
  'Aluminum': { maxSpanFt: 6, label: '6\' Panel' }
};

/**
 * Generate complete post layout for all fence lines
 * @param {Object} params
 * @param {Array} params.fenceLines - Array of drawn fence lines
 * @param {Array} params.runs - Array of run objects
 * @param {Array} params.gates - Array of gate objects
 * @param {string} params.materialMode - Current material type
 * @param {number} params.pixelsPerFt - Scale factor
 * @returns {Object} { posts: Post[], segments: SegmentDebug[] }
 */
export function generatePostLayout({ fenceLines, runs, gates, materialMode, pixelsPerFt }) {
  if (!fenceLines || fenceLines.length === 0) {
    return { posts: [], segments: [], spacingLabels: [] };
  }

  // Get spacing rule for material
  const spacingRule = MATERIAL_SPACING[materialMode] || MATERIAL_SPACING['Vinyl'];
  const maxSpanFt = spacingRule.maxSpanFt;

  // Step 1: Build terminal nodes from geometry
  const nodes = [];
  const nodeMap = new Map(); // key -> node
  
  const getNodeKey = (x, y) => `${Math.round(x)},${Math.round(y)}`;
  
  const findOrCreateNode = (x, y, runId, isGatePost = false) => {
    const key = getNodeKey(x, y);
    
    // Check for nearby nodes (snap tolerance)
    for (const [existingKey, node] of nodeMap.entries()) {
      const dist = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
      if (dist < SNAP_TOLERANCE_PX) {
        // Found nearby node - update it
        if (isGatePost) node.isGatePost = true;
        if (runId && !node.runIds.includes(runId)) {
          node.runIds.push(runId);
        }
        return node;
      }
    }
    
    // Create new node
    const newNode = {
      id: nodes.length,
      x,
      y,
      runIds: runId ? [runId] : [],
      connectedLines: [],
      isGatePost,
      kind: 'unknown' // Will classify later
    };
    
    nodes.push(newNode);
    nodeMap.set(key, newNode);
    return newNode;
  };

  // Process fence lines to create terminal nodes
  fenceLines.forEach((line, lineIdx) => {
    if (!line.assignedRunId) return; // Skip unassigned lines
    
    const startNode = findOrCreateNode(line.start.x, line.start.y, line.assignedRunId);
    const endNode = findOrCreateNode(line.end.x, line.end.y, line.assignedRunId);
    
    startNode.connectedLines.push(lineIdx);
    endNode.connectedLines.push(lineIdx);
  });

  // Add gate posts as terminal nodes with SNAP & REPLACE
  gates.forEach(gate => {
    if (!gate.runId || !gate.gateWidth_ft) return;
    
    const gateLine = fenceLines.find(line => line.assignedRunId === gate.runId);
    if (!gateLine) return;
    
    // Calculate gate post positions
    const dx = gateLine.end.x - gateLine.start.x;
    const dy = gateLine.end.y - gateLine.start.y;
    const linePixels = Math.sqrt(dx * dx + dy * dy);
    const lineFeet = gateLine.manualLengthFt || 0;
    
    if (linePixels === 0 || lineFeet === 0) return;
    
    const scale = linePixels / lineFeet;
    const dirX = dx / linePixels;
    const dirY = dy / linePixels;
    
    const centerFt = gate.gateCenterDistance_ft || (lineFeet / 2);
    const halfWidthFt = gate.gateWidth_ft / 2;
    
    const post1DistPixels = (centerFt - halfWidthFt) * scale;
    const post2DistPixels = (centerFt + halfWidthFt) * scale;
    
    const post1X = gateLine.start.x + dirX * post1DistPixels;
    const post1Y = gateLine.start.y + dirY * post1DistPixels;
    const post2X = gateLine.start.x + dirX * post2DistPixels;
    const post2Y = gateLine.start.y + dirY * post2DistPixels;
    
    // CRITICAL: Force create BOTH gate posts - never snap gate posts from same gate together
    // Create post 1
    const gatePost1 = (() => {
      for (const [existingKey, node] of nodeMap.entries()) {
        const dist = Math.sqrt(Math.pow(node.x - post1X, 2) + Math.pow(node.y - post1Y, 2));
        if (dist < SNAP_TOLERANCE_PX && !node.isGatePost) {
          // Snap to existing NON-GATE post only
          node.isGatePost = true;
          node.gateId = gate.id;
          if (!node.runIds.includes(gate.runId)) node.runIds.push(gate.runId);
          return node;
        }
      }
      // Create new node
      const newNode = {
        id: nodes.length,
        x: post1X,
        y: post1Y,
        runIds: [gate.runId],
        connectedLines: [],
        isGatePost: true,
        gateId: gate.id,
        kind: 'gate'
      };
      nodes.push(newNode);
      nodeMap.set(getNodeKey(post1X, post1Y), newNode);
      return newNode;
    })();
    
    // Create post 2 - NEVER snap to post 1
    const gatePost2 = (() => {
      for (const [existingKey, node] of nodeMap.entries()) {
        if (node.id === gatePost1.id) continue; // CRITICAL: Skip post 1
        const dist = Math.sqrt(Math.pow(node.x - post2X, 2) + Math.pow(node.y - post2Y, 2));
        if (dist < SNAP_TOLERANCE_PX && !node.isGatePost) {
          // Snap to existing NON-GATE post only
          node.isGatePost = true;
          node.gateId = gate.id;
          if (!node.runIds.includes(gate.runId)) node.runIds.push(gate.runId);
          return node;
        }
      }
      // Create new node
      const newNode = {
        id: nodes.length,
        x: post2X,
        y: post2Y,
        runIds: [gate.runId],
        connectedLines: [],
        isGatePost: true,
        gateId: gate.id,
        kind: 'gate'
      };
      nodes.push(newNode);
      nodeMap.set(getNodeKey(post2X, post2Y), newNode);
      return newNode;
    })();
  });

  // Step 2: Classify nodes by connectivity
  nodes.forEach(node => {
    const degree = node.connectedLines.length;
    
    console.log('[PostLayout] Classifying node:', { 
      id: node.id, 
      x: node.x, 
      y: node.y, 
      degree, 
      connectedLines: node.connectedLines,
      isGatePost: node.isGatePost 
    });
    
    if (node.isGatePost) {
      node.kind = 'gate';
      node.color = '#A855F7'; // Purple for gate posts
    } else if (degree === 1) {
      node.kind = 'end';
      node.color = '#F97316'; // Orange for end-of-line posts
    } else if (degree === 2) {
      // Check if it's a corner (angle change)
      const isCorner = checkIfCorner(node, fenceLines);
      console.log('[PostLayout] Node degree=2, isCorner:', isCorner);
      if (isCorner) {
        node.kind = 'corner';
        node.color = '#DC2626'; // Red for corner posts
      } else {
        node.kind = 'inline';
        node.color = '#3B82F6'; // Blue for line posts
      }
    } else {
      node.kind = 'junction'; // 3+ connections (treat as corner)
      node.color = '#DC2626'; // Red for junctions
    }
    
    console.log('[PostLayout] Classified as:', node.kind, 'color:', node.color);
  });

  // Step 3: Build segments between terminal nodes, splitting at gates
  const segments = [];
  const processedPairs = new Set();
  
  fenceLines.forEach((line, lineIdx) => {
    if (!line.assignedRunId) return;
    
    const startNode = nodes.find(n => 
      Math.abs(n.x - line.start.x) < SNAP_TOLERANCE_PX && 
      Math.abs(n.y - line.start.y) < SNAP_TOLERANCE_PX
    );
    const endNode = nodes.find(n => 
      Math.abs(n.x - line.end.x) < SNAP_TOLERANCE_PX && 
      Math.abs(n.y - line.end.y) < SNAP_TOLERANCE_PX
    );
    
    if (!startNode || !endNode) return;
    
    // Find all gate posts on this line
    const gateNodesOnLine = nodes.filter(n => 
      n.isGatePost && 
      n.runIds.includes(line.assignedRunId) &&
      n.id !== startNode.id && 
      n.id !== endNode.id
    );
    
    if (gateNodesOnLine.length === 0) {
      // No gates - simple segment
      const pairKey = `${Math.min(startNode.id, endNode.id)}-${Math.max(startNode.id, endNode.id)}`;
      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);
        segments.push({
          id: segments.length,
          lineIdx,
          runId: line.assignedRunId,
          startNode,
          endNode,
          lengthFt: line.manualLengthFt || 0,
          lengthPx: Math.sqrt(
            Math.pow(line.end.x - line.start.x, 2) + 
            Math.pow(line.end.y - line.start.y, 2)
          )
        });
      }
    } else {
      // Split segment at gate posts
      const allNodesOnLine = [startNode, ...gateNodesOnLine, endNode];
      
      // Sort by distance along line
      const dx = line.end.x - line.start.x;
      const dy = line.end.y - line.start.y;
      const lineLen = Math.sqrt(dx * dx + dy * dy);
      
      allNodesOnLine.sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.x - line.start.x, 2) + Math.pow(a.y - line.start.y, 2));
        const distB = Math.sqrt(Math.pow(b.x - line.start.x, 2) + Math.pow(b.y - line.start.y, 2));
        return distA - distB;
      });
      
      // Create sub-segments between consecutive nodes
      for (let i = 0; i < allNodesOnLine.length - 1; i++) {
        const n1 = allNodesOnLine[i];
        const n2 = allNodesOnLine[i + 1];
        
        const pairKey = `${Math.min(n1.id, n2.id)}-${Math.max(n1.id, n2.id)}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);
        
        // Calculate sub-segment length
        const segLengthPx = Math.sqrt(Math.pow(n2.x - n1.x, 2) + Math.pow(n2.y - n1.y, 2));
        const segLengthFt = (line.manualLengthFt || 0) * (segLengthPx / lineLen);
        
        // Determine if this is a gate gap (both endpoints are gate posts from SAME gate)
        const isGateGap = n1.isGatePost && n2.isGatePost && n1.gateId && n1.gateId === n2.gateId;
        
        segments.push({
          id: segments.length,
          lineIdx,
          runId: line.assignedRunId,
          startNode: n1,
          endNode: n2,
          lengthFt: segLengthFt,
          lengthPx: segLengthPx,
          isGateGap // Mark gate gaps - no line posts within actual gate openings
        });
      }
    }
  });

  // Step 4: Generate posts for each segment
  const posts = [];
  const postMap = new Map(); // Deduplicate by position
  
  const addPost = (post) => {
    const key = getNodeKey(post.x, post.y);
    if (!postMap.has(key)) {
      postMap.set(key, post);
      posts.push(post);
    }
    return postMap.get(key);
  };

  // First pass: Add all terminal posts (including gate endpoints)
  segments.forEach(segment => {
    const { startNode, endNode, runId } = segment;
    
    // Add terminal posts
    addPost({
      id: `terminal-${startNode.id}`,
      x: startNode.x,
      y: startNode.y,
      runId,
      segmentId: segment.id,
      kind: startNode.kind,
      orderIndex: 0,
      t: 0,
      isGatePost: startNode.isGatePost,
      color: startNode.color,
      terminalType: startNode.isGatePost ? 'gate' : (startNode.kind === 'corner' ? 'corner' : (startNode.kind === 'end' ? 'end' : null))
    });
    
    addPost({
      id: `terminal-${endNode.id}`,
      x: endNode.x,
      y: endNode.y,
      runId,
      segmentId: segment.id,
      kind: endNode.kind,
      orderIndex: 999, // Will be updated
      t: 1,
      isGatePost: endNode.isGatePost,
      color: endNode.color,
      terminalType: endNode.isGatePost ? 'gate' : (endNode.kind === 'corner' ? 'corner' : (endNode.kind === 'end' ? 'end' : null))
    });
  });
  
  // Second pass: Add line posts between terminals (skip gate gaps)
  segments.forEach(segment => {
    const { startNode, endNode, lengthFt, lengthPx, runId, isGateGap } = segment;
    
    if (lengthFt <= 0 || isGateGap) return; // Skip gate gaps
    
    // Calculate equalized spacing for line posts
    const nSpans = Math.ceil(lengthFt / maxSpanFt);
    const equalizedSpanFt = lengthFt / nSpans;
    
    // Generate line posts (excluding endpoints)
    for (let i = 1; i < nSpans; i++) {
      const t = i / nSpans;
      const postX = startNode.x + (endNode.x - startNode.x) * t;
      const postY = startNode.y + (endNode.y - startNode.y) * t;
      
      addPost({
        id: `line-${segment.id}-${i}`,
        x: postX,
        y: postY,
        runId,
        segmentId: segment.id,
        kind: 'line',
        orderIndex: i,
        t,
        spacingFt: equalizedSpanFt,
        color: '#3B82F6',
        terminalType: null
      });
    }
    
    // Update end terminal post orderIndex
    const endTerminalKey = getNodeKey(endNode.x, endNode.y);
    const endTerminalPost = postMap.get(endTerminalKey);
    if (endTerminalPost) {
      endTerminalPost.orderIndex = nSpans;
    }
  });
  
  // Step 4.5: Deduplicate overlapping posts (gate posts replace line posts)
  deduplicatePosts(posts, postMap, pixelsPerFt);

  // Step 5: Generate spacing labels
  const spacingLabels = buildSpacingLabels(posts, segments, runs);

  return {
    posts,
    segments,
    spacingLabels
  };
}

/**
 * Deduplicate overlapping posts with priority: gate > corner > end > line
 */
function deduplicatePosts(posts, postMap, pixelsPerFt) {
  const overlapTolerancePx = OVERLAP_TOLERANCE_FT * pixelsPerFt;
  const postPriority = { gate: 4, corner: 3, junction: 3, end: 2, line: 1, inline: 0 };
  
  // Build spatial index for fast lookup
  const postsToRemove = new Set();
  
  for (let i = 0; i < posts.length; i++) {
    if (postsToRemove.has(i)) continue;
    
    const p1 = posts[i];
    
    for (let j = i + 1; j < posts.length; j++) {
      if (postsToRemove.has(j)) continue;
      
      const p2 = posts[j];
      
      // Check distance
      const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
      
      if (dist < overlapTolerancePx) {
        // Overlapping posts - keep higher priority
        const p1Priority = postPriority[p1.kind] || 0;
        const p2Priority = postPriority[p2.kind] || 0;
        
        if (p1Priority >= p2Priority) {
          postsToRemove.add(j);
          // Remove from postMap
          const key = `${Math.round(p2.x)},${Math.round(p2.y)}`;
          postMap.delete(key);
        } else {
          postsToRemove.add(i);
          // Remove from postMap
          const key = `${Math.round(p1.x)},${Math.round(p1.y)}`;
          postMap.delete(key);
          break; // p1 is removed, no need to check further
        }
      }
    }
  }
  
  // Remove marked posts (reverse order to maintain indices)
  const sortedToRemove = Array.from(postsToRemove).sort((a, b) => b - a);
  sortedToRemove.forEach(idx => posts.splice(idx, 1));
}

/**
 * Check if a degree-2 node is a corner (angle change)
 */
function checkIfCorner(node, fenceLines) {
  if (node.connectedLines.length !== 2) return false;
  
  const line1 = fenceLines[node.connectedLines[0]];
  const line2 = fenceLines[node.connectedLines[1]];
  
  if (!line1 || !line2) return false;
  
  // Get vectors from node to other endpoints
  const getVector = (line) => {
    const isStart = Math.abs(line.start.x - node.x) < SNAP_TOLERANCE_PX && 
                    Math.abs(line.start.y - node.y) < SNAP_TOLERANCE_PX;
    const otherX = isStart ? line.end.x : line.start.x;
    const otherY = isStart ? line.end.y : line.start.y;
    return { x: otherX - node.x, y: otherY - node.y };
  };
  
  const v1 = getVector(line1);
  const v2 = getVector(line2);
  
  // Calculate angle between vectors
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (mag1 === 0 || mag2 === 0) return false;
  
  const cosAngle = dot / (mag1 * mag2);
  const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
  
  // If angle > 15 degrees, it's a corner
  return angleDeg > 15;
}

/**
 * Build spacing labels from posts
 */
function buildSpacingLabels(posts, segments, runs) {
  const labels = [];
  
  segments.forEach(segment => {
    // Get posts for this segment, sorted by orderIndex
    const segmentPosts = posts
      .filter(p => p.segmentId === segment.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    
    // Find run for label positioning logic
    const run = runs?.find(r => r.id === segment.runId);
    const runLabel = run?.runLabel || '';
    
    // Create labels between adjacent posts
    for (let i = 0; i < segmentPosts.length - 1; i++) {
      const p1 = segmentPosts[i];
      const p2 = segmentPosts[i + 1];
      
      // Calculate distance in feet
      const distPx = Math.sqrt(
        Math.pow(p2.x - p1.x, 2) + 
        Math.pow(p2.y - p1.y, 2)
      );
      const distFt = segment.lengthFt * (distPx / segment.lengthPx);
      
      // Midpoint
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      
      // Calculate perpendicular offset based on run label
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      let perpX, perpY;
      
      if (runLabel === 'LEFT SIDE') {
        // Position on the RIGHT of the run line
        // Right is perpendicular clockwise: (dy/len, -dx/len)
        perpX = dy / len * 15;
        perpY = -dx / len * 15;
      } else if (runLabel === 'LEFT FRONT') {
        // Position ABOVE the run line
        // Above means negative Y offset
        perpX = 0;
        perpY = -25; // Fixed vertical offset above
      } else {
        // Default: perpendicular to the left (counter-clockwise)
        perpX = -dy / len * 15;
        perpY = dx / len * 15;
      }
      
      labels.push({
        id: `spacing-${segment.id}-${i}`,
        x: midX + perpX,
        y: midY + perpY,
        text: `${distFt.toFixed(2)}'`,
        segmentId: segment.id,
        runId: segment.runId
      });
    }
  });
  
  return labels;
}

/**
 * Get spacing rule for material
 */
export function getSpacingRule(materialType) {
  return MATERIAL_SPACING[materialType] || MATERIAL_SPACING['Vinyl'];
}