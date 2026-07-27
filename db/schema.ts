import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const preorders = sqliteTable("preorders", {
  id: text("id").primaryKey(),
  publicId: text("public_id").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
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

export const catalogProducts = sqliteTable("catalog_products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  supplier: text("supplier").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  weight: text("weight").notNull(),
  price: integer("price").notNull(),
  image: text("image").notNull(),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const catalogSettings = sqliteTable("catalog_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
