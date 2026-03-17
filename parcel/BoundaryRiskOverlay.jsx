import React, { useEffect, useRef } from 'react';
import { extractParcelOuterRing } from './parcelCornerLotAnalyzer';

export default function BoundaryRiskOverlay({
  parcelGeojson,
  nearThresholdFt,
  rowRiskThresholdFt,
  canvasWidth = 800,
  canvasHeight = 600,
  scale = 1,
  rotation = 0,
  zoom = 1,
  visible = true
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!visible || !parcelGeojson || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Extract parcel outer ring
    const outerRing = extractParcelOuterRing(parcelGeojson);
    if (!outerRing || outerRing.length === 0) return;

    // Apply transformations
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Convert geo coordinates to canvas coordinates (simplified)
    const coords = outerRing.map(([lng, lat]) => {
      const x = (lng - outerRing[0][0]) * 100000 + canvas.width / 2;
      const y = (lat - outerRing[0][1]) * 100000 + canvas.height / 2;
      return [x, y];
    });

    // Draw risk zone indicators (visual approximation)
    // Draw dashed line along boundary for high-risk zone
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.5)';
    ctx.lineWidth = 4;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    coords.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();

    // Draw dots along boundary at intervals
    ctx.setLineDash([]);
    coords.forEach(([x, y], i) => {
      if (i % 3 === 0) {
        // High risk dot
        ctx.fillStyle = 'rgba(220, 38, 38, 0.7)';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();
  }, [parcelGeojson, nearThresholdFt, rowRiskThresholdFt, visible, scale, rotation, zoom, canvasWidth, canvasHeight]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 5
      }}
    />
  );
}