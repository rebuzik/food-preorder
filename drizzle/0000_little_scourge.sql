CREATE TABLE `preorder_items` (
	`id` text PRIMARY KEY NOT NULL,
	`preorder_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`supplier` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	FOREIGN KEY (`preorder_id`) REFERENCES `preorders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `preorders` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `preorders_public_id_unique` ON `preorders` (`public_id`);