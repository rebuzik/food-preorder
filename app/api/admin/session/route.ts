import { adminSessionCookie, clearAdminSessionCookie, createAdminSession, verifyAdminPassword } from "../../../admin-auth";
import { getChatGPTUser } from "../../../chatgpt-auth";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите через ChatGPT." }, { status: 401 });
  try {
    const payload = (await request.json()) as { password?: string };
    const password = typeof payload.password === "string" ? payload.password.slice(0, 256) : "";
    if (!password || !(await verifyAdminPassword(password))) return Response.json({ error: "Неверный пароль." }, { status: 401 });
    const token = await createAdminSession(user.email);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": adminSessionCookie(token) } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось войти." }, { status: 503 });
  }
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearAdminSessionCookie() } });
}
