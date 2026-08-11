import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { catalogProducts, catalogSettings, suppliers } from "../db/schema";
import { getSupplierFromDescription, normalizeSupplierName } from "./catalog-policy";
import { defaultProducts, type Product, type Supplier, type SupplierSummary } from "./products";

function parseImages(imagesJson: string, image: string) {
  try {
    const parsed = JSON.parse(imagesJson) as string[];
    return parsed.length ? parsed : [image];
  } catch {
    return [image];
  }
}

function toProduct(row: typeof catalogProducts.$inferSelect, supplierCatalogEnabled = true): Product {
  return {
    id: row.id,
    name: row.name,
    supplier: row.supplier as Supplier,
    supplierId: row.supplierId,
    supplierCatalogEnabled,
    category: row.category,
    description: row.description,
    weight: row.weight,
    price: row.price,
    image: row.image,
    images: parseImages(row.imagesJson, row.image),
    externalKey: row.externalKey,
    article: row.article,
    barcode: row.barcode,
    available: row.available,
  };
}

async function backfillSupplierLinks() {
  const db = await getDb();
  const [marker] = await db.select().from(catalogSettings).where(eq(catalogSettings.key, "supplier_backfill_v1")).limit(1);
  if (marker) return;

  const unlinked = await db.select({ id: catalogProducts.id, supplier: catalogProducts.supplier }).from(catalogProducts).where(isNull(catalogProducts.supplierId));
  const ids = new Map<string, string>();
  for (const row of unlinked) {
    const normalizedName = normalizeSupplierName(row.supplier);
    if (!normalizedName) continue;
    let supplierId = ids.get(normalizedName);
    if (!supplierId) {
      const [existing] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.normalizedName, normalizedName)).limit(1);
      supplierId = existing?.id ?? crypto.randomUUID();
      if (!existing) await db.insert(suppliers).values({ id: supplierId, name: row.supplier, normalizedName });
      ids.set(normalizedName, supplierId);
    }
    await db.update(catalogProducts).set({ supplierId }).where(eq(catalogProducts.id, row.id));
  }
  await db.insert(catalogSettings).values({ key: "supplier_backfill_v1", value: "completed" }).onConflictDoNothing();
}

async function splitSuppliersFromDescriptions() {
  const db = await getDb();
  const [marker] = await db.select().from(catalogSettings).where(eq(catalogSettings.key, "supplier_from_description_v1")).limit(1);
  if (marker) return;

  const products = await db.select({
    id: catalogProducts.id,
    description: catalogProducts.description,
    supplier: catalogProducts.supplier,
  }).from(catalogProducts);
  const supplierIds = new Map<string, string>();

  for (const product of products) {
    const supplierName = getSupplierFromDescription(product.description, product.supplier);
    if (supplierName === product.supplier) continue;
    const normalizedName = normalizeSupplierName(supplierName);
    let supplierId = supplierIds.get(normalizedName);
    if (!supplierId) {
      const [existing] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.normalizedName, normalizedName)).limit(1);
      supplierId = existing?.id ?? crypto.randomUUID();
      if (!existing) await db.insert(suppliers).values({ id: supplierId, name: supplierName, normalizedName, catalogEnabled: true });
      supplierIds.set(normalizedName, supplierId);
    }
    await db.update(catalogProducts).set({ supplier: supplierName, supplierId, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(catalogProducts.id, product.id));
  }

  await db.insert(catalogSettings).values({ key: "supplier_from_description_v1", value: "completed" }).onConflictDoNothing();
}

export async function ensureCatalogSeeded() {
  const db = await getDb();
  const [seedMarker] = await db.select().from(catalogSettings).where(eq(catalogSettings.key, "initial_catalog_seed")).limit(1);
  if (!seedMarker) {
    await db.insert(catalogProducts).values(defaultProducts.map((product, index) => ({ ...product, sortOrder: index }))).onConflictDoNothing();
    await db.insert(catalogSettings).values({ key: "initial_catalog_seed", value: "completed" }).onConflictDoNothing();
  }
  const [autoShowMarker] = await db.select().from(catalogSettings).where(eq(catalogSettings.key, "auto_show_imported_v1")).limit(1);
  if (!autoShowMarker) {
    await db.update(catalogProducts).set({ available: true });
    await db.insert(catalogSettings).values({ key: "auto_show_imported_v1", value: "completed" }).onConflictDoNothing();
  }
  await backfillSupplierLinks();
  await splitSuppliersFromDescriptions();
  return db;
}

export async function ensureSupplierByName(name: string) {
  const db = await ensureCatalogSeeded();
  const normalizedName = normalizeSupplierName(name);
  if (!normalizedName) throw new Error("Укажите поставщика.");
  const [existing] = await db.select().from(suppliers).where(eq(suppliers.normalizedName, normalizedName)).limit(1);
  if (existing) return existing;
  const row = { id: crypto.randomUUID(), name: name.trim(), normalizedName, catalogEnabled: true };
  await db.insert(suppliers).values(row);
  return row;
}

export async function listCatalogProducts(): Promise<Product[]> {
  const db = await ensureCatalogSeeded();
  const rows = await db.select({ product: catalogProducts, supplierCatalogEnabled: suppliers.catalogEnabled }).from(catalogProducts).leftJoin(suppliers, eq(catalogProducts.supplierId, suppliers.id)).orderBy(asc(catalogProducts.sortOrder), asc(catalogProducts.createdAt));
  return rows.map(({ product, supplierCatalogEnabled }) => toProduct(product, supplierCatalogEnabled ?? true));
}

export async function listPublicCatalogProducts(): Promise<Product[]> {
  const db = await ensureCatalogSeeded();
  const rows = await db.select({ product: catalogProducts }).from(catalogProducts).innerJoin(suppliers, eq(catalogProducts.supplierId, suppliers.id)).where(and(eq(catalogProducts.available, true), eq(suppliers.catalogEnabled, true))).orderBy(asc(catalogProducts.sortOrder), asc(catalogProducts.createdAt));
  return rows.map(({ product }) => toProduct(product, true));
}

export async function listSupplierSummaries(): Promise<SupplierSummary[]> {
  const db = await ensureCatalogSeeded();
  const rows = await db.select({
    id: suppliers.id,
    name: suppliers.name,
    normalizedName: suppliers.normalizedName,
    catalogEnabled: suppliers.catalogEnabled,
    productCount: sql<number>`count(${catalogProducts.id})`,
    activeProductCount: sql<number>`sum(case when ${catalogProducts.available} = 1 then 1 else 0 end)`,
  }).from(suppliers).leftJoin(catalogProducts, eq(catalogProducts.supplierId, suppliers.id)).groupBy(suppliers.id).having(sql`count(${catalogProducts.id}) > 0`).orderBy(asc(suppliers.name));
  return rows.map((row) => ({ ...row, productCount: Number(row.productCount ?? 0), activeProductCount: Number(row.activeProductCount ?? 0) }));
}
