import { createWorker, type Worker } from "tesseract.js";
import { logger } from "./logger";
import { parseProfileText, detectSourceApp, type SourceApp } from "./profileParser";
import { getCachedLearnedRules } from "./ocrLearning";

export { parseProfileText, type SourceApp, type ParsedProfile } from "./profileParser";

import type { ParsedProfile } from "./profileParser";

export type OcrFieldName = "firstName" | "age" | "sourceApp" | "bio" | "prompts";

/**
 * Flag fields that the parser is least confident about so the review UI can
 * highlight them as "double-check this". Heuristic, not authoritative.
 */
export function detectLowConfidenceFields(parsed: ParsedProfile): OcrFieldName[] {
  const flags: OcrFieldName[] = [];
  if (!parsed.firstName) flags.push("firstName");
  if (parsed.age === null) flags.push("age");
  if (!parsed.sourceApp) flags.push("sourceApp");
  if (!parsed.bio || parsed.bio.length < 20) flags.push("bio");
  if (parsed.prompts.length === 0) flags.push("prompts");
  return flags;
}

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

  const parsed = parseProfileText(rawText, getCachedLearnedRules());
  return { ...parsed, rawText };
}

const CHAT_UI_NOISE: RegExp[] = [
  /^send like$/i,
  /^send a like$/i,
  /^send a compliment$/i,
  /^send$/i,
  /^reply$/i,
  /^message$/i,
  /^type a message/i,
  /^aa$/i,
  /^delivered$/i,
  /^read$/i,
  /^seen$/i,
  /^it'?s a match/i,
  /^unmatch$/i,
  /^report$/i,
  /^block$/i,
  /^\d{1,2}:\d{2}\s*(am|pm)?$/i,
  /^(yesterday|today|now|just now|\d+\s?(m|h|d)\s?ago)$/i,
  /^(mon|tue|wed|thu|fri|sat|sun)(day)?$/i,
  /^[•·●○◆■\s]+$/,
];

function isChatNoise(line: string): boolean {
  if (line.length < 2) return true;
  return CHAT_UI_NOISE.some((rx) => rx.test(line));
}

export type ChatSpeakerTurn = {
  speaker: "them" | "you";
  text: string;
};

/**
 * Infer speaker turns from an ordered list of raw OCR lines.
 *
 * Heuristic: noise lines (timestamps, delivery indicators, UI chrome) act as
 * turn boundaries. Consecutive content lines without intervening noise belong
 * to the same speaker. Speakers alternate across turn blocks, starting with
 * "them" (the match) — the most common arrangement in a dating-app screenshot.
 *
 * This is intentionally simple; the client should let users flip misattributed
 * turns rather than trying to be perfect here.
 */
export function inferSpeakerTurns(lines: string[]): ChatSpeakerTurn[] {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (isChatNoise(line)) {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  return blocks.flatMap((block, i) =>
    block.map((text) => ({
      speaker: (i % 2 === 0 ? "them" : "you") as "them" | "you",
      text,
    })),
  );
}

/**
 * Run OCR on a chat-screenshot and return the conversation text, the
 * detected source app, and an ordered list of inferred speaker turns.
 * Speaker attribution is heuristic — the client should let users correct
 * misattributed bubbles.
 */
export async function extractChatFromScreenshot(imageBase64: string): Promise<{
  conversationText: string;
  sourceApp: SourceApp | null;
  rawText: string;
  speakerTurns: ChatSpeakerTurn[];
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
  logger.debug({ length: rawText.length }, "Chat OCR completed");

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);

  const sourceApp = detectSourceApp(lines);
  const conversationText = lines.filter((l) => !isChatNoise(l)).join("\n");
  const speakerTurns = inferSpeakerTurns(lines);

  return { conversationText, sourceApp, rawText, speakerTurns };
}
