import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina classes CSS com merge inteligente do Tailwind.
 * Uso: cn("px-4 py-2", isActive && "bg-primary-600", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata valor monetário em BRL.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata data para exibição no padrão brasileiro.
 */
export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  }).format(new Date(date));
}

/**
 * Formata data e hora para exibição.
 */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Gera um ID único curto para uso em UI (não para banco).
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Delay assíncrono (útil para debounce, retry, etc).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
