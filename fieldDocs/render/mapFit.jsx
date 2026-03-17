/**
 * Compute optimal scale/translate for map to fit in viewport
 */

export function computeMapTransform(mapData, viewportWidth, viewportHeight, paddingPct = 0.08) {
  if (!mapData) {
    return { scale: 1, tx: 0, ty: 0, bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } };
  }

  const points = [];

  // Collect fence line endpoints
  if (mapData.fenceLines) {
    mapData.fenceLines.forEach(line => {
      if (line.start) points.push([line.start.x, line.start.y]);
      if (line.end) points.push([line.end.x, line.end.y]);
    });
  }

  // Collect gate positions
  if (mapData.gates) {
    mapData.gates.forEach(gate => points.push([gate.x, gate.y]));
  }
  if (mapData.doubleGates) {
    mapData.doubleGates.forEach(gate => points.push([gate.x, gate.y]));
  }

  // Collect structure corners
  ['houses', 'pools', 'garages', 'driveways', 'decks', 'porches', 'grasses'].forEach(key => {
    if (mapData[key]) {
      mapData[key].forEach(struct => {
        if (struct.x && struct.y && struct.width && struct.height) {
          points.push([struct.x, struct.y]);
          points.push([struct.x + struct.width, struct.y + struct.height]);
        }
      });
    }
  });

  // Collect trees
  if (mapData.trees) {
    mapData.trees.forEach(tree => points.push([tree.x, tree.y]));
  }

  // Collect end posts
  if (mapData.endPosts) {
    mapData.endPosts.forEach(post => points.push([post.x, post.y]));
  }

  // Collect beds
  if (mapData.beds) {
    mapData.beds.forEach(bed => {
      if (bed.vertices) {
        bed.vertices.forEach(v => points.push([v.x, v.y]));
      }
    });
  }

  // Collect annotation bounds
  if (mapData.annotations) {
    mapData.annotations.forEach(ann => {
      if (ann.type === 'callout' && ann.box) {
        points.push([ann.box.x, ann.box.y]);
        points.push([ann.box.x + ann.box.w, ann.box.y + ann.box.h]);
        points.push([ann.tail.anchorX, ann.tail.anchorY]);
      } else if (ann.type === 'arrow') {
        points.push([ann.x, ann.y]);
        const cos = Math.cos(ann.rotation);
        const sin = Math.sin(ann.rotation);
        const length = ann.length || 120;
        points.push([ann.x + cos * (length / 2), ann.y + sin * (length / 2)]);
        points.push([ann.x - cos * (length / 2), ann.y - sin * (length / 2)]);
      }
    });
  }

  // Fallback if no points
  if (points.length === 0) {
    return { scale: 1, tx: 0, ty: 0, bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } };
  }

  // Compute bounds
  let minX = Math.min(...points.map(p => p[0]));
  let maxX = Math.max(...points.map(p => p[0]));
  let minY = Math.min(...points.map(p => p[1]));
  let maxY = Math.max(...points.map(p => p[1]));

  // Add padding
  const width = maxX - minX;
  const height = maxY - minY;
  const padX = width * paddingPct;
  const padY = height * paddingPct;

  minX -= padX;
  maxX += padX;
  minY -= padY;
  maxY += padY;

  const boundsWidth = maxX - minX;
  const boundsHeight = maxY - minY;

  // Compute scale to fit viewport
  const scaleX = viewportWidth / boundsWidth;
  const scaleY = viewportHeight / boundsHeight;
  const scale = Math.min(scaleX, scaleY, 3); // Cap at 3x to avoid tiny maps looking odd

  // Center in viewport
  const scaledWidth = boundsWidth * scale;
  const scaledHeight = boundsHeight * scale;
  const tx = (viewportWidth - scaledWidth) / 2 - minX * scale;
  const ty = (viewportHeight - scaledHeight) / 2 - minY * scale;

  return { scale, tx, ty, bounds: { minX, maxX, minY, maxY } };
}