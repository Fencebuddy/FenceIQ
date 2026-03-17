import React, { useEffect } from 'react';

export default function ParcelOverlay({ 
  parcelGeojson, 
  parcelId,
  canvasWidth = 800, 
  canvasHeight = 600,
  scale = 1,
  rotation = 0,
  zoom = 1,
  visible = true
}) {
  const canvasRef = React.useRef(null);

  useEffect(() => {
    if (!visible || !parcelGeojson || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Transform context
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Draw parcel boundary
    if (parcelGeojson.coordinates && parcelGeojson.coordinates[0]) {
      const ring = parcelGeojson.coordinates[0];
      
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      ctx.globalAlpha = 0.6;
      
      ctx.beginPath();
      ring.forEach(([x, y], idx) => {
        // Convert lat/lng to canvas coordinates (simplified)
        const canvasX = x * scale;
        const canvasY = y * scale;
        
        if (idx === 0) {
          ctx.moveTo(canvasX, canvasY);
        } else {
          ctx.lineTo(canvasX, canvasY);
        }
      });
      ctx.closePath();
      ctx.stroke();

      // Fill with semi-transparent blue
      ctx.fillStyle = 'rgba(37, 99, 235, 0.05)';
      ctx.fill();

      // Draw label if parcel ID exists
      if (parcelId && ring.length > 0) {
        const centerX = ring.reduce((sum, [x]) => sum + x * scale, 0) / ring.length;
        const centerY = ring.reduce((sum, [, y]) => sum + y * scale, 0) / ring.length;
        
        ctx.fillStyle = '#2563eb';
        ctx.font = `${12 / zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.8;
        ctx.fillText(`Parcel: ${parcelId}`, centerX, centerY);
      }
    }

    ctx.restore();
  }, [parcelGeojson, parcelId, canvasWidth, canvasHeight, scale, rotation, zoom, visible]);

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