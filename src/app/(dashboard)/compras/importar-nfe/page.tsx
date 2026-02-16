import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NfeImportView } from "@/components/compras/nfe-import-view";
import type { Store } from "@/types/database";

export default async function ImportarNfePage() {
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

  const { data: stores } = await supabase
    .from("stores")
    .select("*")
    .eq("org_id", profile.org_id)
    .eq("is_active", true)
    .order("name");

  return <NfeImportView stores={(stores ?? []) as Store[]} />;
}
