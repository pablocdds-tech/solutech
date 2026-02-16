/**
 * Vitaliano ERP — Configurações das entidades M2 (Cadastros).
 * Define campos, rotas, busca e ordem para cada entidade.
 */

export interface EntityFieldConfig {
  name: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
  showInTable?: boolean;
  showInForm?: boolean;
}

export interface EntityConfig {
  table: string;
  name: string;
  namePlural: string;
  routePath: string;
  icon?: string;
  searchFields: string[];
  defaultOrderBy: string;
  fields: EntityFieldConfig[];
}

// Opções reutilizáveis para selects
const itemTypeOptions = [
  { value: "product", label: "Produto" },
  { value: "ingredient", label: "Ingrediente" },
  { value: "supply", label: "Insumo" },
];

const financeCategoryTypeOptions = [
  { value: "revenue", label: "Receita" },
  { value: "expense", label: "Despesa" },
];

const paymentMethodTypeOptions = [
  { value: "cash", label: "Dinheiro" },
  { value: "credit_card", label: "Cartão Crédito" },
  { value: "debit_card", label: "Cartão Débito" },
  { value: "pix", label: "PIX" },
  { value: "bank_transfer", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "check", label: "Cheque" },
  { value: "voucher", label: "Voucher" },
  { value: "other", label: "Outro" },
];

