import React, { useRef, useEffect } from 'react';

/**
 * CanvasOverlay - renders fence lines, gates, trees, etc. over satellite map
 * Handles coordinate conversion between lat/lng and canvas pixels
 */
export default function CanvasOverlay({
  mapBounds,
  canvasWidth,
  canvasHeight,
  fenceLines,
  trees,
  gates,
  doubleGates,
  houses,
  pools,
  garages,
  dogs,
  selectedItem,
  hoveredPoint,
  visible = false
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!visible || !mapBounds) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Helper function to convert lat/lng to canvas pixels
    const latLngToPixel = (lat, lng) => {
      const { bounds } = mapBounds;
      const latRange = bounds.getNorth() - bounds.getSouth();
      const lngRange = bounds.getEast() - bounds.getWest();
      
      const x = ((lng - bounds.getWest()) / lngRange) * canvasWidth;
      const y = ((bounds.getNorth() - lat) / latRange) * canvasHeight;
      
      return { x, y };
    };
    
    // Draw fence lines
    fenceLines.forEach((line, idx) => {
      const isSelected = selectedItem?.type === 'line' && selectedItem?.index === idx;
      const isExisting = line.isExisting;
      const isTearOut = line.tearOut;
      
      let strokeColor = "#2D3748";
      if (isTearOut) {
        strokeColor = "#DC2626";
      } else if (isExisting) {
        strokeColor = "#94A3B8";
      } else if (isSelected) {
        strokeColor = "#3B82F6";
      }
      
      // Convert line coordinates to canvas pixels
      // For now, use the canvas x/y directly - later we'll convert from lat/lng
      const start = line.start;
      const end = line.end;
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSelected ? 5 : 3;
      
      if (isExisting || isTearOut) {
        ctx.setLineDash([10, 5]);
      } else {
        ctx.setLineDash([]);
      }
      
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw endpoints
      [start, end].forEach((point, pointIdx) => {
        const isHovered = hoveredPoint?.lineIdx === idx && hoveredPoint?.pointIdx === pointIdx;
        let pointColor = "#2D3748";
        if (isHovered) {
          pointColor = "#3B82F6";
        } else if (isTearOut) {
          pointColor = "#DC2626";
        } else if (isExisting) {
          pointColor = "#94A3B8";
        }
        
        ctx.fillStyle = pointColor;
        ctx.beginPath();
        ctx.arc(point.x, point.y, isHovered ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    
    // Draw trees
    trees.forEach((tree, idx) => {
      const isSelected = selectedItem?.type === 'tree' && selectedItem?.index === idx;
      ctx.fillStyle = isSelected ? "#10B981" : "#059669";
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, 15, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = isSelected ? "#34D399" : "#10B981";
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, 12, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw houses
    houses.forEach((house, idx) => {
      const isSelected = selectedItem?.type === 'house' && selectedItem?.index === idx;
      ctx.fillStyle = "#8B4513";
      ctx.fillRect(house.x, house.y, house.width, house.height);
      ctx.fillStyle = "#6B3410";
      ctx.fillRect(house.x + 10, house.y + 10, house.width - 20, house.height - 20);
      
      // Roof
      ctx.fillStyle = "#654321";
      ctx.beginPath();
      ctx.moveTo(house.x - 10, house.y);
      ctx.lineTo(house.x + house.width / 2, house.y - 20);
      ctx.lineTo(house.x + house.width + 10, house.y);
      ctx.closePath();
      ctx.fill();
      
      // Label
      ctx.fillStyle = "#FFF";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("HOUSE", house.x + house.width / 2, house.y + house.height / 2);
    });
    
  }, [visible, mapBounds, fenceLines, trees, gates, doubleGates, houses, pools, garages, dogs, selectedItem, hoveredPoint, canvasWidth, canvasHeight]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="absolute inset-0 z-20 pointer-events-none"
      style={{ mixBlendMode: 'normal' }}
    />
  );
}