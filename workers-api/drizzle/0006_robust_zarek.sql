CREATE TABLE `user_exam_access` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`exam_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_exam_access` ON `user_exam_access` (`user_id`,`exam_id`);--> statement-breakpoint
CREATE INDEX `idx_user_exam_access_user_id` ON `user_exam_access` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_exam_access_exam_id` ON `user_exam_access` (`exam_id`);--> statement-breakpoint
ALTER TABLE `exams` ADD `is_public` integer DEFAULT true NOT NULL;