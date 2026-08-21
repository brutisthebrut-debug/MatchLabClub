import type { ImportSource } from "@workspace/api-client-react";
import type { SavedQuizResult } from "@/lib/quizzes";

/**
 * Turn server-owned derived quiz rows into the catalog's compact result history.
 * The API already soft-deletes a prior row before a retake; the defensive slug
 * dedupe also protects the member view from historical or concurrent duplicates.
 * Raw answer choices never enter this model.
 */
export function quizResultsFromImports(
  imports: ImportSource[],
): SavedQuizResult[] {
  const newestFirst = imports
    .filter((row) => row.source === "quiz" && row.status === "complete")
    .slice()
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );

  const seen = new Set<string>();
  const results: SavedQuizResult[] = [];

  for (const row of newestFirst) {
    const summary = row.parsedSummary;
    if (!summary || typeof summary !== "object") continue;

    const slug = typeof summary.slug === "string" ? summary.slug.trim() : "";
    const archetypeKey =
      typeof summary.archetypeKey === "string"
        ? summary.archetypeKey.trim()
        : "";
    const archetypeName =
      typeof summary.archetype === "string" ? summary.archetype.trim() : "";

    if (!slug || !archetypeKey || !archetypeName || seen.has(slug)) continue;
    seen.add(slug);
    results.push({
      slug,
      archetypeKey,
      archetypeName,
      takenAt: row.uploadedAt,
    });
  }

  return results;
}
