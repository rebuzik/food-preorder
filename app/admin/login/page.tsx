import { redirect } from "next/navigation";
import { hasAdminSession } from "../../admin-auth";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { AdminLoginForm } from "./admin-login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const user = await requireChatGPTUser("/admin/login");
  if (await hasAdminSession(user.email)) redirect("/admin");
  return <AdminLoginForm userName={user.displayName} />;
}
