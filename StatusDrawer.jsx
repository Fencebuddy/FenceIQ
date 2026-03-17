import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle, XCircle, DollarSign, Package, AlertTriangle, FileSignature } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import toast from 'react-hot-toast';
import { markJobSold, markJobUnsold, setPaymentStatus, setInstallStatus, isSoldForReporting } from '@/components/services/jobStatusService';

export default function StatusDrawer({ open, onClose, job, activeSignature, onUpdate }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [unsoldDialog, setUnsoldDialog] = useState(false);
    const [voidSaleDialog, setVoidSaleDialog] = useState(false);
    const [unsoldReason, setUnsoldReason] = useState('');
    const [voidReason, setVoidReason] = useState('');
    const [unsoldLossType, setUnsoldLossType] = useState('sale_lost');
    const [isUpdating, setIsUpdating] = useState(false);

    // Mutations with optimistic updates
    const paymentStatusMutation = useMutation({
        mutationFn: async (status) => {
            const user = await base44.auth.me();
            const settings = await base44.entities.CompanySettings.filter({});
            if (!settings[0]?.id) throw new Error('Company settings not found.');
            return setPaymentStatus({
                companyId: settings[0].id,
                jobId: job.id,
                userId: user.id,
                paymentStatus: status
            });
        },
        onMutate: async (status) => {
            await queryClient.cancelQueries({ queryKey: ['crmJobs'] });
            const previous = queryClient.getQueryData(['crmJobs']);
            queryClient.setQueryData(['crmJobs'], (old) =>
                old?.map((j) => j.id === job.id ? { ...j, paymentStatus: status } : j)
            );
            return { previous };
        },
        onError: (err, status, context) => {
            if (context?.previous) queryClient.setQueryData(['crmJobs'], context.previous);
            toast.error(err.message || 'Failed to update payment status');
        },
        onSuccess: (_, status) => {
            toast.success(status === 'payment_received' ? 'Payment received! Job auto-marked as Sold.' : 'Payment status updated');
            onClose();
            onUpdate?.();
        }
    });

    const installStatusMutation = useMutation({
        mutationFn: async (status) => {
            const user = await base44.auth.me();
            const settings = await base44.entities.CompanySettings.filter({});
            if (!settings[0]?.id) throw new Error('Company settings not found.');
            return setInstallStatus({
                companyId: settings[0].id,
                jobId: job.id,
                userId: user.id,
                installStatus: status
            });
        },
        onMutate: async (status) => {
            await queryClient.cancelQueries({ queryKey: ['crmJobs'] });
            const previous = queryClient.getQueryData(['crmJobs']);
            queryClient.setQueryData(['crmJobs'], (old) =>
                old?.map((j) => j.id === job.id ? { ...j, installStatus: status } : j)
            );
            return { previous };
        },
        onError: (err, status, context) => {
            if (context?.previous) queryClient.setQueryData(['crmJobs'], context.previous);
            toast.error(err.message || 'Failed to update install status');
        },
        onSuccess: (_, status) => {
            toast.success(status === 'installed' ? 'Installed! Job auto-marked as Sold.' : 'Install status updated');
            onClose();
            onUpdate?.();
        }
    });

    if (!job) return null;

    const handleMarkSold = async () => {
        if (!activeSignature) {
            toast.error('Re-sign required. No active signature found.');
            return;
        }

        setIsUpdating(true);
        try {
            const user = await base44.auth.me();
            const settings = await base44.entities.CompanySettings.filter({});
            
            if (!settings[0]?.id) {
                throw new Error('Company settings not found. Please contact support.');
            }
            
            const result = await markJobSold({
                companyId: settings[0].id,
                jobId: job.id,
                userId: user.id,
                reason: 'Manually marked sold via Status Drawer'
            });
            
            console.log('[StatusDrawer] Mark sold result:', result);
            
            toast.success('Job marked as Sold');
            
            // CRITICAL: Trigger dashboard refresh
            await onUpdate?.();
            
            window.dispatchEvent(new CustomEvent('crm_job_updated', { 
                detail: { jobId: job.id, field: 'saleStatus' } 
            }));
        } catch (error) {
            console.error('[StatusDrawer] Mark sold error:', error);
            toast.error(error.message || 'Failed to mark job as sold');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleMarkUnsold = async () => {
        // GUARDRAIL: Cannot mark installed or paid jobs unsold
        if (job.installStatus === 'installed') {
            toast.error('Cannot mark installed jobs unsold. Use Void Sale from admin panel.');
            return;
        }
        if (job.paymentStatus === 'payment_received') {
            toast.error('Cannot mark paid jobs unsold. Use Void Sale from admin panel.');
            return;
        }

        if (!unsoldReason.trim()) {
            toast.error('Please provide a reason');
            return;
        }

        setIsUpdating(true);
        try {
            const user = await base44.auth.me();
            const settings = await base44.entities.CompanySettings.filter({});
            
            if (!settings[0]?.id) {
                throw new Error('Company settings not found. Please contact support.');
            }
            
            await markJobUnsold({
                companyId: settings[0].id,
                jobId: job.id,
                userId: user.id,
                reason: unsoldReason,
                lossType: unsoldLossType
            });
            toast.success('Job marked as Unsold. Signature invalidated.');
            setUnsoldDialog(false);
            setUnsoldReason('');
            setUnsoldLossType('sale_lost');
            onUpdate?.();
        } catch (error) {
            toast.error(error.message || 'Failed to mark job as unsold');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleVoidSale = async () => {
        if (!voidReason.trim()) {
            toast.error('Please provide a reason for voiding sale');
            return;
        }

        setIsUpdating(true);
        try {
            const user = await base44.auth.me();
            const now = new Date().toISOString();
            
            await base44.entities.CRMJob.update(job.id, {
                saleVoidedAt: now,
                saleVoidedReason: voidReason,
                saleVoidedByUserId: user.id
            });

            toast.success('Sale voided. Job excluded from reporting.');
            setVoidSaleDialog(false);
            setVoidReason('');
            onUpdate?.();
        } catch (error) {
            toast.error(error.message || 'Failed to void sale');
        } finally {
            setIsUpdating(false);
        }
    };

    const handlePaymentStatus = (status) => {
        paymentStatusMutation.mutate(status);
    };

    const handleInstallStatus = (status) => {
        installStatusMutation.mutate(status);
    };

    const getContractBadge = () => {
        if (job.contractStatus === 'signed') return <Badge className="bg-green-100 text-green-800">Signed</Badge>;
        if (job.contractStatus === 'invalidated') return <Badge variant="destructive">Needs Re-Sign</Badge>;
        return <Badge variant="outline">Unsigned</Badge>;
    };

    const getSaleBadge = () => {
        if (job.saleStatus === 'sold') return <Badge className="bg-green-100 text-green-800">Sold</Badge>;
        if (job.lossType === 'demo_no_sale') return <Badge variant="secondary">Demo No-Sale</Badge>;
        if (job.lossType === 'sale_lost') return <Badge variant="destructive">Sale Lost</Badge>;
        return <Badge variant="outline">Unsold</Badge>;
    };

    const getPaymentBadge = () => {
        if (job.paymentStatus === 'payment_received') return <Badge className="bg-green-100 text-green-800">Received</Badge>;
        if (job.paymentStatus === 'payment_pending') return <Badge variant="secondary">Pending</Badge>;
        return <Badge variant="outline">N/A</Badge>;
    };

    const getInstallBadge = () => {
        if (job.installStatus === 'installed') return <Badge className="bg-green-100 text-green-800">Installed</Badge>;
        if (job.installStatus === 'not_installed') return <Badge variant="outline">Not Installed</Badge>;
        return <Badge variant="outline">N/A</Badge>;
    };

    return (
        <>
            <Sheet open={open} onOpenChange={onClose}>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>Job Status</SheetTitle>
                    </SheetHeader>

                    <div className="space-y-6 mt-6">
                        {/* Contract Status */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Contract</Label>
                                {getContractBadge()}
                            </div>
                            {job.contractStatus === 'invalidated' && (
                                <div className="space-y-2">
                                    <p className="text-sm text-amber-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        Re-signature required
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="default"
                                        onClick={() => navigate(createPageUrl('Proposal') + `?jobId=${job.id}`)}
                                        className="w-full"
                                    >
                                        <FileSignature className="w-4 h-4 mr-2" />
                                        Sign Proposal
                                    </Button>
                                </div>
                            )}
                            {job.contractStatus === 'unsigned' && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(createPageUrl('Proposal') + `?jobId=${job.id}`)}
                                    className="w-full"
                                >
                                    <FileSignature className="w-4 h-4 mr-2" />
                                    Sign Proposal
                                </Button>
                            )}
                        </div>

                        {/* Sale Outcome */}
                         <div className="space-y-2">
                             <div className="flex items-center justify-between">
                                 <Label className="text-sm font-semibold">Sale Outcome</Label>
                                 {getSaleBadge()}
                             </div>
                             {isSoldForReporting(job) && (
                                 <p className="text-sm text-emerald-600">✓ Counts toward KPIs</p>
                             )}
                             {job.saleVoidedAt && (
                                 <p className="text-sm text-red-600">✗ Sale voided - excluded from KPIs</p>
                             )}
                             <div className="flex gap-2 flex-wrap">
                                 {job.saleStatus !== 'sold' && (
                                     <Button
                                         size="sm"
                                         variant="outline"
                                         onClick={handleMarkSold}
                                         disabled={isUpdating}
                                         className="flex-1"
                                     >
                                         <CheckCircle className="w-4 h-4 mr-1" />
                                         Mark Sold
                                     </Button>
                                 )}
                                 {!(job.installStatus === 'installed' || job.paymentStatus === 'payment_received') && (
                                     <Button
                                         size="sm"
                                         variant="outline"
                                         onClick={() => setUnsoldDialog(true)}
                                         disabled={isUpdating}
                                         className="flex-1"
                                     >
                                         <XCircle className="w-4 h-4 mr-1" />
                                         Mark Unsold
                                     </Button>
                                 )}
                                 {(job.installStatus === 'installed' || job.paymentStatus === 'payment_received') && !job.saleVoidedAt && (
                                     <Button
                                         size="sm"
                                         variant="destructive"
                                         onClick={() => setVoidSaleDialog(true)}
                                         disabled={isUpdating}
                                         className="flex-1"
                                     >
                                         <AlertTriangle className="w-4 h-4 mr-1" />
                                         Void Sale
                                     </Button>
                                 )}
                             </div>
                         </div>

                        {/* Payment Status */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Payment</Label>
                                {getPaymentBadge()}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handlePaymentStatus('payment_pending')}
                                    disabled={paymentStatusMutation.isPending}
                                    className="flex-1"
                                >
                                    <DollarSign className="w-4 h-4 mr-1" />
                                    Pending
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handlePaymentStatus('payment_received')}
                                    disabled={paymentStatusMutation.isPending}
                                    className="flex-1"
                                >
                                    <DollarSign className="w-4 h-4 mr-1" />
                                    Received
                                </Button>
                            </div>
                        </div>

                        {/* Install Status */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Installation</Label>
                                {getInstallBadge()}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleInstallStatus('not_installed')}
                                    disabled={installStatusMutation.isPending}
                                    className="flex-1"
                                >
                                    <Package className="w-4 h-4 mr-1" />
                                    Not Installed
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleInstallStatus('installed')}
                                    disabled={installStatusMutation.isPending}
                                    className="flex-1"
                                >
                                    <Package className="w-4 h-4 mr-1" />
                                    Installed
                                </Button>
                            </div>
                        </div>
                    </div>

                    <SheetFooter className="mt-6">
                        <Button variant="outline" onClick={onClose} className="w-full">
                            Close
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Mark Unsold Dialog */}
            <Dialog open={unsoldDialog} onOpenChange={setUnsoldDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mark Job as Unsold</DialogTitle>
                        <DialogDescription>
                            This will invalidate the current signature and require re-sign.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Loss Type *</Label>
                            <Select value={unsoldLossType} onValueChange={setUnsoldLossType}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="demo_no_sale">Demo No-Sale</SelectItem>
                                    <SelectItem value="sale_lost">Sale Lost</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Reason *</Label>
                            <Textarea
                                value={unsoldReason}
                                onChange={(e) => setUnsoldReason(e.target.value)}
                                placeholder="Enter reason for marking unsold..."
                                className="mt-1"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUnsoldDialog(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleMarkUnsold} disabled={isUpdating}>
                            Mark Unsold
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Void Sale Dialog */}
            <Dialog open={voidSaleDialog} onOpenChange={setVoidSaleDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                            Void Sale (Admin Only)
                        </DialogTitle>
                        <DialogDescription>
                            This will exclude the job from KPIs and reporting, even though it's installed/paid.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Admin Reason *</Label>
                            <Textarea
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                placeholder="Enter reason for voiding sale..."
                                className="mt-1"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setVoidSaleDialog(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleVoidSale} disabled={isUpdating}>
                            Void Sale
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}