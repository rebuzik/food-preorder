import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { getD1 } from "../../../../db/raw";
import { preorders } from "../../../../db/schema";
import { getAuthorizedAdmin } from "../../../admin-auth";

const allowedStatuses = ["new", "contacted", "confirmed", "cancelled"];

export async function PATCH(request: Request) {
  const user = await getAuthorizedAdmin();
  if (!user)
    return Response.json({ error: "Требуется вход администратора." }, { status: 401 });
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

export async function DELETE(request: Request) {
  const user = await getAuthorizedAdmin();
  if (!user) return Response.json({ error: "Требуется вход администратора." }, { status: 401 });
  try {
    const payload = (await request.json()) as { id?: string };
    if (!payload.id) throw new Error("Голос не найден.");
    const db = await getD1();
    const existing = await db.prepare("SELECT id, public_id FROM preorders WHERE id = ? LIMIT 1").bind(payload.id).first<{ id: string; public_id: string }>();
    if (!existing) throw new Error("Голос уже удалён.");
    await db.batch([
      db.prepare("DELETE FROM preorder_items WHERE preorder_id = ?").bind(payload.id),
      db.prepare("DELETE FROM preorders WHERE id = ?").bind(payload.id),
      db.prepare("INSERT INTO admin_audit_events (id,actor_email,action,entity_type,entity_id,before_json,after_json,reason,created_at) VALUES (?,?,?,?,?,?,?,'test_vote_removed',CURRENT_TIMESTAMP)").bind(crypto.randomUUID(), user.email, "preorder_deleted", "preorder", payload.id, JSON.stringify({ publicId: existing.public_id }), "{}"),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось удалить голос." }, { status: 400 });
  }
}
