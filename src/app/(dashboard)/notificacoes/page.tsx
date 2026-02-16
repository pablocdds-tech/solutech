import { PageHeader } from "@/components/ui/page-header";
import { NotificationsView } from "@/components/notificacoes/notifications-view";

export default function NotificacoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Notificações" description="Inbox como fonte de verdade. WhatsApp/email como espelho." />
      <NotificationsView />
    </div>
  );
}
