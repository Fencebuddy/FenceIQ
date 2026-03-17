import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package } from "lucide-react";

export default function GeneratePOModal({ job, isOpen, onClose, onGenerated }) {
  const [supplierId, setSupplierId] = useState('');
  const [exportFormat, setExportFormat] = useState('BOTH');
  const [notesToSupplier, setNotesToSupplier] = useState('');
  const [shipToName, setShipToName] = useState(job?.customerName || '');
  const [shipToAddress1, setShipToAddress1] = useState(job?.addressLine1 || '');
  const [shipToCity, setShipToCity] = useState(job?.city || '');
  const [shipToState, setShipToState] = useState(job?.state || '');
  const [shipToZip, setShipToZip] = useState(job?.zip || '');
  const [isGenerating, setIsGenerating] = useState(false);

  // Load suppliers
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
    enabled: isOpen
  });

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen && job) {
      setShipToName(job.customerName || '');
      setShipToAddress1(job.addressLine1 || '');
      setShipToCity(job.city || '');
      setShipToState(job.state || '');
      setShipToZip(job.zip || '');
      setNotesToSupplier('');
    }
  }, [isOpen, job]);

  const handleGenerate = async () => {
    if (!supplierId) {
      alert('Please select a supplier');
      return;
    }

    setIsGenerating(true);
    try {
      const { generatePurchaseOrder } = await import('./PurchaseOrderGenerator');
      
      const exportFormats = exportFormat === 'BOTH' 
        ? ['PDF', 'CSV'] 
        : exportFormat === 'PDF' 
        ? ['PDF'] 
        : ['CSV'];

      const purchaseOrder = await generatePurchaseOrder(job.id, supplierId, {
        exportFormats,
        notesToSupplier,
        source: 'OFFICE_GENERATED'
      });

      // Update PO with ship-to override if changed
      if (shipToName !== job.customerName || 
          shipToAddress1 !== job.addressLine1 ||
          shipToCity !== job.city ||
          shipToState !== job.state ||
          shipToZip !== job.zip) {
        await base44.entities.PurchaseOrder.update(purchaseOrder.id, {
          shipToName,
          shipToAddress1,
          shipToCity,
          shipToState,
          shipToZip
        });
      }

      onGenerated(purchaseOrder);
      onClose();
    } catch (error) {
      console.error('PO generation failed:', error);
      alert(`Failed to generate PO: ${error.message}`);
    }
    setIsGenerating(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Generate Purchase Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier *</Label>
            {suppliersLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading suppliers...
              </div>
            ) : suppliers.length === 0 ? (
              <div className="text-sm text-slate-500">
                No suppliers found. Add suppliers in admin settings first.
              </div>
            ) : (
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Export Format */}
          <div className="space-y-2">
            <Label htmlFor="exportFormat">Export Format *</Label>
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BOTH">PDF + CSV</SelectItem>
                <SelectItem value="PDF">PDF Only</SelectItem>
                <SelectItem value="CSV">CSV Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes to Supplier */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes to Supplier</Label>
            <Textarea
              id="notes"
              value={notesToSupplier}
              onChange={(e) => setNotesToSupplier(e.target.value)}
              rows={3}
              placeholder="Delivery instructions, special requests, etc."
            />
          </div>

          {/* Ship-To Address */}
          <div className="border-t pt-4">
            <Label className="text-base font-semibold mb-3 block">Ship-To Address</Label>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="shipToName">Name *</Label>
                <Input
                  id="shipToName"
                  value={shipToName}
                  onChange={(e) => setShipToName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shipToAddress1">Address *</Label>
                <Input
                  id="shipToAddress1"
                  value={shipToAddress1}
                  onChange={(e) => setShipToAddress1(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="shipToCity">City *</Label>
                  <Input
                    id="shipToCity"
                    value={shipToCity}
                    onChange={(e) => setShipToCity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipToState">State *</Label>
                  <Input
                    id="shipToState"
                    value={shipToState}
                    onChange={(e) => setShipToState(e.target.value)}
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipToZip">ZIP *</Label>
                  <Input
                    id="shipToZip"
                    value={shipToZip}
                    onChange={(e) => setShipToZip(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !supplierId || suppliers.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Package className="w-4 h-4 mr-2" />
                Generate PO
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}