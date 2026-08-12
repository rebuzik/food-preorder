import { adminSessionCookie, clearAdminSessionCookie, createAdminSession, verifyAdminCredentials } from "../../../admin-auth";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { username?: string; password?: string };
    const username = typeof payload.username === "string" ? payload.username.trim().slice(0, 128) : "";
    const password = typeof payload.password === "string" ? payload.password.slice(0, 256) : "";
    if (!username || !password || !(await verifyAdminCredentials(username, password)))
      return Response.json({ error: "Неверный логин или пароль." }, { status: 401 });
    const token = await createAdminSession(username);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": adminSessionCookie(token) } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось войти." }, { status: 503 });
  }
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearAdminSessionCookie() } });
}
