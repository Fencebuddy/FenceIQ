import React, { useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import confetti from 'canvas-confetti';

export default function SignatureSuccessCelebration({ 
    open, 
    companyName, 
    proposalUrl, 
    onDone 
}) {
    useEffect(() => {
        if (!open) return;

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReducedMotion) {
            // Skip fireworks if user prefers reduced motion
            return;
        }

        // Start fireworks animation
        const duration = 2800;
        const animationEnd = Date.now() + duration;
        const colors = ['#4db8ad', '#10b981', '#3b82f6', '#fbbf24'];

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const fireConfetti = () => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) return;

            const particleCount = 3;
            
            confetti({
                particleCount,
                angle: randomInRange(60, 120),
                spread: randomInRange(50, 70),
                origin: { 
                    x: randomInRange(0.1, 0.9), 
                    y: 1.0 // Bottom of viewport
                },
                colors: colors,
                startVelocity: randomInRange(45, 65),
                gravity: 0.8,
                drift: randomInRange(-0.5, 0.5),
                ticks: 400,
                zIndex: 40 // Behind modal (modal is z-50)
            });

            requestAnimationFrame(fireConfetti);
        };

        fireConfetti();
    }, [open]);

    // Handle ESC key
    useEffect(() => {
        if (!open) return;

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onDone();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [open, onDone]);

    if (!open) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onDone}
        >
            <Card 
                className="max-w-md w-full shadow-2xl border-0"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-labelledby="celebration-headline"
                aria-describedby="celebration-subtext"
            >
                <CardContent className="p-12 text-center">
                    {/* Shield Icon */}
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-xl">
                        <ShieldCheck className="w-12 h-12 text-white" />
                    </div>

                    {/* Headline */}
                    <h2 
                        id="celebration-headline"
                        className="text-3xl font-bold text-slate-900 mb-3"
                    >
                        Welcome To the {companyName} Family
                    </h2>

                    {/* Subtext */}
                    <p 
                        id="celebration-subtext"
                        className="text-slate-600 mb-8 text-lg"
                    >
                        You're all set — we'll reach out with next steps.
                    </p>

                    {/* Buttons */}
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={onDone}
                            className="w-full h-12 text-base font-semibold bg-[#4db8ad] hover:bg-[#3da89d] shadow-lg"
                            autoFocus
                        >
                            Done
                        </Button>
                        {proposalUrl && (
                            <Button
                                onClick={() => window.open(proposalUrl, '_blank')}
                                variant="outline"
                                className="w-full h-12 text-base"
                            >
                                View Proposal
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}