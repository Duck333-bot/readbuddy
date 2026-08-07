/**
 * Browser-side PDF helpers. Rendering the first page to a JPEG needs a canvas,
 * so cover generation happens here and the resulting image is sent to the
 * server alongside the file.
 */
import * as pdfjs from "pdfjs-dist";
// Vite resolves this to a hashed asset URL for the worker bundle.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfPreview = {
  pageCount: number;
  coverDataUrl: string | null;
};

const COVER_MAX_WIDTH = 520;

/** Render page 1 of the PDF to a compressed JPEG data URL for the library card. */
export async function buildPdfPreview(file: File): Promise<PdfPreview> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  let coverDataUrl: string | null = null;
  try {
    const page = await doc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, COVER_MAX_WIDTH / baseViewport.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      coverDataUrl = canvas.toDataURL("image/jpeg", 0.72);
    }
  } catch {
    // A cover is optional; the library falls back to a typographic placeholder.
  }

  const pageCount = doc.numPages;
  await doc.cleanup();
  return { pageCount, coverDataUrl };
}

/** Read a File into a bare base64 string (no data: prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}
