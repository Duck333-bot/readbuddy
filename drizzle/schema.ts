import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * A book uploaded by a user. The PDF bytes and cover image live in S3; only
 * their storage keys/urls are persisted here.
 */
export const books = mysqlTable(
  "books",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 512 }).notNull(),
    author: varchar("author", { length: 255 }),
    fileKey: varchar("fileKey", { length: 512 }).notNull(),
    fileUrl: varchar("fileUrl", { length: 768 }).notNull(),
    coverKey: varchar("coverKey", { length: 512 }),
    coverUrl: varchar("coverUrl", { length: 768 }),
    pageCount: int("pageCount").notNull().default(0),
    lastPage: int("lastPage").notNull().default(1),
    /** First page with enough selectable text to open on. */
    firstReadablePage: int("firstReadablePage").notNull().default(1),
    fileSize: int("fileSize").notNull().default(0),
    /** Chapter entries from the PDF's own bookmark outline, when present. */
    pdfOutline: json("pdfOutline").$type<{ title: string; page: number; level: number }[]>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastOpenedAt: timestamp("lastOpenedAt"),
  },
  table => [index("books_userId_idx").on(table.userId)],
);

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;

/** Extracted plain text for a single page of a book. */
export const bookPages = mysqlTable(
  "bookPages",
  {
    id: int("id").autoincrement().primaryKey(),
    bookId: int("bookId")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    pageNumber: int("pageNumber").notNull(),
    content: text("content").notNull(),
  },
  table => [uniqueIndex("bookPages_book_page_idx").on(table.bookId, table.pageNumber)],
);

export type BookPage = typeof bookPages.$inferSelect;
export type InsertBookPage = typeof bookPages.$inferInsert;

/** A saved highlight plus the AI reading buddy's answer. */
export const notebookEntries = mysqlTable(
  "notebookEntries",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: int("bookId")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    pageNumber: int("pageNumber").notNull(),
    mode: mysqlEnum("mode", ["explain", "simplify", "context", "why", "translate", "define", "ask", "who", "word"])
      .default("explain")
      .notNull(),
    highlight: text("highlight").notNull(),
    question: text("question"),
    answer: text("answer").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("notebook_userId_idx").on(table.userId), index("notebook_bookId_idx").on(table.bookId)],
);

export type NotebookEntry = typeof notebookEntries.$inferSelect;
export type InsertNotebookEntry = typeof notebookEntries.$inferInsert;

/** A reader-owned highlight or note, kept separate from AI notebook entries. */
export const annotations = mysqlTable(
  "annotations",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookId: int("bookId").notNull().references(() => books.id, { onDelete: "cascade" }),
    pageNumber: int("pageNumber").notNull(),
    selectedText: text("selectedText").notNull(),
    /**
     * Character offsets into the normalized page text. Null for rows created
     * before offsets existed; those fall back to first-match rendering.
     */
    startOffset: int("startOffset"),
    endOffset: int("endOffset"),
    color: varchar("color", { length: 24 }).notNull().default("yellow"),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("annotations_user_book_page_idx").on(table.userId, table.bookId, table.pageNumber)],
);
export type Annotation = typeof annotations.$inferSelect;

/** A saved reading position. Bookmarks never contain private book text. */
export const bookmarks = mysqlTable(
  "bookmarks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookId: int("bookId").notNull().references(() => books.id, { onDelete: "cascade" }),
    pageNumber: int("pageNumber").notNull(),
    label: varchar("label", { length: 180 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("bookmarks_user_book_page_idx").on(table.userId, table.bookId, table.pageNumber),
    index("bookmarks_user_book_idx").on(table.userId, table.bookId),
  ],
);
export type Bookmark = typeof bookmarks.$inferSelect;

/**
 * Product analytics events. Payloads deliberately contain only interaction
 * metadata — never selected book text, AI answers, or the reader's questions.
 */
export const analyticsEvents = mysqlTable(
  "analyticsEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
    /** Random browser-local identifier for pre-auth funnel conversion only; never PII. */
    visitorId: varchar("visitorId", { length: 64 }),
    bookId: int("bookId").references(() => books.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 64 }).notNull(),
    pageNumber: int("pageNumber"),
    metadata: json("metadata").$type<Record<string, string | number | boolean | null>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("analyticsEvents_user_created_idx").on(table.userId, table.createdAt),
    index("analyticsEvents_visitor_created_idx").on(table.visitorId, table.createdAt),
    index("analyticsEvents_book_event_idx").on(table.bookId, table.event),
  ],
);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

