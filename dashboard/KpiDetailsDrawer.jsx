import React from 'react';
import { X, Calendar, Users, CheckCircle2, DollarSign, TrendingUp, Target, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const KPI_CONFIG = {
    appointments: {
        title: 'Appointments',
        icon: Calendar,
        color: '#3b82f6'
    },
    demos: {
        title: 'Demos Run',
        icon: Users,
        color: '#8b5cf6'
    },
    sold: {
        title: 'Jobs Sold',
        icon: CheckCircle2,
        color: '#10b981'
    },
    revenue: {
        title: 'Revenue',
        icon: DollarSign,
        color: '#10b981'
    },
    margin: {
        title: 'Net Margin',
        icon: TrendingUp,
        color: '#f59e0b'
    },
    close_rate: {
        title: 'Close Rate',
        icon: Target,
        color: '#6366f1'
    },
    upsell: {
        title: 'Upsell Delta',
        icon: TrendingUp,
        color: '#10b981'
    },
    upsell_upside: {
        title: 'Upsell Upside',
        icon: TrendingUp,
        color: '#059669'
    },
    price_integrity: {
        title: 'Price Integrity',
        icon: CheckCircle2,
        color: '#10b981'
    },
    override_rate: {
        title: 'Override Rate',
        icon: AlertCircle,
        color: '#f59e0b'
    },
    avg_upsell: {
        title: 'Avg Upsell',
        icon: TrendingUp,
        color: '#059669'
    },
    net_reliability: {
        title: 'Net Reliability',
        icon: TrendingUp,
        color: '#10b981'
    }
};

export default function KpiDetailsDrawer({ isOpen, onClose, kpiKey, data }) {
    if (!isOpen || !kpiKey) return null;

    const config = KPI_CONFIG[kpiKey];
    const Icon = config?.icon || Calendar;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/40 z-40 transition-opacity"
                onClick={onClose}
            />
            
            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 overflow-y-auto transform transition-transform">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-slate-700 to-slate-600 text-white p-6 shadow-lg" style={{ background: `linear-gradient(135deg, ${config?.color || '#64748b'}, ${config?.color || '#64748b'}DD)` }}>
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Icon className="w-6 h-6" />
                                {config?.title || 'KPI Details'}
                            </h2>
                            <p className="text-white/90 text-sm mt-1">
                                Detailed breakdown and diagnostics
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-white hover:bg-white/20 -mr-2"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {kpiKey === 'appointments' && <AppointmentsContent data={data} />}
                    {kpiKey === 'demos' && <DemosContent data={data} />}
                    {kpiKey === 'sold' && <SoldContent data={data} />}
                    {kpiKey === 'revenue' && <RevenueContent data={data} />}
                    {kpiKey === 'margin' && <MarginContent data={data} />}
                    {kpiKey === 'close_rate' && <CloseRateContent data={data} />}
                    {kpiKey === 'upsell' && <UpsellContent data={data} />}
                    {kpiKey === 'upsell_upside' && <UpsellUpsideContent data={data} />}
                    {kpiKey === 'price_integrity' && <PriceIntegrityContent data={data} />}
                    {kpiKey === 'override_rate' && <OverrideRateContent data={data} />}
                    {kpiKey === 'avg_upsell' && <AvgUpsellContent data={data} />}
                    {kpiKey === 'net_reliability' && <NetReliabilityContent data={data} />}
                </div>
            </div>
        </>
    );
}

