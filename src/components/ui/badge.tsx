import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
}

const variantStyles = {
  default:
    "bg-slate-100 text-slate-700 [&>span]:bg-slate-400",
  success:
    "bg-success/10 text-success [&>span]:bg-success",
  warning:
    "bg-warning/10 text-warning [&>span]:bg-warning",
  danger:
    "bg-danger/10 text-danger [&>span]:bg-danger",
  info:
    "bg-info/10 text-info [&>span]:bg-info",
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          aria-hidden
        />
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

export { Badge };
