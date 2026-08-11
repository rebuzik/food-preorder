import { and, eq, sql } from "drizzle-orm";
import { adminAuditEvents, catalogProducts, suppliers } from "../../../../../db/schema";
import { ensureCatalogSeeded } from "../../../../../lib/catalog.server";
import { getAuthorizedAdmin } from "../../../../admin-auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthorizedAdmin();
  if (!user) return Response.json({ error: "Требуется вход администратора." }, { status: 401 });
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as { catalogEnabled?: boolean; reason?: string };
    if (typeof payload.catalogEnabled !== "boolean") throw new Error("Укажите новый статус поставщика.");
    const db = await ensureCatalogSeeded();
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!supplier) throw new Error("Поставщик не найден.");
    const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(catalogProducts).where(and(eq(catalogProducts.supplierId, id), eq(catalogProducts.available, true)));
    const affectedProducts = Number(countRow?.count ?? 0);
    if (supplier.catalogEnabled === payload.catalogEnabled) return Response.json({ supplier, affectedProducts, changed: false });
    const updatedAt = new Date().toISOString();
    await db.batch([
      db.update(suppliers).set({ catalogEnabled: payload.catalogEnabled, updatedAt }).where(eq(suppliers.id, id)),
      db.insert(adminAuditEvents).values({
        id: crypto.randomUUID(),
        actorEmail: user.email,
        action: payload.catalogEnabled ? "supplier_catalog_enabled" : "supplier_catalog_disabled",
        entityType: "supplier",
        entityId: id,
        beforeJson: JSON.stringify({ catalogEnabled: supplier.catalogEnabled }),
        afterJson: JSON.stringify({ catalogEnabled: payload.catalogEnabled, affectedProducts }),
        reason: String(payload.reason ?? "").trim().slice(0, 500),
      }),
    ]);
    return Response.json({ supplier: { ...supplier, catalogEnabled: payload.catalogEnabled, updatedAt }, affectedProducts, changed: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось обновить поставщика." }, { status: 400 });
  }
}
