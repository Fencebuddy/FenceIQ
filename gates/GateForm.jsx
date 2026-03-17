import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { analyzeGateSlopePlacement } from './gateSlopeAnalyzer';
import { Save } from "lucide-react";

export default function GateForm({ gate, jobId, runs, job, onSave, onClose, isLoading }) {
  // Parse gate width - handle both legacy ft format and new inch format
  const parseGateWidth = (gateObj) => {
    if (gateObj?.gateWidth_ft) return gateObj.gateWidth_ft;
    if (gateObj?.gateWidth) {
      // If width includes inches (e.g., "38.5\""), convert to numeric
      if (gateObj.gateWidth.includes('"')) {
        return parseFloat(gateObj.gateWidth.replace(/"/g, ''));
      }
      // Legacy feet format (e.g., "4'")
      return parseFloat(gateObj.gateWidth.replace(/'/g, ''));
    }
    return 38.5; // Default to first available size (in inches)
  };

  const [formData, setFormData] = useState({
    jobId,
    runId: '',
    gateType: 'Single',
    gateWidth: '38.5"',
    gateWidth_ft: parseGateWidth(gate) || 38.5,
    gateCenterDistance_ft: null,
    placement: 'In-line',
    latchType: '',
    notes: '',
    gateSlopeAdvisory: false,
    currentGateMaxSlopeGrade: null,
    recommendedGateCenter_ft: null,
    recommendedGateMaxSlopeGrade: null,
    slopeAdvisoryResolved: false,
    ...gate,
    gateWidth_ft: parseGateWidth(gate) || 38.5 // Override after spread to ensure numeric
  });
  
  const [slopeAnalysis, setSlopeAnalysis] = useState(null);
  
  // Analyze gate slope whenever run or gate properties change
  useEffect(() => {
    if (formData.runId && runs.length > 0) {
      const selectedRun = runs.find(r => r.id === formData.runId);
      if (selectedRun && selectedRun.mathSubRuns && selectedRun.mathSubRuns.length > 0) {
        const analysis = analyzeGateSlopePlacement(formData, selectedRun);
        setSlopeAnalysis(analysis);
        
        // Update form data with analysis results - DETERMINISTIC CLEAR
        if (analysis.advisory) {
          setFormData(prev => ({
            ...prev,
            gateSlopeAdvisory: true,
            currentGateMaxSlopeGrade: analysis.currentMaxGrade,
            recommendedGateCenter_ft: analysis.recommendedCenter_ft,
            recommendedGateMaxSlopeGrade: analysis.recommendedMaxGrade
          }));
        } else {
          // CRITICAL: Clear all advisory fields when no advisory
          setFormData(prev => ({
            ...prev,
            gateSlopeAdvisory: false,
            currentGateMaxSlopeGrade: null,
            recommendedGateCenter_ft: null,
            recommendedGateMaxSlopeGrade: null,
            slopeAdvisoryResolved: false
          }));
        }
      } else {
        setSlopeAnalysis(null);
        // Clear advisory if no math sub-runs
        setFormData(prev => ({
          ...prev,
          gateSlopeAdvisory: false,
          currentGateMaxSlopeGrade: null,
          recommendedGateCenter_ft: null,
          recommendedGateMaxSlopeGrade: null,
          slopeAdvisoryResolved: false
        }));
      }
    }
  }, [formData.runId, formData.gateWidth_ft, formData.gateCenterDistance_ft, runs]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-adjust width based on gate type - SYNC BOTH FIELDS
      if (field === 'gateType') {
        const validSingleWidths = [38.5, 44.5, 62.5, 68.5];
        const validDoubleWidths = [38.5, 44.5, 62.5, 68.5];
        if (value === 'Single' && !validSingleWidths.includes(updated.gateWidth_ft)) {
          updated.gateWidth = '38.5"';
          updated.gateWidth_ft = 38.5;
        } else if (value === 'Double' && !validDoubleWidths.includes(updated.gateWidth_ft)) {
          updated.gateWidth = '38.5"';
          updated.gateWidth_ft = 38.5;
        }
      }
      
      // Sync gateWidth and gateWidth_ft when width changes
      if (field === 'gateWidth') {
        updated.gateWidth_ft = parseFloat(value.replace(/"/g, ''));
      }
      
      // Set default gate center if run changes
      if (field === 'runId') {
        const selectedRun = runs.find(r => r.id === value);
        if (selectedRun && !updated.gateCenterDistance_ft) {
          updated.gateCenterDistance_ft = selectedRun.lengthLF / 2; // Default to mid-run
        }
      }
      
      return updated;
    });
  };
  
  const handleApplyRecommendedLocation = () => {
    setFormData(prev => ({
      ...prev,
      gateCenterDistance_ft: prev.recommendedGateCenter_ft,
      slopeAdvisoryResolved: true
    }));
  };
  
  const handleConfirmCurrentPlacement = () => {
    setFormData(prev => ({
      ...prev,
      slopeAdvisoryResolved: true
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Remove deprecated fields from submission
    const { caneBoltQuantity, ...gateData } = formData;
    
    // Ensure gateWidth_ft is always set (required field)
    if (!gateData.gateWidth_ft) {
      gateData.gateWidth_ft = parseFloat(gateData.gateWidth?.replace(/'/g, '')) || 4;
    }
    
    onSave(gateData);
  };

  // Actual gate sizes from MaterialCatalog (in inches for display)
  const singleWidths = ['38.5"', '44.5"', '62.5"', '68.5"'];
  const doubleWidths = ['38.5"', '44.5"', '62.5"', '68.5"'];
  const widthOptions = formData.gateType === 'Single' ? singleWidths : doubleWidths;

  // Determine latch options based on material type
  const materialType = job?.materialType;
  let latchOptions = [];
  if (materialType === 'Chain Link') {
    latchOptions = ['Drop Fork', 'Pool Latch', 'Strong Latch'];
  } else if (materialType === 'Aluminum') {
    latchOptions = ['Pool Latch', 'Gravity Latch'];
  } else {
    // Wood and Vinyl
    latchOptions = ['4" locklatch gate lock', '5" locklatch post lock'];
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{gate?.id ? 'Edit Gate' : 'Add New Gate'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Slope Advisory Warning */}
          {slopeAnalysis?.advisory && !formData.slopeAdvisoryResolved && (
            <Alert className={slopeAnalysis.isExtreme ? "border-red-500 bg-red-50" : "border-amber-500 bg-amber-50"}>
              <AlertDescription>
                <div className="space-y-3">
                  <div>
                    <p className={`font-semibold ${slopeAnalysis.isExtreme ? "text-red-900" : "text-amber-900"}`}>
                      {slopeAnalysis.isExtreme ? "⚠️ Gate on Steep Slope" : "⚠️ Gate on Slope"}
                    </p>
                    <p className={`text-sm mt-1 ${slopeAnalysis.isExtreme ? "text-red-800" : "text-amber-800"}`}>
                      Gate is located on a {slopeAnalysis.currentSlopeLabel.toLowerCase()} slope ({(slopeAnalysis.currentMaxGrade * 100).toFixed(1)}% grade).
                      Standard practice is to place gates on the flattest surface.
                    </p>
                    <p className={`text-sm mt-1 ${slopeAnalysis.isExtreme ? "text-red-700" : "text-amber-700"}`}>
                      Recommended location: {slopeAnalysis.recommendedCenter_ft.toFixed(1)}' along run ({slopeAnalysis.recommendedSlopeLabel.toLowerCase()} - {(slopeAnalysis.recommendedMaxGrade * 100).toFixed(1)}% grade)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleApplyRecommendedLocation}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      Apply Recommended Location
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleConfirmCurrentPlacement}
                    >
                      {slopeAnalysis.isExtreme ? "Confirm Current Placement" : "Keep Current Location"}
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {slopeAnalysis?.advisory && formData.slopeAdvisoryResolved && (
            <Alert className="border-green-500 bg-green-50">
              <AlertDescription className="text-sm text-green-800">
                ✓ Gate placement {formData.gateCenterDistance_ft === formData.recommendedGateCenter_ft ? "relocated to flattest nearby section" : "confirmed by rep"}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="runId">Gate Placement *</Label>
            <Select value={formData.runId} onValueChange={(v) => handleChange('runId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select run location..." />
              </SelectTrigger>
              <SelectContent>
                {runs.map(run => (
                  <SelectItem key={run.id} value={run.id}>
                    {run.runLabel} ({run.lengthLF} LF)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gateType">Gate Type *</Label>
              <Select value={formData.gateType} onValueChange={(v) => handleChange('gateType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="Double">Double</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gateWidth">Width *</Label>
              <Select value={formData.gateWidth} onValueChange={(v) => handleChange('gateWidth', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {widthOptions.map(w => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="placement">Placement *</Label>
            <Select value={formData.placement} onValueChange={(v) => handleChange('placement', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="In-line">In-line</SelectItem>
                <SelectItem value="End Of Run">End Of Run</SelectItem>
                <SelectItem value="At Corner">At Corner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="latchType">Latch Type</Label>
            <Select value={formData.latchType} onValueChange={(v) => handleChange('latchType', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select latch..." />
              </SelectTrigger>
              <SelectContent>
                {latchOptions.map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Read-only auto-calculated cane bolts */}
          <div className="space-y-2">
            <Label>Cane Bolts / Drop Rods (Auto)</Label>
            <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-sm">
              {formData.gateType === 'Double' ? (
                <span className="font-semibold text-slate-900">2 <span className="text-slate-600 font-normal">(1 per leaf - enforced standard)</span></span>
              ) : (
                <span className="text-slate-500">0 (single gates do not require cane bolts)</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
              placeholder="Any special notes..."
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading || !formData.runId} className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="w-4 h-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Gate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}