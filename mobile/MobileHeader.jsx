import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ROOT_TABS = ['/jobs', '/materialcatalog', '/ownerdashboard', '/companysettings'];

export default function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    const currentPath = location.pathname.toLowerCase();
    
    // Show back button if NOT on a root tab
    const isRootTab = ROOT_TABS.some(tab => currentPath === tab || currentPath === `${tab}/`);
    
    setShowBack(!isRootTab && window.history.length > 1);
  }, [location.pathname]);

  // Only show on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (!isMobile || !showBack) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 md:hidden pt-[env(safe-area-inset-top)]">
      <div className="flex items-center h-12 px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="min-h-[44px] min-w-[44px] -ml-2"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <span className="text-sm font-medium text-slate-900 ml-2">Back</span>
      </div>
    </div>
  );
}