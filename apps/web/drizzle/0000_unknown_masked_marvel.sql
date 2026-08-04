CREATE TABLE `draft_heads` (
	`draft_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`course_id` text NOT NULL,
	`language_id` text NOT NULL,
	`title` text NOT NULL,
	`current_revision` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `draft_versions` (
	`draft_id` text NOT NULL,
	`revision` integer NOT NULL,
	`owner_id` text NOT NULL,
	`payload` text NOT NULL,
	`summary` text DEFAULT 'Manual save' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`draft_id`, `revision`)
);