function AppointmentsContent({ data }) {
    const {
        totalAppointments = 0,
        scheduledCount = 0,
        completedCount = 0,
        rescheduledCount = 0,
        cancelledCount = 0,
        upcomingList = []
    } = data || {};

    return (
        <>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                <div className="text-sm text-blue-700 font-medium mb-2">Total Appointments</div>
                <div className="text-4xl font-bold text-blue-900">{totalAppointments}</div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="text-xs text-slate-600 mb-1">Scheduled</div>
                    <div className="text-xl font-bold text-slate-900">{scheduledCount}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="text-xs text-green-700 mb-1">Completed</div>
                    <div className="text-xl font-bold text-green-900">{completedCount}</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="text-xs text-amber-700 mb-1">Rescheduled</div>
                    <div className="text-xl font-bold text-amber-900">{rescheduledCount}</div>
                </div>
            </div>

            {cancelledCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-sm text-red-900">
                        <span className="font-semibold">{cancelledCount}</span> cancelled (excluded)
                    </div>
                </div>
            )}

            {upcomingList && upcomingList.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900 text-sm">Upcoming Appointments</h3>
                    <div className="space-y-2">
                        {upcomingList.map((appt, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="font-semibold text-slate-900 text-sm">{appt.customerName}</div>
                                <div className="text-xs text-slate-600 mt-1">
                                    {appt.appointmentTime} • {appt.repName}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

function DemosContent({ data }) {
    const {
        demosRunCount = 0,
        noShowCount = 0,
        cancelledCount = 0,
        demoToSalePercent = 0,
        recentDemos = []
    } = data || {};

    return (
        <>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
                <div className="text-sm text-purple-700 font-medium mb-2">Demos Run</div>
                <div className="text-4xl font-bold text-purple-900">{demosRunCount}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <div className="text-xs text-red-700 mb-1">No-Shows</div>
                    <div className="text-xl font-bold text-red-900">{noShowCount}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="text-xs text-slate-600 mb-1">Cancelled</div>
                    <div className="text-xl font-bold text-slate-900">{cancelledCount}</div>
                </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="text-sm text-emerald-900">
                    Demo → Sale Conversion: <span className="font-semibold">{demoToSalePercent.toFixed(1)}%</span>
                </div>
            </div>

            {recentDemos && recentDemos.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900 text-sm">Recent Demos</h3>
                    <div className="space-y-2">
                        {recentDemos.map((demo, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="font-semibold text-slate-900 text-sm">{demo.jobNumber}</div>
                                        <div className="text-xs text-slate-600">{demo.customerName}</div>
                                    </div>
                                    <Badge className={demo.sold ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                                        {demo.sold ? 'Sold' : 'Not Sold'}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

function SoldContent({ data }) {
    const {
        jobsSoldCount = 0,
        signedCount = 0,
        installedCount = 0,
        paidOnlyCount = 0,
        voidedCount = 0,
        topJobsByRevenue = []
    } = data || {};

    return (
        <>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                <div className="text-sm text-green-700 font-medium mb-2">Jobs Sold</div>
                <div className="text-4xl font-bold text-green-900">{jobsSoldCount}</div>
            </div>

            <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">Breakdown by Status</div>
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <div className="text-xs text-blue-700 mb-1">Signed</div>
                        <div className="text-xl font-bold text-blue-900">{signedCount}</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                        <div className="text-xs text-purple-700 mb-1">Installed</div>
                        <div className="text-xl font-bold text-purple-900">{installedCount}</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                        <div className="text-xs text-amber-700 mb-1">Paid Only</div>
                        <div className="text-xl font-bold text-amber-900">{paidOnlyCount}</div>
                    </div>
                </div>
            </div>

            {voidedCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-sm text-red-900">
                        <span className="font-semibold">{voidedCount}</span> voided (excluded)
                    </div>
                </div>
            )}

            {topJobsByRevenue && topJobsByRevenue.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900 text-sm">Top 5 by Revenue</h3>
                    <div className="space-y-2">
                        {topJobsByRevenue.map((job, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="font-semibold text-slate-900 text-sm">{job.jobNumber}</div>
                                        <div className="text-xs text-slate-600">{job.customerName}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-green-700 text-sm">
                                            ${job.totalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

function RevenueContent({ data }) {
    const {
        totalRevenue = 0,
        avgTicket = 0,
        jobsCount = 0,
        goalRevenue = 0,
        percentToGoal = 0,
        topJobsByRevenue = []
    } = data || {};

    return (
        <>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
                <div className="text-sm text-emerald-700 font-medium mb-2">Total Revenue</div>
                <div className="text-4xl font-bold text-emerald-900">
                    ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="text-xs text-slate-600 mb-1">Avg Ticket</div>
                    <div className="text-xl font-bold text-slate-900">
                        ${avgTicket.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="text-xs text-slate-600 mb-1">Jobs</div>
                    <div className="text-xl font-bold text-slate-900">{jobsCount}</div>
                </div>
            </div>

            {goalRevenue > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm text-blue-900">
                        Goal: ${goalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} 
                        <span className="ml-2 font-semibold">({percentToGoal.toFixed(0)}%)</span>
                    </div>
                </div>
            )}

            {topJobsByRevenue && topJobsByRevenue.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900 text-sm">Top 5 Jobs</h3>
                    <div className="space-y-2">
                        {topJobsByRevenue.map((job, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="font-semibold text-slate-900 text-sm">{job.jobNumber}</div>
                                        <div className="text-xs text-slate-600">{job.customerName}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-emerald-700 text-sm">
                                            ${job.totalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

function MarginContent({ data }) {
    const {
        totalRevenue = 0,
        totalNetProfit = 0,
        netMarginPercent = 0,
        jobsCount = 0,
        worstMarginJobs = [],
        fallbackSourceCount = 0
    } = data || {};

    return (
        <>
            <div className="space-y-3">
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-5 border border-amber-200">
                    <div className="text-sm text-amber-700 font-medium mb-2">Net Margin</div>
                    <div className="text-4xl font-bold text-amber-900">{netMarginPercent.toFixed(1)}%</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <div className="text-xs text-green-700 mb-1">Net Profit</div>
                        <div className="text-lg font-bold text-green-900">
                            ${totalNetProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                        <div className="text-xs text-emerald-700 mb-1">Revenue</div>
                        <div className="text-lg font-bold text-emerald-900">
                            ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="text-xs text-slate-600 mb-1">Jobs Counted</div>
                    <div className="text-xl font-bold text-slate-900">{jobsCount}</div>
                </div>
            </div>

            {fallbackSourceCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="text-sm text-amber-900">
                        <span className="font-semibold">{fallbackSourceCount}</span> job{fallbackSourceCount !== 1 ? 's' : ''} using fallback pricing sources
                    </div>
                </div>
            )}

            {worstMarginJobs && worstMarginJobs.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900 text-sm">Lowest Margin Jobs</h3>
                    <div className="space-y-2">
                        {worstMarginJobs.map((job, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="font-semibold text-slate-900 text-sm">{job.jobNumber}</div>
                                        <div className="text-xs text-slate-600">{job.customerName}</div>
                                    </div>
                                    <Badge className="bg-red-100 text-red-800">
                                        {job.marginPercent.toFixed(1)}%
                                    </Badge>
                                </div>
                                <div className="text-xs text-slate-600">
                                    Revenue: ${job.totalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} • 
                                    Profit: ${job.netProfitAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-900">
                    Revenue-weighted net margin across all sold jobs. Includes signed, installed, and paid jobs (unless voided).
                </div>
            </div>
        </>
    );
}

function CloseRateContent({ data }) {
    console.log('[CloseRateContent] Received data:', data);

    if (!data) {
        return (
            <div className="text-center py-12 text-slate-500">
                <p className="text-sm">No close rate data available</p>
            </div>
        );
    }

    const {
        closeRatePercent = 0,
        demosRunCount = 0,
        wonCount = 0,
        lostDemoCount = 0,
        lostAfterDemoCount = 0,
        recentLosses = []
    } = data;

    console.log('[CloseRateContent] Parsed values:', { 
        closeRatePercent, 
        demosRunCount, 
        wonCount, 
        lostDemoCount, 
        lostAfterDemoCount 
    });

    return (
        <>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-5 border border-indigo-200">
                <div className="text-sm text-indigo-700 font-medium mb-2">Close Rate</div>
                <div className="text-4xl font-bold text-indigo-900">{closeRatePercent.toFixed(1)}%</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <div className="text-xs text-purple-700 mb-1">Demos Run</div>
                    <div className="text-2xl font-bold text-purple-900">{demosRunCount}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="text-xs text-green-700 mb-1">Won</div>
                    <div className="text-2xl font-bold text-green-900">{wonCount}</div>
                </div>
            </div>

            <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-900">Losses Breakdown</div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                        <div className="text-xs text-red-700 mb-1">Lost at Demo</div>
                        <div className="text-xl font-bold text-red-900">{lostDemoCount}</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                        <div className="text-xs text-amber-700 mb-1">Lost After Demo</div>
                        <div className="text-xl font-bold text-amber-900">{lostAfterDemoCount}</div>
                    </div>
                </div>
            </div>

            {recentLosses && recentLosses.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900 text-sm">Recent Losses</h3>
                    <div className="space-y-2">
                        {recentLosses.map((loss, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-start justify-between mb-1">
                                    <div>
                                        <div className="font-semibold text-slate-900 text-sm">{loss.jobNumber}</div>
                                        <div className="text-xs text-slate-600">{loss.customerName}</div>
                                    </div>
                                    <Badge className="bg-red-100 text-red-800 text-xs">
                                        {loss.lossStage}
                                    </Badge>
                                </div>
                                {loss.lossReason && (
                                    <div className="text-xs text-slate-600 mt-1">
                                        {loss.lossReason}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-900">
                    Close Rate = Won ÷ Demos Run. Excludes cancelled and no-show appointments.
                </div>
            </div>
        </>
    );
}

function UpsellContent({ data }) {
    const {
        totalUpsellDelta = 0,
        jobsWithOverrideCount = 0,
        positiveOverrideCount = 0,
        avgUpsellPerOverride = 0,
        topUpsellJobs = []
    } = data || {};

    return (
        <>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                <div className="text-sm text-green-700 font-medium mb-2">Total Upsell Delta</div>
                <div className="text-4xl font-bold text-green-900">
                    ${totalUpsellDelta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <div className="text-xs text-emerald-700 mb-1">Positive Upsells</div>
                    <div className="text-2xl font-bold text-emerald-900">{positiveOverrideCount}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="text-xs text-slate-600 mb-1">Total Overrides</div>
                    <div className="text-2xl font-bold text-slate-900">{jobsWithOverrideCount}</div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-900">
                    Avg Upsell: <span className="font-semibold">${avgUpsellPerOverride.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> per positive override
                </div>
            </div>

            {topUpsellJobs && topUpsellJobs.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900 text-sm">Top Upsells</h3>
                    <div className="space-y-2">
                        {topUpsellJobs.map((job, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="font-semibold text-slate-900 text-sm">{job.jobNumber}</div>
                                        <div className="text-xs text-slate-600">{job.customerName}</div>
                                    </div>
                                    <Badge className="bg-green-100 text-green-800">
                                        +${job.upsellDelta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </Badge>
                                </div>
                                <div className="text-xs text-slate-600">
                                    Model: ${job.modelPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} → 
                                    Sold: ${job.presentedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-900">
                    Upsell Delta = revenue captured above model price (positive overrides only).
                </div>
            </div>
        </>
    );
}

function UpsellUpsideContent({ data }) {
    const {
        totalUpsellNetUpside = 0,
        jobsWithOverrideCount = 0,
        avgNetUpsidePerOverride = 0,
        topNetUpsideJobs = []
    } = data || {};

    return (
        <>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
                <div className="text-sm text-emerald-700 font-medium mb-2">Total Upsell Upside</div>
                <div className="text-4xl font-bold text-emerald-900">
                    ${totalUpsellNetUpside.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="text-xs text-green-700 mb-1">Total Overrides</div>
                    <div className="text-2xl font-bold text-green-900">{jobsWithOverrideCount}</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <div className="text-xs text-emerald-700 mb-1">Avg Upside</div>
                    <div className="text-xl font-bold text-emerald-900">
                        ${avgNetUpsidePerOverride.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                </div>
            </div>

            {topNetUpsideJobs && topNetUpsideJobs.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900 text-sm">Top Net Upside Jobs</h3>
                    <div className="space-y-2">
                        {topNetUpsideJobs.map((job, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="font-semibold text-slate-900 text-sm">{job.jobNumber}</div>
                                        <div className="text-xs text-slate-600">{job.customerName}</div>
                                    </div>
                                    <Badge className="bg-emerald-100 text-emerald-800">
                                        +${job.netUpside.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </Badge>
                                </div>
                                <div className="text-xs text-slate-600">
                                    Additional net profit captured from override
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-900">
                    Upsell Upside = additional net profit captured from overrides (after overhead & commission).
                </div>
            </div>
        </>
    );
}

function PriceIntegrityContent({ data }) {
    const {
        priceIntegrityPercent = 0,
        jobsAtModelCount = 0,
        totalJobsCount = 0,
        jobsWithOverrideCount = 0,
        atModelJobs = []
    } = data || {};

    return (
        <>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                <div className="text-sm text-green-700 font-medium mb-2">Price Integrity</div>
                <div className="text-4xl font-bold text-green-900">{priceIntegrityPercent.toFixed(1)}%</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <div className="text-xs text-emerald-700 mb-1">At Model Price</div>
                    <div className="text-2xl font-bold text-emerald-900">{jobsAtModelCount}</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="text-xs text-amber-700 mb-1">Overridden</div>
                    <div className="text-2xl font-bold text-amber-900">{jobsWithOverrideCount}</div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="text-xs text-slate-600 mb-1">Total Jobs</div>
                <div className="text-xl font-bold text-slate-900">{totalJobsCount}</div>
            </div>

            {atModelJobs && atModelJobs.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900 text-sm">Recent At-Model Sales</h3>
                    <div className="space-y-2">
                        {atModelJobs.map((job, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="font-semibold text-slate-900 text-sm">{job.jobNumber}</div>
                                        <div className="text-xs text-slate-600">{job.customerName}</div>
                                    </div>
                                    <Badge className="bg-green-100 text-green-800">
                                        ${job.soldPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-900">
                    Price Integrity = % of jobs sold at model price without manual override.
                </div>
            </div>
        </>
    );
}

function OverrideRateContent({ data }) {
    const {
        overrideRate = 0,
        jobsWithOverrideCount = 0,
        totalJobsCount = 0,
        positiveOverrideCount = 0,
        negativeOverrideCount = 0,
        recentOverrides = []
    } = data || {};

    return (
        <>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-5 border border-amber-200">
                <div className="text-sm text-amber-700 font-medium mb-2">Override Rate</div>
                <div className="text-4xl font-bold text-amber-900">{overrideRate.toFixed(1)}%</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="text-xs text-green-700 mb-1">Positive Overrides</div>
                    <div className="text-2xl font-bold text-green-900">{positiveOverrideCount}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <div className="text-xs text-red-700 mb-1">Negative Overrides</div>
                    <div className="text-2xl font-bold text-red-900">{negativeOverrideCount}</div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="text-xs text-slate-600 mb-1">Total Overrides</div>
                <div className="text-xl font-bold text-slate-900">{jobsWithOverrideCount} of {totalJobsCount}</div>
            </div>

            {recentOverrides && recentOverrides.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900 text-sm">Recent Overrides</h3>
                    <div className="space-y-2">
                        {recentOverrides.map((job, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="font-semibold text-slate-900 text-sm">{job.jobNumber}</div>
                                        <div className="text-xs text-slate-600">{job.customerName}</div>
                                    </div>
                                    <Badge className={job.delta > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                        {job.delta > 0 ? '+' : ''}${job.delta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </Badge>
                                </div>
                                <div className="text-xs text-slate-600">
                                    Model: ${job.modelPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} → 
                                    Sold: ${job.presentedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-900">
                    Override Rate = % of jobs with manual price adjustments (positive or negative).
                </div>
            </div>
        </>
    );
}

function AvgUpsellContent({ data }) {
    const {
        avgUpsellPerOverride = 0,
        positiveOverrideCount = 0,
        totalUpsellDelta = 0,
        topUpsellJobs = []
    } = data || {};

    return (
        <>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
                <div className="text-sm text-emerald-700 font-medium mb-2">Avg Upsell per Override</div>
                <div className="text-4xl font-bold text-emerald-900">
                    ${avgUpsellPerOverride.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="text-xs text-green-700 mb-1">Positive Overrides</div>
                    <div className="text-2xl font-bold text-green-900">{positiveOverrideCount}</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <div className="text-xs text-emerald-700 mb-1">Total Upsell</div>
                    <div className="text-xl font-bold text-emerald-900">
                        ${totalUpsellDelta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                </div>
            </div>

            {topUpsellJobs && topUpsellJobs.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900 text-sm">Top Upsells</h3>
                    <div className="space-y-2">
                        {topUpsellJobs.map((job, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="font-semibold text-slate-900 text-sm">{job.jobNumber}</div>
                                        <div className="text-xs text-slate-600">{job.customerName}</div>
                                    </div>
                                    <Badge className="bg-green-100 text-green-800">
                                        +${job.upsellDelta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-900">
                    Average revenue increase for positive overrides (excludes negative adjustments).
                </div>
            </div>
        </>
    );
}

function NetReliabilityContent({ data }) {
    const {
        netMarginPercent = 0,
        reliabilityScore = 'LOW',
        jobsAbove30Count = 0,
        jobsAbove20Count = 0,
        jobsBelow20Count = 0,
        totalJobsCount = 0,
        marginDistribution = []
    } = data || {};

    return (
        <>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                <div className="text-sm text-green-700 font-medium mb-2">Net Reliability</div>
                <div className="text-4xl font-bold text-green-900">{reliabilityScore}</div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="text-xs text-green-700 mb-1">≥30%</div>
                    <div className="text-xl font-bold text-green-900">{jobsAbove30Count}</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="text-xs text-amber-700 mb-1">20-30%</div>
                    <div className="text-xl font-bold text-amber-900">{jobsAbove20Count}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <div className="text-xs text-red-700 mb-1">&lt;20%</div>
                    <div className="text-xl font-bold text-red-900">{jobsBelow20Count}</div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="text-xs text-slate-600 mb-1">Weighted Net Margin</div>
                <div className="text-2xl font-bold text-slate-900">{netMarginPercent.toFixed(1)}%</div>
            </div>

            {marginDistribution && marginDistribution.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-slate-900 text-sm">Margin Distribution</h3>
                    <div className="space-y-2">
                        {marginDistribution.map((job, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="font-semibold text-slate-900 text-sm">{job.jobNumber}</div>
                                        <div className="text-xs text-slate-600">{job.customerName}</div>
                                    </div>
                                    <Badge className={
                                        job.marginPercent >= 30 ? 'bg-green-100 text-green-800' :
                                        job.marginPercent >= 20 ? 'bg-amber-100 text-amber-800' :
                                        'bg-red-100 text-red-800'
                                    }>
                                        {job.marginPercent.toFixed(1)}%
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-900">
                    Net Reliability measures margin consistency: HIGH (≥30%), MED (20-30%), LOW (&lt;20%).
                </div>
            </div>
        </>
    );
}