import React, { useEffect, useState } from 'react';
import { Badge } from "@/components/ui/badge";

export default function SpeedometerKPI({ 
    icon: Icon, 
    value, 
    label, 
    color, 
    percentage, 
    goal,
    showGoal = false,
    subtitle 
}) {
    const [mounted, setMounted] = useState(false);
    const actualPercent = percentage !== undefined ? percentage : (goal ? (value / goal) * 100 : 0);
    const rotation = Math.min(actualPercent, 100) * 1.8 - 90; // -90 to 90 degrees
    const isAboveGoal = actualPercent >= 100;
    
    useEffect(() => {
        setTimeout(() => setMounted(true), 50);
    }, []);
    
    return (
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 shadow-2xl border border-slate-700 overflow-hidden group hover:scale-105 transition-transform duration-300">
            {/* Animated background glow */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-slate-700/20 to-transparent" />
            </div>
            
            {/* Speedometer Arc Background */}
            <div className="absolute top-0 left-0 right-0 h-24 flex items-end justify-center opacity-30">
                <svg width="100%" height="80" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet">
                    <path
                        d="M 10 45 A 40 40 0 0 1 90 45"
                        fill="none"
                        stroke="white"
                        strokeWidth="10"
                        strokeLinecap="round"
                    />
                </svg>
            </div>
            
            {/* Active Arc with animated glow */}
            <div className="absolute top-0 left-0 right-0 h-24 flex items-end justify-center">
                <svg width="100%" height="80" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <filter id={`glow-${label}`}>
                            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    <path
                        d="M 10 45 A 40 40 0 0 1 90 45"
                        fill="none"
                        stroke={color}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray="126"
                        strokeDashoffset={mounted ? 126 - (126 * Math.min(actualPercent, 100) / 100) : 126}
                        className="transition-all duration-1500 ease-out"
                        filter={`url(#glow-${label})`}
                        style={{ 
                            filter: `drop-shadow(0 0 12px ${color})`
                        }}
                    />
                </svg>
            </div>
            
            {/* Needle with enhanced glow */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 origin-bottom transition-all duration-1000 ease-out"
                 style={{ 
                     transform: `translateX(-50%) rotate(${mounted ? rotation : -90}deg)`, 
                     height: '36px' 
                 }}>
                <div className="relative w-1.5 h-full">
                    <div className="absolute inset-0 bg-gradient-to-t from-red-600 via-red-400 to-yellow-300 rounded-full shadow-2xl"
                         style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))' }} />
                </div>
            </div>
            

            
            {/* Icon and Badge */}
            <div className="relative flex items-center justify-between mt-2 mb-3 z-10">
                <div className="p-2 rounded-lg bg-slate-800/50 group-hover:bg-slate-700/50 transition-colors duration-300"
                     style={{ boxShadow: `0 0 20px ${color}30` }}>
                    <Icon className="w-5 h-5" style={{ color, filter: `drop-shadow(0 0 4px ${color})` }} />
                </div>
                {showGoal && goal && (
                    <Badge variant="outline" className="text-xs bg-slate-800/80 border-slate-600 text-slate-300 backdrop-blur-sm">
                        Goal: {typeof goal === 'number' && goal >= 1000 ? `${(goal/1000).toFixed(0)}k` : goal}
                    </Badge>
                )}
            </div>
            
            {/* Value Display with enhanced effects */}
            <div className="relative z-10 text-center mt-8">
                <div className="text-3xl font-bold mb-1 transition-all duration-500 group-hover:scale-110" 
                     style={{ 
                         color,
                         textShadow: `0 0 20px ${color}80, 0 0 40px ${color}40`,
                         filter: 'brightness(1.2)'
                     }}>
                    {typeof value === 'string' ? value : value.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-medium group-hover:text-slate-300 transition-colors duration-300">
                    {label}
                </div>
                {subtitle && (
                    <div className="text-xs text-slate-500 mt-0.5">
                        {subtitle}
                    </div>
                )}
                {showGoal && (
                    <div className="text-xs mt-1 transition-colors duration-300"
                         style={{ color: isAboveGoal ? '#10b981' : '#f59e0b' }}>
                        {actualPercent.toFixed(0)}% of goal {isAboveGoal ? '✓' : ''}
                    </div>
                )}
            </div>
            
            {/* Racing stripes with animation */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-600 to-transparent opacity-40 group-hover:opacity-60 transition-opacity duration-300" />
            <div className="absolute bottom-0 left-0 w-1/3 h-1 bg-gradient-to-r from-transparent to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
    );
}