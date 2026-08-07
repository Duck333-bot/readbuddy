import {
  index,
  int,
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
    fileSize: int("fileSize").notNull().default(0),
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
    mode: mysqlEnum("mode", ["explain", "simplify", "translate", "define", "ask"])
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
