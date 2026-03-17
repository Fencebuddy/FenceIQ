import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-100 " +
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 " +
    "active:scale-95 disabled:active:scale-100 " +
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",

        // Token-based (keeps whatever your theme decides)
        outline:
          "border border-input bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",

        // Brand blue primary (CostPilot)
        teal: "bg-[#006FBA] text-white shadow hover:bg-[#005EA5] hover:glow-blue-soft transition-all lift-hover",

        // NEW: Light-surface safe variants (force dark text)
        light:
          "bg-white text-slate-900 shadow-sm hover:bg-slate-50 border border-slate-200",
        lightOutline:
          "bg-white text-slate-900 border border-slate-300 shadow-sm hover:bg-slate-50",
        lightGhost:
          "bg-transparent text-slate-900 hover:bg-slate-100",
      },
      size: {
        default: "h-11 px-4 py-2 md:h-10 md:px-4",
        sm: "h-11 px-3 text-sm md:h-8 md:text-xs",
        md: "h-11 px-4 text-sm md:h-10",
        lg: "h-12 px-6 text-base",
        xl: "h-16 px-8 text-lg",
        icon: "h-11 w-11 md:h-9 md:w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };