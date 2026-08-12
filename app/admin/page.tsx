import { desc } from "drizzle-orm";
import { getDb } from "../../db";
import { preorderItems, preorders } from "../../db/schema";
import { listCatalogProducts, listSupplierSummaries } from "../../lib/catalog.server";
import { getAuthorizedAdmin } from "../admin-auth";
import { AdminConsole } from "./admin-console";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAuthorizedAdmin();
  if (!user) redirect("/admin/login");
  const ordersPromise = getDb().then(async (db) => {
    const [orders, items] = await Promise.all([
      db.select().from(preorders).orderBy(desc(preorders.createdAt)),
      db.select().from(preorderItems),
    ]);
    const itemsByOrder = new Map<string, typeof items>();
    items.forEach((item) => {
      const current = itemsByOrder.get(item.preorderId) ?? [];
      current.push(item);
      itemsByOrder.set(item.preorderId, current);
    });
    return orders.map((order) => ({
      ...order,
      items: itemsByOrder.get(order.id) ?? [],
    }));
  });
  const productsPromise = listCatalogProducts();
  const suppliersPromise = listSupplierSummaries();
  const [orders, products, suppliers] = await Promise.all([
    ordersPromise,
    productsPromise,
    suppliersPromise,
  ]);
  return (
    <AdminConsole
      initialOrders={orders}
      initialProducts={products}
      initialSuppliers={suppliers}
      userName={user.displayName}
    />
  );
}
