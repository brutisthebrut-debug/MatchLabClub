import { Router, type IRouter } from "express";
import crypto from "crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, importedSourcesTable } from "@workspace/db";
import { AddReceiptsBody } from "@workspace/api-zod";
import { z } from "zod";
import {
  getAnonClaimToken,
  getOrCreateAnonClaimToken,
} from "../lib/anonClaimToken";
import { recordJourneyEvent } from "../lib/journeyEvents";

/**
 * Beat 2: the per-user "receipts" forwarding inbox.
 *
 * Every user gets a private address `{handle}@receipts.matchlab.club`. They
 * forward real-life confirmation emails (dinner reservations, concert tickets,
 * flight bookings, class sign-ups) there, OR paste the headers in by hand. Both
 * paths land in ONE accumulating row in `imported_sources` tagged
 * `source = "receipts"`, whose derived item count feeds the `receipts` lane of
 * the living signal registry, so it nudges Match Readiness, the Mirror, and
 * matching reasoning.
 *
 * The privacy contract is the whole point: we read and store ONLY the sender,
 * subject line, and time of each confirmation. The body of an email is never
 * accepted by the webhook, never stored, and never sent to any prompt. Scoring
 * reads only the running count; the capped `recent` list exists purely so the
 * user can see and purge what we hold.
 *
 * Anon-safe: with no signed-in user the row is scoped to the anonymous claim
 * token cookie, so an inbox started before signup merges into the account on
 * login, exactly like calendar and the paste connectors.
 */
const router: IRouter = Router();

const RECEIPTS_SOURCE = "receipts";
const RECEIPTS_DOMAIN = "receipts.matchlab.club";
/** How many most-recent confirmations we keep for the user's own review. */
const RECENT_CAP = 25;
const SUBJECT_MAX = 300;
const SENDER_MAX = 200;

interface StoredReceipt {
  sender: string | null;
  subject: string;
  receivedAt: string;
}

interface ReceiptsSummary {
  handle?: string;
  counts: { items: number };
  recent: StoredReceipt[];
}

interface ReceiptsInbox {
  handle: string | null;
  address: string | null;
  count: number;
  recent: StoredReceipt[];
}

function addressFor(handle: string | null): string | null {
  return handle ? `${handle}@${RECEIPTS_DOMAIN}` : null;
}

/** Coerce a Date or date-time string to an ISO string, falling back to now. */
function toIsoOrNow(value: Date | string | undefined, now: string): string {
  if (!value) return now;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? now : d.toISOString();
}

/** jsonb columns are typed as Record<string, unknown>; narrow our shape to it. */
function asJson(summary: ReceiptsSummary): Record<string, unknown> {
  return summary as unknown as Record<string, unknown>;
}

/** Defensive read of a stored receipts summary into a known shape. */
function normalizeSummary(raw: unknown): ReceiptsSummary {
  const s = (raw ?? {}) as {
    handle?: unknown;
    counts?: { items?: unknown };
    recent?: unknown;
  };
  const recent = Array.isArray(s.recent)
    ? (s.recent as StoredReceipt[]).filter(
        (r) => r && typeof r.subject === "string",
      )
    : [];
  return {
    handle: typeof s.handle === "string" ? s.handle : undefined,
    counts: { items: Number(s.counts?.items ?? 0) },
    recent,
  };
}

function inboxFromSummary(summary: ReceiptsSummary | null): ReceiptsInbox {
  if (!summary) {
    return { handle: null, address: null, count: 0, recent: [] };
  }
  const handle = summary.handle ?? null;
  return {
    handle,
    address: addressFor(handle),
    count: summary.counts.items,
    recent: summary.recent.slice(0, RECENT_CAP),
  };
}

/** 12-char hex handle. 48 bits of entropy, checked for collisions on mint. */
function mintHandle(): string {
  return crypto.randomBytes(6).toString("hex");
}

/**
 * The localpart of a forwarded "to" address must be one of our minted handles.
 * Accepts both `abc123@receipts.matchlab.club` and `Name <abc123@...>` forms.
 */
