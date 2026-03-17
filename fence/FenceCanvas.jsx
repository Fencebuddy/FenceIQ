import React, { useRef, useEffect, useState } from "react";
import { calculateOrientation } from "./orientationEngine";
import { groupSegmentsIntoRuns, autoLabelRuns } from "./segmentGrouping";
import SpanOverlay from './SpanOverlay';
import { 
    findGatePostSnaps, 
    applyGatePostSnapping, 
    replacePostsWithGatePosts,
    calculatePostCountDeltas,
    removePostsInGateOpening,
    calculateSnappedGateCenter
} from '../gates/gatePostSnapEngine';

export default function FenceCanvas({ 
        fenceLines, 
        setFenceLines, 
        trees, 
        setTrees, 
        tool,
        setTool,
        selectedItem,
        setSelectedItem,
        onSaveHistory,
        scale = 1,
        rotation = 0,
        zoom = 1,
        singleGateWidth = "4'",
        doubleGateWidth = "8'",
        annotations = [],
        setAnnotations,
        spanOverlay = false,
        showNewOnly = true,
        showExisting = false,
        showSpanLabels = true,
        gates: propGates = [],
        jobPosts = [],
        spacingLabels = [],
        surfaceMountMode = false,
        onLineDrawComplete,
        onGatePlaced,
        onLineClick
    }) {
        const canvasRef = useRef(null);
        const containerRef = useRef(null);
        const drivewayImageRef = useRef(null);
        const houseImageRef = useRef(null);
        const [currentLine, setCurrentLine] = useState(null);
        const [draggingPoint, setDraggingPoint] = useState(null);
        const [hoveredPoint, setHoveredPoint] = useState(null);
        const [draggingTree, setDraggingTree] = useState(null);
        const [draggingGate, setDraggingGate] = useState(null);
        const [houses, setHouses] = useState([]);
        const [draggingHouse, setDraggingHouse] = useState(null);
        const [gates, setGates] = useState([]);
        const [doubleGates, setDoubleGates] = useState([]);
        const [draggingDoubleGate, setDraggingDoubleGate] = useState(null);
        const [pools, setPools] = useState([]);
        const [draggingPool, setDraggingPool] = useState(null);
        const [garages, setGarages] = useState([]);
        const [draggingGarage, setDraggingGarage] = useState(null);
        const [resizingStructure, setResizingStructure] = useState(null);
        const [rotatingHouse, setRotatingHouse] = useState(null);
        const [scalingItem, setScalingItem] = useState(null);
        const [dogs, setDogs] = useState([]);
        const [draggingDog, setDraggingDog] = useState(null);
        const [namingDog, setNamingDog] = useState(null);
        const [driveways, setDriveways] = useState([]);
        const [draggingDriveway, setDraggingDriveway] = useState(null);
        const [decks, setDecks] = useState([]);
        const [draggingDeck, setDraggingDeck] = useState(null);
        const [bushes, setBushes] = useState([]);
        const [draggingBush, setDraggingBush] = useState(null);
        const [porches, setPorches] = useState([]);
        const [draggingPorch, setDraggingPorch] = useState(null);
        const [grasses, setGrasses] = useState([]);
        const [draggingGrass, setDraggingGrass] = useState(null);
        const [endPosts, setEndPosts] = useState([]);
        const [draggingEndPost, setDraggingEndPost] = useState(null);
        const [beds, setBeds] = useState([]);
        const [draggingBed, setDraggingBed] = useState(null);
        const [drawingBed, setDrawingBed] = useState(null);
        const [selectedPost, setSelectedPost] = useState(null); // {lineIdx, postPositionFt, postType}
        const [draggingRun, setDraggingRun] = useState(null);
        const [snapTarget, setSnapTarget] = useState(null);
        const [logicalRuns, setLogicalRuns] = useState([]);
        const [groups, setGroups] = useState([]);
        const [selectedItems, setSelectedItems] = useState([]);
        const [interactionMode, setInteractionMode] = useState('select');
        const [cameraX, setCameraX] = useState(0);
        const [cameraY, setCameraY] = useState(0);
        const [isPanning, setIsPanning] = useState(false);
        const [panStartPos, setPanStartPos] = useState(null);
        const [snapIndicator, setSnapIndicator] = useState(null);
        const [activeTouches, setActiveTouches] = useState([]);
        const [draggingScrollbar, setDraggingScrollbar] = useState(null);
        const [pinchDistance, setPinchDistance] = useState(null);
        const [itemPinchDistance, setItemPinchDistance] = useState(null);
        const [itemTouchRotation, setItemTouchRotation] = useState(null);
        const [editingAnnotation, setEditingAnnotation] = useState(null);
        const [draggingAnnotation, setDraggingAnnotation] = useState(null);
        const [draggingTailTip, setDraggingTailTip] = useState(null);
        const [rotatingArrow, setRotatingArrow] = useState(null);
        const [resizingCallout, setResizingCallout] = useState(null);
        const [resizingArrow, setResizingArrow] = useState(null);
        const [dragStartState, setDragStartState] = useState(null);
        const [mouseDownPos, setMouseDownPos] = useState(null);
        const [isDragging, setIsDragging] = useState(false);
    const [isDraggingItem, setIsDraggingItem] = useState(false);
        const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
        const [marqueeStart, setMarqueeStart] = useState(null);
        const [marqueeEnd, setMarqueeEnd] = useState(null);
        const [isGroupDragging, setIsGroupDragging] = useState(false);
        const [groupDragStart, setGroupDragStart] = useState(null);
        const [pointerGesture, setPointerGesture] = useState(null); // { startX, startY, targetType, targetIndex, didDrag }
        const SNAP_THRESHOLD = 15; // pixels
        const ENDPOINT_SNAP_THRESHOLD = 18; // pixels for endpoint snapping
        const SEGMENT_SNAP_THRESHOLD = 12; // pixels for segment snapping
        const PARALLEL_ANGLE_TOLERANCE = 5; // degrees for parallel snap
        const PARALLEL_PROXIMITY_THRESHOLD = 20; // pixels for parallel snap activation
        const DRAG_THRESHOLD = 5; // pixels to differentiate click from drag
        const HIT_PADDING = 25; // Larger hit area for easier selection
        const HANDLE_SIZE = 12; // Visual size of scale handles
        const HANDLE_HIT_SIZE = 22; // Touch-friendly hit area for handles
        const SNAP_POINT_THRESHOLD = 15; // Pixels for snap detection

        // Abbreviate run labels
        const abbreviateLabel = (label) => {
            const abbrevMap = {
                'LEFT FRONT': 'LF',
                'LEFT SIDE': 'LS',
                'LEFT BOTTOM': 'LB',
                'LEFT TOP': 'LT',
                'RIGHT FRONT': 'RF',
                'RIGHT SIDE': 'RS',
                'RIGHT BOTTOM': 'RB',
                'RIGHT TOP': 'RT',
                'FRONT SIDE': 'FS',
                'BACK LINE': 'BL',
                'BACK LEFT': 'BL',
                'BACK RIGHT': 'BR'
            };
            return abbrevMap[label] || label;
        };
    
    // Load driveway and house icons
    useEffect(() => {
        const drivewayImg = new Image();
        drivewayImg.crossOrigin = 'anonymous';
        drivewayImg.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/8a9442682_IMG_5278.png';
        drivewayImageRef.current = drivewayImg;

        const houseImg = new Image();
        houseImg.crossOrigin = 'anonymous';
        houseImg.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/9f4510824_NotGood.png';
        houseImageRef.current = houseImg;
    }, []);
    
    // Expose state arrays to window for clear all and undo/redo
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.gates = gates;
            window.doubleGates = doubleGates;
            window.houses = houses;
            window.pools = pools;
            window.garages = garages;
            window.dogs = dogs;
            window.driveways = driveways;
            window.decks = decks;
            window.bushes = bushes;
            window.porches = porches;
            window.grasses = grasses;
            window.endPosts = endPosts;
            window.beds = beds;
            window.groups = groups;
            window.isDraggingItem = isDraggingItem;
            window.selectedItems = selectedItems;
            window.selectedItem = selectedItem;
            window.interactionMode = interactionMode;
            window.setInteractionMode = setInteractionMode;

            // Expose setter function for undo/redo
            window.setCanvasItems = (items) => {
                if (items.gates !== undefined) setGates(JSON.parse(JSON.stringify(items.gates)));
                if (items.doubleGates !== undefined) setDoubleGates(JSON.parse(JSON.stringify(items.doubleGates)));
                if (items.houses !== undefined) setHouses(JSON.parse(JSON.stringify(items.houses)));
                if (items.pools !== undefined) setPools(JSON.parse(JSON.stringify(items.pools)));
                if (items.garages !== undefined) setGarages(JSON.parse(JSON.stringify(items.garages)));
                if (items.dogs !== undefined) setDogs(JSON.parse(JSON.stringify(items.dogs)));
                if (items.driveways !== undefined) setDriveways(JSON.parse(JSON.stringify(items.driveways)));
                if (items.decks !== undefined) setDecks(JSON.parse(JSON.stringify(items.decks)));
                if (items.bushes !== undefined) setBushes(JSON.parse(JSON.stringify(items.bushes)));
                if (items.porches !== undefined) setPorches(JSON.parse(JSON.stringify(items.porches)));
                if (items.grasses !== undefined) setGrasses(JSON.parse(JSON.stringify(items.grasses)));
                if (items.endPosts !== undefined) setEndPosts(JSON.parse(JSON.stringify(items.endPosts)));
                if (items.beds !== undefined) setBeds(JSON.parse(JSON.stringify(items.beds)));
                if (items.groups !== undefined) setGroups(JSON.parse(JSON.stringify(items.groups)));
            };

            // Expose group/ungroup functions
            window.groupSelectedItems = () => {
                const currentSelectedItems = window.selectedItems || [];
                const currentGroups = window.groups || [];
                if (currentSelectedItems.length < 2) return;

                const newGroup = {
                    id: Date.now().toString(),
                    type: 'group',
                    childIds: currentSelectedItems.map(item => `${item.type}_${item.index}`),
                    x: 0,
                    y: 0,
                    rotation: 0,
                    scale: 1
                };

                // Calculate group center
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                currentSelectedItems.forEach(item => {
                    if (item.type === 'house' && window.houses && window.houses[item.index]) {
                        const house = window.houses[item.index];
                        minX = Math.min(minX, house.x);
                        minY = Math.min(minY, house.y);
                        maxX = Math.max(maxX, house.x + house.width);
                        maxY = Math.max(maxY, house.y + house.height);
                    }
                });

                newGroup.x = (minX + maxX) / 2;
                newGroup.y = (minY + maxY) / 2;
                newGroup.bounds = { minX, minY, maxX, maxY };

                const newGroups = [...currentGroups, newGroup];
                setGroups(newGroups);
                setSelectedItem({ type: 'group', index: newGroups.length - 1 });
                setSelectedItems([]);
                if (onSaveHistory) onSaveHistory();
            };

            window.ungroupSelected = () => {
                const currentSelectedItem = window.selectedItem;
                if (!currentSelectedItem || currentSelectedItem.type !== 'group') return;

                const currentGroups = window.groups || [];
                const group = currentGroups[currentSelectedItem.index];
                if (!group) return;

                // Extract child items for selection
                const childItems = group.childIds.map(id => {
                    const [type, index] = id.split('_');
                    return { type, index: parseInt(index) };
                });

                setGroups(currentGroups.filter((_, i) => i !== currentSelectedItem.index));
                setSelectedItem(null);
                setSelectedItems(childItems);
                if (onSaveHistory) onSaveHistory();
            };

            // Add function to delete fence lines by length
            window.deleteFenceLineByLength = (lengthFt) => {
                setFenceLines(prev => prev.filter(line => {
                    const effectiveLength = (line.manualLengthFt && line.manualLengthFt > 0) ? line.manualLengthFt : line.length;
                    return Math.abs(effectiveLength - lengthFt) > 0.1;
                }));
            };

            // Add function to set orientation label by length
            window.setFenceLineOrientation = (lengthFt, label) => {
                setFenceLines(prev => prev.map(line => {
                    const effectiveLength = (line.manualLengthFt && line.manualLengthFt > 0) ? line.manualLengthFt : line.length;
                    if (Math.abs(effectiveLength - lengthFt) < 0.1) {
                        return { ...line, orientationLabel: label, orientationMode: 'manual' };
                    }
                    return line;
                }));
            };
        }
    }, [gates, doubleGates, houses, pools, garages, dogs, driveways, decks, bushes, groups, isDraggingItem, selectedItems]);

    // Expose rotation function to parent
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.rotateItem = (type, index) => {
                if (type === 'gate') {
                    setGates(prev => {
                        const newGates = [...prev];
                        newGates[index] = {
                            ...newGates[index],
                            rotation: ((newGates[index].rotation || 0) + 15) % 360
                        };
                        return newGates;
                    });
                } else if (type === 'doubleGate') {
                    setDoubleGates(prev => {
                        const newGates = [...prev];
                        newGates[index] = {
                            ...newGates[index],
                            rotation: ((newGates[index].rotation || 0) + 15) % 360
                        };
                        return newGates;
                    });
                } else if (type === 'house') {
                    setHouses(prev => {
                        const newHouses = [...prev];
                        const currentRotation = newHouses[index].rotation || 0;
                        newHouses[index] = {
                            ...newHouses[index],
                            rotation: currentRotation + (Math.PI / 12)
                        };
                        return newHouses;
                    });
                } else if (type === 'pool') {
                    setPools(prev => {
                        const newPools = [...prev];
                        const pool = newPools[index];
                        newPools[index] = {
                            ...pool,
                            width: pool.height,
                            height: pool.width
                        };
                        return newPools;
                    });
                } else if (type === 'garage') {
                    setGarages(prev => {
                        const newGarages = [...prev];
                        const garage = newGarages[index];
                        newGarages[index] = {
                            ...garage,
                            width: garage.height,
                            height: garage.width
                        };
                        return newGarages;
                    });
                } else if (type === 'driveway') {
                    setDriveways(prev => {
                        const newDriveways = [...prev];
                        const driveway = newDriveways[index];
                        newDriveways[index] = {
                            ...driveway,
                            width: driveway.height,
                            height: driveway.width
                        };
                        return newDriveways;
                    });
                } else if (type === 'deck') {
                    setDecks(prev => {
                        const newDecks = [...prev];
                        const deck = newDecks[index];
                        newDecks[index] = {
                            ...deck,
                            width: deck.height,
                            height: deck.width
                        };
                        return newDecks;
                    });
                }
            };
            
            window.clearGatesOnLine = (lineIdx) => {
                setGates(prev => prev.map(g => 
                    g.attachedRunId === lineIdx 
                        ? { ...g, attachedRunId: null, snapPositionFt: null, snapPositionPercent: null }
                        : g
                ));
                setDoubleGates(prev => prev.map(g => 
                    g.attachedRunId === lineIdx 
                        ? { ...g, attachedRunId: null, snapPositionFt: null, snapPositionPercent: null }
                        : g
                ));
            };
            
            window.getGateSegments = (lineIdx) => {
                return calculateGateSegments(lineIdx);
            };
            
            window.getAllRunSegments = () => {
                const allSegments = [];
                fenceLines.forEach((line, idx) => {
                    const segments = calculateGateSegments(idx);
                    if (segments) {
                        allSegments.push({
                            runIndex: idx,
                            run: line,
                            segments
                        });
                    }
                });
                return allSegments;
            };
            
            window.nameDog = (index, name) => {
                setDogs(prev => {
                    const newDogs = [...prev];
                    newDogs[index] = { ...newDogs[index], name };
                    return newDogs;
                });
                setNamingDog(null);
            };
            
            window.changeEndPostType = (index, postType) => {
                setEndPosts(prev => {
                    const newEndPosts = [...prev];
                    newEndPosts[index] = { ...newEndPosts[index], postType };
                    return newEndPosts;
                });
            };
            
            window.changeEndPostColor = (index, color) => {
                setEndPosts(prev => {
                    const newEndPosts = [...prev];
                    newEndPosts[index] = { ...newEndPosts[index], color: color === 'default' ? null : color };
                    return newEndPosts;
                });
            };
            
            window.changeLinePostType = (lineIdx, postPositionFt, newPostType) => {
                setFenceLines(prev => {
                    const newLines = [...prev];
                    const line = newLines[lineIdx];
                    if (!line) return prev;
                    
                    const customPosts = line.customPosts || [];
                    const existingIdx = customPosts.findIndex(p => Math.abs(p.positionFt - postPositionFt) < 0.1);
                    
                    if (existingIdx >= 0) {
                        // Clear custom color when changing type (will use default type color)
                        customPosts[existingIdx] = { positionFt: postPositionFt, postType: newPostType, color: null };
                    } else {
                        customPosts.push({ positionFt: postPositionFt, postType: newPostType, color: null });
                    }
                    
                    newLines[lineIdx] = { ...line, customPosts };
                    return newLines;
                });
                setSelectedPost({ lineIdx, postPositionFt, postType: newPostType, color: null });
            };
            
            window.changeLinePostColor = (lineIdx, postPositionFt, color) => {
                setFenceLines(prev => {
                    const newLines = [...prev];
                    const line = newLines[lineIdx];
                    if (!line) return prev;
                    
                    const customPosts = line.customPosts || [];
                    const existingIdx = customPosts.findIndex(p => Math.abs(p.positionFt - postPositionFt) < 0.1);
                    
                    if (existingIdx >= 0) {
                        customPosts[existingIdx] = { ...customPosts[existingIdx], positionFt: postPositionFt, color: color === 'default' ? null : color };
                    } else {
                        customPosts.push({ positionFt: postPositionFt, color: color === 'default' ? null : color });
                    }
                    
                    newLines[lineIdx] = { ...line, customPosts };
                    return newLines;
                });
                const currentPost = window.selectedPost || {};
                setSelectedPost({ ...currentPost, lineIdx, postPositionFt, color: color === 'default' ? null : color });
            };
            
            window.selectedPost = selectedPost;
            
            window.deleteItem = (type, index) => {
                if (type === 'gate') {
                    setGates(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'doubleGate') {
                    setDoubleGates(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'tree') {
                    setTrees(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'dog') {
                    setDogs(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'house') {
                    setHouses(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'pool') {
                    setPools(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'garage') {
                    setGarages(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'driveway') {
                    setDriveways(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'deck') {
                    setDecks(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'bush') {
                    setBushes(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'porch') {
                    setPorches(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'grass') {
                    setGrasses(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'endPost') {
                    setEndPosts(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'bed') {
                    setBeds(prev => prev.filter((_, i) => i !== index));
                } else if (type === 'annotation') {
                    if (setAnnotations) {
                        setAnnotations(prev => prev.filter((_, i) => i !== index));
                    }
                } else if (type === 'group') {
                    const currentGroups = window.groups || [];
                    const group = currentGroups[index];
                    if (group) {
                        // Delete all children
                        group.childIds.forEach(id => {
                            const [childType, childIndex] = id.split('_');
                            window.deleteItem(childType, parseInt(childIndex));
                        });
                    }
                    setGroups(prev => prev.filter((_, i) => i !== index));
                }
            };
            
            window.updateRunProperties = (index, properties) => {
                setFenceLines(prev => {
                    const newLines = [...prev];
                    newLines[index] = { ...newLines[index], ...properties };
                    // Recalculate orientation for all perimeter runs
                    return calculateOrientation(newLines);
                });
            };
        }
    }, [gates, doubleGates, fenceLines, porches, grasses, endPosts, selectedPost]);
    
    // Auto-calculate orientation whenever fence lines change
    useEffect(() => {
        const hasPerimeter = fenceLines.some(line => line.isPerimeter);
        if (hasPerimeter) {
            const oriented = calculateOrientation(fenceLines);
            // Only update if orientation actually changed
            const changed = oriented.some((line, idx) => 
                line.orientationLabel !== fenceLines[idx]?.orientationLabel
            );
            if (changed) {
                setFenceLines(oriented);
            }
        }
    }, [fenceLines.map(l => `${l.isPerimeter}-${l.start.x}-${l.start.y}-${l.end.x}-${l.end.y}`).join(',')]);

    // Group segments into logical runs
    useEffect(() => {
        const runs = groupSegmentsIntoRuns(fenceLines);
        const labeled = autoLabelRuns(runs);
        setLogicalRuns(labeled);

        // Expose to window for debugging/external access
        if (typeof window !== 'undefined') {
            window.logicalRuns = labeled;
        }
    }, [fenceLines]);

    // Show naming dialog
    useEffect(() => {
        if (namingDog !== null && typeof window !== 'undefined') {
            const name = window.prompt("Enter dog's name:");
            if (name) {
                const newDogs = [...dogs];
                newDogs[namingDog] = { ...newDogs[namingDog], name };
                setDogs(newDogs);
            }
            setNamingDog(null);
        }
    }, [namingDog]);
    
    const PIXELS_PER_FOOT = 10;

    // Helper function to wrap text
    const wrapText = (ctx, text, maxWidth) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    };

    // Helper function to find intersection point on box edge
    const findBoxEdgeIntersection = (box, targetX, targetY) => {
        const centerX = box.x + box.w / 2;
        const centerY = box.y + box.h / 2;
        
        const dx = targetX - centerX;
        const dy = targetY - centerY;
        
        // Find which edge the line intersects
        const left = box.x;
        const right = box.x + box.w;
        const top = box.y;
        const bottom = box.y + box.h;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            // Intersects left or right edge
            const x = dx > 0 ? right : left;
            const y = centerY + (dy / dx) * (x - centerX);
            return { x, y: Math.max(top, Math.min(bottom, y)) };
        } else {
            // Intersects top or bottom edge
            const y = dy > 0 ? bottom : top;
            const x = centerX + (dx / dy) * (y - centerY);
            return { x: Math.max(left, Math.min(right, x)), y };
        }
    };

    // Project point onto line segment and return projection info
    function projectPointOnLine(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = lenSq !== 0 ? dot / lenSq : 0;
        
        // Clamp to line segment
        param = Math.max(0, Math.min(1, param));

        const projX = lineStart.x + param * C;
        const projY = lineStart.y + param * D;
        
        const distanceFromStart = Math.sqrt(
            Math.pow(projX - lineStart.x, 2) + Math.pow(projY - lineStart.y, 2)
        );

        return {
            point: { x: projX, y: projY },
            param,
            distanceFromStart
        };
    }

    // Helper to find closest fence line and snap position (prefers perimeter runs)
    function findClosestFenceLine(gatePos) {
        let closestLine = null;
        let closestDistance = SNAP_THRESHOLD;
        let closestProjection = null;
        let closestIsPerimeter = false;

        fenceLines.forEach((line, idx) => {
            const projection = projectPointOnLine(gatePos, line.start, line.end);
            const distance = getDistance(gatePos, projection.point);
            
            // Prefer perimeter runs: if current closest is not perimeter but this one is,
            // and distance is reasonable, prefer this one
            const shouldReplace = distance < closestDistance || 
                                  (line.isPerimeter && !closestIsPerimeter && distance < SNAP_THRESHOLD * 1.5);
            
            if (shouldReplace) {
                closestDistance = distance;
                closestLine = idx;
                closestProjection = projection;
                closestIsPerimeter = line.isPerimeter || false;
            }
        });

        if (closestLine !== null) {
            // Use effective length (manual override if set) to calculate position in feet
            const line = fenceLines[closestLine];
            const effectiveLengthFt = (line.manualLengthFt && line.manualLengthFt > 0) 
                ? line.manualLengthFt 
                : line.length;
            
            return {
                lineIdx: closestLine,
                snapPoint: closestProjection.point,
                snapPositionFt: closestProjection.param * effectiveLengthFt,
                snapPositionPercent: closestProjection.param * 100
            };
        }
        return null;
    }

    // Calculate fence segments around gates for a specific run
    function calculateGateSegments(lineIdx) {
        const line = fenceLines[lineIdx];
        if (!line) return null;

        // Use effective length (manual override if set, otherwise drawn length)
        const effectiveLengthFt = (line.manualLengthFt && line.manualLengthFt > 0) 
            ? line.manualLengthFt 
            : line.length;
        const totalLengthFt = effectiveLengthFt;
        
        // Find all gates attached to this line with actual widths
        // Parse width strings like "4'" or "8'" to numbers
        const parseGateWidth = (width) => {
            if (typeof width === 'number') return width;
            if (typeof width === 'string') {
                const parsed = parseFloat(width.replace(/'/g, ''));
                return isNaN(parsed) ? 4 : parsed;
            }
            return 4;
        };
        
        const attachedGates = [
            ...gates.map((g, i) => ({ 
                ...g, 
                type: 'gate', 
                index: i, 
                widthFt: parseGateWidth(g.width)
            })),
            ...doubleGates.map((g, i) => ({ 
                ...g, 
                type: 'doubleGate', 
                index: i, 
                widthFt: parseGateWidth(g.width)
            }))
        ].filter(g => g.attachedRunId === lineIdx)
          .sort((a, b) => (a.snapPositionFt || 0) - (b.snapPositionFt || 0));

        if (attachedGates.length === 0) {
            return [{
                type: 'fence',
                lengthFt: totalLengthFt,
                startFt: 0,
                endFt: totalLengthFt,
                runId: lineIdx
            }];
        }

        // Build breakpoints: start, all gate edges, end
        const breakpoints = [0];
        
        attachedGates.forEach(gate => {
            const gateCenter = gate.snapPositionFt || 0;
            const halfWidth = gate.widthFt / 2;
            // Ensure gate edges are within the run bounds
            const leftEdge = Math.max(0, gateCenter - halfWidth);
            const rightEdge = Math.min(totalLengthFt, gateCenter + halfWidth);

            breakpoints.push(leftEdge);
            breakpoints.push(rightEdge);
        });
        
        breakpoints.push(totalLengthFt);
        
        // Sort and remove duplicates
        const sortedBreakpoints = [...new Set(breakpoints)].sort((a, b) => a - b);
        
        // Create segments between consecutive breakpoints
        const segments = [];
        let gateIndex = 0;
        
        for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
            const startFt = sortedBreakpoints[i];
            const endFt = sortedBreakpoints[i + 1];
            const lengthFt = endFt - startFt;
            
            if (lengthFt < 0.01) continue; // Skip tiny segments
            
            // Determine if this segment is a gate or fence
            let isGate = false;
            let gateData = null;
            
            // Check if this segment falls within a gate's bounds
            for (const gate of attachedGates) {
                const gateCenter = gate.snapPositionFt || 0;
                const halfWidth = gate.widthFt / 2;
                const gateLeft = gateCenter - halfWidth;
                const gateRight = gateCenter + halfWidth;
                
                // If segment midpoint is within gate bounds, it's a gate segment
                const segmentMid = (startFt + endFt) / 2;
                if (segmentMid >= gateLeft && segmentMid <= gateRight) {
                    isGate = true;
                    gateData = gate;
                    break;
                }
            }
            
            if (isGate && gateData) {
                // Calculate fence to left and right of this gate
                const leftFenceLengthFt = startFt;
                const rightFenceLengthFt = totalLengthFt - endFt;
                
                // Find immediately adjacent fence segments
                const prevSegment = segments[segments.length - 1];
                const fenceImmediatelyBefore = (prevSegment && prevSegment.type === 'fence') ? prevSegment.lengthFt : 0;
                
                // Gate segment - use the actual gate width from gateData
                const gateSegment = {
                    type: 'gate',
                    gate: gateData,
                    gateId: gateData.type + '_' + gateData.index,
                    lengthFt: gateData.widthFt, // Use the actual parsed gate width
                    leftFenceLengthFt,
                    rightFenceLengthFt,
                    fenceImmediatelyBefore,
                    fenceImmediatelyAfter: 0, // Will be updated when next fence segment is found
                    startFt,
                    endFt,
                    runId: lineIdx
                };
                
                segments.push(gateSegment);
            } else {
                // Fence segment
                const fenceSegment = {
                    type: 'fence',
                    lengthFt: lengthFt,
                    startFt,
                    endFt,
                    runId: lineIdx
                };
                
                // If previous segment was a gate, update its fenceImmediatelyAfter
                const prevSegment = segments[segments.length - 1];
                if (prevSegment && prevSegment.type === 'gate') {
                    prevSegment.fenceImmediatelyAfter = lengthFt;
                }
                
                segments.push(fenceSegment);
            }
        }

        return segments;
    }

    useEffect(() => {
        draw();
    }, [fenceLines, trees, currentLine, hoveredPoint, selectedItem, selectedItems, houses, gates, doubleGates, pools, garages, dogs, driveways, decks, bushes, porches, grasses, endPosts, beds, drawingBed, groups, annotations, editingAnnotation, scale, rotation, zoom, snapTarget, snapIndicator, cameraX, cameraY, spanOverlay, showNewOnly, showExisting, showSpanLabels, isMarqueeSelecting, marqueeStart, marqueeEnd, jobPosts, spacingLabels]);

    const draw = () => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext("2d");

        // Set canvas to viewport size
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width - 20; // Leave room for scrollbar
        canvas.height = rect.height - 20;

        // Clear canvas
        ctx.fillStyle = "#F8FAFC";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Apply camera transform and zoom
        ctx.save();
        ctx.scale(zoom, zoom);
        ctx.translate(-cameraX, -cameraY);

        // Draw GRASS first (bottom layer - floats under everything)
        grasses.forEach((grass, idx) => {
            const isSelected = selectedItem?.type === 'grass' && selectedItem?.index === idx;
            
            // Grass area (green with texture)
            ctx.fillStyle = isSelected ? "#22C55E" : "#16A34A";
            ctx.fillRect(grass.x, grass.y, grass.width, grass.height);
            
            // Grass texture (lighter stripes)
            ctx.fillStyle = "rgba(34, 197, 94, 0.3)";
            for (let i = 0; i < grass.width; i += 8) {
                ctx.fillRect(grass.x + i, grass.y, 4, grass.height);
            }
            
            // Grass label
            ctx.fillStyle = "#FFF";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("GRASS", grass.x + grass.width / 2, grass.y + grass.height / 2);

            if (isSelected) {
                ctx.strokeStyle = "#22C55E";
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(grass.x, grass.y, grass.width, grass.height);
                ctx.setLineDash([]);

                // Draw scale handles
                const handles = [
                    {x: grass.x, y: grass.y, corner: 'tl'},
                    {x: grass.x + grass.width, y: grass.y, corner: 'tr'},
                    {x: grass.x, y: grass.y + grass.height, corner: 'bl'},
                    {x: grass.x + grass.width, y: grass.y + grass.height, corner: 'br'}
                ];
                ctx.fillStyle = "#FFFFFF";
                ctx.strokeStyle = "#22C55E";
                ctx.lineWidth = 2;
                handles.forEach(h => {
                    ctx.fillRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                    ctx.strokeRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                });
            }
        });

        // Draw grid - DYNAMIC 10 FT PER SQUARE
        const worldWidth = 2000;
        const worldHeight = 1500;
        const BaseGridSquarePixels = 40; // Base size: 10 ft × 10 ft
        const gridSpacing = BaseGridSquarePixels / scale;
        ctx.strokeStyle = "#E2E8F0";
        ctx.lineWidth = 1 / zoom;

        const startX = Math.floor(cameraX / gridSpacing) * gridSpacing;
        const endX = cameraX + canvas.width / zoom;
        const startY = Math.floor(cameraY / gridSpacing) * gridSpacing;
        const endY = cameraY + canvas.height / zoom;

        for (let x = startX; x < endX; x += gridSpacing) {
            if (x >= 0 && x <= worldWidth) {
                ctx.beginPath();
                ctx.moveTo(x, Math.max(0, cameraY));
                ctx.lineTo(x, Math.min(worldHeight, endY));
                ctx.stroke();
            }
        }
        for (let y = startY; y < endY; y += gridSpacing) {
            if (y >= 0 && y <= worldHeight) {
                ctx.beginPath();
                ctx.moveTo(Math.max(0, cameraX), y);
                ctx.lineTo(Math.min(worldWidth, endX), y);
                ctx.stroke();
            }
        }

        // Draw houses
        houses.forEach((house, idx) => {
            const isSelected = selectedItem?.type === 'house' && selectedItem?.index === idx;
            const isMultiSelected = selectedItems.some(item => item.type === 'house' && item.index === idx);
            const rotation = house.rotation || 0;
            const scale = house.scale || 1;
            const centerX = house.x + house.width / 2;
            const centerY = house.y + house.height / 2;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(rotation);
            ctx.scale(scale, scale);
            ctx.translate(-centerX, -centerY);

            // Draw house icon image (only if loaded)
            if (houseImageRef.current && houseImageRef.current.complete) {
                ctx.drawImage(houseImageRef.current, house.x, house.y, house.width, house.height);
            }

            ctx.restore();

            // Draw snap points when dragging
            if (draggingHouse !== null && draggingHouse !== idx) {
                const snapPoints = getHouseSnapPoints(house);
                ctx.fillStyle = "#10B981";
                snapPoints.forEach(sp => {
                    ctx.beginPath();
                    ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                });
            }

            // Multi-select highlight
            if (isMultiSelected) {
                const corners = [
                    {x: house.x, y: house.y},
                    {x: house.x + house.width, y: house.y},
                    {x: house.x, y: house.y + house.height},
                    {x: house.x + house.width, y: house.y + house.height}
                ];

                const transformedCorners = corners.map(c => {
                    const cos = Math.cos(rotation);
                    const sin = Math.sin(rotation);
                    const dx = (c.x - centerX) * scale;
                    const dy = (c.y - centerY) * scale;
                    return {
                        x: centerX + (dx * cos - dy * sin),
                        y: centerY + (dx * sin + dy * cos)
                    };
                });

                ctx.strokeStyle = "#F59E0B";
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(transformedCorners[0].x, transformedCorners[0].y);
                ctx.lineTo(transformedCorners[1].x, transformedCorners[1].y);
                ctx.lineTo(transformedCorners[3].x, transformedCorners[3].y);
                ctx.lineTo(transformedCorners[2].x, transformedCorners[2].y);
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);
            }

            if (isSelected) {
                // Calculate transformed corner positions
                const corners = [
                    {x: house.x, y: house.y, corner: 'tl'},
                    {x: house.x + house.width, y: house.y, corner: 'tr'},
                    {x: house.x, y: house.y + house.height, corner: 'bl'},
                    {x: house.x + house.width, y: house.y + house.height, corner: 'br'}
                ];

                const transformedCorners = corners.map(c => {
                    const cos = Math.cos(rotation);
                    const sin = Math.sin(rotation);
                    const dx = (c.x - centerX) * scale;
                    const dy = (c.y - centerY) * scale;
                    return {
                        x: centerX + (dx * cos - dy * sin),
                        y: centerY + (dx * sin + dy * cos),
                        corner: c.corner
                    };
                });

                // Draw tight bounding box
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(transformedCorners[0].x, transformedCorners[0].y);
                ctx.lineTo(transformedCorners[1].x, transformedCorners[1].y);
                ctx.lineTo(transformedCorners[3].x, transformedCorners[3].y);
                ctx.lineTo(transformedCorners[2].x, transformedCorners[2].y);
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);

                // Draw scale handles at 4 corners only
                ctx.fillStyle = "#FFFFFF";
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 1.5;
                transformedCorners.forEach(corner => {
                    ctx.fillRect(corner.x - HANDLE_SIZE/2, corner.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                    ctx.strokeRect(corner.x - HANDLE_SIZE/2, corner.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                });
            }
        });

        // Draw trees
        trees.forEach((tree, idx) => {
            const isSelected = selectedItem?.type === 'tree' && selectedItem?.index === idx;
            ctx.fillStyle = isSelected ? "#10B981" : "#059669";
            ctx.beginPath();
            ctx.arc(tree.x, tree.y, 15, 0, Math.PI * 2);
            ctx.fill();
            
            // Tree crown
            ctx.fillStyle = isSelected ? "#34D399" : "#10B981";
            ctx.beginPath();
            ctx.arc(tree.x, tree.y, 12, 0, Math.PI * 2);
            ctx.fill();

            if (isSelected) {
                ctx.strokeStyle = "#10B981";
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(tree.x, tree.y, 20, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

        // Draw driveways (scalable)
        driveways.forEach((driveway, idx) => {
            const isSelected = selectedItem?.type === 'driveway' && selectedItem?.index === idx;
            
            // Draw driveway icon if loaded
            if (drivewayImageRef.current && drivewayImageRef.current.complete) {
                ctx.drawImage(drivewayImageRef.current, driveway.x, driveway.y, driveway.width, driveway.height);
            } else {
                // Fallback rendering while image loads
                ctx.fillStyle = isSelected ? "#9CA3AF" : "#6B7280";
                ctx.fillRect(driveway.x, driveway.y, driveway.width, driveway.height);
            }

            if (isSelected) {
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(driveway.x, driveway.y, driveway.width, driveway.height);
                ctx.setLineDash([]);

                // Draw scale handles
                const handles = [
                    {x: driveway.x, y: driveway.y, corner: 'tl'},
                    {x: driveway.x + driveway.width, y: driveway.y, corner: 'tr'},
                    {x: driveway.x, y: driveway.y + driveway.height, corner: 'bl'},
                    {x: driveway.x + driveway.width, y: driveway.y + driveway.height, corner: 'br'}
                ];
                ctx.fillStyle = "#FFFFFF";
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 2;
                handles.forEach(h => {
                    ctx.fillRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                    ctx.strokeRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                });
            }
        });

        // Draw decks
        decks.forEach((deck, idx) => {
            const isSelected = selectedItem?.type === 'deck' && selectedItem?.index === idx;
            
            // Deck surface (wood planks)
            ctx.fillStyle = isSelected ? "#B45309" : "#92400E";
            ctx.fillRect(deck.x, deck.y, deck.width, deck.height);
            
            // Wood plank lines
            ctx.strokeStyle = "#78350F";
            ctx.lineWidth = 2;
            for (let i = 1; i < 6; i++) {
                const yPos = deck.y + (deck.height / 6) * i;
                ctx.beginPath();
                ctx.moveTo(deck.x, yPos);
                ctx.lineTo(deck.x + deck.width, yPos);
                ctx.stroke();
            }
            
            // Deck border
            ctx.strokeStyle = isSelected ? "#3B82F6" : "#451A03";
            ctx.lineWidth = 3;
            ctx.strokeRect(deck.x, deck.y, deck.width, deck.height);
            
            // Deck label
            ctx.fillStyle = "#FFF";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("DECK", deck.x + deck.width / 2, deck.y + deck.height / 2);

            if (isSelected) {
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(deck.x, deck.y, deck.width, deck.height);
                ctx.setLineDash([]);

                // Draw scale handles
                const handles = [
                    {x: deck.x, y: deck.y, corner: 'tl'},
                    {x: deck.x + deck.width, y: deck.y, corner: 'tr'},
                    {x: deck.x, y: deck.y + deck.height, corner: 'bl'},
                    {x: deck.x + deck.width, y: deck.y + deck.height, corner: 'br'}
                ];
                ctx.fillStyle = "#FFFFFF";
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 2;
                handles.forEach(h => {
                    ctx.fillRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                    ctx.strokeRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                });
            }
        });

        // Draw porches
        porches.forEach((porch, idx) => {
            const isSelected = selectedItem?.type === 'porch' && selectedItem?.index === idx;
            
            // Porch floor (wood)
            ctx.fillStyle = isSelected ? "#B45309" : "#92400E";
            ctx.fillRect(porch.x, porch.y, porch.width, porch.height);
            
            // Wood plank lines
            ctx.strokeStyle = "#78350F";
            ctx.lineWidth = 2;
            for (let i = 1; i < 8; i++) {
                const xPos = porch.x + (porch.width / 8) * i;
                ctx.beginPath();
                ctx.moveTo(xPos, porch.y);
                ctx.lineTo(xPos, porch.y + porch.height);
                ctx.stroke();
            }
            
            // Porch border/railing
            ctx.strokeStyle = isSelected ? "#3B82F6" : "#451A03";
            ctx.lineWidth = 4;
            ctx.strokeRect(porch.x, porch.y, porch.width, porch.height);
            
            // Porch label
            ctx.fillStyle = "#FFF";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("PORCH", porch.x + porch.width / 2, porch.y + porch.height / 2);

            if (isSelected) {
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(porch.x, porch.y, porch.width, porch.height);
                ctx.setLineDash([]);

                // Draw scale handles
                const handles = [
                    {x: porch.x, y: porch.y, corner: 'tl'},
                    {x: porch.x + porch.width, y: porch.y, corner: 'tr'},
                    {x: porch.x, y: porch.y + porch.height, corner: 'bl'},
                    {x: porch.x + porch.width, y: porch.y + porch.height, corner: 'br'}
                ];
                ctx.fillStyle = "#FFFFFF";
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 2;
                handles.forEach(h => {
                    ctx.fillRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                    ctx.strokeRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                });
            }
        });

        // Draw bushes
        bushes.forEach((bush, idx) => {
            const isSelected = selectedItem?.type === 'bush' && selectedItem?.index === idx;
            
            // Bush base
            ctx.fillStyle = isSelected ? "#16A34A" : "#15803D";
            ctx.beginPath();
            ctx.arc(bush.x, bush.y, 12, 0, Math.PI * 2);
            ctx.fill();
            
            // Bush clusters
            ctx.fillStyle = isSelected ? "#22C55E" : "#16A34A";
            ctx.beginPath();
            ctx.arc(bush.x - 5, bush.y - 5, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(bush.x + 5, bush.y - 5, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(bush.x, bush.y - 8, 8, 0, Math.PI * 2);
            ctx.fill();

            if (isSelected) {
                ctx.strokeStyle = "#16A34A";
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(bush.x, bush.y, 18, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

        // Draw beds (flower beds with editable polygon vertices)
        beds.forEach((bed, idx) => {
            const isSelected = selectedItem?.type === 'bed' && selectedItem?.index === idx;
            
            if (bed.vertices && bed.vertices.length >= 2) {
                // Draw bed fill
                ctx.fillStyle = isSelected ? "#F472B6" : "#EC4899";
                ctx.beginPath();
                ctx.moveTo(bed.vertices[0].x, bed.vertices[0].y);
                bed.vertices.forEach(v => ctx.lineTo(v.x, v.y));
                ctx.closePath();
                ctx.fill();
                
                // Draw bed outline
                ctx.strokeStyle = isSelected ? "#BE185D" : "#9F1239";
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // Flower pattern inside bed
                ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                const centerX = bed.vertices.reduce((sum, v) => sum + v.x, 0) / bed.vertices.length;
                const centerY = bed.vertices.reduce((sum, v) => sum + v.y, 0) / bed.vertices.length;
                for (let i = 0; i < 5; i++) {
                    const angle = (i / 5) * Math.PI * 2;
                    const fx = centerX + Math.cos(angle) * 15;
                    const fy = centerY + Math.sin(angle) * 15;
                    ctx.beginPath();
                    ctx.arc(fx, fy, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Bed label
                ctx.fillStyle = "#FFF";
                ctx.font = "bold 12px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("BED", centerX, centerY);
                
                // Draw vertices and edges when selected
                if (isSelected) {
                    bed.vertices.forEach((vertex, vIdx) => {
                        ctx.fillStyle = "#FFF";
                        ctx.strokeStyle = "#BE185D";
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(vertex.x, vertex.y, 6, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    });
                }
            }
        });
        
        // Draw bed being drawn (partial polygon)
        if (drawingBed && drawingBed.vertices && drawingBed.vertices.length > 0) {
            // Draw existing vertices and edges
            ctx.strokeStyle = "#EC4899";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(drawingBed.vertices[0].x, drawingBed.vertices[0].y);
            drawingBed.vertices.forEach(v => ctx.lineTo(v.x, v.y));
            // Draw line to current mouse position if exists
            if (drawingBed.currentPos) {
                ctx.lineTo(drawingBed.currentPos.x, drawingBed.currentPos.y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw vertices
            drawingBed.vertices.forEach((vertex, vIdx) => {
                ctx.fillStyle = vIdx === 0 ? "#10B981" : "#FFF";
                ctx.strokeStyle = "#EC4899";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(vertex.x, vertex.y, vIdx === 0 ? 8 : 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
            
            // Show "Click to finish" near first vertex
            if (drawingBed.vertices.length >= 3) {
                ctx.fillStyle = "#059669";
                ctx.strokeStyle = "#FFF";
                ctx.lineWidth = 2;
                ctx.font = "bold 11px sans-serif";
                ctx.textAlign = "center";
                ctx.strokeText("Click first point to finish", drawingBed.vertices[0].x, drawingBed.vertices[0].y - 15);
                ctx.fillText("Click first point to finish", drawingBed.vertices[0].x, drawingBed.vertices[0].y - 15);
            }
        }

        // Draw end posts
        endPosts.forEach((endPost, idx) => {
            const isSelected = selectedItem?.type === 'endPost' && selectedItem?.index === idx;
            const isSnapped = endPost.attachedRunId !== null && endPost.attachedRunId !== undefined;
            const postType = endPost.postType || 'end';
            
            // Color based on post type (with custom color override)
            let fillColor = "#F97316"; // Orange for end posts
            let radius = 7;
            if (endPost.color) {
                fillColor = endPost.color;
            } else {
                if (postType === 'corner') {
                    fillColor = "#DC2626"; // Red for corner
                    radius = 8;
                } else if (postType === 'line') {
                    fillColor = "#3B82F6"; // Blue for line posts
                    radius = 5;
                }
            }
            
            if (isSelected) {
                radius += 1;
            }
            
            // Post marker (round dot)
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = "#FFF";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(endPost.x, endPost.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Show position label if snapped
            if (isSnapped && endPost.snapPositionFt !== null) {
                ctx.fillStyle = "#1E293B";
                ctx.strokeStyle = "#FFF";
                ctx.lineWidth = 2.5;
                ctx.font = "bold 10px sans-serif";
                ctx.textAlign = "center";
                ctx.strokeText(`${endPost.snapPositionFt.toFixed(1)}'`, endPost.x, endPost.y - 15);
                ctx.fillText(`${endPost.snapPositionFt.toFixed(1)}'`, endPost.x, endPost.y - 15);
            }
            
            // Snap indicator
            if (isSnapped) {
                ctx.strokeStyle = "#10B981";
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.arc(endPost.x, endPost.y, 12, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            if (isSelected) {
                ctx.strokeStyle = "#10B981";
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(endPost.x, endPost.y, 18, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

        // Draw dogs
        dogs.forEach((dog, idx) => {
            const isSelected = selectedItem?.type === 'dog' && selectedItem?.index === idx;
            
            // Draw dog head (circle)
            ctx.fillStyle = isSelected ? "#D97706" : "#92400E";
            ctx.beginPath();
            ctx.arc(dog.x, dog.y, 18, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw ears
            ctx.fillStyle = isSelected ? "#B45309" : "#78350F";
            ctx.beginPath();
            ctx.arc(dog.x - 12, dog.y - 8, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(dog.x + 12, dog.y - 8, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw eyes
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(dog.x - 6, dog.y - 2, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(dog.x + 6, dog.y - 2, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw nose
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(dog.x, dog.y + 5, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw mouth
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(dog.x, dog.y + 5, 5, 0, Math.PI);
            ctx.stroke();

            // Draw name if exists
            if (dog.name) {
                ctx.fillStyle = "#FFF";
                ctx.fillRect(dog.x - 30, dog.y + 25, 60, 18);
                ctx.strokeStyle = "#92400E";
                ctx.strokeRect(dog.x - 30, dog.y + 25, 60, 18);
                ctx.fillStyle = "#1E293B";
                ctx.font = "bold 11px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(dog.name, dog.x, dog.y + 37);
            }

            if (isSelected) {
                ctx.strokeStyle = "#D97706";
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(dog.x, dog.y, 25, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

        // Draw single gates
        gates.forEach((gate, idx) => {
            const isSelected = selectedItem?.type === 'gate' && selectedItem?.index === idx;
            const isSnapped = gate.attachedRunId !== null && gate.attachedRunId !== undefined;

            ctx.save();
                ctx.translate(gate.x, gate.y);

                // Apply rotation from fence line (rotationRad derived from snap)
                if (gate.rotationRad !== undefined) {
                    ctx.rotate(gate.rotationRad);
                } else if (gate.rotation) {
                    // Legacy rotation in degrees (fallback)
                    ctx.rotate((gate.rotation * Math.PI) / 180);
                }

                ctx.strokeStyle = isSelected ? "#3B82F6" : isSnapped ? "#DC2626" : "#DC2626";
                ctx.fillStyle = isSelected ? "#3B82F6" : isSnapped ? "#DC2626" : "#DC2626";
                ctx.lineWidth = 3.1;

                // Draw double-headed arrow icon
                const arrowWidth = 10;
                const arrowHeight = 4;

            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(-arrowWidth, 0);
            ctx.lineTo(arrowWidth, 0);
            ctx.stroke();

            // Left arrowhead
            ctx.beginPath();
            ctx.moveTo(-arrowWidth, 0);
            ctx.lineTo(-arrowWidth + arrowHeight, -arrowHeight);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-arrowWidth, 0);
            ctx.lineTo(-arrowWidth + arrowHeight, arrowHeight);
            ctx.stroke();

            // Right arrowhead
            ctx.beginPath();
            ctx.moveTo(arrowWidth, 0);
            ctx.lineTo(arrowWidth - arrowHeight, -arrowHeight);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(arrowWidth, 0);
            ctx.lineTo(arrowWidth - arrowHeight, arrowHeight);
            ctx.stroke();

            ctx.restore();

            // Snap indicator
            if (isSnapped) {
                ctx.strokeStyle = "#10B981";
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.arc(gate.x, gate.y, 15, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            if (isSelected) {
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(gate.x, gate.y, 12, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            });

        // Draw double gates
        doubleGates.forEach((gate, idx) => {
            const isSelected = selectedItem?.type === 'doubleGate' && selectedItem?.index === idx;
            const isSnapped = gate.attachedRunId !== null && gate.attachedRunId !== undefined;

            ctx.save();
            ctx.translate(gate.x, gate.y);

            // Apply rotation from fence line (rotationRad derived from snap)
            if (gate.rotationRad !== undefined) {
                ctx.rotate(gate.rotationRad);
            } else if (gate.rotation) {
                // Legacy rotation in degrees (fallback)
                ctx.rotate((gate.rotation * Math.PI) / 180);
            }

            ctx.strokeStyle = isSelected ? "#3B82F6" : isSnapped ? "#DC2626" : "#DC2626";
                ctx.fillStyle = isSelected ? "#3B82F6" : isSnapped ? "#DC2626" : "#DC2626";
                ctx.lineWidth = 3.1;

                // Draw double-headed arrow icon (wider for double gate)
                const arrowWidth = 17.5;
                const arrowHeight = 4;

            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(-arrowWidth, 0);
            ctx.lineTo(arrowWidth, 0);
            ctx.stroke();

            // Left arrowhead
            ctx.beginPath();
            ctx.moveTo(-arrowWidth, 0);
            ctx.lineTo(-arrowWidth + arrowHeight, -arrowHeight);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-arrowWidth, 0);
            ctx.lineTo(-arrowWidth + arrowHeight, arrowHeight);
            ctx.stroke();

            // Right arrowhead
            ctx.beginPath();
            ctx.moveTo(arrowWidth, 0);
            ctx.lineTo(arrowWidth - arrowHeight, -arrowHeight);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(arrowWidth, 0);
            ctx.lineTo(arrowWidth - arrowHeight, arrowHeight);
            ctx.stroke();

            ctx.restore();

            // Snap indicator
            if (isSnapped) {
                ctx.strokeStyle = "#10B981";
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.arc(gate.x, gate.y, 22.5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            if (isSelected) {
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(gate.x, gate.y, 20, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            });

        // Draw pools
        pools.forEach((pool, idx) => {
            const isSelected = selectedItem?.type === 'pool' && selectedItem?.index === idx;

            // Pool water
            ctx.fillStyle = isSelected ? "#0EA5E9" : "#0284C7";
            ctx.fillRect(pool.x, pool.y, pool.width, pool.height);

            // Pool border
            ctx.strokeStyle = isSelected ? "#3B82F6" : "#0369A1";
            ctx.lineWidth = 3;
            ctx.strokeRect(pool.x, pool.y, pool.width, pool.height);

            // Water ripple effect
            ctx.strokeStyle = "#38BDF8";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(pool.x + 10, pool.y + 10, pool.width - 20, pool.height - 20);
            ctx.setLineDash([]);

            // Pool label
            ctx.fillStyle = "#FFF";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("POOL", pool.x + pool.width / 2, pool.y + pool.height / 2);

            if (isSelected) {
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(pool.x, pool.y, pool.width, pool.height);
                ctx.setLineDash([]);

                // Draw scale handles
                const handles = [
                    {x: pool.x, y: pool.y, corner: 'tl'},
                    {x: pool.x + pool.width, y: pool.y, corner: 'tr'},
                    {x: pool.x, y: pool.y + pool.height, corner: 'bl'},
                    {x: pool.x + pool.width, y: pool.y + pool.height, corner: 'br'}
                ];
                ctx.fillStyle = "#FFFFFF";
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 2;
                handles.forEach(h => {
                    ctx.fillRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                    ctx.strokeRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                });
            }
        });

        // Draw garages
        garages.forEach((garage, idx) => {
            const isSelected = selectedItem?.type === 'garage' && selectedItem?.index === idx;

            // Garage body
            ctx.fillStyle = isSelected ? "#94A3B8" : "#64748B";
            ctx.fillRect(garage.x, garage.y, garage.width, garage.height);

            // Garage door
            ctx.fillStyle = "#475569";
            ctx.fillRect(garage.x + 10, garage.y + garage.height - 40, garage.width - 20, 35);

            // Door panels
            ctx.strokeStyle = "#334155";
            ctx.lineWidth = 2;
            for (let i = 1; i < 4; i++) {
                const yPos = garage.y + garage.height - 40 + (i * 35 / 4);
                ctx.beginPath();
                ctx.moveTo(garage.x + 10, yPos);
                ctx.lineTo(garage.x + garage.width - 10, yPos);
                ctx.stroke();
            }

            // Garage roof
            ctx.fillStyle = "#334155";
            ctx.beginPath();
            ctx.moveTo(garage.x - 5, garage.y);
            ctx.lineTo(garage.x + garage.width / 2, garage.y - 15);
            ctx.lineTo(garage.x + garage.width + 5, garage.y);
            ctx.closePath();
            ctx.fill();

            // Garage label
            ctx.fillStyle = "#FFF";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("GARAGE", garage.x + garage.width / 2, garage.y + 20);

            if (isSelected) {
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(garage.x, garage.y, garage.width, garage.height);
                ctx.setLineDash([]);

                // Draw scale handles
                const handles = [
                    {x: garage.x, y: garage.y, corner: 'tl'},
                    {x: garage.x + garage.width, y: garage.y, corner: 'tr'},
                    {x: garage.x, y: garage.y + garage.height, corner: 'bl'},
                    {x: garage.x + garage.width, y: garage.y + garage.height, corner: 'br'}
                ];
                ctx.fillStyle = "#FFFFFF";
                ctx.strokeStyle = "#3B82F6";
                ctx.lineWidth = 2;
                handles.forEach(h => {
                    ctx.fillRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                    ctx.strokeRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
                });
            }
        });

        // Draw annotations (callouts and arrows)
        if (annotations && Array.isArray(annotations)) {
            annotations.forEach((annotation, idx) => {
                if (annotation.type === 'callout') {
                    const isSelected = selectedItem?.type === 'annotation' && selectedItem?.index === idx;
                    const isEditing = editingAnnotation === idx;

                    // Draw callout box
                    ctx.fillStyle = annotation.style?.bg || '#FFFFFF';
                    ctx.strokeStyle = annotation.style?.border || '#334155';
                    ctx.lineWidth = 2;
                    ctx.shadowColor = 'rgba(0,0,0,0.1)';
                    ctx.shadowBlur = 4;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;
                    ctx.fillRect(annotation.box.x, annotation.box.y, annotation.box.w, annotation.box.h);
                    ctx.strokeRect(annotation.box.x, annotation.box.y, annotation.box.w, annotation.box.h);
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;

                    // Draw text
                    ctx.fillStyle = '#1E293B';
                    ctx.font = `${annotation.style?.bold ? 'bold ' : ''}${annotation.style?.fontSize || 14}px sans-serif`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';

                    const padding = 8;
                    const maxWidth = annotation.box.w - padding * 2;
                    const lines = wrapText(ctx, annotation.text || 'Type note...', maxWidth);
                    lines.forEach((line, i) => {
                        ctx.fillText(line, annotation.box.x + padding, annotation.box.y + padding + i * (annotation.style?.fontSize || 14) * 1.2);
                    });

                    // Draw tail line
                    ctx.strokeStyle = '#64748B';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([]);

                    // Find closest point on box edge to tail tip
                    const boxCenterX = annotation.box.x + annotation.box.w / 2;
                    const boxCenterY = annotation.box.y + annotation.box.h / 2;
                    const tailAnchor = findBoxEdgeIntersection(
                        annotation.box,
                        annotation.tail.anchorX,
                        annotation.tail.anchorY
                    );

                    ctx.beginPath();
                    ctx.moveTo(tailAnchor.x, tailAnchor.y);
                    ctx.lineTo(annotation.tail.anchorX, annotation.tail.anchorY);
                    ctx.stroke();

                    // Draw tail tip handle
                    if (isSelected) {
                        ctx.fillStyle = '#3B82F6';
                        ctx.beginPath();
                        ctx.arc(annotation.tail.anchorX, annotation.tail.anchorY, 6, 0, Math.PI * 2);
                        ctx.fill();

                        // Draw selection outline on box
                        ctx.strokeStyle = '#3B82F6';
                        ctx.lineWidth = 3;
                        ctx.setLineDash([5, 5]);
                        ctx.strokeRect(annotation.box.x - 2, annotation.box.y - 2, annotation.box.w + 4, annotation.box.h + 4);
                        ctx.setLineDash([]);

                        // Draw resize handles
                        const handles = [
                            {x: annotation.box.x, y: annotation.box.y},
                            {x: annotation.box.x + annotation.box.w, y: annotation.box.y},
                            {x: annotation.box.x, y: annotation.box.y + annotation.box.h},
                            {x: annotation.box.x + annotation.box.w, y: annotation.box.y + annotation.box.h}
                        ];
                        ctx.fillStyle = '#3B82F6';
                        handles.forEach(h => {
                            ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
                        });
                    }
                } else if (annotation.type === 'arrow') {
                    const isSelected = selectedItem?.type === 'annotation' && selectedItem?.index === idx;

                    ctx.save();
                    ctx.translate(annotation.x, annotation.y);
                    ctx.rotate(annotation.rotation);

                    // Draw arrow
                    const headLength = 20;
                    const headWidth = 16;
                    const shaftWidth = annotation.thickness || 6;
                    const length = annotation.length || 120;

                    ctx.fillStyle = annotation.color || '#DC2626';
                    ctx.strokeStyle = annotation.color || '#DC2626';
                    ctx.lineWidth = 1;

                    // Arrow shaft
                    ctx.fillRect(-length / 2, -shaftWidth / 2, length - headLength, shaftWidth);

                    // Arrow head
                    ctx.beginPath();
                    ctx.moveTo(length / 2, 0);
                    ctx.lineTo(length / 2 - headLength, -headWidth / 2);
                    ctx.lineTo(length / 2 - headLength, headWidth / 2);
                    ctx.closePath();
                    ctx.fill();

                    if (isSelected) {
                        // Draw rotation handle at head
                        ctx.fillStyle = '#3B82F6';
                        ctx.beginPath();
                        ctx.arc(length / 2, 0, 8, 0, Math.PI * 2);
                        ctx.fill();

                        // Draw center handle
                        ctx.beginPath();
                        ctx.arc(0, 0, 6, 0, Math.PI * 2);
                        ctx.fill();

                        // Draw resize handle at tail
                        ctx.fillStyle = '#10B981';
                        ctx.beginPath();
                        ctx.arc(-length / 2, 0, 8, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    ctx.restore();
                }
            });
        }

        // Get runs for label lookup
        const runsForLabels = typeof window !== 'undefined' && window.runsData ? window.runsData : [];
        
        // Draw fence lines FIRST (so posts appear on top)
        fenceLines.forEach((line, idx) => {
            const isSelected = selectedItem?.type === 'line' && selectedItem?.index === idx;
            const runStatus = line.runStatus || (line.isExisting ? 'existing' : 'new');
            
            // Check if assigned run has tear-out enabled
            const assignedRun = line.assignedRunId ? runsForLabels.find(r => r.id === line.assignedRunId) : null;
            const hasTearOut = assignedRun?.hasTearout || false;
            
            let strokeColor = "#059669"; // New fence (green)
            let opacity = 1.0;
            let dashPattern = [];
            
            if (hasTearOut) {
                strokeColor = "#DC2626"; // Red for tear-out
                opacity = 1.0;
            } else if (runStatus === 'existing') {
                strokeColor = "#cbd5e1"; // Existing (light gray)
                dashPattern = [8, 4];
                opacity = 0.6;
            } else if (runStatus === 'remove') {
                strokeColor = "#f87171"; // Remove (red)
                dashPattern = [4, 8];
                opacity = 0.7;
            } else if (isSelected) {
                strokeColor = "#10b981"; // Selected new (brighter green)
            }
            
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = isSelected ? 4 : 2;
            ctx.setLineDash(dashPattern);
            
            ctx.beginPath();
            ctx.moveTo(line.start.x, line.start.y);
            ctx.lineTo(line.end.x, line.end.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();



            // Draw endpoints (handles for dragging)
            [line.start, line.end].forEach((point, pointIdx) => {
                const isHovered = hoveredPoint?.lineIdx === idx && hoveredPoint?.pointIdx === pointIdx;
                
                let pointColor = "#059669"; // New fence (green)
                if (isHovered) {
                    pointColor = "#3B82F6";
                } else if (runStatus === 'remove') {
                    pointColor = "#f87171";
                } else if (runStatus === 'existing') {
                    pointColor = "#cbd5e1";
                }
                
                ctx.save();
                ctx.globalAlpha = runStatus === 'existing' ? 0.6 : (runStatus === 'remove' ? 0.7 : 1.0);
                ctx.fillStyle = pointColor;
                ctx.strokeStyle = "#FFFFFF";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(point.x, point.y, isHovered ? 8 : 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                if (isHovered) {
                    ctx.strokeStyle = "#3B82F6";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.restore();
            });

            // Draw length label with gate segments and status badge
            const midX = (line.start.x + line.end.x) / 2;
            const midY = (line.start.y + line.end.y) / 2;
            let labelColor = "#1E293B";
            if (runStatus === 'remove') {
                labelColor = "#DC2626";
            } else if (runStatus === 'existing') {
                labelColor = "#64748B";
            }
            
            // Draw status badge if not new
            if (runStatus !== 'new') {
                const statusText = runStatus === 'existing' ? 'EXISTING' : 'REMOVE';
                const badgeBg = runStatus === 'existing' ? '#f1f5f9' : '#fee2e2';
                const badgeColor = runStatus === 'existing' ? '#64748b' : '#dc2626';
                
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                const badgeWidth = ctx.measureText(statusText).width + 12;
                
                ctx.fillStyle = badgeBg;
                ctx.fillRect(midX - badgeWidth/2, midY - 50, badgeWidth, 16);
                ctx.strokeStyle = badgeColor;
                ctx.lineWidth = 1;
                ctx.strokeRect(midX - badgeWidth/2, midY - 50, badgeWidth, 16);
                
                ctx.fillStyle = badgeColor;
                ctx.fillText(statusText, midX, midY - 42);
            }
            
            // Get segments for this line
            const segments = calculateGateSegments(idx);
            const hasGates = segments && segments.some(s => s.type === 'gate');

            if (hasGates) {
                // Use manual length CONSISTENTLY for all segment calculations
                const effectiveLengthFt = (line.manualLengthFt && line.manualLengthFt > 0) 
                    ? line.manualLengthFt 
                    : line.length;

                // Draw segment measurements - use stored segment positions in feet (not recalculated from visual)
                const lineVec = { x: line.end.x - line.start.x, y: line.end.y - line.start.y };
                const linePixelLength = Math.sqrt(lineVec.x * lineVec.x + lineVec.y * lineVec.y);
                const lineDir = { x: lineVec.x / linePixelLength, y: lineVec.y / linePixelLength };
                const perpDir = { x: -lineDir.y, y: lineDir.x };

                // Pixels per foot - for DISPLAY only, not for calculating segment positions
                const pixelsPerFt = linePixelLength / effectiveLengthFt;

                segments.forEach((seg, segIdx) => {
                    if (seg.lengthFt > 0.1) { // Show all segments
                        // Use segment's stored feet positions (not recalculated)
                        const segMidFt = (seg.startFt + seg.endFt) / 2;
                        const segMidPixels = segMidFt * pixelsPerFt;
                        const segX = line.start.x + lineDir.x * segMidPixels;
                        const segY = line.start.y + lineDir.y * segMidPixels;

                        if (seg.type === 'fence') {
                            // Draw dimension line below fence line
                            const dimOffset = 30;
                            const dimY = segY + perpDir.y * dimOffset;
                            const dimX = segX + perpDir.x * dimOffset;

                            // Use stored segment feet positions (never recalculate from visual pixels)
                            const segStartPixels = seg.startFt * pixelsPerFt;
                            const segEndPixels = seg.endFt * pixelsPerFt;
                            const segStartX = line.start.x + lineDir.x * segStartPixels;
                            const segStartY = line.start.y + lineDir.y * segStartPixels;
                            const segEndX = line.start.x + lineDir.x * segEndPixels;
                            const segEndY = line.start.y + lineDir.y * segEndPixels;

                            // Dimension line endpoints
                            const dimStartX = segStartX + perpDir.x * dimOffset;
                            const dimStartY = segStartY + perpDir.y * dimOffset;
                            const dimEndX = segEndX + perpDir.x * dimOffset;
                            const dimEndY = segEndY + perpDir.y * dimOffset;

                            // Draw dimension line
                            ctx.strokeStyle = "#059669";
                            ctx.lineWidth = 1.5;
                            ctx.beginPath();
                            ctx.moveTo(dimStartX, dimStartY);
                            ctx.lineTo(dimEndX, dimEndY);
                            ctx.stroke();

                            // Draw ticks at ends
                            const tickSize = 8;
                            ctx.beginPath();
                            ctx.moveTo(dimStartX - perpDir.y * tickSize, dimStartY + perpDir.x * tickSize);
                            ctx.lineTo(dimStartX + perpDir.y * tickSize, dimStartY - perpDir.x * tickSize);
                            ctx.stroke();

                            ctx.beginPath();
                            ctx.moveTo(dimEndX - perpDir.y * tickSize, dimEndY + perpDir.x * tickSize);
                            ctx.lineTo(dimEndX + perpDir.y * tickSize, dimEndY - perpDir.x * tickSize);
                            ctx.stroke();

                            // Draw measurement text (rounded up to nearest half foot)
                            const displayLength = Math.ceil(seg.lengthFt * 2) / 2; // Round to nearest 0.5
                            ctx.fillStyle = "#059669";
                            ctx.strokeStyle = "#FFF";
                            ctx.lineWidth = 3;
                            ctx.font = "bold 13px sans-serif";
                            ctx.textAlign = "center";
                            ctx.strokeText(`${displayLength} ft`, dimX, dimY);
                            ctx.fillText(`${displayLength} ft`, dimX, dimY);
                        } else if (seg.type === 'gate') {
                            // Draw gate width label above gate
                            const gateTopOffset = -20;
                            const gateTopX = segX + perpDir.x * gateTopOffset;
                            const gateTopY = segY + perpDir.y * gateTopOffset;

                            ctx.fillStyle = "#D97706";
                            ctx.strokeStyle = "#FFF";
                            ctx.lineWidth = 3;
                            ctx.font = "bold 14px sans-serif";
                            ctx.textAlign = "center";
                            ctx.strokeText(`${seg.lengthFt.toFixed(0)}'`, gateTopX, gateTopY);
                            ctx.fillText(`${seg.lengthFt.toFixed(0)}'`, gateTopX, gateTopY);

                            // Note: fence segments adjacent to gates are already drawn in the fence segment loop above
                            // We don't need to draw them again here

                                    // Dimension line endpoints

                        }
                    }
                });

                // Draw total length at center top (only if manual length is set)
                if (line.manualLengthFt && line.manualLengthFt > 0) {
                    // Show run assignment label if assigned - PROMINENT DISPLAY
                    const assignedRun = line.assignedRunId ? runsForLabels.find(r => r.id === line.assignedRunId) : null;
                    
                    if (assignedRun) {
                        // Draw badge text WITHOUT background box - ABBREVIATED
                        ctx.fillStyle = "#059669";
                        ctx.font = "bold 14px sans-serif";
                        ctx.textAlign = "center";
                        ctx.strokeStyle = "#FFF";
                        ctx.lineWidth = 3;
                        const abbrevLabel = abbreviateLabel(assignedRun.runLabel);
                        ctx.strokeText(abbrevLabel, midX, midY - 56);
                        ctx.fillText(abbrevLabel, midX, midY - 56);
                    }
                    
                    const displayTotal = Math.ceil(line.manualLengthFt * 2) / 2; // Round to nearest 0.5
                    ctx.fillStyle = "#1E293B";
                    ctx.font = "bold 14px Inter, sans-serif";
                    ctx.textAlign = "center";
                    ctx.strokeStyle = "#FFF";
                    ctx.lineWidth = 3;
                    ctx.strokeText(`Total: ${displayTotal} ft`, midX, midY - 38);
                    ctx.fillText(`Total: ${displayTotal} ft`, midX, midY - 38);
                }
            } else {
                // No gates, show simple total with run assignment (only if manual length set)
                if (line.manualLengthFt && line.manualLengthFt > 0) {
                    // Show run assignment label if assigned - PROMINENT DISPLAY
                    const assignedRun = line.assignedRunId ? runsForLabels.find(r => r.id === line.assignedRunId) : null;
                    
                    if (assignedRun) {
                        // Draw badge text WITHOUT background box - ABBREVIATED
                        ctx.fillStyle = "#059669";
                        ctx.font = "bold 14px sans-serif";
                        ctx.textAlign = "center";
                        ctx.strokeStyle = "#FFF";
                        ctx.lineWidth = 3;
                        const abbrevLabel = abbreviateLabel(assignedRun.runLabel);
                        ctx.strokeText(abbrevLabel, midX, midY - 26);
                        ctx.fillText(abbrevLabel, midX, midY - 26);
                    }

                    const displayLength = Math.ceil(line.manualLengthFt * 2) / 2; // Round to nearest 0.5
                    ctx.fillStyle = labelColor;
                    ctx.font = "14px Inter, sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(`${displayLength} ft`, midX, midY - 10);
                }
            }
        });
        
        // Draw REAL POSTS from generated layout (ON TOP of fence lines)
        if (jobPosts && jobPosts.length > 0) {
            jobPosts.forEach((post, idx) => {
                // DEBUG: Log first 5 posts to see their properties
                if (idx < 5) {
                    console.log('[FenceCanvas Render] Post:', { 
                        id: post.id, 
                        kind: post.kind, 
                        terminalType: post.terminalType,
                        color: post.color,
                        isGatePost: post.isGatePost 
                    });
                }
                
                // Use color from post object (set by postLayoutEngine)
                // CRITICAL: Use post.color directly - it's already set by postLayoutEngine
                const postColor = post.color || '#3B82F6'; // Fallback to blue
                
                // Determine radius by kind
                let postRadius = 5;
                if (post.kind === 'gate' || post.kind === 'corner' || post.kind === 'junction') {
                    postRadius = 7;
                } else if (post.kind === 'end') {
                    postRadius = 6;
                }
                
                // DEBUG: Log rendering color for first 5 posts
                if (idx < 5) {
                    console.log('[FenceCanvas] Drawing post with color:', postColor, 'radius:', postRadius);
                }
                
                // Draw post with color
                ctx.fillStyle = postColor;
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(post.x, post.y, postRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Draw "SM" badge for surface mounted posts
                if (post.mountType === 'SURFACE') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.strokeStyle = '#F59E0B';
                    ctx.lineWidth = 1.5;
                    ctx.fillRect(post.x - 10, post.y - postRadius - 12, 20, 10);
                    ctx.strokeRect(post.x - 10, post.y - postRadius - 12, 20, 10);
                    
                    ctx.fillStyle = '#F59E0B';
                    ctx.font = 'bold 7px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('SM', post.x, post.y - postRadius - 7);
                }
            });
        }
        
        // Draw SPACING LABELS between posts (on top)
        if (showSpanLabels && spacingLabels && spacingLabels.length > 0) {
            spacingLabels.forEach(label => {
                ctx.fillStyle = '#1E293B';
                ctx.strokeStyle = '#FFF';
                ctx.lineWidth = 3;
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.strokeText(label.text, label.x, label.y);
                ctx.fillText(label.text, label.x, label.y);
            });
        }

        // Draw marquee selection rectangle
        if (isMarqueeSelecting && marqueeStart && marqueeEnd) {
            const x = Math.min(marqueeStart.x, marqueeEnd.x);
            const y = Math.min(marqueeStart.y, marqueeEnd.y);
            const w = Math.abs(marqueeEnd.x - marqueeStart.x);
            const h = Math.abs(marqueeEnd.y - marqueeStart.y);
            
            ctx.strokeStyle = "#3B82F6";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
            ctx.fillRect(x, y, w, h);
            ctx.setLineDash([]);
        }

        // Draw group bounding box for multi-selected items
        if (selectedItems && selectedItems.length > 1) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            
            selectedItems.forEach(item => {
                if (item.type === 'line' && fenceLines[item.index]) {
                    const line = fenceLines[item.index];
                    minX = Math.min(minX, line.start.x, line.end.x);
                    minY = Math.min(minY, line.start.y, line.end.y);
                    maxX = Math.max(maxX, line.start.x, line.end.x);
                    maxY = Math.max(maxY, line.start.y, line.end.y);
                } else if (item.type === 'house' && houses[item.index]) {
                    const house = houses[item.index];
                    minX = Math.min(minX, house.x);
                    minY = Math.min(minY, house.y);
                    maxX = Math.max(maxX, house.x + house.width);
                    maxY = Math.max(maxY, house.y + house.height);
                } else if (item.type === 'tree' && trees[item.index]) {
                    const tree = trees[item.index];
                    minX = Math.min(minX, tree.x - 20);
                    minY = Math.min(minY, tree.y - 20);
                    maxX = Math.max(maxX, tree.x + 20);
                    maxY = Math.max(maxY, tree.y + 20);
                } else if (item.type === 'gate' && gates[item.index]) {
                    const gate = gates[item.index];
                    minX = Math.min(minX, gate.x - 15);
                    minY = Math.min(minY, gate.y - 15);
                    maxX = Math.max(maxX, gate.x + 15);
                    maxY = Math.max(maxY, gate.y + 15);
                } else if (item.type === 'doubleGate' && doubleGates[item.index]) {
                    const gate = doubleGates[item.index];
                    minX = Math.min(minX, gate.x - 25);
                    minY = Math.min(minY, gate.y - 25);
                    maxX = Math.max(maxX, gate.x + 25);
                    maxY = Math.max(maxY, gate.y + 25);
                } else if (item.type === 'annotation' && annotations[item.index]) {
                    const ann = annotations[item.index];
                    if (ann.type === 'callout') {
                        minX = Math.min(minX, ann.box.x, ann.tail.anchorX);
                        minY = Math.min(minY, ann.box.y, ann.tail.anchorY);
                        maxX = Math.max(maxX, ann.box.x + ann.box.w, ann.tail.anchorX);
                        maxY = Math.max(maxY, ann.box.y + ann.box.h, ann.tail.anchorY);
                    }
                }
            });
            
            if (minX !== Infinity) {
                ctx.strokeStyle = "#F59E0B";
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 4]);
                ctx.strokeRect(minX - 10, minY - 10, maxX - minX + 20, maxY - minY + 20);
                ctx.setLineDash([]);
            }
        }

        // Draw current line being drawn
        if (currentLine) {
            ctx.strokeStyle = "#3B82F6";
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(currentLine.start.x, currentLine.start.y);
            ctx.lineTo(currentLine.end.x, currentLine.end.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Show length while drawing (rounded up to nearest half foot)
            const drawingLengthFt = calculateDistance(currentLine.start, currentLine.end);
            const displayDrawingLength = Math.ceil(drawingLengthFt * 2) / 2;
            const midX = (currentLine.start.x + currentLine.end.x) / 2;
            const midY = (currentLine.start.y + currentLine.end.y) / 2;
            
            ctx.fillStyle = "#3B82F6";
            ctx.strokeStyle = "#FFF";
            ctx.lineWidth = 3;
            ctx.font = "bold 14px sans-serif";
            ctx.textAlign = "center";
            ctx.strokeText(`${displayDrawingLength} ft`, midX, midY - 10);
            ctx.fillText(`${displayDrawingLength} ft`, midX, midY - 10);
        }

        // Draw snap indicator for house snapping
        if (snapIndicator && snapIndicator.type === 'house-snap') {
            // Draw line between snap points
            ctx.strokeStyle = "#10B981";
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(snapIndicator.draggedPoint.x, snapIndicator.draggedPoint.y);
            ctx.lineTo(snapIndicator.targetPoint.x, snapIndicator.targetPoint.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Highlight snap points
            ctx.fillStyle = "#10B981";
            ctx.strokeStyle = "#FFF";
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.arc(snapIndicator.draggedPoint.x, snapIndicator.draggedPoint.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(snapIndicator.targetPoint.x, snapIndicator.targetPoint.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Draw snap indicators
        if (snapTarget) {
            if (snapTarget.type === 'endpoint') {
                // Endpoint snap indicator
                ctx.strokeStyle = "#10B981";
                ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(snapTarget.x, snapTarget.y, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Crosshair
                ctx.beginPath();
                ctx.moveTo(snapTarget.x - 15, snapTarget.y);
                ctx.lineTo(snapTarget.x + 15, snapTarget.y);
                ctx.moveTo(snapTarget.x, snapTarget.y - 15);
                ctx.lineTo(snapTarget.x, snapTarget.y + 15);
                ctx.stroke();
            } else if (snapTarget.type === 'segment') {
                // Segment snap indicator
                ctx.strokeStyle = "#3B82F6";
                ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(snapTarget.x, snapTarget.y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Highlight segment
                const line = fenceLines[snapTarget.lineIdx];
                if (line) {
                    ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
                    ctx.lineWidth = 6;
                    ctx.beginPath();
                    ctx.moveTo(line.start.x, line.start.y);
                    ctx.lineTo(line.end.x, line.end.y);
                    ctx.stroke();
                }
            } else if (snapTarget.type === 'parallel') {
                // Parallel snap indicator
                const line = fenceLines[snapTarget.lineIdx];
                if (line) {
                    ctx.strokeStyle = "rgba(168, 85, 247, 0.5)";
                    ctx.lineWidth = 5;
                    ctx.setLineDash([8, 8]);
                    ctx.beginPath();
                    ctx.moveTo(line.start.x, line.start.y);
                    ctx.lineTo(line.end.x, line.end.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    // "Parallel" label
                    const midX = (line.start.x + line.end.x) / 2;
                    const midY = (line.start.y + line.end.y) / 2;
                    ctx.fillStyle = "#A855F7";
                    ctx.font = "bold 12px sans-serif";
                    ctx.textAlign = "center";
                    ctx.strokeStyle = "#FFF";
                    ctx.lineWidth = 3;
                    ctx.strokeText("PARALLEL", midX, midY - 25);
                    ctx.fillText("PARALLEL", midX, midY - 25);
                }
            }
        }

        // SPAN OVERLAY REMOVED - Real posts now used instead

        // Restore context (zoom and rotation transforms)
        ctx.restore();
    };

    const getMousePos = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();

        // Use clientX/clientY directly (works for mouse, touch, and pointer events)
        const clientX = e.clientX;
        const clientY = e.clientY;

        // Convert screen coordinates to world coordinates using camera
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;

        const worldX = (screenX / zoom) + cameraX;
        const worldY = (screenY / zoom) + cameraY;

        return {
            x: worldX,
            y: worldY,
        };
    };

    const calculateDistance = (p1, p2) => {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const pixels = Math.sqrt(dx * dx + dy * dy);
        return pixels / PIXELS_PER_FOOT;
    };

    const findHoveredPoint = (mousePos) => {
        for (let i = 0; i < fenceLines.length; i++) {
            const line = fenceLines[i];
            if (getDistance(mousePos, line.start) < 10) {
                return { lineIdx: i, pointIdx: 0 };
            }
            if (getDistance(mousePos, line.end) < 10) {
                return { lineIdx: i, pointIdx: 1 };
            }
        }
        return null;
    };

    const getDistance = (p1, p2) => {
        return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    };

    // Find snap target for run dragging (endpoint, segment, or parallel)
    const findRunSnapTarget = (draggedLineIdx, testStart, testEnd, excludeLineIdx = null) => {
        let bestSnap = null;
        let bestPriority = 999;

        // Priority: 1 = endpoint, 2 = segment, 3 = parallel
        
        // Check both endpoints for endpoint snapping
        const testPoints = [
            { point: testStart, isStart: true },
            { point: testEnd, isStart: false }
        ];

        for (const testPoint of testPoints) {
            for (let i = 0; i < fenceLines.length; i++) {
                if (i === draggedLineIdx || i === excludeLineIdx) continue;
                
                const line = fenceLines[i];
                
                // Endpoint snap (highest priority)
                for (const targetPoint of [line.start, line.end]) {
                    const dist = getDistance(testPoint.point, targetPoint);
                    if (dist < ENDPOINT_SNAP_THRESHOLD && 1 < bestPriority) {
                        bestSnap = {
                            type: 'endpoint',
                            x: targetPoint.x,
                            y: targetPoint.y,
                            targetPoint,
                            draggedPoint: testPoint.point,
                            isStart: testPoint.isStart
                        };
                        bestPriority = 1;
                    }
                }
            }
        }

        // If no endpoint snap, check segment snap
        if (!bestSnap || bestPriority > 1) {
            for (const testPoint of testPoints) {
                for (let i = 0; i < fenceLines.length; i++) {
                    if (i === draggedLineIdx || i === excludeLineIdx) continue;
                    
                    const line = fenceLines[i];
                    const projection = projectPointOnLine(testPoint.point, line.start, line.end);
                    const dist = getDistance(testPoint.point, projection.point);
                    
                    if (dist < SEGMENT_SNAP_THRESHOLD && 2 < bestPriority) {
                        bestSnap = {
                            type: 'segment',
                            x: projection.point.x,
                            y: projection.point.y,
                            lineIdx: i,
                            param: projection.param,
                            draggedPoint: testPoint.point,
                            isStart: testPoint.isStart
                        };
                        bestPriority = 2;
                    }
                }
            }
        }

        // If no endpoint or segment snap, check parallel snap
        if (!bestSnap || bestPriority > 2) {
            const draggedAngle = Math.atan2(testEnd.y - testStart.y, testEnd.x - testStart.x);
            const draggedMidX = (testStart.x + testEnd.x) / 2;
            const draggedMidY = (testStart.y + testEnd.y) / 2;

            for (let i = 0; i < fenceLines.length; i++) {
                if (i === draggedLineIdx || i === excludeLineIdx) continue;
                
                const line = fenceLines[i];
                const lineAngle = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
                
                // Check angle difference
                let angleDiff = Math.abs(draggedAngle - lineAngle) * (180 / Math.PI);
                if (angleDiff > 180) angleDiff = 360 - angleDiff;
                if (angleDiff > 90) angleDiff = 180 - angleDiff; // Handle opposite directions
                
                if (angleDiff < PARALLEL_ANGLE_TOLERANCE) {
                    // Check proximity to line
                    const lineMidX = (line.start.x + line.end.x) / 2;
                    const lineMidY = (line.start.y + line.end.y) / 2;
                    const midDist = getDistance({ x: draggedMidX, y: draggedMidY }, { x: lineMidX, y: lineMidY });
                    
                    if (midDist < PARALLEL_PROXIMITY_THRESHOLD * 3 && 3 <= bestPriority) {
                        bestSnap = {
                            type: 'parallel',
                            lineIdx: i,
                            targetAngle: lineAngle,
                            currentAngle: draggedAngle
                        };
                        bestPriority = 3;
                    }
                }
            }
        }

        return bestSnap;
    };

    // Apply snap correction to dragged run
    const applySnapCorrection = (draggedRun, snapTarget, dx, dy) => {
        if (!snapTarget) return { dx, dy };

        if (snapTarget.type === 'endpoint') {
            // Snap one endpoint to target
            const snapDx = snapTarget.x - snapTarget.draggedPoint.x;
            const snapDy = snapTarget.y - snapTarget.draggedPoint.y;
            return { dx: snapDx, dy: snapDy };
        } else if (snapTarget.type === 'segment') {
            // Snap one endpoint to segment
            const snapDx = snapTarget.x - snapTarget.draggedPoint.x;
            const snapDy = snapTarget.y - snapTarget.draggedPoint.y;
            return { dx: snapDx, dy: snapDy };
        } else if (snapTarget.type === 'parallel') {
            // Rotate run to match target angle
            const currentAngle = snapTarget.currentAngle;
            const targetAngle = snapTarget.targetAngle;
            const angleCorrection = targetAngle - currentAngle;
            
            // Rotate endpoints around center
            const centerX = (draggedRun.start.x + draggedRun.end.x) / 2;
            const centerY = (draggedRun.start.y + draggedRun.end.y) / 2;
            
            return { dx, dy, angleCorrection, centerX, centerY };
        }

        return { dx, dy };
        };

        // Calculate snap points for a house
        const getHouseSnapPoints = (house) => {
        const rotation = house.rotation || 0;
        const scale = house.scale || 1;
        const centerX = house.x + house.width / 2;
        const centerY = house.y + house.height / 2;

        // Local corners and edge midpoints
        const localPoints = [
            {x: house.x, y: house.y, type: 'corner'},
            {x: house.x + house.width, y: house.y, type: 'corner'},
            {x: house.x, y: house.y + house.height, type: 'corner'},
            {x: house.x + house.width, y: house.y + house.height, type: 'corner'},
            {x: house.x + house.width / 2, y: house.y, type: 'midpoint'},
            {x: house.x + house.width / 2, y: house.y + house.height, type: 'midpoint'},
            {x: house.x, y: house.y + house.height / 2, type: 'midpoint'},
            {x: house.x + house.width, y: house.y + house.height / 2, type: 'midpoint'}
        ];

        // Transform to world space
        return localPoints.map(p => {
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            const dx = (p.x - centerX) * scale;
            const dy = (p.y - centerY) * scale;
            return {
                x: centerX + (dx * cos - dy * sin),
                y: centerY + (dx * sin + dy * cos),
                type: p.type
            };
        });
        };

        // Find snap target for house dragging
        const findHouseSnapTarget = (draggedHouseIdx, draggedHousePos) => {
        const draggedPoints = getHouseSnapPoints(draggedHousePos);

        let bestSnap = null;
        let bestDistance = SNAP_POINT_THRESHOLD;

        houses.forEach((otherHouse, idx) => {
            if (idx === draggedHouseIdx) return;

            const otherPoints = getHouseSnapPoints(otherHouse);

            draggedPoints.forEach(dp => {
                otherPoints.forEach(op => {
                    const dist = Math.sqrt(Math.pow(dp.x - op.x, 2) + Math.pow(dp.y - op.y, 2));
                    if (dist < bestDistance) {
                        bestDistance = dist;
                        bestSnap = {
                            draggedPoint: dp,
                            targetPoint: op,
                            offsetX: op.x - dp.x,
                            offsetY: op.y - dp.y
                        };
                    }
                });
            });
        });

        return bestSnap;
        };

        const handleMouseDown = (e) => {
            // Track active touches for pinch detection
            if (e.pointerType === 'touch') {
                setActiveTouches(prev => [...prev, { id: e.pointerId, x: e.clientX, y: e.clientY }]);
            }

            const pos = getMousePos(e);
            setMouseDownPos(pos);
            setIsDragging(false);
            
            // Initialize pointer gesture tracking
            setPointerGesture({
                startX: pos.x,
                startY: pos.y,
                targetType: null,
                targetIndex: null,
                didDrag: false
            });

            // If in pan mode, start panning immediately (unless clicking on scrollbar)
            if (interactionMode === 'pan') {
                const canvas = canvasRef.current;
                const rect = canvas.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;

                // Check if click is on scrollbar area (right 20px or bottom 20px)
                const isScrollbarArea = screenX > rect.width - 20 || screenY > rect.height - 20;

                if (!isScrollbarArea) {
                    setIsPanning(true);
                    setPanStartPos({ x: e.clientX, y: e.clientY, cameraX, cameraY });
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

        // PRIORITY: Check for scale handles on selected items FIRST
        if (tool === "select" && selectedItem) {
            if (selectedItem.type === 'house' && houses[selectedItem.index]) {
                const house = houses[selectedItem.index];
                const rotation = house.rotation || 0;
                const scale = house.scale || 1;
                const centerX = house.x + house.width / 2;
                const centerY = house.y + house.height / 2;

                // Calculate transformed corner positions
                const corners = [
                    {name: 'tl', localX: house.x, localY: house.y},
                    {name: 'tr', localX: house.x + house.width, localY: house.y},
                    {name: 'bl', localX: house.x, localY: house.y + house.height},
                    {name: 'br', localX: house.x + house.width, localY: house.y + house.height}
                ];

                for (const corner of corners) {
                    const cos = Math.cos(rotation);
                    const sin = Math.sin(rotation);
                    const dx = (corner.localX - centerX) * scale;
                    const dy = (corner.localY - centerY) * scale;
                    const worldX = centerX + (dx * cos - dy * sin);
                    const worldY = centerY + (dx * sin + dy * cos);

                    if (Math.abs(pos.x - worldX) < HANDLE_HIT_SIZE && Math.abs(pos.y - worldY) < HANDLE_HIT_SIZE) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.pointerId !== undefined) {
                            e.target.setPointerCapture(e.pointerId);
                        }
                        if (onSaveHistory) onSaveHistory();
                        setScalingItem({
                            type: 'house',
                            index: selectedItem.index,
                            corner: corner.name,
                            startPos: pos,
                            initialWidth: house.width,
                            initialHeight: house.height,
                            anchorX: corner.name === 'tl' || corner.name === 'bl' ? house.x + house.width : house.x,
                            anchorY: corner.name === 'tl' || corner.name === 'tr' ? house.y + house.height : house.y
                        });
                        setIsDraggingItem(true);
                        return;
                    }
                }
            }
            if (selectedItem.type === 'porch' && porches[selectedItem.index]) {
                const porch = porches[selectedItem.index];
                const handles = [
                    {x: porch.x, y: porch.y, corner: 'tl'},
                    {x: porch.x + porch.width, y: porch.y, corner: 'tr'},
                    {x: porch.x, y: porch.y + porch.height, corner: 'bl'},
                    {x: porch.x + porch.width, y: porch.y + porch.height, corner: 'br'}
                ];

                for (const handle of handles) {
                    if (Math.abs(pos.x - handle.x) < HANDLE_HIT_SIZE && Math.abs(pos.y - handle.y) < HANDLE_HIT_SIZE) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.pointerId !== undefined) {
                            e.target.setPointerCapture(e.pointerId);
                        }
                        if (onSaveHistory) onSaveHistory();
                        setScalingItem({
                            type: 'porch',
                            index: selectedItem.index,
                            corner: handle.corner,
                            startPos: pos,
                            initialWidth: porch.width,
                            initialHeight: porch.height,
                            anchorX: handle.corner === 'tl' || handle.corner === 'bl' ? porch.x + porch.width : porch.x,
                            anchorY: handle.corner === 'tl' || handle.corner === 'tr' ? porch.y + porch.height : porch.y
                        });
                        setIsDraggingItem(true);
                        return;
                    }
                }
            }
            if (selectedItem.type === 'grass' && grasses[selectedItem.index]) {
                const grass = grasses[selectedItem.index];
                const handles = [
                    {x: grass.x, y: grass.y, corner: 'tl'},
                    {x: grass.x + grass.width, y: grass.y, corner: 'tr'},
                    {x: grass.x, y: grass.y + grass.height, corner: 'bl'},
                    {x: grass.x + grass.width, y: grass.y + grass.height, corner: 'br'}
                ];

                for (const handle of handles) {
                    if (Math.abs(pos.x - handle.x) < HANDLE_HIT_SIZE && Math.abs(pos.y - handle.y) < HANDLE_HIT_SIZE) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.pointerId !== undefined) {
                            e.target.setPointerCapture(e.pointerId);
                        }
                        if (onSaveHistory) onSaveHistory();
                        setScalingItem({
                            type: 'grass',
                            index: selectedItem.index,
                            corner: handle.corner,
                            startPos: pos,
                            initialWidth: grass.width,
                            initialHeight: grass.height,
                            anchorX: handle.corner === 'tl' || handle.corner === 'bl' ? grass.x + grass.width : grass.x,
                            anchorY: handle.corner === 'tl' || handle.corner === 'tr' ? grass.y + grass.height : grass.y
                        });
                        setIsDraggingItem(true);
                        return;
                    }
                }
            }
            if (selectedItem.type === 'pool' && pools[selectedItem.index]) {
                const pool = pools[selectedItem.index];
                const handles = [
                    {x: pool.x, y: pool.y, corner: 'tl'},
                    {x: pool.x + pool.width, y: pool.y, corner: 'tr'},
                    {x: pool.x, y: pool.y + pool.height, corner: 'bl'},
                    {x: pool.x + pool.width, y: pool.y + pool.height, corner: 'br'}
                ];

                for (const handle of handles) {
                    if (Math.abs(pos.x - handle.x) < HANDLE_HIT_SIZE && Math.abs(pos.y - handle.y) < HANDLE_HIT_SIZE) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.pointerId !== undefined) {
                            e.target.setPointerCapture(e.pointerId);
                        }
                        if (onSaveHistory) onSaveHistory();
                        setScalingItem({
                            type: 'pool',
                            index: selectedItem.index,
                            corner: handle.corner,
                            startPos: pos,
                            initialWidth: pool.width,
                            initialHeight: pool.height,
                            anchorX: handle.corner === 'tl' || handle.corner === 'bl' ? pool.x + pool.width : pool.x,
                            anchorY: handle.corner === 'tl' || handle.corner === 'tr' ? pool.y + pool.height : pool.y
                        });
                        setIsDraggingItem(true);
                        return;
                    }
                }
            }
            if (selectedItem.type === 'garage' && garages[selectedItem.index]) {
                const garage = garages[selectedItem.index];
                const handles = [
                    {x: garage.x, y: garage.y, corner: 'tl'},
                    {x: garage.x + garage.width, y: garage.y, corner: 'tr'},
                    {x: garage.x, y: garage.y + garage.height, corner: 'bl'},
                    {x: garage.x + garage.width, y: garage.y + garage.height, corner: 'br'}
                ];

                for (const handle of handles) {
                    if (Math.abs(pos.x - handle.x) < HANDLE_HIT_SIZE && Math.abs(pos.y - handle.y) < HANDLE_HIT_SIZE) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.pointerId !== undefined) {
                            e.target.setPointerCapture(e.pointerId);
                        }
                        if (onSaveHistory) onSaveHistory();
                        setScalingItem({
                            type: 'garage',
                            index: selectedItem.index,
                            corner: handle.corner,
                            startPos: pos,
                            initialWidth: garage.width,
                            initialHeight: garage.height,
                            anchorX: handle.corner === 'tl' || handle.corner === 'bl' ? garage.x + garage.width : garage.x,
                            anchorY: handle.corner === 'tl' || handle.corner === 'tr' ? garage.y + garage.height : garage.y
                        });
                        setIsDraggingItem(true);
                        return;
                    }
                }
            }
            if (selectedItem.type === 'driveway' && driveways[selectedItem.index]) {
                const driveway = driveways[selectedItem.index];
                const handles = [
                    {x: driveway.x, y: driveway.y, corner: 'tl'},
                    {x: driveway.x + driveway.width, y: driveway.y, corner: 'tr'},
                    {x: driveway.x, y: driveway.y + driveway.height, corner: 'bl'},
                    {x: driveway.x + driveway.width, y: driveway.y + driveway.height, corner: 'br'}
                ];

                for (const handle of handles) {
                    if (Math.abs(pos.x - handle.x) < HANDLE_HIT_SIZE && Math.abs(pos.y - handle.y) < HANDLE_HIT_SIZE) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.pointerId !== undefined) {
                            e.target.setPointerCapture(e.pointerId);
                        }
                        if (onSaveHistory) onSaveHistory();
                        setScalingItem({
                            type: 'driveway',
                            index: selectedItem.index,
                            corner: handle.corner,
                            startPos: pos,
                            initialWidth: driveway.width,
                            initialHeight: driveway.height,
                            anchorX: handle.corner === 'tl' || handle.corner === 'bl' ? driveway.x + driveway.width : driveway.x,
                            anchorY: handle.corner === 'tl' || handle.corner === 'tr' ? driveway.y + driveway.height : driveway.y
                        });
                        setIsDraggingItem(true);
                        return;
                    }
                }
            }
            if (selectedItem.type === 'deck' && decks[selectedItem.index]) {
                const deck = decks[selectedItem.index];
                const handles = [
                    {x: deck.x, y: deck.y, corner: 'tl'},
                    {x: deck.x + deck.width, y: deck.y, corner: 'tr'},
                    {x: deck.x, y: deck.y + deck.height, corner: 'bl'},
                    {x: deck.x + deck.width, y: deck.y + deck.height, corner: 'br'}
                ];

                for (const handle of handles) {
                    if (Math.abs(pos.x - handle.x) < HANDLE_HIT_SIZE && Math.abs(pos.y - handle.y) < HANDLE_HIT_SIZE) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.pointerId !== undefined) {
                            e.target.setPointerCapture(e.pointerId);
                        }
                        if (onSaveHistory) onSaveHistory();
                        setScalingItem({
                            type: 'deck',
                            index: selectedItem.index,
                            corner: handle.corner,
                            startPos: pos,
                            initialWidth: deck.width,
                            initialHeight: deck.height,
                            anchorX: handle.corner === 'tl' || handle.corner === 'bl' ? deck.x + deck.width : deck.x,
                            anchorY: handle.corner === 'tl' || handle.corner === 'tr' ? deck.y + deck.height : deck.y
                        });
                        setIsDraggingItem(true);
                        return;
                    }
                }
            }
        }

        // PRIORITY 1: Check fence line ENDPOINTS for dragging
        if (tool === "select") {
            const hoveredPt = findHoveredPoint(pos);
            if (hoveredPt) {
                e.preventDefault();
                e.stopPropagation();
                if (e.pointerId !== undefined) {
                    e.target.setPointerCapture(e.pointerId);
                }
                if (onSaveHistory) onSaveHistory();
                setPointerGesture(prev => ({ ...prev, targetType: 'line', targetIndex: hoveredPt.lineIdx }));
                setSelectedItem({ type: 'line', index: hoveredPt.lineIdx });
                setDraggingPoint(hoveredPt);
                setIsDraggingItem(true);
                return;
            }
        }

        // PRIORITY 1.5: Check for post clicks in surface mount mode OR select mode
        if (jobPosts && jobPosts.length > 0 && (surfaceMountMode || tool === "select")) {
            const clickedPostIndex = jobPosts.findIndex(post => {
                const dist = Math.sqrt(Math.pow(pos.x - post.x, 2) + Math.pow(pos.y - post.y, 2));
                const hitRadius = 15; // 15px hit radius
                return dist < hitRadius;
            });
            
            if (clickedPostIndex !== -1) {
                e.preventDefault();
                e.stopPropagation();
                setPointerGesture(prev => ({ ...prev, targetType: 'post', targetIndex: clickedPostIndex }));
                
                if (surfaceMountMode) {
                    // Trigger post click handler for surface mount mode
                    if (typeof window !== 'undefined' && window.handlePostClick) {
                        window.handlePostClick(jobPosts[clickedPostIndex]);
                    }
                } else if (tool === "select") {
                    // Select the post
                    setSelectedItem({ type: 'post', index: clickedPostIndex });
                    setSelectedPost(jobPosts[clickedPostIndex]);
                }
                return;
            }
        }

        // PRIORITY 2: Check all other items (pools, garages, houses, gates, trees, driveways, decks, bushes, dogs, annotations)
        // Check if clicking on pool (with padding for easier selection)
        const clickedPool = pools.findIndex(pool => 
            pos.x >= pool.x - HIT_PADDING && pos.x <= pool.x + pool.width + HIT_PADDING && 
            pos.y >= pool.y - HIT_PADDING && pos.y <= pool.y + pool.height + HIT_PADDING
        );
        if (clickedPool !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            setPointerGesture(prev => ({ ...prev, targetType: 'pool', targetIndex: clickedPool }));
            if (tool === "select") {
                setSelectedItem({ type: 'pool', index: clickedPool });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'pool', index: clickedPool, startPos: pos });
            setDraggingPool(clickedPool);
            setIsDraggingItem(true);
            return;
        }

        // Check if clicking on garage (with padding for easier selection)
        const clickedGarage = garages.findIndex(garage => 
            pos.x >= garage.x - HIT_PADDING && pos.x <= garage.x + garage.width + HIT_PADDING && 
            pos.y >= garage.y - 15 - HIT_PADDING && pos.y <= garage.y + garage.height + HIT_PADDING
        );
        if (clickedGarage !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            setPointerGesture(prev => ({ ...prev, targetType: 'garage', targetIndex: clickedGarage }));
            if (tool === "select") {
                setSelectedItem({ type: 'garage', index: clickedGarage });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'garage', index: clickedGarage, startPos: pos });
            setDraggingGarage(clickedGarage);
            setIsDraggingItem(true);
            return;
        }

        // Check if clicking on house (with rotation/scale)
        const clickedHouse = houses.findIndex(house => {
            const rotation = house.rotation || 0;
            const scale = house.scale || 1;
            const centerX = house.x + house.width / 2;
            const centerY = house.y + house.height / 2;

            // Transform click position to house local space
            const dx = pos.x - centerX;
            const dy = pos.y - centerY;
            const cos = Math.cos(-rotation);
            const sin = Math.sin(-rotation);
            const localX = centerX + (dx * cos - dy * sin) / scale;
            const localY = centerY + (dx * sin + dy * cos) / scale;

            return localX >= house.x && localX <= house.x + house.width && 
                   localY >= house.y - 25 && localY <= house.y + house.height;
        });
        if (clickedHouse !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            setPointerGesture(prev => ({ ...prev, targetType: 'house', targetIndex: clickedHouse }));
            if (tool === "select") {
                // Check if shift is pressed for multi-select
                if (e.shiftKey) {
                    const existing = selectedItems.findIndex(item => item.type === 'house' && item.index === clickedHouse);
                    if (existing >= 0) {
                        setSelectedItems(selectedItems.filter((_, i) => i !== existing));
                    } else {
                        setSelectedItems([...selectedItems, { type: 'house', index: clickedHouse }]);
                    }
                    setSelectedItem(null);
                } else {
                    setSelectedItem({ type: 'house', index: clickedHouse });
                    setSelectedItems([]);
                }
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'house', index: clickedHouse, startPos: pos, initialHouse: { ...houses[clickedHouse] } });
            setDraggingHouse(clickedHouse);
            setIsDraggingItem(true);
            return;
        }

        // Check if clicking on gate (with larger hit area)
        const clickedGate = gates.findIndex(gate => getDistance(pos, { x: gate.x, y: gate.y }) < 20);
        if (clickedGate !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            setPointerGesture(prev => ({ ...prev, targetType: 'gate', targetIndex: clickedGate }));
            if (tool === "select") {
                setSelectedItem({ type: 'gate', index: clickedGate });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'gate', index: clickedGate, startPos: pos });
            setDraggingGate(clickedGate);
            setIsDraggingItem(true);
            return;
        }

        // Check if clicking on double gate (with larger hit area)
        const clickedDoubleGate = doubleGates.findIndex(gate => getDistance(pos, { x: gate.x, y: gate.y }) < 30);
        if (clickedDoubleGate !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            setPointerGesture(prev => ({ ...prev, targetType: 'doubleGate', targetIndex: clickedDoubleGate }));
            if (tool === "select") {
                setSelectedItem({ type: 'doubleGate', index: clickedDoubleGate });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'doubleGate', index: clickedDoubleGate, startPos: pos });
            setDraggingDoubleGate(clickedDoubleGate);
            setIsDraggingItem(true);
            return;
        }

        // Check if clicking on tree (with larger hit area)
        const clickedTree = trees.findIndex(tree => getDistance(pos, tree) < 25);
        if (clickedTree !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            setPointerGesture(prev => ({ ...prev, targetType: 'tree', targetIndex: clickedTree }));
            if (tool === "select") {
                setSelectedItem({ type: 'tree', index: clickedTree });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'tree', index: clickedTree, startPos: pos });
            setDraggingTree(clickedTree);
            setIsDraggingItem(true);
            return;
        }

        // Check if clicking on driveway (with padding for easier selection)
        const clickedDriveway = driveways.findIndex(driveway => 
            pos.x >= driveway.x - HIT_PADDING && pos.x <= driveway.x + driveway.width + HIT_PADDING && 
            pos.y >= driveway.y - HIT_PADDING && pos.y <= driveway.y + driveway.height + HIT_PADDING
        );
        if (clickedDriveway !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            if (tool === "select") {
                setSelectedItem({ type: 'driveway', index: clickedDriveway });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'driveway', index: clickedDriveway, startPos: pos });
            setDraggingDriveway(clickedDriveway);
            setIsDraggingItem(true);
            return;
        }

        // Check if clicking on deck
        const clickedDeck = decks.findIndex(deck => 
            pos.x >= deck.x && pos.x <= deck.x + deck.width && 
            pos.y >= deck.y && pos.y <= deck.y + deck.height
        );
        if (clickedDeck !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            if (tool === "select") {
                setSelectedItem({ type: 'deck', index: clickedDeck });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'deck', index: clickedDeck, startPos: pos });
            setDraggingDeck(clickedDeck);
            setIsDraggingItem(true);
            return;
        }

        // Check if clicking on porch (with padding for easier selection)
        const clickedPorch = porches.findIndex(porch => 
            pos.x >= porch.x - HIT_PADDING && pos.x <= porch.x + porch.width + HIT_PADDING && 
            pos.y >= porch.y - HIT_PADDING && pos.y <= porch.y + porch.height + HIT_PADDING
        );
        if (clickedPorch !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            if (tool === "select") {
                setSelectedItem({ type: 'porch', index: clickedPorch });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'porch', index: clickedPorch, startPos: pos });
            setDraggingPorch(clickedPorch);
            setIsDraggingItem(true);
            return;
        }

        // Check if clicking on grass (with padding for easier selection)
        const clickedGrass = grasses.findIndex(grass => 
            pos.x >= grass.x - HIT_PADDING && pos.x <= grass.x + grass.width + HIT_PADDING && 
            pos.y >= grass.y - HIT_PADDING && pos.y <= grass.y + grass.height + HIT_PADDING
        );
        if (clickedGrass !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            if (tool === "select") {
                setSelectedItem({ type: 'grass', index: clickedGrass });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'grass', index: clickedGrass, startPos: pos });
            setDraggingGrass(clickedGrass);
            setIsDraggingItem(true);
            return;
        }

        // Check if clicking on bush (with larger hit area)
        const clickedBush = bushes.findIndex(bush => getDistance(pos, bush) < 25);
        if (clickedBush !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            if (tool === "select") {
                setSelectedItem({ type: 'bush', index: clickedBush });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'bush', index: clickedBush, startPos: pos });
            setDraggingBush(clickedBush);
            setIsDraggingItem(true);
            return;
        }

        // Check if clicking on annotation
        if (annotations && Array.isArray(annotations)) {
            for (let i = annotations.length - 1; i >= 0; i--) {
                const annotation = annotations[i];

                if (annotation.type === 'callout') {
                    // Check tail tip handle first (if selected)
                    if (selectedItem?.type === 'annotation' && selectedItem?.index === i) {
                        if (getDistance(pos, { x: annotation.tail.anchorX, y: annotation.tail.anchorY }) < 10) {
                            setDraggingTailTip(i);
                            return;
                        }

                        // Check resize handles
                        const handles = [
                            {x: annotation.box.x, y: annotation.box.y, corner: 'tl'},
                            {x: annotation.box.x + annotation.box.w, y: annotation.box.y, corner: 'tr'},
                            {x: annotation.box.x, y: annotation.box.y + annotation.box.h, corner: 'bl'},
                            {x: annotation.box.x + annotation.box.w, y: annotation.box.y + annotation.box.h, corner: 'br'}
                        ];

                        for (const handle of handles) {
                            if (Math.abs(pos.x - handle.x) < 8 && Math.abs(pos.y - handle.y) < 8) {
                                setResizingCallout({ index: i, corner: handle.corner, startPos: pos, startBox: {...annotation.box} });
                                return;
                            }
                        }
                    }

                    // Check if clicking inside box
                    if (pos.x >= annotation.box.x && pos.x <= annotation.box.x + annotation.box.w &&
                        pos.y >= annotation.box.y && pos.y <= annotation.box.y + annotation.box.h) {
                        if (tool === "select") {
                            setSelectedItem({ type: 'annotation', index: i });
                            setEditingAnnotation(i);
                            setDraggingAnnotation({ index: i, offsetX: pos.x - annotation.box.x, offsetY: pos.y - annotation.box.y });
                        }
                        return;
                    }
                } else if (annotation.type === 'arrow') {
                    // Check rotation handle at arrow head (if selected)
                    if (selectedItem?.type === 'annotation' && selectedItem?.index === i) {
                        const cos = Math.cos(annotation.rotation);
                        const sin = Math.sin(annotation.rotation);
                        const headX = annotation.x + cos * (annotation.length / 2);
                        const headY = annotation.y + sin * (annotation.length / 2);

                        if (getDistance(pos, { x: headX, y: headY }) < 12) {
                            setRotatingArrow({ index: i, startAngle: Math.atan2(pos.y - annotation.y, pos.x - annotation.x) });
                            return;
                        }

                        // Check resize handle at tail
                        const tailX = annotation.x - cos * (annotation.length / 2);
                        const tailY = annotation.y - sin * (annotation.length / 2);

                        if (getDistance(pos, { x: tailX, y: tailY }) < 12) {
                            setResizingArrow({ index: i });
                            return;
                        }
                    }

                    // Check if clicking on arrow body - more sensitive hit area
                    const dx = pos.x - annotation.x;
                    const dy = pos.y - annotation.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < annotation.length / 2 + 30) {
                        // Rotate point to arrow's coordinate system
                        const cos = Math.cos(-annotation.rotation);
                        const sin = Math.sin(-annotation.rotation);
                        const localX = dx * cos - dy * sin;
                        const localY = dx * sin + dy * cos;

                        if (Math.abs(localX) < annotation.length / 2 + 30 && Math.abs(localY) < (annotation.thickness / 2 + 30)) {
                            if (tool === "select") {
                                setSelectedItem({ type: 'annotation', index: i });
                                setDraggingAnnotation({ index: i, offsetX: pos.x - annotation.x, offsetY: pos.y - annotation.y });
                            }
                            return;
                        }
                    }
                }
            }
        }

        // Check if clicking on bed vertices (if bed is selected)
        if (tool === "select" && selectedItem?.type === 'bed' && beds[selectedItem.index]) {
            const bed = beds[selectedItem.index];
            for (let vIdx = 0; vIdx < bed.vertices.length; vIdx++) {
                if (getDistance(pos, bed.vertices[vIdx]) < 15) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.pointerId !== undefined) {
                        e.target.setPointerCapture(e.pointerId);
                    }
                    if (onSaveHistory) onSaveHistory();
                    setDraggingBed({ bedIndex: selectedItem.index, vertexIndex: vIdx });
                    setIsDraggingItem(true);
                    return;
                }
            }
        }
        
        // Check if clicking on bed polygon body
        const clickedBed = beds.findIndex((bed, idx) => {
            if (!bed.vertices || bed.vertices.length < 3) return false;
            // Point-in-polygon test
            let inside = false;
            for (let i = 0, j = bed.vertices.length - 1; i < bed.vertices.length; j = i++) {
                const xi = bed.vertices[i].x, yi = bed.vertices[i].y;
                const xj = bed.vertices[j].x, yj = bed.vertices[j].y;
                const intersect = ((yi > pos.y) !== (yj > pos.y)) && 
                    (pos.x < (xj - xi) * (pos.y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        });
        if (clickedBed !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            if (tool === "select") {
                setSelectedItem({ type: 'bed', index: clickedBed });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'bed', index: clickedBed, startPos: pos, initialVertices: [...beds[clickedBed].vertices] });
            setDraggingBed({ bedIndex: clickedBed, vertexIndex: null });
            setIsDraggingItem(true);
            return;
        }
        
        // Check if clicking on end post (with larger hit area)
        const clickedEndPost = endPosts.findIndex(endPost => getDistance(pos, endPost) < 25);
        if (clickedEndPost !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            if (tool === "select") {
                setSelectedItem({ type: 'endPost', index: clickedEndPost });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'endPost', index: clickedEndPost, startPos: pos });
            setDraggingEndPost(clickedEndPost);
            setIsDraggingItem(true);
            return;
        }

        // Check if clicking on dog (with larger hit area)
        const clickedDog = dogs.findIndex(dog => getDistance(pos, dog) < 30);
        if (clickedDog !== -1) {
            e.preventDefault();
            e.stopPropagation();
            if (e.pointerId !== undefined) {
                e.target.setPointerCapture(e.pointerId);
            }
            if (tool === "select") {
                setSelectedItem({ type: 'dog', index: clickedDog });
            }
            if (onSaveHistory) onSaveHistory();
            setDragStartState({ type: 'dog', index: clickedDog, startPos: pos });
            setDraggingDog(clickedDog);
            setIsDraggingItem(true);
            return;
        }

        // PRIORITY 3: Check fence line BODY for selection (after all other items) - ONLY in select mode
        if (tool === "select" && interactionMode === 'select') {
            for (let i = 0; i < fenceLines.length; i++) {
                const line = fenceLines[i];
                
                // Check if near line body (but not near endpoints)
                const distToStart = getDistance(pos, line.start);
                const distToEnd = getDistance(pos, line.end);
                const distToLine = pointToLineDistance(pos, line.start, line.end);
                
                // Click on line body (not endpoints)
                if (distToLine < 10 && distToStart > 15 && distToEnd > 15) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Multi-select with modifier keys
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                        const itemKey = `line_${i}`;
                        const isAlreadySelected = selectedItems.some(item => item.type === 'line' && item.index === i);
                        if (isAlreadySelected) {
                            setSelectedItems(selectedItems.filter(item => !(item.type === 'line' && item.index === i)));
                        } else {
                            setSelectedItems([...selectedItems, { type: 'line', index: i }]);
                        }
                        setSelectedItem(null);
                    } else {
                        // Check if clicking on already selected item (for group drag)
                        const isInSelection = selectedItems.some(item => item.type === 'line' && item.index === i);
                        if (isInSelection && selectedItems.length > 1) {
                            // Prepare for group drag - don't change selection yet
                            setGroupDragStart({ pos, itemIndex: i, itemType: 'line' });
                        } else {
                            setSelectedItem({ type: 'line', index: i });
                            setSelectedItems([]);
                        }
                    }
                    setMouseDownPos(pos);
                    return;
                }
            }
            
            // If nothing was clicked, start marquee selection or deselect
            if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                setSelectedItem(null);
                setSelectedItems([]);
            }
            // Start marquee
            setIsMarqueeSelecting(true);
            setMarqueeStart(pos);
            setMarqueeEnd(pos);
            return;
        }

        // Placement mode - create item and immediately switch to select mode
        if (tool === "tree" || tool === "object-tree") {
            if (onSaveHistory) onSaveHistory();
            setTrees([...trees, pos]);
            setSelectedItem({ type: 'tree', index: trees.length });
            setTool("select");
            setDragStartState({ type: 'tree', index: trees.length, startPos: pos });
            setDraggingTree(trees.length);
            setIsDraggingItem(true);
            return;
        }

        if (tool === "gate") {
            if (onSaveHistory) onSaveHistory();
            setGates([...gates, { x: pos.x, y: pos.y, rotation: 0, width: singleGateWidth }]);
            setSelectedItem({ type: 'gate', index: gates.length });
            setTool("select");
            setDragStartState({ type: 'gate', index: gates.length, startPos: pos });
            setDraggingGate(gates.length);
            setIsDraggingItem(true);
            return;
        }

        if (tool === "doubleGate") {
            if (onSaveHistory) onSaveHistory();
            setDoubleGates([...doubleGates, { x: pos.x, y: pos.y, rotation: 0, width: doubleGateWidth }]);
            setSelectedItem({ type: 'doubleGate', index: doubleGates.length });
            setTool("select");
            setDragStartState({ type: 'doubleGate', index: doubleGates.length, startPos: pos });
            setDraggingDoubleGate(doubleGates.length);
            setIsDraggingItem(true);
            return;
        }

        if (tool === "house" || tool === "object-house") {
            e.preventDefault();
            if (onSaveHistory) onSaveHistory();
            setHouses([...houses, { x: pos.x - 60, y: pos.y - 40, width: 120, height: 80, rotation: 0, scale: 1 }]);
            setSelectedItem({ type: 'house', index: houses.length });
            setTool("select");
            setDragStartState({ type: 'house', index: houses.length, startPos: pos });
            setDraggingHouse(houses.length);
            setIsDraggingItem(true);
            return;
        }

        if (tool === "pool" || tool === "object-pool") {
            if (onSaveHistory) onSaveHistory();
            setPools([...pools, { x: pos.x - 50, y: pos.y - 30, width: 100, height: 60 }]);
            setSelectedItem({ type: 'pool', index: pools.length });
            setTool("select");
            setDragStartState({ type: 'pool', index: pools.length, startPos: pos });
            setDraggingPool(pools.length);
            setIsDraggingItem(true);
            return;
        }

        if (tool === "garage" || tool === "object-garage") {
            if (onSaveHistory) onSaveHistory();
            setGarages([...garages, { x: pos.x - 50, y: pos.y - 35, width: 100, height: 70 }]);
            setSelectedItem({ type: 'garage', index: garages.length });
            setTool("select");
            setDragStartState({ type: 'garage', index: garages.length, startPos: pos });
            setDraggingGarage(garages.length);
            setIsDraggingItem(true);
            return;
        }

        if (tool === "dog" || tool === "object-dog") {
            if (onSaveHistory) onSaveHistory();
            const newDog = { x: pos.x, y: pos.y, name: null };
            setDogs([...dogs, newDog]);
            setSelectedItem({ type: 'dog', index: dogs.length });
            setNamingDog(dogs.length);
            setTool("select");
            setDragStartState({ type: 'dog', index: dogs.length, startPos: pos });
            setDraggingDog(dogs.length);
            setIsDraggingItem(true);
            return;
        }

        if (tool === "driveway" || tool === "object-driveway") {
            if (onSaveHistory) onSaveHistory();
            setDriveways([...driveways, { x: pos.x - 60, y: pos.y - 40, width: 120, height: 80 }]);
            setSelectedItem({ type: 'driveway', index: driveways.length });
            setTool("select");
            setDragStartState({ type: 'driveway', index: driveways.length, startPos: pos });
            setDraggingDriveway(driveways.length);
            setIsDraggingItem(true);
            return;
        }

        if (tool === "deck" || tool === "object-deck") {
            if (onSaveHistory) onSaveHistory();
            setDecks([...decks, { x: pos.x - 50, y: pos.y - 35, width: 100, height: 70 }]);
            setSelectedItem({ type: 'deck', index: decks.length });
            setTool("select");
            setDragStartState({ type: 'deck', index: decks.length, startPos: pos });
            setDraggingDeck(decks.length);
            setIsDraggingItem(true);
            return;
        }

        if (tool === "bush" || tool === "object-bush") {
            if (onSaveHistory) onSaveHistory();
            setBushes([...bushes, pos]);
            setSelectedItem({ type: 'bush', index: bushes.length });
            setTool("select");
            setDragStartState({ type: 'bush', index: bushes.length, startPos: pos });
            setDraggingBush(bushes.length);
            setIsDraggingItem(true);
            return;
        }

        if (tool === "porch" || tool === "object-porch") {
            if (onSaveHistory) onSaveHistory();
            setPorches([...porches, { x: pos.x - 60, y: pos.y - 40, width: 120, height: 80 }]);
            setSelectedItem({ type: 'porch', index: porches.length });
            setTool("select");
            setDragStartState({ type: 'porch', index: porches.length, startPos: pos });
            setDraggingPorch(porches.length);
            setIsDraggingItem(true);
            return;
        }

        if (tool === "grass" || tool === "object-grass") {
            if (onSaveHistory) onSaveHistory();
            setGrasses([...grasses, { x: pos.x - 100, y: pos.y - 80, width: 200, height: 160 }]);
            setSelectedItem({ type: 'grass', index: grasses.length });
            setTool("select");
            setDragStartState({ type: 'grass', index: grasses.length, startPos: pos });
            setDraggingGrass(grasses.length);
            setIsDraggingItem(true);
            return;
        }

        if (tool === "endPost" || tool === "object-endpost") {
            if (onSaveHistory) onSaveHistory();
            setEndPosts([...endPosts, { x: pos.x, y: pos.y, postType: 'end' }]);
            setSelectedItem({ type: 'endPost', index: endPosts.length });
            setTool("select");
            setDragStartState({ type: 'endPost', index: endPosts.length, startPos: pos });
            setDraggingEndPost(endPosts.length);
            setIsDraggingItem(true);
            return;
        }
        
        if (tool === "bed" || tool === "object-bed") {
            e.preventDefault();
            
            // Check if clicking on first vertex to close polygon (min 3 vertices)
            if (drawingBed && drawingBed.vertices.length >= 3) {
                const firstVertex = drawingBed.vertices[0];
                if (getDistance(pos, firstVertex) < 15) {
                    // Close the polygon
                    if (onSaveHistory) onSaveHistory();
                    const newBed = {
                        vertices: drawingBed.vertices
                    };
                    setBeds([...beds, newBed]);
                    setDrawingBed(null);
                    setSelectedItem({ type: 'bed', index: beds.length });
                    setTool("select");
                    return;
                }
            }
            
            // Add new vertex to current bed
            if (drawingBed) {
                setDrawingBed({
                    ...drawingBed,
                    vertices: [...drawingBed.vertices, pos]
                });
            } else {
                // Start new bed with first vertex
                setDrawingBed({
                    vertices: [pos],
                    currentPos: null
                });
            }
            return;
        }

        if (tool === "callout") {
            if (onSaveHistory) onSaveHistory();
            const newCallout = {
                id: Date.now().toString(),
                type: 'callout',
                text: '',
                box: { x: pos.x, y: pos.y, w: 180, h: 60 },
                tail: { anchorX: pos.x + 120, anchorY: pos.y + 40 },
                style: { fontSize: 14, bg: '#FFFFFF', border: '#334155' },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const newAnnotations = [...(annotations || []), newCallout];
            if (setAnnotations) {
                setAnnotations(newAnnotations);
            }
            setSelectedItem({ type: 'annotation', index: newAnnotations.length - 1 });
            setEditingAnnotation(newAnnotations.length - 1);
            setTool("select");
            return;
        }

        if (tool === "arrow") {
            if (onSaveHistory) onSaveHistory();
            const newArrow = {
                id: Date.now().toString(),
                type: 'arrow',
                x: pos.x,
                y: pos.y,
                length: 120,
                thickness: 6,
                rotation: 0,
                color: '#DC2626',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const newAnnotations = [...(annotations || []), newArrow];
            if (setAnnotations) {
                setAnnotations(newAnnotations);
            }
            setSelectedItem({ type: 'annotation', index: newAnnotations.length - 1 });
            setTool("select");
            return;
        }

        if (tool === "fence" || tool === "existing-fence") {
            if (onSaveHistory) onSaveHistory();
            // Snap start point to nearest endpoint if close
            const snapPoint = findNearestEndpoint(pos);
            const startPoint = snapPoint || pos;
            setCurrentLine({ start: startPoint, end: startPoint });
        }
    };

    function updateLineEffectiveLength(lineIdx, newManualLength) {
        const newLines = [...fenceLines];
        const line = newLines[lineIdx];
        if (!line) return;

        line.manualLengthFt = newManualLength;

        // Calculate line direction and length in pixels
        const lineVec = { x: line.end.x - line.start.x, y: line.end.y - line.start.y };
        const linePixelLength = Math.sqrt(lineVec.x * lineVec.x + lineVec.y * lineVec.y);
        const lineDir = { x: lineVec.x / linePixelLength, y: lineVec.y / linePixelLength };

        // Recalculate all gate positions based on their current visual position (pixel position)
        // The visual position represents the actual measurement position
        setGates(prev => prev.map(gate => {
            if (gate.attachedRunId === lineIdx) {
                // Calculate gate's current position along the line as a percentage (0.0 to 1.0)
                const gateVec = { x: gate.x - line.start.x, y: gate.y - line.start.y };
                const gatePixelDist = Math.sqrt(gateVec.x * gateVec.x + gateVec.y * gateVec.y);
                const param = linePixelLength > 0 ? gatePixelDist / linePixelLength : 0;

                // Position in feet is percentage of manual length
                const newCenterFt = param * newManualLength;

                return {
                    ...gate,
                    snapPositionFt: Math.max(0, Math.min(newManualLength, newCenterFt))
                };
            }
            return gate;
        }));

        setDoubleGates(prev => prev.map(gate => {
            if (gate.attachedRunId === lineIdx) {
                // Calculate gate's current position along the line as a percentage (0.0 to 1.0)
                const gateVec = { x: gate.x - line.start.x, y: gate.y - line.start.y };
                const gatePixelDist = Math.sqrt(gateVec.x * gateVec.x + gateVec.y * gateVec.y);
                const param = linePixelLength > 0 ? gatePixelDist / linePixelLength : 0;

                // Position in feet is percentage of manual length
                const newCenterFt = param * newManualLength;

                return {
                    ...gate,
                    snapPositionFt: Math.max(0, Math.min(newManualLength, newCenterFt))
                };
            }
            return gate;
        }));

        setFenceLines(newLines);
    }

    // Expose function to window for Toolbar access
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.updateLineEffectiveLength = updateLineEffectiveLength;
        }
    }, [fenceLines, gates, doubleGates]);

    const getResizeCorner = (pos, struct) => {
        const handleSize = 8;
        const corners = [
            { name: 'tl', x: struct.x, y: struct.y },
            { name: 'tr', x: struct.x + struct.width, y: struct.y },
            { name: 'bl', x: struct.x, y: struct.y + struct.height },
            { name: 'br', x: struct.x + struct.width, y: struct.y + struct.height }
        ];
        
        for (const corner of corners) {
            if (Math.abs(pos.x - corner.x) < handleSize && Math.abs(pos.y - corner.y) < handleSize) {
                return corner.name;
            }
        }
        return null;
    };

    // Find nearest endpoint for snapping
    const findNearestEndpoint = (pos) => {
        let nearestPoint = null;
        let nearestDistance = SNAP_THRESHOLD;
        
        fenceLines.forEach((line, idx) => {
            [line.start, line.end].forEach((point, pointIdx) => {
                const distance = getDistance(pos, point);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestPoint = point;
                }
            });
        });
        
        return nearestPoint;
    };

    const handleMouseMove = (e) => {
        const pos = getMousePos(e);
        
        // Update touch position for pinch gestures
        if (e.pointerType === 'touch') {
            setActiveTouches(prev => prev.map(t => 
                t.id === e.pointerId ? { ...t, x: e.clientX, y: e.clientY } : t
            ));

            // Handle two-finger gestures (pinch-to-zoom AND pan)
            if (activeTouches.length === 2) {
                const touch1 = activeTouches[0];
                const touch2 = activeTouches.find(t => t.id !== touch1.id);
                
                if (touch2) {
                    const currentDist = Math.hypot(touch2.x - touch1.x, touch2.y - touch1.y);
                    const centerX = (touch1.x + touch2.x) / 2;
                    const centerY = (touch1.y + touch2.y) / 2;
                    
                    // Initialize pinch tracking
                    if (pinchDistance === null) {
                        setPinchDistance(currentDist);
                        setPanStartPos({ x: centerX, y: centerY, cameraX, cameraY });
                    } else {
                        // Handle zoom (dampened for smoother control)
                        const scaleFactor = currentDist / pinchDistance;
                        const zoomFactor = 1 + (scaleFactor - 1) * 0.3; // 30% of pinch amount for smoother zoom
                        const newZoom = Math.max(0.5, Math.min(3, zoom * zoomFactor));
                        if (typeof window !== 'undefined' && window.updateZoom) {
                            window.updateZoom(newZoom);
                        }
                        setPinchDistance(currentDist);
                        
                        // Handle pan (two-finger drag)
                        if (panStartPos) {
                            const dx = centerX - panStartPos.x;
                            const dy = centerY - panStartPos.y;
                            setCameraX(panStartPos.cameraX - dx / zoom);
                            setCameraY(panStartPos.cameraY - dy / zoom);
                            setPanStartPos({ x: centerX, y: centerY, cameraX: panStartPos.cameraX - dx / zoom, cameraY: panStartPos.cameraY - dy / zoom });
                        }
                    }
                    
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
        }

        // Handle pan mode panning
        if (isPanning && panStartPos) {
            const dx = e.clientX - panStartPos.x;
            const dy = e.clientY - panStartPos.y;

            setCameraX(panStartPos.cameraX - dx / zoom);
            setCameraY(panStartPos.cameraY - dy / zoom);

            e.preventDefault();
            e.stopPropagation();
            return;
        }

        // Prevent default when dragging items
        if (isDraggingItem) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Handle marquee selection
        if (isMarqueeSelecting && marqueeStart) {
            setMarqueeEnd(pos);
            return;
        }
        
        // Handle group dragging
        if (isGroupDragging && groupDragStart && selectedItems.length > 1) {
            const dx = pos.x - groupDragStart.pos.x;
            const dy = pos.y - groupDragStart.pos.y;

            // Update all selected items
            selectedItems.forEach(item => {
                if (item.type === 'line') {
                    const startState = groupDragStart.snapshot[`line_${item.index}`];
                    if (startState) {
                        const newLines = [...fenceLines];
                        newLines[item.index] = {
                            ...newLines[item.index],
                            start: { x: startState.start.x + dx, y: startState.start.y + dy },
                            end: { x: startState.end.x + dx, y: startState.end.y + dy }
                        };
                        setFenceLines(newLines);
                    }
                } else if (item.type === 'tree') {
                    const startState = groupDragStart.snapshot[`tree_${item.index}`];
                    if (startState) {
                        const newTrees = [...trees];
                        newTrees[item.index] = { x: startState.x + dx, y: startState.y + dy };
                        setTrees(newTrees);
                    }
                } else if (item.type === 'house') {
                    const startState = groupDragStart.snapshot[`house_${item.index}`];
                    if (startState) {
                        const newHouses = [...houses];
                        newHouses[item.index] = {
                            ...newHouses[item.index],
                            x: startState.x + dx,
                            y: startState.y + dy
                        };
                        setHouses(newHouses);
                    }
                } else if (item.type === 'gate') {
                    const startState = groupDragStart.snapshot[`gate_${item.index}`];
                    if (startState) {
                        const newGates = [...gates];
                        newGates[item.index] = {
                            ...newGates[item.index],
                            x: startState.x + dx,
                            y: startState.y + dy
                        };
                        setGates(newGates);
                    }
                } else if (item.type === 'doubleGate') {
                    const startState = groupDragStart.snapshot[`doubleGate_${item.index}`];
                    if (startState) {
                        const newDoubleGates = [...doubleGates];
                        newDoubleGates[item.index] = {
                            ...newDoubleGates[item.index],
                            x: startState.x + dx,
                            y: startState.y + dy
                        };
                        setDoubleGates(newDoubleGates);
                    }
                } else if (item.type === 'annotation') {
                    const startState = groupDragStart.snapshot[`annotation_${item.index}`];
                    if (startState && annotations[item.index]) {
                        const ann = annotations[item.index];
                        const newAnnotations = [...annotations];
                        if (ann.type === 'callout') {
                            newAnnotations[item.index] = {
                                ...ann,
                                box: {
                                    ...ann.box,
                                    x: startState.box.x + dx,
                                    y: startState.box.y + dy
                                },
                                tail: {
                                    anchorX: startState.tail.anchorX + dx,
                                    anchorY: startState.tail.anchorY + dy
                                }
                            };
                        } else if (ann.type === 'arrow') {
                            newAnnotations[item.index] = {
                                ...ann,
                                x: startState.x + dx,
                                y: startState.y + dy
                            };
                        }
                        setAnnotations(newAnnotations);
                    }
                }
            });
            return;
        }

        // Detect if we've moved enough to be dragging
        if (mouseDownPos && !isDragging && pointerGesture) {
            const dx = pos.x - pointerGesture.startX;
            const dy = pos.y - pointerGesture.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > DRAG_THRESHOLD) {
                setIsDragging(true);
                setPointerGesture(prev => ({ ...prev, didDrag: true }));
                
                // Start group drag if applicable
                if (groupDragStart && selectedItems.length > 1) {
                    const snapshot = {};
                    selectedItems.forEach(item => {
                        const key = `${item.type}_${item.index}`;
                        if (item.type === 'line' && fenceLines[item.index]) {
                            snapshot[key] = { 
                                start: { ...fenceLines[item.index].start }, 
                                end: { ...fenceLines[item.index].end } 
                            };
                        } else if (item.type === 'tree' && trees[item.index]) {
                            snapshot[key] = { ...trees[item.index] };
                        } else if (item.type === 'house' && houses[item.index]) {
                            snapshot[key] = { x: houses[item.index].x, y: houses[item.index].y };
                        } else if (item.type === 'gate' && gates[item.index]) {
                            snapshot[key] = { x: gates[item.index].x, y: gates[item.index].y };
                        } else if (item.type === 'doubleGate' && doubleGates[item.index]) {
                            snapshot[key] = { x: doubleGates[item.index].x, y: doubleGates[item.index].y };
                        } else if (item.type === 'annotation' && annotations[item.index]) {
                            const ann = annotations[item.index];
                            if (ann.type === 'callout') {
                                snapshot[key] = { 
                                    box: { ...ann.box }, 
                                    tail: { ...ann.tail } 
                                };
                            } else if (ann.type === 'arrow') {
                                snapshot[key] = { x: ann.x, y: ann.y };
                            }
                        }
                    });
                    setGroupDragStart({ ...groupDragStart, snapshot });
                    setIsGroupDragging(true);
                }
            }
        }
            if (!pos) return;
        
        if (rotatingHouse !== null) {
            const house = houses[rotatingHouse.index];
            const centerX = house.x + house.width / 2;
            const centerY = house.y + house.height / 2;
            const currentAngle = Math.atan2(pos.y - centerY, pos.x - centerX);
            const deltaAngle = currentAngle - rotatingHouse.startAngle;
            const newRotation = rotatingHouse.startRotation + deltaAngle;

            const newHouses = [...houses];
            newHouses[rotatingHouse.index] = {
                ...newHouses[rotatingHouse.index],
                rotation: newRotation
            };
            setHouses(newHouses);
            return;
        }

        if (scalingItem) {
            const { type, index, corner, startPos, anchorX, anchorY } = scalingItem;

            if (type === 'house') {
                const dx = pos.x - anchorX;
                const dy = pos.y - anchorY;

                const newWidth = Math.max(60, Math.abs(dx));
                const newHeight = Math.max(40, Math.abs(dy));

                const newX = dx >= 0 ? anchorX : anchorX - newWidth;
                const newY = dy >= 0 ? anchorY : anchorY - newHeight;

                const newHouses = [...houses];
                newHouses[index] = { 
                    ...newHouses[index], 
                    x: newX, 
                    y: newY, 
                    width: newWidth, 
                    height: newHeight,
                    scale: 1 // Reset scale when resizing
                };
                setHouses(newHouses);
            } else {
                // For non-rotated items (pool, garage, driveway, deck)
                const dx = pos.x - anchorX;
                const dy = pos.y - anchorY;

                const newWidth = Math.max(40, Math.abs(dx));
                const newHeight = Math.max(40, Math.abs(dy));

                const newX = dx >= 0 ? anchorX : anchorX - newWidth;
                const newY = dy >= 0 ? anchorY : anchorY - newHeight;

                if (type === 'pool') {
                    const newPools = [...pools];
                    newPools[index] = { ...newPools[index], x: newX, y: newY, width: newWidth, height: newHeight };
                    setPools(newPools);
                } else if (type === 'garage') {
                    const newGarages = [...garages];
                    newGarages[index] = { ...newGarages[index], x: newX, y: newY, width: newWidth, height: newHeight };
                    setGarages(newGarages);
                } else if (type === 'driveway') {
                    const newDriveways = [...driveways];
                    newDriveways[index] = { ...newDriveways[index], x: newX, y: newY, width: newWidth, height: newHeight };
                    setDriveways(newDriveways);
                } else if (type === 'deck') {
                    const newDecks = [...decks];
                    newDecks[index] = { ...newDecks[index], x: newX, y: newY, width: newWidth, height: newHeight };
                    setDecks(newDecks);
                } else if (type === 'porch') {
                    const newPorches = [...porches];
                    newPorches[index] = { ...newPorches[index], x: newX, y: newY, width: newWidth, height: newHeight };
                    setPorches(newPorches);
                } else if (type === 'grass') {
                    const newGrasses = [...grasses];
                    newGrasses[index] = { ...newGrasses[index], x: newX, y: newY, width: newWidth, height: newHeight };
                    setGrasses(newGrasses);
                }
            }
            return;
        }

        if (draggingPool !== null) {
            const newPools = [...pools];
            const pool = newPools[draggingPool];
            newPools[draggingPool] = {
                ...pool,
                x: pos.x - pool.width / 2,
                y: pos.y - pool.height / 2
            };
            setPools(newPools);
            return;
        }

        if (draggingGarage !== null) {
            const newGarages = [...garages];
            const garage = newGarages[draggingGarage];
            newGarages[draggingGarage] = {
                ...garage,
                x: pos.x - garage.width / 2,
                y: pos.y - garage.height / 2
            };
            setGarages(newGarages);
            return;
        }

        if (draggingHouse !== null) {
            const newHouses = [...houses];
            const house = newHouses[draggingHouse];

            // Calculate new position
            const newHouse = {
                ...house,
                x: pos.x - house.width / 2,
                y: pos.y - house.height / 2
            };

            // Check for snap
            const snapTarget = findHouseSnapTarget(draggingHouse, newHouse);

            if (snapTarget) {
                // Apply snap offset
                newHouse.x += snapTarget.offsetX;
                newHouse.y += snapTarget.offsetY;
                setSnapIndicator({
                    type: 'house-snap',
                    draggedPoint: snapTarget.draggedPoint,
                    targetPoint: snapTarget.targetPoint
                });
            } else {
                setSnapIndicator(null);
            }

            newHouses[draggingHouse] = newHouse;
            setHouses(newHouses);
            return;
        }

        if (draggingTree !== null) {
            const newTrees = [...trees];
            newTrees[draggingTree] = pos;
            setTrees(newTrees);
            return;
        }

        if (draggingDriveway !== null) {
            const newDriveways = [...driveways];
            const driveway = newDriveways[draggingDriveway];
            newDriveways[draggingDriveway] = {
                ...driveway,
                x: pos.x - driveway.width / 2,
                y: pos.y - driveway.height / 2
            };
            setDriveways(newDriveways);
            return;
        }

        if (draggingDeck !== null) {
            const newDecks = [...decks];
            const deck = newDecks[draggingDeck];
            newDecks[draggingDeck] = {
                ...deck,
                x: pos.x - deck.width / 2,
                y: pos.y - deck.height / 2
            };
            setDecks(newDecks);
            return;
        }

        if (draggingBush !== null) {
            const newBushes = [...bushes];
            newBushes[draggingBush] = pos;
            setBushes(newBushes);
            return;
        }

        if (draggingPorch !== null) {
            const newPorches = [...porches];
            const porch = newPorches[draggingPorch];
            newPorches[draggingPorch] = {
                ...porch,
                x: pos.x - porch.width / 2,
                y: pos.y - porch.height / 2
            };
            setPorches(newPorches);
            return;
        }

        if (draggingGrass !== null) {
            const newGrasses = [...grasses];
            const grass = newGrasses[draggingGrass];
            newGrasses[draggingGrass] = {
                ...grass,
                x: pos.x - grass.width / 2,
                y: pos.y - grass.height / 2
            };
            setGrasses(newGrasses);
            return;
        }
        
        if (draggingBed !== null) {
            const newBeds = [...beds];
            const bed = newBeds[draggingBed.bedIndex];
            
            if (draggingBed.vertexIndex !== null && draggingBed.vertexIndex !== undefined) {
                // Dragging single vertex
                newBeds[draggingBed.bedIndex] = {
                    ...bed,
                    vertices: bed.vertices.map((v, vIdx) => 
                        vIdx === draggingBed.vertexIndex ? pos : v
                    )
                };
            } else {
                // Dragging entire bed
                const dx = pos.x - (dragStartState?.startPos.x || pos.x);
                const dy = pos.y - (dragStartState?.startPos.y || pos.y);
                const initialVertices = dragStartState?.initialVertices || bed.vertices;
                
                newBeds[draggingBed.bedIndex] = {
                    ...bed,
                    vertices: initialVertices.map(v => ({
                        x: v.x + dx,
                        y: v.y + dy
                    }))
                };
            }
            
            setBeds(newBeds);
            return;
        }
        
        // Update drawing bed's current position for preview line
        if (drawingBed) {
            setDrawingBed({
                ...drawingBed,
                currentPos: pos
            });
        }

        if (draggingEndPost !== null) {
            const newEndPosts = [...endPosts];
            const endPost = newEndPosts[draggingEndPost];
            const snapInfo = findClosestFenceLine(pos);
            
            if (snapInfo) {
                // Snap to line
                newEndPosts[draggingEndPost] = { 
                    ...endPost,
                    x: snapInfo.snapPoint.x, 
                    y: snapInfo.snapPoint.y,
                    attachedRunId: snapInfo.lineIdx,
                    snapPositionFt: snapInfo.snapPositionFt,
                    snapPositionPercent: snapInfo.snapPositionPercent
                };
            } else {
                // Free placement
                newEndPosts[draggingEndPost] = { 
                    ...endPost,
                    x: pos.x, 
                    y: pos.y,
                    attachedRunId: null,
                    snapPositionFt: null,
                    snapPositionPercent: null
                };
            }
            
            setEndPosts(newEndPosts);
            return;
        }

        if (draggingTailTip !== null) {
            const newAnnotations = [...annotations];
            newAnnotations[draggingTailTip] = {
                ...newAnnotations[draggingTailTip],
                tail: { anchorX: pos.x, anchorY: pos.y },
                updatedAt: new Date().toISOString()
            };
            if (setAnnotations) {
                setAnnotations(newAnnotations);
            }
            return;
        }

        if (rotatingArrow !== null) {
            const annotation = annotations[rotatingArrow.index];
            const currentAngle = Math.atan2(pos.y - annotation.y, pos.x - annotation.x);
            const newAnnotations = [...annotations];
            newAnnotations[rotatingArrow.index] = {
                ...newAnnotations[rotatingArrow.index],
                rotation: currentAngle,
                updatedAt: new Date().toISOString()
            };
            if (setAnnotations) {
                setAnnotations(newAnnotations);
            }
            return;
        }

        if (resizingArrow !== null) {
            const annotation = annotations[resizingArrow.index];
            const dx = pos.x - annotation.x;
            const dy = pos.y - annotation.y;
            const newLength = Math.sqrt(dx * dx + dy * dy) * 2;
            const newAnnotations = [...annotations];
            newAnnotations[resizingArrow.index] = {
                ...newAnnotations[resizingArrow.index],
                length: Math.max(40, newLength),
                updatedAt: new Date().toISOString()
            };
            if (setAnnotations) {
                setAnnotations(newAnnotations);
            }
            return;
        }

        if (resizingCallout !== null) {
            const { index, corner, startPos, startBox } = resizingCallout;
            const dx = pos.x - startPos.x;
            const dy = pos.y - startPos.y;

            let newBox = { ...startBox };

            if (corner === 'br') {
                newBox.w = Math.max(80, startBox.w + dx);
                newBox.h = Math.max(40, startBox.h + dy);
            } else if (corner === 'bl') {
                newBox.w = Math.max(80, startBox.w - dx);
                newBox.h = Math.max(40, startBox.h + dy);
                newBox.x = startBox.x + startBox.w - newBox.w;
            } else if (corner === 'tr') {
                newBox.w = Math.max(80, startBox.w + dx);
                newBox.h = Math.max(40, startBox.h - dy);
                newBox.y = startBox.y + startBox.h - newBox.h;
            } else if (corner === 'tl') {
                newBox.w = Math.max(80, startBox.w - dx);
                newBox.h = Math.max(40, startBox.h - dy);
                newBox.x = startBox.x + startBox.w - newBox.w;
                newBox.y = startBox.y + startBox.h - newBox.h;
            }

            const newAnnotations = [...annotations];
            newAnnotations[index] = {
                ...newAnnotations[index],
                box: newBox,
                updatedAt: new Date().toISOString()
            };
            if (setAnnotations) {
                setAnnotations(newAnnotations);
            }
            return;
        }

        if (draggingAnnotation !== null) {
            const annotation = annotations[draggingAnnotation.index];
            const newAnnotations = [...annotations];

            if (annotation.type === 'callout') {
                const dx = pos.x - draggingAnnotation.offsetX - annotation.box.x;
                const dy = pos.y - draggingAnnotation.offsetY - annotation.box.y;
                newAnnotations[draggingAnnotation.index] = {
                    ...annotation,
                    box: {
                        ...annotation.box,
                        x: pos.x - draggingAnnotation.offsetX,
                        y: pos.y - draggingAnnotation.offsetY
                    },
                    tail: {
                        anchorX: annotation.tail.anchorX + dx,
                        anchorY: annotation.tail.anchorY + dy
                    },
                    updatedAt: new Date().toISOString()
                };
            } else if (annotation.type === 'arrow') {
                newAnnotations[draggingAnnotation.index] = {
                    ...annotation,
                    x: pos.x - draggingAnnotation.offsetX,
                    y: pos.y - draggingAnnotation.offsetY,
                    updatedAt: new Date().toISOString()
                };
            }

            if (setAnnotations) {
                setAnnotations(newAnnotations);
            }
            return;
        }

        if (draggingDog !== null) {
            const newDogs = [...dogs];
            newDogs[draggingDog] = { ...newDogs[draggingDog], x: pos.x, y: pos.y };
            setDogs(newDogs);
            return;
        }

        if (draggingGate !== null) {
            const newGates = [...gates];
            const gate = newGates[draggingGate];
            const snapInfo = findClosestFenceLine(pos);
            
            const wasSnapped = gate.attachedRunId !== null && gate.attachedRunId !== undefined;
            const isNowSnapped = snapInfo !== null;
            
            if (snapInfo) {
                const line = fenceLines[snapInfo.lineIdx];
                const rotationRad = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
                const gateWidthFt = parseFloat(gate.width?.replace(/'/g, '')) || 4;
                
                // Calculate gate post positions
                const dx = line.end.x - line.start.x;
                const dy = line.end.y - line.start.y;
                const linePixels = Math.sqrt(dx * dx + dy * dy);
                const lineFeet = line.manualLengthFt || line.length || 0;
                
                if (linePixels > 0 && lineFeet > 0) {
                    const pixelsPerFt = linePixels / lineFeet;
                    const dirX = dx / linePixels;
                    const dirY = dy / linePixels;
                    const centerFt = snapInfo.snapPositionFt;
                    const halfWidthFt = gateWidthFt / 2;
                    
                    const post1DistPixels = (centerFt - halfWidthFt) * pixelsPerFt;
                    const post2DistPixels = (centerFt + halfWidthFt) * pixelsPerFt;
                    
                    const gatePost1 = {
                        x: line.start.x + dirX * post1DistPixels,
                        y: line.start.y + dirY * post1DistPixels
                    };
                    const gatePost2 = {
                        x: line.start.x + dirX * post2DistPixels,
                        y: line.start.y + dirY * post2DistPixels
                    };
                    
                    // Find posts to snap to (end/corner only) - includes perfect fit detection
                    console.log('[FenceCanvas] Single gate - posts:', jobPosts?.length, 'gatePost1:', gatePost1, 'gatePost2:', gatePost2);
                    const snapResult = findGatePostSnaps(jobPosts, gatePost1, gatePost2, line, gateWidthFt);
                    console.log('[FenceCanvas] Single gate snap result:', snapResult);
                    
                    // Apply snapping if perfect fit OR nearby terminal posts found
                    let finalGateCenter = { centerX: snapInfo.snapPoint.x, centerY: snapInfo.snapPoint.y, centerFt: snapInfo.snapPositionFt };
                    
                    if (snapResult.isPerfectFit || snapResult.post1Snap || snapResult.post2Snap) {
                        console.log('[FenceCanvas] Applying snap for single gate');
                        const applied = applyGatePostSnapping(gatePost1, gatePost2, snapResult);
                        finalGateCenter = calculateSnappedGateCenter(
                            { ...gate, x: snapInfo.snapPoint.x, y: snapInfo.snapPoint.y, width: gate.width },
                            line,
                            snapResult
                        );
                        console.log('[FenceCanvas] Final center for single gate:', finalGateCenter);
                    }
                    // Otherwise: free movement, use original gate center
                    
                    // Update gate with final position
                    newGates[draggingGate] = { 
                        ...newGates[draggingGate], 
                        x: finalGateCenter.centerX, 
                        y: finalGateCenter.centerY,
                        attachedRunId: snapInfo.lineIdx,
                        snapPositionFt: finalGateCenter.centerFt,
                        snapPositionPercent: (finalGateCenter.centerFt / lineFeet) * 100,
                        rotationRad: rotationRad,
                        pendingSnap: snapInfo,
                        pendingDelete: false,
                        snapResult: snapResult, // Store for mouseUp processing
                        isPerfectFit: snapResult.isPerfectFit
                    };
                }
            } else {
                // Unsnapped - mark for deletion
                newGates[draggingGate] = { 
                    ...newGates[draggingGate], 
                    x: pos.x, 
                    y: pos.y,
                    attachedRunId: null,
                    snapPositionFt: null,
                    snapPositionPercent: null,
                    pendingSnap: null,
                    rotationRad: newGates[draggingGate].rotationRad || 0,
                    pendingDelete: wasSnapped
                };
            }
            
            setGates(newGates);
            
            // Trigger real-time post layout refresh
            if (typeof window !== 'undefined' && window.refreshPostLayout) {
                requestAnimationFrame(() => window.refreshPostLayout());
            }
            return;
        }

        if (draggingDoubleGate !== null) {
            const newDoubleGates = [...doubleGates];
            const gate = newDoubleGates[draggingDoubleGate];
            const snapInfo = findClosestFenceLine(pos);
            
            const wasSnapped = gate.attachedRunId !== null && gate.attachedRunId !== undefined;
            const isNowSnapped = snapInfo !== null;
            
            if (snapInfo) {
                const line = fenceLines[snapInfo.lineIdx];
                const rotationRad = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
                const gateWidthFt = parseFloat(gate.width?.replace(/'/g, '')) || 8;
                
                // Calculate gate post positions
                const dx = line.end.x - line.start.x;
                const dy = line.end.y - line.start.y;
                const linePixels = Math.sqrt(dx * dx + dy * dy);
                const lineFeet = line.manualLengthFt || line.length || 0;
                
                if (linePixels > 0 && lineFeet > 0) {
                    const pixelsPerFt = linePixels / lineFeet;
                    const dirX = dx / linePixels;
                    const dirY = dy / linePixels;
                    const centerFt = snapInfo.snapPositionFt;
                    const halfWidthFt = gateWidthFt / 2;
                    
                    const post1DistPixels = (centerFt - halfWidthFt) * pixelsPerFt;
                    const post2DistPixels = (centerFt + halfWidthFt) * pixelsPerFt;
                    
                    const gatePost1 = {
                        x: line.start.x + dirX * post1DistPixels,
                        y: line.start.y + dirY * post1DistPixels
                    };
                    const gatePost2 = {
                        x: line.start.x + dirX * post2DistPixels,
                        y: line.start.y + dirY * post2DistPixels
                    };
                    
                    // Find posts to snap to (end/corner only) - includes perfect fit detection
                    console.log('[FenceCanvas] Double gate - posts:', jobPosts?.length, 'gatePost1:', gatePost1, 'gatePost2:', gatePost2);
                    const snapResult = findGatePostSnaps(jobPosts, gatePost1, gatePost2, line, gateWidthFt);
                    console.log('[FenceCanvas] Double gate snap result:', snapResult);
                    
                    // Apply snapping if perfect fit OR nearby terminal posts found
                    let finalGateCenter = { centerX: snapInfo.snapPoint.x, centerY: snapInfo.snapPoint.y, centerFt: snapInfo.snapPositionFt };
                    
                    if (snapResult.isPerfectFit || snapResult.post1Snap || snapResult.post2Snap) {
                        console.log('[FenceCanvas] Applying snap for double gate');
                        const applied = applyGatePostSnapping(gatePost1, gatePost2, snapResult);
                        finalGateCenter = calculateSnappedGateCenter(
                            { ...gate, x: snapInfo.snapPoint.x, y: snapInfo.snapPoint.y, width: gate.width },
                            line,
                            snapResult
                        );
                        console.log('[FenceCanvas] Final center for double gate:', finalGateCenter);
                    }
                    // Otherwise: free movement, use original gate center
                    
                    // Update gate with final position
                    newDoubleGates[draggingDoubleGate] = { 
                        ...newDoubleGates[draggingDoubleGate], 
                        x: finalGateCenter.centerX, 
                        y: finalGateCenter.centerY,
                        attachedRunId: snapInfo.lineIdx,
                        snapPositionFt: finalGateCenter.centerFt,
                        snapPositionPercent: (finalGateCenter.centerFt / lineFeet) * 100,
                        rotationRad: rotationRad,
                        pendingSnap: snapInfo,
                        pendingDelete: false,
                        snapResult: snapResult, // Store for mouseUp processing
                        isPerfectFit: snapResult.isPerfectFit
                    };
                }
            } else {
                // Unsnapped - mark for deletion
                newDoubleGates[draggingDoubleGate] = { 
                    ...newDoubleGates[draggingDoubleGate], 
                    x: pos.x, 
                    y: pos.y,
                    attachedRunId: null,
                    snapPositionFt: null,
                    snapPositionPercent: null,
                    pendingSnap: null,
                    rotationRad: newDoubleGates[draggingDoubleGate].rotationRad || 0,
                    pendingDelete: wasSnapped
                };
            }
            
            setDoubleGates(newDoubleGates);
            
            // Trigger real-time post layout refresh
            if (typeof window !== 'undefined' && window.refreshPostLayout) {
                requestAnimationFrame(() => window.refreshPostLayout());
            }
            return;
        }

        // Update end posts when attached line is dragged
        if (draggingRun) {
            const actualDx = pos.x - draggingRun.startPos.x;
            const actualDy = pos.y - draggingRun.startPos.y;
            
            setEndPosts(prev => prev.map(endPost => {
                if (endPost.attachedRunId === draggingRun.index) {
                    const param = endPost.snapPositionPercent ? endPost.snapPositionPercent / 100 : 0.5;
                    const newStart = {
                        x: draggingRun.initialStart.x + actualDx,
                        y: draggingRun.initialStart.y + actualDy
                    };
                    const newEnd = {
                        x: draggingRun.initialEnd.x + actualDx,
                        y: draggingRun.initialEnd.y + actualDy
                    };
                    return {
                        ...endPost,
                        x: newStart.x + param * (newEnd.x - newStart.x),
                        y: newStart.y + param * (newEnd.y - newStart.y)
                    };
                }
                return endPost;
            }));
        }

        if (draggingRun) {
            const dx = pos.x - draggingRun.startPos.x;
            const dy = pos.y - draggingRun.startPos.y;
            
            // Calculate new positions
            let newStart = {
                x: draggingRun.initialStart.x + dx,
                y: draggingRun.initialStart.y + dy
            };
            let newEnd = {
                x: draggingRun.initialEnd.x + dx,
                y: draggingRun.initialEnd.y + dy
            };

            // Find snap target
            const snapTarget = findRunSnapTarget(draggingRun.index, newStart, newEnd);
            setSnapTarget(snapTarget);

            // Apply snap correction
            if (snapTarget) {
                const correction = applySnapCorrection(
                    { start: newStart, end: newEnd },
                    snapTarget,
                    dx,
                    dy
                );

                if (snapTarget.type === 'parallel' && correction.angleCorrection) {
                    // Rotate around center
                    const cos = Math.cos(correction.angleCorrection);
                    const sin = Math.sin(correction.angleCorrection);
                    
                    const startDx = newStart.x - correction.centerX;
                    const startDy = newStart.y - correction.centerY;
                    newStart = {
                        x: correction.centerX + (startDx * cos - startDy * sin),
                        y: correction.centerY + (startDx * sin + startDy * cos)
                    };
                    
                    const endDx = newEnd.x - correction.centerX;
                    const endDy = newEnd.y - correction.centerY;
                    newEnd = {
                        x: correction.centerX + (endDx * cos - endDy * sin),
                        y: correction.centerY + (endDx * sin + endDy * cos)
                    };
                } else {
                    // Translate correction
                    const finalDx = correction.dx;
                    const finalDy = correction.dy;
                    newStart = {
                        x: draggingRun.initialStart.x + finalDx,
                        y: draggingRun.initialStart.y + finalDy
                    };
                    newEnd = {
                        x: draggingRun.initialEnd.x + finalDx,
                        y: draggingRun.initialEnd.y + finalDy
                    };
                }
            }

            // Update fence line
            const newLines = [...fenceLines];
            newLines[draggingRun.index] = {
                ...newLines[draggingRun.index],
                start: newStart,
                end: newEnd,
                length: calculateDistance(newStart, newEnd)
            };
            setFenceLines(newLines);

            // Move attached gates with the run
            const actualDx = newStart.x - draggingRun.initialStart.x;
            const actualDy = newStart.y - draggingRun.initialStart.y;

            setGates(prev => prev.map(gate => {
                if (gate.attachedRunId === draggingRun.index) {
                    // Calculate gate's relative position on the line
                    const param = gate.snapPositionPercent ? gate.snapPositionPercent / 100 : 0.5;
                    // Recalculate rotation from new line orientation
                    const rotationRad = Math.atan2(newEnd.y - newStart.y, newEnd.x - newStart.x);
                    return {
                        ...gate,
                        x: newStart.x + param * (newEnd.x - newStart.x),
                        y: newStart.y + param * (newEnd.y - newStart.y),
                        rotationRad: rotationRad
                    };
                }
                return gate;
            }));

            setDoubleGates(prev => prev.map(gate => {
                if (gate.attachedRunId === draggingRun.index) {
                    const param = gate.snapPositionPercent ? gate.snapPositionPercent / 100 : 0.5;
                    // Recalculate rotation from new line orientation
                    const rotationRad = Math.atan2(newEnd.y - newStart.y, newEnd.x - newStart.x);
                    return {
                        ...gate,
                        x: newStart.x + param * (newEnd.x - newStart.x),
                        y: newStart.y + param * (newEnd.y - newStart.y),
                        rotationRad: rotationRad
                    };
                }
                return gate;
            }));

            return;
        }

        if (draggingPoint) {
            const newLines = [...fenceLines];
            const line = newLines[draggingPoint.lineIdx];
            const pointKey = draggingPoint.pointIdx === 0 ? 'start' : 'end';
            line[pointKey] = pos;
            line.length = calculateDistance(line.start, line.end);
            setFenceLines(newLines);
            
            if (!dragStartState) {
                setDragStartState({ fenceLines: [...fenceLines] });
            }
            
            // Update gate VISUAL positions only - preserve their snapPositionFt (measurement position)
            const lineIdx = draggingPoint.lineIdx;
            const newLineVec = { x: line.end.x - line.start.x, y: line.end.y - line.start.y };
            const newLinePixelLength = Math.sqrt(newLineVec.x * newLineVec.x + newLineVec.y * newLineVec.y);
            
            // Use manual length if set, otherwise use drawn length
            const effectiveLengthFt = (line.manualLengthFt && line.manualLengthFt > 0) 
                ? line.manualLengthFt 
                : line.length;
            
            // Recalculate line rotation for gates
            const lineRotationRad = Math.atan2(newLineVec.y, newLineVec.x);
            
            const newGates = gates.map((gate, idx) => {
                if (gate.attachedRunId === lineIdx && gate.snapPositionFt !== null) {
                    // Keep gate position in FEET constant, update visual position and rotation
                    const param = gate.snapPositionFt / effectiveLengthFt;
                    return {
                        ...gate,
                        x: line.start.x + param * newLineVec.x,
                        y: line.start.y + param * newLineVec.y,
                        snapPositionPercent: param * 100,
                        rotationRad: lineRotationRad
                    };
                }
                return gate;
            });
            setGates(newGates);
            
            const newDoubleGates = doubleGates.map((gate, idx) => {
                if (gate.attachedRunId === lineIdx && gate.snapPositionFt !== null) {
                    // Keep gate position in FEET constant, update visual position and rotation
                    const param = gate.snapPositionFt / effectiveLengthFt;
                    return {
                        ...gate,
                        x: line.start.x + param * newLineVec.x,
                        y: line.start.y + param * newLineVec.y,
                        snapPositionPercent: param * 100,
                        rotationRad: lineRotationRad
                    };
                }
                return gate;
            });
            setDoubleGates(newDoubleGates);
            
            return;
        }

        if (currentLine) {
            // Check for snap to existing endpoint
            const snapPoint = findNearestEndpoint(pos);
            setCurrentLine({ ...currentLine, end: snapPoint || pos });
        }

        const hovered = findHoveredPoint(pos);
        setHoveredPoint(hovered);
    };

    const handleMouseUp = (e) => {
        // Remove touch from active touches
        if (e.pointerType === 'touch') {
            setActiveTouches(prev => prev.filter(t => t.id !== e.pointerId));
            setPinchDistance(null);
        }

        // Reset pan state
        if (isPanning) {
            setIsPanning(false);
            setPanStartPos(null);
            return;
        }

        // Release pointer capture
        if (e.pointerId !== undefined && isDraggingItem) {
            try {
                e.target.releasePointerCapture(e.pointerId);
            } catch (err) {
                // Ignore if already released
            }
        }

        const pos = getMousePos(e);

        // Determine if this was a click (minimal movement) or a drag
        const wasClick = pointerGesture && !pointerGesture.didDrag;
        const clickedOnItem = pointerGesture && pointerGesture.targetType !== null;

        // Complete marquee selection
        if (isMarqueeSelecting && marqueeStart && marqueeEnd) {
            const x1 = Math.min(marqueeStart.x, marqueeEnd.x);
            const y1 = Math.min(marqueeStart.y, marqueeEnd.y);
            const x2 = Math.max(marqueeStart.x, marqueeEnd.x);
            const y2 = Math.max(marqueeStart.y, marqueeEnd.y);
            
            const intersectedItems = [];
            
            // Check lines
            fenceLines.forEach((line, i) => {
                const lx1 = Math.min(line.start.x, line.end.x);
                const ly1 = Math.min(line.start.y, line.end.y);
                const lx2 = Math.max(line.start.x, line.end.x);
                const ly2 = Math.max(line.start.y, line.end.y);
                if (!(lx2 < x1 || lx1 > x2 || ly2 < y1 || ly1 > y2)) {
                    intersectedItems.push({ type: 'line', index: i });
                }
            });
            
            // Check houses
            houses.forEach((house, i) => {
                if (!(house.x + house.width < x1 || house.x > x2 || house.y + house.height < y1 || house.y > y2)) {
                    intersectedItems.push({ type: 'house', index: i });
                }
            });
            
            // Check trees
            trees.forEach((tree, i) => {
                if (tree.x >= x1 && tree.x <= x2 && tree.y >= y1 && tree.y <= y2) {
                    intersectedItems.push({ type: 'tree', index: i });
                }
            });
            
            // Check gates
            gates.forEach((gate, i) => {
                if (gate.x >= x1 && gate.x <= x2 && gate.y >= y1 && gate.y <= y2) {
                    intersectedItems.push({ type: 'gate', index: i });
                }
            });
            
            // Check double gates
            doubleGates.forEach((gate, i) => {
                if (gate.x >= x1 && gate.x <= x2 && gate.y >= y1 && gate.y <= y2) {
                    intersectedItems.push({ type: 'doubleGate', index: i });
                }
            });
            
            // Check annotations
            if (annotations) {
                annotations.forEach((ann, i) => {
                    if (ann.type === 'callout') {
                        if (!(ann.box.x + ann.box.w < x1 || ann.box.x > x2 || ann.box.y + ann.box.h < y1 || ann.box.y > y2)) {
                            intersectedItems.push({ type: 'annotation', index: i });
                        }
                    }
                });
            }
            
            // Apply selection based on modifier
            if (e.shiftKey) {
                // Union (add to selection)
                const combined = [...selectedItems];
                intersectedItems.forEach(newItem => {
                    if (!combined.some(existing => existing.type === newItem.type && existing.index === newItem.index)) {
                        combined.push(newItem);
                    }
                });
                setSelectedItems(combined);
            } else if (e.altKey) {
                // Subtract from selection
                const filtered = selectedItems.filter(existing => 
                    !intersectedItems.some(newItem => newItem.type === existing.type && newItem.index === existing.index)
                );
                setSelectedItems(filtered);
            } else {
                // Replace selection
                setSelectedItems(intersectedItems);
            }
            
            setIsMarqueeSelecting(false);
            setMarqueeStart(null);
            setMarqueeEnd(null);
            setSelectedItem(null);
            return;
        }
        
        // Handle click vs drag completion
        if (wasClick && tool === "select" && !resizingStructure && !draggingAnnotation && !draggingTailTip && !rotatingArrow && !resizingCallout && !resizingArrow) {
            // Was a click (not a drag)
            if (clickedOnItem) {
                // Clicked on an item - keep it selected (already set in mouseDown)
                // Do nothing - selection already happened in mouseDown
                console.log('[FenceCanvas] Click on item - keeping selection:', pointerGesture.targetType, pointerGesture.targetIndex);
            } else {
                // Clicked on empty space - check for fence line click or deselect
                
                // Check if clicked on fence line - trigger assignment dialog
                let foundFenceLine = false;
                for (let i = 0; i < fenceLines.length; i++) {
                    const line = fenceLines[i];
                    const distToStart = getDistance(pos, line.start);
                    const distToEnd = getDistance(pos, line.end);
                    const distToLine = pointToLineDistance(pos, line.start, line.end);
                    
                    if (distToLine < 10 && distToStart > 15 && distToEnd > 15) {
                        // Trigger assignment dialog via callback
                        if (onLineClick) {
                            onLineClick(i);
                        }
                        foundFenceLine = true;
                        break;
                    }
                }
                
                if (!foundFenceLine) {
                    // Clicked empty space - clear selection
                    setSelectedItem(null);
                    setSelectedItems([]);
                }
            }
        } else if (wasClick && clickedOnItem) {
            // Was a click on an item (even in non-select mode) - keep selection
            console.log('[FenceCanvas] Click on item (non-select mode) - keeping selection');
        } else if (!wasClick && clickedOnItem) {
            // Was a drag on an item - keep selection
            console.log('[FenceCanvas] Drag complete on item - keeping selection');
        }

        // Save history at end of drag/transform operation
        if (dragStartState && isDragging && onSaveHistory) {
            onSaveHistory();
        }
        setDragStartState(null);
        setMouseDownPos(null);
        setIsDragging(false);

        if (currentLine && (tool === "fence" || tool === "existing-fence")) {
          // Snap end point to nearest endpoint if close
          const snapPoint = findNearestEndpoint(currentLine.end);
          const finalEnd = snapPoint || currentLine.end;

          const isExistingFence = tool === "existing-fence";
          const drawnLengthFt = calculateDistance(currentLine.start, finalEnd);
          
          const newLine = {
              lineId: crypto.randomUUID(), // Stable ID for persistence
              start: currentLine.start,
              end: finalEnd,
              length: drawnLengthFt,
              isExisting: isExistingFence,
              tearOut: false,
              isPerimeter: !isExistingFence,
              runStatus: isExistingFence ? 'existing' : 'new',
              orientationLabel: null,
              orientationMode: 'auto',
              assignedRunId: null // Initialize as unassigned
          };
          const newLines = [...fenceLines, newLine];
          setFenceLines(newLines);
          setCurrentLine(null);

          // Auto-select the newly created line
          const newLineIndex = newLines.length - 1;
          setSelectedItem({ type: 'line', index: newLineIndex });
          
          // Auto-open +Run flow for NEW fences only
          if (!isExistingFence && onLineDrawComplete) {
            onLineDrawComplete({
              lineIndex: newLineIndex,
              drawnLengthFt: drawnLengthFt,
              line: newLine
            });
          }
      }

      // Handle gate placement/deletion in database
      if (draggingGate !== null && onGatePlaced) {
          const gate = gates[draggingGate];
          
          if (gate?.pendingDelete && gate?.dbGateId) {
              // Gate was unsnapped - delete from database
              onGatePlaced({
                  shouldDelete: true,
                  dbGateId: gate.dbGateId
              });
          } else if (gate?.attachedRunId !== null && gate?.attachedRunId !== undefined) {
              const fenceLine = fenceLines[gate.attachedRunId];
              const runId = fenceLine?.assignedRunId;
              
              // Always call onGatePlaced when gate is snapped (even without runId for tracking)
              onGatePlaced({
                  gateType: 'Single',
                  widthFt: parseFloat(gate.width?.replace(/'/g, '')) || 4,
                  runId: runId || null, // Can be null if line not assigned yet
                  centerDistance_ft: gate.snapPositionFt,
                  fenceLineId: gate.attachedRunId,
                  dbGateId: gate.dbGateId,
                  onCreated: (newGateId) => {
                      // Link canvas gate to DB gate
                      const updatedGates = [...gates];
                      updatedGates[draggingGate] = {
                          ...updatedGates[draggingGate],
                          dbGateId: newGateId,
                          pendingDelete: false
                      };
                      setGates(updatedGates);
                  }
              });
          }
      }
      
      if (draggingDoubleGate !== null && onGatePlaced) {
          const gate = doubleGates[draggingDoubleGate];
          
          if (gate?.pendingDelete && gate?.dbGateId) {
              // Gate was unsnapped - delete from database
              onGatePlaced({
                  shouldDelete: true,
                  dbGateId: gate.dbGateId
              });
          } else if (gate?.attachedRunId !== null && gate?.attachedRunId !== undefined) {
              const fenceLine = fenceLines[gate.attachedRunId];
              const runId = fenceLine?.assignedRunId;
              
              // Always call onGatePlaced when gate is snapped (even without runId for tracking)
              onGatePlaced({
                  gateType: 'Double',
                  widthFt: parseFloat(gate.width?.replace(/'/g, '')) || 8,
                  runId: runId || null, // Can be null if line not assigned yet
                  centerDistance_ft: gate.snapPositionFt,
                  fenceLineId: gate.attachedRunId,
                  dbGateId: gate.dbGateId,
                  onCreated: (newGateId) => {
                      // Link canvas gate to DB gate
                      const updatedDoubleGates = [...doubleGates];
                      updatedDoubleGates[draggingDoubleGate] = {
                          ...updatedDoubleGates[draggingDoubleGate],
                          dbGateId: newGateId,
                          pendingDelete: false
                      };
                      setDoubleGates(updatedDoubleGates);
                  }
              });
          }
      }

      setDraggingPoint(null);
      setDraggingRun(null);
      setSnapTarget(null);
      setDraggingTree(null);
      setDraggingGate(null);
      setDraggingDoubleGate(null);
      setDraggingHouse(null);
      setDraggingPool(null);
      setDraggingGarage(null);
      setDraggingDog(null);
      setDraggingDriveway(null);
      setDraggingDeck(null);
      setDraggingBush(null);
      setDraggingPorch(null);
      setDraggingGrass(null);
      setDraggingEndPost(null);
      setDraggingBed(null);
      setResizingStructure(null);
      setRotatingHouse(null);
      setDraggingAnnotation(null);
      setDraggingTailTip(null);
      setRotatingArrow(null);
      setResizingCallout(null);
      setResizingArrow(null);
      setScalingItem(null);
      setSnapIndicator(null);
      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
      setIsGroupDragging(false);
      setGroupDragStart(null);
      setPointerGesture(null);
      };

    const pointToLineDistance = (point, lineStart, lineEnd) => {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    };

    return (
        <div 
            ref={containerRef}
            className="w-full h-[60vh] sm:h-[70vh] lg:h-[750px] bg-slate-100"
            style={{ 
                position: 'relative',
                overflow: 'hidden',
                touchAction: 'none',
                paddingLeft: 'max(0px, env(safe-area-inset-left))',
                paddingRight: 'max(0px, env(safe-area-inset-right))',
                paddingBottom: 'max(0px, env(safe-area-inset-bottom))'
            }}
        >
            <canvas
                ref={canvasRef}
                className={surfaceMountMode ? "cursor-pointer bg-slate-50" : "cursor-crosshair bg-slate-50"}
                onPointerDown={handleMouseDown}
                onPointerMove={handleMouseMove}
                onPointerUp={handleMouseUp}
                onPointerCancel={handleMouseUp}
                style={{ 
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    display: 'block',
                    cursor: surfaceMountMode ? 'pointer' : (interactionMode === 'pan' ? 'grab' : 'crosshair')
                }}
                />

                {/* Custom Scrollbars */}
                <div
                style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    width: '20px',
                    height: 'calc(100% - 20px)',
                    background: '#E2E8F0',
                    borderLeft: '1px solid #CBD5E1'
                }}
                onPointerDown={(e) => {
                    setDraggingScrollbar({ type: 'vertical', startY: e.clientY, startCameraY: cameraY });
                    e.currentTarget.setPointerCapture(e.pointerId);
                    e.preventDefault();
                }}
                onPointerMove={(e) => {
                    if (draggingScrollbar?.type === 'vertical') {
                        const dy = e.clientY - draggingScrollbar.startY;
                        const containerHeight = containerRef.current.getBoundingClientRect().height - 20;
                        const worldHeight = 1500;
                        const viewportHeight = containerHeight / zoom;
                        const maxScroll = Math.max(0, worldHeight - viewportHeight);
                        
                        const scrollDelta = (dy / containerHeight) * worldHeight;
                        const newCameraY = Math.max(0, Math.min(maxScroll, draggingScrollbar.startCameraY + scrollDelta));
                        setCameraY(newCameraY);
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }}
                onPointerUp={(e) => {
                    if (draggingScrollbar?.type === 'vertical') {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                        setDraggingScrollbar(null);
                    }
                }}
                >
                <div
                    style={{
                        position: 'absolute',
                        top: `${(cameraY / 1500) * 100}%`,
                        left: 0,
                        width: '100%',
                        height: `${Math.max(20, (containerRef.current?.getBoundingClientRect().height / zoom / 1500) * 100)}%`,
                        background: '#64748B',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                />
                </div>

                <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: 'calc(100% - 20px)',
                    height: '20px',
                    background: '#E2E8F0',
                    borderTop: '1px solid #CBD5E1'
                }}
                onPointerDown={(e) => {
                    setDraggingScrollbar({ type: 'horizontal', startX: e.clientX, startCameraX: cameraX });
                    e.currentTarget.setPointerCapture(e.pointerId);
                    e.preventDefault();
                }}
                onPointerMove={(e) => {
                    if (draggingScrollbar?.type === 'horizontal') {
                        const dx = e.clientX - draggingScrollbar.startX;
                        const containerWidth = containerRef.current.getBoundingClientRect().width - 20;
                        const worldWidth = 2000;
                        const viewportWidth = containerWidth / zoom;
                        const maxScroll = Math.max(0, worldWidth - viewportWidth);
                        
                        const scrollDelta = (dx / containerWidth) * worldWidth;
                        const newCameraX = Math.max(0, Math.min(maxScroll, draggingScrollbar.startCameraX + scrollDelta));
                        setCameraX(newCameraX);
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }}
                onPointerUp={(e) => {
                    if (draggingScrollbar?.type === 'horizontal') {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                        setDraggingScrollbar(null);
                    }
                }}
                >
                <div
                    style={{
                        position: 'absolute',
                        left: `${(cameraX / 2000) * 100}%`,
                        top: 0,
                        width: `${Math.max(20, (containerRef.current?.getBoundingClientRect().width / zoom / 2000) * 100)}%`,
                        height: '100%',
                        background: '#64748B',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                />
                </div>
            
            {/* Editable text overlay for callouts */}
            {editingAnnotation !== null && annotations[editingAnnotation]?.type === 'callout' && (
                <textarea
                    autoFocus
                    value={annotations[editingAnnotation].text || ''}
                    onChange={(e) => {
                        const newAnnotations = [...annotations];
                        newAnnotations[editingAnnotation] = {
                            ...newAnnotations[editingAnnotation],
                            text: e.target.value,
                            updatedAt: new Date().toISOString()
                        };
                        if (setAnnotations) {
                            setAnnotations(newAnnotations);
                        }
                    }}
                    onBlur={() => setEditingAnnotation(null)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        left: `${annotations[editingAnnotation].box.x}px`,
                        top: `${annotations[editingAnnotation].box.y}px`,
                        width: `${annotations[editingAnnotation].box.w}px`,
                        height: `${annotations[editingAnnotation].box.h}px`,
                        fontSize: `${annotations[editingAnnotation].style?.fontSize || 14}px`,
                        fontWeight: annotations[editingAnnotation].style?.bold ? 'bold' : 'normal',
                        padding: '8px',
                        border: '2px solid #3B82F6',
                        borderRadius: '4px',
                        backgroundColor: annotations[editingAnnotation].style?.bg || '#FFFFFF',
                        color: '#1E293B',
                        resize: 'none',
                        outline: 'none',
                        fontFamily: 'sans-serif',
                        zIndex: 100,
                        overflow: 'auto'
                    }}
                    placeholder="Type note..."
                />
            )}
        </div>
    );
    }