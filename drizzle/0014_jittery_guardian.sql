ALTER TABLE `bookEmbeddings` ADD `analysisVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookEntities` ADD `analysisVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `retrievalPassages` ADD `analysisVersion` int DEFAULT 1 NOT NULL;