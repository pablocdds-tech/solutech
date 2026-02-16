import { PageHeader } from "@/components/ui/page-header";
import { RecipesView } from "@/components/producao/recipes-view";

export default function FichasPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fichas Técnicas"
        description="Receitas com insumos, rendimento e percentual de perda."
      />
      <RecipesView />
    </div>
  );
}
