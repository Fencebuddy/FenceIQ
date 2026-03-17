/**
 * POST LAYOUT ENGINE V2 - VARIANT SAFE
 * Computes posts per-run material, not globally
 * Each variant gets independent post layout from its own run configs
 */

import { 
    findGatePostSnaps, 
    applyGatePostSnapping, 
    replacePostsWithGatePosts,
    removePostsInGateOpening
} from '../gates/gatePostSnapEngine';

const SNAP_TOLERANCE_PX = 30;
const OVERLAP_TOLERANCE_FT = 0.25;

/**
 * Material spacing rules - per-material
 */
const MATERIAL_SPACING = {
  'Vinyl': { maxSpanFt: 8, label: '8\' Panel' },
  'Chain Link': { maxSpanFt: 10, label: '10\' Line Post' },
  'Wood': { maxSpanFt: 8, label: '8\' Bay' },
  'Aluminum': { maxSpanFt: 6, label: '6\' Panel' }
};

/**
 * Generate post layout for variant-aware runs
 * @param {Object} params
 * @param {Array} params.fenceLines - Fence lines
 * @param {Array} params.runs - Runs with variant config baked in
 * @param {Array} params.gates - Gate objects (shared across variants)
 * @param {number} params.pixelsPerFt - Scale factor
 * @returns {Object} { posts, segments, spacingLabels }
 */
