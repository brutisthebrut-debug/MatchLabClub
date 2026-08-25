import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  careDialectProfilesTable,
  communicationRecordsTable,
  flagSelectionsTable,
  matchPoolMembershipTable,
  mirrorLearningEventsTable,
  mirrorLearningsTable,
  type MirrorLearningRow,
} from "@workspace/db";
import { loadMirrorPortrait } from "./mirror";
import { CARE_DIALECTS, isCareDialectKey } from "../lib/careDialect";

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

const CommunicationProposalBody = z.object({
  source: z.enum(["care_dialect", "standards", "connection_style", "personal_blueprint"]),
});

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

async function recordLearningEvent(
  row: MirrorLearningRow,
  action: string,
  prior?: MirrorLearningRow | null,
): Promise<void> {
  await db.insert(mirrorLearningEventsTable).values({
    userId: row.userId,
    learningId: row.id,
    action,
    sourceType: row.sourceType,
    sourceRef: row.sourceRef,
    sourceLabel: row.sourceLabel,
    priorStatus: prior?.status ?? null,
    newStatus: row.status,
    priorText: prior ? (prior.memberLearning ?? prior.proposedLearning) : null,
    newText: row.memberLearning ?? row.proposedLearning,
    confidence: row.confidence,
    matchingUseApproved: row.matchingUseApproved,
  });
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
      const [created] = await db.insert(mirrorLearningsTable).values({
        userId,
        sourceType: "mirror_portrait",
        sourceRef: theme.key,
        status: "proposed",
        matchingUseApproved: false,
        ...values,
      }).returning();
      if (created) await recordLearningEvent(created, "proposed");
    } else if (current.status === "proposed") {
      const [updated] = await db
        .update(mirrorLearningsTable)
        .set(values)
        .where(
          and(
            eq(mirrorLearningsTable.id, current.id),
            eq(mirrorLearningsTable.userId, userId),
          ),
        )
        .returning();
      if (updated && (
        updated.proposedLearning !== current.proposedLearning ||
        updated.confidence !== current.confidence
      )) await recordLearningEvent(updated, "source_refreshed", current);
    }
  }

  return db
    .select()
    .from(mirrorLearningsTable)
    .where(eq(mirrorLearningsTable.userId, userId))
    .orderBy(desc(mirrorLearningsTable.updatedAt));
}

async function upsertCommunicationProposal(
  userId: string,
  proposal: {
    sourceRef: string;
    sourceLabel: string;
    observation: string;
    proposedLearning: string;
    confidence: number;
  },
): Promise<MirrorLearningRow> {
  const [current] = await db
    .select()
    .from(mirrorLearningsTable)
    .where(
      and(
        eq(mirrorLearningsTable.userId, userId),
        eq(mirrorLearningsTable.sourceType, "relationship_language"),
        eq(mirrorLearningsTable.sourceRef, proposal.sourceRef),
      ),
    )
    .limit(1);
  if (current && current.status !== "proposed") return current;
  const now = new Date();
  if (current) {
    const [updated] = await db
      .update(mirrorLearningsTable)
      .set({ ...proposal, updatedAt: now })
      .where(
        and(
          eq(mirrorLearningsTable.id, current.id),
          eq(mirrorLearningsTable.userId, userId),
        ),
      )
      .returning();
    if (updated && (
      updated.proposedLearning !== current.proposedLearning ||
      updated.confidence !== current.confidence
    )) await recordLearningEvent(updated, "source_refreshed", current);
    return updated!;
  }
  const [created] = await db
    .insert(mirrorLearningsTable)
    .values({
      userId,
      sourceType: "relationship_language",
      status: "proposed",
      matchingUseApproved: false,
      ...proposal,
    })
    .returning();
  if (created) await recordLearningEvent(created, "proposed");
  return created!;
}

const TENSION_RULES = [
  { left: /move|open|invest|all-in|quick|fast/i, right: /slow|guard|hold back|distance|cautious/i, label: "Pace and protection" },
  { left: /steady|stable|consistent|predictable/i, right: /intensity|spark|unpredict|chase|excit/i, label: "Stability and intensity" },
  { left: /direct|name what|communicat.*open/i, right: /quiet|understate|hold.*back|withdraw/i, label: "Directness and reserve" },
] as const;

