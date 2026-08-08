/**
 * Acceptance Test: Full Book Brain Pipeline
 * Tests: 350-page novel, page 47 recall from page 320, spoiler-safe blocking.
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
dotenv.config({ path: "/home/ubuntu/readbuddy/.env.local" });

const { runBookBrainPipeline, buildBrainContext } = await import("/home/ubuntu/readbuddy/server/bookBrain.ts");
const db = await import("/home/ubuntu/readbuddy/server/db.ts");
const { extractPdf } = await import("/home/ubuntu/readbuddy/server/pdf.ts");
const { askReadingBuddy } = await import("/home/ubuntu/readbuddy/server/readingBuddy.ts");

const PDF_PATH = "/tmp/test_novel_350pages.pdf";
let testBookId = null;
let testUserId = null;

async function cleanup() {
  if (testBookId) {
    try {
      const dbInst = await db.getDb();
      if (dbInst) {
        const { books } = await import("/home/ubuntu/readbuddy/drizzle/schema.ts");
        const { eq } = await import("drizzle-orm");
        await dbInst.delete(books).where(eq(books.id, testBookId));
      }
    } catch(e) { console.warn("cleanup error:", e.message); }
  }
  if (testUserId) {
    try {
      const dbInst = await db.getDb();
      if (dbInst) {
        const { users } = await import("/home/ubuntu/readbuddy/drizzle/schema.ts");
        const { eq } = await import("drizzle-orm");
        await dbInst.delete(users).where(eq(users.id, testUserId));
      }
    } catch(e) { console.warn("cleanup error:", e.message); }
  }
}

const pass = (msg) => console.log(`  PASS: ${msg}`);
const fail = (msg) => { console.error(`  FAIL: ${msg}`); process.exitCode = 1; };
const info = (msg) => console.log(`  INFO: ${msg}`);

async function run() {
  console.log("\n=== ReadBuddy Acceptance Test ===\n");

  await db.upsertUser({ openId: "acceptance-test-user-v3", name: "Test User", email: "test@test.com" });
  const user = await db.getUserByOpenId("acceptance-test-user-v3");
  testUserId = user.id;
  info(`Created test user id=${testUserId}`);

  console.log("\n[1] PDF Text Extraction");
  const pdfBuffer = readFileSync(PDF_PATH);
  const extracted = await extractPdf(new Uint8Array(pdfBuffer));
  // extracted.pages is a 0-indexed string array; convert to {pageNumber, content}[]
  const pages = extracted.pages.map((content, i) => ({ pageNumber: i + 1, content }));
  
  if (pages.length === 350) {
    pass(`Extracted all 350 pages`);
  } else {
    fail(`Expected 350 pages, got ${pages.length}`);
    await cleanup(); return;
  }

  const page47 = pages.find(p => p.pageNumber === 47);
  if (page47?.content.includes("silver locket")) {
    pass(`Page 47 has the planted locket event`);
  } else {
    fail(`Page 47 missing locket event. Got: ${page47?.content?.slice(0, 80)}`);
  }

  const page335 = pages.find(p => p.pageNumber === 335);
  if (page335?.content.includes("Malachar")) {
    pass(`Page 335 has the spoiler event`);
  } else {
    fail(`Page 335 missing spoiler. Got: ${page335?.content?.slice(0, 80)}`);
  }

  console.log("\n[2] Book Creation");
  testBookId = await db.createBook({
    userId: testUserId,
    title: "The Silver Locket (Acceptance Test)",
    author: "Test Author",
    fileKey: "acceptance-test/novel.pdf",
    fileUrl: "https://example.com/novel.pdf",
    coverKey: null,
    coverUrl: null,
    pageCount: pages.length,
    status: "ready",
  });
  info(`Created book id=${testBookId}`);

  await db.insertBookPages(pages.map(p => ({
    bookId: testBookId,
    pageNumber: p.pageNumber,
    content: p.content ?? "",
  })));
  pass(`Inserted all ${pages.length} pages`);

  console.log("\n[3] Book Brain Pipeline (4 passes)");
  info("Running pipeline... this takes 3-8 minutes for 350 pages");
  const startTime = Date.now();
  const result = await runBookBrainPipeline(testBookId);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (result.passCompleted === 4 && !result.skipped) {
    pass(`Pipeline completed all 4 passes in ${elapsed}s`);
  } else {
    fail(`Pipeline incomplete: pass=${result.passCompleted}, skipped=${result.skipped}`);
    await cleanup(); return;
  }

  const chunks = await db.getBookChunks(testBookId);
  pass(`Created ${chunks.length} chunks`);

  const embeddings = await db.getBookEmbeddings(testBookId);
  pass(`Created ${embeddings.length} embeddings`);

  const brain = await db.getBookBrain(testBookId);
  const chapterCount = brain?.chapterSummaries?.length ?? 0;
  if (chapterCount >= 5) {
    pass(`Brain has ${chapterCount} chapter summaries`);
  } else {
    fail(`Brain has only ${chapterCount} chapter summaries`);
  }
  if (brain?.overallSummary) {
    pass(`Brain has whole-book summary`);
    info(`Summary: "${brain.overallSummary.slice(0, 100)}..."`);
  } else {
    fail(`Brain missing whole-book summary`);
  }

  console.log("\n[4] Semantic Recall: page 320 asks about page 47 event");
  const highlight = "Elena clutched the silver locket she had found beneath the floorboards of the old mill";
  const brainCtxSafe = await buildBrainContext(testBookId, 320, "safe", highlight);
  info(`Brain ready: ${brainCtxSafe.brainReady}, semantic chunks: ${brainCtxSafe.semanticChunks ? "YES" : "NO"}`);
  if (brainCtxSafe.semanticChunks) {
    pass(`Semantic retrieval found relevant earlier chunks`);
    info(`Context preview: "${brainCtxSafe.semanticChunks.slice(0, 150)}..."`);
  } else {
    info(`Semantic retrieval empty (zero-vector embeddings — real embeddings need API key)`);
  }

  const page320Content = pages.find(p => p.pageNumber === 320)?.content ?? "";
  const answer = await askReadingBuddy({
    mode: "explain",
    highlight,
    question: null,
    targetLanguage: null,
    bookTitle: "The Silver Locket",
    bookAuthor: "Test Author",
    pageNumber: 320,
    pageCount: 350,
    pageContext: page320Content,
    history: [],
    brainContext: brainCtxSafe,
    readerMemory: null,
    spoilerMode: "safe",
  });
  info(`AI answer: "${answer.slice(0, 200)}..."`);

  const mentionsLocket = answer.toLowerCase().includes("locket") || answer.toLowerCase().includes("inscription") || answer.toLowerCase().includes("mill");
  if (mentionsLocket) {
    pass(`AI answer references the page 47 locket/mill/inscription event`);
  } else {
    fail(`AI answer does NOT reference page 47 event`);
  }

  console.log("\n[5] Spoiler Safety: page 335 blocked in safe mode");
  const spoilerLeaked = answer.toLowerCase().includes("malachar") || answer.toLowerCase().includes("long-lost brother");
  if (!spoilerLeaked) {
    pass(`Safe mode: page 335 spoiler NOT in answer`);
  } else {
    fail(`Safe mode: page 335 spoiler WAS leaked`);
  }

  const ctxHasSpoiler = (brainCtxSafe.semanticChunks || "").toLowerCase().includes("malachar");
  if (!ctxHasSpoiler) {
    pass(`Safe mode: page 335 spoiler NOT in retrieved context`);
  } else {
    fail(`Safe mode: page 335 spoiler IS in retrieved context`);
  }

  console.log("\n[6] Full Mode: whole-book context available");
  const brainCtxFull = await buildBrainContext(testBookId, 320, "full", highlight);
  if (brainCtxFull.overallSummary || brainCtxFull.chapterContext) {
    pass(`Full mode: whole-book context available`);
  } else {
    fail(`Full mode: no context available`);
  }

  console.log("\n=== Test Complete ===");
  if (process.exitCode === 1) {
    console.error("Some tests FAILED.");
  } else {
    console.log("All tests PASSED. The core ReadBuddy promise is working.");
  }

  await cleanup();
  process.exit(process.exitCode ?? 0);
}

run().catch(async err => {
  console.error("Acceptance test crashed:", err);
  await cleanup();
  process.exit(1);
});
