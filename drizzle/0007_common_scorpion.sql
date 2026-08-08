CREATE TABLE `retrievalPassages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`startPage` int NOT NULL,
	`endPage` int NOT NULL,
	`text` text NOT NULL,
	`embedding` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `retrievalPassages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `retrievalPassages` ADD CONSTRAINT `retrievalPassages_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `retrievalPassages_bookId_idx` ON `retrievalPassages` (`bookId`);--> statement-breakpoint
CREATE INDEX `retrievalPassages_pages_idx` ON `retrievalPassages` (`startPage`,`endPage`);