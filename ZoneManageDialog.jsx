import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export default function ZoneManageDialog({ open, onClose, zone, companyId }) {
  const queryClient = useQueryClient();
  const isEdit = !!zone;

  const [name, setName] = useState(zone?.name || '');
  const [city, setCity] = useState(zone?.city || '');
  const [zipInput, setZipInput] = useState('');
  const [zips, setZips] = useState(zone?.zipCodes || []);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isEdit) {
        return await base44.entities.NeighborhoodZone.update(zone.id, data);
      } else {
        return await base44.entities.NeighborhoodZone.create({ ...data, companyId, active: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      toast.success(isEdit ? 'Zone updated' : 'Zone created');
      onClose();
    },
    onError: (e) => toast.error(e.message)
  });

  const addZip = () => {
    const z = zipInput.trim();
    if (z && !zips.includes(z)) setZips([...zips, z]);
    setZipInput('');
  };

  const removeZip = (z) => setZips(zips.filter(x => x !== z));

  const handleSave = () => {
    if (!name.trim()) return toast.error('Name required');
    saveMutation.mutate({ name: name.trim(), city: city.trim(), zipCodes: zips });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Zone' : 'New Neighborhood Zone'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Zone Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Tannenbaum, Glen Brook" className="mt-1" />
          </div>
          <div>
            <Label>City (optional)</Label>
            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Grand Rapids" className="mt-1" />
          </div>
          <div>
            <Label>ZIP Codes</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={zipInput}
                onChange={e => setZipInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addZip(); } }}
                placeholder="49508"
              />
              <Button variant="outline" size="sm" onClick={addZip}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {zips.map(z => (
                <Badge key={z} variant="secondary" className="gap-1">
                  {z}
                  <button onClick={() => removeZip(z)}><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-[#006FBA] hover:bg-[#005EA5]">
            {isEdit ? 'Save Changes' : 'Create Zone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}