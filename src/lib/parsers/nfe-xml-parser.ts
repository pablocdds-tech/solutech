/**
 * Parser NF-e XML — extrai dados de XML de Nota Fiscal Eletrônica brasileira.
 *
 * Compatível com NF-e versão 4.00 (padrão SEFAZ).
 * Extrai: emitente, destinatário, itens, totais, chave de acesso, duplicatas.
 *
 * Idempotência: chave de acesso (44 dígitos) é o identificador único.
 */

export interface NfeEmitente {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  ie: string | null;
  uf: string | null;
  municipio: string | null;
}

export interface NfeDestinatario {
  cnpj: string | null;
  cpf: string | null;
  razaoSocial: string;
  uf: string | null;
}

export interface NfeItem {
  numero: number;
  codigo: string;
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ean: string | null;
}

export interface NfeDuplicata {
  numero: string;
  vencimento: string | null; // YYYY-MM-DD
  valor: number;
}

export interface NfeTotais {
  valorProdutos: number;
  valorDesconto: number;
  valorFrete: number;
  valorOutros: number;
  valorIcms: number;
  valorIpi: number;
  valorPis: number;
  valorCofins: number;
  valorNf: number;
}

export interface NfeParseResult {
  chaveAcesso: string | null;
  numero: string | null;
  serie: string | null;
  dataEmissao: string | null; // YYYY-MM-DD
  naturezaOperacao: string | null;
  emitente: NfeEmitente | null;
  destinatario: NfeDestinatario | null;
  itens: NfeItem[];
  totais: NfeTotais | null;
  duplicatas: NfeDuplicata[];
  informacoesComplementares: string | null;
  errors: string[];
}

