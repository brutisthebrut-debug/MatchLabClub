import { createWorker, type Worker } from "tesseract.js";
import { logger } from "./logger";

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

const PROMPT_HINTS = [
  "the way to win me over is",
  "i'm looking for",
  "a green flag i look for",
  "my simple pleasures",
  "we'll get along if",
  "i go crazy for",
  "the key to my heart is",
  "my most irrational fear",
  "two truths and a lie",
  "dating me is like",
  "my love language is",
  "i quote too much from",
  "i'll know i've found the one when",
  "the best way to ask me out is by",
  "what makes a good relationship great",
  "first round is on me if",
  "the dorkiest thing about me is",
  "fact about me that surprises people",
  "i'm convinced that",
  "my favorite quality in a person",
  "all i ask is that you",
];

function isLikelyPromptLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (PROMPT_HINTS.some((h) => lower.includes(h))) return true;
  if (line.length < 60 && /\?$/.test(line)) return true;
  if (line.length < 80 && /^(my|the|i|we|a|first|two|dating|all)\b/i.test(line) && /(\.\.\.|…|:)$/.test(line)) {
    return true;
  }
  return false;
}

/**
 * Run OCR on a base64-encoded image and best-effort split the extracted
 * text into a bio paragraph and a list of prompt lines.
 */
export async function extractProfileFromScreenshot(imageBase64: string): Promise<{
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

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1);

  const prompts: string[] = [];
  const bioLines: string[] = [];
  for (const line of lines) {
    if (isLikelyPromptLine(line)) {
      prompts.push(line);
    } else if (line.length >= 8) {
      bioLines.push(line);
    }
  }

  const bio = bioLines.join(" ").trim();
  return { bio, prompts, rawText };
}
