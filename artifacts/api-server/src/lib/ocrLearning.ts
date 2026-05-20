import { db, ocrLearnedRulesTable, ocrRuleReviewLogTable, auditsTable } from "@workspace/db";
import { isNotNull, desc, sql, eq, and, inArray } from "drizzle-orm";
import type {
  OcrCorrectionsRecord,
  OcrCorrectionField,
  OcrLearnedRule,
} from "@workspace/db";
import type { SourceApp } from "./profileParser";
import { logger } from "./logger";
import { recordJobHeartbeat } from "./jobHeartbeat";

const OCR_LEARNING_JOB = "ocr_learning";

export interface LearnedRules {
  nameSubstitutions: Map<string, string>;
  sourceAppOverrides: Map<SourceApp, SourceApp>;
  promptAdditions: Set<string>;
}

export const EMPTY_LEARNED_RULES: LearnedRules = {
  nameSubstitutions: new Map(),
  sourceAppOverrides: new Map(),
  promptAdditions: new Set(),
};

const MIN_OCCURRENCES = Number(process.env.OCR_LEARNING_MIN_OCCURRENCES ?? 2);
const MAX_AUDITS_TO_SCAN = 5000;
const VALID_SOURCE_APPS: ReadonlySet<SourceApp> = new Set([
  "Hinge",
  "Bumble",
  "Tinder",
  "CoffeeMeetsBagel",
  "OkCupid",
]);

let cache: LearnedRules = EMPTY_LEARNED_RULES;

export function getCachedLearnedRules(): LearnedRules {
  return cache;
}

export function setLearnedRulesCacheForTests(rules: LearnedRules): void {
  cache = rules;
}

function normName(s: string): string {
  return s.trim().toLowerCase();
}

function normPrompt(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Reduce a prompt string to a short stable "question prefix" we can match
 * across audits even when users append different answers. We take the first
 * ~6 words (capped at 40 chars), which captures the prompt question itself
 * (e.g. "my new fav coffee shop is") without the user-specific tail.
 */
function promptPrefix(s: string): string {
  const norm = normPrompt(s);
  const words = norm.split(" ").slice(0, 6).join(" ");
  return words.slice(0, 40);
}

function asStringValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter((x) => x.length > 0);
  }
  return [];
}

function asSourceApp(v: unknown): SourceApp | null {
  const s = asStringValue(v);
  if (!s) return null;
  const lower = s.toLowerCase();
  for (const app of VALID_SOURCE_APPS) {
    if (app.toLowerCase() === lower) return app;
  }
  return null;
}

export interface RuleCandidate {
  kind: "nameSubstitution" | "sourceAppOverride" | "promptAddition";
  pattern: string;
  replacement: string;
  scope: string | null;
  occurrences: number;
}

/**
 * Pure aggregation: turn a stream of audit OCR-correction records into a
 * deduplicated list of candidate parser-improvement rules. Each candidate
 * carries the number of audits it was observed in; only those meeting the
 * minimum-occurrences threshold are promoted to learned rules.
 */
export function aggregateOcrCorrections(
  records: Array<{ corrections: OcrCorrectionsRecord | null }>,
  minOccurrences: number = MIN_OCCURRENCES,
): RuleCandidate[] {
  const nameCounts = new Map<string, { replacement: string; count: number }>();
  const sourceAppCounts = new Map<string, { replacement: SourceApp; count: number }>();
  const promptCounts = new Map<string, { exemplar: string; count: number }>();

  for (const rec of records) {
    const corr = rec.corrections;
    if (!corr) continue;

    if (corr.firstName) {
      const raw = asStringValue(corr.firstName.raw);
      const corrected = asStringValue(corr.firstName.corrected);
      if (raw && corrected && raw.toLowerCase() !== corrected.toLowerCase()) {
        const key = `${normName(raw)}\u0001${normName(corrected)}`;
        const existing = nameCounts.get(key);
        if (existing) existing.count += 1;
        else nameCounts.set(key, { replacement: corrected, count: 1 });
      }
    }

    if (corr.sourceApp) {
      const raw = asSourceApp(corr.sourceApp.raw);
      const corrected = asSourceApp(corr.sourceApp.corrected);
      if (raw && corrected && raw !== corrected) {
        const key = `${raw}\u0001${corrected}`;
        const existing = sourceAppCounts.get(key);
        if (existing) existing.count += 1;
        else sourceAppCounts.set(key, { replacement: corrected, count: 1 });
      }
    }

    if (corr.prompts) {
      const raw = asStringArray(corr.prompts.raw);
      const corrected = asStringArray(corr.prompts.corrected);
      const rawPrefixes = new Set(raw.map(promptPrefix));
      const seen = new Set<string>();
      for (const p of corrected) {
        const key = promptPrefix(p);
        if (!key || key.length < 10) continue;
        if (rawPrefixes.has(key)) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        const existing = promptCounts.get(key);
        if (existing) existing.count += 1;
        else promptCounts.set(key, { exemplar: key, count: 1 });
      }
    }
  }

  const out: RuleCandidate[] = [];

  for (const [key, { replacement, count }] of nameCounts) {
    if (count < minOccurrences) continue;
    const [raw] = key.split("\u0001");
    out.push({
      kind: "nameSubstitution",
      pattern: raw,
      replacement,
      scope: null,
      occurrences: count,
    });
  }
  for (const [key, { replacement, count }] of sourceAppCounts) {
    if (count < minOccurrences) continue;
    const [raw] = key.split("\u0001");
    out.push({
      kind: "sourceAppOverride",
      pattern: raw,
      replacement,
      scope: null,
      occurrences: count,
    });
  }
  for (const [key, { exemplar, count }] of promptCounts) {
    if (count < minOccurrences) continue;
    out.push({
      kind: "promptAddition",
      pattern: key,
      replacement: exemplar,
      scope: null,
      occurrences: count,
    });
  }

  return out;
}

