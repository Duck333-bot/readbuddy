CREATE TABLE `bookPages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`pageNumber` int NOT NULL,
	`content` text NOT NULL,
	CONSTRAINT `bookPages_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookPages_book_page_idx` UNIQUE(`bookId`,`pageNumber`)
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`author` varchar(255),
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(768) NOT NULL,
	`coverKey` varchar(512),
	`coverUrl` varchar(768),
	`pageCount` int NOT NULL DEFAULT 0,
	`lastPage` int NOT NULL DEFAULT 1,
	`fileSize` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastOpenedAt` timestamp,
	CONSTRAINT `books_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notebookEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bookId` int NOT NULL,
	`pageNumber` int NOT NULL,
	`mode` enum('explain','simplify','translate','define','ask') NOT NULL DEFAULT 'explain',
	`highlight` text NOT NULL,
	`question` text,
	`answer` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notebookEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `books_userId_idx` ON `books` (`userId`);--> statement-breakpoint
CREATE INDEX `notebook_userId_idx` ON `notebookEntries` (`userId`);--> statement-breakpoint
CREATE INDEX `notebook_bookId_idx` ON `notebookEntries` (`bookId`);