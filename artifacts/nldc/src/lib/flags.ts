/**
 * The green and red flag catalog. Naming what you bring to a relationship and
 * what you look for in a partner is its own read on standards and self-awareness,
 * and the result is a card worth sharing. Content lives here in the client; the
 * server stores only the stable ids picked, never any free text. Adding a flag is
 * a one-line edit here, no migration, since the lane counts distinct ids named
 * across both lists.
 *
 * Voice: no em dashes, no emojis, inclusive of all genders and orientations.
 */

export type FlagTone = "green" | "red";

export interface FlagDef {
  /** Stable id stored on the server. Never change an existing id. */
  id: string;
  /** Short label shown on the chips and the card. */
  label: string;
  /** green for things people offer or value, red for the dealbreakers. */
  tone: FlagTone;
}

// Green flags double as both what you bring and what you look for, so the two
// lists draw from the same green pool. Red flags are only ever things you want to
// avoid in a partner, so they appear in the "what you look out for" list.
export const GREEN_FLAGS: readonly FlagDef[] = [
  { id: "communicates-openly", label: "Communicates openly", tone: "green" },
  { id: "emotionally-available", label: "Emotionally available", tone: "green" },
  { id: "keeps-their-word", label: "Keeps their word", tone: "green" },
  { id: "secure-not-jealous", label: "Secure, not jealous", tone: "green" },
  { id: "good-to-strangers", label: "Kind to strangers", tone: "green" },
  { id: "owns-mistakes", label: "Owns their mistakes", tone: "green" },
  { id: "ambitious-grounded", label: "Ambitious but grounded", tone: "green" },
  { id: "curious-about-you", label: "Genuinely curious about you", tone: "green" },
  { id: "respects-boundaries", label: "Respects boundaries", tone: "green" },
  { id: "good-with-money", label: "Steady with money", tone: "green" },
  { id: "shows-up", label: "Shows up when it counts", tone: "green" },
  { id: "makes-you-laugh", label: "Makes you laugh", tone: "green" },
  { id: "own-friendships", label: "Has their own friendships", tone: "green" },
  { id: "calm-in-conflict", label: "Calm in conflict", tone: "green" },
  { id: "consistent-effort", label: "Consistent effort", tone: "green" },
  { id: "supports-your-growth", label: "Supports your growth", tone: "green" },
];

export const RED_FLAGS: readonly FlagDef[] = [
  { id: "hot-and-cold", label: "Runs hot and cold", tone: "red" },
  { id: "wont-define-it", label: "Will not define things", tone: "red" },
  { id: "poor-communicator", label: "Goes quiet under stress", tone: "red" },
  { id: "blames-everyone", label: "Blames everyone but themselves", tone: "red" },
  { id: "no-follow-through", label: "No follow through", tone: "red" },
  { id: "controlling", label: "Controlling", tone: "red" },
  { id: "dishonest", label: "Bends the truth", tone: "red" },
  { id: "still-hung-up", label: "Still hung up on an ex", tone: "red" },
  { id: "no-ambition", label: "No direction at all", tone: "red" },
  { id: "disrespects-others", label: "Rude to service staff", tone: "red" },
  { id: "love-bombs", label: "Comes on far too strong", tone: "red" },
  { id: "keeps-score", label: "Keeps score", tone: "red" },
];

export const ALL_FLAGS: readonly FlagDef[] = [...GREEN_FLAGS, ...RED_FLAGS];

const FLAG_BY_ID = new Map(ALL_FLAGS.map((f) => [f.id, f]));

export function flagById(id: string): FlagDef | undefined {
  return FLAG_BY_ID.get(id);
}

export function flagLabel(id: string): string {
  return FLAG_BY_ID.get(id)?.label ?? id;
}
