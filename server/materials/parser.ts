import JSZip from "jszip";
import * as mammoth from "mammoth";
import { XMLParser } from "fast-xml-parser";
import { extractPdf, titleFromFilename } from "../pdf";
import type {
  MaterialFileType,
  MaterialType,
  NormalizedMaterial,
  NormalizedMaterialUnit,
  SourceRef,
} from "@shared/materials";

export const MAX_MATERIAL_BYTES = 40 * 1024 * 1024;

export class MaterialParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaterialParseError";
  }
}

export type MaterialParserInput = {
  bytes: Uint8Array;
  filename: string;
  mimeType?: string | null;
  materialType?: MaterialType;
};

export interface MaterialParser {
  readonly fileType: MaterialFileType;
  parse(input: MaterialParserInput): Promise<NormalizedMaterial>;
}

const filenameExtension = (filename: string) => filename.trim().toLowerCase().split(".").pop() ?? "";

export function detectMaterialFileType(filename: string, bytes: Uint8Array): MaterialFileType {
  const extension = filenameExtension(filename);
  if (bytes.subarray(0, 5).toString() === "%PDF-" || extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "pptx") return "pptx";
  if (extension === "txt") return "txt";
  if (extension === "md" || extension === "markdown") return "markdown";
  throw new MaterialParseError("ZhiyaAI supports PDF, DOCX, PPTX, TXT, and Markdown files right now.");
}

export function inferMimeType(fileType: MaterialFileType): string {
  switch (fileType) {
    case "pdf": return "application/pdf";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "markdown": return "text/markdown";
    case "txt": return "text/plain";
  }
}

export function titleFromMaterialFilename(filename: string): string {
  const base = filename.replace(/\.(pdf|docx|pptx|txt|md|markdown)$/i, "");
  return titleFromFilename(`${base}.pdf`).replace(/book$/i, "material");
}

function materialTypeFor(fileType: MaterialFileType, explicit?: MaterialType): MaterialType {
  if (explicit) return explicit;
  if (fileType === "pptx") return "slides";
  if (fileType === "docx" || fileType === "markdown" || fileType === "txt") return "lecture_notes";
  return "document";
}

function sourceRef(unitType: "page" | "slide" | "section", unitIndex: number, headingPath: string[] = []): SourceRef {
  return {
    unitType,
    unitIndex,
    ...(unitType === "page" ? { page: unitIndex } : {}),
    ...(unitType === "slide" ? { slide: unitIndex } : {}),
    ...(unitType === "section" ? { section: unitIndex } : {}),
    headingPath,
  };
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

function unitFromText(index: number, text: string, title: string | null, headingPath: string[] = []): NormalizedMaterialUnit {
  return {
    index,
    type: "section",
    title,
    text,
    sourceRef: sourceRef("section", index, headingPath),
    headings: headingPath,
  };
}

function plainTextUnits(text: string): NormalizedMaterialUnit[] {
  const paragraphs = normalizeText(text).split(/\n{2,}/).map(part => part.trim()).filter(Boolean);
  if (paragraphs.length === 0) throw new MaterialParseError("No readable text was found in this material.");
  const units: NormalizedMaterialUnit[] = [];
  let buffer: string[] = [];
  let length = 0;
  for (const paragraph of paragraphs) {
    if (buffer.length > 0 && length + paragraph.length > 4200) {
      const content = buffer.join("\n\n");
      units.push(unitFromText(units.length + 1, content, null));
      buffer = [];
      length = 0;
    }
    buffer.push(paragraph);
    length += paragraph.length;
  }
  if (buffer.length) units.push(unitFromText(units.length + 1, buffer.join("\n\n"), null));
  return units;
}

function markdownUnits(markdown: string): NormalizedMaterialUnit[] {
  const lines = normalizeText(markdown).split("\n");
  const units: NormalizedMaterialUnit[] = [];
  const headingPath: string[] = [];
  let buffer: string[] = [];
  let currentTitle: string | null = null;
  const flush = () => {
    const content = buffer.join("\n").trim();
    if (!content) return;
    units.push(unitFromText(units.length + 1, content, currentTitle, [...headingPath]));
    buffer = [];
  };
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) {
      buffer.push(line);
      continue;
    }
    flush();
    const level = match[1].length;
    const heading = match[2].trim();
    headingPath.splice(level - 1);
    headingPath[level - 1] = heading;
    currentTitle = heading;
  }
  flush();
  return units.length > 0 ? units : plainTextUnits(markdown);
}

function collectPptxTextLeaf(value: unknown, result: string[]): void {
  if (typeof value === "string") {
    result.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectPptxTextLeaf(item, result));
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record["#text"] === "string") result.push(record["#text"]);
}

function collectPptxText(value: unknown, result: string[]): void {
  if (Array.isArray(value)) {
    value.forEach(item => collectPptxText(item, result));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("@_")) continue;
    if (key === "a:t" || key === "t") {
      collectPptxTextLeaf(nested, result);
      continue;
    }
    collectPptxText(nested, result);
  }
}

/** Exported for PPTX adapter regression coverage. */
export function parsePptxSlideText(xml: string): string {
  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: false }).parse(xml);
  const fragments: string[] = [];
  collectPptxText(parsed, fragments);
  return fragments.join(" ").replace(/\s+/g, " ").trim();
}