function ruleId(c: { kind: string; pattern: string; scope: string | null }): string {
  return `${c.kind}:${c.scope ?? ""}:${c.pattern}`;
}

/**
 * Build the runtime cache shape from a list of approved persisted rules.
 */
export function buildLearnedRules(rules: OcrLearnedRule[]): LearnedRules {
  const result: LearnedRules = {
    nameSubstitutions: new Map(),
    sourceAppOverrides: new Map(),
    promptAdditions: new Set(),
  };
  for (const r of rules) {
    if (r.kind === "nameSubstitution") {
      result.nameSubstitutions.set(r.pattern, r.replacement);
    } else if (r.kind === "sourceAppOverride") {
      if (VALID_SOURCE_APPS.has(r.pattern as SourceApp) && VALID_SOURCE_APPS.has(r.replacement as SourceApp)) {
        result.sourceAppOverrides.set(r.pattern as SourceApp, r.replacement as SourceApp);
      }
    } else if (r.kind === "promptAddition") {
      result.promptAdditions.add(r.pattern);
    }
  }
  return result;
}

/**
 * Read the current APPROVED learned-rule rows from the DB and replace the cache.
 * Only approved rules affect parsing. Pending and rejected rules are ignored.
 * Safe to call at startup and after a learning run. Failures are logged
 * and leave the previous cache in place.
 */
export async function refreshLearnedRulesCache(): Promise<LearnedRules> {
  try {
    const rows = await db
      .select()
      .from(ocrLearnedRulesTable)
      .where(eq(ocrLearnedRulesTable.status, "approved"));
    cache = buildLearnedRules(rows);
    return cache;
  } catch (err) {
    logger.warn({ err }, "Failed to load OCR learned rules; keeping previous cache");
    return cache;
  }
}

/**
 * Read recent audits with OCR corrections, derive parser-improvement
 * candidates, and persist any that meet the threshold as PENDING (awaiting
 * founder review). Existing approved or rejected rules are not overwritten.
 *
 * @param options.limitToAuditIds - When provided, the scan is restricted to
 *   audits whose `id` is in this list. Intended for integration tests that
 *   need to scope this global-scan to their own seeded rows so parallel
 *   workers do not interfere with each other's assertions.
 */
export async function learnFromCorrections(options?: {
  limitToAuditIds?: number[];
}): Promise<{
  scannedAudits: number;
  candidates: RuleCandidate[];
  persisted: number;
}> {
  const { limitToAuditIds } = options ?? {};
  const scopeFilter =
    limitToAuditIds && limitToAuditIds.length > 0
      ? inArray(auditsTable.id, limitToAuditIds)
      : undefined;

  const rows = await db
    .select({
      ocrCorrections: auditsTable.ocrCorrections,
    })
    .from(auditsTable)
    .where(and(isNotNull(auditsTable.ocrCorrections), scopeFilter))
    .orderBy(desc(auditsTable.createdAt))
    .limit(MAX_AUDITS_TO_SCAN);

  const candidates = aggregateOcrCorrections(
    rows.map((r) => ({ corrections: r.ocrCorrections as OcrCorrectionsRecord | null })),
  );

  const now = new Date();
  let persisted = 0;
  for (const c of candidates) {
    const id = ruleId(c);
    await db
      .insert(ocrLearnedRulesTable)
      .values({
        id,
        kind: c.kind,
        pattern: c.pattern,
        replacement: c.replacement,
        scope: c.scope,
        occurrences: c.occurrences,
        status: "pending",
        learnedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: ocrLearnedRulesTable.id,
        set: {
          replacement: sql`CASE WHEN ${ocrLearnedRulesTable.status} = 'pending' THEN EXCLUDED.replacement ELSE ${ocrLearnedRulesTable.replacement} END`,
          occurrences: c.occurrences,
          updatedAt: now,
        },
      });
    persisted += 1;
  }

  await refreshLearnedRulesCache();
  await recordJobHeartbeat(OCR_LEARNING_JOB);

  return { scannedAudits: rows.length, candidates, persisted };
}

