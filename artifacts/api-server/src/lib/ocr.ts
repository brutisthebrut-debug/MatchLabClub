import { createWorker, type Worker } from "tesseract.js";
import { logger } from "./logger";
import { parseProfileText, type SourceApp } from "./profileParser";

export { parseProfileText, type SourceApp, type ParsedProfile } from "./profileParser";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng").catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

function stripDataUrlPrefix(input: string): string {
  const comma = input.indexOf(",");
  if (input.startsWith("data:") && comma !== -1) {
    return input.slice(comma + 1);
  }
  return input;
}

/**
 * Run OCR on a base64-encoded image, then run the deterministic parser to
 * pull out firstName, age, sourceApp, bio and the list of prompts.
 */
export async function extractProfileFromScreenshot(imageBase64: string): Promise<{
  firstName: string | null;
  age: number | null;
  sourceApp: SourceApp | null;
  bio: string;
  prompts: string[];
  rawText: string;
}> {
  const cleaned = stripDataUrlPrefix(imageBase64.trim());
  if (!cleaned) {
    throw new Error("Empty image payload");
  }
  const buffer = Buffer.from(cleaned, "base64");
  if (buffer.length === 0) {
    throw new Error("Invalid base64 image");
  }

  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  const rawText = (data.text || "").trim();
  logger.debug({ length: rawText.length }, "OCR completed");

  const parsed = parseProfileText(rawText);
  return { ...parsed, rawText };
}
