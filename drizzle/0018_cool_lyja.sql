CREATE TABLE `authIdentities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(32) NOT NULL,
	`providerAccountId` varchar(255) NOT NULL,
	`email` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authIdentities_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_identity_provider_account_unique` UNIQUE(`provider`,`providerAccountId`)
);
--> statement-breakpoint
CREATE TABLE `emailLoginTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`email` varchar(320) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emailLoginTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_login_token_hash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `authIdentities` ADD CONSTRAINT `authIdentities_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auth_identity_user_idx` ON `authIdentities` (`userId`);--> statement-breakpoint
CREATE INDEX `email_login_email_idx` ON `emailLoginTokens` (`email`);