import React from 'react';
import { getSystemModel } from './spanModels';
import { segmentRun, calculateBaysForSegment } from '../materials/bayRulesEngine';

/**
 * Universal Span Visualization Overlay
 * Renders spans and anchors for all fence system types
 */
export default function SpanOverlay({ 
  fenceLines, 
  gates = [], 
  transform, 
  showNewOnly = true,
  showExisting = false,
  showLabels = true,
  zoom = 1
}) {
  if (!fenceLines || fenceLines.length === 0) return null;
  
  // Filter eligible runs - only show assigned lines
  const eligibleRuns = fenceLines.filter(line => {
    if (!line.assignedRunId) return false; // Skip unassigned visual reference lines
    const status = line.runStatus || (line.isExisting ? 'existing' : 'new');
    if (showNewOnly && status !== 'new') return false;
    if (!line.manualLengthFt || line.manualLengthFt <= 0) return false;
    return true;
  });
  
  // Filter existing runs for optional display
  const existingRuns = showExisting ? fenceLines.filter(line => {
    if (!line.assignedRunId) return false; // Skip unassigned visual reference lines
    const status = line.runStatus || (line.isExisting ? 'existing' : 'new');
    return status === 'existing';
  }) : [];
  
  return (
    <g className="span-overlay" style={{ pointerEvents: 'none' }}>
      {/* Render eligible (new) runs */}
      {eligibleRuns.map((line, idx) => (
        <RunSpanOverlay
          key={`span-${idx}`}
          line={line}
          gates={gates}
          transform={transform}
          showLabels={showLabels}
          zoom={zoom}
          isExisting={false}
        />
      ))}
      
      {/* Render existing runs (if enabled) */}
      {existingRuns.map((line, idx) => (
        <RunSpanOverlay
          key={`existing-${idx}`}
          line={line}
          gates={gates}
          transform={transform}
          showLabels={showLabels}
          zoom={zoom}
          isExisting={true}
        />
      ))}
    </g>
  );
}

