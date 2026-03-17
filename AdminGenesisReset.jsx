import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle2, BarChart3, Zap } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';

export default function AdminGenesisReset() {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [healthReport, setHealthReport] = useState(null);

    React.useEffect(() => {
        const loadUser = async () => {
            const u = await base44.auth.me();
            setUser(u);
        };
        loadUser();
    }, []);

    // Fetch company list
    const { data: companies = [], isLoading: companiesLoading, error: companiesError } = useQuery({
        queryKey: ['companies'],
        queryFn: async () => {
            const result = await base44.entities.CompanySettings.list();
            return result;
        },
        enabled: !!user,
        retry: 2
    });

    // Health check mutation
    const healthCheckMutation = useMutation({
        mutationFn: async (companyId) => {
            console.log('Running health check for company:', companyId);
            const response = await base44.functions.invoke('genesisHealthCheck', { companyId });
            console.log('Health check response:', response);
            return response.data;
        },
        onSuccess: (data) => {
            console.log('Health check successful:', data);
            setHealthReport(data);
            toast.success('Health check complete');
        },
        onError: (error) => {
            console.error('Health check error:', error);
            toast.error('Health check failed: ' + error.message);
        }
    });

    // Genesis reset mutation
    const resetMutation = useMutation({
        mutationFn: async (companyId) => {
            const response = await base44.functions.invoke('genesisResetCompany', { 
                companyId,
                confirmed: true 
            });
            return response.data;
        },
        onSuccess: async (data) => {
            toast.success(`Genesis reset complete - ${JSON.stringify(data.deletedRecords)}`);
            setShowConfirmDialog(false);
            setSelectedCompanyId('');
            setHealthReport(null);
            await queryClient.invalidateQueries(['companies']);
            
            // Run health check after reset
            setTimeout(() => {
                healthCheckMutation.mutate(selectedCompanyId);
            }, 500);
        },
        onError: (error) => {
            toast.error('Reset failed: ' + error.message);
        }
    });

    // Seed mapping mutation
    const seedMutation = useMutation({
        mutationFn: async (companyId) => {
            console.log('Seeding from catalog for company:', companyId);
            const response = await base44.functions.invoke('seedCompanySkuMapFromCatalog', { companyId });
            console.log('Seed response:', response);
            return response.data;
        },
        onSuccess: (data, variables) => {
            console.log('Seed successful:', data);
            toast.success(`Seeded ${data.mappingsCreated} mappings`);
            setHealthReport(null);
            setTimeout(() => {
                console.log('Running health check for:', variables);
                healthCheckMutation.mutate(variables);
            }, 500);
        },
        onError: (error) => {
            console.error('Seed error:', error);
            toast.error('Seed failed: ' + error.message);
        }
    });

    // Enable genesis resolver mode
    const enableGenesisMutation = useMutation({
        mutationFn: async (companyId) => {
            const companySettings = companies.find(c => c.companyId === companyId);
            if (!companySettings) throw new Error('Company not found');
            await base44.entities.CompanySettings.update(companySettings.id, {
                genesisResolverMode: true
            });
        },
        onSuccess: () => {
            toast.success('Genesis resolver mode enabled');
            setHealthReport(null);
            setTimeout(() => {
                healthCheckMutation.mutate(selectedCompanyId);
            }, 500);
        },
        onError: (error) => {
            toast.error('Failed to enable genesis mode: ' + error.message);
        }
    });

    // Create missing catalog items
    const createMissingMutation = useMutation({
        mutationFn: async (companyId) => {
            console.log('Creating missing catalog items for company:', companyId);
            const response = await base44.functions.invoke('createMissingCatalogItems', { companyId });
            console.log('Create missing items response:', response);
            return response.data;
        },
        onSuccess: (data) => {
            console.log('Created missing items:', data);
            toast.success(`Created ${data.createdCount} catalog items`);
            setHealthReport(null);
            setTimeout(() => {
                healthCheckMutation.mutate(selectedCompanyId);
            }, 500);
        },
        onError: (error) => {
            console.error('Create missing items error:', error);
            toast.error('Failed: ' + error.message);
        }
    });

    // Fix catalog pricing issues
    const fixIssuesMutation = useMutation({
        mutationFn: async (companyId) => {
            console.log('Fixing catalog issues for company:', companyId);
            const response = await base44.functions.invoke('fixMappingCatalogIssues', { companyId });
            console.log('Fix issues response:', response);
            return response.data;
        },
        onSuccess: (data) => {
            console.log('Fixed issues:', data);
            toast.success(`Fixed pricing on ${data.zeroCostItemsFixed} items`);
            setHealthReport(null);
            setTimeout(() => {
                healthCheckMutation.mutate(selectedCompanyId);
            }, 500);
        },
        onError: (error) => {
            console.error('Fix issues error:', error);
            toast.error('Failed: ' + error.message);
        }
    });

    if (user?.role !== 'admin') {
        return (
            <div className="p-6">
                <Alert className="border-red-500 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                        Admin access required
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen p-6">
            <div className="max-w-6xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-slate-900">Genesis Reset Control</h1>
                    <p className="text-slate-600 mt-2">Eliminate unresolved materials and enforce strict V2 resolver rules.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* LEFT: Company Selection */}
                     <div className="lg:col-span-1">
                         <Card>
                             <CardHeader>
                                 <CardTitle className="text-lg">Select Company</CardTitle>
                             </CardHeader>
                             <CardContent className="space-y-2">
                                 {companiesLoading && <div className="text-sm text-slate-600">Loading companies...</div>}
                                 {companiesError && <Alert className="border-red-500 bg-red-50"><AlertDescription>{companiesError.message}</AlertDescription></Alert>}
                                 {!companiesLoading && companies.length === 0 && <div className="text-sm text-slate-600">No companies found</div>}
                                 {companies.map((company) => (
                                    <button
                                        key={company.id}
                                        onClick={() => {
                                            setSelectedCompanyId(company.companyId);
                                            setHealthReport(null);
                                        }}
                                        className={`w-full text-left p-3 rounded border transition-all ${
                                            selectedCompanyId === company.companyId
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-slate-200 bg-white hover:border-blue-300'
                                        }`}
                                    >
                                        <div className="font-medium text-sm">{company.companyName}</div>
                                        <div className="text-xs text-slate-500 mt-1">{company.id}</div>
                                    </button>
                                ))}
                            </CardContent>
                        </Card>

                        {selectedCompanyId && (
                            <div className="mt-4 space-y-3">
                                <Button
                                    onClick={() => healthCheckMutation.mutate(selectedCompanyId)}
                                    disabled={healthCheckMutation.isPending}
                                    className="w-full"
                                    variant="outline"
                                >
                                    {healthCheckMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Checking...
                                        </>
                                    ) : (
                                        <>
                                            <BarChart3 className="w-4 h-4 mr-2" />
                                            Run Health Check
                                        </>
                                    )}
                                </Button>

                                <Button
                                    onClick={() => setShowConfirmDialog(true)}
                                    disabled={resetMutation.isPending}
                                    className="w-full bg-red-600 hover:bg-red-700"
                                >
                                    {resetMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Resetting...
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="w-4 h-4 mr-2" />
                                            Genesis Reset
                                        </>
                                    )}
                                </Button>

                                <Button
                                    onClick={() => seedMutation.mutate(selectedCompanyId)}
                                    disabled={seedMutation.isPending}
                                    className="w-full"
                                    variant="outline"
                                >
                                    {seedMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Seeding...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Seed Mappings
                                        </>
                                    )}
                                </Button>

                                <Button
                                    onClick={() => enableGenesisMutation.mutate(selectedCompanyId)}
                                    disabled={enableGenesisMutation.isPending}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                                >
                                    {enableGenesisMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Enabling...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Enable Genesis Mode
                                        </>
                                    )}
                                </Button>

                                <Button
                                    onClick={() => createMissingMutation.mutate(selectedCompanyId)}
                                    disabled={createMissingMutation.isPending}
                                    className="w-full"
                                    variant="outline"
                                >
                                    {createMissingMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Create Missing Items
                                        </>
                                    )}
                                </Button>

                                <Button
                                    onClick={() => fixIssuesMutation.mutate(selectedCompanyId)}
                                    disabled={fixIssuesMutation.isPending}
                                    className="w-full"
                                    variant="outline"
                                >
                                    {fixIssuesMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Fixing...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Fix Pricing Issues
                                        </>
                                    )}
                                </Button>
                                </div>
                                )}
                    </div>

                    {/* RIGHT: Health Report */}
                    <div className="lg:col-span-2">
                        {healthReport ? (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">Health Report</CardTitle>
                                        <Badge
                                            className={
                                                healthReport.healthStatus === 'HEALTHY'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-amber-100 text-amber-800'
                                            }
                                        >
                                            {healthReport.healthStatus}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 p-3 rounded">
                                            <div className="text-xs text-slate-600">Catalog Items</div>
                                            <div className="text-2xl font-bold">{healthReport.counts.approvedCatalogItems}</div>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded">
                                            <div className="text-xs text-slate-600">Total Mappings</div>
                                            <div className="text-2xl font-bold">{healthReport.counts.totalCompanySkuMappings}</div>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded">
                                            <div className="text-xs text-slate-600">Locked</div>
                                            <div className="text-2xl font-bold text-green-600">{healthReport.counts.lockedMappings}</div>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded">
                                            <div className="text-xs text-slate-600">Unlocked</div>
                                            <div className="text-2xl font-bold text-amber-600">{healthReport.counts.unlockedMappings}</div>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded">
                                            <div className="text-xs text-slate-600">Unresolved</div>
                                            <div className="text-2xl font-bold text-red-600">{healthReport.counts.unmappedItemsCount}</div>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded">
                                            <div className="text-xs text-slate-600">Orphaned UCKs</div>
                                            <div className="text-2xl font-bold text-red-600">{healthReport.counts.orphanedUckCount}</div>
                                        </div>
                                    </div>

                                    {/* Settings */}
                                    <div className="border-t pt-4">
                                        <div className="text-sm font-semibold mb-2">Genesis Settings</div>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span>genesisResolverMode</span>
                                                <Badge variant={healthReport.settings.genesisResolverMode ? 'default' : 'outline'}>
                                                    {healthReport.settings.genesisResolverMode ? 'ON' : 'OFF'}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>useMaterialCatalogOnly</span>
                                                <Badge variant={healthReport.settings.useMaterialCatalogOnly ? 'default' : 'outline'}>
                                                    {healthReport.settings.useMaterialCatalogOnly ? 'ON' : 'OFF'}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>useUniversalResolver</span>
                                                <Badge variant={healthReport.settings.useUniversalResolver ? 'default' : 'outline'}>
                                                    {healthReport.settings.useUniversalResolver ? 'ON' : 'OFF'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pricing Block Explanation */}
                                     <div className="border-t pt-4">
                                         <div className="text-sm font-semibold mb-2 text-slate-900">Why is pricing blocked?</div>
                                         <div className="space-y-1 text-xs text-slate-700">
                                             <div>• <strong>UCK_NOT_FOUND:</strong> Canonical key not in MaterialCatalog</div>
                                             <div>• <strong>UNIT_MISMATCH:</strong> Mapping exists but unit doesn't match</div>
                                             <div>• <strong>COMPANY_MISMATCH:</strong> Mapping exists under different company</div>
                                             <div className="mt-2">Run "Seed from Catalog" or manually map in Fence System Config.</div>
                                         </div>
                                     </div>

                                    {/* Issues */}
                                     {healthReport.issues.length > 0 && (
                                         <div className="border-t pt-4">
                                             <div className="text-sm font-semibold mb-2 text-amber-900">Issues</div>
                                             <div className="space-y-1 text-xs text-amber-700">
                                                 {healthReport.issues.map((issue, idx) => (
                                                     <div key={idx} className="flex items-start gap-2">
                                                         <span className="mt-1">•</span>
                                                         <span>{issue}</span>
                                                     </div>
                                                 ))}
                                             </div>
                                         </div>
                                     )}

                                    {/* Orphaned UCKs */}
                                    {healthReport.orphanedUcks.length > 0 && (
                                        <div className="border-t pt-4">
                                            <div className="text-sm font-semibold mb-2">Sample Orphaned UCKs</div>
                                            <div className="space-y-1 text-xs font-mono bg-slate-100 p-2 rounded">
                                                {healthReport.orphanedUcks.map((uck, idx) => (
                                                    <div key={idx}>{uck}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardContent className="pt-6 text-center text-slate-500">
                                    Select a company and run health check
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-700">
                            <AlertTriangle className="w-5 h-5" />
                            Confirm Genesis Reset
                        </DialogTitle>
                        <DialogDescription>
                            This will permanently delete:
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 text-sm">
                        <div className="bg-red-50 p-3 rounded space-y-1 text-red-800">
                            <div>✗ ALL unresolved materials</div>
                            <div>✗ ALL TakeoffSnapshot records</div>
                            <div>✗ ALL JobCostSnapshot records</div>
                            <div>✗ ALL unlocked CompanySkuMap entries</div>
                            <div>✗ Job snapshot references</div>
                        </div>
                        <div className="text-xs text-slate-600 mt-4">
                            Locked mappings will be preserved.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowConfirmDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => {
                                resetMutation.mutate(selectedCompanyId);
                            }}
                            disabled={resetMutation.isPending}
                        >
                            {resetMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Processing...
                                </>
                            ) : (
                                'Confirm Reset'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}