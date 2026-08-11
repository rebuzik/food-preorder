import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const preorders = sqliteTable("preorders", {
  id: text("id").primaryKey(),
  publicId: text("public_id").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  wish: text("wish").notNull().default(""),
  total: integer("total").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const preorderItems = sqliteTable("preorder_items", {
  id: text("id").primaryKey(),
  preorderId: text("preorder_id")
    .notNull()
    .references(() => preorders.id),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  supplier: text("supplier").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
});

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    externalKey: text("external_key").unique(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull().unique(),
    catalogEnabled: integer("catalog_enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("suppliers_catalog_enabled_idx").on(table.catalogEnabled)],
);

export const catalogProducts = sqliteTable("catalog_products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  supplier: text("supplier").notNull(),
  supplierId: text("supplier_id").references(() => suppliers.id),
  category: text("category").notNull(),
  description: text("description").notNull(),
  weight: text("weight").notNull(),
  price: integer("price").notNull(),
  image: text("image").notNull(),
  imagesJson: text("images_json").notNull().default("[]"),
  externalKey: text("external_key").unique(),
  article: text("article"),
  barcode: text("barcode"),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("catalog_products_supplier_visibility_idx").on(table.supplierId, table.available, table.sortOrder)]);

export const catalogSettings = sqliteTable("catalog_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const adminAuditEvents = sqliteTable("admin_audit_events", {
  id: text("id").primaryKey(),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  beforeJson: text("before_json").notNull().default("{}"),
  afterJson: text("after_json").notNull().default("{}"),
  reason: text("reason").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const catalogImportRuns = sqliteTable("catalog_import_runs", {
  id: text("id").primaryKey(),
  actorEmail: text("actor_email").notNull(),
  sourceRows: integer("source_rows").notNull(),
  acceptedRows: integer("accepted_rows").notNull(),
  createdCount: integer("created_count").notNull(),
  updatedCount: integer("updated_count").notNull(),
  excludedCount: integer("excluded_count").notNull(),
  invalidCount: integer("invalid_count").notNull(),
  reasonCountsJson: text("reason_counts_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const catalogImportRunItems = sqliteTable("catalog_import_run_items", {
  id: text("id").primaryKey(),
  importRunId: text("import_run_id").notNull().references(() => catalogImportRuns.id),
  sourceRow: integer("source_row").notNull(),
  sourceName: text("source_name").notNull(),
  outcome: text("outcome").notNull(),
  reasonCode: text("reason_code").notNull(),
  ruleId: text("rule_id").notNull().default(""),
});
