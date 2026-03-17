import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calculator, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function ManualMaterialInput({ jobId, job, onCalculate }) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputs, setInputs] = useState({
        materialType: job?.materialType || 'Vinyl',
        fenceHeight: job?.fenceHeight || '6\'',
        style: job?.style || 'Privacy',
        linearFootage: 0,
        // Vinyl specific
        vinylPanels: 0,
        galvanizedLinePosts: 0,
        noDigDonuts: 0,
        terminalPosts: 0,
        cornerPosts: 0,
        iBeamGatePosts: 0,
        postCaps: 0,
        // Chain Link specific
        wireRolls: 0,
        chainLinkLinePosts: 0,
        chainLinkTerminalPosts: 0,
        chainLinkCornerPosts: 0,
        tensionBars: 0,
        tensionBands: 0,
        braceBands: 0,
        railEndCups: 0,
        carriageBolts: 0,
        topRail: 0,
        loopCaps: 0,
        tensionWire: 0,
        chainLinkPostCaps: 0,
        chainLinkLatches: 0,
        chainLinkTies: 0,
        // Wood specific
        postmasterSteelPosts: 0,
        treatedRails: 0,
        pickets: 0,
        deckBoards8ft: 0,
        deckScrews: 0,
        coilNails: 0,
        postBrackets: 0,
        // Aluminum specific
        aluminumSections: 0,
        aluminumLinePosts: 0,
        aluminumEndPosts: 0,
        aluminumCornerPosts: 0,
        aluminumPostCaps: 0,
        // Gates (all types)
        singleGateCount: 0,
        singleGate4ft: 0,
        singleGate5ft: 0,
        singleGate6ft: 0,
        doubleGateCount: 0,
        doubleGate8ft: 0,
        doubleGate10ft: 0,
        doubleGate12ft: 0,
        // Universal
        concreteBags: 0,
        notes: ''
    });

    const handleChange = (field, value) => {
        setInputs(prev => ({ ...prev, [field]: value }));
    };

    const handleCalculate = () => {
        onCalculate(inputs);
    };

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card id="manual-material-input">
                <CollapsibleTrigger asChild>
                    <CardHeader className="bg-slate-50 border-b cursor-pointer hover:bg-slate-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    Manual Material Input
                                    {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </CardTitle>
                                <p className="text-sm text-slate-600 mt-2">
                                    Enter measurements manually. Independent of the drawing below.
                                </p>
                            </div>
                            <Button onClick={(e) => { e.stopPropagation(); handleCalculate(); }} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                                <RefreshCw className="w-4 h-4" />
                                Sync to Materials List
                            </Button>
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="p-6 space-y-6">
                {/* Fence Specifications */}
                <div>
                    <h3 className="font-semibold text-lg mb-4">Fence Specifications</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Material Type</Label>
                            <Select value={inputs.materialType} onValueChange={(v) => handleChange('materialType', v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Vinyl">Vinyl</SelectItem>
                                    <SelectItem value="Wood">Wood</SelectItem>
                                    <SelectItem value="Chain Link">Chain Link</SelectItem>
                                    <SelectItem value="Aluminum">Aluminum</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Fence Height</Label>
                            <Select value={inputs.fenceHeight} onValueChange={(v) => handleChange('fenceHeight', v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="3'">3'</SelectItem>
                                    <SelectItem value="4'">4'</SelectItem>
                                    <SelectItem value="5'">5'</SelectItem>
                                    <SelectItem value="6'">6'</SelectItem>
                                    <SelectItem value="8'">8'</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Style</Label>
                            <Select value={inputs.style} onValueChange={(v) => handleChange('style', v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {inputs.materialType === 'Chain Link' ? (
                                        <>
                                            <SelectItem value="Standard">Standard</SelectItem>
                                            <SelectItem value="Vinyl Slats">Vinyl Slats</SelectItem>
                                            <SelectItem value="Privacy Screen">Privacy Screen</SelectItem>
                                        </>
                                    ) : (
                                        <>
                                            <SelectItem value="Privacy">Privacy</SelectItem>
                                            <SelectItem value="Picket">Picket</SelectItem>
                                            <SelectItem value="Semi-Privacy">Semi-Privacy</SelectItem>
                                            <SelectItem value="Ranch Style">Ranch Style</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Linear Footage */}
                <div>
                    <h3 className="font-semibold text-lg mb-4">Measurements</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Total Linear Footage</Label>
                            <Input
                                type="number"
                                value={inputs.linearFootage}
                                onChange={(e) => handleChange('linearFootage', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                step="0.1"
                            />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Gates */}
                <div>
                    <h3 className="font-semibold text-lg mb-4">Gates</h3>
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2 block">Single Gates</Label>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-600">Total Count</Label>
                                    <Input
                                        type="number"
                                        value={inputs.singleGateCount}
                                        onChange={(e) => handleChange('singleGateCount', parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-600">4' Wide</Label>
                                    <Input
                                        type="number"
                                        value={inputs.singleGate4ft}
                                        onChange={(e) => handleChange('singleGate4ft', parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-600">5' Wide</Label>
                                    <Input
                                        type="number"
                                        value={inputs.singleGate5ft}
                                        onChange={(e) => handleChange('singleGate5ft', parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-600">6' Wide</Label>
                                    <Input
                                        type="number"
                                        value={inputs.singleGate6ft}
                                        onChange={(e) => handleChange('singleGate6ft', parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <Label className="mb-2 block">Double Gates</Label>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-600">Total Count</Label>
                                    <Input
                                        type="number"
                                        value={inputs.doubleGateCount}
                                        onChange={(e) => handleChange('doubleGateCount', parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-600">8' Wide</Label>
                                    <Input
                                        type="number"
                                        value={inputs.doubleGate8ft}
                                        onChange={(e) => handleChange('doubleGate8ft', parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-600">10' Wide</Label>
                                    <Input
                                        type="number"
                                        value={inputs.doubleGate10ft}
                                        onChange={(e) => handleChange('doubleGate10ft', parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-600">12' Wide</Label>
                                    <Input
                                        type="number"
                                        value={inputs.doubleGate12ft}
                                        onChange={(e) => handleChange('doubleGate12ft', parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Material-Specific Fields */}
                {inputs.materialType === 'Vinyl' && (
                    <div>
                        <h3 className="font-semibold text-lg mb-4">Vinyl Materials (Optional Override)</h3>
                        <p className="text-sm text-slate-600 mb-4">Leave at 0 to auto-calculate</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Panels</Label>
                                <Input
                                    type="number"
                                    value={inputs.vinylPanels}
                                    onChange={(e) => handleChange('vinylPanels', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>2.5" Galv. Line Posts</Label>
                                <Input
                                    type="number"
                                    value={inputs.galvanizedLinePosts}
                                    onChange={(e) => handleChange('galvanizedLinePosts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>No-Dig Donuts</Label>
                                <Input
                                    type="number"
                                    value={inputs.noDigDonuts}
                                    onChange={(e) => handleChange('noDigDonuts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Terminal Posts</Label>
                                <Input
                                    type="number"
                                    value={inputs.terminalPosts}
                                    onChange={(e) => handleChange('terminalPosts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Corner Posts</Label>
                                <Input
                                    type="number"
                                    value={inputs.cornerPosts}
                                    onChange={(e) => handleChange('cornerPosts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>I-Beam Gate Posts</Label>
                                <Input
                                    type="number"
                                    value={inputs.iBeamGatePosts}
                                    onChange={(e) => handleChange('iBeamGatePosts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Post Caps</Label>
                                <Input
                                    type="number"
                                    value={inputs.postCaps}
                                    onChange={(e) => handleChange('postCaps', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {inputs.materialType === 'Chain Link' && (
                    <div>
                        <h3 className="font-semibold text-lg mb-4">Chain Link Materials (Optional Override)</h3>
                        <p className="text-sm text-slate-600 mb-4">Leave at 0 to auto-calculate</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Wire Rolls</Label>
                                <Input
                                    type="number"
                                    value={inputs.wireRolls}
                                    onChange={(e) => handleChange('wireRolls', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Line Posts</Label>
                                <Input
                                    type="number"
                                    value={inputs.chainLinkLinePosts}
                                    onChange={(e) => handleChange('chainLinkLinePosts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Terminal Posts</Label>
                                <Input
                                    type="number"
                                    value={inputs.chainLinkTerminalPosts}
                                    onChange={(e) => handleChange('chainLinkTerminalPosts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Corner Posts</Label>
                                <Input
                                    type="number"
                                    value={inputs.chainLinkCornerPosts}
                                    onChange={(e) => handleChange('chainLinkCornerPosts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tension Bars</Label>
                                <Input
                                    type="number"
                                    value={inputs.tensionBars}
                                    onChange={(e) => handleChange('tensionBars', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tension Bands</Label>
                                <Input
                                    type="number"
                                    value={inputs.tensionBands}
                                    onChange={(e) => handleChange('tensionBands', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Brace Bands</Label>
                                <Input
                                    type="number"
                                    value={inputs.braceBands}
                                    onChange={(e) => handleChange('braceBands', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Rail End Cups</Label>
                                <Input
                                    type="number"
                                    value={inputs.railEndCups}
                                    onChange={(e) => handleChange('railEndCups', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Carriage Bolt Packs</Label>
                                <Input
                                    type="number"
                                    value={inputs.carriageBolts}
                                    onChange={(e) => handleChange('carriageBolts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Top Rail (Sticks)</Label>
                                <Input
                                    type="number"
                                    value={inputs.topRail}
                                    onChange={(e) => handleChange('topRail', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                                <p className="text-xs text-slate-500">Each stick = 21 feet</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Loop Caps</Label>
                                <Input
                                    type="number"
                                    value={inputs.loopCaps}
                                    onChange={(e) => handleChange('loopCaps', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tension Wire (LF)</Label>
                                <Input
                                    type="number"
                                    value={inputs.tensionWire}
                                    onChange={(e) => handleChange('tensionWire', parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Post Caps</Label>
                                <Input
                                    type="number"
                                    value={inputs.chainLinkPostCaps}
                                    onChange={(e) => handleChange('chainLinkPostCaps', parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Latches</Label>
                                <Input
                                    type="number"
                                    value={inputs.chainLinkLatches}
                                    onChange={(e) => handleChange('chainLinkLatches', parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Ties (packs)</Label>
                                <Input
                                    type="number"
                                    value={inputs.chainLinkTies}
                                    onChange={(e) => handleChange('chainLinkTies', parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {inputs.materialType === 'Wood' && (
                    <div>
                        <h3 className="font-semibold text-lg mb-4">Wood Materials (Optional Override)</h3>
                        <p className="text-sm text-slate-600 mb-4">Leave at 0 to auto-calculate</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Postmaster Steel Posts</Label>
                                <Input
                                    type="number"
                                    value={inputs.postmasterSteelPosts}
                                    onChange={(e) => handleChange('postmasterSteelPosts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>2×4×8 Treated Rails</Label>
                                <Input
                                    type="number"
                                    value={inputs.treatedRails}
                                    onChange={(e) => handleChange('treatedRails', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Pickets</Label>
                                <Input
                                    type="number"
                                    value={inputs.pickets}
                                    onChange={(e) => handleChange('pickets', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>8' Deck Boards</Label>
                                <Input
                                    type="number"
                                    value={inputs.deckBoards8ft}
                                    onChange={(e) => handleChange('deckBoards8ft', parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Deck Screws (5lb boxes)</Label>
                                <Input
                                    type="number"
                                    value={inputs.deckScrews}
                                    onChange={(e) => handleChange('deckScrews', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Coil Nails (boxes)</Label>
                                <Input
                                    type="number"
                                    value={inputs.coilNails}
                                    onChange={(e) => handleChange('coilNails', parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Post Brackets</Label>
                                <Input
                                    type="number"
                                    value={inputs.postBrackets}
                                    onChange={(e) => handleChange('postBrackets', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {inputs.materialType === 'Aluminum' && (
                    <div>
                        <h3 className="font-semibold text-lg mb-4">Aluminum Materials (Optional Override)</h3>
                        <p className="text-sm text-slate-600 mb-4">Leave at 0 to auto-calculate</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Rackable Sections</Label>
                                <Input
                                    type="number"
                                    value={inputs.aluminumSections}
                                    onChange={(e) => handleChange('aluminumSections', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Line Posts</Label>
                                <Input
                                    type="number"
                                    value={inputs.aluminumLinePosts}
                                    onChange={(e) => handleChange('aluminumLinePosts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Posts</Label>
                                <Input
                                    type="number"
                                    value={inputs.aluminumEndPosts}
                                    onChange={(e) => handleChange('aluminumEndPosts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Corner Posts</Label>
                                <Input
                                    type="number"
                                    value={inputs.aluminumCornerPosts}
                                    onChange={(e) => handleChange('aluminumCornerPosts', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Post Caps</Label>
                                <Input
                                    type="number"
                                    value={inputs.aluminumPostCaps}
                                    onChange={(e) => handleChange('aluminumPostCaps', parseInt(e.target.value) || 0)}
                                    placeholder="Auto"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <Separator />

                {/* Concrete */}
                <div>
                    <h3 className="font-semibold text-lg mb-4">Concrete</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Concrete Bags (Optional Override)</Label>
                            <Input
                                type="number"
                                value={inputs.concreteBags}
                                onChange={(e) => handleChange('concreteBags', parseInt(e.target.value) || 0)}
                                placeholder="Auto-calculated"
                            />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Notes */}
                <div>
                    <Label>Additional Notes</Label>
                    <Input
                        value={inputs.notes}
                        onChange={(e) => handleChange('notes', e.target.value)}
                        placeholder="Any special requirements or overrides..."
                    />
                </div>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}