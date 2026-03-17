/**
 * Segment Grouping Engine for FenceBuddy
 * 
 * Groups raw fence segments into logical runs by detecting collinear edges.
 * Segments are combined until a corner (significant angle change) is detected.
 */

const STRAIGHT_THRESHOLD = 10; // degrees - segments within this are considered same line
const CORNER_THRESHOLD = 45; // degrees - angle change to trigger new run

/**
 * Calculate angle in degrees from point A to point B
 */
function calculateAngle(startPoint, endPoint) {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const radians = Math.atan2(dy, dx);
    return (radians * 180 / Math.PI + 360) % 360; // Normalize to 0-360
}

/**
 * Calculate the smallest angle difference between two angles
 */
function angleDifference(angle1, angle2) {
    let diff = Math.abs(angle1 - angle2);
    if (diff > 180) {
        diff = 360 - diff;
    }
    return diff;
}

/**
 * Check if a point connects two segments (within tolerance)
 */
function pointsMatch(point1, point2, tolerance = 5) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy) < tolerance;
}

/**
 * Group raw segments into logical runs based on collinearity
 * 
 * @param {Array} fenceLines - Array of raw fence segments with {start, end, length, ...}
 * @returns {Array} - Array of logical runs, each containing:
 *   - rawSegments: array of original segments
 *   - totalLength: sum of all segment lengths
 *   - startPoint: first point of the run
 *   - endPoint: last point of the run
 *   - direction: average direction angle
 */
export function groupSegmentsIntoRuns(fenceLines) {
    if (!fenceLines || fenceLines.length === 0) {
        return [];
    }

    // Filter only perimeter lines for now
    const perimeterLines = fenceLines.filter(line => line.isPerimeter);
    
    if (perimeterLines.length === 0) {
        return [];
    }

    // Sort segments to form a connected path
    const orderedSegments = orderConnectedSegments(perimeterLines);
    
    if (orderedSegments.length === 0) {
        return [];
    }

    const logicalRuns = [];
    let currentRun = {
        rawSegments: [orderedSegments[0]],
        startPoint: orderedSegments[0].start,
        endPoint: orderedSegments[0].end,
        direction: calculateAngle(orderedSegments[0].start, orderedSegments[0].end),
        totalLength: orderedSegments[0].manualLengthFt || orderedSegments[0].length || 0
    };

    // Group consecutive collinear segments
    for (let i = 1; i < orderedSegments.length; i++) {
        const segment = orderedSegments[i];
        const segmentAngle = calculateAngle(segment.start, segment.end);
        const angleDiff = angleDifference(currentRun.direction, segmentAngle);

        // If angle change is small, add to current run
        if (angleDiff <= STRAIGHT_THRESHOLD) {
            currentRun.rawSegments.push(segment);
            currentRun.endPoint = segment.end;
            currentRun.totalLength += segment.manualLengthFt || segment.length || 0;
            // Update direction to average
            currentRun.direction = calculateAngle(currentRun.startPoint, currentRun.endPoint);
        } 
        // If significant angle change, start new run
        else if (angleDiff >= CORNER_THRESHOLD) {
            logicalRuns.push(currentRun);
            currentRun = {
                rawSegments: [segment],
                startPoint: segment.start,
                endPoint: segment.end,
                direction: segmentAngle,
                totalLength: segment.manualLengthFt || segment.length || 0
            };
        }
        // Middle range - check if it's close enough to continue
        else {
            // For angles between thresholds, prefer to continue current run
            currentRun.rawSegments.push(segment);
            currentRun.endPoint = segment.end;
            currentRun.totalLength += segment.manualLengthFt || segment.length || 0;
        }
    }

    // Add final run
    if (currentRun.rawSegments.length > 0) {
        logicalRuns.push(currentRun);
    }

    return logicalRuns;
}

/**
 * Order segments to form a connected path around the perimeter
 */
function orderConnectedSegments(segments) {
    if (segments.length === 0) return [];
    
    const ordered = [segments[0]];
    const remaining = segments.slice(1);
    
    while (remaining.length > 0) {
        const lastPoint = ordered[ordered.length - 1].end;
        
        // Find segment that starts near the last point
        let foundIndex = -1;
        for (let i = 0; i < remaining.length; i++) {
            if (pointsMatch(remaining[i].start, lastPoint)) {
                foundIndex = i;
                break;
            }
            // Check if segment is reversed
            if (pointsMatch(remaining[i].end, lastPoint)) {
                // Reverse the segment
                const temp = remaining[i].start;
                remaining[i].start = remaining[i].end;
                remaining[i].end = temp;
                foundIndex = i;
                break;
            }
        }
        
        if (foundIndex === -1) {
            // No connected segment found, break
            break;
        }
        
        ordered.push(remaining[foundIndex]);
        remaining.splice(foundIndex, 1);
    }
    
    return ordered;
}

/**
 * Auto-label logical runs based on position (Front, Back, Left, Right)
 */
export function autoLabelRuns(logicalRuns) {
    if (logicalRuns.length === 0) return logicalRuns;

    // Find bounding box
    let minY = Infinity, maxY = -Infinity;
    let minX = Infinity, maxX = -Infinity;
    
    logicalRuns.forEach(run => {
        [run.startPoint, run.endPoint].forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const tolerance = Math.min(width, height) * 0.2;

    // Label runs based on position
    return logicalRuns.map((run, index) => {
        const midPoint = {
            x: (run.startPoint.x + run.endPoint.x) / 2,
            y: (run.startPoint.y + run.endPoint.y) / 2
        };

        let label = `Run ${index + 1}`;

        // Check if predominantly horizontal or vertical
        const isHorizontal = Math.abs(run.endPoint.x - run.startPoint.x) > 
                            Math.abs(run.endPoint.y - run.startPoint.y);

        if (isHorizontal) {
            if (midPoint.y <= minY + tolerance) {
                label = 'Front';
            } else if (midPoint.y >= maxY - tolerance) {
                label = 'Back';
            }
        } else {
            if (midPoint.x <= minX + tolerance) {
                label = 'Left Side';
            } else if (midPoint.x >= maxX - tolerance) {
                label = 'Right Side';
            }
        }

        return {
            ...run,
            autoLabel: label
        };
    });
}