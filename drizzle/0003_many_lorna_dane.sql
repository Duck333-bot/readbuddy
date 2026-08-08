CREATE TABLE `bookBrain` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`passCompleted` int NOT NULL DEFAULT 0,
	`overallSummary` text,
	`themes` json,
	`timeline` json,
	`chapterSummaries` json,
	`keyPassages` json,
	`connections` json,
	`brainJobTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookBrain_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookBrain_bookId_unique` UNIQUE(`bookId`)
);
--> statement-breakpoint
CREATE TABLE `bookEntities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`type` enum('person','place','concept','term','other') NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`pages` json,
	`relationships` json,
	CONSTRAINT `bookEntities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `readerMemory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bookId` int NOT NULL,
	`knownVocab` json,
	`knownConcepts` json,
	`preferredLevel` enum('simple','standard','detailed') NOT NULL DEFAULT 'standard',
	`questionCount` int NOT NULL DEFAULT 0,
	`simplerCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `readerMemory_id` PRIMARY KEY(`id`),
	CONSTRAINT `readerMemory_user_book_idx` UNIQUE(`userId`,`bookId`)
);
--> statement-breakpoint
CREATE TABLE `readerSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bookId` int NOT NULL,
	`spoilerMode` enum('safe','full') NOT NULL DEFAULT 'safe',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `readerSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `readerSettings_user_book_idx` UNIQUE(`userId`,`bookId`)
);
--> statement-breakpoint
ALTER TABLE `bookBrain` ADD CONSTRAINT `bookBrain_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookEntities` ADD CONSTRAINT `bookEntities_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `readerMemory` ADD CONSTRAINT `readerMemory_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `readerMemory` ADD CONSTRAINT `readerMemory_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `readerSettings` ADD CONSTRAINT `readerSettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `readerSettings` ADD CONSTRAINT `readerSettings_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bookBrain_bookId_idx` ON `bookBrain` (`bookId`);--> statement-breakpoint
CREATE INDEX `entities_bookId_idx` ON `bookEntities` (`bookId`);--> statement-breakpoint
CREATE INDEX `entities_type_idx` ON `bookEntities` (`type`);--> statement-breakpoint
CREATE INDEX `readerMemory_userId_idx` ON `readerMemory` (`userId`);