const pdfParser: MaterialParser = {
  fileType: "pdf",
  async parse(input) {
    const pdfBytes = new Uint8Array(input.bytes);
    const header = Array.from(pdfBytes.subarray(0, 5), byte => String.fromCharCode(byte)).join("");
    if (header !== "%PDF-") {
      throw new MaterialParseError("That file is not a valid PDF.");
    }
    let extracted;
    try {
      extracted = await extractPdf(pdfBytes);
    } catch {
      throw new MaterialParseError("This PDF could not be read. It may be corrupted or password-protected.");
    }
    if (extracted.pages.join("").replace(/\s/g, "").length < 40) {
      throw new MaterialParseError("No selectable text was found in this PDF. Scanned PDFs are not supported yet.");
    }
    const outlineByPage = new Map(extracted.outline.map(item => [item.page, item.title]));
    return {
      title: extracted.title ?? titleFromMaterialFilename(input.filename),
      source: extracted.author,
      materialType: materialTypeFor("pdf", input.materialType),
      fileType: "pdf",
      mimeType: input.mimeType || inferMimeType("pdf"),
      units: extracted.pages.map((text, zeroIndex) => {
        const index = zeroIndex + 1;
        const heading = outlineByPage.get(index) ?? null;
        return {
          index,
          type: "page" as const,
          title: heading,
          text,
          sourceRef: sourceRef("page", index, heading ? [heading] : []),
          headings: heading ? [heading] : [],
        };
      }),
      metadata: { firstReadablePage: extracted.firstReadablePage, outline: extracted.outline },
    };
  },
};

const docxParser: MaterialParser = {
  fileType: "docx",
  async parse(input) {
    try {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(input.bytes) });
      const text = normalizeText(result.value);
      const units = plainTextUnits(text);
      return {
        title: titleFromMaterialFilename(input.filename),
        materialType: materialTypeFor("docx", input.materialType),
        fileType: "docx",
        mimeType: input.mimeType || inferMimeType("docx"),
        units,
        metadata: { parserMessages: result.messages.map(message => message.message) },
      };
    } catch {
      throw new MaterialParseError("This Word document could not be read.");
    }
  },
};

const pptxParser: MaterialParser = {
  fileType: "pptx",
  async parse(input) {
    try {
      const archive = await JSZip.loadAsync(input.bytes);
      const slides = Object.keys(archive.files)
        .filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))
        .sort((left, right) => Number(/slide(\d+)/.exec(left)?.[1]) - Number(/slide(\d+)/.exec(right)?.[1]));
      if (slides.length === 0) throw new MaterialParseError("No readable slides were found in this presentation.");
      const units: NormalizedMaterialUnit[] = [];
      for (let zeroIndex = 0; zeroIndex < slides.length; zeroIndex += 1) {
        const slidePath = slides[zeroIndex];
        const text = parsePptxSlideText(await archive.file(slidePath)!.async("string"));
        if (!text) continue;
        const index = zeroIndex + 1;
        const title = text.split(/(?<=[.!?])\s+/)[0]?.slice(0, 140) ?? null;
        units.push({
          index,
          type: "slide",
          title,
          text,
          sourceRef: sourceRef("slide", index, title ? [title] : []),
          headings: title ? [title] : [],
        });
      }
      if (units.length === 0) throw new MaterialParseError("No readable text was found in this presentation.");
      return {
        title: titleFromMaterialFilename(input.filename),
        materialType: materialTypeFor("pptx", input.materialType),
        fileType: "pptx",
        mimeType: input.mimeType || inferMimeType("pptx"),
        units,
        metadata: { slideCount: slides.length },
      };
    } catch (error) {
      if (error instanceof MaterialParseError) throw error;
      throw new MaterialParseError("This PowerPoint presentation could not be read.");
    }
  },
};

const textParser: MaterialParser = {
  fileType: "txt",
  async parse(input) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(input.bytes);
    return {
      title: titleFromMaterialFilename(input.filename),
      materialType: materialTypeFor("txt", input.materialType),
      fileType: "txt",
      mimeType: input.mimeType || inferMimeType("txt"),
      units: plainTextUnits(text),
      metadata: {},
    };
  },
};

const markdownParser: MaterialParser = {
  fileType: "markdown",
  async parse(input) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(input.bytes);
    const units = markdownUnits(text);
    return {
      title: units[0]?.title || titleFromMaterialFilename(input.filename),
      materialType: materialTypeFor("markdown", input.materialType),
      fileType: "markdown",
      mimeType: input.mimeType || inferMimeType("markdown"),
      units,
      metadata: {},
    };
  },
};

const parsers: Record<MaterialFileType, MaterialParser> = {
  pdf: pdfParser,
  docx: docxParser,
  pptx: pptxParser,
  txt: textParser,
  markdown: markdownParser,
};

export async function parseMaterial(input: MaterialParserInput): Promise<NormalizedMaterial> {
  if (input.bytes.length === 0) throw new MaterialParseError("That file appears to be empty.");
  if (input.bytes.length > MAX_MATERIAL_BYTES) {
    throw new MaterialParseError("Learning materials must be 40 MB or smaller.");
  }
  const fileType = detectMaterialFileType(input.filename, input.bytes);
  return parsers[fileType].parse(input);
}
