CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`before` text,
	`after` text,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_workspace` ON `audit_events` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `email_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_verifications_user` ON `email_verifications` (`user_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`original_name` text,
	`mime_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `files_workspace` ON `files` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`kind` text DEFAULT 'reminder' NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follow_ups_quote` ON `follow_ups` (`quote_id`);--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`base_currency` text NOT NULL,
	`quote_currency` text NOT NULL,
	`rate` text NOT NULL,
	`precision` integer NOT NULL,
	`rate_date` integer NOT NULL,
	`source` text DEFAULT 'frankfurter' NOT NULL,
	`reason` text,
	`actor_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fx_rates_unique` ON `fx_rates` (`base_currency`,`quote_currency`,`rate_date`);--> statement-breakpoint
CREATE INDEX `fx_rates_pair` ON `fx_rates` (`base_currency`,`quote_currency`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitations_workspace` ON `invitations` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`idempotency_key` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`scheduled_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`locked_until` integer,
	`last_error` text,
	`run_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_status_scheduled` ON `jobs` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_idempotency_unique` ON `jobs` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `password_resets_user` ON `password_resets` (`user_id`);--> statement-breakpoint
CREATE TABLE `public_links` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_version_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`quote_version_id`) REFERENCES `quote_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `public_links_version` ON `public_links` (`quote_version_id`);--> statement-breakpoint
CREATE TABLE `quote_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`version_id` text NOT NULL,
	`decision` text NOT NULL,
	`recipient_name` text,
	`recipient_email` text,
	`decided_at` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `quote_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quote_decisions_quote` ON `quote_decisions` (`quote_id`);--> statement-breakpoint
CREATE TABLE `quote_items` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_minor` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quote_items_quote` ON `quote_items` (`quote_id`);--> statement-breakpoint
CREATE TABLE `quote_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`pdf_file_id` text,
	`sent_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_versions_unique` ON `quote_versions` (`quote_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `quote_versions_quote` ON `quote_versions` (`quote_id`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`client_name` text NOT NULL,
	`client_company` text,
	`client_email` text,
	`client_phone` text,
	`service_description` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`currency` text NOT NULL,
	`expiry_date` integer,
	`discount_type` text,
	`discount_value` integer DEFAULT 0 NOT NULL,
	`tax_rate_bps` integer DEFAULT 0 NOT NULL,
	`subtotal_minor` integer DEFAULT 0 NOT NULL,
	`discount_minor` integer DEFAULT 0 NOT NULL,
	`tax_minor` integer DEFAULT 0 NOT NULL,
	`total_minor` integer DEFAULT 0 NOT NULL,
	`follow_up_mode` text DEFAULT 'reminder' NOT NULL,
	`follow_up_days` integer,
	`sent_at` integer,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `quotes_workspace` ON `quotes` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `refresh_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `refresh_sessions_user` ON `refresh_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`email_verified_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_members_unique` ON `workspace_members` (`workspace_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `workspace_members_workspace` ON `workspace_members` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_members_user` ON `workspace_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`business_name` text NOT NULL,
	`reply_to_email` text NOT NULL,
	`logo_url` text,
	`phone` text,
	`address` text,
	`website` text,
	`payment_instructions` text,
	`default_currency` text DEFAULT 'NGN' NOT NULL,
	`accent_color` text DEFAULT '#4F46E5' NOT NULL,
	`default_quote_expiry_days` integer DEFAULT 14 NOT NULL,
	`deleted_at` integer,
	`purge_at` integer,
	`created_at` integer NOT NULL
);
