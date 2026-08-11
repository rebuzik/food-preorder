import { asc, eq, inArray, sql } from "drizzle-orm";
import { catalogProducts } from "../../../../db/schema";
import { ensureCatalogSeeded, ensureSupplierByName } from "../../../../lib/catalog.server";
import type { Supplier } from "../../../../lib/products";
import { getAuthorizedAdmin } from "../../../admin-auth";

type ProductPayload = {
  id?: string;
  name?: string;
  supplier?: string;
  category?: string;
  description?: string;
  weight?: string;
  price?: number;
  image?: string;
  images?: string[];
  externalKey?: string | null;
  article?: string | null;
  barcode?: string | null;
  available?: boolean;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseProduct(payload: ProductPayload) {
  const name = cleanText(payload.name, 100);
  const category = cleanText(payload.category, 50);
  const description = cleanText(payload.description, 320);
  const weight = cleanText(payload.weight, 30);
  const image = cleanText(payload.image, 500);
  const supplier = cleanText(payload.supplier, 160) as Supplier;
  const price = Number(payload.price);

  if (name.length < 2) throw new Error("Укажите название блюда.");
  if (supplier.length < 2) throw new Error("Укажите поставщика.");
  if (category.length < 2) throw new Error("Укажите категорию.");
  if (description.length < 3) throw new Error("Добавьте короткое описание.");
  if (!Number.isInteger(price) || price < 100 || price > 10_000_000)
    throw new Error("Проверьте цену блюда.");
  if (
    !image.startsWith("/images/") &&
    !image.startsWith("/api/product-images/") &&
    !image.startsWith("https://") &&
    !image.startsWith("http://")
  )
    throw new Error("Загрузите фотографию блюда.");

  const images = (Array.isArray(payload.images) ? payload.images : [image]).map((value) => cleanText(value, 1000)).filter((value, index, list) => value && list.indexOf(value) === index).slice(0,12);
  return {
    name,
    supplier,
    category,
    description,
    weight,
    price,
    image,
    imagesJson: JSON.stringify(images.length ? images : [image]),
    externalKey: cleanText(payload.externalKey, 240) || null,
    article: cleanText(payload.article, 160) || null,
    barcode: cleanText(payload.barcode, 80) || null,
    available: payload.available !== false,
  };
}

async function requireAdmin() {
  const user = await getAuthorizedAdmin();
  if (!user) throw new Error("Требуется вход администратора.");
}

function withImages<T extends { image: string; imagesJson?: string }>(product: T) {
  let images = [product.image];
  try { const parsed = JSON.parse(product.imagesJson ?? "[]") as string[]; if (parsed.length) images = parsed; } catch { /* use primary */ }
  return { ...product, images };
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const product = parseProduct((await request.json()) as ProductPayload);
    const supplierRecord = await ensureSupplierByName(product.supplier);
    const db = await ensureCatalogSeeded();
    const [lastProduct] = await db
      .select({ sortOrder: catalogProducts.sortOrder })
      .from(catalogProducts)
      .orderBy(sql`${catalogProducts.sortOrder} DESC`)
      .limit(1);
    const row = {
      id: crypto.randomUUID(),
      ...product,
      supplierId: supplierRecord.id,
      sortOrder: (lastProduct?.sortOrder ?? -1) + 1,
    };
    await db.insert(catalogProducts).values(row);
    return Response.json(withImages({ ...row, supplierCatalogEnabled: supplierRecord.catalogEnabled }), { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось добавить блюдо.";
    return Response.json(
      { error: message },
      { status: message === "Требуется вход администратора." ? 401 : 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const payload = (await request.json()) as ProductPayload;
    if (!payload.id) throw new Error("Блюдо не найдено.");
    const product = parseProduct(payload);
    const supplierRecord = await ensureSupplierByName(product.supplier);
    const db = await ensureCatalogSeeded();
    await db
      .update(catalogProducts)
      .set({ ...product, supplierId: supplierRecord.id, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(catalogProducts.id, payload.id));
    return Response.json(withImages({ id: payload.id, ...product, supplierId: supplierRecord.id, supplierCatalogEnabled: supplierRecord.catalogEnabled }));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось сохранить блюдо.";
    return Response.json(
      { error: message },
      { status: message === "Требуется вход администратора." ? 401 : 400 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const payload = (await request.json()) as { available?: boolean; ids?: string[] };
    const available = payload.available !== false;
    const db = await ensureCatalogSeeded();
    const ids = Array.isArray(payload.ids) ? [...new Set(payload.ids.filter((id) => typeof id === "string"))].slice(0, 3000) : [];
    if (ids.length) {
      for (let index = 0; index < ids.length; index += 80) {
        await db.update(catalogProducts).set({ available, updatedAt: sql`CURRENT_TIMESTAMP` }).where(inArray(catalogProducts.id, ids.slice(index, index + 80)));
      }
    } else {
      await db.update(catalogProducts).set({ available, updatedAt: sql`CURRENT_TIMESTAMP` });
    }
    return Response.json({ ok: true, available });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить каталог.";
    return Response.json({ error: message }, { status: message === "Требуется вход администратора." ? 401 : 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) throw new Error("Блюдо не найдено.");
    const db = await ensureCatalogSeeded();
    const [product] = await db
      .select()
      .from(catalogProducts)
      .where(eq(catalogProducts.id, id))
      .orderBy(asc(catalogProducts.sortOrder))
      .limit(1);
    if (!product) throw new Error("Блюдо уже удалено.");

    await db.delete(catalogProducts).where(eq(catalogProducts.id, id));

    if (product.image.startsWith("/api/product-images/")) {
      const key = decodeURIComponent(
        product.image.slice("/api/product-images/".length),
      );
      const { env } = await import("cloudflare:workers");
      await env.BUCKET?.delete(key);
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось удалить блюдо.";
    return Response.json(
      { error: message },
      { status: message === "Требуется вход администратора." ? 401 : 400 },
    );
  }
}
