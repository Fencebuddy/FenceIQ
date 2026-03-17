// Auto-orientation engine for perimeter runs

export function calculateOrientation(fenceLines) {
    // Filter perimeter runs only
    const perimeterRuns = fenceLines
        .map((line, idx) => ({ ...line, index: idx }))
        .filter(line => line.isPerimeter);

    if (perimeterRuns.length === 0) {
        return fenceLines; // No perimeter runs, return as-is
    }

    // Calculate midpoints for all perimeter runs
    const runsWithMidpoints = perimeterRuns.map(run => {
        const midX = (run.start.x + run.end.x) / 2;
        const midY = (run.start.y + run.end.y) / 2;
        return { ...run, midX, midY };
    });

    // Find boundaries
    const minY = Math.min(...runsWithMidpoints.map(r => r.midY));
    const maxY = Math.max(...runsWithMidpoints.map(r => r.midY));
    const minX = Math.min(...runsWithMidpoints.map(r => r.midX));
    const maxX = Math.max(...runsWithMidpoints.map(r => r.midX));

    // Calculate tolerances (10% of total dimensions)
    const heightRange = maxY - minY;
    const widthRange = maxX - minX;
    const backTolerance = Math.max(heightRange * 0.1, 20);
    const frontTolerance = Math.max(heightRange * 0.1, 20);
    const sideTolerance = Math.max(widthRange * 0.1, 20);

    // Horizontal center for front left/right split
    const centerX = (minX + maxX) / 2;

    // Classify and label each perimeter run
    const newLines = [...fenceLines];

    runsWithMidpoints.forEach(run => {
        // Skip if manual mode
        if (run.orientationMode === 'manual') {
            return;
        }

        let sideGroup = 'Unknown';
        let label = null;

        // Check if near top (Front)
        if (run.midY <= minY + backTolerance) {
            sideGroup = 'Front';
            // Split front into left/right
            if (run.midX < centerX) {
                label = 'Front Right';
            } else {
                label = 'Front Left';
            }
        }
        // Check if near bottom (Back)
        else if (run.midY >= maxY - frontTolerance) {
            sideGroup = 'Back';
            label = 'Back Line';
        }
        // Check if near left side
        else if (run.midX <= minX + sideTolerance) {
            sideGroup = 'Right';
            label = 'Right Side';
        }
        // Check if near right side
        else if (run.midX >= maxX - sideTolerance) {
            sideGroup = 'Left';
            label = 'Left Side';
        }

        // Update the line in newLines array
        if (label) {
            newLines[run.index] = {
                ...newLines[run.index],
                orientationLabel: label,
                sideGroup
            };
        }
    });

    return newLines;
}