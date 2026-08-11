import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  bookPages,
  books,
  InsertBook,
  InsertBookPage,
  InsertNotebookEntry,
  InsertUser,
  notebookEntries,
  analyticsEvents,
  annotations,
  bookmarks,
  users,
} from "../drizzle/schema";
import {
  bookBrain,
  bookChunks,
  retrievalPassages,
  bookEmbeddings,
  bookEntities,
  readerMemory,
  readerSettings,
  InsertBookBrain,
  InsertBookEntity,
  InsertReaderMemory,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/** Store a compact interaction signal without selected book text, questions, or AI answers. */
export async function recordAnalyticsEvent(input: {
  userId: number;
  bookId?: number | null;
  event: string;
  pageNumber?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(analyticsEvents).values({
    userId: input.userId,
    bookId: input.bookId ?? null,
    event: input.event,
    pageNumber: input.pageNumber ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/**
 * mysql2 returns `[ResultSetHeader, fields]`, so the auto-increment id lives on
 * the first element. Older drizzle drivers surface the header directly, so both
 * shapes are handled.
 */
function readInsertId(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  const id = (header as { insertId?: number } | undefined)?.insertId;
  if (typeof id !== "number" || !Number.isFinite(id)) {
    throw new Error("Insert did not return a usable id");
  }
  return id;
}

/* -------------------------------------------------------------------------- */
/*                                   Books                                    */
/* -------------------------------------------------------------------------- */

export async function createBook(values: InsertBook) {
  const db = await requireDb();
  const result = await db.insert(books).values(values);
  return readInsertId(result);
}

export async function insertBookPages(rows: InsertBookPage[]) {
  if (rows.length === 0) return;
  const db = await requireDb();
  // Chunk to stay well under MySQL max packet size for very long books.
  const CHUNK = 40;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(bookPages).values(rows.slice(i, i + CHUNK));
  }
}

export async function listBooksForUser(userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(books)
    .where(eq(books.userId, userId))
    .orderBy(desc(books.updatedAt));
}

export async function getBookForUser(bookId: number, userId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function getBookPage(bookId: number, pageNumber: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(bookPages)
    .where(and(eq(bookPages.bookId, bookId), eq(bookPages.pageNumber, pageNumber)))
    .limit(1);
  return rows[0];
}

export async function updateBookProgress(bookId: number, userId: number, lastPage: number) {
  const db = await requireDb();
  await db
    .update(books)
    .set({ lastPage, lastOpenedAt: new Date() })
    .where(and(eq(books.id, bookId), eq(books.userId, userId)));
}

export async function updateBookMeta(
  bookId: number,
  userId: number,
  values: { title?: string; author?: string | null },
) {
  const db = await requireDb();
  await db
    .update(books)
    .set(values)
    .where(and(eq(books.id, bookId), eq(books.userId, userId)));
}

export async function deleteBookForUser(bookId: number, userId: number) {
  const db = await requireDb();
  const existing = await getBookForUser(bookId, userId);
  if (!existing) return false;
  await db.delete(bookPages).where(eq(bookPages.bookId, bookId));
  await db.delete(notebookEntries).where(
    and(eq(notebookEntries.bookId, bookId), eq(notebookEntries.userId, userId)),
  );
  await db.delete(books).where(and(eq(books.id, bookId), eq(books.userId, userId)));
  return true;
}

export async function searchBookText(bookId: number, term: string, limit = 20) {
  const db = await requireDb();
  return db
    .select({ pageNumber: bookPages.pageNumber, content: bookPages.content })
    .from(bookPages)
    .where(and(eq(bookPages.bookId, bookId), sql`${bookPages.content} LIKE ${"%" + term + "%"}`))
    .orderBy(asc(bookPages.pageNumber))
    .limit(limit);
}

/* -------------------------------------------------------------------------- */
/*                                  Notebook                                  */
/* -------------------------------------------------------------------------- */

export async function createNotebookEntry(values: InsertNotebookEntry) {
  const db = await requireDb();
  const result = await db.insert(notebookEntries).values(values);
  return readInsertId(result);
}

export async function listNotebookEntries(userId: number, bookId?: number) {
  const db = await requireDb();
  const where = bookId
    ? and(eq(notebookEntries.userId, userId), eq(notebookEntries.bookId, bookId))
    : eq(notebookEntries.userId, userId);
  return db
    .select({
      id: notebookEntries.id,
      bookId: notebookEntries.bookId,
      pageNumber: notebookEntries.pageNumber,
      mode: notebookEntries.mode,
      highlight: notebookEntries.highlight,
      question: notebookEntries.question,
      answer: notebookEntries.answer,
      createdAt: notebookEntries.createdAt,
      bookTitle: books.title,
      bookCoverUrl: books.coverUrl,
    })
    .from(notebookEntries)
    .leftJoin(books, eq(notebookEntries.bookId, books.id))
    .where(where)
    .orderBy(desc(notebookEntries.createdAt));
}

export async function deleteNotebookEntry(entryId: number, userId: number) {
  const db = await requireDb();
  await db
    .delete(notebookEntries)
    .where(and(eq(notebookEntries.id, entryId), eq(notebookEntries.userId, userId)));
}

export async function countNotebookEntries(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(notebookEntries)
    .where(eq(notebookEntries.userId, userId));
  return Number(rows[0]?.count ?? 0);
}

/* -------------------------------------------------------------------------- */
/*                               Book Brain                                   */
/* -------------------------------------------------------------------------- */

export async function createBookBrain(values: InsertBookBrain) {
  const db = await requireDb();
  const result = await db.insert(bookBrain).values(values);
  return readInsertId(result);
}

export async function getBookBrain(bookId: number) {
  const db = await requireDb();
  const rows = await db.select().from(bookBrain).where(eq(bookBrain.bookId, bookId)).limit(1);
  return rows[0] ?? null;
}

export async function updateBookBrain(
  bookId: number,
  values: Partial<Omit<InsertBookBrain, "bookId">>,
) {
  const db = await requireDb();
  await db.update(bookBrain).set(values).where(eq(bookBrain.bookId, bookId));
}

export async function upsertBookBrain(bookId: number, values: Partial<InsertBookBrain>) {
  const db = await requireDb();
  const existing = await getBookBrain(bookId);
  if (existing) {
    await db.update(bookBrain).set(values).where(eq(bookBrain.bookId, bookId));
  } else {
    await db.insert(bookBrain).values({ bookId, ...values });
  }
}

/* -------------------------------------------------------------------------- */
/*                              Book Entities                                 */
/* -------------------------------------------------------------------------- */

export async function insertBookEntities(rows: InsertBookEntity[]) {
  if (rows.length === 0) return;
  const db = await requireDb();
  const CHUNK = 30;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(bookEntities).values(rows.slice(i, i + CHUNK));
  }
}

export async function getBookEntities(bookId: number) {
  const db = await requireDb();
  return db.select().from(bookEntities).where(eq(bookEntities.bookId, bookId));
}

export async function deleteBookEntities(bookId: number) {
  const db = await requireDb();
  await db.delete(bookEntities).where(eq(bookEntities.bookId, bookId));
}

/* -------------------------------------------------------------------------- */
/*                              Reader Memory                                 */
/* -------------------------------------------------------------------------- */

export async function getReaderMemory(userId: number, bookId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(readerMemory)
    .where(and(eq(readerMemory.userId, userId), eq(readerMemory.bookId, bookId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertReaderMemory(
  userId: number,
  bookId: number,
  values: Partial<Omit<InsertReaderMemory, "userId" | "bookId">>,
) {
  const db = await requireDb();
  const existing = await getReaderMemory(userId, bookId);
  if (existing) {
    await db
      .update(readerMemory)
      .set(values)
      .where(and(eq(readerMemory.userId, userId), eq(readerMemory.bookId, bookId)));
  } else {
    await db.insert(readerMemory).values({ userId, bookId, ...values });
  }
}

/* -------------------------------------------------------------------------- */
/*                             Reader Settings                                */
/* -------------------------------------------------------------------------- */

export async function getReaderSettings(userId: number, bookId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(readerSettings)
    .where(and(eq(readerSettings.userId, userId), eq(readerSettings.bookId, bookId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertReaderSettings(
  userId: number,
  bookId: number,
  values: { spoilerMode: "safe" | "full" },
) {
  const db = await requireDb();
  const existing = await getReaderSettings(userId, bookId);
  if (existing) {
    await db
      .update(readerSettings)
      .set(values)
      .where(and(eq(readerSettings.userId, userId), eq(readerSettings.bookId, bookId)));
  } else {
    await db.insert(readerSettings).values({ userId, bookId, ...values });
  }
}

/* -------------------------------------------------------------------------- */
/*                        All pages for a book (brain)                        */
/* -------------------------------------------------------------------------- */

export async function getAllPagesForBook(bookId: number) {
  const db = await requireDb();
  return db
    .select({ pageNumber: bookPages.pageNumber, content: bookPages.content })
    .from(bookPages)
    .where(eq(bookPages.bookId, bookId))
    .orderBy(asc(bookPages.pageNumber));
}

/* -------------------------------------------------------------------------- */
/*                        Book Chunks (hierarchical pipeline)                 */
/* -------------------------------------------------------------------------- */

export async function deleteBookChunks(bookId: number) {
  const db = await requireDb();
  await db.delete(bookChunks).where(eq(bookChunks.bookId, bookId));
}

export async function insertBookChunk(values: {
  bookId: number;
  chapterNumber: number;
  chunkSequence: number;
  startPage: number;
  endPage: number;
  text: string;
  summary?: string | null;
  entities?: string[] | null;
  concepts?: string[] | null;
  keyPassages?: { text: string; reason: string }[] | null;
}) {
  const db = await requireDb();
  const result = await db.insert(bookChunks).values(values);
  const header = Array.isArray(result) ? result[0] : result;
  return (header as { insertId?: number }).insertId ?? 0;
}

export async function getBookChunks(bookId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(bookChunks)
    .where(eq(bookChunks.bookId, bookId))
    .orderBy(asc(bookChunks.chapterNumber), asc(bookChunks.chunkSequence));
}

export async function getBookChunksByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const db = await requireDb();
  return db.select().from(bookChunks).where(sql`${bookChunks.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
}

/* -------------------------------------------------------------------------- */
/*                        Book Embeddings (semantic retrieval)                */
/* -------------------------------------------------------------------------- */

export async function deleteBookEmbeddings(bookId: number) {
  const db = await requireDb();
  await db.delete(bookEmbeddings).where(eq(bookEmbeddings.bookId, bookId));
}

export async function insertBookEmbedding(values: {
  bookId: number;
  chunkId: number;
  embedding: number[];
  metadata?: {
    startPage: number;
    endPage: number;
    chapterNumber: number;
    chunkSequence: number;
    embeddingProvider?: string;
    embeddingModel?: string;
    embeddingDimensions?: number;
  } | null;
}) {
  const db = await requireDb();
  await db.insert(bookEmbeddings).values(values);
}

export async function getBookEmbeddings(bookId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(bookEmbeddings)
    .where(eq(bookEmbeddings.bookId, bookId));
}

// ─── Retrieval Passages ──────────────────────────────────────────────────────

export async function deleteRetrievalPassages(bookId: number): Promise<void> {
  const db = await requireDb();
  await db.delete(retrievalPassages).where(eq(retrievalPassages.bookId, bookId));
}

export async function insertRetrievalPassage(data: {
  bookId: number;
  startPage: number;
  endPage: number;
  text: string;
  embedding?: number[] | null;
}): Promise<void> {
  const db = await requireDb();
  await db.insert(retrievalPassages).values(data);
}

export async function getRetrievalPassages(bookId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(retrievalPassages)
    .where(eq(retrievalPassages.bookId, bookId))
    .orderBy(asc(retrievalPassages.startPage));
}

// ─── Reader annotations and bookmarks ───────────────────────────────────────

export async function listAnnotationsForPage(userId: number, bookId: number, pageNumber: number) {
  const db = await requireDb();
  return db.select().from(annotations).where(
    and(eq(annotations.userId, userId), eq(annotations.bookId, bookId), eq(annotations.pageNumber, pageNumber)),
  );
}

export async function createAnnotation(input: {
  userId: number;
  bookId: number;
  pageNumber: number;
  selectedText: string;
  color?: string;
  note?: string | null;
}) {
  const db = await requireDb();
  const result = await db.insert(annotations).values({
    userId: input.userId,
    bookId: input.bookId,
    pageNumber: input.pageNumber,
    selectedText: input.selectedText,
    color: input.color ?? "yellow",
    note: input.note ?? null,
  });
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { insertId?: number }).insertId ?? 0);
}

export async function deleteAnnotationForUser(annotationId: number, userId: number) {
  const db = await requireDb();
  await db.delete(annotations).where(and(eq(annotations.id, annotationId), eq(annotations.userId, userId)));
}

export async function listBookmarksForBook(userId: number, bookId: number) {
  const db = await requireDb();
  return db.select().from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.bookId, bookId)))
    .orderBy(desc(bookmarks.createdAt));
}

export async function createBookmark(userId: number, bookId: number, pageNumber: number, label?: string | null) {
  const db = await requireDb();
  await db.insert(bookmarks).values({ userId, bookId, pageNumber, label: label ?? null })
    .onDuplicateKeyUpdate({ set: { label: label ?? null } });
}

export async function deleteBookmarkForUser(bookmarkId: number, userId: number) {
  const db = await requireDb();
  await db.delete(bookmarks).where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));
}

/** Small owner dashboard aggregate based only on real captured interaction events. */
export async function getPrivateAnalyticsSummary() {
  const db = await requireDb();
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const events = await db.select().from(analyticsEvents).where(gte(analyticsEvents.createdAt, weekAgo));
  const daily = events.filter(event => event.createdAt >= dayAgo);
  const count = (event: string) => events.filter(item => item.event === event).length;
  const highlights = count("highlight_action");
  const evidenceTaps = count("evidence_tap");
  const saves = count("notebook_save");
  const actionNames = [
    "highlight_action", "simpler_after_explain", "evidence_tap", "lost_open", "notebook_save",
    "chapter_debrief_open", "chapter_debrief_dismiss", "book_question_open", "book_question_submit",
  ];
  return {
    windowDays: 7,
    activeReaders: new Set(daily.filter(event => event.event === "reading_open").map(event => event.userId)).size,
    weekReaders: new Set(events.filter(event => event.event === "reading_open").map(event => event.userId)).size,
    booksOpened: new Set(daily.filter(event => event.event === "reading_open").map(event => event.bookId).filter(Boolean)).size,
    readingSessions: count("reading_open"),
    actionCounts: Object.fromEntries(actionNames.map(event => [event, count(event)])),
    evidenceClickRate: highlights ? Math.round((evidenceTaps / highlights) * 100) : null,
    saveRate: highlights ? Math.round((saves / highlights) * 100) : null,
    qualityInstrumented: false,
    economicsInstrumented: false,
  };
}
