CREATE TABLE `analyticsEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bookId` int,
	`event` varchar(64) NOT NULL,
	`pageNumber` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analyticsEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `analyticsEvents` ADD CONSTRAINT `analyticsEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `analyticsEvents` ADD CONSTRAINT `analyticsEvents_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `analyticsEvents_user_created_idx` ON `analyticsEvents` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `analyticsEvents_book_event_idx` ON `analyticsEvents` (`bookId`,`event`);