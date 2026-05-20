import { Router, type IRouter } from "express";
import { z } from "zod";
import { generate, getAiStatus, coachingPrompt, type AiContext } from "../lib/aiService";
import { requireFounder, rateLimit } from "../middlewares/founderAuth";

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

router.get("/ai/status", (_req, res) => {
  res.json(getAiStatus());
});

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

export default router;
