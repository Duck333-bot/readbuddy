import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * These specs exercise the ownership rules in the books/notebook routers with
 * the database layer stubbed, so they run without a live connection.
 */

const mocks = vi.hoisted(() => ({
  getBookForUser: vi.fn(),
  listBooksForUser: vi.fn(),
  getBookPage: vi.fn(),
  updateBookProgress: vi.fn(),
  deleteBookForUser: vi.fn(),
  createNotebookEntry: vi.fn(),
  listNotebookEntries: vi.fn(),
  deleteNotebookEntry: vi.fn(),
  countNotebookEntries: vi.fn(),
  updateBookMeta: vi.fn(),
  createBook: vi.fn(),
  insertBookPages: vi.fn(),
  searchBookText: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getDb: vi.fn(),
  askReadingBuddy: vi.fn(),
  upsertBookBrain: vi.fn(),
  getBookBrain: vi.fn(),
  updateBookBrain: vi.fn(),
  getReaderSettings: vi.fn(),
  upsertReaderSettings: vi.fn(),
  getReaderMemory: vi.fn(),
  upsertReaderMemory: vi.fn(),
  getBookEntities: vi.fn(),
  getAllPagesForBook: vi.fn(),
}));

vi.mock("./db", () => mocks);
vi.mock("./readingBuddy", () => ({
  askReadingBuddy: mocks.askReadingBuddy,
  BUDDY_MODES: ["explain", "simplify", "context", "why", "translate", "define", "ask"] as const,
  updateReaderMemoryFromAnswer: vi.fn().mockResolvedValue(undefined),
}));

const pdfMocks = vi.hoisted(() => ({
  extractPdf: vi.fn(),
}));
vi.mock("./pdf", async () => {
  const actual = await import("./pdf");
  return { ...actual, extractPdf: pdfMocks.extractPdf };
});

const storageMocks = vi.hoisted(() => ({
  storagePut: vi.fn(),
}));
vi.mock("./storage", () => storageMocks);
vi.mock("./_core/heartbeat", () => ({
  createHeartbeatJob: vi.fn().mockResolvedValue({ taskUid: "test-task-uid" }),
  deleteHeartbeatJob: vi.fn(),
}));
vi.mock("../bookBrain", () => ({
  buildBrainContext: vi.fn().mockResolvedValue(null),
  runBookBrainPipeline: vi.fn().mockResolvedValue({ passCompleted: 4, skipped: false }),
}));
vi.mock("./bookBrain", () => ({
  buildBrainContext: vi.fn().mockResolvedValue(null),
  runBookBrainPipeline: vi.fn().mockResolvedValue({ passCompleted: 4, skipped: false }),
}));

const { appRouter } = await import("./routers");

