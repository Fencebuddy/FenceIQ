import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MousePointer, Minus, Trash2, RotateCcw, DoorOpen, Undo, Settings, Redo, RotateCw, Plus, MessageSquare, Layers, Move, Grid3x3, Maximize2, Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import RunPropertiesPanel from "./RunPropertiesPanel";

export default function Toolbar({ tool, setTool, selectedItem, fenceLines, setFenceLines, trees, setTrees, onUndo, onRedo, canUndo, canRedo, setSelectedItem, runs = [], singleGateWidth, setSingleGateWidth, doubleGateWidth, setDoubleGateWidth, rotation = 0, setRotation, spanOverlay = false, setSpanOverlay, showNewOnly = true, setShowNewOnly, showExisting = false, setShowExisting, showSpanLabels = true, setShowSpanLabels, jobId, onDeleteRun, onDeleteAllRuns, rendererConfig, materialType, zoom, setZoom, surfaceMountMode = false, setSurfaceMountMode }) {
    // Always call hooks in same order - before any early returns
    const [lengthInput, setLengthInput] = React.useState("");
    const [showRunProperties, setShowRunProperties] = React.useState(false);
    const [isYardLayoutOpen, setIsYardLayoutOpen] = React.useState(true);
    const [selectedItemsCount, setSelectedItemsCount] = React.useState(0);
    
    React.useEffect(() => {
        const interval = setInterval(() => {
            if (typeof window !== 'undefined' && window.selectedItems) {
                setSelectedItemsCount(window.selectedItems.length);
            }
        }, 100);
        return () => clearInterval(interval);
    }, []);
    
    // Update local input when selected item changes
    React.useEffect(() => {
        if (selectedItem?.type === 'line' && fenceLines[selectedItem.index]) {
            const line = fenceLines[selectedItem.index];
            if (line.manualLengthFt && line.manualLengthFt > 0) {
                setLengthInput(line.manualLengthFt.toFixed(1));
            } else {
                setLengthInput(""); // Empty until user inputs
            }
        }
    }, [selectedItem, fenceLines]);
    
    // Calculate total footage (only lines with manual length set, exclude existing and tear out)
    const totalFootage = fenceLines
        .filter(line => !line.isExisting && !line.tearOut && line.manualLengthFt && line.manualLengthFt > 0)
        .reduce((sum, line) => sum + line.manualLengthFt, 0);
    const handleDelete = async () => {
        if (!selectedItem) return;

        if (selectedItem.type === 'line') {
            const line = fenceLines[selectedItem.index];
            
            // Delete associated run from database if assigned
            if (line?.assignedRunId && onDeleteRun) {
                await onDeleteRun(line.assignedRunId);
            }
            
            const newLines = fenceLines.filter((_, idx) => idx !== selectedItem.index);
            setFenceLines(newLines);

            // Clear any gates attached to this line
            if (typeof window !== 'undefined') {
                if (window.clearGatesOnLine) {
                    window.clearGatesOnLine(selectedItem.index);
                }
            }
        } else if (selectedItem.type === 'gate' || selectedItem.type === 'doubleGate' || selectedItem.type === 'tree' || selectedItem.type === 'dog' || selectedItem.type === 'house' || selectedItem.type === 'pool' || selectedItem.type === 'garage' || selectedItem.type === 'driveway' || selectedItem.type === 'deck' || selectedItem.type === 'bush' || selectedItem.type === 'porch' || selectedItem.type === 'grass' || selectedItem.type === 'annotation') {
            if (typeof window !== 'undefined' && window.deleteItem) {
                window.deleteItem(selectedItem.type, selectedItem.index);
            }
        }
        setSelectedItem(null);
    };

    const cycleLineType = () => {
        if (!selectedItem || selectedItem.type !== 'line') return;

        const newLines = [...fenceLines];
        const line = newLines[selectedItem.index];
        
        // Get current status
        const currentStatus = line.runStatus || (line.isExisting ? 'existing' : (line.tearOut ? 'remove' : 'new'));
        
        // Cycle through: New -> Existing -> Remove -> New
        let newStatus;
        if (currentStatus === 'new') {
            newStatus = 'existing';
        } else if (currentStatus === 'existing') {
            newStatus = 'remove';
        } else {
            newStatus = 'new';
        }
        
        // Update both runStatus and legacy fields
        line.runStatus = newStatus;
        line.isExisting = (newStatus === 'existing');
        line.tearOut = (newStatus === 'remove');
        
        setFenceLines(newLines);
    };

    const handleRotate = () => {
        if (!selectedItem) return;
        if (typeof window !== 'undefined' && window.rotateItem) {
            window.rotateItem(selectedItem.type, selectedItem.index);
        }
    };

    const handleFitToDrawing = () => {
        if (fenceLines.length === 0) return;
        
        // Calculate bounding box of all fence lines
        const allPoints = [];
        fenceLines.forEach(line => {
            allPoints.push({ x: line.start?.x || line.x1, y: line.start?.y || line.y1 });
            allPoints.push({ x: line.end?.x || line.x2, y: line.end?.y || line.y2 });
        });
        
        if (allPoints.length === 0) return;
        
        const minX = Math.min(...allPoints.map(p => p.x));
        const minY = Math.min(...allPoints.map(p => p.y));
        const maxX = Math.max(...allPoints.map(p => p.x));
        const maxY = Math.max(...allPoints.map(p => p.y));
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        if (width > 0 && height > 0) {
            // Get viewport size
            const viewportWidth = Math.min(window.innerWidth - 40, 800);
            const viewportHeight = 750;
            
            // Calculate scale to fit with 10% padding
            const scaleX = viewportWidth / width;
            const scaleY = viewportHeight / height;
            const fitZoom = Math.min(scaleX, scaleY) * 0.90;
            
            // Clamp zoom to reasonable range
            const targetZoom = Math.max(0.5, Math.min(3, fitZoom));
            
            setZoom(targetZoom);
            
            console.log('Fit to drawing:', { width, height, targetZoom });
        }
    };

    const handleClear = async () => {
        if (window.confirm("Clear everything? This will remove all items from the map and delete all runs from the database.")) {
            // Delete all runs from database
            if (onDeleteAllRuns) {
                await onDeleteAllRuns();
            }
            
            setFenceLines([]);
            setTrees([]);
            if (typeof window !== 'undefined' && window.deleteItem) {
                // Get current counts from window
                const gateCount = window.gates?.length || 0;
                const doubleGateCount = window.doubleGates?.length || 0;
                const houseCount = window.houses?.length || 0;
                const poolCount = window.pools?.length || 0;
                const garageCount = window.garages?.length || 0;
                const dogCount = window.dogs?.length || 0;
                const drivewayCount = window.driveways?.length || 0;
                const deckCount = window.decks?.length || 0;
                const bushCount = window.bushes?.length || 0;

                // Delete all items in reverse order to avoid index shifting issues
                for (let i = gateCount - 1; i >= 0; i--) {
                    window.deleteItem('gate', i);
                }
                for (let i = doubleGateCount - 1; i >= 0; i--) {
                    window.deleteItem('doubleGate', i);
                }
                for (let i = houseCount - 1; i >= 0; i--) {
                    window.deleteItem('house', i);
                }
                for (let i = poolCount - 1; i >= 0; i--) {
                    window.deleteItem('pool', i);
                }
                for (let i = garageCount - 1; i >= 0; i--) {
                    window.deleteItem('garage', i);
                }
                for (let i = dogCount - 1; i >= 0; i--) {
                    window.deleteItem('dog', i);
                }
                for (let i = drivewayCount - 1; i >= 0; i--) {
                    window.deleteItem('driveway', i);
                }
                for (let i = deckCount - 1; i >= 0; i--) {
                    window.deleteItem('deck', i);
                }
                for (let i = bushCount - 1; i >= 0; i--) {
                    window.deleteItem('bush', i);
                }
                const porchCount = window.porches?.length || 0;
                for (let i = porchCount - 1; i >= 0; i--) {
                    window.deleteItem('porch', i);
                }
                const grassCount = window.grasses?.length || 0;
                for (let i = grassCount - 1; i >= 0; i--) {
                    window.deleteItem('grass', i);
                }
                const endPostCount = window.endPosts?.length || 0;
                for (let i = endPostCount - 1; i >= 0; i--) {
                    window.deleteItem('endPost', i);
                }
                }
        }
    };

    const handleLengthInputChange = (value) => {
        setLengthInput(value);
    };
    
    const handleLengthBlur = () => {
        if (!selectedItem || selectedItem.type !== 'line') return;
        const length = parseFloat(lengthInput);
        if (isNaN(length) || length <= 0) {
            // Reset to current value if invalid
            const line = fenceLines[selectedItem.index];
            if (line?.manualLengthFt && line.manualLengthFt > 0) {
                setLengthInput(line.manualLengthFt.toFixed(1));
            } else {
                setLengthInput("");
            }
            return;
        }

        // Update the manual length
        if (typeof window !== 'undefined' && window.updateLineEffectiveLength) {
            window.updateLineEffectiveLength(selectedItem.index, length);
        }
    };

    return (
        <div className="bg-white">
        <Card className="p-3 sm:p-4 border-0 bg-white rounded-none shadow-none">
            {/* Mobile only: show Total New Fence with collapse button */}
            <div className="flex items-center justify-between md:hidden mb-3">
                <div className="text-base font-semibold text-emerald-700">
                    Total: <span className="text-xl">{totalFootage.toFixed(1)}</span> ft
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsYardLayoutOpen(!isYardLayoutOpen)}
                    className="text-xs h-8"
                >
                    {isYardLayoutOpen ? "Hide Tools" : "Show Tools"}
                </Button>
            </div>
            
            {isYardLayoutOpen && (
            <div className="flex flex-col gap-3">
                {/* Yard Layout Tools - Collapsible */}
                <div className="border-b pb-3">
                    <div className="mb-2 hidden sm:block">
                        <h3 className="font-semibold text-sm text-slate-700">Yard Layout Tools</h3>
                    </div>
                        <div className="overflow-x-auto -mx-3 px-3 sm:-mx-4 sm:px-4 lg:mx-0 lg:px-0 scrollbar-hide">
                            <div className="flex gap-2 min-w-max pb-1"
                              style={{
                                WebkitOverflowScrolling: 'touch',
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none'
                              }}>
                        <Button
                            variant={tool === "select" ? "default" : "outline"}
                            onClick={() => {
                                setTool("select");
                                if (typeof window !== 'undefined' && window.setInteractionMode) {
                                    window.setInteractionMode('select');
                                }
                            }}
                            className="gap-2 whitespace-nowrap h-11 sm:h-10 px-4 sm:px-3 text-sm"
                        >
                            <MousePointer className="w-4 h-4" />
                            <span className="hidden sm:inline">Select</span>
                        </Button>
                        <Button
                            variant={typeof window !== 'undefined' && window.interactionMode === 'pan' ? "default" : "outline"}
                            onClick={() => {
                                if (typeof window !== 'undefined' && window.setInteractionMode) {
                                    window.setInteractionMode(window.interactionMode === 'pan' ? 'select' : 'pan');
                                }
                            }}
                            className="gap-2 whitespace-nowrap h-11 sm:h-10 px-4 sm:px-3 text-sm"
                        >
                            <Move className="w-4 h-4" />
                            <span className="hidden sm:inline">Pan</span>
                        </Button>
                        <Button
                            variant={surfaceMountMode ? "default" : "outline"}
                            onClick={() => {
                                if (setSurfaceMountMode) {
                                    setSurfaceMountMode(!surfaceMountMode);
                                    if (!surfaceMountMode) {
                                        setTool("select");
                                    }
                                }
                            }}
                            className={`gap-2 whitespace-nowrap h-11 sm:h-10 px-4 sm:px-3 text-sm ${surfaceMountMode ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                        >
                            <Wrench className="w-4 h-4" />
                            <span className="hidden sm:inline">Surface</span>
                        </Button>
                        <Button
                            onClick={() => setTool("fence")}
                            className={`gap-2 whitespace-nowrap h-11 sm:h-10 px-4 sm:px-3 text-sm ${tool === "fence" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
                        >
                            <Minus className="w-4 h-4" />
                            Fence
                        </Button>
                        <Button
                            onClick={() => setTool("existing-fence")}
                            className={`gap-2 whitespace-nowrap h-11 sm:h-10 px-4 sm:px-3 text-sm ${tool === "existing-fence" ? "bg-slate-500 hover:bg-slate-600 text-white" : "bg-slate-400 hover:bg-slate-500 text-white"}`}
                        >
                            <Minus className="w-4 h-4" />
                            Existing
                        </Button>
                        <Select value={tool.startsWith('object-') ? tool.replace('object-', '') : ''} onValueChange={(value) => setTool(`object-${value}`)}>
                            <SelectTrigger className={`h-11 sm:h-10 w-36 text-sm ${tool.startsWith('object-') ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white'}`}>
                                <SelectValue placeholder="+ Add Object" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="tree">🌳 Tree</SelectItem>
                                <SelectItem value="bush">🌿 Bush</SelectItem>
                                <SelectItem value="house">🏠 House</SelectItem>
                                <SelectItem value="garage">🚗 Garage</SelectItem>
                                <SelectItem value="driveway">🛣️ Driveway</SelectItem>
                                <SelectItem value="deck">🪵 Deck</SelectItem>
                                <SelectItem value="pool">🏊 Pool</SelectItem>
                                <SelectItem value="porch">🪜 Porch</SelectItem>
                                <SelectItem value="grass">🌱 Grass</SelectItem>
                                <SelectItem value="bed">🌺 Bed</SelectItem>
                                <SelectItem value="dog">🐕 Dog</SelectItem>
                                <SelectItem value="endpost">📍 End Post</SelectItem>
                                <SelectItem value="arrow">➡️ Arrow</SelectItem>
                                </SelectContent>
                                </Select>
                                <Button
                                onClick={() => setTool("callout")}
                                className={`gap-2 whitespace-nowrap h-11 sm:h-10 px-4 sm:px-3 text-sm ${tool === "callout" ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}`}
                                >
                                <MessageSquare className="w-4 h-4" />
                                Callout
                                </Button>
                        <div className="flex items-center gap-1">
                            <Button
                                onClick={() => setTool("gate")}
                                className={`gap-2 whitespace-nowrap h-11 sm:h-10 px-4 sm:px-3 text-sm ${tool === "gate" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
                            >
                                <DoorOpen className="w-4 h-4" />
                                Single
                            </Button>
                            <Select value={singleGateWidth} onValueChange={setSingleGateWidth}>
                                <SelectTrigger className="w-16 h-11 sm:h-10 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="4'" className="text-sm">4'</SelectItem>
                                    <SelectItem value="5'" className="text-sm">5'</SelectItem>
                                    <SelectItem value="6'" className="text-sm">6'</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                onClick={() => setTool("doubleGate")}
                                className={`gap-2 whitespace-nowrap h-11 sm:h-10 px-4 sm:px-3 text-sm ${tool === "doubleGate" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
                            >
                                <DoorOpen className="w-4 h-4" />
                                Double
                            </Button>
                            <Select value={doubleGateWidth} onValueChange={setDoubleGateWidth}>
                                <SelectTrigger className="w-16 h-11 sm:h-10 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="8'" className="text-sm">8'</SelectItem>
                                    <SelectItem value="10'" className="text-sm">10'</SelectItem>
                                    <SelectItem value="12'" className="text-sm">12'</SelectItem>
                                </SelectContent>
                            </Select>
                            </div>
                    </div>
                        </div>
                </div>

                {/* Spacing Label Control */}
                <div className="border-b pb-3">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Switch 
                                checked={showSpanLabels} 
                                onCheckedChange={setShowSpanLabels}
                                id="show-labels"
                            />
                            <Label htmlFor="show-labels" className="text-sm font-semibold flex items-center gap-2">
                                <Grid3x3 className="w-4 h-4" />
                                Show Post Spacing ({rendererConfig?.spacing || 8}' max for {materialType})
                            </Label>
                        </div>
                    </div>
                </div>

                {/* Action Buttons Row & Selected Item Controls */}
                <div className="flex flex-wrap gap-2 sm:gap-2">
                    {selectedItem?.type === 'line' && (
                        <>
                            <div className="flex items-center gap-2">
                                  <span className="text-sm text-slate-600">Length:</span>
                                  <input
                                      type="text"
                                      value={lengthInput}
                                      onChange={(e) => handleLengthInputChange(e.target.value)}
                                      onBlur={handleLengthBlur}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                              e.target.blur();
                                          }
                                      }}
                                      onFocus={(e) => e.target.select()}
                                      className="w-20 px-2 py-1 border rounded text-sm"
                                  />
                                  <span className="text-sm text-slate-600">ft</span>
                                  {!fenceLines[selectedItem.index]?.manualLengthFt && (
                                      <span className="text-xs text-red-600 font-semibold">
                                          Required
                                      </span>
                                  )}
                                  </div>
                                  {runs.length > 0 && (
                                  <div className="flex items-center gap-2">
                                      <span className="text-sm text-slate-600">Assign to Run:</span>
                                      <Select 
                                          value={fenceLines[selectedItem.index]?.assignedRunId || "none"} 
                                          onValueChange={(value) => {
                                              const newLines = [...fenceLines];
                                              if (value === "none") {
                                                  newLines[selectedItem.index].assignedRunId = null;
                                              } else if (value === "existing") {
                                                  newLines[selectedItem.index].assignedRunId = null;
                                                  newLines[selectedItem.index].runStatus = 'existing';
                                                  newLines[selectedItem.index].isExisting = true;
                                              } else {
                                                  newLines[selectedItem.index].assignedRunId = value;
                                              }
                                              setFenceLines(newLines);
                                          }}
                                      >
                                          <SelectTrigger className="w-48">
                                              <SelectValue placeholder="Select run..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                              <SelectItem value="none">No Run Assigned</SelectItem>
                                              <SelectItem value="existing">⚪ Existing Fence</SelectItem>
                                              {runs.map(run => (
                                                  <SelectItem key={run.id} value={run.id}>
                                                      {run.runLabel} ({run.materialType} {run.fenceHeight})
                                                  </SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                  </div>
                              )}
                              <Button
                                  variant="outline"
                                  onClick={cycleLineType}
                                  className="gap-2"
                              >
                                  {fenceLines[selectedItem.index]?.tearOut 
                                      ? "Tear Out → New" 
                                      : fenceLines[selectedItem.index]?.isExisting 
                                          ? "Existing → Tear Out" 
                                          : "New → Existing"}
                              </Button>
                              <Button
                                  variant="outline"
                                  onClick={() => setShowRunProperties(true)}
                                  className="gap-2"
                              >
                                  <Settings className="w-4 h-4" />
                                  Properties
                              </Button>
                        </>
                    )}

                    {/* Post Type Selector - for end posts and line posts */}
                    {selectedItem?.type === 'endPost' && (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600">Post Type:</span>
                                <Select 
                                    value={(typeof window !== 'undefined' && window.endPosts && window.endPosts[selectedItem.index]) ? window.endPosts[selectedItem.index].postType || 'end' : 'end'}
                                    onValueChange={(value) => {
                                        if (typeof window !== 'undefined' && window.changeEndPostType) {
                                            window.changeEndPostType(selectedItem.index, value);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="end">End Post</SelectItem>
                                        <SelectItem value="corner">Corner Post</SelectItem>
                                        <SelectItem value="line">Line Post</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600">Color:</span>
                                <Select 
                                    value={(typeof window !== 'undefined' && window.endPosts && window.endPosts[selectedItem.index]) ? window.endPosts[selectedItem.index].color || 'default' : 'default'}
                                    onValueChange={(value) => {
                                        if (typeof window !== 'undefined' && window.changeEndPostColor) {
                                            window.changeEndPostColor(selectedItem.index, value);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Default (by type)</SelectItem>
                                        <SelectItem value="#22C55E">🟢 Green (End)</SelectItem>
                                        <SelectItem value="#DC2626">🔴 Red (Corner)</SelectItem>
                                        <SelectItem value="#3B82F6">🔵 Blue (Line)</SelectItem>
                                        <SelectItem value="#A855F7">🟣 Purple (Gate)</SelectItem>
                                        <SelectItem value="#F59E0B">🟠 Orange</SelectItem>
                                        <SelectItem value="#FBBF24">🟡 Yellow</SelectItem>
                                        <SelectItem value="#14B8A6">🟢 Teal</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                    {selectedItem?.type === 'post' && (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600">Post Type:</span>
                                <Select 
                                    value={(typeof window !== 'undefined' && window.selectedPost) ? window.selectedPost.postType || 'line' : 'line'}
                                    onValueChange={(value) => {
                                        if (typeof window !== 'undefined' && window.changeLinePostType && window.selectedPost) {
                                            window.changeLinePostType(window.selectedPost.lineIdx, window.selectedPost.postPositionFt, value);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="line">Line Post</SelectItem>
                                        <SelectItem value="end">End Post</SelectItem>
                                        <SelectItem value="corner">Corner Post</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600">Color:</span>
                                <Select 
                                    value={(typeof window !== 'undefined' && window.selectedPost) ? window.selectedPost.color || 'default' : 'default'}
                                    onValueChange={(value) => {
                                        if (typeof window !== 'undefined' && window.changeLinePostColor && window.selectedPost) {
                                            window.changeLinePostColor(window.selectedPost.lineIdx, window.selectedPost.postPositionFt, value);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Default (by type)</SelectItem>
                                        <SelectItem value="#22C55E">🟢 Green (End)</SelectItem>
                                        <SelectItem value="#DC2626">🔴 Red (Corner)</SelectItem>
                                        <SelectItem value="#3B82F6">🔵 Blue (Line)</SelectItem>
                                        <SelectItem value="#A855F7">🟣 Purple (Gate)</SelectItem>
                                        <SelectItem value="#F59E0B">🟠 Orange</SelectItem>
                                        <SelectItem value="#FBBF24">🟡 Yellow</SelectItem>
                                        <SelectItem value="#14B8A6">🟢 Teal</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}

                    {/* Delete Button - works for any selected item */}
                    {selectedItem && (
                        <Button
                            variant="outline"
                            onClick={handleDelete}
                            className="gap-2 text-red-600 hover:text-red-700 h-11 sm:h-10 px-4 sm:px-3 text-sm"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </Button>
                    )}

                    {/* Always visible action buttons */}
                    <Button
                        variant="outline"
                        onClick={onUndo}
                        disabled={!canUndo}
                        className="gap-2 h-11 sm:h-10 px-4 sm:px-3 text-sm"
                    >
                        <Undo className="w-4 h-4" />
                        Undo
                    </Button>
                    {onRedo && (
                        <Button
                            variant="outline"
                            onClick={onRedo}
                            disabled={!canRedo}
                            className="gap-2 h-11 sm:h-10 px-4 sm:px-3 text-sm"
                        >
                            <Redo className="w-4 h-4" />
                            Redo
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={handleFitToDrawing}
                        disabled={fenceLines.length === 0}
                        className="gap-2 h-11 sm:h-10 px-4 sm:px-3 text-sm"
                        title="Fit to Drawing"
                    >
                        <Maximize2 className="w-4 h-4" />
                        Fit
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleRotate}
                        disabled={!selectedItem}
                        className="gap-2 h-11 sm:h-10 px-4 sm:px-3 text-sm"
                    >
                        <RotateCw className="w-4 h-4" />
                        Rotate
                    </Button>
                    <Button
                        onClick={handleClear}
                        className="gap-2 bg-red-600 hover:bg-red-700 text-white h-11 sm:h-10 px-4 sm:px-3 text-sm"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Clear
                    </Button>
                    
                    {/* Group/Ungroup buttons */}
                    {selectedItemsCount >= 2 && (
                        <Button
                            onClick={() => {
                                if (typeof window !== 'undefined' && window.groupSelectedItems) {
                                    window.groupSelectedItems();
                                }
                            }}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 sm:h-10 px-4 sm:px-3"
                        >
                            <Layers className="w-4 h-4 mr-2" />
                            Group ({selectedItemsCount})
                        </Button>
                    )}
                    
                    {selectedItem?.type === 'group' && (
                        <Button
                            onClick={() => {
                                if (typeof window !== 'undefined' && window.ungroupSelected) {
                                    window.ungroupSelected();
                                }
                            }}
                            variant="outline"
                            size="sm"
                            className="h-11 sm:h-10 px-4 sm:px-3"
                        >
                            <Layers className="w-4 h-4 mr-2" />
                            Ungroup
                        </Button>
                    )}
                </div>
                
                <div className="mt-3 text-xs sm:text-sm text-slate-600 px-1">
                    {surfaceMountMode && "Click a post to mark as surface mounted"}
                    {!surfaceMountMode && tool === "fence" && "Touch and drag to draw fence lines"}
                    {!surfaceMountMode && tool === "existing-fence" && "Touch and drag to draw existing fence (visual reference only - not included in calculations)"}
                    {!surfaceMountMode && tool === "object-tree" && "Tap to place a tree"}
                    {!surfaceMountMode && tool === "object-bush" && "Tap to place a bush"}
                    {!surfaceMountMode && tool === "object-house" && "Tap to place a house"}
                    {!surfaceMountMode && tool === "object-garage" && "Tap to place a garage"}
                    {!surfaceMountMode && tool === "object-driveway" && "Tap to place a driveway (drag corners to resize)"}
                    {!surfaceMountMode && tool === "object-deck" && "Tap to place a deck (drag corners to resize)"}
                    {!surfaceMountMode && tool === "object-pool" && "Tap to place a pool"}
                    {!surfaceMountMode && tool === "object-porch" && "Tap to place a porch (drag corners to resize)"}
                    {!surfaceMountMode && tool === "object-grass" && "Tap to place a grass area (floats under all items)"}
                    {!surfaceMountMode && tool === "object-bed" && "Click to add vertices · Click first point to finish shape"}
                    {!surfaceMountMode && tool === "object-dog" && "Tap to place a dog"}
                    {!surfaceMountMode && tool === "object-endpost" && "Tap to place an end post marker"}
                    {!surfaceMountMode && tool === "gate" && `Tap to place single gate (${singleGateWidth})`}
                    {!surfaceMountMode && tool === "doubleGate" && `Tap to place double gate (${doubleGateWidth})`}
                    {!surfaceMountMode && tool === "callout" && "Tap to place a text callout with arrow"}
                    {!surfaceMountMode && tool === "arrow" && "Tap to place a red arrow (drag head to rotate)"}
                    {!surfaceMountMode && tool === "select" && "Drag items to reposition · Shift+click to multi-select"}
                </div>

                {showRunProperties && selectedItem?.type === 'line' && fenceLines[selectedItem.index] && (
                    <RunPropertiesPanel
                        line={fenceLines[selectedItem.index]}
                        lineIndex={selectedItem.index}
                        onUpdate={(index, properties) => {
                            if (typeof window !== 'undefined' && window.updateRunProperties) {
                                window.updateRunProperties(index, properties);
                            }
                            setShowRunProperties(false);
                        }}
                        onClose={() => setShowRunProperties(false)}
                    />
                )}
            </div>
            )}
            
            {showRunProperties && selectedItem?.type === 'line' && fenceLines[selectedItem.index] && !isYardLayoutOpen && (
                <RunPropertiesPanel
                    line={fenceLines[selectedItem.index]}
                    lineIndex={selectedItem.index}
                    onUpdate={(index, properties) => {
                        if (typeof window !== 'undefined' && window.updateRunProperties) {
                            window.updateRunProperties(index, properties);
                        }
                        setShowRunProperties(false);
                    }}
                    onClose={() => setShowRunProperties(false)}
                />
            )}
        </Card>
        </div>
    );
}