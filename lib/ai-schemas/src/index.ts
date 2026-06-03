import { z } from "zod";

export const blueprintSchema = z.object({
  firstImpression: z.string().trim().min(20),
  repeatingPattern: z.string().trim().min(20),
  communicationStyle: z.string().trim().min(20),
  attractionPattern: z.string().trim().min(20),
  comfortNeeds: z.string().trim().min(20),
  riskLoop: z.string().trim().min(20),
  growthEdge: z.string().trim().min(20),
});

export type BlueprintOutput = z.infer<typeof blueprintSchema>;

export const nextMessageOptionSchema = z.object({
  style: z.string().trim().min(1),
  text: z.string().trim().min(1),
  when: z.string().trim().default(""),
});

export type NextMessageOptionOutput = z.infer<typeof nextMessageOptionSchema>;

export const nextMessageSchema = z.object({
  options: z.array(nextMessageOptionSchema).min(3).max(7),
  coachNote: z.string().trim().min(1),
});

export type NextMessageOutput = z.infer<typeof nextMessageSchema>;

export const messageCoachReplySchema = z.object({
  style: z.string().trim().min(1),
  text: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
});

export type MessageCoachReplyOutput = z.infer<typeof messageCoachReplySchema>;

export const messageCoachSchema = z.object({
  analysis: z.string().trim().min(1),
  suggestedReplies: z.array(messageCoachReplySchema).min(2).max(6),
  tone: z.string().trim().min(1),
  redFlags: z.array(z.string().trim().min(1)).max(8),
  coachTip: z.string().trim().min(1),
});

export type MessageCoachOutput = z.infer<typeof messageCoachSchema>;

export const bioRewriteSchema = z.object({
  rewrittenBio: z.string().trim().min(1),
  bioAudit: z.string().trim().min(1),
});

export type BioRewriteOutput = z.infer<typeof bioRewriteSchema>;

export const emailInsightSchema = z.object({
  communicationPatterns: z
    .array(
      z.object({
        pattern: z.string().trim().min(1),
        frequency: z.string().trim().min(1),
        impact: z.string().trim().min(1),
      }),
    )
    .min(1)
    .max(8),
  attachmentStyle: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1)).min(1).max(8),
  growthAreas: z.array(z.string().trim().min(1)).min(1).max(8),
  datingProfileTips: z.array(z.string().trim().min(1)).min(1).max(8),
  summary: z.string().trim().min(1),
});

export type EmailInsightAiOutput = z.infer<typeof emailInsightSchema>;

export const rehearsalSchema = z.object({
  reply: z.string().trim().min(1),
  note: z.string().trim().min(1),
  tone: z.string().trim().min(1),
});

export type RehearsalAiOutput = z.infer<typeof rehearsalSchema>;

export const mirrorAskSchema = z.object({
  answer: z.string().trim().min(1),
  followUp: z.string().trim().min(1),
});

export type MirrorAskAiOutput = z.infer<typeof mirrorAskSchema>;

export const mirrorDigestSchema = z.object({
  intro: z.string().trim().min(1),
});

export type MirrorDigestAiOutput = z.infer<typeof mirrorDigestSchema>;

export const echoReplySchema = z.object({
  answer: z.string().trim().min(1),
  followUp: z.string().trim().default(""),
});

export type EchoReplyAiOutput = z.infer<typeof echoReplySchema>;

export const echoReviewSchema = z.object({
  verdict: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1)).max(8).default([]),
  risks: z.array(z.string().trim().min(1)).max(8).default([]),
  suggestion: z.string().trim().min(1),
});

export type EchoReviewAiOutput = z.infer<typeof echoReviewSchema>;

export const echoMatchReadSchema = z.object({
  headline: z.string().trim().min(1),
  reading: z.array(z.string().trim().min(1)).min(1),
  idealMatch: z.array(z.string().trim().min(1)).min(1),
});

export type EchoMatchReadAiOutput = z.infer<typeof echoMatchReadSchema>;

export const echoPulseSchema = z.object({
  headline: z.string().trim().min(1),
  nowSee: z.string().trim().default(""),
});

export type EchoPulseAiOutput = z.infer<typeof echoPulseSchema>;

export function parseAiJson<T>(
  schema: z.ZodType<T>,
  raw: string,
): T | null {
  try {
    const json = JSON.parse(raw) as unknown;
    const result = schema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Tool name → schema map. Tool names match the `toolName` field sent by the
 * frontend so the server can validate structured outputs by tool.
 */
export const aiToolSchemas = {
  "Personal Blueprint": blueprintSchema,
  "Next Message": nextMessageSchema,
  "Message Coach": messageCoachSchema,
  "Bio Rewrite": bioRewriteSchema,
  "Email Insights": emailInsightSchema,
  "Rehearsal Room": rehearsalSchema,
  "Your Mirror": mirrorAskSchema,
  "Mirror Digest": mirrorDigestSchema,
  "Echo Match Read": echoMatchReadSchema,
  Echo: echoReplySchema,
  "Echo Review": echoReviewSchema,
  "Echo Pulse": echoPulseSchema,
} as const;

export type AiToolName = keyof typeof aiToolSchemas;

export function getAiToolSchema(
  toolName: string | undefined,
): z.ZodTypeAny | null {
  if (!toolName) return null;
  return (aiToolSchemas as Record<string, z.ZodTypeAny>)[toolName] ?? null;
}

/**
 * Tolerant JSON extraction: pulls the first {...} or [...] block out of `raw`
 * and validates it against `schema`. Useful when models wrap JSON in prose or
 * code fences.
 */
export function extractAndValidateJson<T>(
  schema: z.ZodType<T>,
  raw: string,
): { ok: true; value: T } | { ok: false } {
  const direct = parseAiJson(schema, raw);
  if (direct !== null) return { ok: true, value: direct };

  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const arrStart = trimmed.indexOf("[");
  const startIdx =
    start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart);
  if (startIdx === -1) return { ok: false };
  const endChar = trimmed[startIdx] === "{" ? "}" : "]";
  const endIdx = trimmed.lastIndexOf(endChar);
  if (endIdx === -1 || endIdx <= startIdx) return { ok: false };
  const slice = trimmed.slice(startIdx, endIdx + 1);
  const parsed = parseAiJson(schema, slice);
  if (parsed === null) return { ok: false };
  return { ok: true, value: parsed };
}
