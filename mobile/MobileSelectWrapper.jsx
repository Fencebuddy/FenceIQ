import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const isMobileDevice = () => {
  return typeof window !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent);
};

export default function MobileSelectWrapper({
  value,
  onValueChange,
  children,
  options = [],
  label = '',
  triggerClassName = '',
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = isMobileDevice();

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    );
  }

  // Mobile: Use Drawer
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setDrawerOpen(true)}
        className={`w-full justify-start ${triggerClassName}`}
      >
        {options.find((opt) => opt.value === value)?.label || 'Select...'}
      </Button>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{label}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2">
            {options.map((option) => (
              <Button
                key={option.value}
                variant={value === option.value ? 'default' : 'outline'}
                onClick={() => {
                  onValueChange(option.value);
                  setDrawerOpen(false);
                }}
                className="w-full justify-center min-h-[44px]"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}