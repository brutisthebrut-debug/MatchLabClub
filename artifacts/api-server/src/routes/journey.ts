import { Router, type IRouter } from "express";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, journalEntriesTable, postDateNotesTable } from "@workspace/db";
import { summarizeUserJourney } from "../lib/journeyEvents";

const router: IRouter = Router();

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

router.get("/me/journey/record", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const requestedView = typeof req.query.view === "string" ? req.query.view : "active";
  if (requestedView !== "active" && requestedView !== "trash") {
    res.status(400).json({ error: "Invalid Journey view" });
    return;
  }
  const userId = req.user.id;
  const [journalEntries, dateNotes] = await Promise.all([
    db.select().from(journalEntriesTable).where(and(
      eq(journalEntriesTable.userId, userId),
      requestedView === "trash" ? isNotNull(journalEntriesTable.deletedAt) : isNull(journalEntriesTable.deletedAt),
    )).orderBy(desc(journalEntriesTable.createdAt)),
    db.select().from(postDateNotesTable).where(and(
      eq(postDateNotesTable.userId, userId),
      requestedView === "trash" ? isNotNull(postDateNotesTable.deletedAt) : isNull(postDateNotesTable.deletedAt),
    )).orderBy(desc(postDateNotesTable.dateAt), desc(postDateNotesTable.createdAt)),
  ]);

  const records = [
    ...journalEntries.map((entry) => ({
      id: `reflection:${entry.id}`,
      kind: "reflection" as const,
      source: { type: "journal_entry", id: entry.id, label: "Journal" },
      title: entry.prompt?.trim() || "Reflection",
      body: entry.body,
      details: {
        prompt: entry.prompt ?? null,
        tags: entry.tags ?? [],
        mood: entry.mood ?? null,
      },
      occurredAt: iso(entry.createdAt),
      updatedAt: iso(entry.updatedAt),
      href: `/mirror/journal?entry=${entry.id}`,
    })),
    ...dateNotes.map((note) => ({
      id: `date:${note.id}`,
      kind: "date" as const,
      source: { type: "post_date_note", id: note.id, label: "Date debrief" },
      title: note.personLabel?.trim() ? `Date with ${note.personLabel}` : "Post-date note",
      body: note.summary,
      details: {
        dateAt: note.dateAt ? iso(note.dateAt) : null,
        personLabel: note.personLabel ?? null,
        platform: note.platform ?? null,
        outcome: note.outcome ?? null,
        whatWentWell: note.whatWentWell ?? "",
        whatDidnt: note.whatDidnt ?? "",
        followUpPlanned: Boolean(note.followUpPlanned),
      },
      occurredAt: iso(note.dateAt ?? note.createdAt),
      updatedAt: iso(note.updatedAt),
      href: `/mirror/dates?note=${note.id}`,
    })),
  ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  res.json({
    summary: {
      total: records.length,
      reflections: journalEntries.length,
      dates: dateNotes.length,
      headline: requestedView === "trash"
        ? (records.length === 0 ? "Nothing is waiting to be restored." : `${records.length} removed moment${records.length === 1 ? "" : "s"} can still be restored.`)
        : (records.length === 0
          ? "Your Journey will build from the moments you choose to keep."
          : `${records.length} saved moment${records.length === 1 ? "" : "s"} now share one dependable thread.`),
    },
    records,
  });
});

// The signed-in user's own weekly momentum recap. This remains a small derived
// operating summary; the canonical member record above owns saved content.
router.get("/me/journey/summary", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const summary = await summarizeUserJourney(req.user.id);
  res.json(summary);
});

export default router;
