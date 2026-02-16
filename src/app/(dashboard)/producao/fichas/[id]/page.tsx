import { PageHeader } from "@/components/ui/page-header";
import { RecipeDetailView } from "@/components/producao/recipe-detail-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detalhe da Ficha Técnica"
        description="Insumos, rendimento e composição de custo."
      />
      <RecipeDetailView recipeId={id} />
    </div>
  );
}