const salesChannelTypeOptions = [
  { value: "store", label: "Loja" },
  { value: "ifood", label: "iFood" },
  { value: "rappi", label: "Rappi" },
  { value: "uber_eats", label: "Uber Eats" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Telefone" },
  { value: "website", label: "Website" },
  { value: "other", label: "Outro" },
];

const adjustmentDirectionOptions = [
  { value: "positive", label: "Entrada" },
  { value: "negative", label: "Saída" },
  { value: "both", label: "Ambos" },
];

const bankAccountTypeOptions = [
  { value: "checking", label: "Corrente" },
  { value: "savings", label: "Poupança" },
  { value: "investment", label: "Investimento" },
];

const entityConfigsList: EntityConfig[] = [
  {
    table: "items",
    name: "Item",
    namePlural: "Itens",
    routePath: "/cadastros/itens",
    icon: "package",
    searchFields: ["name", "sku", "barcode"],
    defaultOrderBy: "name",
    fields: [
      {
        name: "name",
        label: "Nome",
        type: "text",
        required: true,
        placeholder: "Nome do item",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "sku",
        label: "SKU",
        type: "text",
        placeholder: "Código SKU",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "barcode",
        label: "Código de barras",
        type: "text",
        placeholder: "Código de barras",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "type",
        label: "Tipo",
        type: "select",
        required: true,
        options: itemTypeOptions,
        defaultValue: "ingredient",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "description",
        label: "Descrição",
        type: "textarea",
        placeholder: "Descrição do item",
        showInTable: false,
        showInForm: true,
      },
      {
        name: "min_stock",
        label: "Estoque mínimo",
        type: "number",
        placeholder: "0",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "max_stock",
        label: "Estoque máximo",
        type: "number",
        placeholder: "0",
        showInTable: true,
        showInForm: true,
      },
    ],
  },
  {
    table: "suppliers",
    name: "Fornecedor",
    namePlural: "Fornecedores",
    routePath: "/cadastros/fornecedores",
    icon: "truck",
    searchFields: ["name", "cnpj", "cpf", "email", "contact_name", "city"],
    defaultOrderBy: "name",
    fields: [
      {
        name: "name",
        label: "Nome",
        type: "text",
        required: true,
        placeholder: "Nome do fornecedor",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "cnpj",
        label: "CNPJ",
        type: "text",
        placeholder: "00.000.000/0001-00",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "cpf",
        label: "CPF",
        type: "text",
        placeholder: "000.000.000-00",
        showInTable: false,
        showInForm: true,
      },
      {
        name: "email",
        label: "E-mail",
        type: "text",
        placeholder: "email@exemplo.com",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "phone",
        label: "Telefone",
        type: "text",
        placeholder: "(00) 00000-0000",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "contact_name",
        label: "Nome do contato",
        type: "text",
        placeholder: "Nome do responsável",
        showInTable: false,
        showInForm: true,
      },
      {
        name: "city",
        label: "Cidade",
        type: "text",
        placeholder: "Cidade",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "state",
        label: "Estado",
        type: "text",
        placeholder: "UF",
        showInTable: false,
        showInForm: true,
      },
      {
        name: "notes",
        label: "Observações",
        type: "textarea",
        placeholder: "Anotações",
        showInTable: false,
        showInForm: true,
      },
    ],
  },
  {
    table: "ingredient_groups",
    name: "Grupo de Ingredientes",
    namePlural: "Grupos de Ingredientes",
    routePath: "/cadastros/grupos-ingredientes",
    icon: "layers",
    searchFields: ["name", "description"],
    defaultOrderBy: "name",
    fields: [
      {
        name: "name",
        label: "Nome",
        type: "text",
        required: true,
        placeholder: "Nome do grupo",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "description",
        label: "Descrição",
        type: "textarea",
        placeholder: "Descrição do grupo",
        showInTable: true,
        showInForm: true,
      },
    ],
  },
  {
    table: "units",
    name: "Unidade de Medida",
    namePlural: "Unidades de Medida",
    routePath: "/cadastros/unidades",
    icon: "ruler",
    searchFields: ["name", "abbreviation"],
    defaultOrderBy: "name",
    fields: [
      {
        name: "name",
        label: "Nome",
        type: "text",
        required: true,
        placeholder: "Ex: Quilograma",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "abbreviation",
        label: "Abreviação",
        type: "text",
        required: true,
        placeholder: "Ex: kg",
        showInTable: true,
        showInForm: true,
      },
    ],
  },
  {
    table: "finance_categories",
    name: "Categoria Financeira",
    namePlural: "Categorias Financeiras",
    routePath: "/cadastros/categorias-financeiras",
    icon: "pie-chart",
    searchFields: ["name"],
    defaultOrderBy: "sort_order",
    fields: [
      {
        name: "name",
        label: "Nome",
        type: "text",
        required: true,
        placeholder: "Nome da categoria",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "type",
        label: "Tipo",
        type: "select",
        required: true,
        options: financeCategoryTypeOptions,
        showInTable: true,
        showInForm: true,
      },
      {
        name: "sort_order",
        label: "Ordem",
        type: "number",
        defaultValue: 0,
        placeholder: "0",
        showInTable: true,
        showInForm: true,
      },
    ],
  },
  {
    table: "payment_methods",
    name: "Forma de Pagamento",
    namePlural: "Formas de Pagamento",
    routePath: "/cadastros/formas-pagamento",
    icon: "credit-card",
    searchFields: ["name"],
    defaultOrderBy: "name",
    fields: [
      {
        name: "name",
        label: "Nome",
        type: "text",
        required: true,
        placeholder: "Ex: Cartão Visa",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "type",
        label: "Tipo",
        type: "select",
        required: true,
        options: paymentMethodTypeOptions,
        defaultValue: "other",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "days_to_receive",
        label: "Dias para recebimento",
        type: "number",
        defaultValue: 0,
        placeholder: "0",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "fee_percent",
        label: "Taxa (%)",
        type: "number",
        defaultValue: 0,
        placeholder: "0",
        showInTable: true,
        showInForm: true,
      },
    ],
  },
  {
    table: "sales_channels",
    name: "Canal de Venda",
    namePlural: "Canais de Venda",
    routePath: "/cadastros/canais-venda",
    icon: "shopping-cart",
    searchFields: ["name"],
    defaultOrderBy: "name",
    fields: [
      {
        name: "name",
        label: "Nome",
        type: "text",
        required: true,
        placeholder: "Ex: Loja Principal",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "type",
        label: "Tipo",
        type: "select",
        required: true,
        options: salesChannelTypeOptions,
        defaultValue: "store",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "fee_percent",
        label: "Taxa (%)",
        type: "number",
        defaultValue: 0,
        placeholder: "0",
        showInTable: true,
        showInForm: true,
      },
    ],
  },
  {
    table: "cost_centers",
    name: "Centro de Custo",
    namePlural: "Centros de Custo",
    routePath: "/cadastros/centros-custo",
    icon: "building",
    searchFields: ["name", "code"],
    defaultOrderBy: "name",
    fields: [
      {
        name: "name",
        label: "Nome",
        type: "text",
        required: true,
        placeholder: "Nome do centro de custo",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "code",
        label: "Código",
        type: "text",
        placeholder: "Código interno",
        showInTable: true,
        showInForm: true,
      },
    ],
  },
  {
    table: "bank_accounts",
    name: "Conta Bancária",
    namePlural: "Contas Bancárias",
    routePath: "/cadastros/contas-bancarias",
    icon: "wallet",
    searchFields: ["name", "bank_name", "account_number"],
    defaultOrderBy: "name",
    fields: [
      {
        name: "name",
        label: "Nome",
        type: "text",
        required: true,
        placeholder: "Ex: Caixa Principal",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "bank_name",
        label: "Nome do banco",
        type: "text",
        placeholder: "Banco do Brasil",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "agency",
        label: "Agência",
        type: "text",
        placeholder: "0000",
        showInTable: false,
        showInForm: true,
      },
      {
        name: "account_number",
        label: "Número da conta",
        type: "text",
        placeholder: "00000-0",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "account_type",
        label: "Tipo de conta",
        type: "select",
        required: true,
        options: bankAccountTypeOptions,
        defaultValue: "checking",
        showInTable: true,
        showInForm: true,
      },
    ],
  },
  {
    table: "adjustment_reasons",
    name: "Motivo de Ajuste",
    namePlural: "Motivos de Ajuste",
    routePath: "/cadastros/motivos-ajuste",
    icon: "edit",
    searchFields: ["name"],
    defaultOrderBy: "name",
    fields: [
      {
        name: "name",
        label: "Nome",
        type: "text",
        required: true,
        placeholder: "Ex: Perda",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "direction",
        label: "Direção",
        type: "select",
        required: true,
        options: adjustmentDirectionOptions,
        defaultValue: "both",
        showInTable: true,
        showInForm: true,
      },
      {
        name: "requires_approval",
        label: "Requer aprovação",
        type: "boolean",
        defaultValue: false,
        showInTable: true,
        showInForm: true,
      },
    ],
  },
  {
    table: "item_prices",
    name: "Preço por Loja",
    namePlural: "Preços por Loja",
    routePath: "/cadastros/precos-loja",
    icon: "tag",
    searchFields: [],
    defaultOrderBy: "valid_from",
    fields: [
      // Placeholder — entidade especial, config mínima
      {
        name: "price",
        label: "Preço",
        type: "number",
        required: true,
        showInTable: true,
        showInForm: false,
      },
    ],
  },
];

/** Mapa de configs por nome da tabela */
export const entityConfigs: Record<string, EntityConfig> = Object.fromEntries(
  entityConfigsList.map((c) => [c.table, c])
);

/** Mapa de configs por slug da rota (último segmento) */
const routeSlugToTable: Record<string, string> = {
  itens: "items",
  fornecedores: "suppliers",
  "grupos-ingredientes": "ingredient_groups",
  unidades: "units",
  "categorias-financeiras": "finance_categories",
  "formas-pagamento": "payment_methods",
  "canais-venda": "sales_channels",
  "centros-custo": "cost_centers",
  "contas-bancarias": "bank_accounts",
  "motivos-ajuste": "adjustment_reasons",
  "precos-loja": "item_prices",
};

/**
 * Retorna a configuração da entidade pelo slug da rota.
 * Ex: getConfigByRouteSlug("itens") → config de items
 */
export function getConfigByRouteSlug(slug: string): EntityConfig | undefined {
  const table = routeSlugToTable[slug];
  return table ? entityConfigs[table] : undefined;
}
