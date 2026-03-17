import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Download, Send, FileText, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import GeneratePOModal from './GeneratePOModal';

export default function PurchaseOrderPanel({ job }) {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch POs for this job
  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['purchaseOrders', job.id],
    queryFn: () => base44.entities.PurchaseOrder.filter({ jobId: job.id }),
    enabled: !!job.id
  });

  // Fetch suppliers for display
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list()
  });

  // Mark PO as sent mutation
  const markSentMutation = useMutation({
    mutationFn: async (poId) => {
      await base44.entities.PurchaseOrder.update(poId, {
        status: 'Sent',
        sentAt: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrders', job.id]);
    }
  });

  // Delete PO mutation
  const deletePOMutation = useMutation({
    mutationFn: async (poId) => {
      await base44.entities.PurchaseOrder.delete(poId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrders', job.id]);
    }
  });



  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'bg-slate-100 text-slate-700';
      case 'Exported': return 'bg-blue-100 text-blue-700';
      case 'Sent': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <Card>
      <CardHeader className="border-b bg-slate-50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Supplier Purchase Orders
          </CardTitle>
          <Button 
            onClick={() => setShowGenerateModal(true)}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Package className="w-4 h-4 mr-2" />
            Generate PO
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading purchase orders...
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 mb-2">No purchase orders yet</p>
            <p className="text-sm text-slate-400">
              Generate a PO to send materials list to supplier
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {purchaseOrders.map(po => {
              const supplier = suppliers.find(s => s.id === po.supplierId);
              
              return (
                <div key={po.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-slate-900">{po.poNumber}</h4>
                        <Badge className={getStatusColor(po.status)}>{po.status}</Badge>
                        {po.unmappedCount > 0 && (
                          <Badge variant="outline" className="border-amber-500 text-amber-700">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {po.unmappedCount} unmapped
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <p>Supplier: {supplier?.name || 'Unknown'}</p>
                        <p>Created: {new Date(po.created_date).toLocaleDateString()}</p>
                        <p>Line Items: {po.lineItems?.length || 0}</p>
                        {po.ruleVersion && (
                          <p className="text-xs">Rule Version: {po.ruleVersion}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {po.unmappedCount > 0 && (
                    <Alert className="mb-3 bg-amber-50 border-amber-300">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-sm text-amber-900">
                        <strong>{po.unmappedCount} items</strong> missing supplier SKU mapping. 
                        Items will export with blank SKU field.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {po.pdfUrl && (
                      <a href={po.pdfUrl} target="_blank" rel="noopener noreferrer">
                        <Button
                          size="sm"
                          variant="outline"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                      </a>
                    )}
                    
                    {po.csvUrl && (
                      <a href={po.csvUrl} target="_blank" rel="noopener noreferrer">
                        <Button
                          size="sm"
                          variant="outline"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download CSV
                        </Button>
                      </a>
                    )}

                    {po.status !== 'Sent' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markSentMutation.mutate(po.id)}
                        disabled={markSentMutation.isPending}
                        className="text-green-600 border-green-600 hover:bg-green-50"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Mark as Sent
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Delete PO ${po.poNumber}? This cannot be undone.`)) {
                          deletePOMutation.mutate(po.id);
                        }
                      }}
                      disabled={deletePOMutation.isPending}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Generate PO Modal */}
      <GeneratePOModal
        job={job}
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerated={() => queryClient.invalidateQueries(['purchaseOrders', job.id])}
      />
    </Card>
  );
}