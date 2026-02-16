import { listUsers, listStores } from "@/actions/admin";
import { AdminView } from "@/components/admin/admin-view";

export default async function AdminPage() {
  const [usersResult, storesResult] = await Promise.all([
    listUsers(),
    listStores(),
  ]);

  return (
    <AdminView
      users={usersResult.data ?? []}
      stores={storesResult.data ?? []}
    />
  );
}
