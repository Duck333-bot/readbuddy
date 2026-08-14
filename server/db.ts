import { and, asc, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
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
  authIdentities,
  bookmarks,
  emailLoginTokens,
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
  InsertMaterial,
  InsertMaterialUnit,
  materialIntelligence,
  materials,
  materialUnits,
  Material,
  materialChunks,
  concepts,
  InsertMaterialChunk,
  InsertConcept,
  InsertMaterialIntelligence,
  materialEmbeddings,
  materialRetrievalPassages,
  InsertMaterialEmbedding,
  InsertMaterialRetrievalPassage,
  learnerConceptMastery,
  learnerSignals,
  materialNotes,
  InsertMaterialNote,
  flashcards,
  studyQuizzes,
  quizQuestions,
  quizAnswers,
  InsertFlashcard,
  lessons,
  lessonSteps,
} from "../drizzle/schema";
import type { NormalizedMaterialUnit } from "@shared/materials";
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
  userId?: number | null;
  visitorId?: string | null;
  bookId?: number | null;
  event: string;
  pageNumber?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(analyticsEvents).values({
    userId: input.userId ?? null,
    visitorId: input.visitorId ?? null,
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

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function getUserByProvider(provider: string, providerAccountId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ user: users }).from(authIdentities)
    .innerJoin(users, eq(authIdentities.userId, users.id))
    .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerAccountId, providerAccountId))).limit(1);
  return result[0]?.user;
}

export async function linkIdentity(userId: number, provider: string, providerAccountId: string, email: string) {
  const db = await requireDb();
  await db.insert(authIdentities).values({ userId, provider, providerAccountId, email }).onDuplicateKeyUpdate({ set: { email } });
}

export async function createEmailLoginToken(tokenHash: string, email: string, expiresAt: Date) {
  const db = await requireDb();
  await db.insert(emailLoginTokens).values({ tokenHash, email: email.toLowerCase(), expiresAt });
}

export async function consumeEmailLoginToken(tokenHash: string) {
  const db = await requireDb();
  const rows = await db.select().from(emailLoginTokens).where(and(eq(emailLoginTokens.tokenHash, tokenHash), isNull(emailLoginTokens.usedAt), gte(emailLoginTokens.expiresAt, new Date()))).limit(1);
  const token = rows[0];
  if (!token) return undefined;
  await db.update(emailLoginTokens).set({ usedAt: new Date() }).where(eq(emailLoginTokens.id, token.id));
  return token;
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

/** Background pipelines run without a user context, so look up by id alone. */
export async function getBookById(bookId: number) {
  const db = await requireDb();
  const rows = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
  return rows[0] ?? null;
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

/** Acquire a short database-backed lease so two scheduled runs cannot stage one book concurrently. */
export async function acquireBookBrainLease(bookId: number, durationMs = 110_000): Promise<boolean> {
  const db = await requireDb();
  const now = new Date();
  const result = await db
    .update(bookBrain)
    .set({ processingLeaseUntil: new Date(now.getTime() + durationMs) })
    .where(
      and(
        eq(bookBrain.bookId, bookId),
        or(isNull(bookBrain.processingLeaseUntil), lt(bookBrain.processingLeaseUntil, now)),
      ),
    );
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number }).affectedRows ?? 0) > 0;
}

