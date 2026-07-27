import { getD1 } from "../../../db/raw";
import { listCatalogProducts } from "../../../lib/catalog.server";

type IncomingItem = { productId?: string; quantity?: number };

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  if (digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.startsWith("7")) return `+${digits}`;
  return null;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      phone?: string;
      items?: IncomingItem[];
    };
    const name = payload.name?.trim().slice(0, 80) ?? "";
    const phone = normalizePhone(payload.phone ?? "");

    if (name.length < 2)
      return Response.json(
        { error: "Укажите имя — хотя бы два символа." },
        { status: 400 },
      );
    if (!phone)
      return Response.json(
        { error: "Проверьте номер телефона." },
        { status: 400 },
      );
    if (!Array.isArray(payload.items) || payload.items.length === 0)
      return Response.json(
        { error: "Добавьте хотя бы одно блюдо." },
        { status: 400 },
      );

    const products = await listCatalogProducts();
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    const items = payload.items.map((item) => {
      const product = item.productId
        ? productById.get(item.productId)
        : undefined;
      const quantity = Number(item.quantity);
      if (!product || !product.available || !Number.isInteger(quantity))
        throw new Error("Одна из позиций больше недоступна.");
      if (quantity < 1 || quantity > 20)
        throw new Error("Проверьте количество выбранных блюд.");
      return { product, quantity };
    });

    const id = crypto.randomUUID();
    const publicId = `ЕДА-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const total = items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );
    const db = await getD1();
    await db.batch([
      db.prepare(
        `INSERT INTO preorders
          (id, public_id, name, phone, total, status)
         VALUES (?, ?, ?, ?, ?, 'new')`,
      ).bind(id, publicId, name, phone, total),
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
    return Response.json({ publicId }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось сохранить предзаказ.";
    return Response.json({ error: message }, { status: 400 });
  }
}
