import { PageHeader } from "@/components/ui/page-header";
import { DreView } from "@/components/relatorios/dre-view";

export default function DrePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="DRE — Demonstração de Resultado" description="Receitas - CMV - Perdas - Despesas. Derivado." />
      <DreView />
    </div>
  );
}
