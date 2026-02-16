import { PageHeader } from "@/components/ui/page-header";
import { NewReceivingForm } from "@/components/compras/new-receiving-form";

export default function NovoRecebimentoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Recebimento"
        description="Preencha os dados do cabeçalho da NF para iniciar o rascunho."
      />
      <NewReceivingForm />
    </div>
  );
}
