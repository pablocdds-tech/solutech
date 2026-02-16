/**
 * Vitaliano ERP — Constantes globais da aplicação.
 */

// === Informações do App ===
export const APP_NAME = "Vitaliano ERP";
export const APP_VERSION = "0.1.0";

// === Labels dos Módulos ===
export const MODULE_LABELS: Record<string, string> = {
  M1: "Banco Virtual CD",
  M2: "Cadastros",
  M3: "Compras Integradas",
  M4: "Estoque + Produção",
  M5: "Financeiro",
  M6: "Vendas & Recebíveis",
  M7: "Dashboard",
  M8: "Relatórios",
  M9: "Integrações + IA",
  M10: "Administração",
  M11: "Contagens & Inventários",
  M12: "Manutenção & Ativos",
  M13: "Checklists Operacionais",
  M15: "Integrações Avançadas",
};

// === Labels das Roles ===
export const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  financial: "Financeiro",
  purchasing: "Compras",
  stock_production: "Estoque/Produção",
  store_manager: "Gerente de Loja",
  cashier: "Operador de Caixa",
  counter: "Contador",
  checklist_executor: "Executor Checklist",
  maintenance: "Manutenção",
};

// === Roles com acesso administrativo ===
export const ADMIN_ROLES = ["owner", "admin"] as const;

// === Paginação padrão ===
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

// === Limites ===
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "text/xml",
  "application/xml",
  ...ALLOWED_IMAGE_TYPES,
] as const;

// === Lojas padrão do sistema ===
export const DEFAULT_STORES = {
  NB: { name: "Vitaliano NB", slug: "nb", type: "store" as const },
  PRACA: { name: "Vitaliano Praça", slug: "praca", type: "store" as const },
  CD: { name: "CD Vitaliano", slug: "cd", type: "cd" as const },
} as const;
