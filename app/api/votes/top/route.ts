import { getD1 } from "../../../../db/raw";

export async function GET() {
  try {
    const db = await getD1();
    const result = (await db.prepare(`
      SELECT i.product_id AS productId, SUM(i.quantity) AS votes
      FROM preorder_items i
      JOIN catalog_products p ON p.id = i.product_id
      JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.available = 1 AND s.catalog_enabled = 1
      GROUP BY i.product_id
      ORDER BY votes DESC
    `).all()) as { results?: Array<{ productId: string; votes: number }> };
    return Response.json({ votes: result.results ?? [] });
  } catch {
    return Response.json({ votes: [] });
  }
}
