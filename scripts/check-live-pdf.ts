import fs from "node:fs/promises";
import { extractPdf } from "../server/pdf";

const bytes = await fs.readFile("/home/ubuntu/zhiya-live-upload-check.pdf");
const result = await extractPdf(new Uint8Array(bytes));
console.log(JSON.stringify({
  pageCount: result.pageCount,
  firstReadablePage: result.firstReadablePage,
  characters: result.pages.join("").replace(/\s/g, "").length,
  title: result.title,
}));

process.exit(0);
