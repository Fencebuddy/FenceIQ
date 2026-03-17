import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const COUNTIES = ['Kent', 'Ottawa', 'Muskegon', 'Mecosta'];

export default function JurisdictionSelector({ 
  county, 
  jurisdictionName, 
  onCountyChange, 
  onJurisdictionNameChange,
  showPoolCheckbox = false,
  poolDetected = false,
  onPoolChange,
  showCornerLotCheckbox = false,
  cornerLot = false,
  onCornerLotChange,
  showSidewalkCheckbox = false,
  sidewalkDetected = false,
  onSidewalkChange,
  showIntersectionCheckbox = false,
  intersectionDetected = false,
  onIntersectionChange
}) {
  const [inputValue, setInputValue] = useState(jurisdictionName || '');
  const [suggestions, setSuggestions] = useState([]);

  // Fetch all jurisdiction overrides for autocomplete
  const { data: overrides = [] } = useQuery({
    queryKey: ['jurisdictionOverrides'],
    queryFn: () => base44.entities.JurisdictionOverride.list(),
    staleTime: 1000 * 60 * 60 // 1 hour
  });

  // Filter suggestions based on county and input
  useEffect(() => {
    if (county && inputValue) {
      const filtered = overrides
        .filter(o => 
          o.county === county && 
          o.is_active &&
          o.jurisdiction_name.toLowerCase().includes(inputValue.toLowerCase())
        )
        .map(o => o.jurisdiction_name)
        .filter((name, idx, arr) => arr.indexOf(name) === idx) // unique
        .slice(0, 10);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [county, inputValue, overrides]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    onJurisdictionNameChange(value);
  };

  const handleSuggestionClick = (name) => {
    setInputValue(name);
    onJurisdictionNameChange(name);
    setSuggestions([]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>County</Label>
          <Select value={county} onValueChange={onCountyChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select county" />
            </SelectTrigger>
            <SelectContent>
              {COUNTIES.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Jurisdiction Name</Label>
          <div className="relative">
            <Input
              value={inputValue}
              onChange={handleInputChange}
              placeholder="e.g., Grand Rapids"
              disabled={!county}
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((name, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(name)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conditional Checkboxes */}
      <div className="grid grid-cols-2 gap-4">
        {showCornerLotCheckbox && (
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="cornerLot" 
              checked={cornerLot} 
              onCheckedChange={onCornerLotChange} 
            />
            <Label htmlFor="cornerLot" className="text-sm font-normal cursor-pointer">
              Corner Lot
            </Label>
          </div>
        )}

        {showPoolCheckbox && (
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="pool" 
              checked={poolDetected} 
              onCheckedChange={onPoolChange} 
            />
            <Label htmlFor="pool" className="text-sm font-normal cursor-pointer">
              Pool on Property
            </Label>
          </div>
        )}

        {showSidewalkCheckbox && (
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="sidewalk" 
              checked={sidewalkDetected} 
              onCheckedChange={onSidewalkChange} 
            />
            <Label htmlFor="sidewalk" className="text-sm font-normal cursor-pointer">
              Sidewalk Present
            </Label>
          </div>
        )}

        {showIntersectionCheckbox && (
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="intersection" 
              checked={intersectionDetected} 
              onCheckedChange={onIntersectionChange} 
            />
            <Label htmlFor="intersection" className="text-sm font-normal cursor-pointer">
              Near Intersection
            </Label>
          </div>
        )}
      </div>
    </div>
  );
}