import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/Materials.tsx"), "utf8");

describe("ZhiyaAI materials dashboard", () => {
  it("keeps only real workspace navigation and material actions visible", () => {
    expect(page).toContain('label: "Dashboard"');
    expect(page).toContain('href: "/library"');
    expect(page).toContain('href: "/notebook"');
    expect(page).toContain('triggerLabel="Upload material"');
    expect(page).toContain('href={`/materials/${featuredMaterial.id}`}');
    expect(page).not.toContain("Record or upload audio");
    expect(page).not.toContain("Website link");
    expect(page).not.toContain("New Folder");
  });

  it("uses live material data for search, states, and material destinations", () => {
    expect(page).toContain("trpc.materials.list.useQuery");
    expect(page).toContain("visibleMaterials");
    expect(page).toContain("Search your materials");
    expect(page).toContain("processingState");
    expect(page).toContain("`/materials/${material.id}/lesson`");
  });

  it("retains clear loading, empty-library, and no-search-result recovery states", () => {
    expect(page).toContain("loading || materials.isLoading");
    expect(page).toContain("allMaterials.length === 0");
    expect(page).toContain("Your dashboard is ready for the first material.");
    expect(page).toContain("visibleMaterials.length === 0");
    expect(page).toContain("Clear search");
  });
});