export function generatePostLayoutV2({ fenceLines, runs, gates, pixelsPerFt }) {
  if (!fenceLines || fenceLines.length === 0) {
    return { posts: [], segments: [], spacingLabels: [] };
  }

  // Build per-run spacing rules (materialType can vary by run now)
  const runSpacingMap = new Map();
  (runs || []).forEach(run => {
    const spacingRule = MATERIAL_SPACING[run.materialType] || MATERIAL_SPACING['Vinyl'];
    runSpacingMap.set(run.id, spacingRule);
  });

  // Step 1: Build terminal nodes from geometry
  const nodes = [];
  const nodeMap = new Map();
  
  const getNodeKey = (x, y) => `${Math.round(x)},${Math.round(y)}`;
  
  const findOrCreateNode = (x, y, runId, isGatePost = false) => {
    const key = getNodeKey(x, y);
    
    for (const [existingKey, node] of nodeMap.entries()) {
      const dist = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
      if (dist < SNAP_TOLERANCE_PX) {
        if (isGatePost) node.isGatePost = true;
        if (runId && !node.runIds.includes(runId)) {
          node.runIds.push(runId);
        }
        return node;
      }
    }
    
    const newNode = {
      id: nodes.length,
      x,
      y,
      runIds: runId ? [runId] : [],
      connectedLines: [],
      isGatePost,
      kind: 'unknown'
    };
    
    nodes.push(newNode);
    nodeMap.set(key, newNode);
    return newNode;
  };

  // Process fence lines to create terminal nodes
  fenceLines.forEach((line, lineIdx) => {
    if (!line.assignedRunId) return;
    
    const startNode = findOrCreateNode(line.start.x, line.start.y, line.assignedRunId);
    const endNode = findOrCreateNode(line.end.x, line.end.y, line.assignedRunId);
    
    startNode.connectedLines.push(lineIdx);
    endNode.connectedLines.push(lineIdx);
  });

  // Add gate posts - dedup once per gate by ID
  const processedGateIds = new Set();
  gates.forEach(gate => {
    if (processedGateIds.has(gate.id)) return; // Skip duplicates
    processedGateIds.add(gate.id);
    
    if (!gate.runId || !gate.gateWidth_ft) return;
    
    const gateLine = fenceLines.find(line => line.assignedRunId === gate.runId);
    if (!gateLine) return;
    
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
    
    // Create gate post 1
    const gatePost1 = (() => {
      for (const [existingKey, node] of nodeMap.entries()) {
        const dist = Math.sqrt(Math.pow(node.x - post1X, 2) + Math.pow(node.y - post1Y, 2));
        if (dist < SNAP_TOLERANCE_PX && !node.isGatePost) {
          node.isGatePost = true;
          node.gateId = gate.id;
          if (!node.runIds.includes(gate.runId)) node.runIds.push(gate.runId);
          return node;
        }
      }
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
    
    // Create gate post 2
    const gatePost2 = (() => {
      for (const [existingKey, node] of nodeMap.entries()) {
        if (node.id === gatePost1.id) continue;
        const dist = Math.sqrt(Math.pow(node.x - post2X, 2) + Math.pow(node.y - post2Y, 2));
        if (dist < SNAP_TOLERANCE_PX && !node.isGatePost) {
          node.isGatePost = true;
          node.gateId = gate.id;
          if (!node.runIds.includes(gate.runId)) node.runIds.push(gate.runId);
          return node;
        }
      }
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
    
    if (node.isGatePost) {
      node.kind = 'gate';
      node.color = '#A855F7';
    } else if (degree === 1) {
      node.kind = 'end';
      node.color = '#F97316';
    } else if (degree === 2) {
      const isCorner = checkIfCorner(node, fenceLines);
      if (isCorner) {
        node.kind = 'corner';
        node.color = '#DC2626';
      } else {
        node.kind = 'inline';
        node.color = '#3B82F6';
      }
    } else {
      node.kind = 'junction';
      node.color = '#DC2626';
    }
  });

  // Step 3: Build segments
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
    
    const gateNodesOnLine = nodes.filter(n => 
      n.isGatePost && 
      n.runIds.includes(line.assignedRunId) &&
      n.id !== startNode.id && 
      n.id !== endNode.id
    );
    
    if (gateNodesOnLine.length === 0) {
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
      const allNodesOnLine = [startNode, ...gateNodesOnLine, endNode];
      
      const dx = line.end.x - line.start.x;
      const dy = line.end.y - line.start.y;
      const lineLen = Math.sqrt(dx * dx + dy * dy);
      
      allNodesOnLine.sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.x - line.start.x, 2) + Math.pow(a.y - line.start.y, 2));
        const distB = Math.sqrt(Math.pow(b.x - line.start.x, 2) + Math.pow(b.y - line.start.y, 2));
        return distA - distB;
      });
      
      for (let i = 0; i < allNodesOnLine.length - 1; i++) {
        const n1 = allNodesOnLine[i];
        const n2 = allNodesOnLine[i + 1];
        
        const pairKey = `${Math.min(n1.id, n2.id)}-${Math.max(n1.id, n2.id)}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);
        
        const segLengthPx = Math.sqrt(Math.pow(n2.x - n1.x, 2) + Math.pow(n2.y - n1.y, 2));
        const segLengthFt = (line.manualLengthFt || 0) * (segLengthPx / lineLen);
        
        const isGateGap = n1.isGatePost && n2.isGatePost && n1.gateId && n1.gateId === n2.gateId;
        
        segments.push({
          id: segments.length,
          lineIdx,
          runId: line.assignedRunId,
          startNode: n1,
          endNode: n2,
          lengthFt: segLengthFt,
          lengthPx: segLengthPx,
          isGateGap
        });
      }
    }
  });

  // Step 4: Generate posts for each segment
  const posts = [];
  const postMap = new Map();
  
  const addPost = (post) => {
    const key = getNodeKey(post.x, post.y);
    if (!postMap.has(key)) {
      postMap.set(key, post);
      posts.push(post);
    }
    return postMap.get(key);
  };

  // First pass: terminal posts
  segments.forEach(segment => {
    const { startNode, endNode, runId } = segment;
    
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
      orderIndex: 999,
      t: 1,
      isGatePost: endNode.isGatePost,
      color: endNode.color,
      terminalType: endNode.isGatePost ? 'gate' : (endNode.kind === 'corner' ? 'corner' : (endNode.kind === 'end' ? 'end' : null))
    });
  });
  
  // Second pass: line posts (use per-run spacing)
  segments.forEach(segment => {
    const { startNode, endNode, lengthFt, lengthPx, runId, isGateGap } = segment;
    
    if (lengthFt <= 0 || isGateGap) return;
    
    // Get spacing rule for this segment's run
    const spacingRule = runSpacingMap.get(runId) || MATERIAL_SPACING['Vinyl'];
    const maxSpanFt = spacingRule.maxSpanFt;
    
    const nSpans = Math.ceil(lengthFt / maxSpanFt);
    const equalizedSpanFt = lengthFt / nSpans;
    
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
    
    const endTerminalKey = getNodeKey(endNode.x, endNode.y);
    const endTerminalPost = postMap.get(endTerminalKey);
    if (endTerminalPost) {
      endTerminalPost.orderIndex = nSpans;
    }
  });
  
  deduplicatePosts(posts, postMap, pixelsPerFt);

  const spacingLabels = buildSpacingLabels(posts, segments, runs);

  return {
    posts,
    segments,
    spacingLabels
  };
}

function deduplicatePosts(posts, postMap, pixelsPerFt) {
  const overlapTolerancePx = OVERLAP_TOLERANCE_FT * pixelsPerFt;
  const postPriority = { gate: 4, corner: 3, junction: 3, end: 2, line: 1, inline: 0 };
  
  const postsToRemove = new Set();
  
  for (let i = 0; i < posts.length; i++) {
    if (postsToRemove.has(i)) continue;
    
    const p1 = posts[i];
    
    for (let j = i + 1; j < posts.length; j++) {
      if (postsToRemove.has(j)) continue;
      
      const p2 = posts[j];
      
      const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
      
      if (dist < overlapTolerancePx) {
        const p1Priority = postPriority[p1.kind] || 0;
        const p2Priority = postPriority[p2.kind] || 0;
        
        if (p1Priority >= p2Priority) {
          postsToRemove.add(j);
          const key = `${Math.round(p2.x)},${Math.round(p2.y)}`;
          postMap.delete(key);
        } else {
          postsToRemove.add(i);
          const key = `${Math.round(p1.x)},${Math.round(p1.y)}`;
          postMap.delete(key);
          break;
        }
      }
    }
  }
  
  const sortedToRemove = Array.from(postsToRemove).sort((a, b) => b - a);
  sortedToRemove.forEach(idx => posts.splice(idx, 1));
}

function checkIfCorner(node, fenceLines) {
  if (node.connectedLines.length !== 2) return false;
  
  const line1 = fenceLines[node.connectedLines[0]];
  const line2 = fenceLines[node.connectedLines[1]];
  
  if (!line1 || !line2) return false;
  
  const getVector = (line) => {
    const isStart = Math.abs(line.start.x - node.x) < SNAP_TOLERANCE_PX && 
                    Math.abs(line.start.y - node.y) < SNAP_TOLERANCE_PX;
    const otherX = isStart ? line.end.x : line.start.x;
    const otherY = isStart ? line.end.y : line.start.y;
    return { x: otherX - node.x, y: otherY - node.y };
  };
  
  const v1 = getVector(line1);
  const v2 = getVector(line2);
  
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (mag1 === 0 || mag2 === 0) return false;
  
  const cosAngle = dot / (mag1 * mag2);
  const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
  
  return angleDeg > 15;
}

function buildSpacingLabels(posts, segments, runs) {
  const labels = [];
  
  segments.forEach(segment => {
    const segmentPosts = posts
      .filter(p => p.segmentId === segment.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    
    const run = runs?.find(r => r.id === segment.runId);
    const runLabel = run?.runLabel || '';
    
    for (let i = 0; i < segmentPosts.length - 1; i++) {
      const p1 = segmentPosts[i];
      const p2 = segmentPosts[i + 1];
      
      const distPx = Math.sqrt(
        Math.pow(p2.x - p1.x, 2) + 
        Math.pow(p2.y - p1.y, 2)
      );
      const distFt = segment.lengthFt * (distPx / segment.lengthPx);
      
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      let perpX, perpY;
      
      if (runLabel === 'LEFT SIDE') {
        perpX = dy / len * 15;
        perpY = -dx / len * 15;
      } else if (runLabel === 'LEFT FRONT') {
        perpX = 0;
        perpY = -25;
      } else {
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

export function getSpacingRule(materialType) {
  return MATERIAL_SPACING[materialType] || MATERIAL_SPACING['Vinyl'];
}