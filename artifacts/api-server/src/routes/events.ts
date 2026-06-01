import { Router, type IRouter } from "express";
import { z } from "zod";
import { CLIENT_JOURNEY_EVENT_TYPES } from "@workspace/db";
import { recordJourneyEvent } from "../lib/journeyEvents";
import type { JourneyEventType } from "@workspace/db";

const router: IRouter = Router();

/**
 * Small, derived props only: short string keys mapped to scalar values. This is
 * deliberately narrow so the public beacon can never be used to smuggle large or
 * sensitive payloads into the events table.
 */
const PropsSchema = z
  .record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()]))
  .refine((obj) => Object.keys(obj).length <= 12, {
    message: "Too many props",
  });

const CaptureEventBody = z.object({
  eventType: z.enum(CLIENT_JOURNEY_EVENT_TYPES),
  anonId: z.string().trim().min(1).max(128).optional(),
  props: PropsSchema.optional(),
});

/**
 * Public, anon-safe journey event capture. Used by the web client to record the
 * two browser-observable steps the server cannot see on its own: visits and tool
 * completions. Authed callers are attributed by session; anonymous callers pass a
 * stable client id. Always returns 202 (fire-and-forget); a bad body is a no-op
 * 202 so a misbehaving client can never turn telemetry into user-facing errors.
 */
router.post("/events", async (req, res): Promise<void> => {
  const parsed = CaptureEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(202).json({ accepted: false });
    return;
  }
  const { eventType, anonId, props } = parsed.data;
  void recordJourneyEvent({
    eventType: eventType as JourneyEventType,
    userId: req.user?.id ?? null,
    anonId: anonId ?? null,
    props: props ?? null,
  });
  res.status(202).json({ accepted: true });
});

export default router;