function ctxFor(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `open-${userId}`,
      email: `reader${userId}@example.com`,
      name: `Reader ${userId}`,
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const anonCtx = {
  user: null,
  req: { protocol: "https", headers: {} },
  res: { clearCookie: () => {} },
} as unknown as TrpcContext;

const sampleBook = {
  id: 7,
  userId: 1,
  title: "The Wealth of Nations",
  author: "Adam Smith",
  fileKey: "books/1/x.pdf",
  fileUrl: "/manus-storage/books/1/x.pdf",
  coverKey: null,
  coverUrl: null,
  pageCount: 12,
  lastPage: 3,
  fileSize: 1024,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastOpenedAt: null,
};

beforeEach(() => {
  Object.values(mocks).forEach(fn => fn.mockReset());
  pdfMocks.extractPdf.mockReset();
  storageMocks.storagePut.mockReset();
  // New brain/memory helpers — default to no-ops so upload tests pass
  mocks.upsertBookBrain.mockResolvedValue(undefined);
  mocks.getBookBrain.mockResolvedValue(null);
  mocks.updateBookBrain.mockResolvedValue(undefined);
  mocks.getReaderSettings.mockResolvedValue(null);
  mocks.upsertReaderSettings.mockResolvedValue(undefined);
  mocks.getReaderMemory.mockResolvedValue(null);
  mocks.upsertReaderMemory.mockResolvedValue(undefined);
  mocks.getBookEntities.mockResolvedValue([]);
  mocks.getAllPagesForBook.mockResolvedValue([]);
});

describe("books router access control", () => {
  it("rejects anonymous callers", async () => {
    const caller = appRouter.createCaller(anonCtx);
    await expect(caller.books.list()).rejects.toThrow();
  });

  it("only returns books belonging to the caller", async () => {
    mocks.listBooksForUser.mockResolvedValue([sampleBook]);
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.books.list();
    expect(mocks.listBooksForUser).toHaveBeenCalledWith(1);
    expect(result).toHaveLength(1);
  });

  it("throws NOT_FOUND when the book belongs to somebody else", async () => {
    mocks.getBookForUser.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor(2));
    await expect(caller.books.get({ bookId: 7 })).rejects.toThrow(/not found/i);
    expect(mocks.getBookForUser).toHaveBeenCalledWith(7, 2);
  });

  it("clamps a requested page to the book length", async () => {
    mocks.getBookForUser.mockResolvedValue(sampleBook);
    mocks.getBookPage.mockResolvedValue({ id: 1, bookId: 7, pageNumber: 12, content: "end" });
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.books.page({ bookId: 7, pageNumber: 999 });
    expect(result.pageNumber).toBe(12);
    expect(mocks.getBookPage).toHaveBeenCalledWith(7, 12);
  });

  it("clamps saved progress to the final page", async () => {
    mocks.getBookForUser.mockResolvedValue(sampleBook);
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.books.updateProgress({ bookId: 7, lastPage: 500 });
    expect(result.lastPage).toBe(12);
    expect(mocks.updateBookProgress).toHaveBeenCalledWith(7, 1, 12);
  });

  it("reports a clear error when deleting a book the user does not own", async () => {
    mocks.deleteBookForUser.mockResolvedValue(false);
    const caller = appRouter.createCaller(ctxFor(3));
    await expect(caller.books.remove({ bookId: 7 })).rejects.toThrow(/not found/i);
  });

  it("renames only the caller's own book", async () => {
    mocks.getBookForUser.mockResolvedValue(sampleBook);
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.books.rename({ bookId: 7, title: "New Title", author: "A. Smith" });
    expect(mocks.updateBookMeta).toHaveBeenCalledWith(7, 1, {
      title: "New Title",
      author: "A. Smith",
    });
  });

  it("refuses to rename a book owned by somebody else", async () => {
    mocks.getBookForUser.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor(6));
    await expect(
      caller.books.rename({ bookId: 7, title: "Hijacked" }),
    ).rejects.toThrow(/not found/i);
    expect(mocks.updateBookMeta).not.toHaveBeenCalled();
  });

  it("returns matching snippets when searching inside a book", async () => {
    mocks.getBookForUser.mockResolvedValue(sampleBook);
    mocks.searchBookText.mockResolvedValue([
      { pageNumber: 2, content: "A long passage mentioning dexterity in the middle of it." },
    ]);
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.books.search({ bookId: 7, term: "dexterity" });
    expect(result[0].pageNumber).toBe(2);
    expect(result[0].snippet).toContain("dexterity");
  });
});

/** Minimal valid-looking PDF header so the router's signature check passes. */
function fakePdfBase64(body = "fake pdf body content that is long enough") {
  return Buffer.from(`%PDF-1.4\n${body}`).toString("base64");
}

describe("books.upload", () => {
  it("rejects files that are not PDFs", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.books.upload({
        filename: "notes.pdf",
        fileBase64: Buffer.from("plain text, no pdf header").toString("base64"),
      }),
    ).rejects.toThrow(/not a valid pdf/i);
    expect(pdfMocks.extractPdf).not.toHaveBeenCalled();
  });

  it("rejects scanned PDFs that yield no readable text", async () => {
    pdfMocks.extractPdf.mockResolvedValue({
      pageCount: 3,
      pages: ["", " ", ""],
      title: null,
      author: null,
    });
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.books.upload({ filename: "scan.pdf", fileBase64: fakePdfBase64() }),
    ).rejects.toThrow(/scanned book/i);
    expect(mocks.createBook).not.toHaveBeenCalled();
  });

  it("stores the file, creates the book and writes every page", async () => {
    pdfMocks.extractPdf.mockResolvedValue({
      pageCount: 2,
      pages: ["First page with plenty of readable words in it.", "Second page text."],
      title: "Metadata Title",
      author: "Adam Smith",
    });
    storageMocks.storagePut.mockResolvedValue({
      key: "books/1/x.pdf",
      url: "/manus-storage/books/1/x.pdf",
    });
    mocks.createBook.mockResolvedValue(31);

    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.books.upload({
      filename: "some_book.pdf",
      fileBase64: fakePdfBase64(),
    });

    expect(result).toMatchObject({ bookId: 31, title: "Metadata Title", pageCount: 2 });
    expect(mocks.createBook).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        title: "Metadata Title",
        author: "Adam Smith",
        pageCount: 2,
      }),
    );
    expect(mocks.insertBookPages).toHaveBeenCalledWith([
      { bookId: 31, pageNumber: 1, content: "First page with plenty of readable words in it." },
      { bookId: 31, pageNumber: 2, content: "Second page text." },
    ]);
  });

  it("prefers an explicit title over the PDF metadata title", async () => {
    pdfMocks.extractPdf.mockResolvedValue({
      pageCount: 1,
      pages: ["Enough readable text on this page to pass the check."],
      title: "Metadata Title",
      author: null,
    });
    storageMocks.storagePut.mockResolvedValue({ key: "k", url: "/manus-storage/k" });
    mocks.createBook.mockResolvedValue(32);

    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.books.upload({
      filename: "book.pdf",
      fileBase64: fakePdfBase64(),
      title: "My Own Title",
    });
    expect(result.title).toBe("My Own Title");
  });

  it("falls back to the filename when there is no metadata title", async () => {
    pdfMocks.extractPdf.mockResolvedValue({
      pageCount: 1,
      pages: ["Enough readable text on this page to pass the check."],
      title: null,
      author: null,
    });
    storageMocks.storagePut.mockResolvedValue({ key: "k", url: "/manus-storage/k" });
    mocks.createBook.mockResolvedValue(33);

    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.books.upload({
      filename: "the_wealth_of_nations.pdf",
      fileBase64: fakePdfBase64(),
    });
    expect(result.title).toBe("The Wealth of Nations");
  });
});

