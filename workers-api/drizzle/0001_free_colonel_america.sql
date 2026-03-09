ALTER TABLE `exam_sessions` ADD `paused_at` text;--> statement-breakpoint
ALTER TABLE `exam_sessions` ADD `elapsed_seconds` integer DEFAULT 0 NOT NULL;