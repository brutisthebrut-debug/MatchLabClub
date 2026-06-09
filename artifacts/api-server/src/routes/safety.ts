import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  userReportsTable,
  userBlocksTable,
} from "@workspace/db";
import {
  ReportUserBody,
  BlockUserBody,
  ListSafetyBlocksResponse,
  UnblockUserResponse,
} from "@workspace/api-zod";
import { blockUserPair } from "../lib/userBlocks";

const router: IRouter = Router();

// File a report against another member. Reports are queued for founder review
// and never auto-act on the reported account. Reporting is deliberately
// decoupled from blocking: the client offers block as a separate, explicit step.
router.post("/me/safety/report", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = ReportUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const reporterUserId = req.user.id;
  const {
    reportedUserId,
    subjectType,
    externalApp,
    externalLabel,
    reason,
    context,
    note,
  } = parsed.data;

  const isOffPlatform = subjectType === "off_platform";

  if (isOffPlatform) {
    // Off-platform reports name no platform account. They come from the message
    // coach, where the other person lives on Hinge/Tinder/Bumble. We keep only
    // the derived context (app + label + note), never the raw conversation.
    const [row] = await db
      .insert(userReportsTable)
      .values({
        reporterUserId,
        reportedUserId: null,
        subjectType: "off_platform",
        externalApp: externalApp ?? null,
        externalLabel: externalLabel ?? null,
        reason,
        context: context ?? "conversation",
        note: note ?? null,
      })
      .returning({ id: userReportsTable.id });

    res.status(201).json({ ok: true, reportId: row.id });
    return;
  }

  if (!reportedUserId) {
    res
      .status(400)
      .json({ error: "A reported member is required for a member report" });
    return;
  }

  if (reportedUserId === reporterUserId) {
    res.status(400).json({ error: "You cannot report yourself" });
    return;
  }

  const [row] = await db
    .insert(userReportsTable)
    .values({
      reporterUserId,
      reportedUserId,
      subjectType: "member",
      reason,
      context: context ?? null,
      note: note ?? null,
    })
    .returning({ id: userReportsTable.id });

  res.status(201).json({ ok: true, reportId: row.id });
});

// Block another member. Blocking is a hard, symmetric gate in the matching
// engine (see loadBlockedUserIds in matching.ts): once a block exists in either
// direction the pair leaves the candidate pool entirely. Idempotent via the
// unique (blocker, blocked) index. Any existing internal proposals between the
// two people are removed in both directions so the block takes effect at once.
router.post("/me/safety/block", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = BlockUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const blockerUserId = req.user.id;
  const { blockedUserId, reason } = parsed.data;

  if (blockedUserId === blockerUserId) {
    res.status(400).json({ error: "You cannot block yourself" });
    return;
  }

  // Persist the block and clear any internal proposals between the two in both
  // directions (shared with the report-and-block path in connections.ts).
  await blockUserPair(blockerUserId, blockedUserId, reason ?? null);

  const [row] = await db
    .select({
      blockedUserId: userBlocksTable.blockedUserId,
      reason: userBlocksTable.reason,
      createdAt: userBlocksTable.createdAt,
    })
    .from(userBlocksTable)
    .where(
      and(
        eq(userBlocksTable.blockerUserId, blockerUserId),
        eq(userBlocksTable.blockedUserId, blockedUserId),
      ),
    )
    .limit(1);

  res.status(201).json({
    blockedUserId: row.blockedUserId,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  });
});

// List the members the caller has blocked, newest first.
router.get("/me/safety/block", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const rows = await db
    .select({
      blockedUserId: userBlocksTable.blockedUserId,
      reason: userBlocksTable.reason,
      createdAt: userBlocksTable.createdAt,
    })
    .from(userBlocksTable)
    .where(eq(userBlocksTable.blockerUserId, req.user.id))
    .orderBy(desc(userBlocksTable.createdAt));

  res.json(
    ListSafetyBlocksResponse.parse({
      blocks: rows.map((r) => ({
        blockedUserId: r.blockedUserId,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
    }),
  );
});

// Undo a block. Idempotent: removing a block that does not exist still returns
// ok. Re-minting of proposals happens naturally on the next discover/sweep.
router.delete(
  "/me/safety/block/:blockedUserId",
  async (req, res): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const blockedUserId = req.params.blockedUserId;
    await db
      .delete(userBlocksTable)
      .where(
        and(
          eq(userBlocksTable.blockerUserId, req.user.id),
          eq(userBlocksTable.blockedUserId, blockedUserId),
        ),
      );

    res.json(UnblockUserResponse.parse({ ok: true }));
  },
);

export default router;
