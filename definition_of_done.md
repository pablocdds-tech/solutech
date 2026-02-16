# Definition of Done — Vitaliano ERP

Um item só é considerado **PRONTO** quando TODAS as condições abaixo são verdadeiras.

---

## 1. Banco e Segurança
- RLS implementado e testado.
- Usuário não acessa loja não permitida.
- Nenhum saldo editável existe.
- Constraints anti-duplicidade aplicadas.
- Migrações reversíveis.

---

## 2. Regras de Domínio
- Estoque só via inventory_moves.
- Banco virtual só via ledger.
- Banco real só via bank_transactions.
- AP/AR só mudam status com evidência.
- Produção é transacional.
- Importações são idempotentes.

---

## 3. Auditoria
- Ações críticas registram audit_logs.
- source_type/source_id presentes.
- request_id rastreável.

---

## 4. Funcionalidade
- Fluxo completo testado ponta-a-ponta.
- Critérios de aceite do PR aprovados.
- Não quebra fluxos existentes.

---

## 5. Qualidade Técnica
- Código tipado e lintado.
- Sem erros no Sentry.
- Logs estruturados.
- Commits pequenos e claros.

---

## 6. UX mínima
- Funciona no mobile.
- Estados de erro claros.
- Nenhuma ação crítica sem confirmação.

---

## 7. Documentação
- PR template preenchido.
- Issue vinculada.
- Fluxo descrito no README/módulo.

---

# Regra Suprema

> Se viola um invariante do ERP  
> → NÃO está pronto  
> → mesmo que “funcione”.