export async function releaseBookBrainLease(bookId: number) {
  const db = await requireDb();
  await db.update(bookBrain).set({ processingLeaseUntil: null }).where(eq(bookBrain.bookId, bookId));
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

export async function getBookEntities(bookId: number, analysisVersion?: number) {
  const db = await requireDb();
  return db.select().from(bookEntities).where(
    analysisVersion === undefined
      ? eq(bookEntities.bookId, bookId)
      : and(eq(bookEntities.bookId, bookId), eq(bookEntities.analysisVersion, analysisVersion)),
  );
}

/** Pass 3 adds descriptions only; page evidence from pass 2 must survive. */
export async function updateBookEntityDescription(entityId: number, description: string) {
  const db = await requireDb();
  await db.update(bookEntities).set({ description }).where(eq(bookEntities.id, entityId));
}

export async function deleteBookEntities(bookId: number, analysisVersion?: number) {
  const db = await requireDb();
  await db.delete(bookEntities).where(
    analysisVersion === undefined
      ? eq(bookEntities.bookId, bookId)
      : and(eq(bookEntities.bookId, bookId), eq(bookEntities.analysisVersion, analysisVersion)),
  );
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

export async function deleteBookChunks(bookId: number, analysisVersion?: number) {
  const db = await requireDb();
  await db.delete(bookChunks).where(
    analysisVersion === undefined
      ? eq(bookChunks.bookId, bookId)
      : and(eq(bookChunks.bookId, bookId), eq(bookChunks.analysisVersion, analysisVersion)),
  );
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
  entityEvidence?: { name: string; type: string; pages: number[]; relationships: { name: string; relation: string; page: number }[] }[] | null;
  concepts?: string[] | null;
  keyPassages?: { text: string; reason: string }[] | null;
  analysisVersion?: number;
}) {
  const db = await requireDb();
  const result = await db.insert(bookChunks).values(values);
  const header = Array.isArray(result) ? result[0] : result;
  return (header as { insertId?: number }).insertId ?? 0;
}

export async function insertBookChunks(values: Parameters<typeof insertBookChunk>[0][]) {
  if (values.length === 0) return;
  const db = await requireDb();
  const CHUNK = 25;
  for (let i = 0; i < values.length; i += CHUNK) {
    await db.insert(bookChunks).values(values.slice(i, i + CHUNK));
  }
}

export async function getProcessableBookChunks(bookId: number, analysisVersion: number, limit: number) {
  const db = await requireDb();
  return db
    .select()
    .from(bookChunks)
    .where(
      and(
        eq(bookChunks.bookId, bookId),
        eq(bookChunks.analysisVersion, analysisVersion),
        or(eq(bookChunks.status, "pending"), and(eq(bookChunks.status, "failed"), sql`${bookChunks.attemptCount} < 3`)),
      ),
    )
    .orderBy(asc(bookChunks.chapterNumber), asc(bookChunks.chunkSequence))
    .limit(limit);
}

/** A new lease can reclaim chunks left mid-call only after the former lease has expired. */
export async function resetInterruptedBookChunks(bookId: number, analysisVersion: number) {
  const db = await requireDb();
  await db
    .update(bookChunks)
    .set({ status: "pending", lastError: "Interrupted background run; safely retrying." })
    .where(
      and(
        eq(bookChunks.bookId, bookId),
        eq(bookChunks.analysisVersion, analysisVersion),
        eq(bookChunks.status, "processing"),
      ),
    );
}

export async function updateBookChunkAnalysis(
  chunkId: number,
  values: {
    summary?: string | null;
    entities?: string[] | null;
    entityEvidence?: { name: string; type: string; pages: number[]; relationships: { name: string; relation: string; page: number }[] }[] | null;
    concepts?: string[] | null;
    keyPassages?: { text: string; reason: string }[] | null;
    status: "pending" | "processing" | "done" | "failed";
    lastError?: string | null;
    incrementAttempts?: boolean;
  },
) {
  const db = await requireDb();
  await db
    .update(bookChunks)
    .set({
      summary: values.summary,
      entities: values.entities,
      entityEvidence: values.entityEvidence,
      concepts: values.concepts,
      keyPassages: values.keyPassages,
      status: values.status,
      lastError: values.lastError ?? null,
      processedAt: values.status === "done" ? new Date() : null,
      ...(values.incrementAttempts ? { attemptCount: sql`${bookChunks.attemptCount} + 1` } : {}),
    })
    .where(eq(bookChunks.id, chunkId));
}

export async function getBookChunks(bookId: number, analysisVersion?: number) {
  const db = await requireDb();
  return db
    .select()
    .from(bookChunks)
    .where(
      analysisVersion === undefined
        ? eq(bookChunks.bookId, bookId)
        : and(eq(bookChunks.bookId, bookId), eq(bookChunks.analysisVersion, analysisVersion)),
    )
    .orderBy(asc(bookChunks.chapterNumber), asc(bookChunks.chunkSequence));
}

export async function getBookEmbeddingsForVersion(bookId: number, analysisVersion: number) {
  const db = await requireDb();
  return db
    .select({ chunkId: bookEmbeddings.chunkId })
    .from(bookEmbeddings)
    .where(and(eq(bookEmbeddings.bookId, bookId), eq(bookEmbeddings.analysisVersion, analysisVersion)));
}

export async function getUnembeddedRetrievalPassages(bookId: number, analysisVersion: number, limit: number) {
  const db = await requireDb();
  return db
    .select()
    .from(retrievalPassages)
    .where(
      and(
        eq(retrievalPassages.bookId, bookId),
        eq(retrievalPassages.analysisVersion, analysisVersion),
        isNull(retrievalPassages.embedding),
      ),
    )
    .orderBy(asc(retrievalPassages.startPage))
    .limit(limit);
}

export async function updateRetrievalPassageEmbedding(passageId: number, embedding: number[]) {
  const db = await requireDb();
  await db.update(retrievalPassages).set({ embedding }).where(eq(retrievalPassages.id, passageId));
}

export async function getBookChunksByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const db = await requireDb();
  return db.select().from(bookChunks).where(sql`${bookChunks.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
}

/* -------------------------------------------------------------------------- */
/*                        Book Embeddings (semantic retrieval)                */
/* -------------------------------------------------------------------------- */

export async function deleteBookEmbeddings(bookId: number, analysisVersion?: number) {
  const db = await requireDb();
  await db.delete(bookEmbeddings).where(
    analysisVersion === undefined
      ? eq(bookEmbeddings.bookId, bookId)
      : and(eq(bookEmbeddings.bookId, bookId), eq(bookEmbeddings.analysisVersion, analysisVersion)),
  );
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
  analysisVersion?: number;
}) {
  const db = await requireDb();
  await db.insert(bookEmbeddings).values(values);
}

export async function getBookEmbeddings(bookId: number, analysisVersion?: number) {
  const db = await requireDb();
  return db
    .select()
    .from(bookEmbeddings)
    .where(
      analysisVersion === undefined
        ? eq(bookEmbeddings.bookId, bookId)
        : and(eq(bookEmbeddings.bookId, bookId), eq(bookEmbeddings.analysisVersion, analysisVersion)),
    );
}

// ─── Retrieval Passages ──────────────────────────────────────────────────────

export async function deleteRetrievalPassages(bookId: number, analysisVersion?: number): Promise<void> {
  const db = await requireDb();
  await db.delete(retrievalPassages).where(
    analysisVersion === undefined
      ? eq(retrievalPassages.bookId, bookId)
      : and(eq(retrievalPassages.bookId, bookId), eq(retrievalPassages.analysisVersion, analysisVersion)),
  );
}

export async function insertRetrievalPassage(data: {
  bookId: number;
  startPage: number;
  endPage: number;
  text: string;
  embedding?: number[] | null;
  analysisVersion?: number;
}): Promise<void> {
  const db = await requireDb();
  await db.insert(retrievalPassages).values(data);
}

export async function insertRetrievalPassages(
  rows: {
    bookId: number;
    startPage: number;
    endPage: number;
    text: string;
    embedding?: number[] | null;
    analysisVersion?: number;
  }[],
): Promise<void> {
  if (rows.length === 0) return;
  const db = await requireDb();
  const CHUNK = 25;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(retrievalPassages).values(rows.slice(i, i + CHUNK));
  }
}

export async function getRetrievalPassages(bookId: number, analysisVersion?: number) {
  const db = await requireDb();
  return db
    .select()
    .from(retrievalPassages)
    .where(
      analysisVersion === undefined
        ? eq(retrievalPassages.bookId, bookId)
        : and(eq(retrievalPassages.bookId, bookId), eq(retrievalPassages.analysisVersion, analysisVersion)),
    )
    .orderBy(asc(retrievalPassages.startPage));
}

// ─── Reader annotations and bookmarks ───────────────────────────────────────

export async function listAnnotationsForPage(userId: number, bookId: number, pageNumber: number) {
  const db = await requireDb();
  return db.select().from(annotations).where(
    and(eq(annotations.userId, userId), eq(annotations.bookId, bookId), eq(annotations.pageNumber, pageNumber)),
  );
}

/** Highlights and personal notes belong to the reader, not to a single page view. */
export async function listAnnotationsForUser(userId: number) {
  const db = await requireDb();
  return db
    .select({
      id: annotations.id,
      bookId: annotations.bookId,
      bookTitle: books.title,
      pageNumber: annotations.pageNumber,
      selectedText: annotations.selectedText,
      color: annotations.color,
      note: annotations.note,
      createdAt: annotations.createdAt,
    })
    .from(annotations)
    .leftJoin(books, eq(annotations.bookId, books.id))
    .where(eq(annotations.userId, userId))
    .orderBy(desc(annotations.createdAt));
}

export async function createAnnotation(input: {
  userId: number;
  bookId: number;
  pageNumber: number;
  selectedText: string;
  startOffset?: number;
  endOffset?: number;
  color?: string;
  note?: string | null;
}) {
  const db = await requireDb();
  const result = await db.insert(annotations).values({
    userId: input.userId,
    bookId: input.bookId,
    pageNumber: input.pageNumber,
    selectedText: input.selectedText,
    startOffset: input.startOffset ?? null,
    endOffset: input.endOffset ?? null,
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

/** Privacy-minimal analytics event shape used by the owner dashboard aggregation. */
export type AnalyticsEventRow = {
  userId: number | null;
  bookId: number | null;
  visitorId: string | null;
  event: string;
  createdAt: Date;
  metadata: unknown;
};

/** Pure aggregation so the alpha decision metrics can be verified without a database. */
export function summarizeAlphaEvents(events: AnalyticsEventRow[], now = Date.now()) {
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const daily = events.filter(event => event.createdAt >= dayAgo);
  const count = (event: string) => events.filter(item => item.event === event).length;
  const highlights = count("highlight_action");
  const evidenceTaps = count("evidence_tap");
  const saves = count("notebook_save");
  const answers = count("ai_answer_received");
  const negativeAnswers = count("answer_negative");
  const positiveAnswers = count("answer_positive");
  const meaningfulSessions = count("meaningful_reading_session");
  const operationEvents = events.filter(event => event.event.startsWith("operation:"));
  const failedOperations = operationEvents.filter(event => event.metadata && (event.metadata as Record<string, unknown>).success === false).length;
  const metaOf = (event: typeof events[number]) => (event.metadata ?? {}) as Record<string, unknown>;
  const numberOf = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const percentile = (values: number[], fraction: number) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
    return Math.round(sorted[index]);
  };
  const buddyOperations = operationEvents.filter(event => event.event === "operation:llm_reading_buddy");
  const buddyLatencies = buddyOperations.map(event => numberOf(metaOf(event).durationMs)).filter((value): value is number => value !== null);
  const brainOperations = operationEvents.filter(event => event.event === "operation:book_brain_pipeline");
  const brainDurations = brainOperations.map(event => numberOf(metaOf(event).durationMs)).filter((value): value is number => value !== null);
  const totalCostUsd = operationEvents.reduce((sum, event) => sum + (numberOf(metaOf(event).estimatedCostUsd) ?? 0), 0);
  const interactionCostEvents = buddyOperations.filter(event => numberOf(metaOf(event).estimatedCostUsd) !== null);
  const interactionCostUsd = interactionCostEvents.reduce((sum, event) => sum + (numberOf(metaOf(event).estimatedCostUsd) ?? 0), 0);
  const brainCostByBook = new Map<number, number>();
  for (const event of operationEvents) {
    if (!event.bookId) continue;
    const cost = numberOf(metaOf(event).estimatedCostUsd);
    if (cost === null) continue;
    brainCostByBook.set(event.bookId, (brainCostByBook.get(event.bookId) ?? 0) + cost);
  }
  const costPerReaderUsers = new Set(operationEvents.map(event => event.userId).filter(Boolean));
  const round6 = (value: number | null) => (value === null ? null : Number(value.toFixed(6)));
  const economics = {
    aiAnswerMedianMs: percentile(buddyLatencies, 0.5),
    aiAnswerP95Ms: percentile(buddyLatencies, 0.95),
    aiAnswerCount: buddyOperations.length,
    bookBrainMedianMs: percentile(brainDurations, 0.5),
    bookBrainCompletions: brainOperations.length,
    operationCount: operationEvents.length,
    failureRatePercent: operationEvents.length ? Math.round((failedOperations / operationEvents.length) * 100) : null,
    totalEstimatedCostUsd: round6(totalCostUsd),
    costPerAiInteractionUsd: interactionCostEvents.length ? round6(interactionCostUsd / interactionCostEvents.length) : null,
    costPerBookUsd: brainCostByBook.size ? round6(Array.from(brainCostByBook.values()).reduce((sum, value) => sum + value, 0) / brainCostByBook.size) : null,
    costPerReaderUsd: costPerReaderUsers.size ? round6(totalCostUsd / costPerReaderUsers.size) : null,
  };
  const tffumMs: number[] = [];
  const eventUsers = new Map<number, typeof events>();
  for (const event of events) {
    if (!event.userId) continue;
    const bucket = eventUsers.get(event.userId) ?? [];
    bucket.push(event);
    eventUsers.set(event.userId, bucket);
  }
  for (const userEvents of Array.from(eventUsers.values())) {
    const firstPdf = userEvents.find(event => event.event === "pdf_selected");
    const firstAnswer = userEvents.find(event => event.event === "ai_answer_received" && firstPdf && event.createdAt >= firstPdf.createdAt);
    if (firstPdf && firstAnswer) tffumMs.push(firstAnswer.createdAt.getTime() - firstPdf.createdAt.getTime());
  }
  const returnedBookKeys = new Set(events.filter(event => event.event === "return_to_book" && event.userId && event.bookId).map(event => `${event.userId}:${event.bookId}`));
  const actionNames = [
    "highlight_action", "simpler_after_explain", "evidence_tap", "lost_open", "notebook_save",
    "chapter_debrief_open", "chapter_debrief_dismiss", "book_question_open", "book_question_submit",
  ];
  const funnelOrder = [
    "landing_view", "landing_start_clicked", "auth_completed", "library_reached", "upload_opened",
    "pdf_selected", "upload_started", "ready_to_read", "start_reading_clicked", "reader_opened",
    "meaningful_reading_session", "highlight_action", "ai_answer_received", "evidence_tap",
    "reading_continued", "return_to_book",
  ];
  const identityFor = (event: typeof events[number]) => event.visitorId ?? (event.userId ? `user:${event.userId}` : null);
  const landingIdentities = new Set(events.filter(event => event.event === "landing_view").map(identityFor).filter(Boolean));
  const funnel = funnelOrder.map(event => {
    const identities = new Set(events.filter(item => item.event === event).map(identityFor).filter(Boolean));
    const completed = identities.size;
    return {
      event,
      entered: landingIdentities.size,
      completed,
      conversionPercent: landingIdentities.size ? Math.round((completed / landingIdentities.size) * 100) : null,
    };
  });
  return {
    windowDays: 7,
    activeReaders: new Set(daily.filter(event => event.event === "reading_open").map(event => event.userId)).size,
    weekReaders: new Set(events.filter(event => event.event === "reading_open").map(event => event.userId)).size,
    booksOpened: new Set(daily.filter(event => event.event === "reading_open").map(event => event.bookId).filter(Boolean)).size,
    readingSessions: count("reading_open"),
    actionCounts: Object.fromEntries(actionNames.map(event => [event, count(event)])),
    evidenceClickRate: highlights ? Math.round((evidenceTaps / highlights) * 100) : null,
    saveRate: highlights ? Math.round((saves / highlights) * 100) : null,
    alpha: {
      acquisitionReachedBook: new Set(events.filter(event => event.event === "ready_to_read").map(identityFor).filter(Boolean)).size,
      activationUsedAi: new Set(events.filter(event => event.event === "ai_answer_received").map(event => event.userId).filter(Boolean)).size,
      magicActions: { evidenceTaps, who: count("operation:llm_reading_buddy"), context: count("book_question_submit") },
      engagementMeaningfulSessions: meaningfulSessions,
      retentionSameBookReturns: returnedBookKeys.size,
      trust: { answers, negativeAnswers, positiveAnswers, negativeRatePercent: answers ? Math.round((negativeAnswers / answers) * 100) : null },
      timeToFirstUsefulMomentMs: tffumMs.length ? Math.round(tffumMs.reduce((sum, value) => sum + value, 0) / tffumMs.length) : null,
      operationFailures: failedOperations,
    },
    qualityInstrumented: true,
    economicsInstrumented: true,
    economics,
    funnel,
  };
}

/** Small owner dashboard aggregate based only on real captured interaction events. */
export async function getPrivateAnalyticsSummary() {
  const db = await requireDb();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const events = await db.select().from(analyticsEvents).where(gte(analyticsEvents.createdAt, weekAgo));
  return summarizeAlphaEvents(events as unknown as AnalyticsEventRow[], now);
}

/* -------------------------------------------------------------------------- */
/*                              ZhiyaAI Materials                              */
/* -------------------------------------------------------------------------- */

export async function createMaterial(values: InsertMaterial) {
  const db = await requireDb();
  const result = await db.insert(materials).values(values);
  return readInsertId(result);
}

export async function getMaterialForUser(materialId: number, userId: number): Promise<Material | undefined> {
  const db = await requireDb();
  const rows = await db.select().from(materials).where(and(eq(materials.id, materialId), eq(materials.userId, userId))).limit(1);
  return rows[0];
}

export async function getMaterialForLegacyBook(bookId: number, userId: number): Promise<Material | undefined> {
  const db = await requireDb();
  const rows = await db.select().from(materials).where(and(eq(materials.legacyBookId, bookId), eq(materials.userId, userId))).limit(1);
  return rows[0];
}

export async function listMaterialsForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(materials).where(eq(materials.userId, userId)).orderBy(desc(materials.updatedAt));
}

export async function insertMaterialUnits(materialId: number, units: NormalizedMaterialUnit[]) {
  if (units.length === 0) return;
  const db = await requireDb();
  const rows: InsertMaterialUnit[] = units.map(unit => ({
    materialId,
    unitIndex: unit.index,
    unitType: unit.type,
    title: unit.title ?? null,
    content: unit.text,
    headings: unit.headings,
    sourceRef: unit.sourceRef,
  }));
  const CHUNK_SIZE = 40;
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    await db.insert(materialUnits).values(rows.slice(start, start + CHUNK_SIZE));
  }
}

export async function getMaterialUnits(materialId: number) {
  const db = await requireDb();
  return db.select().from(materialUnits).where(eq(materialUnits.materialId, materialId)).orderBy(asc(materialUnits.unitIndex));
}

export async function createMaterialIntelligence(materialId: number) {
  const db = await requireDb();
  await db.insert(materialIntelligence).values({ materialId }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
}

export async function getMaterialById(materialId: number) {
  const db = await requireDb();
  const rows = await db.select().from(materials).where(eq(materials.id, materialId)).limit(1);
  return rows[0];
}

export async function getMaterialIntelligence(materialId: number) {
  const db = await requireDb();
  const rows = await db.select().from(materialIntelligence).where(eq(materialIntelligence.materialId, materialId)).limit(1);
  return rows[0];
}

export async function updateMaterialIntelligence(materialId: number, values: Partial<InsertMaterialIntelligence>) {
  const db = await requireDb();
  await db.update(materialIntelligence).set({ ...values, updatedAt: new Date() }).where(eq(materialIntelligence.materialId, materialId));
}

export async function replaceMaterialChunks(materialId: number, rows: InsertMaterialChunk[]) {
  const db = await requireDb();
  await db.delete(materialChunks).where(eq(materialChunks.materialId, materialId));
  if (rows.length === 0) return;
  const CHUNK_SIZE = 30;
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    await db.insert(materialChunks).values(rows.slice(start, start + CHUNK_SIZE));
  }
}

export async function getMaterialChunks(materialId: number) {
  const db = await requireDb();
  return db.select().from(materialChunks).where(eq(materialChunks.materialId, materialId)).orderBy(asc(materialChunks.chunkSequence));
}

export async function replaceMaterialConcepts(materialId: number, rows: InsertConcept[]) {
  const db = await requireDb();
  await db.delete(concepts).where(eq(concepts.materialId, materialId));
  if (rows.length) await db.insert(concepts).values(rows);
}

export async function replaceMaterialRetrievalPassages(materialId: number, rows: InsertMaterialRetrievalPassage[]) {
  const db = await requireDb();
  await db.delete(materialRetrievalPassages).where(eq(materialRetrievalPassages.materialId, materialId));
  if (rows.length) await db.insert(materialRetrievalPassages).values(rows);
}

export async function replaceMaterialEmbeddings(materialId: number, rows: InsertMaterialEmbedding[]) {
  const db = await requireDb();
  await db.delete(materialEmbeddings).where(eq(materialEmbeddings.materialId, materialId));
  if (rows.length) await db.insert(materialEmbeddings).values(rows);
}

export async function getConceptsForMaterial(materialId: number) {
  const db = await requireDb();
  return db.select().from(concepts).where(eq(concepts.materialId, materialId)).orderBy(desc(concepts.importance));
}

export async function getLearnerMastery(userId: number, materialId: number) {
  const db = await requireDb();
  return db.select().from(learnerConceptMastery).where(and(eq(learnerConceptMastery.userId, userId), eq(learnerConceptMastery.materialId, materialId))).orderBy(asc(learnerConceptMastery.masteryState));
}

export async function getLearnerMasteryForConcept(userId: number, conceptId: number) {
  const db = await requireDb();
  const rows = await db.select().from(learnerConceptMastery).where(and(eq(learnerConceptMastery.userId, userId), eq(learnerConceptMastery.conceptId, conceptId))).limit(1);
  return rows[0];
}

export async function upsertLearnerMastery(values: typeof learnerConceptMastery.$inferInsert) {
  const db = await requireDb();
  await db.insert(learnerConceptMastery).values(values).onDuplicateKeyUpdate({
    set: {
      masteryState: values.masteryState,
      confidenceEvidence: values.confidenceEvidence,
      correctAnswers: values.correctAnswers,
      incorrectAnswers: values.incorrectAnswers,
      timesExplained: values.timesExplained,
      simplifyRequests: values.simplifyRequests,
      defineRequests: values.defineRequests,
      lastSeenAt: values.lastSeenAt,
      lastPracticedAt: values.lastPracticedAt,
      updatedAt: new Date(),
    },
  });
}

export async function recordLearnerSignal(values: typeof learnerSignals.$inferInsert) {
  const db = await requireDb();
  await db.insert(learnerSignals).values(values);
}

export async function listMaterialNotes(userId: number, materialId: number) {
  const db = await requireDb();
  return db.select().from(materialNotes).where(and(eq(materialNotes.userId, userId), eq(materialNotes.materialId, materialId))).orderBy(desc(materialNotes.updatedAt));
}

export async function createMaterialNote(values: InsertMaterialNote) {
  const db = await requireDb();
  const result = await db.insert(materialNotes).values(values);
  return readInsertId(result);
}

export async function updateMaterialNote(noteId: number, userId: number, materialId: number, values: Pick<InsertMaterialNote, "title" | "content">) {
  const db = await requireDb();
  await db.update(materialNotes).set({ ...values, updatedAt: new Date() }).where(and(eq(materialNotes.id, noteId), eq(materialNotes.userId, userId), eq(materialNotes.materialId, materialId)));
}

export async function listFlashcards(userId: number, materialId: number) {
  const db = await requireDb();
  return db.select().from(flashcards).where(and(eq(flashcards.userId, userId), eq(flashcards.materialId, materialId))).orderBy(desc(flashcards.updatedAt));
}

export async function insertFlashcards(rows: InsertFlashcard[]) {
  if (!rows.length) return;
  const db = await requireDb();
  await db.insert(flashcards).values(rows);
}

export async function updateFlashcardRating(flashcardId: number, userId: number, materialId: number, lastRating: "again" | "hard" | "good") {
  const db = await requireDb();
  await db.update(flashcards).set({ lastRating, updatedAt: new Date() }).where(and(eq(flashcards.id, flashcardId), eq(flashcards.userId, userId), eq(flashcards.materialId, materialId)));
}

export async function createStudyQuiz(values: typeof studyQuizzes.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(studyQuizzes).values(values);
  return readInsertId(result);
}

export async function getLatestStudyQuiz(userId: number, materialId: number) {
  const db = await requireDb();
  const rows = await db.select().from(studyQuizzes).where(and(eq(studyQuizzes.userId, userId), eq(studyQuizzes.materialId, materialId))).orderBy(desc(studyQuizzes.createdAt)).limit(1);
  return rows[0];
}

export async function getQuizQuestions(quizId: number) {
  const db = await requireDb();
  return db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId)).orderBy(asc(quizQuestions.position));
}

export async function insertQuizQuestions(rows: (typeof quizQuestions.$inferInsert)[]) {
  if (!rows.length) return;
  const db = await requireDb();
  await db.insert(quizQuestions).values(rows);
}

export async function getQuizQuestionForUser(questionId: number, userId: number) {
  const db = await requireDb();
  const rows = await db.select({ question: quizQuestions, quiz: studyQuizzes }).from(quizQuestions).innerJoin(studyQuizzes, eq(quizQuestions.quizId, studyQuizzes.id)).where(and(eq(quizQuestions.id, questionId), eq(studyQuizzes.userId, userId))).limit(1);
  return rows[0];
}

export async function recordQuizAnswer(values: typeof quizAnswers.$inferInsert) {
  const db = await requireDb();
  await db.insert(quizAnswers).values(values);
}

export async function getActiveLesson(userId: number, materialId: number) {
  const db = await requireDb();
  const lesson = (await db.select().from(lessons).where(and(eq(lessons.userId, userId), eq(lessons.materialId, materialId), eq(lessons.status, "active"))).orderBy(desc(lessons.updatedAt)).limit(1))[0];
  if (!lesson) return undefined;
  const steps = await db.select().from(lessonSteps).where(eq(lessonSteps.lessonId, lesson.id)).orderBy(asc(lessonSteps.position));
  return { lesson, steps };
}

/** Retire a legacy active lesson when a newer lesson contract replaces it. */
export async function abandonLesson(lessonId: number, userId: number) {
  const db = await requireDb();
  await db.update(lessons).set({ status: "abandoned", updatedAt: new Date() }).where(and(eq(lessons.id, lessonId), eq(lessons.userId, userId), eq(lessons.status, "active")));
}

export async function createLesson(values: typeof lessons.$inferInsert, steps: Omit<typeof lessonSteps.$inferInsert, "lessonId">[]) {
  const db = await requireDb();
  const result = await db.insert(lessons).values(values);
  const lessonId = readInsertId(result);
  if (steps.length) await db.insert(lessonSteps).values(steps.map(step => ({ ...step, lessonId })));
  return lessonId;
}

export async function getLessonStepForUser(stepId: number, userId: number) {
  const db = await requireDb();
  const rows = await db.select({ step: lessonSteps, lesson: lessons }).from(lessonSteps).innerJoin(lessons, eq(lessonSteps.lessonId, lessons.id)).where(and(eq(lessonSteps.id, stepId), eq(lessons.userId, userId))).limit(1);
  return rows[0];
}

export async function completeLessonStep(stepId: number, userId: number, values: { learnerAnswer?: string | null; isCorrect?: number | null }) {
  const db = await requireDb();
  const owned = await getLessonStepForUser(stepId, userId);
  if (!owned) return undefined;
  await db.update(lessonSteps).set({ ...values, completedAt: new Date() }).where(eq(lessonSteps.id, stepId));
  await db.update(lessons).set({ currentStepIndex: owned.step.position, updatedAt: new Date() }).where(eq(lessons.id, owned.lesson.id));
  return owned;
}

export async function completeLesson(lessonId: number, userId: number) {
  const db = await requireDb();
  await db.update(lessons).set({ status: "complete", updatedAt: new Date() }).where(and(eq(lessons.id, lessonId), eq(lessons.userId, userId)));
}

export async function updateMaterialProcessing(materialId: number, values: Partial<Pick<Material, "processingState" | "processingError" | "processingRetryAfter" | "unitCount" | "lastOpenedAt">>) {
  const db = await requireDb();
  await db.update(materials).set({ ...values, updatedAt: new Date() }).where(eq(materials.id, materialId));
}