/**
 * Book Brain: structured analysis of a book built by the 4-pass background
 * pipeline. One row per book. `status` tracks which passes have completed.
 *
 * Pass 1 — text extraction (done synchronously at upload)
 * Pass 2 — structure: chapter summaries, overall summary, themes, timeline
 * Pass 3 — entities: people, places, concepts, terminology, relationships
 * Pass 4 — deep reading: metaphors, foreshadowing, contradictions, connections
 */
export const bookBrain = mysqlTable(
  "bookBrain",
  {
    id: int("id").autoincrement().primaryKey(),
    bookId: int("bookId")
      .notNull()
      .unique()
      .references(() => books.id, { onDelete: "cascade" }),
    /** Which passes have completed. 0=none, 1=text, 2=structure, 3=entities, 4=deep */
    passCompleted: int("passCompleted").notNull().default(0),
    /** Overall book summary (pass 2) */
    overallSummary: text("overallSummary"),
    /** Main themes as a JSON array of strings (pass 2) */
    themes: json("themes").$type<string[]>(),
    /** Timeline as a JSON array of {event, page} objects (pass 2) */
    timeline: json("timeline").$type<{ event: string; page: number }[]>(),
    /** Chapter summaries as a JSON array of {chapter, title, summary, startPage} (pass 2) */
    chapterSummaries: json("chapterSummaries").$type<
      {
        chapter: number;
        title: string;
        summary: string;
        startPage: number;
        endPage?: number;
        authorDefined?: boolean;
      }[]
    >(),
    /** Where the chapter structure came from: outline | detected | synthetic. */
    structureSource: mysqlEnum("structureSource", ["outline", "detected", "synthetic"]),
    /** 0–100 confidence in the structure. Below 50, no confident chapter claims. */
    structureConfidence: int("structureConfidence").notNull().default(0),
    /** Analysis pipeline version that produced this brain. */
    analysisVersion: int("analysisVersion").notNull().default(1),
    /** Version currently being prepared beside the active analysis. */
    pipelineVersion: int("pipelineVersion").notNull().default(0),
    /** Bounded stage for resumable Book Brain work. The active analysis remains unchanged until complete. */
    pipelineStage: mysqlEnum("pipelineStage", ["idle", "chunks", "synthesis", "embeddings", "complete", "failed"])
      .notNull()
      .default("idle"),
    /** Book-level lease that prevents overlapping scheduled runs from erasing each other's staged data. */
    processingLeaseUntil: timestamp("processingLeaseUntil"),
    /** Honest detected/outline structure retained while staged chunks are processed over several runs. */
    stagedStructure: json("stagedStructure").$type<{
      source: "outline" | "detected" | "synthetic";
      confidence: number;
      sections: { index: number; title: string; startPage: number; endPage: number; authorDefined: boolean }[];
      chapterSummaries?: {
        chapter: number;
        title: string;
        summary: string;
        startPage: number;
        endPage: number;
        authorDefined: boolean;
      }[];
      synthesis?: {
        overallSummary: string;
        themes: string[];
        timeline: { event: string; page: number }[];
      };
    }>(),
    /** Important/difficult passages as JSON (pass 4) */
    keyPassages: json("keyPassages").$type<
      { page: number; text: string; reason: string }[]
    >(),
    /** Cross-chapter connections as JSON (pass 4) */
    connections: json("connections").$type<
      { fromPage: number; toPage: number; description: string }[]
    >(),
    /** Heartbeat task UID for the background pipeline job */
    brainJobTaskUid: varchar("brainJobTaskUid", { length: 65 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("bookBrain_bookId_idx").on(table.bookId)],
);
export type BookBrain = typeof bookBrain.$inferSelect;
export type InsertBookBrain = typeof bookBrain.$inferInsert;

/**
 * Chunks of a book for hierarchical processing.
 * Each chunk is typically 5–10 pages. Chunks are analyzed independently,
 * then synthesized at chapter and whole-book levels.
 */
export const bookChunks = mysqlTable(
  "bookChunks",
  {
    id: int("id").autoincrement().primaryKey(),
    bookId: int("bookId")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    /** Chapter number (1-indexed). 0 if chapter detection failed. */
    chapterNumber: int("chapterNumber").notNull(),
    /** Chunk sequence within the chapter (0-indexed). */
    chunkSequence: int("chunkSequence").notNull(),
    /** Starting page number of this chunk. */
    startPage: int("startPage").notNull(),
    /** Ending page number of this chunk (inclusive). */
    endPage: int("endPage").notNull(),
    /** Concatenated text of all pages in this chunk. */
    text: text("text").notNull(),
    /** Chunk-level summary (generated during pass 2). */
    summary: text("summary"),
    /** Chunk-level entities as JSON array. */
    entities: json("entities").$type<string[]>(),
    /** Per-chunk entity/page evidence retained until global entity aggregation completes. */
    entityEvidence: json("entityEvidence").$type<
      { name: string; type: string; pages: number[]; relationships: { name: string; relation: string; page: number }[] }[]
    >(),
    /** Chunk-level concepts as JSON array. */
    concepts: json("concepts").$type<string[]>(),
    /** Important passages in this chunk as JSON array. */
    keyPassages: json("keyPassages").$type<{ text: string; reason: string }[]>(),
    /** Processing status: pending | processing | done | failed */
    status: mysqlEnum("status", ["pending", "processing", "done", "failed"]).default("pending").notNull(),
    /** Number of processing attempts (for retry logic). */
    attemptCount: int("attemptCount").default(0).notNull(),
    /** Last error message if status = failed. */
    lastError: text("lastError"),
    /** Timestamp when this chunk was successfully processed. */
    processedAt: timestamp("processedAt"),
    /** Version of the analysis pipeline that processed this chunk. */
    analysisVersion: int("analysisVersion").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("bookChunks_bookId_idx").on(table.bookId)],
);
export type BookChunk = typeof bookChunks.$inferSelect;
export type InsertBookChunk = typeof bookChunks.$inferInsert;

/**
 * Embeddings for semantic retrieval.
 * Each chunk gets an embedding vector for similarity search.
 */
/**
 * Fine-grained retrieval passages: ~800-token windows covering 100% of the book.
 * Each passage gets its own embedding for precise semantic retrieval.
 * These are separate from analysis chunks (which are larger, for understanding).
 */
export const retrievalPassages = mysqlTable(
  "retrievalPassages",
  {
    id: int("id").autoincrement().primaryKey(),
    bookId: int("bookId")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    /** Starting page number of this passage. */
    startPage: int("startPage").notNull(),
    /** Ending page number of this passage (inclusive). */
    endPage: int("endPage").notNull(),
    /** The actual text of this passage (800-1000 tokens). */
    text: text("text").notNull(),
    /** Embedding vector as a JSON array of floats. */
    embedding: json("embedding").$type<number[]>(),
    /** Book Brain analysis version that created this derived passage. */
    analysisVersion: int("analysisVersion").notNull().default(1),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("retrievalPassages_bookId_idx").on(table.bookId),
    index("retrievalPassages_pages_idx").on(table.startPage, table.endPage),
  ],
);
export type RetrievalPassage = typeof retrievalPassages.$inferSelect;
export type InsertRetrievalPassage = typeof retrievalPassages.$inferInsert;

export const bookEmbeddings = mysqlTable(
  "bookEmbeddings",
  {
    id: int("id").autoincrement().primaryKey(),
    bookId: int("bookId")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    chunkId: int("chunkId")
      .notNull()
      .references(() => bookChunks.id, { onDelete: "cascade" }),
    /** Embedding vector as a JSON array of floats. */
    embedding: json("embedding").$type<number[]>().notNull(),
    /** Metadata: page range, chapter, etc. */
    metadata: json("metadata").$type<{
      startPage: number;
      endPage: number;
      chapterNumber: number;
      chunkSequence: number;
    }>(),
    /** Book Brain analysis version that created this vector. */
    analysisVersion: int("analysisVersion").notNull().default(1),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("bookEmbeddings_bookId_idx").on(table.bookId)],
);
export type BookEmbedding = typeof bookEmbeddings.$inferSelect;
export type InsertBookEmbedding = typeof bookEmbeddings.$inferInsert;

/**
 * Entities extracted from a book (pass 3): people, places, concepts, terms.
 * One row per entity. The AI uses these for "Remind me who this person is" etc.
 */
export const bookEntities = mysqlTable(
  "bookEntities",
  {
    id: int("id").autoincrement().primaryKey(),
    bookId: int("bookId")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", ["person", "place", "concept", "term", "other"]).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    /** Pages where this entity appears, JSON array of ints */
    pages: json("pages").$type<number[]>(),
    /** Relationships to other entities, JSON array of {name, relation, page} */
    relationships: json("relationships").$type<{ name: string; relation: string; page?: number }[]>(),
    /** Book Brain analysis version that produced this entity evidence. */
    analysisVersion: int("analysisVersion").notNull().default(1),
  },
  table => [
    index("entities_bookId_idx").on(table.bookId),
    index("entities_type_idx").on(table.type),
  ],
);
export type BookEntity = typeof bookEntities.$inferSelect;
export type InsertBookEntity = typeof bookEntities.$inferInsert;

/**
 * Reader memory: per-user per-book model of what the reader understands.
 * One row per (user, book). Updated whenever the user asks a question.
 */
export const readerMemory = mysqlTable(
  "readerMemory",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: int("bookId")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    /**
     * Vocabulary the reader has already asked about.
     * JSON: { word: string; definition: string; pageFirstAsked: number }[]
     */
    knownVocab: json("knownVocab").$type<
      { word: string; definition: string; pageFirstAsked: number }[]
    >(),
    /**
     * Concepts the reader has asked about.
     * JSON: { concept: string; explanation: string; pageFirstAsked: number }[]
     */
    knownConcepts: json("knownConcepts").$type<
      { concept: string; explanation: string; pageFirstAsked: number }[]
    >(),
    /**
     * Preferred explanation level inferred from interactions.
     * "simple" | "standard" | "detailed"
     */
    preferredLevel: mysqlEnum("preferredLevel", ["simple", "standard", "detailed"])
      .notNull()
      .default("standard"),
    /** Total questions asked (used to infer explanation level preference) */
    questionCount: int("questionCount").notNull().default(0),
    /** How many times the reader clicked "Even simpler" */
    simplerCount: int("simplerCount").notNull().default(0),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("readerMemory_user_book_idx").on(table.userId, table.bookId),
    index("readerMemory_userId_idx").on(table.userId),
  ],
);
export type ReaderMemory = typeof readerMemory.$inferSelect;
export type InsertReaderMemory = typeof readerMemory.$inferInsert;

/**
 * Spoiler mode setting per user per book.
 * "safe"  = only use information up to the reader's current page (default)
 * "full"  = AI has full-book context
 */
export const readerSettings = mysqlTable(
  "readerSettings",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: int("bookId")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    spoilerMode: mysqlEnum("spoilerMode", ["safe", "full"]).notNull().default("safe"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("readerSettings_user_book_idx").on(table.userId, table.bookId),
  ],
);
export type ReaderSettings = typeof readerSettings.$inferSelect;
export type InsertReaderSettings = typeof readerSettings.$inferInsert;
