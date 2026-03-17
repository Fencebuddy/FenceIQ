import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function MaterialForm({ material, jobId, job, onSave, onClose, isLoading }) {
  const [formData, setFormData] = useState({
    jobId,
    lineItemName: '',
    quantity: material?.manualOverrideQty ?? material?.calculatedQty ?? material?.quantity ?? '',
    unit: 'pcs',
    calculationDetails: 'Manual entry',
    ...material
  });
  
  const [useCustomName, setUseCustomName] = useState(false);
  
  // Fetch all unique material names from MaterialRule
  const { data: materialRules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['materialRules', 'all'],
    queryFn: () => base44.entities.MaterialRule.list(),
    staleTime: 0,
    refetchOnMount: true,
  });
  
  // Get all unique material names from MaterialRule (no filtering by material type)
  const uniqueMaterialNames = React.useMemo(() => {
    const names = new Set();
    materialRules.forEach(rule => {
      if (rule.lineItemName) {
        names.add(rule.lineItemName);
      }
    });
    return Array.from(names).sort();
  }, [materialRules]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      quantity: parseFloat(formData.quantity)
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{material?.id ? 'Edit Material' : 'Add Material'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lineItemName">Material Name *</Label>
            {!useCustomName ? (
              <div className="space-y-2">
                <Select 
                  value={formData.lineItemName}
                  onValueChange={(value) => {
                    if (value === '__custom__') {
                      setUseCustomName(true);
                      handleChange("lineItemName", "");
                    } else {
                      handleChange("lineItemName", value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select material..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {rulesLoading ? (
                      <SelectItem value="__loading__" disabled>Loading materials...</SelectItem>
                    ) : uniqueMaterialNames.length > 0 ? (
                      <>
                        {uniqueMaterialNames.map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                        <SelectItem value="__custom__">✏️ Enter Custom Name...</SelectItem>
                      </>
                    ) : (
                      <SelectItem value="__custom__">No materials found - Enter Custom Name...</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  id="lineItemName"
                  value={formData.lineItemName}
                  onChange={(e) => handleChange('lineItemName', e.target.value)}
                  required
                  placeholder="e.g., 6' Privacy Panel"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUseCustomName(false);
                    handleChange("lineItemName", "");
                  }}
                >
                  ← Back to material list
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.1"
                min="0"
                value={formData.quantity}
                onChange={(e) => handleChange('quantity', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit *</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
                required
                placeholder="pcs, LF, bags"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="calculationDetails">Notes</Label>
            <Input
              id="calculationDetails"
              value={formData.calculationDetails}
              onChange={(e) => handleChange('calculationDetails', e.target.value)}
              placeholder="Optional calculation notes"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="w-4 h-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}