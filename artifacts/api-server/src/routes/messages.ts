import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, messageCoachingSessionsTable } from "@workspace/db";
import {
  CreateMessageCoachingSessionBody,
  CoachMessageParams,
  ListMessageCoachingSessionsResponse,
  CoachMessageResponse,
} from "@workspace/api-zod";
import { generateMessageCoaching } from "../lib/aiEngine";

const router: IRouter = Router();

router.get("/messages", async (req, res): Promise<void> => {
  const sessions = await db.select().from(messageCoachingSessionsTable).orderBy(messageCoachingSessionsTable.createdAt);
  res.json(ListMessageCoachingSessionsResponse.parse(sessions.map((s) => ({
    ...s,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
  }))));
});

router.post("/messages", async (req, res): Promise<void> => {
  const parsed = CreateMessageCoachingSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .insert(messageCoachingSessionsTable)
    .values({ ...parsed.data, status: "pending" })
    .returning();

  res.status(201).json({
    ...session,
    createdAt: session.createdAt instanceof Date ? session.createdAt.toISOString() : String(session.createdAt),
  });
});

router.post("/messages/:id/coach", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [session] = await db.select().from(messageCoachingSessionsTable).where(eq(messageCoachingSessionsTable.id, id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const coaching = generateMessageCoaching({
    matchName: session.matchName,
    conversationContext: session.conversationContext,
    yourLastMessage: session.yourLastMessage,
    goal: session.goal,
  });

  await db.update(messageCoachingSessionsTable)
    .set({ status: "complete" })
    .where(eq(messageCoachingSessionsTable.id, id));

  res.json(CoachMessageResponse.parse({ sessionId: id, ...coaching }));
});

export default router;
