import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { preorders } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

const allowedStatuses = ["new", "contacted", "confirmed", "cancelled"];

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "Требуется вход." }, { status: 401 });
  const payload = (await request.json()) as { id?: string; status?: string };
  if (
    !payload.id ||
    !payload.status ||
    !allowedStatuses.includes(payload.status)
  )
    return Response.json({ error: "Некорректные данные." }, { status: 400 });

  const db = await getDb();
  await db
    .update(preorders)
    .set({ status: payload.status })
    .where(eq(preorders.id, payload.id));
  return Response.json({ ok: true });
}
