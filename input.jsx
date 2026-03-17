import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(
  ({ className, type, size = "md", variant = "light", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 text-base md:text-xs",
      md: "h-10 text-base md:text-sm",
      lg: "h-12 text-base",
    };

    const variantClasses = {
      // Light inputs must ALWAYS have dark text
      light:
        "bg-white text-slate-900 border-slate-200 placeholder:text-slate-500 " +
        "focus-visible:ring-slate-300",
      // Dark inputs for dark panels
      dark:
        "bg-slate-800 text-white border-slate-600 placeholder:text-slate-400 " +
        "focus-visible:ring-slate-500",
    };

    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-md border px-3 py-1 shadow-sm transition-colors " +
            "focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };