/**
 * Vitaliano ERP — Tipos globais do domínio.
 * Enums e tipos base usados em toda a aplicação.
 */

// === Roles (RBAC) ===
export type AppRole =
  | "owner" // P0 - Proprietário/Super Admin
  | "admin" // P1 - Admin/Gerente Geral
  | "financial" // P2 - Financeiro
  | "purchasing" // P3 - Compras
  | "stock_production" // P4 - Estoque/Produção (CD)
  | "store_manager" // P5 - Gerente de Loja
  | "cashier" // P6 - Operador de Caixa
  | "counter" // P7 - Contador (perfil mínimo)
  | "checklist_executor" // P8 - Executor Checklist (perfil mínimo)
  | "maintenance"; // P9 - Manutenção

// === Módulos ===
export type AppModule =
  | "M1" // Banco Virtual CD
  | "M2" // Cadastros
  | "M3" // Compras Integradas
  | "M4" // Estoque + Produção
  | "M5" // Financeiro
  | "M6" // Vendas & Recebíveis
  | "M7" // Dashboard
  | "M8" // Relatórios
  | "M9" // Integrações + IA
  | "M10" // Administração (futuro)
  | "M11" // Contagens & Inventários
  | "M12" // Manutenção & Ativos (futuro)
  | "M13" // Checklists Operacionais
  | "M15"; // Integrações Avançadas (futuro)

// === Nível de Acesso por Módulo ===
export type AccessLevel = "hidden" | "view" | "edit";

// === Tipos de Loja ===
export type StoreType = "store" | "cd";

// === Tipos de Documento ===
export type DocumentType =
  | "nf_xml"
  | "nf_pdf"
  | "nf_photo"
  | "ofx"
  | "receipt"
  | "checklist_evidence"
  | "other";

// === Fonte da Ação (Auditoria) ===
export type SourceType = "user" | "ai" | "system" | "import";

// === Status Genéricos ===
export type DraftStatus = "draft" | "confirmed" | "cancelled";
export type PaymentStatus = "pending" | "partial" | "paid" | "overdue";
export type ReceivableStatus = "pending" | "partial" | "received" | "overdue";

// === Tipos de Movimento de Estoque ===
export type InventoryMoveType =
  | "IN" // Entrada (compra, produção, transferência, ajuste+)
  | "OUT" // Saída (venda, produção, transferência, ajuste-)
  | "ADJUST"; // Ajuste (contagem/inventário)

// === Tipos de Lançamento do Banco Virtual ===
export type VirtualLedgerType =
  | "DEBIT" // CD vendeu para loja (loja deve ao CD)
  | "CREDIT" // Pagamento real abateu débito
  | "ADJUST"; // Ajuste administrativo (exceção)

// === Tipos de Item ===
export type ItemType = "product" | "ingredient" | "supply";

// === Tipos de Categoria Financeira ===
export type FinanceCategoryType = "revenue" | "expense";

// === Tipos de Forma de Pagamento ===
export type PaymentMethodType =
  | "cash" | "credit_card" | "debit_card" | "pix"
  | "bank_transfer" | "boleto" | "check" | "voucher" | "other";

// === Tipos de Canal de Venda ===
export type SalesChannelType =
  | "store" | "ifood" | "rappi" | "uber_eats"
  | "whatsapp" | "phone" | "website" | "other";

// === Direção de Ajuste ===
export type AdjustmentDirection = "positive" | "negative" | "both";

// === Tipo de Conta Bancária ===
export type BankAccountType = "checking" | "savings" | "investment";

// === Status de Recebimento (NF) ===
export type ReceivingStatus = "draft" | "confirmed" | "cancelled";

// === Status de Match de Item no Recebimento ===
export type ReceivingItemMatch = "pending" | "matched" | "created" | "ignored";

// === Status de Conta a Pagar ===
export type PayableStatus = "pending" | "partial" | "paid" | "cancelled";

// === Tipo de Transação Bancária ===
export type BankTxType = "credit" | "debit";

// === Status de Conta a Receber ===
export type ArReceivableStatus = "pending" | "partial" | "received" | "cancelled";

// === Status de Sessão de Caixa ===
export type CashSessionStatus = "open" | "closed";

// === Status de Pedido Interno (CD→Loja) ===
export type InternalOrderStatus = "draft" | "confirmed" | "cancelled";

// === Paginação ===
export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// === API Response padrão ===
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
