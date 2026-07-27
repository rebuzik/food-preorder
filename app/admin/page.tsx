import { desc } from "drizzle-orm";
import { getDb } from "../../db";
import { preorders } from "../../db/schema";
import { listCatalogProducts } from "../../lib/catalog.server";
import { requireChatGPTUser } from "../chatgpt-auth";
import { AdminConsole } from "./admin-console";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  const ordersPromise = getDb().then((db) =>
    db
      .select()
      .from(preorders)
      .orderBy(desc(preorders.createdAt))
      .limit(100),
  );
  const productsPromise = listCatalogProducts();
  const [orders, products] = await Promise.all([
    ordersPromise,
    productsPromise,
  ]);
  return (
    <AdminConsole
      initialOrders={orders}
      initialProducts={products}
      userName={user.displayName}
    />
  );
}