describe("notebook router", () => {
  it("scopes listing to the caller", async () => {
    mocks.listNotebookEntries.mockResolvedValue([]);
    const caller = appRouter.createCaller(ctxFor(5));
    await caller.notebook.list();
    expect(mocks.listNotebookEntries).toHaveBeenCalledWith(5, undefined);
  });

  it("passes a book filter through to the query layer", async () => {
    mocks.listNotebookEntries.mockResolvedValue([]);
    const caller = appRouter.createCaller(ctxFor(5));
    await caller.notebook.list({ bookId: 7 });
    expect(mocks.listNotebookEntries).toHaveBeenCalledWith(5, 7);
  });

  it("refuses to save a note against another user's book", async () => {
    mocks.getBookForUser.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor(9));
    await expect(
      caller.notebook.save({
        bookId: 7,
        pageNumber: 2,
        mode: "explain",
        highlight: "some text",
        answer: "an answer",
      }),
    ).rejects.toThrow(/not found/i);
    expect(mocks.createNotebookEntry).not.toHaveBeenCalled();
  });

  it("persists a note with the caller's user id", async () => {
    mocks.getBookForUser.mockResolvedValue(sampleBook);
    mocks.createNotebookEntry.mockResolvedValue(42);
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.notebook.save({
      bookId: 7,
      pageNumber: 4,
      mode: "define",
      highlight: "dexterity",
      answer: "Skill at a task.",
    });
    expect(result).toEqual({ id: 42 });
    expect(mocks.createNotebookEntry).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, bookId: 7, pageNumber: 4, mode: "define" }),
    );
  });

  it("deletes only within the caller's own notes", async () => {
    const caller = appRouter.createCaller(ctxFor(4));
    await caller.notebook.remove({ entryId: 11 });
    expect(mocks.deleteNotebookEntry).toHaveBeenCalledWith(11, 4);
  });
});

describe("buddy router", () => {
  it("passes the page text as context to the model", async () => {
    mocks.getBookForUser.mockResolvedValue(sampleBook);
    mocks.getBookPage.mockResolvedValue({
      id: 3,
      bookId: 7,
      pageNumber: 3,
      content: "The division of labour raises productivity.",
    });
    mocks.askReadingBuddy.mockResolvedValue("It means specialising helps.");

    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.buddy.ask({
      bookId: 7,
      pageNumber: 3,
      highlight: "division of labour",
      mode: "explain",
    });

    expect(result.answer).toBe("It means specialising helps.");
    expect(mocks.askReadingBuddy).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "explain",
        bookTitle: "The Wealth of Nations",
        pageContext: "The division of labour raises productivity.",
        pageNumber: 3,
      }),
    );
  });

  it("requires a question in ask mode", async () => {
    mocks.getBookForUser.mockResolvedValue(sampleBook);
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.buddy.ask({ bookId: 7, pageNumber: 3, highlight: "x", mode: "ask" }),
    ).rejects.toThrow(/question/i);
  });

  it("refuses to answer for a book the user does not own", async () => {
    mocks.getBookForUser.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctxFor(8));
    await expect(
      caller.buddy.ask({ bookId: 7, pageNumber: 1, highlight: "x", mode: "explain" }),
    ).rejects.toThrow(/not found/i);
    expect(mocks.askReadingBuddy).not.toHaveBeenCalled();
  });
});
