import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileNavDropdown from '@/components/mobile/MobileNavDropdown';
import { 
        ClipboardList, 
        Menu, 
        X, 
        LogOut,
        Settings,
        User,
        DollarSign,

        TrendingUp,
        Package,
        BarChart3,
        Database,
        MapPin,
        AlertCircle,
        Bug,
        Activity,
        Calendar,
        Inbox,
        Sparkles,
        Thermometer,
        Shield,
        Eye,
        CreditCard
      } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TakeoffStoreProvider } from '@/components/stores/useTakeoffStore';
import { useQuery } from '@tanstack/react-query';
import { getCompanySettings, getCurrentTermsVersion, needsAcceptance } from '@/components/services/termsGateService';
import TermsAcceptanceModal from '@/components/TermsAcceptanceModal';
import ErrorBoundary from '@/components/ErrorBoundary';
import NetworkErrorBoundary from '@/components/NetworkErrorBoundary';
import ContextIndicator from '@/components/auth/ContextIndicator';
import EnhancedContextSwitcher from '@/components/auth/EnhancedContextSwitcher';
import PlatformLayout from '@/components/layout/PlatformLayout';
import PlatformGuard from '@/components/auth/PlatformGuard';
import CompanyGuard from '@/components/auth/CompanyGuard';

