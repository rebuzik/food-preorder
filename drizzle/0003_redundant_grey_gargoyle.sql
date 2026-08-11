ALTER TABLE `catalog_products` ADD `images_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_products` ADD `external_key` text;--> statement-breakpoint
ALTER TABLE `catalog_products` ADD `article` text;--> statement-breakpoint
ALTER TABLE `catalog_products` ADD `barcode` text;--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_products_external_key_unique` ON `catalog_products` (`external_key`);--> statement-breakpoint
ALTER TABLE `preorders` ADD `wish` text DEFAULT '' NOT NULL;