CREATE TABLE `billingAccounts` (
	`userId` int NOT NULL,
	`customerId` varchar(255),
	`subscriptionId` varchar(255),
	`status` varchar(40) NOT NULL DEFAULT 'none',
	`priceId` varchar(255),
	`paidUntil` timestamp,
	`cancelAtPeriodEnd` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingAccounts_userId` PRIMARY KEY(`userId`),
	CONSTRAINT `billingAccounts_customerId_unique` UNIQUE(`customerId`),
	CONSTRAINT `billingAccounts_subscriptionId_unique` UNIQUE(`subscriptionId`)
);
--> statement-breakpoint
CREATE TABLE `monthlyUsage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`period` varchar(7) NOT NULL,
	`uploads` int NOT NULL DEFAULT 0,
	`aiCalls` int NOT NULL DEFAULT 0,
	`sourceCharacters` int NOT NULL DEFAULT 0,
	CONSTRAINT `monthlyUsage_id` PRIMARY KEY(`id`),
	CONSTRAINT `monthly_usage_user_period` UNIQUE(`userId`,`period`)
);
--> statement-breakpoint
ALTER TABLE `billingAccounts` ADD CONSTRAINT `billingAccounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monthlyUsage` ADD CONSTRAINT `monthlyUsage_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;