function RunSpanOverlay({ line, gates, transform, showLabels, zoom, isExisting }) {
  const materialType = line.materialType || 'Wood';
  const systemModel = getSystemModel(materialType);
  
  // Convert line to run format for segmentation
  const run = {
    id: line.id || `line-${Math.random()}`,
    lengthLF: line.manualLengthFt || line.length || 0,
    materialType: materialType,
    style: line.style || 'Privacy'
  };
  
  // Get gates for this line
  const lineGates = gates.filter(g => 
    line.gates?.some(lg => lg.id === g.id) || 
    g.lineIndex === line.index
  ).map(g => ({
    ...g,
    runId: run.id,
    gateWidth_ft: g.widthFt || parseFloat(g.gateWidth?.replace(/'/g, '')) || 0,
    gateCenterDistance_ft: g.centerDistance_ft || (run.lengthLF / 2)
  }));
  
  // Use bay rules engine for segmentation
  const { fenceSegments, gateSegments } = segmentRun(run, lineGates);
  
  // Calculate spans and anchors
  const { spans, anchors } = calculateSpansAndAnchors(
    line,
    fenceSegments,
    gateSegments,
    systemModel
  );
  
  // Render
  return (
    <g className={`run-span-overlay ${isExisting ? 'existing' : 'new'}`}>
      {/* Render spans */}
      {spans.map((span, idx) => (
        <SpanVisual
          key={`span-${idx}`}
          span={span}
          line={line}
          systemModel={systemModel}
          isExisting={isExisting}
          showLabels={showLabels}
          zoom={zoom}
        />
      ))}
      
      {/* Render anchors */}
      {anchors.map((anchor, idx) => (
        <AnchorVisual
          key={`anchor-${idx}`}
          anchor={anchor}
          line={line}
          systemModel={systemModel}
          isExisting={isExisting}
          showLabels={showLabels}
          zoom={zoom}
        />
      ))}
      
      {/* Run summary label */}
      {showLabels && zoom > 0.3 && (
        <RunSummaryLabel
          line={line}
          spans={spans}
          anchors={anchors}
          systemModel={systemModel}
          isExisting={isExisting}
        />
      )}
    </g>
  );
}

function calculateSpansAndAnchors(line, fenceSegments, gateSegments, systemModel) {
  const spans = [];
  const anchors = [];
  
  const start = line.start;
  const end = line.end;
  const runLengthFt = line.manualLengthFt || line.length || 0;
  
  // Calculate direction
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const unitX = dx / length;
  const unitY = dy / length;
  
  // Helper to get point along line
  const getPointAt = (distFt) => ({
    x: start.x + unitX * (distFt / runLengthFt) * length,
    y: start.y + unitY * (distFt / runLengthFt) * length
  });
  
  let currentDist = 0;
  let anchorId = 0;
  
  // Start anchor (end post)
  anchors.push({
    id: anchorId++,
    position: getPointAt(0),
    distFt: 0,
    type: 'end',
    role: systemModel.anchors.terminalPosts ? 'terminal' : 'end'
  });
  
  // Process each fence segment
  fenceSegments.forEach((segment, segIdx) => {
    const segmentStart = segment.start;
    const segmentEnd = segment.end;
    const segmentLengthFt = segment.lengthFt;
    
    // Calculate spans for this segment
    let spanCount;
    if (systemModel.spanKind === 'panel') {
      spanCount = Math.ceil(segmentLengthFt / systemModel.panelLengthFt);
    } else {
      spanCount = calculateBaysForSegment(segmentLengthFt);
    }
    
    // Add spans
    for (let i = 0; i < spanCount; i++) {
      const spanStartDist = segmentStart + (i * segmentLengthFt / spanCount);
      const spanEndDist = segmentStart + ((i + 1) * segmentLengthFt / spanCount);
      const spanLengthFt = spanEndDist - spanStartDist;
      
      spans.push({
        id: spans.length,
        startPos: getPointAt(spanStartDist),
        endPos: getPointAt(spanEndDist),
        startDist: spanStartDist,
        endDist: spanEndDist,
        lengthFt: spanLengthFt,
        segmentIndex: segIdx,
        spanIndex: i,
        totalSpansInSegment: spanCount
      });
      
      // Add line post if not last span in segment
      if (i < spanCount - 1) {
        anchors.push({
          id: anchorId++,
          position: getPointAt(spanEndDist),
          distFt: spanEndDist,
          type: 'line',
          role: 'line'
        });
      }
    }
    
    // Add gate posts after this segment (if gates exist)
    const gateAfterSegment = gateSegments.find(g => 
      Math.abs(g.start - segmentEnd) < 0.1
    );
    
    if (gateAfterSegment) {
      // Gate start post
      anchors.push({
        id: anchorId++,
        position: getPointAt(gateAfterSegment.start),
        distFt: gateAfterSegment.start,
        type: 'gate',
        role: systemModel.anchors.terminalPosts ? 'terminal' : 'gate'
      });
      
      // Gate end post
      anchors.push({
        id: anchorId++,
        position: getPointAt(gateAfterSegment.end),
        distFt: gateAfterSegment.end,
        type: 'gate',
        role: systemModel.anchors.terminalPosts ? 'terminal' : 'gate'
      });
    }
  });
  
  // End anchor (end post)
  anchors.push({
    id: anchorId++,
    position: getPointAt(runLengthFt),
    distFt: runLengthFt,
    type: 'end',
    role: systemModel.anchors.terminalPosts ? 'terminal' : 'end'
  });
  
  return { spans, anchors };
}

function SpanVisual({ span, line, systemModel, isExisting, showLabels, zoom }) {
  const color = isExisting ? '#94a3b8' : systemModel.colors.span;
  const strokeWidth = isExisting ? 2 : 3;
  const strokeDash = isExisting ? '5,5' : 'none';
  
  return (
    <g className="span-visual">
      {/* Span line */}
      <line
        x1={span.startPos.x}
        y1={span.startPos.y}
        x2={span.endPos.x}
        y2={span.endPos.y}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDash}
        opacity={0.7}
      />
      
      {/* Span label */}
      {showLabels && zoom > 0.5 && (
        <text
          x={(span.startPos.x + span.endPos.x) / 2}
          y={(span.startPos.y + span.endPos.y) / 2 - 5}
          fill={systemModel.colors.label}
          fontSize={Math.min(12, 12 / zoom)}
          textAnchor="middle"
          className="span-label"
          style={{ pointerEvents: 'none' }}
        >
          {systemModel.labels.spanLabel} {span.spanIndex + 1}
        </text>
      )}
    </g>
  );
}

function AnchorVisual({ anchor, line, systemModel, isExisting, showLabels, zoom }) {
  const color = isExisting ? '#64748b' : systemModel.colors.anchor;
  const radius = anchor.type === 'gate' || anchor.role === 'terminal' ? 6 : 4;
  
  return (
    <g className="anchor-visual">
      <circle
        cx={anchor.position.x}
        cy={anchor.position.y}
        r={radius}
        fill={color}
        stroke="white"
        strokeWidth={2}
        opacity={isExisting ? 0.5 : 0.9}
      />
      
      {showLabels && zoom > 0.6 && anchor.type !== 'line' && (
        <text
          x={anchor.position.x}
          y={anchor.position.y + 15}
          fill={systemModel.colors.label}
          fontSize={Math.min(10, 10 / zoom)}
          textAnchor="middle"
          className="anchor-label"
          style={{ pointerEvents: 'none' }}
        >
          {anchor.role === 'terminal' ? 'T' : anchor.type === 'gate' ? 'G' : 'E'}
        </text>
      )}
    </g>
  );
}

function RunSummaryLabel({ line, spans, anchors, systemModel, isExisting }) {
  const midX = (line.start.x + line.end.x) / 2;
  const midY = (line.start.y + line.end.y) / 2;
  
  const spanCount = spans.length;
  const anchorCount = anchors.length;
  
  const label = isExisting 
    ? `EXISTING (excluded)`
    : `${systemModel.labels.spanPlural}: ${spanCount} | ${systemModel.labels.anchorPlural}: ${anchorCount}`;
  
  const bgColor = isExisting ? '#94a3b8' : systemModel.colors.anchor;
  const textColor = 'white';
  
  return (
    <g className="run-summary-label">
      <rect
        x={midX - 80}
        y={midY - 30}
        width={160}
        height={24}
        fill={bgColor}
        opacity={0.9}
        rx={4}
      />
      <text
        x={midX}
        y={midY - 14}
        fill={textColor}
        fontSize={12}
        fontWeight="bold"
        textAnchor="middle"
        style={{ pointerEvents: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}