import React, { useEffect, useRef } from 'react';

export default function VisionTriangleOverlay({
  trianglePolygon,
  canvasWidth = 800,
  canvasHeight = 600,
  scale = 1,
  rotation = 0,
  zoom = 1,
  visible = true
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!visible || !trianglePolygon || !canvasRef.current || trianglePolygon.length < 3) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Draw triangle (assuming points are already in canvas coordinates)
    ctx.beginPath();
    trianglePolygon.forEach((point, i) => {
      const x = point.x || point[0];
      const y = point.y || point[1];
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();

    // Fill with semi-transparent yellow
    ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.fill();

    // Stroke with yellow
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    // Draw points
    trianglePolygon.forEach((point, i) => {
      const x = point.x || point[0];
      const y = point.y || point[1];
      ctx.fillStyle = i === 0 ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 165, 0, 0.8)';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }, [trianglePolygon, visible, scale, rotation, zoom, canvasWidth, canvasHeight]);

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
        zIndex: 6
      }}
    />
  );
}