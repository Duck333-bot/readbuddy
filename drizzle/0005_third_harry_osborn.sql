CREATE TABLE `bookChunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`chapterNumber` int NOT NULL,
	`chunkSequence` int NOT NULL,
	`startPage` int NOT NULL,
	`endPage` int NOT NULL,
	`text` text NOT NULL,
	`summary` text,
	`entities` json,
	`concepts` json,
	`keyPassages` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookChunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookEmbeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`chunkId` int NOT NULL,
	`embedding` json NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookEmbeddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bookChunks` ADD CONSTRAINT `bookChunks_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookEmbeddings` ADD CONSTRAINT `bookEmbeddings_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookEmbeddings` ADD CONSTRAINT `bookEmbeddings_chunkId_bookChunks_id_fk` FOREIGN KEY (`chunkId`) REFERENCES `bookChunks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bookChunks_bookId_idx` ON `bookChunks` (`bookId`);--> statement-breakpoint
CREATE INDEX `bookEmbeddings_bookId_idx` ON `bookEmbeddings` (`bookId`);