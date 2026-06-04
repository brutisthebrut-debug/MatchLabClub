import {
  pgTable,
  serial,
  varchar,
  doublePrecision,
  jsonb,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * How the user reacted to their own chart read. This is the honest gold of the
 * cosmic layer: astrology is a mirror, not a verdict, so what a person says is
 * "so me" versus "not me at all" is a real calibration signal about how they
 * see themselves, regardless of whether the stars mean anything.
 */
export const COSMIC_REACTIONS = ["resonant", "mixed", "off"] as const;
export type CosmicReaction = (typeof COSMIC_REACTIONS)[number];

/**
 * Derived, stored read of a birth chart. The chart is computed deterministically
 * from birth date, time, and place (no external calls). We keep the placements
 * plus a small set of soft trait priors that map onto the same dimensions every
 * other signal uses (values, intent, communication, conflict). These are framed
 * and weighted as self-expression, never as destiny, and they only ever nudge.
 *
 * When birth time is unknown we fall back to a sun-only read: planet signs are
 * still meaningful but rising, midheaven, and houses are not computable, so we
 * mark the mode and leave those null rather than guess.
 */
export interface CosmicPlacements {
  mode: "full" | "sunOnly";
  sun: { sign: string; degree: number };
  moon: { sign: string; degree: number } | null;
  rising: { sign: string; degree: number } | null;
  midheaven: { sign: string } | null;
  bodies: { body: string; sign: string }[];
  /**
   * Soft self-expression priors, each 0..1. Derived from element and modality
   * balance across the chart. A read on how someone tends to express, not a
   * claim about who they are. Used only as a gentle, low-weight nudge.
   */
  traits: {
    novelty: number;
    stability: number;
    expression: number;
    depth: number;
  };
  elements: { fire: number; earth: number; air: number; water: number };
  modalities: { cardinal: number; fixed: number; mutable: number };
}

/**
 * One birth chart per person. Answering again updates in place (you only have
 * one birth moment), so the lane count stays honest. The route is authed-only;
 * signed-out visitors see a demo chart on the frontend and the real read after
 * they sign in.
 */
export const cosmicChartsTable = pgTable(
  "cosmic_charts",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** ISO date, "YYYY-MM-DD". */
    birthDate: varchar("birth_date", { length: 10 }).notNull(),
    /** "HH:MM" 24h, or null when the user does not know their birth time. */
    birthTime: varchar("birth_time", { length: 5 }),
    /** Human-readable place label the user picked, e.g. "New York, NY". */
    birthPlace: varchar("birth_place", { length: 160 }).notNull(),
    birthLat: doublePrecision("birth_lat").notNull(),
    birthLng: doublePrecision("birth_lng").notNull(),
    /** Deterministically computed placements and derived trait priors. */
    placements: jsonb("placements").$type<CosmicPlacements>().notNull(),
    /** How they reacted to their read. Null until they tell us. */
    reaction: varchar("reaction", { length: 16 }),
    /**
     * Whether the user opted into relocation-based matching. When true, their
     * astrocartography love-line cities widen who discovery can pair them with.
     * Off by default; one toggle turns it on or off and a trust-ledger purge
     * flips it back off without touching the chart itself.
     */
    relocationOpen: boolean("relocation_open").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cosmic_user_idx").on(t.userId)],
);

export const insertCosmicChartSchema = createInsertSchema(cosmicChartsTable, {
  birthDate: z.iso.date(),
  birthTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  birthPlace: z.string().trim().min(1).max(160),
  birthLat: z.number().min(-90).max(90),
  birthLng: z.number().min(-180).max(180),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  anonymousClaimToken: true,
  placements: true,
  reaction: true,
  relocationOpen: true,
});

export const updateCosmicRelocationSchema = z.object({
  open: z.boolean(),
});

export const updateCosmicReactionSchema = z.object({
  reaction: z.enum(COSMIC_REACTIONS),
});

export type InsertCosmicChart = z.infer<typeof insertCosmicChartSchema>;
export type CosmicChartRow = typeof cosmicChartsTable.$inferSelect;
