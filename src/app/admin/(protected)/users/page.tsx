import { getAdminUsersData } from "@/lib/admin-users";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const data = await getAdminUsersData();

  return <UsersClient initialData={data} />;
}
