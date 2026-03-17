import React from 'react';
import { X, DollarSign, TrendingUp, Package, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function NetMarginDetailsDrawer({ isOpen, onClose, data }) {
    if (!isOpen) return null;

    const {
        totalRevenue = 0,
        totalNetProfit = 0,
        netMarginPercent = 0,
        jobsCount = 0,
        avgTicket = 0,
        excludedJobsCount = 0,
        topJobsByProfit = []
    } = data || {};

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
                <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white p-6 shadow-lg">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <TrendingUp className="w-6 h-6" />
                                Net Margin Details
                            </h2>
                            <p className="text-emerald-100 text-sm mt-1">
                                Includes signed, installed, or paid jobs (unless voided)
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-white hover:bg-emerald-700 -mr-2"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Primary Metrics */}
                    <div className="space-y-4">
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
                            <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium mb-2">
                                <DollarSign className="w-4 h-4" />
                                Total Revenue
                            </div>
                            <div className="text-3xl font-bold text-emerald-900">
                                ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                            <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
                                <TrendingUp className="w-4 h-4" />
                                Total Net Profit
                            </div>
                            <div className="text-3xl font-bold text-green-900">
                                ${totalNetProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-5 border border-amber-200">
                            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium mb-2">
                                <Package className="w-4 h-4" />
                                Net Margin
                            </div>
                            <div className="text-3xl font-bold text-amber-900">
                                {netMarginPercent.toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    {/* Secondary Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <div className="flex items-center gap-2 text-slate-600 text-xs font-medium mb-1">
                                <Users className="w-3 h-3" />
                                Jobs Counted
                            </div>
                            <div className="text-2xl font-bold text-slate-900">{jobsCount}</div>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <div className="text-slate-600 text-xs font-medium mb-1">
                                Avg Ticket
                            </div>
                            <div className="text-2xl font-bold text-slate-900">
                                ${avgTicket.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                        </div>
                    </div>

                    {/* Excluded Jobs Info */}
                    {excludedJobsCount > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="text-sm text-red-900">
                                <span className="font-semibold">{excludedJobsCount}</span> voided job{excludedJobsCount !== 1 ? 's' : ''} excluded from calculations
                            </div>
                        </div>
                    )}

                    {/* Top Jobs by Net Profit */}
                    {topJobsByProfit && topJobsByProfit.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-semibold text-slate-900 text-sm">Top 5 Jobs by Net Profit</h3>
                            <div className="space-y-2">
                                {topJobsByProfit.map((job, idx) => (
                                    <div 
                                        key={idx}
                                        className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <div className="font-semibold text-slate-900 text-sm">
                                                    {job.jobNumber}
                                                </div>
                                                <div className="text-xs text-slate-600">
                                                    {job.customerName || 'Customer'}
                                                </div>
                                            </div>
                                            <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                                                #{idx + 1}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div>
                                                <div className="text-slate-500">Revenue</div>
                                                <div className="font-semibold text-slate-900">
                                                    ${job.totalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500">Net Profit</div>
                                                <div className="font-semibold text-green-700">
                                                    ${job.netProfitAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500">Margin</div>
                                                <div className="font-semibold text-amber-700">
                                                    {job.marginPercent.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Formula Explanation */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="text-xs text-blue-900 space-y-2">
                            <div className="font-semibold">Calculation Method:</div>
                            <div className="font-mono text-[10px] bg-white px-2 py-1 rounded border border-blue-200">
                                Net Margin % = (Total Net Profit ÷ Total Revenue) × 100
                            </div>
                            <div className="text-blue-800">
                                This is a revenue-weighted net margin across all sold jobs in the selected date range.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}