router.get("/me/mirror-trends", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.user.id;
  const [learnings, events] = await Promise.all([
    db.select().from(mirrorLearningsTable)
      .where(eq(mirrorLearningsTable.userId, userId))
      .orderBy(desc(mirrorLearningsTable.updatedAt)),
    db.select().from(mirrorLearningEventsTable)
      .where(eq(mirrorLearningEventsTable.userId, userId))
      .orderBy(desc(mirrorLearningEventsTable.createdAt))
      .limit(50),
  ]);
  const active = learnings.filter((row) => row.status !== "dismissed");
  const sources = active.map((row) => ({
    learningId: row.id,
    source: { type: row.sourceType, ref: row.sourceRef, label: row.sourceLabel },
    text: row.memberLearning ?? row.proposedLearning,
    status: row.status,
    confidence: row.confidence,
    matchingUseApproved: row.matchingUseApproved,
    updatedAt: iso(row.updatedAt),
  }));
  const uncertainties = active
    .filter((row) => row.status === "proposed" || row.confidence < 70)
    .map((row) => ({
      learningId: row.id,
      sourceLabel: row.sourceLabel,
      confidence: row.confidence,
      reason: row.status === "proposed"
        ? "This is still a proposal awaiting your confirmation or correction."
        : "This source has limited supporting signal.",
    }));
  const contradictions: Array<{
    label: string;
    left: { learningId: number; sourceLabel: string; text: string };
    right: { learningId: number; sourceLabel: string; text: string };
  }> = [];
  for (const rule of TENSION_RULES) {
    const left = active.find((row) => rule.left.test(row.memberLearning ?? row.proposedLearning));
    const right = active.find((row) => row.id !== left?.id && rule.right.test(row.memberLearning ?? row.proposedLearning));
    if (left && right) contradictions.push({
      label: rule.label,
      left: { learningId: left.id, sourceLabel: left.sourceLabel, text: left.memberLearning ?? left.proposedLearning },
      right: { learningId: right.id, sourceLabel: right.sourceLabel, text: right.memberLearning ?? right.proposedLearning },
    });
  }
  res.json({
    summary: {
      confirmed: learnings.filter((row) => row.status === "confirmed").length,
      inReview: learnings.filter((row) => row.status === "proposed").length,
      dismissed: learnings.filter((row) => row.status === "dismissed").length,
      headline: events.length === 0
        ? "Your current sources are visible. Change history will build as you review them."
        : `${events.length} learning change${events.length === 1 ? "" : "s"} are now traceable to their source.`,
    },
    sources,
    uncertainties,
    contradictions,
    changes: events.map((event) => ({
      id: event.id,
      learningId: event.learningId,
      action: event.action,
      source: { type: event.sourceType, ref: event.sourceRef, label: event.sourceLabel },
      priorStatus: event.priorStatus,
      newStatus: event.newStatus,
      priorText: event.priorText,
      newText: event.newText,
      confidence: event.confidence,
      matchingUseApproved: event.matchingUseApproved,
      createdAt: iso(event.createdAt),
    })),
  });
});

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

