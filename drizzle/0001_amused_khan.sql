CREATE TABLE `catalog_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`supplier` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`weight` text NOT NULL,
	`price` integer NOT NULL,
	`image` text NOT NULL,
	`available` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
