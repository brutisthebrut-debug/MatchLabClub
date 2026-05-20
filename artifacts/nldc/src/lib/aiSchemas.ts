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
