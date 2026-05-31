// Deterministic "Echo's read on you for matching" synthesis.
//
// This is the always-on baseline for POST /me/matching/echo. It turns the
// user's REAL aggregate signal coverage into a plain-spoken read of what the
// machine can see about them and the kind of person it would put in front of
// them. It never touches raw content or PII: it works only from per-lane
// coverage, the registry's own plain-English signal lines, aggregate date
// outcomes, the chosen radius, and the readiness score. Claude is layered on
// top in the route (opt-in, daily-capped); when consent is off or a Claude
// call fails, this baseline is what ships.

export interface EchoMatchReadInput {
  /** Current Match Readiness score, 0-100. */
  score: number;
  /** Minimum score required to join the matching pool. */
  threshold: number;
  /** Whether the user is already at or above the threshold. */
  eligible: boolean;
  /**
   * Plain-English lines from `describeActiveSignals(breakdown)` for every lane
   * with coverage > 0. Already aggregate/derived, safe to surface.
   */
  activeSignalLines: string[];
  /** Registry lane ids with coverage > 0 (drives the ideal-match copy). */
  coveredLanes: string[];
  /** Total number of weighted lanes (drives the confidence ratio). */
  totalLanes: number;
  /** Aggregate date outcomes, never the underlying notes. */
  outcome: {
    totalDates: number;
    anotherDate: number;
    noMore: number;
    ghosted: number;
  };
  /** Stored search radius in km, or null for any distance. */
  radiusKm: number | null;
  /** The single highest-leverage next step toward readiness, if any. */
  nextAction: { label: string; href: string } | null;
}

export interface EchoMatchRead {
  headline: string;
  /** 0-100 read confidence, derived from coverage and score. */
  confidence: number;
  /** What Echo can see in the user's signals. */
  reading: string[];
  /** The kind of person Echo would put in front of them. */
  idealMatch: string[];
  /** Human radius label, e.g. "inside your 35-mile radius". */
  radiusLabel: string;
  /** Points still needed to reach the pool, 0 when already eligible. */
  gapToPool: number;
  /** Concrete next step toward a match. */
  nextStep: { label: string; href: string } | null;
}

// Lane id -> the kind of person that lane lets Echo reason about. Kept generic
// and grounded: it describes fit, never a specific individual, and never echoes
// back raw content.
const LANE_MATCH_COPY: Record<string, string> = {
  wellness:
    "Someone whose emotional depth can meet the parts of yourself you have already mapped.",
  compass:
    "A person whose instincts line up with what you have shown you are drawn to.",
  hingeImport:
    "Someone whose real-world dating rhythm fits the pace you actually keep.",
  postDate:
    "A match who clears the patterns your past dates keep surfacing.",
  journal:
    "Someone steady enough for the way you process things when you slow down and reflect.",
  wins:
    "A person who matches the momentum you have been building, not someone who stalls it.",
  calendar:
    "Someone whose week has room for you, so plans turn into real time together.",
  audits:
    "A match who reads your profile the way you intend it to land.",
  coaching:
    "Someone whose communication style meets the way you actually text.",
  instagram:
    "A person whose tone fits the public-facing version of you.",
  lifePulse:
    "Someone whose day-to-day energy sits close to yours.",
  taste:
    "A match who overlaps with what you genuinely enjoy, not a forced fit.",
  lifestyle:
    "Someone whose lifestyle and routines can actually share space with yours.",
};

const MILE_PER_KM = 0.621371;

function radiusLabelFromKm(km: number | null): string {
  if (km == null) return "anywhere we can reach";
  const miles = Math.round(km * MILE_PER_KM);
  return `inside your ${miles}-mile radius`;
}

function confidenceFrom(
  score: number,
  coveredLanes: number,
  totalLanes: number,
): number {
  const coverageRatio = totalLanes > 0 ? coveredLanes / totalLanes : 0;
  const raw = score * 0.5 + coverageRatio * 100 * 0.5;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function buildEchoMatchRead(input: EchoMatchReadInput): EchoMatchRead {
  const {
    score,
    threshold,
    eligible,
    activeSignalLines,
    coveredLanes,
    totalLanes,
    outcome,
    radiusKm,
    nextAction,
  } = input;

  const confidence = confidenceFrom(score, coveredLanes.length, totalLanes);
  const gapToPool = eligible ? 0 : Math.max(0, threshold - score);
  const radiusLabel = radiusLabelFromKm(radiusKm);

  const reading: string[] = [];
  if (activeSignalLines.length === 0) {
    reading.push(
      "Right now I barely know you. I can match you on the basics, but the read gets sharper the moment you feed me real signal.",
    );
  } else {
    reading.push(...activeSignalLines.slice(0, 4));
    if (outcome.totalDates > 0) {
      reading.push(
        `Across your last ${outcome.totalDates} date${outcome.totalDates === 1 ? "" : "s"}, ${outcome.anotherDate} led somewhere and ${outcome.ghosted + outcome.noMore} did not, which tells me what to steer you toward and away from.`,
      );
    }
  }

  const idealMatch: string[] = [];
  for (const lane of coveredLanes) {
    const copy = LANE_MATCH_COPY[lane];
    if (copy && !idealMatch.includes(copy)) idealMatch.push(copy);
    if (idealMatch.length >= 4) break;
  }
  if (idealMatch.length === 0) {
    idealMatch.push(
      "For now I would match you on the basics. Give me more and I get specific about who actually fits you.",
    );
  }

  const headline = eligible
    ? "Here is who I would put in front of you."
    : "Here is what I can see in you, and who it points to.";

  let nextStep = nextAction;
  if (eligible) {
    nextStep = {
      label: "Turn on your matching list to start getting intros",
      href: "/matching",
    };
  }

  return {
    headline,
    confidence,
    reading,
    idealMatch,
    radiusLabel,
    gapToPool,
    nextStep,
  };
}
