ALTER TABLE `annotations` ADD `startOffset` int;--> statement-breakpoint
ALTER TABLE `annotations` ADD `endOffset` int;--> statement-breakpoint
ALTER TABLE `bookBrain` ADD `structureSource` enum('outline','detected','synthetic');--> statement-breakpoint
ALTER TABLE `bookBrain` ADD `structureConfidence` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookBrain` ADD `analysisVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `firstReadablePage` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `pdfOutline` json;