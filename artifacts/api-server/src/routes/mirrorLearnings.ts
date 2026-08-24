import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  matchPoolMembershipTable,
  mirrorLearningsTable,
  type MirrorLearningRow,
} from "@workspace/db";
import { loadMirrorPortrait } from "./mirror";

const router: IRouter = Router();

const DecisionBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({
    action: z.literal("revise"),
    learning: z.string().trim().min(3).max(1200),
  }),
  z.object({ action: z.literal("dismiss") }),
  z.object({ action: z.literal("unconfirm") }),
  z.object({ action: z.literal("set_matching"), approved: z.boolean() }),
]);

function iso(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function serialize(row: MirrorLearningRow) {
  return {
    id: row.id,
    source: {
      type: row.sourceType,
      ref: row.sourceRef,
      label: row.sourceLabel,
    },
    observation: row.observation,
    proposedLearning: row.proposedLearning,
    memberLearning: row.memberLearning ?? null,
    status: row.status,
    confidence: row.confidence,
    matchingUseApproved: row.matchingUseApproved,
    confirmedAt: iso(row.confirmedAt),
    dismissedAt: iso(row.dismissedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function pauseMatchingForLearningReview(userId: string): Promise<void> {
  const [membership] = await db
    .select()
    .from(matchPoolMembershipTable)
    .where(eq(matchPoolMembershipTable.userId, userId))
    .limit(1);
  if (
    membership &&
    ["building", "ready", "concierge_only"].includes(membership.status)
  ) {
    await db
      .update(matchPoolMembershipTable)
      .set({
        status: "paused",
        pausedReason: "A matching-approved Mirror learning needs review.",
        updatedAt: new Date(),
      })
      .where(eq(matchPoolMembershipTable.userId, userId));
  }
}

/**
 * Pull the deterministic portrait's current working themes into the durable
 * review queue. Existing member decisions are never overwritten by a refresh.
 */
export async function syncPortraitProposals(userId: string): Promise<MirrorLearningRow[]> {
  const portrait = await loadMirrorPortrait(userId);
  const existing = await db
    .select()
    .from(mirrorLearningsTable)
    .where(eq(mirrorLearningsTable.userId, userId));
  const byRef = new Map(existing.map((row) => [row.sourceRef, row]));

  for (const theme of portrait.known) {
    const current = byRef.get(theme.key);
    const values = {
      sourceLabel: theme.label,
      observation: theme.insight,
      proposedLearning: theme.insight,
      confidence: Math.max(0, Math.min(100, Math.round(theme.confidence))),
      updatedAt: new Date(),
    };
    if (!current) {
      await db.insert(mirrorLearningsTable).values({
        userId,
        sourceType: "mirror_portrait",
        sourceRef: theme.key,
        status: "proposed",
        matchingUseApproved: false,
        ...values,
      });
    } else if (current.status === "proposed") {
      await db
        .update(mirrorLearningsTable)
        .set(values)
        .where(
          and(
            eq(mirrorLearningsTable.id, current.id),
            eq(mirrorLearningsTable.userId, userId),
          ),
        );
    }
  }

  return db
    .select()
    .from(mirrorLearningsTable)
    .where(eq(mirrorLearningsTable.userId, userId))
    .orderBy(desc(mirrorLearningsTable.updatedAt));
}

router.get("/me/mirror-learnings", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await db
    .select()
    .from(mirrorLearningsTable)
    .where(eq(mirrorLearningsTable.userId, req.user.id))
    .orderBy(desc(mirrorLearningsTable.updatedAt));
  res.json({ learnings: rows.map(serialize) });
});

router.post("/me/mirror-learnings/sync", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rows = await syncPortraitProposals(req.user.id);
  res.json({ learnings: rows.map(serialize) });
});

router.patch("/me/mirror-learnings/:id", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid learning id" });
    return;
  }
  const parsed = DecisionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user.id;
  const [current] = await db
    .select()
    .from(mirrorLearningsTable)
    .where(
      and(
        eq(mirrorLearningsTable.id, id),
        eq(mirrorLearningsTable.userId, userId),
      ),
    )
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Learning not found" });
    return;
  }

  const now = new Date();
  let updates: Partial<typeof mirrorLearningsTable.$inferInsert>;
  let pauseMatching = false;
  switch (parsed.data.action) {
    case "confirm":
      updates = {
        status: "confirmed",
        memberLearning: current.proposedLearning,
        matchingUseApproved: false,
        confirmedAt: now,
        dismissedAt: null,
        updatedAt: now,
      };
      break;
    case "revise":
      updates = {
        status: "proposed",
        proposedLearning: parsed.data.learning,
        memberLearning: null,
        matchingUseApproved: false,
        confirmedAt: null,
        dismissedAt: null,
        updatedAt: now,
      };
      pauseMatching = true;
      break;
    case "dismiss":
      updates = {
        status: "dismissed",
        memberLearning: null,
        matchingUseApproved: false,
        confirmedAt: null,
        dismissedAt: now,
        updatedAt: now,
      };
      pauseMatching = true;
      break;
    case "unconfirm":
      updates = {
        status: "proposed",
        memberLearning: null,
        matchingUseApproved: false,
        confirmedAt: null,
        dismissedAt: null,
        updatedAt: now,
      };
      pauseMatching = true;
      break;
    case "set_matching":
      if (parsed.data.approved && current.status !== "confirmed") {
        res.status(409).json({
          error: "Confirm this learning before approving matching use.",
        });
        return;
      }
      updates = { matchingUseApproved: parsed.data.approved, updatedAt: now };
      pauseMatching = current.matchingUseApproved && !parsed.data.approved;
      break;
  }

  const [updated] = await db
    .update(mirrorLearningsTable)
    .set(updates)
    .where(
      and(
        eq(mirrorLearningsTable.id, id),
        eq(mirrorLearningsTable.userId, userId),
      ),
    )
    .returning();
  if (pauseMatching) await pauseMatchingForLearningReview(userId);
  res.json(serialize(updated!));
});

export default router;