export async function listLearnedRules(): Promise<OcrLearnedRule[]> {
  return await db
    .select()
    .from(ocrLearnedRulesTable)
    .orderBy(desc(ocrLearnedRulesTable.occurrences), desc(ocrLearnedRulesTable.updatedAt));
}

export async function deleteLearnedRule(id: string): Promise<boolean> {
  const result = await db
    .delete(ocrLearnedRulesTable)
    .where(sql`${ocrLearnedRulesTable.id} = ${id}`)
    .returning({ id: ocrLearnedRulesTable.id });
  if (result.length === 0) return false;
  await refreshLearnedRulesCache();
  return true;
}

export async function listPendingRules(): Promise<OcrLearnedRule[]> {
  return await db
    .select()
    .from(ocrLearnedRulesTable)
    .where(eq(ocrLearnedRulesTable.status, "pending"))
    .orderBy(desc(ocrLearnedRulesTable.occurrences), desc(ocrLearnedRulesTable.updatedAt));
}

export async function approveOcrRule(id: string, reviewedBy: string): Promise<OcrLearnedRule | null> {
  const now = new Date();
  const [updated] = await db
    .update(ocrLearnedRulesTable)
    .set({ status: "approved", reviewedAt: now, reviewedBy, updatedAt: now })
    .where(eq(ocrLearnedRulesTable.id, id))
    .returning();
  if (!updated) return null;

  await db.insert(ocrRuleReviewLogTable).values({
    ruleId: id,
    action: "approved",
    reviewedBy,
    reviewedAt: now,
    kind: updated.kind,
    pattern: updated.pattern,
    replacement: updated.replacement,
  });

  await refreshLearnedRulesCache();
  return updated;
}

export async function rejectOcrRule(id: string, reviewedBy: string): Promise<OcrLearnedRule | null> {
  const now = new Date();
  const [updated] = await db
    .update(ocrLearnedRulesTable)
    .set({ status: "rejected", reviewedAt: now, reviewedBy, updatedAt: now })
    .where(eq(ocrLearnedRulesTable.id, id))
    .returning();
  if (!updated) return null;

  await db.insert(ocrRuleReviewLogTable).values({
    ruleId: id,
    action: "rejected",
    reviewedBy,
    reviewedAt: now,
    kind: updated.kind,
    pattern: updated.pattern,
    replacement: updated.replacement,
  });

  return updated;
}

export async function listOcrRuleReviewLog(limit = 50): Promise<typeof ocrRuleReviewLogTable.$inferSelect[]> {
  return await db
    .select()
    .from(ocrRuleReviewLogTable)
    .orderBy(desc(ocrRuleReviewLogTable.reviewedAt))
    .limit(limit);
}

export async function clearLearnedRules(): Promise<{ deleted: number; preserved: number }> {
  const preserved = await db
    .select({ id: ocrLearnedRulesTable.id })
    .from(ocrLearnedRulesTable)
    .where(eq(ocrLearnedRulesTable.status, "approved"));

  const result = await db
    .delete(ocrLearnedRulesTable)
    .where(sql`${ocrLearnedRulesTable.status} != 'approved'`)
    .returning({ id: ocrLearnedRulesTable.id });

  await refreshLearnedRulesCache();
  return { deleted: result.length, preserved: preserved.length };
}

export async function toggleOcrRuleApproved(
  id: string,
): Promise<OcrLearnedRule | null> {
  const [existing] = await db
    .select()
    .from(ocrLearnedRulesTable)
    .where(eq(ocrLearnedRulesTable.id, id));
  if (!existing) return null;

  const newStatus = existing.status === "approved" ? "pending" : "approved";
  const now = new Date();
  const [updated] = await db
    .update(ocrLearnedRulesTable)
    .set({ status: newStatus, updatedAt: now })
    .where(eq(ocrLearnedRulesTable.id, id))
    .returning();
  if (!updated) return null;

  await refreshLearnedRulesCache();
  return updated;
}
