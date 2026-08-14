CREATE TABLE `concepts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialId` int NOT NULL,
	`canonicalName` varchar(255) NOT NULL,
	`normalizedKey` varchar(255) NOT NULL,
	`aliases` json,
	`definition` text NOT NULL,
	`importance` int NOT NULL DEFAULT 1,
	`difficulty` enum('introductory','intermediate','advanced') DEFAULT 'intermediate',
	`prerequisites` json,
	`relatedConcepts` json,
	`examples` json,
	`evidence` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `concepts_id` PRIMARY KEY(`id`),
	CONSTRAINT `concepts_material_key_unique` UNIQUE(`materialId`,`normalizedKey`)
);
--> statement-breakpoint
CREATE TABLE `flashcards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`materialId` int NOT NULL,
	`conceptId` int,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`evidence` json NOT NULL,
	`difficulty` enum('easy','medium','hard') DEFAULT 'medium',
	`lastRating` enum('again','hard','good'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `flashcards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learnerConceptMastery` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`materialId` int NOT NULL,
	`conceptId` int NOT NULL,
	`normalizedConceptKey` varchar(255) NOT NULL,
	`masteryState` enum('new','learning','familiar','strong') NOT NULL DEFAULT 'new',
	`confidenceEvidence` int NOT NULL DEFAULT 0,
	`correctAnswers` int NOT NULL DEFAULT 0,
	`incorrectAnswers` int NOT NULL DEFAULT 0,
	`timesExplained` int NOT NULL DEFAULT 0,
	`simplifyRequests` int NOT NULL DEFAULT 0,
	`defineRequests` int NOT NULL DEFAULT 0,
	`lastSeenAt` timestamp,
	`lastPracticedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learnerConceptMastery_id` PRIMARY KEY(`id`),
	CONSTRAINT `learnerMastery_user_concept_unique` UNIQUE(`userId`,`conceptId`)
);
--> statement-breakpoint
CREATE TABLE `learnerSignals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`materialId` int NOT NULL,
	`conceptId` int,
	`signalType` enum('define','simplify','exposure','quiz_correct','quiz_incorrect','lesson_correct','lesson_incorrect') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learnerSignals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lessonSteps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lessonId` int NOT NULL,
	`conceptId` int,
	`position` int NOT NULL,
	`stepType` enum('explain','example','check','adapt') NOT NULL,
	`content` text NOT NULL,
	`checkPrompt` text,
	`expectedAnswer` text,
	`evidence` json,
	`learnerAnswer` text,
	`isCorrect` int,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lessonSteps_id` PRIMARY KEY(`id`),
	CONSTRAINT `lessonSteps_lesson_position_unique` UNIQUE(`lessonId`,`position`)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`materialId` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`status` enum('active','complete','abandoned') NOT NULL DEFAULT 'active',
	`currentStepIndex` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materialChunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialId` int NOT NULL,
	`chunkSequence` int NOT NULL,
	`startUnitIndex` int NOT NULL,
	`endUnitIndex` int NOT NULL,
	`text` text NOT NULL,
	`sourceRefs` json NOT NULL,
	`summary` text,
	`concepts` json,
	`status` enum('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
	`attemptCount` int NOT NULL DEFAULT 0,
	`lastError` text,
	`processedAt` timestamp,
	`analysisVersion` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `materialChunks_id` PRIMARY KEY(`id`),
	CONSTRAINT `materialChunks_material_sequence_unique` UNIQUE(`materialId`,`chunkSequence`,`analysisVersion`)
);
--> statement-breakpoint
CREATE TABLE `materialEmbeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialId` int NOT NULL,
	`chunkId` int NOT NULL,
	`embedding` json NOT NULL,
	`metadata` json,
	`analysisVersion` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `materialEmbeddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materialIntelligence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialId` int NOT NULL,
	`passCompleted` int NOT NULL DEFAULT 0,
	`analysisVersion` int NOT NULL DEFAULT 1,
	`pipelineVersion` int NOT NULL DEFAULT 0,
	`pipelineStage` enum('idle','chunks','synthesis','embeddings','complete','paused','failed') NOT NULL DEFAULT 'idle',
	`pipelineError` text,
	`pipelineRetryAfter` timestamp,
	`processingLeaseUntil` timestamp,
	`overview` text,
	`learningObjectives` json,
	`keyIdeas` json,
	`structuredSummary` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `materialIntelligence_id` PRIMARY KEY(`id`),
	CONSTRAINT `materialIntelligence_materialId_unique` UNIQUE(`materialId`)
);
--> statement-breakpoint
CREATE TABLE `materialNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`materialId` int NOT NULL,
	`noteType` enum('generated','personal') NOT NULL,
	`title` varchar(512) NOT NULL,
	`content` text NOT NULL,
	`evidence` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `materialNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materialRetrievalPassages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialId` int NOT NULL,
	`startSourceRef` json NOT NULL,
	`endSourceRef` json NOT NULL,
	`text` text NOT NULL,
	`embedding` json,
	`analysisVersion` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `materialRetrievalPassages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materialUnits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialId` int NOT NULL,
	`unitIndex` int NOT NULL,
	`unitType` enum('page','slide','section') NOT NULL,
	`title` varchar(512),
	`content` text NOT NULL,
	`headings` json,
	`sourceRef` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `materialUnits_id` PRIMARY KEY(`id`),
	CONSTRAINT `materialUnits_material_unit_unique` UNIQUE(`materialId`,`unitIndex`)
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`legacyBookId` int,
	`title` varchar(512) NOT NULL,
	`source` varchar(512),
	`materialType` enum('book','textbook','lecture_notes','slides','research_paper','school_material','business_report','document') NOT NULL DEFAULT 'document',
	`fileType` enum('pdf','docx','pptx','txt','markdown') NOT NULL,
	`mimeType` varchar(160) NOT NULL,
	`originalFilename` varchar(512) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(768) NOT NULL,
	`coverKey` varchar(512),
	`coverUrl` varchar(768),
	`unitCount` int NOT NULL DEFAULT 0,
	`fileSize` int NOT NULL DEFAULT 0,
	`processingState` enum('uploaded','ready','processing','complete','paused','failed') NOT NULL DEFAULT 'uploaded',
	`processingError` text,
	`processingRetryAfter` timestamp,
	`lastOpenedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `materials_id` PRIMARY KEY(`id`),
	CONSTRAINT `materials_legacyBookId_unique` UNIQUE(`legacyBookId`)
);
--> statement-breakpoint
CREATE TABLE `quizAnswers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`userId` int NOT NULL,
	`answer` text NOT NULL,
	`isCorrect` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizAnswers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quizId` int NOT NULL,
	`conceptId` int,
	`questionType` enum('multiple_choice','short_answer') NOT NULL,
	`prompt` text NOT NULL,
	`choices` json,
	`answer` text NOT NULL,
	`explanation` text NOT NULL,
	`evidence` json NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`position` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizQuestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studyQuizzes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`materialId` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`status` enum('draft','active','complete') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studyQuizzes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `concepts` ADD CONSTRAINT `concepts_materialId_materials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `flashcards` ADD CONSTRAINT `flashcards_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `flashcards` ADD CONSTRAINT `flashcards_materialId_materials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `flashcards` ADD CONSTRAINT `flashcards_conceptId_concepts_id_fk` FOREIGN KEY (`conceptId`) REFERENCES `concepts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learnerConceptMastery` ADD CONSTRAINT `learnerConceptMastery_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learnerConceptMastery` ADD CONSTRAINT `learnerConceptMastery_materialId_materials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learnerConceptMastery` ADD CONSTRAINT `learnerConceptMastery_conceptId_concepts_id_fk` FOREIGN KEY (`conceptId`) REFERENCES `concepts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learnerSignals` ADD CONSTRAINT `learnerSignals_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learnerSignals` ADD CONSTRAINT `learnerSignals_materialId_materials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learnerSignals` ADD CONSTRAINT `learnerSignals_conceptId_concepts_id_fk` FOREIGN KEY (`conceptId`) REFERENCES `concepts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessonSteps` ADD CONSTRAINT `lessonSteps_lessonId_lessons_id_fk` FOREIGN KEY (`lessonId`) REFERENCES `lessons`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessonSteps` ADD CONSTRAINT `lessonSteps_conceptId_concepts_id_fk` FOREIGN KEY (`conceptId`) REFERENCES `concepts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_materialId_materials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materialChunks` ADD CONSTRAINT `materialChunks_materialId_materials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materialEmbeddings` ADD CONSTRAINT `materialEmbeddings_materialId_materials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materialEmbeddings` ADD CONSTRAINT `materialEmbeddings_chunkId_materialChunks_id_fk` FOREIGN KEY (`chunkId`) REFERENCES `materialChunks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materialIntelligence` ADD CONSTRAINT `materialIntelligence_materialId_materials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materialNotes` ADD CONSTRAINT `materialNotes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materialNotes` ADD CONSTRAINT `materialNotes_materialId_materials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materialRetrievalPassages` ADD CONSTRAINT `materialRetrievalPassages_materialId_materials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materialUnits` ADD CONSTRAINT `materialUnits_materialId_materials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materials` ADD CONSTRAINT `materials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materials` ADD CONSTRAINT `materials_legacyBookId_books_id_fk` FOREIGN KEY (`legacyBookId`) REFERENCES `books`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizAnswers` ADD CONSTRAINT `quizAnswers_questionId_quizQuestions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `quizQuestions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizAnswers` ADD CONSTRAINT `quizAnswers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizQuestions` ADD CONSTRAINT `quizQuestions_quizId_studyQuizzes_id_fk` FOREIGN KEY (`quizId`) REFERENCES `studyQuizzes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizQuestions` ADD CONSTRAINT `quizQuestions_conceptId_concepts_id_fk` FOREIGN KEY (`conceptId`) REFERENCES `concepts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studyQuizzes` ADD CONSTRAINT `studyQuizzes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studyQuizzes` ADD CONSTRAINT `studyQuizzes_materialId_materials_id_fk` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `concepts_material_importance_idx` ON `concepts` (`materialId`,`importance`);--> statement-breakpoint
CREATE INDEX `flashcards_user_material_idx` ON `flashcards` (`userId`,`materialId`);--> statement-breakpoint
CREATE INDEX `learnerMastery_user_material_idx` ON `learnerConceptMastery` (`userId`,`materialId`);--> statement-breakpoint
CREATE INDEX `learnerMastery_user_state_idx` ON `learnerConceptMastery` (`userId`,`masteryState`);--> statement-breakpoint
CREATE INDEX `learnerSignals_user_material_idx` ON `learnerSignals` (`userId`,`materialId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `learnerSignals_concept_idx` ON `learnerSignals` (`conceptId`);--> statement-breakpoint
CREATE INDEX `lessonSteps_lesson_idx` ON `lessonSteps` (`lessonId`);--> statement-breakpoint
CREATE INDEX `lessons_user_material_idx` ON `lessons` (`userId`,`materialId`,`status`);--> statement-breakpoint
CREATE INDEX `materialChunks_material_status_idx` ON `materialChunks` (`materialId`,`status`);--> statement-breakpoint
CREATE INDEX `materialEmbeddings_material_idx` ON `materialEmbeddings` (`materialId`);--> statement-breakpoint
CREATE INDEX `materialIntelligence_material_idx` ON `materialIntelligence` (`materialId`);--> statement-breakpoint
CREATE INDEX `materialNotes_user_material_idx` ON `materialNotes` (`userId`,`materialId`,`noteType`);--> statement-breakpoint
CREATE INDEX `materialRetrievalPassages_material_idx` ON `materialRetrievalPassages` (`materialId`);--> statement-breakpoint
CREATE INDEX `materialUnits_material_type_idx` ON `materialUnits` (`materialId`,`unitType`);--> statement-breakpoint
CREATE INDEX `materials_user_updated_idx` ON `materials` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `materials_user_type_idx` ON `materials` (`userId`,`materialType`);--> statement-breakpoint
CREATE INDEX `quizAnswers_user_question_idx` ON `quizAnswers` (`userId`,`questionId`);--> statement-breakpoint
CREATE INDEX `quizQuestions_quiz_position_idx` ON `quizQuestions` (`quizId`,`position`);--> statement-breakpoint
CREATE INDEX `studyQuizzes_user_material_idx` ON `studyQuizzes` (`userId`,`materialId`);
--> statement-breakpoint
INSERT INTO `materials` (
  `userId`, `legacyBookId`, `title`, `source`, `materialType`, `fileType`, `mimeType`,
  `originalFilename`, `fileKey`, `fileUrl`, `coverKey`, `coverUrl`, `unitCount`,
  `fileSize`, `processingState`, `lastOpenedAt`, `createdAt`, `updatedAt`
)
SELECT
  `userId`, `id`, `title`, `author`, 'book', 'pdf', 'application/pdf',
  `title`, `fileKey`, `fileUrl`, `coverKey`, `coverUrl`, `pageCount`,
  `fileSize`, 'ready', `lastOpenedAt`, `createdAt`, `updatedAt`
FROM `books`;
