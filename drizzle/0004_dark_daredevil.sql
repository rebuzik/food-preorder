CREATE TABLE `admin_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before_json` text DEFAULT '{}' NOT NULL,
	`after_json` text DEFAULT '{}' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_import_run_items` (
	`id` text PRIMARY KEY NOT NULL,
	`import_run_id` text NOT NULL,
	`source_row` integer NOT NULL,
	`source_name` text NOT NULL,
	`outcome` text NOT NULL,
	`reason_code` text NOT NULL,
	`rule_id` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`import_run_id`) REFERENCES `catalog_import_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `catalog_import_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`source_rows` integer NOT NULL,
	`accepted_rows` integer NOT NULL,
	`created_count` integer NOT NULL,
	`updated_count` integer NOT NULL,
	`excluded_count` integer NOT NULL,
	`invalid_count` integer NOT NULL,
	`reason_counts_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`external_key` text,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`catalog_enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_external_key_unique` ON `suppliers` (`external_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_normalized_name_unique` ON `suppliers` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `suppliers_catalog_enabled_idx` ON `suppliers` (`catalog_enabled`);--> statement-breakpoint
ALTER TABLE `catalog_products` ADD `supplier_id` text REFERENCES suppliers(id);--> statement-breakpoint
CREATE INDEX `catalog_products_supplier_visibility_idx` ON `catalog_products` (`supplier_id`,`available`,`sort_order`);