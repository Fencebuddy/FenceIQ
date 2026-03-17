import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, MapPin, ExternalLink } from "lucide-react";

export default function RunPropertiesPanel({ line, lineIndex, onUpdate, onClose, assignedRun, onJumpToRun }) {
    const [isPerimeter, setIsPerimeter] = React.useState(line.isPerimeter || false);
    const [orientationMode, setOrientationMode] = React.useState(line.orientationMode || 'auto');
    const [orientationLabel, setOrientationLabel] = React.useState(line.orientationLabel || null);
    const [runStatus, setRunStatus] = React.useState(line.runStatus || 'new');

    const handleSave = () => {
        onUpdate(lineIndex, {
            isPerimeter,
            orientationMode,
            orientationLabel: orientationMode === 'manual' ? orientationLabel : line.orientationLabel,
            runStatus,
            isExisting: runStatus === 'existing',
        });
        onClose();
    };

    return (
        <Card className="absolute top-4 right-4 w-80 shadow-xl z-50 border-2 border-emerald-500">
            <CardHeader className="pb-3 bg-emerald-50 border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-emerald-600" />
                        Run Properties
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                {assignedRun && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-emerald-600 font-medium">Assigned to Run</p>
                                <p className="text-sm font-semibold text-emerald-900">{assignedRun.runLabel}</p>
                            </div>
                            {onJumpToRun && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => onJumpToRun(assignedRun.id)}
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                                >
                                    <ExternalLink className="w-4 h-4 mr-1" />
                                    Edit Run
                                </Button>
                            )}
                        </div>
                    </div>
                )}
                
                <div className="space-y-2">
                    <Label className="text-sm font-medium">
                        Run Status
                    </Label>
                    <Select value={runStatus} onValueChange={setRunStatus}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="new">🟢 New (Include in Takeoff)</SelectItem>
                            <SelectItem value="existing">⚪ Existing (Reference Only)</SelectItem>
                            <SelectItem value="remove">🔴 Remove/Tear Out</SelectItem>
                        </SelectContent>
                    </Select>
                    {runStatus === 'existing' && (
                        <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                            ⚠️ This run will be excluded from materials and PO
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="perimeter" className="text-sm font-medium">
                        Perimeter Run
                    </Label>
                    <Switch
                        id="perimeter"
                        checked={isPerimeter}
                        onCheckedChange={setIsPerimeter}
                    />
                </div>

                {isPerimeter && (
                    <>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">
                                Side of Yard
                            </Label>
                            <Select
                                value={orientationMode === 'auto' ? 'auto' : orientationLabel || 'auto'}
                                onValueChange={(value) => {
                                    if (value === 'auto') {
                                        setOrientationMode('auto');
                                    } else {
                                        setOrientationMode('manual');
                                        setOrientationLabel(value);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto (Let FenceBuddy Decide)</SelectItem>
                                    <SelectItem value="Front Left">Front Left</SelectItem>
                                    <SelectItem value="Front Right">Front Right</SelectItem>
                                    <SelectItem value="Left Side">Left Side</SelectItem>
                                    <SelectItem value="Right Side">Right Side</SelectItem>
                                    <SelectItem value="Back Line">Back Line</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {orientationMode === 'auto' && line.orientationLabel && (
                            <div className="p-3 bg-emerald-50 rounded-md border border-emerald-200">
                                <p className="text-sm text-emerald-900">
                                    <span className="font-semibold">Auto-detected:</span> {line.orientationLabel}
                                </p>
                            </div>
                        )}
                    </>
                )}

                <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                        Save
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}