router.post(
  "/me/mirror-learnings/communication",
  async (req, res): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const parsed = CommunicationProposalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const userId = req.user.id;
    if (parsed.data.source === "care_dialect") {
      const [profile] = await db
        .select()
        .from(careDialectProfilesTable)
        .where(eq(careDialectProfilesTable.userId, userId))
        .limit(1);
      if (
        !profile ||
        !isCareDialectKey(profile.testedGiveTop) ||
        !isCareDialectKey(profile.testedReceiveTop)
      ) {
        res.status(422).json({
          error: "Complete your Care Dialect before sending it to review.",
        });
        return;
      }
      const give = CARE_DIALECTS[profile.testedGiveTop].name;
      const receive = CARE_DIALECTS[profile.testedReceiveTop].name;
      const giveWeight = profile.testedGiveDist?.[profile.testedGiveTop] ?? 0;
      const receiveWeight =
        profile.testedReceiveDist?.[profile.testedReceiveTop] ?? 0;
      const learning = await upsertCommunicationProposal(userId, {
        sourceRef: "care-dialect",
        sourceLabel: "Care Dialect",
        observation: `Your saved Care Dialect points to ${give} when giving care and ${receive} when receiving it.`,
        proposedLearning: `I tend to give care through ${give.toLowerCase()} and feel cared for most through ${receive.toLowerCase()}.`,
        confidence: Math.round(
          Math.max(0, Math.min(1, (giveWeight + receiveWeight) / 2)) * 100,
        ),
      });
      res.json(serialize(learning));
      return;
    }

    if (parsed.data.source === "connection_style" || parsed.data.source === "personal_blueprint") {
      const [record] = await db.select().from(communicationRecordsTable).where(and(
        eq(communicationRecordsTable.userId, userId),
        eq(communicationRecordsTable.lens, parsed.data.source),
      )).limit(1);
      if (!record) {
        res.status(422).json({
          error: parsed.data.source === "connection_style"
            ? "Complete your Connection Style lens before sending it to review."
            : "Complete your Personal Blueprint before sending it to review.",
        });
        return;
      }
      const result = record.result as Record<string, unknown>;
      const isStyle = parsed.data.source === "connection_style";
      const styleName = typeof result.name === "string" ? result.name : "saved connection pattern";
      const activation = typeof result.activationPattern === "string" ? result.activationPattern : "";
      const communication = typeof result.communicationStyle === "string" ? result.communicationStyle : "";
      const growth = typeof result.growthEdge === "string" ? result.growthEdge : "";
      const observation = isStyle
        ? `Your saved Connection Style lens identified ${styleName}. ${activation}`.trim()
        : `Your saved Personal Blueprint described this communication pattern: ${communication}`;
      const proposedLearning = isStyle
        ? `My current connection pattern is ${styleName}. ${activation}`.trim()
        : `${communication}${growth ? ` My current growth edge is: ${growth}` : ""}`;
      const learning = await upsertCommunicationProposal(userId, {
        sourceRef: isStyle ? "connection-style" : "personal-blueprint",
        sourceLabel: isStyle ? "Connection Style" : "Personal Blueprint",
        observation,
        proposedLearning,
        confidence: record.confidence,
      });
      res.json(serialize(learning));
      return;
    }

    const [flags] = await db
      .select()
      .from(flagSelectionsTable)
      .where(eq(flagSelectionsTable.userId, userId))
      .limit(1);
    const bring = flags?.bringFlags ?? [];
    const seek = flags?.seekFlags ?? [];
    if (bring.length === 0 && seek.length === 0) {
      res.status(422).json({
        error: "Name at least one relationship standard before sending it to review.",
      });
      return;
    }
    const humanize = (id: string) => id.replaceAll("-", " ");
    const bringText = bring.slice(0, 3).map(humanize).join(", ");
    const seekText = seek.slice(0, 3).map(humanize).join(", ");
    const pieces = [
      bringText ? `what you bring: ${bringText}` : null,
      seekText ? `what you seek or avoid: ${seekText}` : null,
    ].filter(Boolean);
    const proposed = [
      bringText ? `I aim to bring ${bringText}.` : null,
      seekText ? `I pay attention to ${seekText} in a partner.` : null,
    ].filter(Boolean);
    const learning = await upsertCommunicationProposal(userId, {
      sourceRef: "relationship-standards",
      sourceLabel: "Relationship standards",
      observation: `Your member-authored standards name ${pieces.join("; ")}.`,
      proposedLearning: proposed.join(" "),
      confidence: 100,
    });
    res.json(serialize(learning));
  },
);

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
  const eventAction = parsed.data.action === "set_matching"
    ? (parsed.data.approved ? "matching_approved" : "matching_revoked")
    : parsed.data.action;
  if (updated) await recordLearningEvent(updated, eventAction, current);
  if (pauseMatching) await pauseMatchingForLearningReview(userId);
  res.json(serialize(updated!));
});

export default router;
