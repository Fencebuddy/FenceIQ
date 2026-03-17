/**
 * Map fitting utility - calculates optimal scale and translation for viewport
 */

export interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MapTransform {
  scale: number;
  tx: number;
  ty: number;
  bounds: MapBounds;
}

export function computeMapTransform(
  contentBounds: MapBounds,
  viewport: { width: number; height: number },
  padding: number = 0.1
): MapTransform {
  const contentWidth = contentBounds.maxX - contentBounds.minX;
  const contentHeight = contentBounds.maxY - contentBounds.minY;

  if (contentWidth <= 0 || contentHeight <= 0) {
    return {
      scale: 1,
      tx: viewport.width / 2,
      ty: viewport.height / 2,
      bounds: contentBounds
    };
  }

  // Calculate scale to fit with padding
  const scaleX = viewport.width / contentWidth;
  const scaleY = viewport.height / contentHeight;
  const scale = Math.min(scaleX, scaleY) * (1 - padding);

  // Center content in viewport
  const scaledWidth = contentWidth * scale;
  const scaledHeight = contentHeight * scale;
  const tx = (viewport.width - scaledWidth) / 2 - contentBounds.minX * scale;
  const ty = (viewport.height - scaledHeight) / 2 - contentBounds.minY * scale;

  return { scale, tx, ty, bounds: contentBounds };
}