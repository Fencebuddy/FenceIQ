import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Plus, Trash2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "react-hot-toast";

export default function BomEditor() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editedItems, setEditedItems] = useState({});

  // Fetch job
  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const jobs = await base44.entities.Job.filter({ id: jobId });
      return jobs[0];
    },
    enabled: !!jobId
  });

  // Fetch takeoff snapshot
  const { data: takeoffSnapshot, isLoading: snapshotLoading } = useQuery({
    queryKey: ['takeoffSnapshot', job?.active_takeoff_snapshot_id],
    queryFn: async () => {
      if (!job?.active_takeoff_snapshot_id) return null;
      const snapshots = await base44.entities.TakeoffSnapshot.filter({ 
        id: job.active_takeoff_snapshot_id 
      });
      return snapshots[0];
    },
    enabled: !!job?.active_takeoff_snapshot_id
  });

  // Fetch material catalog
  const { data: catalog = [] } = useQuery({
    queryKey: ['materialCatalog'],
    queryFn: () => base44.entities.MaterialCatalog.list('-last_updated', 500),
    initialData: []
  });

  const saveMutation = useMutation({
    mutationFn: async (updatedLineItems) => {
      await base44.entities.TakeoffSnapshot.update(takeoffSnapshot.id, {
        line_items: updatedLineItems
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['takeoffSnapshot'] });
      toast.success('BOM saved successfully');
      setEditedItems({});
    },
    onError: (error) => {
      toast.error('Failed to save BOM: ' + error.message);
    }
  });

  const handleQuantityChange = (index, newQty) => {
    setEditedItems(prev => ({
      ...prev,
      [index]: {
        ...takeoffSnapshot.line_items[index],
        quantityCalculated: parseFloat(newQty) || 0
      }
    }));
  };

  const handleSave = () => {
    const updatedLineItems = takeoffSnapshot.line_items.map((item, idx) => 
      editedItems[idx] || item
    );
    saveMutation.mutate(updatedLineItems);
  };

  const handleDeleteItem = (index) => {
    setEditedItems(prev => ({
      ...prev,
      [index]: null // Mark for deletion
    }));
  };

  const getResolvedStatus = (canonicalKey) => {
    if (!canonicalKey) return { resolved: false, item: null };
    
    // Try exact match
    const exactMatch = catalog.find(item => 
      item.canonical_key === canonicalKey || item.material_id === canonicalKey
    );
    if (exactMatch) return { resolved: true, item: exactMatch };

    // Try prefix match
    const prefixMatch = catalog.find(item => {
      const itemKey = item.canonical_key || item.material_id || '';
      return itemKey.startsWith(canonicalKey);
    });
    if (prefixMatch) return { resolved: true, item: prefixMatch, matchType: 'prefix' };

    return { resolved: false, item: null };
  };

  if (jobLoading || snapshotLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    );
  }

  if (!job || !takeoffSnapshot) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-red-600">
            Job or takeoff snapshot not found
          </div>
        </div>
      </div>
    );
  }

  const lineItems = takeoffSnapshot.line_items || [];
  const hasEdits = Object.keys(editedItems).length > 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">BOM Editor</h1>
              <p className="text-sm text-slate-600">
                Job #{job.jobNumber} - {job.customerName}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasEdits || saveMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-slate-600">Total Items</div>
              <div className="text-2xl font-bold">{lineItems.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-slate-600">Resolved</div>
              <div className="text-2xl font-bold text-green-600">
                {lineItems.filter(item => getResolvedStatus(item.canonical_key).resolved).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-slate-600">Unresolved</div>
              <div className="text-2xl font-bold text-red-600">
                {lineItems.filter(item => !getResolvedStatus(item.canonical_key).resolved).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-slate-600">Pending Edits</div>
              <div className="text-2xl font-bold text-blue-600">
                {Object.keys(editedItems).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium text-slate-600">Item</th>
                    <th className="text-left p-3 text-sm font-medium text-slate-600">Canonical Key</th>
                    <th className="text-left p-3 text-sm font-medium text-slate-600">Quantity</th>
                    <th className="text-left p-3 text-sm font-medium text-slate-600">UOM</th>
                    <th className="text-left p-3 text-sm font-medium text-slate-600">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => {
                    if (editedItems[idx] === null) return null; // Deleted item
                    
                    const editedItem = editedItems[idx] || item;
                    const resolution = getResolvedStatus(item.canonical_key);
                    const isEdited = !!editedItems[idx];

                    return (
                      <tr key={idx} className={`border-b ${isEdited ? 'bg-blue-50' : ''}`}>
                        <td className="p-3">
                          <div className="font-medium">{item.lineItemName}</div>
                          {item.notes && (
                            <div className="text-xs text-slate-500 mt-1">{item.notes}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-xs text-slate-600">
                            {item.canonical_key || 'N/A'}
                          </div>
                          {resolution.resolved && resolution.matchType === 'prefix' && (
                            <Badge className="mt-1 bg-yellow-100 text-yellow-800 text-xs">
                              Prefix Match
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.01"
                            value={editedItem.quantityCalculated}
                            onChange={(e) => handleQuantityChange(idx, e.target.value)}
                            className="w-24"
                          />
                        </td>
                        <td className="p-3 text-sm">{item.uom}</td>
                        <td className="p-3">
                          {resolution.resolved ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Resolved
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">
                              <XCircle className="w-3 h-3 mr-1" />
                              Unresolved
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(idx)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}