import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Target, Users, Calendar, TrendingUp, Save } from "lucide-react";
import { toast } from "react-hot-toast";
import { getOrCreateGoalSettings, computeGoalsForRange } from "../components/services/dashboardGoalEngine";
import PageLayout from '@/components/layout/PageLayout';
import PageHeader from '@/components/layout/PageHeader';
import SectionCard from '@/components/layout/SectionCard';
import SkeletonCard from '@/components/skeletons/SkeletonCard';
import PullToRefresh from '@/components/mobile/PullToRefresh';

export default function AdminGoals() {
    const queryClient = useQueryClient();
    
    // Fetch company settings
    const { data: companySettings = [] } = useQuery({
        queryKey: ['companySettings'],
        queryFn: () => base44.entities.CompanySettings.filter({}),
        initialData: []
    });
    const company = companySettings?.[0];
    const companyId = company?.id;
    
    // Fetch goal settings
    const { data: goalSettings, isLoading } = useQuery({
        queryKey: ['goalSettings', companyId],
        queryFn: () => getOrCreateGoalSettings(companyId),
        enabled: !!companyId,
        retry: 1
    });
    
    // Form state
    const [formData, setFormData] = useState({
        dailyRevenueGoal: 18000,
        netProfitGoalPercent: 20,
        grossMarginGoalPercent: 45,
        closeRateGoalPercent: 30,
        jobsPerLeadDayGoal: 1,
        appointmentsPerLeadDayGoal: 1,
        demosPerLeadDayGoal: 1,
        salesRepCount: 1,
        runLeadsMon: true,
        runLeadsTue: true,
        runLeadsWed: true,
        runLeadsThu: true,
        runLeadsFri: true,
        runLeadsSatEveryOther: true,
        saturdayCadenceAnchorDate: '2026-01-04',
        netMarginWoodPercent: 30,
        netMarginVinylPercent: 20,
        netMarginChainLinkPercent: 20,
        netMarginAluminumPercent: 20
    });
    
    // Update form when settings load
    useEffect(() => {
        if (goalSettings) {
            setFormData(goalSettings);
        }
    }, [goalSettings]);
    
    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            await base44.entities.DashboardGoalSettings.update(goalSettings.id, formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['goalSettings']);
            toast.success('Goals saved successfully');
        },
        onError: (error) => {
            toast.error('Failed to save: ' + error.message);
        }
    });
    
    // Compute preview goals for different ranges (memoized to prevent re-renders)
    const previews = useMemo(() => {
        const now = new Date();
        const ranges = [
            { 
                label: 'Today', 
                start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                end: new Date(now.getFullYear(), now.getMonth(), now.getDate())
            },
            {
                label: 'This Week',
                start: (() => {
                    const d = new Date(now);
                    d.setDate(now.getDate() - now.getDay());
                    return d;
                })(),
                end: now
            },
            {
                label: 'Last 30 Days',
                start: (() => {
                    const d = new Date(now);
                    d.setDate(now.getDate() - 30);
                    return d;
                })(),
                end: now
            },
            {
                label: 'This Month',
                start: new Date(now.getFullYear(), now.getMonth(), 1),
                end: now
            },
            {
                label: 'This Quarter',
                start: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
                end: now
            }
        ];
        
        return ranges.map(range => ({
            label: range.label,
            ...computeGoalsForRange(range.start, range.end, formData)
        }));
    }, [formData]);

    const handlePullToRefresh = async () => {
        await queryClient.invalidateQueries({ queryKey: ['goalSettings'] });
        await queryClient.invalidateQueries({ queryKey: ['companySettings'] });
        await queryClient.refetchQueries({ queryKey: ['goalSettings'] });
    };
    
    if (isLoading) {
        return (
            <PageLayout variant="dark" maxWidth="7xl" padding="lg">
                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        {[...Array(4)].map((_, i) => <SkeletonCard key={i} theme="dark" />)}
                    </div>
                    <SkeletonCard theme="dark" />
                </div>
            </PageLayout>
        );
    }
    
    return (
        <PullToRefresh onRefresh={handlePullToRefresh}>
            <PageLayout variant="dark" maxWidth="7xl" padding="lg">
                <PageHeader
                variant="gradient"
                title="Dashboard Goals"
                subtitle="Configure company-wide performance targets"
                className="gradient-header"
                actionsSlot={
                    <Button 
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        variant="teal"
                        size="sm"
                    >
                        {saveMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Goals
                    </Button>
                }
            />

            <div className="space-y-6">
                
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left Column - Settings */}
                    <div className="space-y-6">
                        {/* Revenue Goals */}
                        <SectionCard 
                            title={<div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#006FBA]" />Revenue Goals</div>}
                            theme="dark"
                        >
                            <div className="space-y-4 p-6 bg-slate-950/80 rounded-lg">
                                <div>
                                    <Label className="text-slate-100">Daily Revenue Goal ($)</Label>
                                    <Input
                                        type="number"
                                        value={formData.dailyRevenueGoal}
                                        onChange={(e) => setFormData({...formData, dailyRevenueGoal: Number(e.target.value)})}
                                        size="md"
                                        variant="dark"
                                        className="mt-2"
                                    />
                                    <p className="text-xs text-slate-300 mt-1">
                                        Revenue goals scale by lead days in the selected range
                                    </p>
                                </div>
                            </div>
                        </SectionCard>
                        
                        {/* Margin Goals */}
                        <SectionCard 
                            title={<div className="flex items-center gap-2"><Target className="w-5 h-5 text-[#006FBA]" />Margin Goals</div>}
                            theme="dark"
                        >
                            <div className="space-y-4 p-6 bg-slate-950/80 rounded-lg">
                                <div>
                                    <Label className="text-slate-100">Net Margin Goal (%)</Label>
                                    <Input
                                        type="number"
                                        value={formData.netProfitGoalPercent}
                                        onChange={(e) => setFormData({...formData, netProfitGoalPercent: Number(e.target.value)})}
                                        size="md"
                                        variant="dark"
                                        className="mt-2"
                                    />
                                </div>
                                <div>
                                    <Label className="text-slate-100">Gross Margin Goal (%)</Label>
                                    <Input
                                        type="number"
                                        value={formData.grossMarginGoalPercent}
                                        onChange={(e) => setFormData({...formData, grossMarginGoalPercent: Number(e.target.value)})}
                                        size="md"
                                        variant="dark"
                                        className="mt-2"
                                    />
                                </div>
                                <div>
                                    <Label className="text-slate-100">Close Rate Goal (%)</Label>
                                    <Input
                                        type="number"
                                        value={formData.closeRateGoalPercent}
                                        onChange={(e) => setFormData({...formData, closeRateGoalPercent: Number(e.target.value)})}
                                        size="md"
                                        variant="dark"
                                        className="mt-2"
                                    />
                                </div>
                            </div>
                        </SectionCard>
                        
                        {/* Material-Specific Net Margin Goals */}
                        <SectionCard 
                            title={<div className="flex items-center gap-2"><Target className="w-5 h-5 text-[#52AE22]" />Net Margin by Material Type (%)</div>}
                            theme="dark"
                        >
                            <div className="space-y-4 p-6 bg-slate-950/80 rounded-lg">
                                <div>
                                    <Label className="text-slate-100">Wood Net Margin (%)</Label>
                                    <Input
                                        type="number"
                                        value={formData.netMarginWoodPercent || 30}
                                        onChange={(e) => setFormData({...formData, netMarginWoodPercent: Number(e.target.value)})}
                                        size="md"
                                        variant="dark"
                                        className="mt-2"
                                    />
                                </div>
                                <div>
                                    <Label className="text-slate-100">Vinyl Net Margin (%)</Label>
                                    <Input
                                        type="number"
                                        value={formData.netMarginVinylPercent || 20}
                                        onChange={(e) => setFormData({...formData, netMarginVinylPercent: Number(e.target.value)})}
                                        size="md"
                                        variant="dark"
                                        className="mt-2"
                                    />
                                </div>
                                <div>
                                    <Label className="text-slate-100">Chain Link Net Margin (%)</Label>
                                    <Input
                                        type="number"
                                        value={formData.netMarginChainLinkPercent || 20}
                                        onChange={(e) => setFormData({...formData, netMarginChainLinkPercent: Number(e.target.value)})}
                                        size="md"
                                        variant="dark"
                                        className="mt-2"
                                    />
                                </div>
                                <div>
                                    <Label className="text-slate-100">Aluminum Net Margin (%)</Label>
                                    <Input
                                        type="number"
                                        value={formData.netMarginAluminumPercent || 20}
                                        onChange={(e) => setFormData({...formData, netMarginAluminumPercent: Number(e.target.value)})}
                                        size="md"
                                        variant="dark"
                                        className="mt-2"
                                    />
                                </div>
                            </div>
                        </SectionCard>
                        
                        {/* Activity Goals */}
                        <SectionCard 
                            title={<div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-[#006FBA]" />Activity Goals (per lead day)</div>}
                            theme="dark"
                        >
                            <div className="space-y-4 p-6 bg-slate-950/80 rounded-lg">
                                <div>
                                    <Label className="text-slate-100">Jobs Sold / day</Label>
                                    <Input
                                        type="number"
                                        value={formData.jobsPerLeadDayGoal}
                                        onChange={(e) => setFormData({...formData, jobsPerLeadDayGoal: Number(e.target.value)})}
                                        size="md"
                                        variant="dark"
                                        className="mt-2"
                                    />
                                </div>
                                <div>
                                    <Label className="text-slate-100">Appointments / day</Label>
                                    <Input
                                        type="number"
                                        value={formData.appointmentsPerLeadDayGoal}
                                        onChange={(e) => setFormData({...formData, appointmentsPerLeadDayGoal: Number(e.target.value)})}
                                        size="md"
                                        variant="dark"
                                        className="mt-2"
                                    />
                                </div>
                                <div>
                                    <Label className="text-slate-100">Demos Run / day</Label>
                                    <Input
                                        type="number"
                                        value={formData.demosPerLeadDayGoal}
                                        onChange={(e) => setFormData({...formData, demosPerLeadDayGoal: Number(e.target.value)})}
                                        size="md"
                                        variant="dark"
                                        className="mt-2"
                                    />
                                </div>
                            </div>
                        </SectionCard>
                        
                        {/* Team Capacity */}
                        <SectionCard 
                            title={<div className="flex items-center gap-2"><Users className="w-5 h-5 text-orange-400" />Team Capacity</div>}
                            theme="dark"
                        >
                            <div className="p-6 bg-slate-950/80 rounded-lg">
                                <div>
                                    <Label className="text-slate-100">Number of Sales Reps</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={formData.salesRepCount}
                                        onChange={(e) => setFormData({...formData, salesRepCount: Math.max(1, Number(e.target.value))})}
                                        size="md"
                                        variant="dark"
                                        className="mt-2"
                                    />
                                    <p className="text-xs text-slate-300 mt-1">
                                        Per-rep goals are derived from company goals ÷ reps
                                    </p>
                                </div>
                            </div>
                        </SectionCard>
                        
                        {/* Lead Schedule */}
                        <SectionCard title="Lead Schedule" theme="dark">
                            <div className="space-y-4 p-6 bg-slate-950/80 rounded-lg">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-slate-100">Monday</Label>
                                        <Switch
                                            checked={formData.runLeadsMon}
                                            onCheckedChange={(checked) => setFormData({...formData, runLeadsMon: checked})}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label className="text-slate-100">Tuesday</Label>
                                        <Switch
                                            checked={formData.runLeadsTue}
                                            onCheckedChange={(checked) => setFormData({...formData, runLeadsTue: checked})}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label className="text-slate-100">Wednesday</Label>
                                        <Switch
                                            checked={formData.runLeadsWed}
                                            onCheckedChange={(checked) => setFormData({...formData, runLeadsWed: checked})}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label className="text-slate-100">Thursday</Label>
                                        <Switch
                                            checked={formData.runLeadsThu}
                                            onCheckedChange={(checked) => setFormData({...formData, runLeadsThu: checked})}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label className="text-slate-100">Friday</Label>
                                        <Switch
                                            checked={formData.runLeadsFri}
                                            onCheckedChange={(checked) => setFormData({...formData, runLeadsFri: checked})}
                                        />
                                    </div>
                                    <div className="border-t border-slate-700 pt-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-slate-100">Run leads every other Saturday</Label>
                                            <Switch
                                                checked={formData.runLeadsSatEveryOther}
                                                onCheckedChange={(checked) => setFormData({...formData, runLeadsSatEveryOther: checked})}
                                            />
                                        </div>
                                    </div>
                                    {formData.runLeadsSatEveryOther && (
                                        <div>
                                            <Label className="text-slate-100">Anchor Saturday (ON week)</Label>
                                            <Input
                                                type="date"
                                                value={formData.saturdayCadenceAnchorDate}
                                                onChange={(e) => setFormData({...formData, saturdayCadenceAnchorDate: e.target.value})}
                                                size="md"
                                                variant="dark"
                                                className="mt-2"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SectionCard>
                    </div>
                    
                    {/* Right Column - Live Preview */}
                    <div>
                        <SectionCard title="Live Preview" theme="dark" className="sticky top-6">
                            <div className="space-y-6 p-6 bg-slate-950/80 rounded-lg">
                                {previews.map((preview, idx) => (
                                    <div key={idx} className="border-b border-slate-700 pb-4 last:border-b-0">
                                        <div className="font-semibold text-white mb-3 flex items-center justify-between">
                                            <span>{preview.label}</span>
                                            <span className="text-xs text-slate-300">{preview.leadDays} lead days</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                               <div className="text-xs text-white mb-2 font-semibold">Company Goals</div>
                                               <div className="space-y-1.5 text-xs">
                                                   <div className="flex justify-between">
                                                       <span className="text-white">Revenue</span>
                                                       <span className="font-semibold text-white">${(preview.company.revenueGoal / 1000).toFixed(0)}k</span>
                                                   </div>
                                                   <div className="flex justify-between">
                                                       <span className="text-white">Net Profit</span>
                                                       <span className="font-semibold text-white">${(preview.company.netProfitGoal / 1000).toFixed(0)}k</span>
                                                   </div>
                                                   <div className="flex justify-between">
                                                       <span className="text-white">Gross Margin</span>
                                                       <span className="font-semibold text-white">{preview.company.grossMarginGoalPercent}%</span>
                                                   </div>
                                                   <div className="flex justify-between">
                                                       <span className="text-white">Jobs</span>
                                                       <span className="font-semibold text-white">{preview.company.jobsGoal}</span>
                                                   </div>
                                                   <div className="flex justify-between">
                                                       <span className="text-white">Appointments</span>
                                                       <span className="font-semibold text-white">{preview.company.appointmentsGoal}</span>
                                                   </div>
                                                   <div className="flex justify-between">
                                                       <span className="text-white">Demos</span>
                                                       <span className="font-semibold text-white">{preview.company.demosGoal}</span>
                                                   </div>
                                               </div>
                                           </div>

                                           <div>
                                               <div className="text-xs text-white mb-2 font-semibold">Per-Rep Goals</div>
                                               <div className="space-y-1.5 text-xs">
                                                   <div className="flex justify-between">
                                                       <span className="text-white">Revenue</span>
                                                       <span className="font-semibold text-white">${(preview.perRep.revenueGoalPerRep / 1000).toFixed(0)}k</span>
                                                   </div>
                                                   <div className="flex justify-between">
                                                       <span className="text-white">Jobs</span>
                                                       <span className="font-semibold text-white">{preview.perRep.jobsGoalPerRep.toFixed(1)}</span>
                                                   </div>
                                                   <div className="flex justify-between">
                                                       <span className="text-white">Appointments</span>
                                                       <span className="font-semibold text-white">{preview.perRep.appointmentsGoalPerRep.toFixed(1)}</span>
                                                   </div>
                                                   <div className="flex justify-between">
                                                       <span className="text-white">Demos</span>
                                                       <span className="font-semibold text-white">{preview.perRep.demosGoalPerRep.toFixed(1)}</span>
                                                   </div>
                                               </div>
                                           </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </PageLayout>
        </PullToRefresh>
    );
}