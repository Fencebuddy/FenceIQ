import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  ClipboardList,
  Menu,
  Settings,
  TrendingUp,
  DollarSign,
  Calendar,
} from 'lucide-react';

export default function MobileNavDropdown({ actualPageName, user, CALENDAR_ENABLED }) {
  const [open, setOpen] = useState(false);

  const navItems = [
    { name: 'Jobs', page: 'Jobs', icon: ClipboardList },
    { name: 'Material Catalog', page: 'MaterialCatalog', icon: DollarSign },
    ...(user?.role === 'admin' ? [
      { name: 'Owner Dashboard', page: 'OwnerDashboard', icon: TrendingUp },
      ...(CALENDAR_ENABLED ? [
        { name: 'Calendar', page: 'Calendar', icon: Calendar }
      ] : [])
    ] : []),
    { name: 'Company Settings', page: 'CompanySettings', icon: Settings },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" suppressHydrationWarning>
          <Menu className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <div className="space-y-2 mt-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = actualPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setOpen(false)}
              >
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-50 text-[#006FBA] font-medium'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}