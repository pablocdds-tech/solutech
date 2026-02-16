/**
 * Parser OFX — converte conteúdo de arquivo OFX em transações estruturadas.
 *
 * O formato OFX (Open Financial Exchange) é baseado em SGML/XML.
 * Bancos brasileiros geralmente exportam em OFX 1.x (SGML).
 *
 * Extrai: FITID, data, valor, descrição, memo, tipo.
 * Idempotência garantida por FITID (identificador único da transação).
 */

export interface OfxTransaction {
  fitid: string;
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  memo: string | null;
  typeCode: string;
  rawDate: string;
}

export interface OfxParseResult {
  bankId: string | null;
  accountId: string | null;
  accountType: string | null;
  currency: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  transactions: OfxTransaction[];
  errors: string[];
}

function extractTag(content: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function extractBlock(content: string, tag: string): string | null {
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  const startIdx = content.indexOf(openTag);
  if (startIdx === -1) return null;

  const endIdx = content.indexOf(closeTag, startIdx);
  if (endIdx === -1) {
    return content.substring(startIdx + openTag.length);
  }
  return content.substring(startIdx + openTag.length, endIdx);
}

function parseOfxDate(dateStr: string): string {
  // OFX dates: YYYYMMDDHHMMSS[.XXX:gmt_offset]  or  YYYYMMDD
  const clean = dateStr.replace(/\[.*\]/, "").trim();
  const year = clean.substring(0, 4);
  const month = clean.substring(4, 6);
  const day = clean.substring(6, 8);
  return `${year}-${month}-${day}`;
}

function extractTransactions(stmtTrnBlock: string): OfxTransaction[] {
  const transactions: OfxTransaction[] = [];

  // Split by <STMTTRN> tags
  const parts = stmtTrnBlock.split(/<STMTTRN>/i);

  for (const part of parts) {
    if (!part.trim()) continue;

    const trnType = extractTag(part, "TRNTYPE");
    const dtPosted = extractTag(part, "DTPOSTED");
    const trnAmt = extractTag(part, "TRNAMT");
    const fitid = extractTag(part, "FITID");
    const name = extractTag(part, "NAME");
    const memo = extractTag(part, "MEMO");

    if (!fitid || !dtPosted || !trnAmt) continue;

    const amount = parseFloat(trnAmt.replace(",", "."));
    if (isNaN(amount)) continue;

    transactions.push({
      fitid: fitid.trim(),
      date: parseOfxDate(dtPosted),
      amount,
      description: name?.trim() ?? "",
      memo: memo?.trim() || null,
      typeCode: trnType?.trim() ?? "OTHER",
      rawDate: dtPosted.trim(),
    });
  }

  return transactions;
}

/**
 * Parseia o conteúdo de um arquivo OFX.
 * Suporta OFX 1.x (SGML) e 2.x (XML).
 */
export function parseOfxContent(content: string): OfxParseResult {
  const errors: string[] = [];

  // Normalizar line endings
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Extrair info da conta
  const bankId = extractTag(normalized, "BANKID");
  const accountId = extractTag(normalized, "ACCTID");
  const accountType = extractTag(normalized, "ACCTTYPE");
  const curDef = extractTag(normalized, "CURDEF");

  // Extrair período
  const dtStart = extractTag(normalized, "DTSTART");
  const dtEnd = extractTag(normalized, "DTEND");

  // Extrair bloco de transações
  const bankTranList = extractBlock(normalized, "BANKTRANLIST");

  if (!bankTranList) {
    errors.push("Bloco BANKTRANLIST não encontrado no arquivo OFX");
    return {
      bankId, accountId, accountType,
      currency: curDef,
      periodStart: dtStart ? parseOfxDate(dtStart) : null,
      periodEnd: dtEnd ? parseOfxDate(dtEnd) : null,
      transactions: [],
      errors,
    };
  }

  const transactions = extractTransactions(bankTranList);

  if (transactions.length === 0) {
    errors.push("Nenhuma transação encontrada no arquivo OFX");
  }

  // Verificar duplicatas por FITID
  const fitidSet = new Set<string>();
  const uniqueTransactions: OfxTransaction[] = [];
  for (const tx of transactions) {
    if (fitidSet.has(tx.fitid)) {
      errors.push(`FITID duplicado ignorado: ${tx.fitid}`);
      continue;
    }
    fitidSet.add(tx.fitid);
    uniqueTransactions.push(tx);
  }

  return {
    bankId,
    accountId,
    accountType,
    currency: curDef,
    periodStart: dtStart ? parseOfxDate(dtStart) : null,
    periodEnd: dtEnd ? parseOfxDate(dtEnd) : null,
    transactions: uniqueTransactions,
    errors,
  };
}

/**
 * Gera hash_key para transação sem FITID (fallback anti-duplicidade).
 */
export function generateTxHashKey(
  bankAccountId: string,
  date: string,
  amount: number,
  description: string
): string {
  const raw = `${bankAccountId}|${date}|${amount}|${description}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash_${Math.abs(hash).toString(36)}`;
}