export default function Layout({ children, currentPageName }) {
    const location = useLocation();
    const [user, setUser] = useState(null);
    const scrollPositions = useRef({});
    const navigationStacks = useRef({
      Jobs: ['/jobs'],
      MaterialCatalog: ['/materialcatalog'],
      OwnerDashboard: ['/ownerdashboard'],
      CompanySettings: ['/companysettings']
    });
    const lastTappedTab = useRef(null);
    
    // Save scroll position and navigation stack when leaving a page
    useEffect(() => {
      return () => {
        const pageName = getPageName();
        scrollPositions.current[pageName] = window.scrollY;
      };
    }, [location.pathname]);
    
    // Restore scroll position when entering a page
    useEffect(() => {
      const pageName = getPageName();
      const savedPosition = scrollPositions.current[pageName];
      if (savedPosition !== undefined) {
        requestAnimationFrame(() => {
          window.scrollTo(0, savedPosition);
        });
      }
    }, [location.pathname]);
    
    // Track navigation in stacks for each tab
    useEffect(() => {
      const pageName = getPageName();
      const rootTabs = ['Jobs', 'MaterialCatalog', 'OwnerDashboard', 'CompanySettings'];
      
      if (rootTabs.includes(pageName)) {
        const stack = navigationStacks.current[pageName] || [];
        const currentPath = location.pathname.toLowerCase();
        
        // Only add to stack if it's a different path
        if (stack[stack.length - 1] !== currentPath) {
          navigationStacks.current[pageName] = [...stack, currentPath];
        }
      }
    }, [location.pathname]);
    
    // Derive current page from URL pathname
    const getPageName = () => {
          const pathname = location.pathname.toLowerCase();
          // Check for exact page names (most specific first)
          if (pathname.includes('adminagents')) return 'AdminAgents';
          if (pathname.includes('companyautomation')) return 'CompanyAutomation';
          if (pathname.includes('ownerdashboard')) return 'OwnerDashboard';
          if (pathname.includes('profitintelligence2')) return 'ProfitIntelligence2';
          if (pathname.includes('pricingintelligence')) return 'PricingIntelligence';
          if (pathname.includes('materialssuppliermapping')) return 'MaterialsSupplierMapping';
          if (pathname.includes('materialcatalog')) return 'MaterialCatalog';
          if (pathname.includes('admingoals')) return 'AdminGoals';
          if (pathname.includes('calendar')) return 'Calendar';
          if (pathname.includes('fencebuddyiq')) return 'FenceBuddyIQ';
          if (pathname.includes('breakevenintelligence')) return 'BreakevenIntelligence';
          if (pathname.includes('overheadintelligence')) return 'OverheadIntelligence';
          if (pathname.includes('companysettings')) return 'CompanySettings';
          if (pathname.includes('neighborhoodtemperature')) return 'NeighborhoodTemperature';
          if (pathname.includes('stewardshipdashboard')) return 'StewardshipDashboard';
          if (pathname.includes('customerdetail')) return 'CustomerDetail';
          if (pathname.includes('customers')) return 'Customers';
          if (pathname.includes('platformadmin')) return 'PlatformAdmin';
          if (pathname.includes('contextverification')) return 'ContextVerification';
          if (pathname.includes('leads')) return 'Leads';
          if (pathname.includes('jobs')) return 'Jobs';
          // Fallback: admins → OwnerDashboard, regular users → Leads
          return user?.role === 'admin' ? 'OwnerDashboard' : 'Leads';
        };
    
    const actualPageName = getPageName();


    // PHASE 3.1 PRODUCTION READY: Calendar with write support (write access controlled by calendarWriteEnabled)
    const CALENDAR_ENABLED = true;

    useEffect(() => {
        const loadUser = async () => {
            const u = await base44.auth.me();
            setUser(u);
        };
        loadUser();

        // Suppress WebSocket reconnection spam in console
        const originalError = console.error;
        console.error = (...args) => {
            const msg = args[0]?.toString() || '';
            if (msg.includes('WebSocket connection') || msg.includes('wss://preview-sandbox') || msg.includes('Unrecognized feature')) {
                return; // Suppress WebSocket and feature warnings
            }
            originalError.apply(console, args);
        };

        return () => {
            console.error = originalError;
        };
    }, []);

  // Fetch company settings for terms gate
  const { data: companySettings } = useQuery({
    queryKey: ['companySettings'],
    queryFn: getCompanySettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });

  // Determine if terms gate should be shown
  const currentTermsVersion = companySettings ? getCurrentTermsVersion(companySettings) : null;
  const showTermsGate = user && currentTermsVersion && needsAcceptance(user, currentTermsVersion) && 
                        currentPageName !== 'LegalTerms' && 
                        currentPageName !== 'LegalPrivacy';

  const handleLogout = () => {
    base44.auth.logout();
  };

  const navItems = [
    { name: 'Jobs', page: 'Jobs', icon: ClipboardList },
    { name: 'Owner', page: 'OwnerDashboard', icon: TrendingUp },
    { name: 'Catalog', page: 'MaterialCatalog', icon: DollarSign },
    ...(user?.role === 'admin' ? [
      { name: 'Goals', page: 'AdminGoals', icon: Settings }
    ] : [])
  ];



  return (
    <NetworkErrorBoundary>
      <ErrorBoundary>
        <TakeoffStoreProvider>
          <div className="min-h-screen bg-background">
        {/* Terms Acceptance Gate */}
        {showTermsGate && (
          <TermsAcceptanceModal 
            open={true}
            currentVersion={currentTermsVersion}
            userId={user.id}
          />
        )}

        {/* Mobile Header with Dropdown Nav */}
        <div className="lg:hidden flex items-center justify-between bg-white border-b border-slate-200 p-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <h1 className="text-lg font-semibold text-slate-900">FenceIQ</h1>
          <div className="flex items-center gap-2">
            <EnhancedContextSwitcher />
            <MobileNavDropdown actualPageName={actualPageName} user={user} CALENDAR_ENABLED={CALENDAR_ENABLED} />
          </div>
        </div>

        {/* Top Navigation Bar - Hidden on mobile */}
        <div className="hidden lg:block bg-white shadow-md border-b border-slate-200 sticky top-0 z-40" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 p-3 min-w-max items-center">
              {/* Context Indicator */}
              <EnhancedContextSwitcher />
              <div className="border-l border-slate-200 h-6 mx-1"></div>

              {/* Core Workflow */}
              <Link to={createPageUrl('Leads')}>
                <Button 
                  variant={actualPageName === 'Leads' ? 'default' : 'outline'} 
                  size="sm"
                  className={actualPageName === 'Leads' ? 'bg-[#006FBA] hover:bg-[#005EA5]' : ''}
                >
                  <Inbox className="w-4 h-4 mr-2" />
                  Leads
                </Button>
              </Link>
              <Link to={createPageUrl('Jobs')}>
                <Button 
                  variant={actualPageName === 'Jobs' ? 'default' : 'outline'} 
                  size="sm"
                  className={actualPageName === 'Jobs' ? 'bg-[#006FBA] hover:bg-[#005EA5]' : ''}
                >
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Jobs
                </Button>
              </Link>
              <Link to={createPageUrl('Customers')}>
                <Button 
                  variant={actualPageName === 'Customers' ? 'default' : 'outline'} 
                  size="sm"
                  className={actualPageName === 'Customers' ? 'bg-[#006FBA] hover:bg-[#005EA5]' : ''}
                >
                  <User className="w-4 h-4 mr-2" />
                  Customers
                </Button>
              </Link>

              {CALENDAR_ENABLED && (
                <Link to={createPageUrl('Calendar')}>
                  <Button 
                    variant={actualPageName === 'Calendar' ? 'default' : 'outline'} 
                    size="sm"
                    className={actualPageName === 'Calendar' ? 'bg-[#006FBA] hover:bg-[#005EA5]' : ''}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Calendar
                  </Button>
                </Link>
              )}

              {/* Financing Link */}
              <a href="https://hil.slice.fnbo.com/application/qr/Privacy%20Fence%20Company/Privacy%20Fence%20Company?hash=cA3eVsOjlIBqIv4ogze3kLJAUvybtI9U3N3YVH1mDZf%2BPyqQhVck0Sh82WKIn7fl8oQJU0HwMzefB%2F%2BSdP253FOLv9eei00s9CMlo2nqH9sZ5%2B%2BcMRcTcXLkfKdNu1gJ%2FyfyaKz%2BHB%2FKdU%2BHlM%2BghWTkX7K9FF%2BL%2B5dCo9Kq0rw%3D&agent_id=92b8d93f-ff73-4a5d-8665-aec855545ba7&entry_point=qr" target="_blank" rel="noopener noreferrer">
                <Button 
                  variant="outline" 
                  size="sm"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Financing
                </Button>
              </a>

              {/* Payments - Available to all users */}
              <div className="border-l border-slate-200 h-6 mx-1"></div>
              <Link to={createPageUrl('CollectPayment')}>
                <Button 
                  variant="outline" 
                  size="sm"
                >
                  <CreditCard className="w-4 h-4 mr-2 text-blue-600" />
                  <span className="text-blue-700 font-medium">Collect Payment</span>
                </Button>
              </Link>
              <Link to={createPageUrl('PaymentsLog')}>
                <Button 
                  variant="outline" 
                  size="sm"
                >
                  <DollarSign className="w-4 h-4 mr-2 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Payments Log</span>
                </Button>
              </Link>

              {/* Admin Dropdown */}
              {user?.role === 'admin' && (
                <>
                  <div className="border-l border-slate-200 h-6 mx-1"></div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant={['OwnerDashboard', 'AdminGoals', 'Calendar', 'FenceBuddyIQ', 'MaterialsSupplierMapping', 'KpiCommandCenter', 'OverheadIntelligence', 'BreakevenIntelligence', 'MaterialCatalog', 'CompanySettings', 'PlatformAdmin', 'NeighborhoodTemperature', 'StewardshipDashboard', 'ProfitIntelligence2', 'PricingIntelligence', 'MonitoringDashboard'].includes(actualPageName) ? 'default' : 'outline'} 
                        size="sm"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Admin
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="overflow-y-auto max-h-[85vh]">
                      <Link to={createPageUrl('OwnerDashboard')}>
                        <DropdownMenuItem>
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Executive Intelligence
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('AdminGoals')}>
                        <DropdownMenuItem>
                          <Settings className="w-4 h-4 mr-2" />
                          Goals
                        </DropdownMenuItem>
                      </Link>
                      {CALENDAR_ENABLED && (
                        <Link to={createPageUrl('Calendar')}>
                          <DropdownMenuItem>
                            <Calendar className="w-4 h-4 mr-2" />
                            Calendar
                          </DropdownMenuItem>
                        </Link>
                      )}
                      <Link to={createPageUrl('FenceBuddyIQ')}>
                        <DropdownMenuItem>
                          <BarChart3 className="w-4 h-4 mr-2" />
                          FenceBuddy IQ
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('MaterialsSupplierMapping')}>
                        <DropdownMenuItem>
                          <Package className="w-4 h-4 mr-2" />
                          Supplier Mapping
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('KpiCommandCenter')}>
                        <DropdownMenuItem>
                          <BarChart3 className="w-4 h-4 mr-2" />
                          KPI Center
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('OverheadIntelligence')}>
                        <DropdownMenuItem>
                          <DollarSign className="w-4 h-4 mr-2" />
                          Overhead
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('BreakevenIntelligence')}>
                        <DropdownMenuItem>
                          <Activity className="w-4 h-4 mr-2" />
                          Breakeven
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('MaterialCatalog')}>
                        <DropdownMenuItem>
                          <Package className="w-4 h-4 mr-2" />
                          Material Catalog
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('CompanySettings')}>
                        <DropdownMenuItem>
                          <Settings className="w-4 h-4 mr-2" />
                          Company Settings
                        </DropdownMenuItem>
                      </Link>
                      <div className="border-t border-slate-100 my-1"></div>
                      <Link to={createPageUrl('NeighborhoodTemperature')}>
                        <DropdownMenuItem>
                          <Thermometer className="w-4 h-4 mr-2" />
                          Neighborhood Temp
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('StewardshipDashboard')}>
                        <DropdownMenuItem>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Stewardship
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('ProfitIntelligence2')}>
                        <DropdownMenuItem>
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Profit IQ 2.0
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('PricingIntelligence')}>
                        <DropdownMenuItem>
                          <DollarSign className="w-4 h-4 mr-2" />
                          Pricing Intelligence
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('MonitoringDashboard')}>
                        <DropdownMenuItem>
                          <Activity className="w-4 h-4 mr-2" />
                          Production Monitoring
                        </DropdownMenuItem>
                      </Link>
                      <div className="border-t border-slate-100 my-1"></div>
                      <Link to={createPageUrl('PlatformAdmin')}>
                        <DropdownMenuItem>
                          <Shield className="w-4 h-4 mr-2 text-purple-600" />
                          <span className="text-purple-700 font-medium">Platform Admin</span>
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('ContextVerification')}>
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2 text-slate-500" />
                          <span className="text-slate-600">Context Verification</span>
                        </DropdownMenuItem>
                      </Link>
                      <Link to={createPageUrl('WebhookEventLog')}>
                        <DropdownMenuItem>
                          <Activity className="w-4 h-4 mr-2 text-orange-500" />
                          <span className="text-orange-600">Webhook Event Log</span>
                        </DropdownMenuItem>
                      </Link>

                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="min-h-screen">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>


      </div>
      </TakeoffStoreProvider>
      </ErrorBoundary>
      </NetworkErrorBoundary>
      );
      }