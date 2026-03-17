import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Shield, Plus, Save, Calculator, Eye, FileText, Send, ChevronLeft, MoreVertical, DollarSign } from 'lucide-react';
import StepFlow from './StepFlow';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AppHeader({ currentPage, onAction }) {
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
      case 'Jobs':
        return {
          label: 'New Job',
          icon: Plus,
          onClick: () => navigate(createPageUrl('NewJob')),
          variant: 'default'
        };
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
        return {
          label: 'Send to Signature',
          icon: Send,
          onClick: () => navigate(createPageUrl(`Signature?jobId=${jobId}`)),
          variant: 'default'
        };
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

  return (
    <header
      className={`sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 transition-all duration-300 ${
        isScrolled ? 'h-14' : 'h-16'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">
        {/* LEFT - Logo & Tagline */}
        <button
          onClick={() => navigate(createPageUrl('Jobs'))}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Shield className="w-6 h-6 text-blue-600" />
          <div className="flex flex-col items-start">
            <span className="font-bold text-slate-900 text-lg leading-tight">FENCEBUDDY</span>
            <span className="text-[10px] text-slate-500 leading-tight hidden sm:block">
              Designed to get it right.
            </span>
          </div>
        </button>

        {/* CENTER - Step Flow + Catalog Link */}
        <div className="flex-1 flex justify-center items-center gap-6">
          <StepFlow currentPage={currentPage} jobId={jobId} />
          <button
            onClick={() => navigate(createPageUrl('MaterialCatalog'))}
            className="hidden lg:flex items-center gap-2 text-slate-700 hover:text-blue-600 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">Catalog</span>
          </button>
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
                className="gap-2"
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
                  <Button variant="ghost" size="sm">
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