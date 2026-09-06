import { describe, expect, it } from "vitest";
import { storageKeyBelongsToUser } from "./storageAccess";

describe("private storage key ownership", () => {
  it("accepts only private book and material keys under the authenticated user prefix", () => {
    expect(storageKeyBelongsToUser("books/7/example.pdf", 7)).toBe(true);
    expect(storageKeyBelongsToUser("covers/7/example.webp", 7)).toBe(true);
    expect(storageKeyBelongsToUser("materials/7/notes.docx", 7)).toBe(true);
    expect(storageKeyBelongsToUser("material-covers/7/cover.webp", 7)).toBe(true);
  });

  it("rejects other users, traversal attempts, public assets, and invalid identities", () => {
    expect(storageKeyBelongsToUser("books/8/example.pdf", 7)).toBe(false);
    expect(storageKeyBelongsToUser("books/7/../8/example.pdf", 7)).toBe(false);
    expect(storageKeyBelongsToUser("books/7/nested/example.pdf", 7)).toBe(false);
    expect(storageKeyBelongsToUser("/books/7/example.pdf", 7)).toBe(false);
    expect(storageKeyBelongsToUser("marketing/7/example.webp", 7)).toBe(false);
    expect(storageKeyBelongsToUser("books/7/example.pdf", -1)).toBe(false);
  });
});
