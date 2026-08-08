ALTER TABLE `bookChunks` ADD `status` enum('pending','processing','done','failed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookChunks` ADD `attemptCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookChunks` ADD `lastError` text;--> statement-breakpoint
ALTER TABLE `bookChunks` ADD `processedAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookChunks` ADD `analysisVersion` int DEFAULT 1 NOT NULL;