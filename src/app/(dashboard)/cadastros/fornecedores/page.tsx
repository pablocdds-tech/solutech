import type { Metadata } from "next";
import { Suspense } from "react";
import { listEntities } from "@/actions/cadastros";
import { EntityListPage } from "@/components/cadastros/entity-list-page";
import { getConfigByRouteSlug } from "@/lib/cadastros/entity-configs";

export const metadata: Metadata = { title: "Fornecedores" };

export default async function FornecedoresPage() {
  const config = getConfigByRouteSlug("fornecedores")!;
  const result = await listEntities(config.table, {
    activeOnly: false,
    orderBy: config.defaultOrderBy,
    searchFields: config.searchFields,
  });
  const data = (result.data as { items?: unknown[] } | undefined)?.items ?? [];

  return (
    <Suspense fallback={<div className="animate-pulse">Carregando...</div>}>
      <EntityListPage config={config} initialData={data as Record<string, unknown>[]} />
    </Suspense>
  );
}
