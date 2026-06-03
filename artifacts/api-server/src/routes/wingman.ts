import { Router, type IRouter } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  usersTable,
  wingmanInvitesTable,
  wingmanAnswersTable,
  wingmanSelfRatingsTable,
} from "@workspace/db";
import {
  SetWingmanSelfRatingBody,
  CreateWingmanInviteBody,
  AnswerWingmanInviteBody,
} from "@workspace/api-zod";
import {
  signWingmanToken,
  verifyWingmanToken,
} from "../lib/wingmanToken";

const router: IRouter = Router();

const TRAITS = ["warmth", "humor", "drive", "openness", "steadiness"] as const;
type Trait = (typeof TRAITS)[number];

const TRAIT_LABELS: Record<Trait, string> = {
  warmth: "Warm and supportive",
  humor: "Funny and fun to be around",
  drive: "Driven and ambitious",
  openness: "Open and adventurous",
  steadiness: "Steady and dependable",
};

interface Ratings {
  warmth: number;
  humor: number;
  drive: number;
  openness: number;
  steadiness: number;
}

type SelfRow = typeof wingmanSelfRatingsTable.$inferSelect;
type AnswerRow = typeof wingmanAnswersTable.$inferSelect;
type InviteRow = typeof wingmanInvitesTable.$inferSelect;

function ratingsFrom(row: { [K in Trait]: number }): Ratings {
  return {
    warmth: row.warmth,
    humor: row.humor,
    drive: row.drive,
    openness: row.openness,
    steadiness: row.steadiness,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Orval emits `zod.number()` for OpenAPI `type: integer`, so the generated body
// schema accepts fractional values that would later fail at the integer DB
// column. We reject non-integers here for a clean 400 instead of a 500.
function allIntegers(scores: Ratings): boolean {
  return TRAITS.every((t) => Number.isInteger(scores[t]));
}

function serializeInvite(row: InviteRow) {
  const status = row.answeredAt ? "answered" : "pending";
  // Only pending invites carry a fresh signed link the owner can copy again.
  // Answered ones are done, so no token is re-minted.
  const path =
    status === "pending"
      ? `/wingman/r/${signWingmanToken(row.id).token}`
      : null;
  return {
    id: row.id,
    friendLabel: row.friendLabel ?? null,
    status,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    path,
  };
}

async function buildState(userId: string) {
  const [selfRows, answerRows, inviteRows] = await Promise.all([
    db
      .select()
      .from(wingmanSelfRatingsTable)
      .where(eq(wingmanSelfRatingsTable.userId, userId))
      .limit(1),
    db
      .select()
      .from(wingmanAnswersTable)
      .where(eq(wingmanAnswersTable.userId, userId)),
    db
      .select()
      .from(wingmanInvitesTable)
      .where(eq(wingmanInvitesTable.userId, userId))
      .orderBy(desc(wingmanInvitesTable.createdAt))
      .limit(200),
  ]);

  const selfRow = selfRows[0] as SelfRow | undefined;
  const selfRatings = selfRow ? ratingsFrom(selfRow) : null;

  const perspectives = answerRows.length;
  let friendAverages: Ratings | null = null;
  if (perspectives > 0) {
    const sums: Ratings = {
      warmth: 0,
      humor: 0,
      drive: 0,
      openness: 0,
      steadiness: 0,
    };
    for (const a of answerRows as AnswerRow[]) {
      for (const t of TRAITS) sums[t] += a[t];
    }
    friendAverages = {
      warmth: round1(sums.warmth / perspectives),
      humor: round1(sums.humor / perspectives),
      drive: round1(sums.drive / perspectives),
      openness: round1(sums.openness / perspectives),
      steadiness: round1(sums.steadiness / perspectives),
    };
  }

  // The gap is only meaningful once both sides exist: the user rated themselves
  // AND at least one friend weighed in. We surface it honestly, including which
  // trait diverges most, rather than smoothing it over.
  let gap: {
    warmth: number;
    humor: number;
    drive: number;
    openness: number;
    steadiness: number;
    largest: {
      trait: string;
      selfRating: number;
      friendRating: number;
      delta: number;
    };
  } | null = null;
  if (selfRatings && friendAverages) {
    const deltas = {
      warmth: round1(friendAverages.warmth - selfRatings.warmth),
      humor: round1(friendAverages.humor - selfRatings.humor),
      drive: round1(friendAverages.drive - selfRatings.drive),
      openness: round1(friendAverages.openness - selfRatings.openness),
      steadiness: round1(friendAverages.steadiness - selfRatings.steadiness),
    };
    let largestTrait: Trait = "warmth";
    for (const t of TRAITS) {
      if (Math.abs(deltas[t]) > Math.abs(deltas[largestTrait])) largestTrait = t;
    }
    gap = {
      ...deltas,
      largest: {
        trait: TRAIT_LABELS[largestTrait],
        selfRating: selfRatings[largestTrait],
        friendRating: friendAverages[largestTrait],
        delta: deltas[largestTrait],
      },
    };
  }

  return {
    perspectives,
    selfRatings,
    friendAverages,
    gap,
    invites: (inviteRows as InviteRow[]).map(serializeInvite),
  };
}

router.get("/me/wingman", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(await buildState(req.user.id));
});

router.put("/me/wingman/self", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = SetWingmanSelfRatingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const values = {
    warmth: parsed.data.warmth,
    humor: parsed.data.humor,
    drive: parsed.data.drive,
    openness: parsed.data.openness,
    steadiness: parsed.data.steadiness,
  };
  if (!allIntegers(values)) {
    res.status(400).json({ error: "Each rating must be a whole number 1 to 5" });
    return;
  }
  await db
    .insert(wingmanSelfRatingsTable)
    .values({ userId: req.user.id, ...values })
    .onConflictDoUpdate({
      target: wingmanSelfRatingsTable.userId,
      set: { ...values, updatedAt: new Date() },
    });
  res.json(await buildState(req.user.id));
});

