import { asc, eq, sql } from "drizzle-orm";
import { catalogProducts } from "../../../../db/schema";
import { ensureCatalogSeeded } from "../../../../lib/catalog.server";
import type { Supplier } from "../../../../lib/products";
import { getChatGPTUser } from "../../../chatgpt-auth";

const suppliers = new Set<Supplier>(["Партик", "Лаборатория еды"]);

type ProductPayload = {
  id?: string;
  name?: string;
  supplier?: string;
  category?: string;
  description?: string;
  weight?: string;
  price?: number;
  image?: string;
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
  const supplier = payload.supplier as Supplier;
  const price = Number(payload.price);

  if (name.length < 2) throw new Error("Укажите название блюда.");
  if (!suppliers.has(supplier)) throw new Error("Выберите поставщика.");
  if (category.length < 2) throw new Error("Укажите категорию.");
  if (description.length < 3) throw new Error("Добавьте короткое описание.");
  if (!weight) throw new Error("Укажите вес или объём.");
  if (!Number.isInteger(price) || price < 100 || price > 10_000_000)
    throw new Error("Проверьте цену блюда.");
  if (
    !image.startsWith("/images/") &&
    !image.startsWith("/api/product-images/")
  )
    throw new Error("Загрузите фотографию блюда.");

  return {
    name,
    supplier,
    category,
    description,
    weight,
    price,
    image,
    available: payload.available !== false,
  };
}

async function requireAdmin() {
  const user = await getChatGPTUser();
  if (!user) throw new Error("Требуется вход.");
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const product = parseProduct((await request.json()) as ProductPayload);
    const db = await ensureCatalogSeeded();
    const [lastProduct] = await db
      .select({ sortOrder: catalogProducts.sortOrder })
      .from(catalogProducts)
      .orderBy(sql`${catalogProducts.sortOrder} DESC`)
      .limit(1);
    const row = {
      id: crypto.randomUUID(),
      ...product,
      sortOrder: (lastProduct?.sortOrder ?? -1) + 1,
    };
    await db.insert(catalogProducts).values(row);
    return Response.json(row, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось добавить блюдо.";
    return Response.json(
      { error: message },
      { status: message === "Требуется вход." ? 401 : 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const payload = (await request.json()) as ProductPayload;
    if (!payload.id) throw new Error("Блюдо не найдено.");
    const product = parseProduct(payload);
    const db = await ensureCatalogSeeded();
    await db
      .update(catalogProducts)
      .set({ ...product, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(catalogProducts.id, payload.id));
    return Response.json({ id: payload.id, ...product });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось сохранить блюдо.";
    return Response.json(
      { error: message },
      { status: message === "Требуется вход." ? 401 : 400 },
    );
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
      { status: message === "Требуется вход." ? 401 : 400 },
    );
  }
}
