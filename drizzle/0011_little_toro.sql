ALTER TABLE `analyticsEvents` MODIFY COLUMN `userId` int;--> statement-breakpoint
ALTER TABLE `analyticsEvents` ADD `visitorId` varchar(64);--> statement-breakpoint
CREATE INDEX `analyticsEvents_visitor_created_idx` ON `analyticsEvents` (`visitorId`,`createdAt`);