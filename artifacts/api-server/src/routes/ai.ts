import { Router, type IRouter } from "express";
import { z } from "zod";
import { generate, getAiStatus, coachingPrompt, toolPrompt, type AiContext } from "../lib/aiService";
import { requireFounder, rateLimit } from "../middlewares/founderAuth";
import { db, aiRequestMetricsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const ContextSchema = z
  .object({
    toolName: z.string().max(80).optional(),
    formValues: z.record(z.string(), z.unknown()).optional(),
    savedResults: z.record(z.string(), z.unknown()).optional(),
    goals: z.array(z.string().max(120)).max(20).optional(),
    progressEntries: z
      .array(
        z.object({
          date: z.string().max(40).optional(),
          tag: z.string().max(40).optional(),
          note: z.string().max(400).optional(),
        }),
      )
      .max(12)
      .optional(),
    extras: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

const TestBody = z.object({
  sample: z.string().min(1).max(2000),
  context: ContextSchema,
});

const EnhanceBody = z.object({
  toolName: z.string().min(1).max(80),
  prompt: z.string().min(1).max(4000),
  context: ContextSchema,
  expectJson: z.boolean().optional(),
});

router.get("/ai/status", (_req, res) => {
  res.json(getAiStatus());
});

const FallbackRateQuery = z.object({
  toolName: z.string().min(1).max(80),
  windowSize: z.coerce.number().int().min(1).max(200).optional(),
});

router.get(
  "/ai/fallback-rate",
  rateLimit({ windowMs: 60_000, max: 60 }),
  async (req, res): Promise<void> => {
    const parsed = FallbackRateQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid toolName or windowSize." });
      return;
    }
    const { toolName } = parsed.data;
    const windowSize = parsed.data.windowSize ?? 20;

    const rows = await db
      .select({ isFallback: aiRequestMetricsTable.isFallback })
      .from(aiRequestMetricsTable)
      .where(sql`${aiRequestMetricsTable.toolName} = ${toolName}`)
      .orderBy(sql`${aiRequestMetricsTable.createdAt} desc`)
      .limit(windowSize);

    const total = rows.length;
    const fallbacks = rows.filter((r) => r.isFallback === true).length;

    res.json({ toolName, windowSize, total, fallbacks });
  },
);

router.post(
  "/ai/test",
  rateLimit({ windowMs: 60_000, max: 10 }),
  requireFounder,
  async (req, res): Promise<void> => {
    const parsed = TestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request: 'sample' must be a non-empty string under 2000 chars.",
      });
      return;
    }
    const { sample, context } = parsed.data;
    const ctx: AiContext = context ?? { toolName: "AI Diagnostic Test" };

    const fallback = `Fallback echo (no AI key): I received "${sample.slice(0, 120)}" and would normally generate a thoughtful, coach-style reply here. The app stays fully usable in this mode.`;

    const result = await generate(
      {
        system: coachingPrompt(
          "This is a diagnostic test from the founder dashboard. Reply with one short, warm, on-brand sentence confirming the AI is wired up correctly and what you can help with. If context is provided, briefly acknowledge it.",
        ),
        user: sample,
        context: ctx,
        maxTokens: 160,
        temperature: 0.5,
      },
      fallback,
    );

    res.json(result);
  },
);

router.post(
  "/ai/enhance",
  rateLimit({ windowMs: 60_000, max: 20 }),
  async (req, res): Promise<void> => {
    const parsed = EnhanceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "toolName and prompt are required." });
      return;
    }
    const { toolName, prompt, context, expectJson } = parsed.data;
    const ctx: AiContext = context ?? { toolName };

    const fallback = `Coaching note for ${toolName}: Be specific and genuine — the most effective messages and profiles are honest, not strategic. Focus on what makes this moment or person unique, and respond to the actual situation rather than a template. Authenticity almost always outperforms a perfectly crafted line.`;

    const result = await generate(
      {
        system: coachingPrompt(
          toolPrompt(
            toolName,
            "Provide a thoughtful, specific coaching response based on the user's input. Be warm, direct, practical — never generic.",
          ),
        ),
        user: prompt,
        context: { ...ctx, toolName },
        maxTokens: 600,
        temperature: 0.6,
        expectJson,
      },
      fallback,
    );

    res.json(result);
  },
);

export default router;