function handleFromTo(to: string): string | null {
  const m = to
    .toLowerCase()
    .match(/([a-f0-9]{12})@receipts\.matchlab\.club/);
  return m ? m[1]! : null;
}

function expectedWebhookSecret(): string {
  return (
    process.env.RECEIPTS_WEBHOOK_SECRET ??
    `receipts-${process.env.REPL_ID ?? "dev"}`
  );
}

function secretMatches(provided: string | undefined): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expectedWebhookSecret());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Newest-first merge with a hard cap and a fresh running count. */
function applyEntries(
  current: ReceiptsSummary,
  entries: StoredReceipt[],
): ReceiptsSummary {
  return {
    handle: current.handle,
    counts: { items: current.counts.items + entries.length },
    recent: [...entries, ...current.recent].slice(0, RECENT_CAP),
  };
}

/**
 * Canonical advisory-lock key for a receipts row, derived from its owner
 * identity. Every mutation path (manual paste, activate, inbound webhook) MUST
 * contend on the SAME key for the same row, or concurrent writes read the same
 * prior summary and overwrite each other, dropping entries and undercounting
 * `counts.items`. The inbound webhook resolves the owner by handle first so it
 * can compute this exact key.
 */
function ownerLockKey(
  userId: string | null | undefined,
  anonToken: string | null,
): string {
  return `receipts:${userId ?? anonToken}`;
}

type OwnerPredicate = ReturnType<typeof eq>;

/** Signed-in rows key off the user id; anon rows off the claim-token cookie. */
function ownerPredicate(
  userId: string | undefined,
  anonToken: string | null,
): OwnerPredicate {
  return userId
    ? eq(importedSourcesTable.userId, userId)
    : and(
        eq(importedSourcesTable.anonymousClaimToken, anonToken!),
        isNull(importedSourcesTable.userId),
      )!;
}

/** Ensure a globally-unique handle, retrying on the vanishingly rare clash. */
async function uniqueHandle(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  for (let i = 0; i < 5; i += 1) {
    const handle = mintHandle();
    const existing = await tx
      .select({ id: importedSourcesTable.id })
      .from(importedSourcesTable)
      .where(
        and(
          eq(importedSourcesTable.source, RECEIPTS_SOURCE),
          isNull(importedSourcesTable.deletedAt),
          sql`${importedSourcesTable.parsedSummary}->>'handle' = ${handle}`,
        ),
      )
      .limit(1);
    if (existing.length === 0) return handle;
  }
  // Astronomically unlikely; widen entropy rather than fail.
  return crypto.randomBytes(9).toString("hex");
}

/**
 * GET /api/me/receipts
 *
 * Returns the inbox state: forwarding handle/address, running count, and the
 * capped recent list (headers only). Anon-safe; null handle before activation.
 */
router.get("/me/receipts", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  const anonToken = userId ? null : (getAnonClaimToken(req) ?? null);
  if (!userId && !anonToken) {
    res.json(inboxFromSummary(null));
    return;
  }

  const [row] = await db
    .select({ parsedSummary: importedSourcesTable.parsedSummary })
    .from(importedSourcesTable)
    .where(
      and(
        ownerPredicate(userId, anonToken),
        eq(importedSourcesTable.source, RECEIPTS_SOURCE),
        isNull(importedSourcesTable.deletedAt),
      ),
    )
    .orderBy(desc(importedSourcesTable.uploadedAt))
    .limit(1);

  res.json(inboxFromSummary(row ? normalizeSummary(row.parsedSummary) : null));
});

/**
 * POST /api/me/receipts/activate
 *
 * Mints a forwarding handle if the user has none, otherwise returns the
 * existing one. Idempotent. Anon-safe.
 */
