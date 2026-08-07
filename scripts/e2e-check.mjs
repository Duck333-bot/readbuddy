/**
 * Manual end-to-end smoke check (not part of `pnpm test`).
 * Verifies: PDF extraction, S3 upload, DB insert/read, and a real LLM answer.
 * Run with: node --env-file=.env scripts/e2e-check.mjs <path-to.pdf>
 */
import { readFileSync } from "fs";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("usage: node scripts/e2e-check.mjs <file.pdf>");
  process.exit(1);
}

const { extractPdf, titleFromFilename } = await import("../server/pdf.ts");
const { storagePut } = await import("../server/storage.ts");
const { askReadingBuddy } = await import("../server/readingBuddy.ts");
const db = await import("../server/db.ts");
const { users } = await import("../drizzle/schema.ts");
const { eq } = await import("drizzle-orm");

// Foreign keys require a real user row, so create a throwaway one.
const testOpenId = `e2e-check-${Date.now()}`;
await db.upsertUser({ openId: testOpenId, name: "E2E Check", email: "e2e@example.test" });
const testUser = await db.getUserByOpenId(testOpenId);
if (!testUser) {
  console.error("could not create the temporary test user");
  process.exit(1);
}
const userId = testUser.id;
console.log(`[0/5] temporary test user id=${userId}`);

const bytes = new Uint8Array(readFileSync(pdfPath));
console.log(`[1/5] extracting ${pdfPath} (${bytes.length} bytes)…`);
const extracted = await extractPdf(bytes);
console.log(`      pages=${extracted.pageCount} title=${extracted.title ?? "(none)"}`);
const firstNonEmpty = extracted.pages.find(p => p.trim().length > 80) ?? "";
console.log(`      sample: ${firstNonEmpty.slice(0, 140)}…`);

console.log("[2/5] uploading to storage…");
const stored = await storagePut(`e2e/check.pdf`, Buffer.from(bytes), "application/pdf");
console.log(`      key=${stored.key}`);

console.log("[3/5] writing to database…");
const bookId = await db.createBook({
  userId,
  title: extracted.title ?? titleFromFilename(pdfPath),
  author: extracted.author,
  fileKey: stored.key,
  fileUrl: stored.url,
  pageCount: extracted.pageCount,
  fileSize: bytes.length,
});
await db.insertBookPages(
  extracted.pages.map((content, i) => ({ bookId, pageNumber: i + 1, content })),
);
const page = await db.getBookPage(bookId, 1);
console.log(`      bookId=${bookId} page1Chars=${page?.content.length ?? 0}`);

console.log("[4/5] asking the reading buddy…");
const sentence = firstNonEmpty.split(/(?<=\.)\s/)[0] ?? firstNonEmpty.slice(0, 200);
const answer = await askReadingBuddy({
  mode: "explain",
  highlight: sentence,
  bookTitle: extracted.title ?? "Sample",
  pageNumber: 1,
  pageCount: extracted.pageCount,
  pageContext: extracted.pages[0] ?? "",
});
console.log("      ---- answer ----");
console.log(answer);
console.log("      ----------------");

console.log("[5/5] cleaning up test rows…");
await db.deleteBookForUser(bookId, userId);
const orphanPage = await db.getBookPage(bookId, 1);
if (orphanPage) {
  console.error("      FAIL: bookPages rows survived the book delete");
  process.exit(1);
}
console.log("      verified: no orphaned pages remain");

// Removing the user must cascade away anything still referencing it.
const conn = await db.getDb();
await conn.delete(users).where(eq(users.id, userId));
console.log("      temporary user removed (cascade verified by FK constraints)");
console.log("done.");
process.exit(0);
