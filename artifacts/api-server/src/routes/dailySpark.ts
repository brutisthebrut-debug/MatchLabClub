import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, dailySparkAnswersTable } from "@workspace/db";
import { recordJourneyEvent } from "../lib/journeyEvents";
import { CreateDailySparkAnswerBody } from "@workspace/api-zod";

const router: IRouter = Router();

type Row = typeof dailySparkAnswersTable.$inferSelect;

function serialize(row: Row) {
  return {
    questionId: row.questionId,
    choice: row.choice,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

router.get("/me/daily-spark", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(dailySparkAnswersTable)
    .where(eq(dailySparkAnswersTable.userId, req.user.id))
    .orderBy(desc(dailySparkAnswersTable.createdAt))
    .limit(400);
  res.json(rows.map(serialize));
});

router.post("/me/daily-spark", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateDailySparkAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // One row per (user, question): answering the same question again updates the
  // choice in place so the distinct-question count that feeds readiness stays
  // honest. We store only which option was picked, never any free text.
  const [row] = await db
    .insert(dailySparkAnswersTable)
    .values({
      userId: req.user.id,
      questionId: parsed.data.questionId,
      choice: parsed.data.choice,
    })
    .onConflictDoUpdate({
      target: [dailySparkAnswersTable.userId, dailySparkAnswersTable.questionId],
      set: { choice: parsed.data.choice, updatedAt: new Date() },
    })
    .returning();
  void recordJourneyEvent({
    eventType: "signal_fed",
    userId: req.user.id,
    props: { source: "daily-spark", questionId: parsed.data.questionId },
  });
  res.status(201).json(serialize(row));
});

export default router;