router.post("/me/receipts/activate", async (req, res): Promise<void> => {
  const userId = req.user?.id;
  const anonToken = userId ? null : getOrCreateAnonClaimToken(req, res);
  const owner = ownerPredicate(userId, anonToken);
  const lockKey = ownerLockKey(userId, anonToken);

  const summary = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`,
    );

    const [existing] = await tx
      .select({
        id: importedSourcesTable.id,
        parsedSummary: importedSourcesTable.parsedSummary,
      })
      .from(importedSourcesTable)
      .where(
        and(
          owner,
          eq(importedSourcesTable.source, RECEIPTS_SOURCE),
          isNull(importedSourcesTable.deletedAt),
        ),
      )
      .orderBy(desc(importedSourcesTable.uploadedAt))
      .limit(1);

    if (existing) {
      const current = normalizeSummary(existing.parsedSummary);
      if (current.handle) return current;
      const next: ReceiptsSummary = {
        ...current,
        handle: await uniqueHandle(tx),
      };
      await tx
        .update(importedSourcesTable)
        .set({ parsedSummary: asJson(next) })
        .where(eq(importedSourcesTable.id, existing.id));
      return next;
    }

    const next: ReceiptsSummary = {
      handle: await uniqueHandle(tx),
      counts: { items: 0 },
      recent: [],
    };
    await tx.insert(importedSourcesTable).values({
      userId: userId ?? null,
      anonymousClaimToken: anonToken,
      source: RECEIPTS_SOURCE,
      status: "complete",
      parsedSummary: asJson(next),
    });
    return next;
  });

  res.json(inboxFromSummary(summary));
});

/**
 * POST /api/me/receipts
 *
 * Manual import path: add confirmations by their headers (subject required,
 * sender and time optional). Accumulates into the single receipts row, auto
 * activating a handle on first use. The body of an email is never accepted.
 */
router.post("/me/receipts", async (req, res): Promise<void> => {
  const parsed = AddReceiptsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date().toISOString();
  const entries: StoredReceipt[] = parsed.data.entries
    .map((e) => ({
      subject: e.subject.trim().slice(0, SUBJECT_MAX),
      sender: e.sender?.trim().slice(0, SENDER_MAX) || null,
      receivedAt: toIsoOrNow(e.receivedAt, now),
    }))
    .filter((e) => e.subject.length > 0);

  if (entries.length === 0) {
    res
      .status(400)
      .json({ error: "At least one entry with a subject is required." });
    return;
  }

  const userId = req.user?.id;
  const anonToken = userId ? null : getOrCreateAnonClaimToken(req, res);
  const owner = ownerPredicate(userId, anonToken);
  const lockKey = ownerLockKey(userId, anonToken);

  const summary = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`,
    );

    const [existing] = await tx
      .select({
        id: importedSourcesTable.id,
        parsedSummary: importedSourcesTable.parsedSummary,
      })
      .from(importedSourcesTable)
      .where(
        and(
          owner,
          eq(importedSourcesTable.source, RECEIPTS_SOURCE),
          isNull(importedSourcesTable.deletedAt),
        ),
      )
      .orderBy(desc(importedSourcesTable.uploadedAt))
      .limit(1);

    if (existing) {
      const next = applyEntries(normalizeSummary(existing.parsedSummary), entries);
      if (!next.handle) next.handle = await uniqueHandle(tx);
      await tx
        .update(importedSourcesTable)
        .set({ parsedSummary: asJson(next) })
        .where(eq(importedSourcesTable.id, existing.id));
      return next;
    }

    const next = applyEntries(
      { handle: await uniqueHandle(tx), counts: { items: 0 }, recent: [] },
      entries,
    );
    await tx.insert(importedSourcesTable).values({
      userId: userId ?? null,
      anonymousClaimToken: anonToken,
      source: RECEIPTS_SOURCE,
      status: "complete",
      parsedSummary: asJson(next),
    });
    return next;
  });

  void recordJourneyEvent({
    eventType: "signal_fed",
    userId: userId ?? null,
    anonId: anonToken,
    props: { source: RECEIPTS_SOURCE, via: "manual" },
  });

  res.status(201).json(inboxFromSummary(summary));
});

