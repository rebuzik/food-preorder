import { getD1 } from "../../../../../db/raw";
import { getImportExclusionReason, getSupplierFromDescription, normalizeCatalogText, normalizeSupplierName } from "../../../../../lib/catalog-policy";
import { ensureCatalogSeeded, listCatalogProducts } from "../../../../../lib/catalog.server";
import { getAuthorizedAdmin } from "../../../../admin-auth";

type Row = { sourceRow?: number; name?: string; article?: string; barcode?: string; supplier?: string; category?: string; description?: string; price?: number; images?: string[] };
type ImportIssue = { sourceRow: number; name: string; reason: string; ruleId?: string };
type NormalizedProduct = { sourceRow: number; name: string; article: string | null; barcode: string | null; supplier: string; supplierNormalizedName: string; category: string; description: string; price: number; images: string[]; image: string; externalKey: string };

const clean = (value: unknown, length: number) => normalizeCatalogText(value).slice(0, length);
const keyPart = (value: string) => value.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "");

function normalize(row: Row, fallbackRow: number): { product?: NormalizedProduct; issue?: ImportIssue } {
  const sourceRow = Number.isInteger(row.sourceRow) ? Number(row.sourceRow) : fallbackRow;
  const name = clean(row.name, 160);
  const article = clean(row.article, 160);
  const barcode = clean(row.barcode, 80);
  const description = clean(row.description, 500);
  const supplier = clean(getSupplierFromDescription(description, row.supplier), 160) || "Поставщик";
  const images = (Array.isArray(row.images) ? row.images : []).map((value) => clean(value, 1000)).filter((value, index, list) => /^https?:\/\//i.test(value) && list.indexOf(value) === index).slice(0, 12);
  if (!name) return { issue: { sourceRow, name: "", reason: "missing_name" } };
  if (!images.length) return { issue: { sourceRow, name, reason: "missing_image" } };
  const exclusionReason = getImportExclusionReason(name);
  if (exclusionReason) return { issue: { sourceRow, name, reason: exclusionReason, ruleId: "name_token:КРАФТ" } };
  const externalKey = article ? `article:${keyPart(article)}` : barcode ? `barcode:${keyPart(barcode)}` : `fallback:${keyPart(supplier)}:${keyPart(name)}`;
  return { product: { sourceRow, name, article: article || null, barcode: barcode || null, supplier, supplierNormalizedName: normalizeSupplierName(supplier), category: clean(row.category, 80) || "Другое", description: description || "Описание уточняется", price: Math.max(0, Math.round(Number(row.price) || 0)), images, image: images[0], externalKey } };
}

export async function POST(request: Request) {
  const user = await getAuthorizedAdmin();
  if (!user) return Response.json({ error: "Требуется вход администратора." }, { status: 401 });
  try {
    const payload = (await request.json()) as { products?: Row[]; sourceRows?: number };
    if (!Array.isArray(payload.products) || !payload.products.length) throw new Error("В файле нет товаров для импорта.");
    if (payload.products.length > 3000) throw new Error("За один раз можно импортировать до 3000 товаров.");
    const issues: ImportIssue[] = [];
    const unique = new Map<string, NormalizedProduct>();
    payload.products.forEach((source, index) => {
      const result = normalize(source, index + 2);
      if (result.issue) issues.push(result.issue);
      if (result.product) unique.set(result.product.externalKey, result.product);
    });
    if (!unique.size) throw new Error("Не найдено строк, подходящих для импорта.");

    await ensureCatalogSeeded();
    const db = await getD1();
    const supplierNames = new Map<string, string>();
    for (const product of unique.values()) supplierNames.set(product.supplierNormalizedName, product.supplier);
    const supplierStatements = [...supplierNames].map(([normalizedName, name]) => db.prepare(`INSERT INTO suppliers (id,name,normalized_name,catalog_enabled,created_at,updated_at) VALUES (?,?,?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(normalized_name) DO UPDATE SET name=excluded.name,updated_at=CURRENT_TIMESTAMP`).bind(crypto.randomUUID(), name, normalizedName));
    for (let index = 0; index < supplierStatements.length; index += 50) await db.batch(supplierStatements.slice(index, index + 50));
    const supplierResult = (await db.prepare("SELECT id, normalized_name FROM suppliers").all()) as { results?: Array<{ id: string; normalized_name: string }> };
    const supplierIds = new Map((supplierResult.results ?? []).map((row) => [row.normalized_name, row.id]));
    const current = (await db.prepare("SELECT external_key FROM catalog_products WHERE external_key IS NOT NULL").all()) as { results?: Array<{ external_key: string }> };
    const existing = new Set((current.results ?? []).map((row) => row.external_key));

    let created = 0, updated = 0;
    const statements = [...unique.values()].map((product) => {
      if (existing.has(product.externalKey)) updated += 1; else created += 1;
      const supplierId = supplierIds.get(product.supplierNormalizedName);
      if (!supplierId) throw new Error("Не удалось сопоставить поставщика.");
      return db.prepare(`INSERT INTO catalog_products (id,name,supplier,supplier_id,category,description,weight,price,image,images_json,external_key,article,barcode,available,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,'',?,?,?,?,?,?,1,COALESCE((SELECT MAX(sort_order)+1 FROM catalog_products),0),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(external_key) DO UPDATE SET name=excluded.name,supplier=excluded.supplier,supplier_id=excluded.supplier_id,category=excluded.category,description=excluded.description,price=excluded.price,image=excluded.image,images_json=excluded.images_json,article=excluded.article,barcode=excluded.barcode,updated_at=CURRENT_TIMESTAMP`).bind(crypto.randomUUID(), product.name, product.supplier, supplierId, product.category, product.description, product.price, product.image, JSON.stringify(product.images), product.externalKey, product.article, product.barcode);
    });
    for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50));

    const excluded = issues.filter((issue) => issue.reason === "excluded_by_import_rule");
    const invalid = issues.filter((issue) => issue.reason !== "excluded_by_import_rule");
    const reasonCounts = issues.reduce<Record<string, number>>((counts, issue) => { counts[issue.reason] = (counts[issue.reason] ?? 0) + 1; return counts; }, {});
    const importRunId = crypto.randomUUID();
    const sourceRows = Math.max(Number(payload.sourceRows) || payload.products.length, payload.products.length);
    const auditStatements = [
      db.prepare(`INSERT INTO catalog_import_runs (id,actor_email,source_rows,accepted_rows,created_count,updated_count,excluded_count,invalid_count,reason_counts_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(importRunId, user.email, sourceRows, unique.size, created, updated, excluded.length, invalid.length, JSON.stringify(reasonCounts)),
      ...issues.map((issue) => db.prepare(`INSERT INTO catalog_import_run_items (id,import_run_id,source_row,source_name,outcome,reason_code,rule_id) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), importRunId, issue.sourceRow, issue.name, issue.reason === "excluded_by_import_rule" ? "excluded" : "invalid", issue.reason, issue.ruleId ?? "")),
    ];
    for (let index = 0; index < auditStatements.length; index += 50) await db.batch(auditStatements.slice(index, index + 50));
    return Response.json({ importRunId, summary: { sourceRows, acceptedRows: unique.size, created, updated, excluded: excluded.length, invalid: invalid.length, reasons: reasonCounts }, created, updated, excluded, invalid, products: await listCatalogProducts() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось импортировать каталог." }, { status: 400 });
  }
}
