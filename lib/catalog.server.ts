import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { catalogProducts, catalogSettings } from "../db/schema";
import { defaultProducts, type Product, type Supplier } from "./products";

function toProduct(row: typeof catalogProducts.$inferSelect): Product {
  return {
    id: row.id,
    name: row.name,
    supplier: row.supplier as Supplier,
    category: row.category,
    description: row.description,
    weight: row.weight,
    price: row.price,
    image: row.image,
    available: row.available,
  };
}

export async function ensureCatalogSeeded() {
  const db = await getDb();
  const [seedMarker] = await db
    .select()
    .from(catalogSettings)
    .where(eq(catalogSettings.key, "initial_catalog_seed"))
    .limit(1);

  if (!seedMarker) {
    await db
      .insert(catalogProducts)
      .values(
        defaultProducts.map((product, index) => ({
          ...product,
          sortOrder: index,
        })),
      )
      .onConflictDoNothing();
    await db
      .insert(catalogSettings)
      .values({ key: "initial_catalog_seed", value: "completed" })
      .onConflictDoNothing();
  }

  return db;
}

export async function listCatalogProducts(): Promise<Product[]> {
  const db = await ensureCatalogSeeded();
  const rows = await db
    .select()
    .from(catalogProducts)
    .orderBy(asc(catalogProducts.sortOrder), asc(catalogProducts.createdAt));
  return rows.map(toProduct);
}
