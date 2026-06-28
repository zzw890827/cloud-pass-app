CREATE TABLE `exam_domains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exam_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`weight` integer NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_exam_domains_exam_code` ON `exam_domains` (`exam_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_exam_domains_exam_id` ON `exam_domains` (`exam_id`);--> statement-breakpoint
ALTER TABLE `questions` ADD `domain_id` integer REFERENCES exam_domains(id);--> statement-breakpoint
CREATE INDEX `idx_questions_domain_id` ON `questions` (`domain_id`);