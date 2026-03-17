import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function MaterialsPanel({ materials, pricing }) {
    const items = [
        { label: "Posts", quantity: materials.posts, price: pricing.postPrice, icon: "📍" },
        { label: "Rails", quantity: materials.rails, price: pricing.railPrice, icon: "━" },
        { label: "Pickets", quantity: materials.pickets, price: pricing.picketPrice, icon: "║" },
    ];

    return (
        <div className="space-y-4">
            <Card className="shadow-xl border-0 bg-white sticky top-4">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-bold text-slate-900">
                            Materials Estimate
                        </CardTitle>
                        <Badge className="bg-emerald-100 text-emerald-800 text-sm px-3 py-1">
                            New Fences Only
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white">
                        <p className="text-sm opacity-80 mb-1">Total Fence Length</p>
                        <p className="text-4xl font-bold">{materials.totalLength} ft</p>
                    </div>

                    <div className="space-y-4">
                        {items.map((item) => (
                            <div key={item.label} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{item.icon}</span>
                                    <div>
                                        <p className="font-semibold text-slate-900">{item.label}</p>
                                        <p className="text-sm text-slate-600">${item.price} each</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-slate-900">{item.quantity}</p>
                                    <p className="text-sm text-slate-600">
                                        ${(item.quantity * item.price).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                        <p className="text-lg font-semibold text-slate-900">Total Cost</p>
                        <p className="text-3xl font-bold text-slate-900">
                            ${materials.totalCost}
                        </p>
                    </div>

                    <div className="space-y-2 pt-4 border-t">
                        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Legend
                        </p>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-1 bg-slate-800 rounded"></div>
                                <span className="text-sm text-slate-600">New Fence (counted)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-1 bg-slate-400 rounded" style={{ borderTop: "2px dashed #94A3B8" }}></div>
                                <span className="text-sm text-slate-600">Existing Fence (not counted)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-emerald-600 rounded-full"></div>
                                <span className="text-sm text-slate-600">Tree/Obstacle</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}