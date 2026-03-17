import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function AddItemDialog({ open, onOpenChange, onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    crm_name: '',
    category: 'post',
    material_type: 'vinyl',
    sub_category: 'line_post',
    finish: 'white',
    height: '',
    diameter: '',
    cost: '',
    unit: 'each'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.crm_name.trim()) {
      alert('Please enter a material name');
      return;
    }
    
    if (!formData.cost || isNaN(parseFloat(formData.cost))) {
      alert('Please enter a valid cost');
      return;
    }

    onSubmit({
      ...formData,
      cost: parseFloat(formData.cost)
    });

    // Reset form
    setFormData({
      crm_name: '',
      category: 'post',
      material_type: 'vinyl',
      sub_category: 'line_post',
      finish: 'white',
      height: '',
      diameter: '',
      cost: '',
      unit: 'each'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Material Item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="crm_name">Name *</Label>
            <Input
              id="crm_name"
              name="crm_name"
              placeholder="e.g., Vinyl Post 5x5"
              value={formData.crm_name}
              onChange={handleChange}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category / Type *</Label>
              <Select value={formData.category} onValueChange={(value) => handleChange({ target: { name: 'category', value } })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="panel">Panel</SelectItem>
                  <SelectItem value="rail">Rail</SelectItem>
                  <SelectItem value="fabric">Fabric</SelectItem>
                  <SelectItem value="hardware">Hardware</SelectItem>
                  <SelectItem value="gate">Gate</SelectItem>
                  <SelectItem value="concrete">Concrete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Material *</Label>
              <Select value={formData.material_type} onValueChange={(value) => handleChange({ target: { name: 'material_type', value } })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vinyl">Vinyl</SelectItem>
                  <SelectItem value="chain_link">Chain Link</SelectItem>
                  <SelectItem value="wood">Wood</SelectItem>
                  <SelectItem value="aluminum">Aluminum</SelectItem>
                  <SelectItem value="steel">Steel</SelectItem>
                  <SelectItem value="composite">Composite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Subtype / Role</Label>
              <Select value={formData.sub_category} onValueChange={(value) => handleChange({ target: { name: 'sub_category', value } })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Select...</SelectItem>
                  <SelectItem value="line_post">Line Post</SelectItem>
                  <SelectItem value="corner_post">Corner Post</SelectItem>
                  <SelectItem value="end_post">End Post</SelectItem>
                  <SelectItem value="terminal_post">Terminal Post</SelectItem>
                  <SelectItem value="gate_post">Gate Post</SelectItem>
                  <SelectItem value="top_rail">Top Rail</SelectItem>
                  <SelectItem value="middle_rail">Middle Rail</SelectItem>
                  <SelectItem value="bottom_rail">Bottom Rail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Coating / Finish</Label>
              <Select value={formData.finish} onValueChange={(value) => handleChange({ target: { name: 'finish', value } })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="white">White</SelectItem>
                  <SelectItem value="tan">Tan</SelectItem>
                  <SelectItem value="khaki">Khaki</SelectItem>
                  <SelectItem value="grey">Grey</SelectItem>
                  <SelectItem value="coastal_grey">Coastal Grey</SelectItem>
                  <SelectItem value="cedar_tone">Cedar Tone</SelectItem>
                  <SelectItem value="black">Black</SelectItem>
                  <SelectItem value="galv">Galvanized</SelectItem>
                  <SelectItem value="aluminized">Aluminized</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="height">Height</Label>
              <Input
                id="height"
                name="height"
                placeholder="e.g., 5 ft"
                value={formData.height}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="diameter">Diameter</Label>
              <Input
                id="diameter"
                name="diameter"
                placeholder="e.g., 2.5 in"
                value={formData.diameter}
                onChange={handleChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Unit *</Label>
              <Select value={formData.unit} onValueChange={(value) => handleChange({ target: { name: 'unit', value } })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="each">Each</SelectItem>
                  <SelectItem value="ft">Feet</SelectItem>
                  <SelectItem value="lf">Linear Feet</SelectItem>
                  <SelectItem value="roll">Roll</SelectItem>
                  <SelectItem value="bag">Bag</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="bundle">Bundle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="cost">Cost ($) *</Label>
            <Input
              id="cost"
              name="cost"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.cost}
              onChange={handleChange}
              className="mt-1"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Add Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}