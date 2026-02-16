"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "value"
  > {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  "aria-label"?: string;
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      className,
      checked = false,
      onChange,
      disabled = false,
      label,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const handleClick = () => {
      if (!disabled) onChange?.(!checked);
    };

    return (
      <label className={cn("inline-flex items-center gap-2 cursor-pointer", className)}>
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel ?? label ?? "Alternar"}
          disabled={disabled}
          onClick={handleClick}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            checked ? "bg-primary-600" : "bg-slate-300"
          )}
          {...props}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform",
              checked ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
        {label && (
          <span className="text-sm text-slate-700">{label}</span>
        )}
      </label>
    );
  }
);

Toggle.displayName = "Toggle";

export { Toggle };
