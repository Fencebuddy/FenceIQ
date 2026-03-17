import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Plus, Save, Calculator, Eye, FileText, Send, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, MoreVertical } from 'lucide-react';
import StepFlow from './StepFlow';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function StickyTopHeader({ currentPage, onAction }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId') || searchParams.get('id');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Page-aware primary CTA
  const getPrimaryCTA = () => {
    switch (currentPage) {
      case 'NewJob':
        return {
          label: 'Continue to Edit',
          icon: ChevronLeft,
          onClick: () => onAction?.('continue'),
          variant: 'default'
        };
      case 'EditJob':
      case 'JobDetail':
        return {
          label: 'Go to Job Cost',
          icon: Calculator,
          onClick: () => navigate(createPageUrl(`JobCost?jobId=${jobId}`)),
          variant: 'default'
        };
      case 'JobCost':
        return {
          label: 'Present Price',
          icon: Eye,
          onClick: () => navigate(createPageUrl(`PricePresentation?jobId=${jobId}`)),
          variant: 'default'
        };
      case 'PricePresentation':
        return {
          label: 'Create Proposal',
          icon: FileText,
          onClick: () => navigate(createPageUrl(`Proposal?jobId=${jobId}`)),
          variant: 'default'
        };
      case 'Proposal':
        return null;
      case 'Signature':
        return {
          label: 'Back to Jobs',
          icon: ChevronLeft,
          onClick: () => navigate(createPageUrl('Jobs')),
          variant: 'outline'
        };
      default:
        return null;
    }
  };

  // Secondary actions per page
  const getSecondaryActions = () => {
    switch (currentPage) {
      case 'JobCost':
        return [
          {
            label: 'Save Price',
            icon: Save,
            onClick: () => onAction?.('save-price')
          }
        ];
      case 'PricePresentation':
        return [
          {
            label: 'Save',
            icon: Save,
            onClick: () => onAction?.('save')
          }
        ];
      default:
        return [];
    }
  };

  const primaryCTA = getPrimaryCTA();
  const secondaryActions = getSecondaryActions();

  // Workflow navigation
  const workflowPages = ['JobDetail', 'JobCost', 'PricePresentation'];
  const currentIndex = workflowPages.indexOf(currentPage);
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex >= 0 && currentIndex < workflowPages.length - 1;

  const handleBack = () => {
    if (!canGoBack || !jobId) return;
    const prevPage = workflowPages[currentIndex - 1];
    navigate(createPageUrl(`${prevPage}?jobId=${jobId}`));
  };

  const handleForward = () => {
    if (!canGoForward || !jobId) return;
    const nextPage = workflowPages[currentIndex + 1];
    navigate(createPageUrl(`${nextPage}?jobId=${jobId}`));
  };

  return (
    <header
      className={`sticky top-0 z-50 bg-slate-900/90 backdrop-blur-lg border-b border-slate-700 transition-all duration-300 ${
        isScrolled ? 'h-16' : 'h-18'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">
        {/* LEFT - Logo + Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(createPageUrl('Jobs'))}
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6934c2aad8d7afa0d77a1bfa/d75130dd5_IMG_5531.png"
              alt="FenceBuddy"
              className="h-8 sm:h-9 md:h-10 w-auto"
            />
          </button>
          
          {/* Workflow Navigation Arrows */}
          {currentIndex >= 0 && (
            <div className="hidden sm:flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                disabled={!canGoBack}
                className="text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleForward}
                disabled={!canGoForward}
                className="text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* CENTER - Step Flow */}
        <div className="flex-1 flex justify-center">
          <StepFlow currentPage={currentPage} jobId={jobId} />
        </div>

        {/* RIGHT - Actions */}
        <div className="flex items-center gap-2">
          {/* Desktop - All actions visible */}
          <div className="hidden sm:flex items-center gap-2">
            {secondaryActions.map((action, idx) => (
              <Button
                key={idx}
                variant="ghost"
                size="sm"
                onClick={action.onClick}
                className="gap-2 text-white hover:bg-white/10"
              >
                <action.icon className="w-4 h-4" />
                <span className="hidden md:inline">{action.label}</span>
              </Button>
            ))}
            {primaryCTA && (
              <Button
                variant={primaryCTA.variant}
                size="sm"
                onClick={primaryCTA.onClick}
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <primaryCTA.icon className="w-4 h-4" />
                <span>{primaryCTA.label}</span>
              </Button>
            )}
          </div>

          {/* Mobile - Overflow Menu */}
          <div className="sm:hidden flex items-center gap-2">
            {primaryCTA && (
              <Button
                variant={primaryCTA.variant}
                size="sm"
                onClick={primaryCTA.onClick}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <primaryCTA.icon className="w-4 h-4" />
              </Button>
            )}
            {secondaryActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {secondaryActions.map((action, idx) => (
                    <DropdownMenuItem key={idx} onClick={action.onClick}>
                      <action.icon className="w-4 h-4 mr-2" />
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}