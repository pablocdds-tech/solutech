import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OfxImportView } from "@/components/conciliacao/ofx-import-view";
import type { Store, BankAccount } from "@/types/database";

export default async function ImportarOfxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const orgId = profile.org_id;

  const [storesRes, accountsRes] = await Promise.all([
    supabase
      .from("stores")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("bank_accounts")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <OfxImportView
      stores={(storesRes.data ?? []) as Store[]}
      bankAccounts={(accountsRes.data ?? []) as BankAccount[]}
    />
  );
}
