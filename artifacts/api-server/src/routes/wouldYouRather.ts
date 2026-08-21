import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, wyrAnswersTable } from "@workspace/db";
import { recordJourneyEvent } from "../lib/journeyEvents";
import { CreateWouldYouRatherAnswerBody } from "@workspace/api-zod";

const router: IRouter = Router();

type Row = typeof wyrAnswersTable.$inferSelect;

function serialize(row: Row) {
  return {
    promptId: row.promptId,
    choice: row.choice,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

router.get("/me/would-you-rather", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(wyrAnswersTable)
    .where(eq(wyrAnswersTable.userId, req.user.id))
    .orderBy(desc(wyrAnswersTable.createdAt))
    .limit(200);
  res.json(rows.map(serialize));
});

router.post("/me/would-you-rather", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateWouldYouRatherAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // One row per (user, prompt): answering the same prompt again updates the
  // choice in place so the distinct-prompt count that feeds readiness stays
  // honest. We store only which side was picked, never any free text.
  const [row] = await db
    .insert(wyrAnswersTable)
    .values({
      userId: req.user.id,
      promptId: parsed.data.promptId,
      choice: parsed.data.choice,
    })
    .onConflictDoUpdate({
      target: [wyrAnswersTable.userId, wyrAnswersTable.promptId],
      set: { choice: parsed.data.choice, updatedAt: new Date() },
    })
    .returning();
  void recordJourneyEvent({
    eventType: "signal_fed",
    userId: req.user.id,
    props: { source: "would-you-rather", promptId: parsed.data.promptId },
  });
  res.status(201).json(serialize(row));
});

export default router;
