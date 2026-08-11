import { getD1 } from "../../../db/raw";
import { listCatalogProducts } from "../../../lib/catalog.server";

type IncomingItem = { productId?: string; quantity?: number };

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      items?: IncomingItem[];
      wish?: string;
    };
    if (!Array.isArray(payload.items) || payload.items.length === 0)
      return Response.json(
        { error: "Выберите хотя бы один товар." },
        { status: 400 },
      );

    const products = await listCatalogProducts();
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    const unavailableProductIds = [...new Set(payload.items.map((item) => item.productId).filter((id): id is string => {
      if (!id) return false;
      const product = productById.get(id);
      return !product || !product.available || product.supplierCatalogEnabled === false;
    }))];
    if (unavailableProductIds.length) return Response.json({ code: "products_unavailable", error: "Некоторые товары больше недоступны. Мы убрали их из выбора — остальные позиции сохранены.", unavailableProductIds }, { status: 409 });
    const items = payload.items.map((item) => {
      const product = item.productId
        ? productById.get(item.productId)
        : undefined;
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity))
        throw new Error("Одна из позиций больше недоступна.");
      if (quantity < 1 || quantity > 20)
        throw new Error("Проверьте количество выбранных блюд.");
      return { product, quantity };
    });

    const id = crypto.randomUUID();
    const publicId = `ГОЛОС-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const db = await getD1();
    await db.batch([
      db.prepare(
        `INSERT INTO preorders
          (id, public_id, name, phone, wish, total, status)
         VALUES (?, ?, ?, ?, ?, ?, 'new')`,
      ).bind(id, publicId, "Анонимный голос", "—", String(payload.wish ?? "").trim().slice(0, 500), 0),
      ...items.map(({ product, quantity }) =>
        db.prepare(
          `INSERT INTO preorder_items
            (id, preorder_id, product_id, product_name, supplier, quantity, unit_price)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          crypto.randomUUID(),
          id,
          product.id,
          product.name,
          product.supplier,
          quantity,
          product.price,
        ),
      ),
    ]);
    return Response.json({ voteId: publicId }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось учесть голос.";
    return Response.json({ error: message }, { status: 400 });
  }
}
