import { redirect } from "next/navigation";
import { hasAdminSession } from "../../admin-auth";
import { AdminLoginForm } from "./admin-login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await hasAdminSession()) redirect("/admin");
  return <AdminLoginForm />;
}
