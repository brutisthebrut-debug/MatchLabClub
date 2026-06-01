import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, lifePulsesTable } from "@workspace/db";
import { RecordLifePulseBody } from "@workspace/api-zod";
import { getOrCreateAnonClaimToken, getAnonClaimToken } from "../lib/anonClaimToken";
import { recordJourneyEvent } from "../lib/journeyEvents";

const router: IRouter = Router();

function scope(req: Request): SQL {
  if (req.user?.id) return eq(lifePulsesTable.userId, req.user.id);
  const anon = getAnonClaimToken(req);
  if (anon) {
    return and(
      isNull(lifePulsesTable.userId),
      eq(lifePulsesTable.anonymousClaimToken, anon),
    ) as SQL;
  }
  return sql`false`;
}

function serialize(row: typeof lifePulsesTable.$inferSelect) {
  return {
    id: row.id,
    sleep: row.sleep,
    energy: row.energy,
    social: row.social,
    money: row.money,
    headspace: row.headspace,
    note: row.note,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

router.post("/life-pulse", async (req, res): Promise<void> => {
  const parsed = RecordLifePulseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user?.id ?? null;
  const anonymousClaimToken = userId ? null : getOrCreateAnonClaimToken(req, res);

  const [row] = await db
    .insert(lifePulsesTable)
    .values({
      ...parsed.data,
      note: parsed.data.note ?? null,
      userId,
      anonymousClaimToken,
    })
    .returning();

  void recordJourneyEvent({
    eventType: "signal_fed",
    userId: userId ?? null,
    anonId: anonymousClaimToken,
    props: { source: "life_pulse" },
  });

  res.status(201).json(serialize(row));
});

router.get("/life-pulse", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(lifePulsesTable)
    .where(scope(req))
    .orderBy(desc(lifePulsesTable.createdAt))
    .limit(30);

  const pulses = rows.map(serialize);
  res.json({
    pulses,
    latest: pulses[0] ?? null,
  });
});

export default router;