router.post("/me/wingman/invites", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CreateWingmanInviteBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const friendLabel = parsed.data.friendLabel?.trim() || null;
  const [row] = await db
    .insert(wingmanInvitesTable)
    .values({ userId: req.user.id, friendLabel })
    .returning();
  res.status(201).json(serializeInvite(row));
});

// Public, no auth: a friend opens the signed link.
router.get("/wingman/invite/:token", async (req, res): Promise<void> => {
  const verified = verifyWingmanToken(req.params.token);
  if (!verified) {
    res.status(404).json({ error: "This link is invalid or has expired" });
    return;
  }
  const [invite] = await db
    .select()
    .from(wingmanInvitesTable)
    .where(eq(wingmanInvitesTable.id, verified.inviteId))
    .limit(1);
  if (!invite) {
    res.status(404).json({ error: "This link is invalid or has expired" });
    return;
  }
  const [owner] = await db
    .select({ firstName: usersTable.firstName })
    .from(usersTable)
    .where(eq(usersTable.id, invite.userId))
    .limit(1);
  res.json({
    inviterName: owner?.firstName?.trim() || "Your friend",
    answered: invite.answeredAt != null,
  });
});

// Public, no auth: a friend submits five 1-5 scores. Single-use, enforced by
// the invite's answeredAt stamp and the unique index on the answer row.
router.post("/wingman/invite/:token/answer", async (req, res): Promise<void> => {
  const verified = verifyWingmanToken(req.params.token);
  if (!verified) {
    res.status(404).json({ error: "This link is invalid or has expired" });
    return;
  }
  const parsed = AnswerWingmanInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [invite] = await db
    .select()
    .from(wingmanInvitesTable)
    .where(eq(wingmanInvitesTable.id, verified.inviteId))
    .limit(1);
  if (!invite) {
    res.status(404).json({ error: "This link is invalid or has expired" });
    return;
  }
  if (invite.answeredAt) {
    res.status(409).json({ error: "This invite was already answered" });
    return;
  }

  const scores = {
    warmth: parsed.data.warmth,
    humor: parsed.data.humor,
    drive: parsed.data.drive,
    openness: parsed.data.openness,
    steadiness: parsed.data.steadiness,
  };
  if (!allIntegers(scores)) {
    res.status(400).json({ error: "Each rating must be a whole number 1 to 5" });
    return;
  }

  // Stamp the invite as answered AND write the answer in one transaction, so the
  // single-use guard cannot consume an invite without recording a perspective.
  // The conditional stamp (answeredAt is null) means two friends racing the same
  // link cannot both write; if the answer insert fails, the whole transaction
  // rolls back and the invite stays answerable.
  const committed = await db.transaction(async (tx) => {
    const stamped = await tx
      .update(wingmanInvitesTable)
      .set({ answeredAt: new Date() })
      .where(
        and(
          eq(wingmanInvitesTable.id, invite.id),
          isNull(wingmanInvitesTable.answeredAt),
        ),
      )
      .returning({ id: wingmanInvitesTable.id });
    if (stamped.length === 0) return false;

    await tx.insert(wingmanAnswersTable).values({
      inviteId: invite.id,
      userId: invite.userId,
      ...scores,
    });
    return true;
  });

  if (!committed) {
    res.status(409).json({ error: "This invite was already answered" });
    return;
  }

  res.json({ ok: true });
});

export default router;
