import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { detectMaterialFileType, parseMaterial, parsePptxSlideText } from "./parser";

describe("Material parser adapters", () => {
  it("detects the five supported material types", () => {
    expect(detectMaterialFileType("book.pdf", new TextEncoder().encode("%PDF-1.7"))).toBe("pdf");
    expect(detectMaterialFileType("notes.docx", new Uint8Array())).toBe("docx");
    expect(detectMaterialFileType("lecture.pptx", new Uint8Array())).toBe("pptx");
    expect(detectMaterialFileType("outline.txt", new Uint8Array())).toBe("txt");
    expect(detectMaterialFileType("lesson.md", new Uint8Array())).toBe("markdown");
  });

  it("preserves Markdown heading coordinates in normalized sections", async () => {
    const material = await parseMaterial({
      filename: "elasticity.md",
      bytes: new TextEncoder().encode("# Economics\n\n## Price elasticity\n\nDemand changes when price changes."),
    });
    expect(material.fileType).toBe("markdown");
    expect(material.units[0].sourceRef.unitType).toBe("section");
    expect(material.units.some(unit => unit.headings.includes("Price elasticity"))).toBe(true);
  });

  it("strips pasted web-reader chrome before it can become textbook evidence", async () => {
    const source = "Skip to main content\nchrome_reader_mode Enter Reader Mode\n# 6.2: The Cell Membrane\n\n1. Learning Objectives\n2. Structure and Composition\n\n##### Learning Objectives\n\nExplain how phospholipid tails create a selectively permeable barrier.\n\n## Transport\n\nPassive transport moves substances down a concentration gradient.";
    const material = await parseMaterial({ filename: "cell-membrane.md", bytes: new TextEncoder().encode(source) });
    const content = material.units.map(unit => unit.text).join("\n");

    expect(content).not.toMatch(/skip to main|reader mode|learning objectives\n2\./i);
    expect(content).toContain("phospholipid tails");
    expect(material.units[0]?.headings).toContain("Learning Objectives");
  });

  it("extracts text from ordered PowerPoint slide XML", async () => {
    const archive = new JSZip();
    archive.file("ppt/slides/slide2.xml", "<p:sld xmlns:p='p' xmlns:a='a'><a:t>Second slide</a:t></p:sld>");
    archive.file("ppt/slides/slide1.xml", "<p:sld xmlns:p='p' xmlns:a='a'><a:t>First slide</a:t></p:sld>");
    const material = await parseMaterial({ filename: "lecture.pptx", bytes: await archive.generateAsync({ type: "uint8array" }) });
    expect(material.units.map(unit => unit.text)).toEqual(["First slide", "Second slide"]);
    expect(parsePptxSlideText("<a:t xmlns:a='a'>Evidence</a:t>")).toBe("Evidence");
  });

  it("extracts readable text from a DOCX package", async () => {
    const archive = new JSZip();
    archive.file("[Content_Types].xml", "<Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'><Default Extension='rels' ContentType='application/vnd.openxmlformats-package.relationships+xml'/><Default Extension='xml' ContentType='application/xml'/><Override PartName='/word/document.xml' ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'/></Types>");
    archive.file("_rels/.rels", "<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'><Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument' Target='word/document.xml'/></Relationships>");
    archive.file("word/document.xml", "<w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'><w:body><w:p><w:r><w:t>Price elasticity measures response to price.</w:t></w:r></w:p></w:body></w:document>");
    const material = await parseMaterial({ filename: "economics.docx", bytes: await archive.generateAsync({ type: "uint8array" }) });
    expect(material.fileType).toBe("docx");
    expect(material.units[0].text).toContain("Price elasticity");
  });

  it("rejects unreadable PDFs instead of inventing text", async () => {
    await expect(parseMaterial({ filename: "scan.pdf", bytes: new TextEncoder().encode("%PDF-not-a-real-file") })).rejects.toThrow(/could not be read|selectable text/i);
  });

  it("normalizes Buffer and Uint8Array PDF input for the shared extractor", async () => {
    const bytes = Buffer.from("%PDF-not-a-real-file");
    await expect(parseMaterial({ filename: "buffer.pdf", bytes })).rejects.toThrow(/could not be read|selectable text/i);
    await expect(parseMaterial({ filename: "array.pdf", bytes: new Uint8Array(bytes) })).rejects.toThrow(/could not be read|selectable text/i);
  });
});