/**
 * Inbound webhook body. We deliberately model ONLY the headers; any body/text
 * fields a provider might also post are ignored and never read.
 */
const InboundReceiptSchema = z.object({
  to: z.string().min(1).max(320),
  from: z.string().max(SENDER_MAX).optional(),
  subject: z.string().min(1).max(2000),
  date: z.string().optional(),
});

/**
 * POST /api/receipts/inbound
 *
 * Server-to-server webhook an email provider calls when a confirmation lands at
 * a `{handle}@receipts.matchlab.club` address. Authenticated by a shared secret
 * header, NOT by a user session. We resolve the handle back to its owning row
 * and accumulate one header-only entry. The email body is never in scope. We
 * return 202 even when the handle is unknown so the endpoint never leaks which
 * handles exist.
 */
router.post("/receipts/inbound", async (req, res): Promise<void> => {
  if (!secretMatches(req.header("x-receipts-secret"))) {
    res.status(401).json({ error: "Invalid webhook secret." });
    return;
  }

  const parsed = InboundReceiptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const handle = handleFromTo(parsed.data.to);
  if (!handle) {
    res.status(202).json({ received: false });
    return;
  }

  const entry: StoredReceipt = {
    subject: parsed.data.subject.trim().slice(0, SUBJECT_MAX),
    sender: parsed.data.from?.trim().slice(0, SENDER_MAX) || null,
    receivedAt:
      parsed.data.date && !Number.isNaN(Date.parse(parsed.data.date))
        ? new Date(parsed.data.date).toISOString()
        : new Date().toISOString(),
  };
  if (entry.subject.length === 0) {
    res.status(202).json({ received: false });
    return;
  }

  // Resolve the owning row by handle first (no lock) purely to derive the
  // canonical owner lock key, so this webhook contends on the SAME advisory
  // lock as the manual-paste and activate paths for this row. The authoritative
  // read and update then happen under that lock inside the transaction.
  const [owner] = await db
    .select({
      userId: importedSourcesTable.userId,
      anonymousClaimToken: importedSourcesTable.anonymousClaimToken,
    })
    .from(importedSourcesTable)
    .where(
      and(
        eq(importedSourcesTable.source, RECEIPTS_SOURCE),
        isNull(importedSourcesTable.deletedAt),
        sql`${importedSourcesTable.parsedSummary}->>'handle' = ${handle}`,
      ),
    )
    .limit(1);

  if (!owner) {
    res.status(202).json({ received: false });
    return;
  }

  const lockKey = ownerLockKey(owner.userId, owner.anonymousClaimToken);

  const matched = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`,
    );

    const [row] = await tx
      .select({
        id: importedSourcesTable.id,
        userId: importedSourcesTable.userId,
        anonymousClaimToken: importedSourcesTable.anonymousClaimToken,
        parsedSummary: importedSourcesTable.parsedSummary,
      })
      .from(importedSourcesTable)
      .where(
        and(
          eq(importedSourcesTable.source, RECEIPTS_SOURCE),
          isNull(importedSourcesTable.deletedAt),
          sql`${importedSourcesTable.parsedSummary}->>'handle' = ${handle}`,
        ),
      )
      .limit(1);

    if (!row) return null;

    const next = applyEntries(normalizeSummary(row.parsedSummary), [entry]);
    await tx
      .update(importedSourcesTable)
      .set({ parsedSummary: asJson(next) })
      .where(eq(importedSourcesTable.id, row.id));
    return {
      userId: row.userId,
      anonId: row.anonymousClaimToken,
      count: next.counts.items,
    };
  });

  if (!matched) {
    res.status(202).json({ received: false });
    return;
  }

  void recordJourneyEvent({
    eventType: "signal_fed",
    userId: matched.userId,
    anonId: matched.anonId,
    props: { source: RECEIPTS_SOURCE, via: "forward" },
  });

  req.log.info(
    { handle, count: matched.count },
    "Captured forwarded receipt header",
  );

  res.status(202).json({ received: true });
});

export default router;
