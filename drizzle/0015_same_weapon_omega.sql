ALTER TABLE `bookBrain` ADD `pipelineVersion` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookBrain` ADD `pipelineStage` enum('idle','chunks','synthesis','embeddings','complete','failed') DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookBrain` ADD `processingLeaseUntil` timestamp;--> statement-breakpoint
ALTER TABLE `bookBrain` ADD `stagedStructure` json;--> statement-breakpoint
ALTER TABLE `bookChunks` ADD `entityEvidence` json;