function getTagContent(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function getBlock(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function getAllBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  const matches = xml.match(regex);
  return matches ?? [];
}

function parseXmlDate(dateStr: string): string {
  // NF-e dates: YYYY-MM-DD or YYYY-MM-DDThh:mm:ssTZD
  return dateStr.substring(0, 10);
}

function parseNumber(value: string | null): number {
  if (!value) return 0;
  return parseFloat(value.replace(",", ".")) || 0;
}

function parseEmitente(emitBlock: string): NfeEmitente | null {
  const cnpj = getTagContent(emitBlock, "CNPJ");
  if (!cnpj) return null;

  const enderBlock = getBlock(emitBlock, "enderEmit") ?? "";

  return {
    cnpj: cnpj.replace(/[^\d]/g, ""),
    razaoSocial: getTagContent(emitBlock, "xNome") ?? "",
    nomeFantasia: getTagContent(emitBlock, "xFant"),
    ie: getTagContent(emitBlock, "IE"),
    uf: getTagContent(enderBlock, "UF"),
    municipio: getTagContent(enderBlock, "xMun"),
  };
}

function parseDestinatario(destBlock: string): NfeDestinatario | null {
  const cnpj = getTagContent(destBlock, "CNPJ");
  const cpf = getTagContent(destBlock, "CPF");
  if (!cnpj && !cpf) return null;

  return {
    cnpj: cnpj?.replace(/[^\d]/g, "") ?? null,
    cpf: cpf?.replace(/[^\d]/g, "") ?? null,
    razaoSocial: getTagContent(destBlock, "xNome") ?? "",
    uf: getTagContent(getBlock(destBlock, "enderDest") ?? "", "UF"),
  };
}

function parseItens(xml: string): NfeItem[] {
  const detBlocks = getAllBlocks(xml, "det");
  const itens: NfeItem[] = [];

  for (let i = 0; i < detBlocks.length; i++) {
    const det = detBlocks[i];
    const prodBlock = getBlock(det, "prod");
    if (!prodBlock) continue;

    itens.push({
      numero: i + 1,
      codigo: getTagContent(prodBlock, "cProd") ?? "",
      descricao: getTagContent(prodBlock, "xProd") ?? "",
      ncm: getTagContent(prodBlock, "NCM"),
      cfop: getTagContent(prodBlock, "CFOP"),
      unidade: getTagContent(prodBlock, "uCom") ?? "UN",
      quantidade: parseNumber(getTagContent(prodBlock, "qCom")),
      valorUnitario: parseNumber(getTagContent(prodBlock, "vUnCom")),
      valorTotal: parseNumber(getTagContent(prodBlock, "vProd")),
      ean: getTagContent(prodBlock, "cEAN"),
    });
  }

  return itens;
}

function parseTotais(icmsTotBlock: string): NfeTotais {
  return {
    valorProdutos: parseNumber(getTagContent(icmsTotBlock, "vProd")),
    valorDesconto: parseNumber(getTagContent(icmsTotBlock, "vDesc")),
    valorFrete: parseNumber(getTagContent(icmsTotBlock, "vFrete")),
    valorOutros: parseNumber(getTagContent(icmsTotBlock, "vOutro")),
    valorIcms: parseNumber(getTagContent(icmsTotBlock, "vICMS")),
    valorIpi: parseNumber(getTagContent(icmsTotBlock, "vIPI")),
    valorPis: parseNumber(getTagContent(icmsTotBlock, "vPIS")),
    valorCofins: parseNumber(getTagContent(icmsTotBlock, "vCOFINS")),
    valorNf: parseNumber(getTagContent(icmsTotBlock, "vNF")),
  };
}

function parseDuplicatas(cobrBlock: string): NfeDuplicata[] {
  const dupBlocks = getAllBlocks(cobrBlock, "dup");
  return dupBlocks.map((dup) => ({
    numero: getTagContent(dup, "nDup") ?? "",
    vencimento: getTagContent(dup, "dVenc"),
    valor: parseNumber(getTagContent(dup, "vDup")),
  }));
}

/**
 * Parseia o conteúdo de um XML de NF-e.
 */
export function parseNfeXml(xmlContent: string): NfeParseResult {
  const errors: string[] = [];

  // Extrair chave de acesso do infNFe ou protNFe
  let chaveAcesso: string | null = null;
  const chNFeMatch = xmlContent.match(/<chNFe>(\d{44})<\/chNFe>/);
  if (chNFeMatch) {
    chaveAcesso = chNFeMatch[1];
  } else {
    const infNFeIdMatch = xmlContent.match(/Id="NFe(\d{44})"/);
    if (infNFeIdMatch) {
      chaveAcesso = infNFeIdMatch[1];
    }
  }

  if (!chaveAcesso) {
    errors.push("Chave de acesso (44 dígitos) não encontrada no XML");
  }

  // Extrair bloco infNFe
  const infNFe = getBlock(xmlContent, "infNFe") ?? xmlContent;

  // Dados da NF-e
  const ideBlock = getBlock(infNFe, "ide") ?? "";
  const numero = getTagContent(ideBlock, "nNF");
  const serie = getTagContent(ideBlock, "serie");
  const dhEmi = getTagContent(ideBlock, "dhEmi") ?? getTagContent(ideBlock, "dEmi");
  const natOp = getTagContent(ideBlock, "natOp");

  // Emitente
  const emitBlock = getBlock(infNFe, "emit");
  const emitente = emitBlock ? parseEmitente(emitBlock) : null;
  if (!emitente) errors.push("Dados do emitente não encontrados");

  // Destinatário
  const destBlock = getBlock(infNFe, "dest");
  const destinatario = destBlock ? parseDestinatario(destBlock) : null;

  // Itens
  const itens = parseItens(infNFe);
  if (itens.length === 0) errors.push("Nenhum item encontrado na NF-e");

  // Totais
  const totalBlock = getBlock(infNFe, "total");
  const icmsTotBlock = totalBlock ? getBlock(totalBlock, "ICMSTot") : null;
  const totais = icmsTotBlock ? parseTotais(icmsTotBlock) : null;
  if (!totais) errors.push("Totais não encontrados na NF-e");

  // Duplicatas (Cobrança)
  const cobrBlock = getBlock(infNFe, "cobr");
  const duplicatas = cobrBlock ? parseDuplicatas(cobrBlock) : [];

  // Informações complementares
  const infAdic = getBlock(infNFe, "infAdic");
  const infCpl = infAdic ? getTagContent(infAdic, "infCpl") : null;

  return {
    chaveAcesso,
    numero,
    serie,
    dataEmissao: dhEmi ? parseXmlDate(dhEmi) : null,
    naturezaOperacao: natOp,
    emitente,
    destinatario,
    itens,
    totais,
    duplicatas,
    informacoesComplementares: infCpl,
    errors,
  };
}

/**
 * Converte resultado do parse de NF-e para draft de recebimento (purchases.ai_extract_invoice_draft).
 */
export function nfeToReceivingDraft(nfe: NfeParseResult) {
  return {
    invoiceKey: nfe.chaveAcesso,
    invoiceNumber: nfe.numero,
    invoiceSeries: nfe.serie,
    issueDate: nfe.dataEmissao,
    supplierCnpj: nfe.emitente?.cnpj ?? null,
    supplierName: nfe.emitente?.razaoSocial ?? null,
    totalAmount: nfe.totais?.valorNf ?? 0,
    items: nfe.itens.map((item) => ({
      code: item.codigo,
      description: item.descricao,
      unit: item.unidade,
      quantity: item.quantidade,
      unitPrice: item.valorUnitario,
      totalPrice: item.valorTotal,
      ncm: item.ncm,
      cfop: item.cfop,
      ean: item.ean,
    })),
    paymentPlan: nfe.duplicatas.map((dup) => ({
      installment: dup.numero,
      dueDate: dup.vencimento,
      amount: dup.valor,
    })),
    freight: nfe.totais?.valorFrete ?? 0,
    discount: nfe.totais?.valorDesconto ?? 0,
    otherCharges: nfe.totais?.valorOutros ?? 0,
    notes: nfe.informacoesComplementares,
  };
}
