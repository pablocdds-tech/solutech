"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;
const SEARCH_PARAM = "q";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue"> {
  paramName?: string;
  placeholder?: string;
  className?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function SearchInput({
  paramName = SEARCH_PARAM,
  placeholder = "Buscar...",
  className,
  ...props
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localValue, setLocalValue] = React.useState(
    () => searchParams.get(paramName) ?? ""
  );
  const debouncedValue = useDebounce(localValue, DEBOUNCE_MS);

  React.useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedValue.trim()) {
      params.set(paramName, debouncedValue.trim());
    } else {
      params.delete(paramName);
    }
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    router.replace(url, { scroll: false });
  }, [debouncedValue, pathname, paramName, router, searchParams]);

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="search"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-[var(--radius-md)] border border-slate-300 bg-surface pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-500",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        aria-label={placeholder}
        {...props}
      />
    </div>
  );
}

export { SearchInput };
