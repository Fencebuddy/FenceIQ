import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, X } from "lucide-react";

const STATES = ['MI', 'OH', 'IN', 'IL', 'WI'];
const MATERIAL_TYPES = ['Vinyl', 'Wood', 'Chain Link', 'Aluminum'];
const FENCE_HEIGHTS = ["3'", "4'", "5'", "6'", "8'", "10'", "12'"];
const FENCE_COLORS = ['White', 'Tan', 'Khaki', 'Grey', 'Coastal Grey', 'Cedar Tone', 'Black', 'Two Tone'];
const RANCH_STYLE_TYPES = ['2 Rail', '3 Rail', 'Crossbuck'];
const CHAIN_LINK_COATINGS = ['Galvanized', 'Aluminized', 'Black Vinyl Coated'];
const CHAIN_LINK_PRIVACY_TYPES = ['None', 'Vinyl Slats', 'Privacy Screen'];
const VINYL_SLAT_COLORS = ['White', 'Grey', 'Green', 'Blue', 'Black', 'Tan', 'Khaki', 'Hedge Slat'];
const STYLES = {
  'Vinyl': ['Privacy', 'Semi-Private', 'Picket', 'Ranch Style'],
  'Wood': ['Privacy', 'Semi-Private', 'Horizontal', 'Picket', 'Ranch Style'],
  'Chain Link': ['Standard'],
  'Aluminum': ['Ornamental']
};

export default function JobForm({ job, onSave, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    customerName: job?.customerName || '',
    customerPhone: job?.customerPhone || '',
    customerEmail: job?.customerEmail || '',
    addressLine1: job?.addressLine1 || '',
    city: job?.city || '',
    state: job?.state || 'MI',
    zip: job?.zip || '',
    repName: job?.repName || '',
    materialType: job?.materialType || 'Vinyl',
    fenceHeight: job?.fenceHeight || "6'",
    style: job?.style || 'Privacy',
    fenceColor: job?.fenceColor || 'White',
    jobNotes: job?.jobNotes || '',
    status: job?.status || 'Draft',
    officeEmail: job?.officeEmail || '',
    ranchStyleType: job?.ranchStyleType || '',
    chainLinkCoating: job?.chainLinkCoating || '',
    chainLinkPrivacyType: job?.chainLinkPrivacyType || 'None',
    vinylSlatColor: job?.vinylSlatColor || '',
    railsAndPostColor: job?.railsAndPostColor || '',
    picketColor: job?.picketColor || ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Normalize color fields for canonical key compatibility
    const normalizeColor = (color) => {
      if (!color) return color;
      let normalized = color.replace(/\s+/g, '_').toLowerCase();
      if (normalized === 'mixed') normalized = 'white';
      return normalized;
    };
    
    const normalizedData = {
      ...formData,
      fenceColor: normalizeColor(formData.fenceColor),
      railsAndPostColor: normalizeColor(formData.railsAndPostColor),
      picketColor: normalizeColor(formData.picketColor),
      vinylSlatColor: normalizeColor(formData.vinylSlatColor)
    };
    
    onSave(normalizedData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader className="border-b bg-slate-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{job?.id ? 'Edit Job' : 'New Job'}</CardTitle>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Saving...' : 'Save Job'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Customer Info */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => handleChange('customerName', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone *</Label>
                <Input
                  id="customerPhone"
                  value={formData.customerPhone}
                  onChange={(e) => handleChange('customerPhone', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerEmail">Email (optional)</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => handleChange('customerEmail', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Job Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="addressLine1">Street Address *</Label>
                <Input
                  id="addressLine1"
                  value={formData.addressLine1}
                  onChange={(e) => handleChange('addressLine1', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select value={formData.state} onValueChange={(v) => handleChange('state', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP *</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => handleChange('zip', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fence Details */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Fence Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="materialType">Material Type *</Label>
                <Select value={formData.materialType} onValueChange={(v) => handleChange('materialType', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_TYPES.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fenceHeight">Fence Height *</Label>
                <Select value={formData.fenceHeight} onValueChange={(v) => handleChange('fenceHeight', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FENCE_HEIGHTS.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="style">Style *</Label>
                <Select 
                  value={formData.style} 
                  onValueChange={(v) => handleChange('style', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES[formData.materialType]?.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.style === 'Ranch Style' && (
                <div className="space-y-2">
                  <Label htmlFor="ranchStyleType">Ranch Style Type *</Label>
                  <Select 
                    value={formData.ranchStyleType} 
                    onValueChange={(v) => handleChange('ranchStyleType', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RANCH_STYLE_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {formData.materialType === 'Chain Link' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="chainLinkCoating">Chain Link Coating *</Label>
                    <Select 
                      value={formData.chainLinkCoating} 
                      onValueChange={(v) => handleChange('chainLinkCoating', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select coating..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CHAIN_LINK_COATINGS.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chainLinkPrivacyType">Privacy Option</Label>
                    <Select 
                      value={formData.chainLinkPrivacyType || 'None'} 
                      onValueChange={(v) => handleChange('chainLinkPrivacyType', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select privacy option..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CHAIN_LINK_PRIVACY_TYPES.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.chainLinkPrivacyType === 'Vinyl Slats' && (
                    <div className="space-y-2">
                      <Label htmlFor="vinylSlatColor">Vinyl Slat Color *</Label>
                      <Select 
                        value={formData.vinylSlatColor} 
                        onValueChange={(v) => handleChange('vinylSlatColor', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select slat color..." />
                        </SelectTrigger>
                        <SelectContent>
                          {VINYL_SLAT_COLORS.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="repName">Rep Name</Label>
                <Input
                  id="repName"
                  value={formData.repName}
                  onChange={(e) => handleChange('repName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="officeEmail">Office Email (for materials list)</Label>
                <Input
                  id="officeEmail"
                  type="email"
                  value={formData.officeEmail || ''}
                  onChange={(e) => handleChange('officeEmail', e.target.value)}
                  placeholder="materials@pfcwestmi.com"
                />
              </div>
              {formData.materialType === 'Vinyl' && (
                <div className="space-y-2">
                  <Label htmlFor="fenceColor">Fence Color</Label>
                  <Select value={formData.fenceColor} onValueChange={(v) => handleChange('fenceColor', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select color..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FENCE_COLORS.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Two Tone Color Options */}
            {formData.materialType === 'Vinyl' && formData.fenceColor === 'Two Tone' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="railsAndPostColor">Rails & Post Color *</Label>
                  <Select value={formData.railsAndPostColor} onValueChange={(v) => handleChange('railsAndPostColor', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select color..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FENCE_COLORS.filter(c => c !== 'Two Tone').map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="picketColor">Picket Color *</Label>
                  <Select value={formData.picketColor} onValueChange={(v) => handleChange('picketColor', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select color..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FENCE_COLORS.filter(c => c !== 'Two Tone').map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="jobNotes">Job Notes</Label>
            <Textarea
              id="jobNotes"
              value={formData.jobNotes}
              onChange={(e) => handleChange('jobNotes', e.target.value)}
              rows={4}
              placeholder="Any special notes about this job..."
            />
          </div>

        </CardContent>
      </Card>
    </form>
  );
}