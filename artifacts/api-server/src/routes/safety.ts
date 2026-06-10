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
  CheckOutgoingMessageBody,
  CheckOutgoingMessageResponse,
} from "@workspace/api-zod";
import { blockUserPair } from "../lib/userBlocks";
import { analyzeScamSignals, type ScamCheckOutput } from "../lib/aiEngine";
import { generate } from "../lib/aiService";

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

// Pre-send safety nudge. Before a message goes out, the deterministic engine
// screens the draft (and any conversation context the client already shows the
// user) for romance-scam patterns with no key, no external call, and no rate
// limit, so the nudge is always available. When the deep AI lane is on and the
// deterministic screen already saw something worth a closer look, Claude
// refines the read for this specific draft; any failure, missing consent, or
// daily-cap hit silently keeps the deterministic baseline. A clean draft never
// reaches Claude, so it never burns a credit. This route stores nothing.
router.post("/me/safety/message-check", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = CheckOutgoingMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user.id;
  const { draft, conversationContext } = parsed.data;

  const deterministic: ScamCheckOutput = analyzeScamSignals({
    conversationText: conversationContext ?? "",
    yourLastMessage: draft,
  });
  let safety: ScamCheckOutput = deterministic;

  if (deterministic.risk !== "none") {
    const safetySystem = [
      "You are the MatchLab Club pre-send safety check. A user is about to send",
      "the message below in a dating conversation. Decide whether sending it",
      "would walk them into a romance scam: complying with a request for money,",
      "gift cards, or crypto; handing over sensitive personal or financial",
      "details; or being pushed off the app by someone who avoids verifying who",
      "they are. Weigh both the draft and the conversation so far.",
      "",
      "Be calm and non-accusatory. Most matches are not scammers. Never accuse;",
      "describe what you notice and what to do before they hit send. Return JSON",
      "only, no prose, no code fences, matching this shape exactly:",
      '{ "risk": "none | low | elevated",',
      '  "signals": ["short, specific things you noticed, or empty"],',
      '  "advice": "two or three calm sentences on whether to send and how to stay safe" }',
      "",
      "Voice rules: no em dashes. No filler words like 'unlock', 'leverage',",
      "'elevate', 'dive in', or 'in today's world'. Sound human.",
    ].join("\n");
    const safetyUser = [
      conversationContext
        ? `Conversation so far:\n${conversationContext}`
        : "No earlier conversation was provided.",
      `The message the user is about to send:\n${draft}`,
    ].join("\n\n");
    try {
      const aiSafety = await generate(
        {
          provider: "anthropic",
          system: safetySystem,
          user: safetyUser,
          expectJson: true,
          requireContentConsent: true,
          userId,
          context: { toolName: "Message Safety Check" },
          maxTokens: 600,
        },
        "",
      );
      if (!aiSafety.isFallback && aiSafety.validated && aiSafety.output) {
        safety = JSON.parse(aiSafety.output) as ScamCheckOutput;
      } else if (aiSafety.fallbackReason) {
        req.log.info(
          { fallbackReason: aiSafety.fallbackReason },
          "message safety check fell back to deterministic baseline",
        );
      }
    } catch (err) {
      safety = deterministic;
      req.log.warn(
        { err },
        "message safety deep-AI lane threw; using deterministic baseline",
      );
    }
  }

  res.json(CheckOutgoingMessageResponse.parse(safety));
});

export default router;
