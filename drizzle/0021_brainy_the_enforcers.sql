ALTER TABLE `lessonSteps` MODIFY COLUMN `stepType` enum('explain','example','check','adapt','intro','visual','worked','mcq','note','flashcard','recap','continuation') NOT NULL;--> statement-breakpoint
ALTER TABLE `lessonSteps` ADD `metadata` json;--> statement-breakpoint
ALTER TABLE `lessons` ADD `lessonVersion` int DEFAULT 1 NOT NULL;