import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Loader2, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { calculateOrientation } from './orientationEngine';

export default function PdfImporter({ isOpen, onClose, onImport, currentZoom, currentFenceLines }) {
    const [file, setFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [invertDxf, setInvertDxf] = useState(true);

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files?.[0];
        const fileName = selectedFile?.name.toLowerCase();
        const isPdf = selectedFile?.type === 'application/pdf';
        const isDxf = fileName?.endsWith('.dxf');
        
        if (selectedFile && (isPdf || isDxf)) {
            setFile(selectedFile);
            setError(null);
        } else {
            setError("Please select a valid PDF or DXF file");
        }
    };

    const parseDxfFile = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    const lines = content.split('\n').map(l => l.trim());
                    
                    // STEP 1: Try to find POLYLINE/LWPOLYLINE
                    const polylineVertices = extractPolyline(lines);
                    if (polylineVertices.length >= 3) {
                        resolve(polylineVertices);
                        return;
                    }
                    
                    // STEP 2: FALLBACK - Build polyline from LINE entities
                    const lineVertices = extractAndConnectLines(lines);
                    if (lineVertices.length >= 3) {
                        resolve(lineVertices);
                        return;
                    }
                    
                    reject(new Error('No valid polyline or connected lines found in DXF file'));
                } catch (err) {
                    reject(err);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read DXF file'));
            reader.readAsText(file);
        });
    };
    
    const extractPolyline = (lines) => {
        const vertices = [];
        let inPolyline = false;
        let inVertex = false;
        let currentX = null;
        let currentY = null;
        let currentZ = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for POLYLINE or LWPOLYLINE
            if (line === 'POLYLINE' || line === 'LWPOLYLINE') {
                inPolyline = true;
                continue;
            }
            
            // Check for VERTEX
            if (line === 'VERTEX' && inPolyline) {
                inVertex = true;
                currentX = null;
                currentY = null;
                currentZ = null;
                continue;
            }
            
            // Check for end of polyline
            if (line === 'SEQEND' || line === 'ENDSEC') {
                if (vertices.length >= 3) {
                    return vertices;
                }
            }
            
            // Extract coordinates
            if (inPolyline || inVertex) {
                // Group code 10 = X coordinate
                if (line === '10') {
                    currentX = parseFloat(lines[i + 1]);
                }
                // Group code 20 = Y coordinate
                if (line === '20') {
                    currentY = parseFloat(lines[i + 1]);
                }
                // Group code 30 = Z coordinate (elevation)
                if (line === '30') {
                    currentZ = parseFloat(lines[i + 1]);
                    
                    if (currentX !== null && currentY !== null) {
                        vertices.push({ 
                            x: currentX, 
                            y: currentY, 
                            z: currentZ || 0 
                        });
                        currentX = null;
                        currentY = null;
                        currentZ = null;
                        inVertex = false;
                    }
                } else if (line === '20' && lines[i + 2] !== '30') {
                    // Y coord without Z following - complete vertex
                    if (currentX !== null && currentY !== null) {
                        vertices.push({ 
                            x: currentX, 
                            y: currentY, 
                            z: 0 
                        });
                        currentX = null;
                        currentY = null;
                        inVertex = false;
                    }
                }
            }
        }
        
        return vertices;
    };
    
    const extractAndConnectLines = (lines) => {
        // Extract all LINE entities
        const lineSegments = [];
        let inLine = false;
        let startX = null, startY = null, endX = null, endY = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line === 'LINE') {
                inLine = true;
                startX = null;
                startY = null;
                endX = null;
                endY = null;
                continue;
            }
            
            if (inLine) {
                // Group code 10 = start X
                if (line === '10') {
                    startX = parseFloat(lines[i + 1]);
                }
                // Group code 20 = start Y
                if (line === '20') {
                    startY = parseFloat(lines[i + 1]);
                }
                // Group code 11 = end X
                if (line === '11') {
                    endX = parseFloat(lines[i + 1]);
                }
                // Group code 21 = end Y
                if (line === '21') {
                    endY = parseFloat(lines[i + 1]);
                    
                    // Complete line segment
                    if (startX !== null && startY !== null && endX !== null && endY !== null) {
                        lineSegments.push({
                            start: { x: startX, y: startY },
                            end: { x: endX, y: endY }
                        });
                        inLine = false;
                    }
                }
            }
        }
        
        if (lineSegments.length < 3) {
            return [];
        }
        
        // Connect line segments into a chain
        const TOLERANCE = 0.001;
        const chain = [lineSegments[0]];
        const used = new Set([0]);
        
        const pointsMatch = (p1, p2) => {
            return Math.abs(p1.x - p2.x) < TOLERANCE && Math.abs(p1.y - p2.y) < TOLERANCE;
        };
        
        while (chain.length < lineSegments.length) {
            const lastEnd = chain[chain.length - 1].end;
            let foundNext = false;
            
            for (let i = 0; i < lineSegments.length; i++) {
                if (used.has(i)) continue;
                
                const segment = lineSegments[i];
                
                // Check if this segment connects to the chain
                if (pointsMatch(lastEnd, segment.start)) {
                    chain.push(segment);
                    used.add(i);
                    foundNext = true;
                    break;
                } else if (pointsMatch(lastEnd, segment.end)) {
                    // Reverse the segment
                    chain.push({
                        start: segment.end,
                        end: segment.start
                    });
                    used.add(i);
                    foundNext = true;
                    break;
                }
            }
            
            if (!foundNext) break;
        }
        
        // CRITICAL: DO NOT auto-close the loop
        // Remove auto-closing logic - keep shape OPEN
        // This preserves true end posts and prevents phantom corners
        
        // Convert chain to vertices (OPEN SHAPE)
        const vertices = [chain[0].start];
        for (const segment of chain) {
            vertices.push(segment.end);
        }
        
        // CRITICAL: DO NOT auto-close the shape
        // DO NOT remove last vertex even if it matches first
        // Keep shape OPEN to preserve true end posts
        
        return vertices;
    };

    const handleImport = async () => {
        if (!file) return;

        setIsProcessing(true);
        setError(null);

        try {
            const isDxf = file.name.toLowerCase().endsWith('.dxf');
            
            if (isDxf) {
                // Parse DXF file directly
                const vertices = await parseDxfFile(file);
                const { fenceLines, boundingBox } = convertVerticesToFenceLines(vertices, null);
                onImport(fenceLines, boundingBox);
                handleClose();
                return;
            }

            // For PDF files, use LLM extraction
            const { file_url } = await base44.integrations.Core.UploadFile({ file });

            let prompt;
            let responseSchema;
            // PDF files - extract segments with lengths
            prompt = `Extract fence measurement data from this PDF survey or site plan.

Look for:
1. Numbered segments with lengths (e.g., "1, 29.4ft", "2, 19.4ft")
2. Edge lists with segment numbers and lengths
3. Property boundary dimensions

Return a JSON array of segments going around the property in perimeter order.

Each segment should have:
- segmentNumber: number (sequential, starting from 1)
- lengthFt: number (just the numeric value)
- startElevation: number or null (elevation change in feet)
- endElevation: number or null (elevation change in feet)

Example:
{
  "totalLength": 231.1,
  "segments": [
    {"segmentNumber": 1, "lengthFt": 11.2, "startElevation": 0, "endElevation": 0},
    {"segmentNumber": 2, "lengthFt": 29.4, "startElevation": 0, "endElevation": 5.4}
  ]
}`;

            responseSchema = {
                type: "object",
                properties: {
                    totalLength: { type: "number" },
                    segments: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                segmentNumber: { type: "number" },
                                lengthFt: { type: "number" },
                                startElevation: { type: "number" },
                                endElevation: { type: "number" }
                            }
                        }
                    }
                }
            };

            const result = await base44.integrations.Core.InvokeLLM({
                prompt: prompt,
                file_urls: [file_url],
                response_json_schema: responseSchema
            });

            // PDF: segments with lengths
            if (result && result.segments && result.segments.length > 0) {
                const fenceLines = convertSegmentsToFenceLines(result.segments, result.totalLength);
                onImport(fenceLines);
                handleClose();
            } else {
                setError("No fence segments found in PDF. Please ensure the file contains measurement data.");
            }

        } catch (err) {
            console.error('File import error:', err);
            setError("Failed to process file. Please try again or enter data manually.");
        } finally {
            setIsProcessing(false);
        }
    };

    const convertVerticesToFenceLines = (vertices, totalLength) => {
            // Extract elevation data from DXF vertices
            const extractElevationData = (vertices) => {
                const elevations = vertices.map(v => v.z || 0).filter(z => z !== 0);
                if (elevations.length === 0) return null;

                const minZ = Math.min(...elevations);
                const maxZ = Math.max(...elevations);
                const dropFt = Math.abs(maxZ - minZ);

                return {
                    hasElevation: true,
                    startElevation: vertices[0]?.z || 0,
                    endElevation: vertices[vertices.length - 1]?.z || 0,
                    minElevation: minZ,
                    maxElevation: maxZ,
                    dropFt
                };
            };

            const elevationData = extractElevationData(vertices);

            // ============================================================
            // STEP 1 — BOUNDS IN FEET
            // ============================================================
            console.log("=== DXF IMPORT DIAGNOSTICS START ===");
            console.log("RAW POINT COUNT:", vertices.length);

            const xs = vertices.map(v => v.x);
            const ys = vertices.map(v => v.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            console.log("minX (ft):", minX);
            console.log("maxX (ft):", maxX);
            console.log("minY (ft):", minY);
            console.log("maxY (ft):", maxY);

            const shapeWidthFeet = Math.max(maxX - minX, 0.01);
            const shapeHeightFeet = Math.max(maxY - minY, 0.01);

            console.log("shapeWidthFeet:", shapeWidthFeet);
            console.log("shapeHeightFeet:", shapeHeightFeet);

            // ============================================================
            // STEP 2 — VIEWPORT SIZE IN PIXELS (RESPONSIVE)
            // ============================================================
            const viewportWidthPixels = Math.min(window.innerWidth - 40, 800);
            const viewportHeightPixels = 750;

            console.log("viewportWidth (px):", viewportWidthPixels);
            console.log("viewportHeight (px):", viewportHeightPixels);

            // ============================================================
            // STEP 3 — CHOOSE SCALE (px per ft) TO FIT SHAPE
            // ============================================================
            const targetFill = 0.85;
            const scaleX = (viewportWidthPixels * targetFill) / shapeWidthFeet;
            const scaleY = (viewportHeightPixels * targetFill) / shapeHeightFeet;
            const feetToPixels = Math.min(scaleX, scaleY);

            console.log("scaleX (px/ft):", scaleX);
            console.log("scaleY (px/ft):", scaleY);
            console.log("finalScale (px/ft):", feetToPixels);

            // ============================================================
            // STEP 4 — DERIVE GRID SQUARE SIZE IN PIXELS
            // ============================================================
            const gridSquareFeet = 10;
            const gridSquarePixels = feetToPixels * gridSquareFeet;

            console.log("gridSquarePixels:", gridSquarePixels, "(each square = 10 ft)");

            // ============================================================
            // STEP 5 — SCALE AND CENTER POINTS
            // ============================================================
            // Shift to local origin and scale
            const scaledPoints = vertices.map(v => ({
                x: (v.x - minX) * feetToPixels,
                y: (v.y - minY) * feetToPixels
            }));

            // Find scaled bounds
            const scaledXs = scaledPoints.map(p => p.x);
            const scaledYs = scaledPoints.map(p => p.y);
            const scaledWidthPixels = Math.max(...scaledXs) - Math.min(...scaledXs);
            const scaledHeightPixels = Math.max(...scaledYs) - Math.min(...scaledYs);

            console.log("scaledWidthPixels:", scaledWidthPixels);
            console.log("scaledHeightPixels:", scaledHeightPixels);

            // Center in viewport
            const offsetX = (viewportWidthPixels - scaledWidthPixels) / 2;
            const offsetY = (viewportHeightPixels - scaledHeightPixels) / 2;

            console.log("offsetX (px):", offsetX);
            console.log("offsetY (px):", offsetY);

            // Apply centering offset and conditionally invert both axes
            const converted = scaledPoints.map(p => ({
                x: invertDxf ? viewportWidthPixels - (p.x + offsetX) : p.x + offsetX,
                y: invertDxf ? p.y + offsetY : viewportHeightPixels - (p.y + offsetY)
            }));

            // ============================================================
            // STEP 6 — LOG FINAL POSITION OF 3 SAMPLE POINTS
            // ============================================================
            if (converted.length >= 3) {
                console.log("FINAL POINT 0:", `(${converted[0].x.toFixed(2)}, ${converted[0].y.toFixed(2)})`);
                console.log("FINAL POINT 1:", `(${converted[1].x.toFixed(2)}, ${converted[1].y.toFixed(2)})`);
                console.log("FINAL POINT 2:", `(${converted[2].x.toFixed(2)}, ${converted[2].y.toFixed(2)})`);
            }

            // ============================================================
            // CREATE INDIVIDUAL SEGMENTS (OPEN SHAPE - NO AUTO-CLOSE)
            // ============================================================
            const segments = [];
            // CRITICAL: Stop at converted.length - 1 to keep shape OPEN
            // DO NOT connect last point back to first point
            for (let i = 0; i < converted.length - 1; i++) {
                const start = converted[i];
                const end = converted[i + 1]; // Next point (not wrapping)

                // Calculate actual length from ORIGINAL DXF coordinates in feet
                const origStart = vertices[i];
                const origEnd = vertices[i + 1]; // Next point (not wrapping)
                const dx = origEnd.x - origStart.x;
                const dy = origEnd.y - origStart.y;
                const lengthFt = Math.sqrt(dx * dx + dy * dy);

                segments.push({
                    start: start,
                    end: end,
                    lengthFt: lengthFt,
                    segmentNumber: i + 1
                });
            }

            // ============================================================
            // GROUP COLLINEAR SEGMENTS INTO MASTER RUNS
            // ============================================================
            const ANGLE_THRESHOLD = 10; // degrees - segments within this angle are grouped

            const calculateAngle = (p1, p2) => {
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                return Math.atan2(dy, dx) * 180 / Math.PI;
            };

            const angleDifference = (a1, a2) => {
                let diff = Math.abs(a1 - a2);
                if (diff > 180) diff = 360 - diff;
                return diff;
            };

            const masterRuns = [];
            let currentRun = {
                segments: [segments[0]],
                startPoint: segments[0].start,
                totalLengthFt: segments[0].lengthFt
            };

            for (let i = 1; i < segments.length; i++) {
                const prevSeg = segments[i - 1];
                const currSeg = segments[i];

                const prevAngle = calculateAngle(prevSeg.start, prevSeg.end);
                const currAngle = calculateAngle(currSeg.start, currSeg.end);
                const angleDiff = angleDifference(prevAngle, currAngle);

                if (angleDiff <= ANGLE_THRESHOLD) {
                    // Continue current run
                    currentRun.segments.push(currSeg);
                    currentRun.totalLengthFt += currSeg.lengthFt;
                } else {
                    // Start new run
                    currentRun.endPoint = prevSeg.end;
                    masterRuns.push(currentRun);

                    currentRun = {
                        segments: [currSeg],
                        startPoint: currSeg.start,
                        totalLengthFt: currSeg.lengthFt
                    };
                }
            }

            // Close the last run
            currentRun.endPoint = segments[segments.length - 1].end;
            masterRuns.push(currentRun);

            console.log(`Grouped ${segments.length} segments into ${masterRuns.length} master runs`);

            // ============================================================
            // CREATE FENCE LINES FROM MASTER RUNS WITH ELEVATION DATA
            // ============================================================
            const lines = masterRuns.map((run, idx) => {
                // Calculate per-run elevation if data exists
                let runElevation = null;
                if (elevationData?.hasElevation && run.segments.length > 0) {
                    const firstSegIdx = run.segments[0].segmentNumber - 1;
                    const lastSegIdx = run.segments[run.segments.length - 1].segmentNumber - 1;
                    
                    if (firstSegIdx < vertices.length && lastSegIdx < vertices.length) {
                        const startZ = vertices[firstSegIdx].z || 0;
                        const endZ = vertices[(lastSegIdx + 1) % vertices.length].z || 0;
                        const dropFt = Math.abs(endZ - startZ);
                        
                        runElevation = {
                            startElevation: startZ,
                            endElevation: endZ,
                            dropFt,
                            slopeSource: 'DXF_AUTO_DETECT',
                            slopeDetectedFrom: 'DXF Import'
                        };
                    }
                }
                
                return {
                    start: run.startPoint,
                    end: run.endPoint,
                    length: run.totalLengthFt,
                    manualLengthFt: run.totalLengthFt,
                    isExisting: false,
                    tearOut: false,
                    isPerimeter: true,
                    slope: "None",
                    segmentNumber: idx + 1,
                    dxfSegments: run.segments.map(s => ({
                        lengthFt: s.lengthFt,
                        segmentNumber: s.segmentNumber
                    })),
                    dxfSegmentCount: run.segments.length,
                    dxfElevation: runElevation
                };
            });

            console.log("=== DXF IMPORT DIAGNOSTICS END ===");

            // Calculate orientation for grouping
            const orientedLines = calculateOrientation(lines);

            // Group lines by orientation label into continuous runs
            const groupedByOrientation = {};
            orientedLines.forEach(line => {
                const label = line.orientationLabel || 'Unlabeled';
                if (!groupedByOrientation[label]) {
                    groupedByOrientation[label] = [];
                }
                groupedByOrientation[label].push(line);
            });

            // Merge lines with same orientation into single continuous runs
            const mergedLines = [];
            Object.entries(groupedByOrientation).forEach(([label, linesInGroup]) => {
                if (linesInGroup.length === 1) {
                    mergedLines.push(linesInGroup[0]);
                } else {
                    // Merge multiple lines into one continuous line
                    // Use first and last points of the group
                    const firstLine = linesInGroup[0];
                    const lastLine = linesInGroup[linesInGroup.length - 1];

                    // Calculate total length from all segments
                    const totalLength = linesInGroup.reduce((sum, l) => sum + l.manualLengthFt, 0);

                    // Collect all original segments
                    const allDxfSegments = [];
                    linesInGroup.forEach(l => {
                        if (l.dxfSegments) {
                            allDxfSegments.push(...l.dxfSegments);
                        }
                    });

                    mergedLines.push({
                        start: firstLine.start,
                        end: lastLine.end,
                        length: totalLength,
                        manualLengthFt: totalLength,
                        isExisting: false,
                        tearOut: false,
                        isPerimeter: true,
                        slope: "None",
                        segmentNumber: firstLine.segmentNumber,
                        orientationLabel: label,
                        orientationMode: 'auto',
                        dxfSegments: allDxfSegments,
                        dxfSegmentCount: allDxfSegments.length
                    });
                }
            });

            console.log(`Merged ${orientedLines.length} lines into ${mergedLines.length} continuous runs`);

            // Calculate bounding box for auto-fit
            const allPoints = converted.concat();
            const boundingBox = {
                minX: Math.min(...allPoints.map(p => p.x)),
                minY: Math.min(...allPoints.map(p => p.y)),
                maxX: Math.max(...allPoints.map(p => p.x)),
                maxY: Math.max(...allPoints.map(p => p.y))
            };

            return { fenceLines: mergedLines, boundingBox };
            };

    const convertSegmentsToFenceLines = (segments, totalLength) => {
        const lines = [];
        
        // Build the shape by connecting segments in order around the perimeter
        // Start at origin, go clockwise
        const CANVAS_WIDTH = 800;
        const CANVAS_HEIGHT = 750;
        const MARGIN = 100;
        
        // Create raw segments going around the property
        // Assume rectangular shape: segments alternate 90° turns
        let currentX = 0;
        let currentY = 0;
        let currentAngle = 0; // 0=right, 90=down, 180=left, 270=up
        
        const rawPoints = [{ x: 0, y: 0 }];
        
        segments.forEach((segment, idx) => {
            const dx = segment.lengthFt * Math.cos((currentAngle * Math.PI) / 180);
            const dy = segment.lengthFt * Math.sin((currentAngle * Math.PI) / 180);
            currentX += dx;
            currentY += dy;
            rawPoints.push({ x: currentX, y: currentY });
            
            // Rotate 90° clockwise for next segment
            currentAngle = (currentAngle + 90) % 360;
        });
        
        // Calculate bounding box
        const minX = Math.min(...rawPoints.map(p => p.x));
        const maxX = Math.max(...rawPoints.map(p => p.x));
        const minY = Math.min(...rawPoints.map(p => p.y));
        const maxY = Math.max(...rawPoints.map(p => p.y));
        
        const shapeWidth = maxX - minX;
        const shapeHeight = maxY - minY;
        
        // Calculate uniform scale to fit in canvas with margins
        const availableWidth = CANVAS_WIDTH - (MARGIN * 2);
        const availableHeight = CANVAS_HEIGHT - (MARGIN * 2);
        const scaleX = availableWidth / shapeWidth;
        const scaleY = availableHeight / shapeHeight;
        const scale = Math.min(scaleX, scaleY); // Use smaller scale to fit both dimensions
        
        // Center the shape
        const scaledWidth = shapeWidth * scale;
        const scaledHeight = shapeHeight * scale;
        const offsetX = (CANVAS_WIDTH - scaledWidth) / 2 - (minX * scale);
        const offsetY = (CANVAS_HEIGHT - scaledHeight) / 2 - (minY * scale);
        
        // Convert to fence lines with proper scaling
        segments.forEach((segment, idx) => {
            const start = rawPoints[idx];
            const end = rawPoints[idx + 1];
            
            // Apply uniform scale and centering offset
            const scaledStart = {
                x: start.x * scale + offsetX,
                y: start.y * scale + offsetY
            };
            const scaledEnd = {
                x: end.x * scale + offsetX,
                y: end.y * scale + offsetY
            };
            
            // Calculate elevation data for this segment
            let segmentElevation = null;
            if (segment.startElevation !== null && segment.endElevation !== null) {
                const dropFt = Math.abs(segment.endElevation - segment.startElevation);
                segmentElevation = {
                    startElevation: segment.startElevation,
                    endElevation: segment.endElevation,
                    dropFt,
                    slopeSource: 'DXF_AUTO_DETECT',
                    slopeDetectedFrom: 'DXF Import (Moasure)'
                };
            }
            
            lines.push({
                start: scaledStart,
                end: scaledEnd,
                length: segment.lengthFt,
                manualLengthFt: segment.lengthFt,
                isExisting: false,
                tearOut: false,
                isPerimeter: true,
                slope: "None",
                segmentNumber: segment.segmentNumber,
                dxfElevation: segmentElevation
            });
        });
        
        return lines;
    };

    const handleClose = () => {
        setFile(null);
        setError(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Import Fence Map
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                            Upload a PDF survey or DXF CAD file with fence measurements. The system will extract segment lengths and create a map drawing.
                        </AlertDescription>
                    </Alert>

                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                        <input
                            type="file"
                            accept=".pdf,.dxf"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="pdf-upload"
                            disabled={isProcessing}
                        />
                        <label
                            htmlFor="pdf-upload"
                            className="cursor-pointer flex flex-col items-center gap-2"
                        >
                            <Upload className="w-8 h-8 text-slate-400" />
                            <div>
                                <p className="text-sm font-medium">
                                    {file ? file.name : "Click to select PDF or DXF"}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    PDF or DXF files
                                </p>
                            </div>
                        </label>
                        </div>

                        {file && file.name.toLowerCase().endsWith('.dxf') && (
                        <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                            <Checkbox 
                                id="invert-dxf" 
                                checked={invertDxf}
                                onCheckedChange={setInvertDxf}
                            />
                            <Label 
                                htmlFor="invert-dxf" 
                                className="text-sm font-medium cursor-pointer"
                            >
                                Invert/Mirror DXF Image
                            </Label>
                        </div>
                        )}

                        {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={!file || isProcessing}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Import to Map
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}