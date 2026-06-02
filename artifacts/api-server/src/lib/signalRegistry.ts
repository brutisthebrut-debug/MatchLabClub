/**
 * The living signal registry.
 *
 * Every readiness/matching signal the product knows about is described here
 * once, as data, instead of being hand-wired into readiness math, the matching
 * prompt, and the UI separately. Adding a new signal source (a connector, a
 * quiz, an import) means adding one entry to SIGNAL_REGISTRY: its weight,
 * normalization, the wellness dimensions it informs, a plain-English line for
 * the matching prompt, and its "do this next" action copy. Readiness, the
 * matching prompt, and the next-action list all read from this one place, so a
 * new signal flows everywhere at once and the algorithm incorporates it without
 * a rewrite.
 *
 * This module is pure and DB-free so it can be unit-tested without a
 * connection. The route does the counting against the database; everything here
 * is deterministic math and copy.
 */

/** Per-signal readiness coverage, 0-100, keyed by contributor id. */
export interface ReadinessBreakdown {
  compass: number;
  journal: number;
  wellness: number;
  hingeImport: number;
  postDate: number;
  wins: number;
  calendar: number;
  audits: number;
  coaching: number;
  instagram: number;
  lifePulse: number;
  taste: number;
  lifestyle: number;
  quizzes: number;
  receipts: number;
  music: number;
  vitality: number;
  curiosity: number;
  film: number;
  reading: number;
}

/** Raw counts pulled from the database for each contributor. */
export interface SignalCounts {
  /** Compatibility compass reads. */
  compass: number;
  /** Journal entries with a substantive body (lazy one-liners excluded). */
  journal: number;
  /** Distinct wellness dimensions answered (out of 18). */
  wellnessDistinct: number;
  /** GDPR imported sources tagged "hinge". */
  hingeImport: number;
  /** Post-date notes the user actually reflected on (outcome or reflection). */
  postDateReflected: number;
  /** Logged dating wins. */
  wins: number;
  /**
   * Events in the most recent pasted calendar (.ics) import. A fuller calendar
   * reads as a fuller life outside dating; only the derived count is used here,
   * never the raw events or titles.
   */
  calendarEvents: number;
  /** Profile audits the user has generated a report for (self-presentation). */
  audits: number;
  /** Message coaching sessions worked through (communication style). */
  coaching: number;
  /** Instagram tone pastes imported (public-facing voice). Binary in practice. */
  instagram: number;
  /** Life pulse check-ins logged (energy and headspace over time). */
  lifePulse: number;
  /**
   * Taste items shared in the most recent taste paste (music, film, shows,
   * books, the things they love). Only the derived item count is used here,
   * never the raw titles.
   */
  tasteItems: number;
  /**
   * Lifestyle items shared in the most recent lifestyle paste (how they spend
   * a normal week, the activities and rituals that matter). Only the derived
   * item count is used here, never the raw text.
   */
  lifestyleItems: number;
  /**
   * Distinct quizzes the user has completed. Each completion stores only its
   * derived result (which quiz, which archetype), never the raw answer choices,
   * and retakes of the same quiz are deduped so the count is distinct quizzes.
   */
  quizzesCompleted: number;
  /**
   * Real-life confirmations the user has forwarded to their private receipts
   * address or pasted in (dinners, trips, shows, classes), accumulated in one
   * receipts row. Only the running item count is read here, never the sender,
   * subject, or any email body.
   */
  receiptItems: number;
  /**
   * Music taste items shared in the most recent music paste (top artists,
   * tracks, the sound they keep coming back to), pulled from a Spotify export or
   * typed by hand. Only the derived item count is used here, never the titles.
   */
  musicItems: number;
  /**
   * Vitality items shared in the most recent health paste (workouts, sleep
   * rhythm, the way they keep their energy up), pulled from an Apple Health
   * export or typed by hand. Only the derived item count is used here, never any
   * underlying health record.
   */
  vitalityItems: number;
  /**
   * Curiosity items shared in the most recent interests paste (what they search,
   * watch, and follow), pulled from a Google Takeout export or typed by hand.
   * Only the derived item count is used here, never the raw history.
   */
  curiosityItems: number;
  /**
   * Film items shared in the most recent film paste (the films and shows they
   * love), pulled from a Letterboxd export or typed by hand. Only the derived
   * item count is used here, never the raw titles or ratings.
   */
  filmItems: number;
  /**
   * Reading items shared in the most recent reading paste (the books and authors
   * they return to), pulled from a Goodreads export or typed by hand. Only the
   * derived item count is used here, never the raw shelves or ratings.
   */
  readingItems: number;
}

/**
 * How a raw count converts to 0-100 coverage. "count" reaches full coverage at
 * `denominator` units; "binary" is all-or-nothing (any presence is full).
 */
export type SignalNormalizer =
  | { kind: "count"; denominator: number }
  | { kind: "binary" };

/**
 * Where a contributor's raw count comes from. This is the data-to-signal half
 * of the pipeline contract: the route reads it to know how to count a source,
 * so adding an import or paste connector is a registry entry plus a capture
 * route, with no hand-edited counting logic.
 *
 * - `firstParty`: a bespoke query against a dedicated table (compass, journal,
 *   wellness, etc.). The route owns the query, keyed by contributor id.
 * - `importRows`: count of `imported_sources` rows with this `source`. Used by
 *   binary "you imported it or you didn't" sources (Hinge, Instagram tone).
 * - `importSummaryCount`: a numeric count read out of the latest
 *   `imported_sources` row's `parsedSummary` JSON at `summaryPath`. Used by
 *   sources whose strength is "how much did you share" (calendar events, taste
 *   items, lifestyle items). Only the derived number is ever read, never the
 *   raw content the summary was built from.
 *
 * `capture: "paste"` marks a source the generic paste capture endpoint is
 * allowed to write. The endpoint derives its allowlist from these entries, so a
 * new paste connector needs no route allowlist edit.
 */
export type SignalDataSource =
  | { kind: "firstParty" }
  | { kind: "importRows"; source: string; capture?: "paste" }
  | {
      kind: "importSummaryCount";
      source: string;
      summaryPath: readonly [string, string];
      capture?: "paste";
    };

export interface SignalContributor {
  /** Stable key, also the key used in ReadinessBreakdown. */
  id: keyof ReadinessBreakdown;
  /** Which field of SignalCounts holds this contributor's raw count. */
  countKey: keyof SignalCounts;
  /** How the route turns data into this contributor's raw count. */
  dataSource: SignalDataSource;
  /** Human label. */
  label: string;
  /**
   * Wellness dimensions this signal informs. The wellness center is the spine:
   * every signal maps onto these so the machine reasons in one shared space.
   */
  dimensions: string[];
  /**
   * Default relative weight. Weights are auto-normalized across the registry,
   * so adding or removing a contributor never breaks the sum-to-one invariant
   * and you never have to re-balance the others by hand.
   */
  weight: number;
  /** Rough confidence (0-1) in this signal's predictive value for matching. */
  confidence: number;
  /** How the raw count becomes coverage. */
  normalize: SignalNormalizer;
  /**
   * Optional freshness half-life in days. Reserved for time-aware scoring; not
   * applied to the day-one deterministic readiness number.
   */
  decayHalfLifeDays?: number;
  /** Plain-English line for the matching prompt, given current coverage. */
  describe: (coverage: number) => string;
  /** UI "do this next" copy. */
  action: { label: string; detail: string; href: string };
  /**
   * The consent contract surfaced in the visible trust ledger. This is the
   * promise made felt: where this source's data comes from, what the machine
   * sees from it, and what it never touches. Living here means a newly
   * registered signal carries its own contract into the ledger automatically,
   * with no separate copy to maintain.
   */
  trust: {
    /** Where this signal's data comes from, in plain language. */
    origin: string;
    /** Singular noun for one stored unit, e.g. "read", "note", "import". */
    noun: string;
    /** What the machine sees from this source. */
    seen: string[];
    /** What the machine never touches from this source. */
    neverTouched: string[];
  };
}

/**
 * The registry. Order is spine-first (wellness leads). Default weights sum to
 * 1.0 so today's readiness number is reproduced exactly; normalization keeps
 * that true as the registry grows.
 */
export const SIGNAL_REGISTRY: readonly SignalContributor[] = [
  {
    id: "wellness",
    countKey: "wellnessDistinct",
    dataSource: { kind: "firstParty" },
    label: "Wellness dimensions",
    dimensions: ["all 18 wellness dimensions"],
    weight: 0.22,
    confidence: 0.9,
    normalize: { kind: "count", denominator: 18 },
    describe: (c) =>
      `Has mapped ${c}% of their wellness profile across the 18 dimensions, so their values and needs read fuller than a bio.`,
    action: {
      label: "Answer a few wellness prompts",
      detail: "Cover more of the 18 dimensions so your profile reads fuller.",
      href: "/wellness",
    },
    trust: {
      origin: "The wellness prompts you answer in the Profile Builder.",
      noun: "dimension",
      seen: [
        "The answers you write across the 18 wellness dimensions",
        "How many distinct dimensions you have covered",
      ],
      neverTouched: [
        "Anything you have not answered",
        "Any source beyond what you type into the prompts",
      ],
    },
  },
  {
    id: "compass",
    countKey: "compass",
    dataSource: { kind: "firstParty" },
    label: "Compass reads",
    dimensions: ["compatibility instincts", "what they are drawn to"],
    weight: 0.2,
    confidence: 0.8,
    normalize: { kind: "count", denominator: 5 },
    decayHalfLifeDays: 120,
    describe: (c) =>
      `Has run enough compatibility reads to cover ${c}% of that lane, so we have real signal on who they lean toward.`,
    action: {
      label: "Run a compass read",
      detail:
        "Score someone you are already talking to. Each read adds real signal.",
      href: "/compatibility-compass",
    },
    trust: {
      origin: "The compatibility reads you run in the Compass.",
      noun: "read",
      seen: [
        "The details you enter for each compatibility read",
        "The fit scores those reads produce",
      ],
      neverTouched: [
        "The other person's account, photos, or contact details",
        "Anyone you have not chosen to read",
      ],
    },
  },
  {
    id: "hingeImport",
    countKey: "hingeImport",
    dataSource: { kind: "importRows", source: "hinge" },
    label: "Hinge import",
    dimensions: ["real-world dating behavior", "texting style"],
    weight: 0.16,
    confidence: 0.7,
    normalize: { kind: "binary" },
    decayHalfLifeDays: 180,
    describe: () =>
      `Imported their Hinge history, so we can see how they actually talk and behave on a dating app, not just how they describe themselves.`,
    action: {
      label: "Import your Hinge data",
      detail: "One export fills a whole signal lane at once.",
      href: "/imports",
    },
    trust: {
      origin: "The Hinge data export you upload yourself.",
      noun: "import",
      seen: [
        "Patterns in how you talk and behave on the app",
        "That you imported an export, used to fill the lane",
      ],
      neverTouched: [
        "Your Hinge login or any live account access",
        "Anything from the export you did not upload",
      ],
    },
  },
  {
    id: "postDate",
    countKey: "postDateReflected",
    dataSource: { kind: "firstParty" },
    label: "Post-date notes",
    dimensions: ["what actually fits in person", "date outcomes"],
    weight: 0.16,
    confidence: 0.85,
    normalize: { kind: "count", denominator: 3 },
    decayHalfLifeDays: 120,
    describe: (c) =>
      `Has reflected on enough real dates to cover ${c}% of that lane, so we know what fits them in person, not just on paper.`,
    action: {
      label: "Add a post-date note",
      detail:
        "Reflect on a recent date. Outcomes teach the engine what fits you.",
      href: "/mirror/dates",
    },
    trust: {
      origin: "The post-date notes you write after a date.",
      noun: "note",
      seen: [
        "Your reflections on how a date went",
        "The outcome you logged for each one",
      ],
      neverTouched: [
        "Your date's identity or contact details",
        "Any date you have not written about",
      ],
    },
  },
  {
    id: "journal",
    countKey: "journal",
    dataSource: { kind: "firstParty" },
    label: "Journal entries",
    dimensions: ["self-awareness", "how they process feelings"],
    weight: 0.14,
    confidence: 0.6,
    normalize: { kind: "count", denominator: 10 },
    describe: (c) =>
      `Has journaled enough to cover ${c}% of that lane, so we have a read on their self-awareness and how they process things.`,
    action: {
      label: "Write a journal entry",
      detail: "A real reflection counts. One-liners do not.",
      href: "/mirror/journal",
    },
    trust: {
      origin: "The journal entries you write yourself.",
      noun: "entry",
      seen: [
        "The reflections you choose to write",
        "How many substantive entries you have kept",
      ],
      neverTouched: [
        "Anything outside the entries you write here",
        "Entries you have deleted",
      ],
    },
  },
  {
    id: "wins",
    countKey: "wins",
    dataSource: { kind: "firstParty" },
    label: "Dating wins",
    dimensions: ["courage", "momentum"],
    weight: 0.12,
    confidence: 0.5,
    normalize: { kind: "count", denominator: 5 },
    decayHalfLifeDays: 90,
    describe: (c) =>
      `Has logged enough wins to cover ${c}% of that lane, a read on their momentum and willingness to put themselves out there.`,
    action: {
      label: "Log a dating win",
      detail:
        "Small moments of courage count as signal now, not just a private note.",
      href: "/progress/wins",
    },
    trust: {
      origin: "The dating wins you log as they happen.",
      noun: "win",
      seen: [
        "The wins you choose to record",
        "How many you have logged, a read on momentum",
      ],
      neverTouched: [
        "Anything you have not logged",
        "Wins you have deleted",
      ],
    },
  },
  {
    id: "calendar",
    countKey: "calendarEvents",
    dataSource: {
      kind: "importSummaryCount",
      source: "calendar-ics",
      summaryPath: ["counts", "totalEvents"],
    },
    label: "Calendar rhythm",
    dimensions: [
      "how full their life is outside dating",
      "when they actually have room to date",
    ],
    weight: 0.1,
    confidence: 0.55,
    normalize: { kind: "count", denominator: 12 },
    decayHalfLifeDays: 45,
    describe: (c) =>
      `Has shared enough of their calendar to cover ${c}% of that lane, so we can see how full their week is and when they actually have room to date.`,
    action: {
      label: "Paste your calendar",
      detail: "Drop in your .ics export. We read your rhythm, never the raw file.",
      href: "/imports",
    },
    trust: {
      origin: "The calendar .ics text you paste in yourself.",
      noun: "event",
      seen: [
        "A simple count of events, used to read your weekly rhythm",
      ],
      neverTouched: [
        "Anything you do not paste in",
        "OAuth access to Google or Apple Calendar",
        "Any ability to create, edit, or delete events on your calendar",
      ],
    },
  },
  {
    id: "receipts",
    countKey: "receiptItems",
    dataSource: {
      kind: "importSummaryCount",
      source: "receipts",
      summaryPath: ["counts", "items"],
    },
    label: "Real-life receipts",
    dimensions: [
      "how full their life is outside dating",
      "the kinds of things they actually show up for",
    ],
    weight: 0.1,
    confidence: 0.5,
    normalize: { kind: "count", denominator: 12 },
    decayHalfLifeDays: 60,
    describe: (c) =>
      `Has forwarded enough confirmations to cover ${c}% of that lane, so we can read the rhythm of what they actually do, the dinners, trips, shows, and classes, never the contents of any email.`,
    action: {
      label: "Forward your receipts",
      detail:
        "Send booking and confirmation emails to your private receipts address, or paste them in. We read the sender, subject, and time, never the body.",
      href: "/receipts",
    },
    trust: {
      origin:
        "Confirmation emails you forward to your private receipts address, or paste in yourself.",
      noun: "receipt",
      seen: [
        "The sender, subject line, and time of each confirmation, used to read your real-life rhythm",
      ],
      neverTouched: [
        "The body of any email",
        "Anything you do not forward or paste in",
        "Your inbox itself, we never connect to your email account",
      ],
    },
  },
  {
    id: "audits",
    countKey: "audits",
    dataSource: { kind: "firstParty" },
    label: "Profile audits",
    dimensions: ["self-presentation", "how their profile actually reads"],
    weight: 0.16,
    confidence: 0.75,
    normalize: { kind: "count", denominator: 3 },
    describe: (c) =>
      `Has run enough profile audits to cover ${c}% of that lane, so we know how they present themselves and where their profile is sharp or soft.`,
    action: {
      label: "Run a profile audit",
      detail:
        "Scan your profile or a screenshot. Each audit teaches the engine how you show up.",
      href: "/scan",
    },
    trust: {
      origin: "The profile text or screenshots you scan yourself.",
      noun: "audit",
      seen: [
        "The profile text you submit and the audit results it produced",
        "Extracted text from any screenshot you scanned",
      ],
      neverTouched: [
        "Your screenshot images, which are read in the moment and never stored",
        "Any profile you did not scan",
      ],
    },
  },
  {
    id: "coaching",
    countKey: "coaching",
    dataSource: { kind: "firstParty" },
    label: "Message coaching",
    dimensions: ["how they communicate", "texting style"],
    weight: 0.12,
    confidence: 0.65,
    normalize: { kind: "count", denominator: 5 },
    decayHalfLifeDays: 120,
    describe: (c) =>
      `Has worked through enough message coaching to cover ${c}% of that lane, so we can see how they actually communicate, not just how they describe it.`,
    action: {
      label: "Coach a conversation",
      detail:
        "Paste a chat and get real reply options. Each session is signal on your style.",
      href: "/coach",
    },
    trust: {
      origin: "The conversations you paste into Message Coach.",
      noun: "session",
      seen: [
        "The thread you paste and the reply options it generated",
        "How many sessions you have run, a read on your style",
      ],
      neverTouched: [
        "Any party's name or contact details",
        "Conversations you have not pasted in",
      ],
    },
  },
  {
    id: "instagram",
    countKey: "instagram",
    dataSource: { kind: "importRows", source: "instagram-paste" },
    label: "Instagram tone",
    dimensions: ["public-facing personality", "tone of voice"],
    weight: 0.1,
    confidence: 0.6,
    normalize: { kind: "binary" },
    decayHalfLifeDays: 180,
    describe: () =>
      `Has shared their Instagram tone, so we have a read on their public-facing personality and voice beyond the dating apps.`,
    action: {
      label: "Share your Instagram tone",
      detail: "Paste a few captions. We read the tone, never your account.",
      href: "/me",
    },
    trust: {
      origin: "The captions you paste in yourself.",
      noun: "import",
      seen: [
        "The tone and voice read from the captions you paste",
        "That you shared a tone sample, used to fill the lane",
      ],
      neverTouched: [
        "Your Instagram login or any live account access",
        "Anything you did not paste in",
      ],
    },
  },
  {
    id: "lifePulse",
    countKey: "lifePulse",
    dataSource: { kind: "firstParty" },
    label: "Life pulse",
    dimensions: [
      "energy and headspace over time",
      "when they have room to date",
    ],
    weight: 0.08,
    confidence: 0.55,
    normalize: { kind: "count", denominator: 7 },
    decayHalfLifeDays: 30,
    describe: (c) =>
      `Has logged enough life pulses to cover ${c}% of that lane, a read on their energy and headspace over time, which shapes when they are ready to date.`,
    action: {
      label: "Log a life pulse",
      detail:
        "A quick check-in on sleep, energy, and headspace. Patterns become signal.",
      href: "/mirror",
    },
    trust: {
      origin: "The quick check-ins you log over time.",
      noun: "check-in",
      seen: [
        "Your sleep, energy, and headspace check-ins",
        "The rhythm across them, a read on when you have room to date",
      ],
      neverTouched: [
        "Any health app, wearable, or account",
        "Anything beyond the check-ins you log here",
      ],
    },
  },
  {
    id: "taste",
    countKey: "tasteItems",
    dataSource: {
      kind: "importSummaryCount",
      source: "taste-paste",
      summaryPath: ["counts", "items"],
      capture: "paste",
    },
    label: "Taste signature",
    dimensions: [
      "cultural taste",
      "what they actually love",
      "shared-interest fit",
    ],
    weight: 0.08,
    confidence: 0.55,
    normalize: { kind: "count", denominator: 6 },
    describe: (c) =>
      `Has shared enough of their taste to cover ${c}% of that lane, so we can match on cultural overlap and the things they actually love, not just a prompt answer.`,
    action: {
      label: "Share your taste",
      detail:
        "List the music, film, shows, and books you love. We read the overlap, never judge the list.",
      href: "/connections/add/taste",
    },
    trust: {
      origin: "The taste list you paste in, one item per line.",
      noun: "item",
      seen: [
        "The list of taste items you paste in, one per line",
        "A simple count of how many you gave us, used to fill the lane",
      ],
      neverTouched: [
        "Anything you do not paste in",
        "OAuth access to Spotify, Netflix, Letterboxd, or any account",
        "Your raw items are never sent to any AI prompt, only the count moves your readiness",
      ],
    },
  },
  {
    id: "lifestyle",
    countKey: "lifestyleItems",
    dataSource: {
      kind: "importSummaryCount",
      source: "lifestyle-paste",
      summaryPath: ["counts", "items"],
      capture: "paste",
    },
    label: "Lifestyle rhythm",
    dimensions: [
      "how they spend a normal week",
      "lifestyle and pace",
      "shared-activity fit",
    ],
    weight: 0.07,
    confidence: 0.55,
    normalize: { kind: "count", denominator: 5 },
    describe: (c) =>
      `Has described enough of their week to cover ${c}% of that lane, so we can match on lifestyle and shared-activity fit, not just looks on paper.`,
    action: {
      label: "Describe your lifestyle",
      detail:
        "List the activities and rituals that make up a normal week. We read the rhythm, never the detail.",
      href: "/connections/add/lifestyle",
    },
    trust: {
      origin: "The lifestyle list you paste in, one item per line.",
      noun: "item",
      seen: [
        "The list of lifestyle items you paste in, one per line",
        "A simple count of how many you gave us, used to fill the lane",
      ],
      neverTouched: [
        "Anything you do not paste in",
        "OAuth access to your calendar, fitness apps, or any account",
        "Your raw items are never sent to any AI prompt, only the count moves your readiness",
      ],
    },
  },
  {
    id: "music",
    countKey: "musicItems",
    dataSource: {
      kind: "importSummaryCount",
      source: "music-paste",
      summaryPath: ["counts", "items"],
      capture: "paste",
    },
    label: "Music taste",
    dimensions: [
      "music taste",
      "mood and energy",
      "shared-listening fit",
    ],
    weight: 0.06,
    confidence: 0.55,
    normalize: { kind: "count", denominator: 8 },
    describe: (c) =>
      `Has shared enough of their music to cover ${c}% of that lane, so we can match on the sound someone keeps coming back to, a strong read on mood and conversation chemistry.`,
    action: {
      label: "Share your music taste",
      detail:
        "Paste your top artists and tracks, or your Spotify export. We read the overlap, never your account.",
      href: "/connections/add/music",
    },
    trust: {
      origin: "The music list you paste in, or the Spotify export you drop in.",
      noun: "item",
      seen: [
        "The list of artists and tracks you paste in, one per line",
        "A simple count of how many you gave us, used to fill the lane",
      ],
      neverTouched: [
        "Anything you do not paste in",
        "OAuth access to Spotify or any account",
        "Your raw items are never sent to any AI prompt, only the count moves your readiness",
      ],
    },
  },
  {
    id: "film",
    countKey: "filmItems",
    dataSource: {
      kind: "importSummaryCount",
      source: "film-paste",
      summaryPath: ["counts", "items"],
      capture: "paste",
    },
    label: "Film taste",
    dimensions: [
      "film taste",
      "emotional palette",
      "what a night in looks like",
    ],
    weight: 0.06,
    confidence: 0.55,
    normalize: { kind: "count", denominator: 8 },
    describe: (c) =>
      `Has shared enough of their film taste to cover ${c}% of that lane, so we can match on humour and the kind of stories that move them, not just a prompt answer.`,
    action: {
      label: "Share your film taste",
      detail:
        "Paste the films and shows you love, or your Letterboxd export. We read the overlap, never judge the list.",
      href: "/connections/add/film",
    },
    trust: {
      origin: "The film list you paste in, or the Letterboxd export you drop in.",
      noun: "item",
      seen: [
        "The list of films and shows you paste in, one per line",
        "A simple count of how many you gave us, used to fill the lane",
      ],
      neverTouched: [
        "Anything you do not paste in",
        "OAuth access to Letterboxd, Netflix, or any account",
        "Your raw items are never sent to any AI prompt, only the count moves your readiness",
      ],
    },
  },
  {
    id: "reading",
    countKey: "readingItems",
    dataSource: {
      kind: "importSummaryCount",
      source: "reading-paste",
      summaryPath: ["counts", "items"],
      capture: "paste",
    },
    label: "Reading taste",
    dimensions: [
      "reading taste",
      "curiosity and values",
      "inner life",
    ],
    weight: 0.05,
    confidence: 0.55,
    normalize: { kind: "count", denominator: 6 },
    describe: (c) =>
      `Has shared enough of their reading to cover ${c}% of that lane, a quiet read on curiosity and values that deepens how we reason about fit.`,
    action: {
      label: "Share your reading",
      detail:
        "Paste the books and authors you return to, or your Goodreads export. We read the overlap, never the shelves.",
      href: "/connections/add/reading",
    },
    trust: {
      origin: "The reading list you paste in, or the Goodreads export you drop in.",
      noun: "item",
      seen: [
        "The list of books and authors you paste in, one per line",
        "A simple count of how many you gave us, used to fill the lane",
      ],
      neverTouched: [
        "Anything you do not paste in",
        "OAuth access to Goodreads, Amazon, or any account",
        "Your raw items are never sent to any AI prompt, only the count moves your readiness",
      ],
    },
  },
  {
    id: "curiosity",
    countKey: "curiosityItems",
    dataSource: {
      kind: "importSummaryCount",
      source: "curiosity-paste",
      summaryPath: ["counts", "items"],
      capture: "paste",
    },
    label: "Curiosity trail",
    dimensions: [
      "intellectual curiosity",
      "what holds their attention",
      "interests",
    ],
    weight: 0.05,
    confidence: 0.5,
    normalize: { kind: "count", denominator: 8 },
    describe: (c) =>
      `Has shared enough of what they are curious about to cover ${c}% of that lane, so we can match on the interests and rabbit holes that actually hold their attention.`,
    action: {
      label: "Share your interests",
      detail:
        "Paste what you search, watch, and follow, or your Google Takeout summary. We read the themes, never the raw history.",
      href: "/connections/add/curiosity",
    },
    trust: {
      origin:
        "The interests list you paste in, or the Google Takeout summary you drop in.",
      noun: "item",
      seen: [
        "The list of interests and topics you paste in, one per line",
        "A simple count of how many you gave us, used to fill the lane",
      ],
      neverTouched: [
        "Anything you do not paste in",
        "OAuth access to Google, YouTube, or any account",
        "Your raw items are never sent to any AI prompt, only the count moves your readiness",
      ],
    },
  },
  {
    id: "vitality",
    countKey: "vitalityItems",
    dataSource: {
      kind: "importSummaryCount",
      source: "vitality-paste",
      summaryPath: ["counts", "items"],
      capture: "paste",
    },
    label: "Vitality rhythm",
    dimensions: [
      "energy and vitality",
      "weekly movement rhythm",
      "how they care for themselves",
    ],
    weight: 0.05,
    confidence: 0.5,
    normalize: { kind: "count", denominator: 6 },
    describe: (c) =>
      `Has shared enough of their vitality rhythm to cover ${c}% of that lane, a read on energy and weekly cadence that helps pace a real connection.`,
    action: {
      label: "Share your vitality rhythm",
      detail:
        "Paste your workout and rest rhythm, or your Apple Health summary. We read the cadence, never any health record.",
      href: "/connections/add/vitality",
    },
    trust: {
      origin:
        "The rhythm list you paste in, or the Apple Health summary you drop in.",
      noun: "item",
      seen: [
        "The list of activities and rhythms you paste in, one per line",
        "A simple count of how many you gave us, used to fill the lane",
      ],
      neverTouched: [
        "Anything you do not paste in",
        "Any underlying health record, vitals, or medical detail",
        "Your raw items are never sent to any AI prompt, only the count moves your readiness",
      ],
    },
  },
  {
    id: "quizzes",
    countKey: "quizzesCompleted",
    dataSource: { kind: "importRows", source: "quiz" },
    label: "Quiz instincts",
    dimensions: [
      "self-knowledge",
      "values and instincts",
      "how they show up in connection",
    ],
    weight: 0.1,
    confidence: 0.6,
    normalize: { kind: "count", denominator: 4 },
    describe: (c) =>
      `Has played enough quizzes to cover ${c}% of that lane, so we have a read on their instincts and self-knowledge in their own words, not just a profile bio.`,
    action: {
      label: "Play a quiz",
      detail:
        "Each quick quiz adds a new angle on how you connect, and feeds your Mirror.",
      href: "/quizzes",
    },
    trust: {
      origin: "The quizzes you complete, each scored into an archetype.",
      noun: "quiz",
      seen: [
        "Which quizzes you finished and the archetype each one landed on",
        "A simple count of how many you completed, used to fill the lane",
      ],
      neverTouched: [
        "Your individual answer choices, which are never sold or shared",
        "Anything beyond the quizzes you choose to play",
        "Your raw answers are never sent to any AI prompt, only the derived result moves your readiness",
      ],
    },
  },
] as const;

/**
 * A source the generic paste capture endpoint is allowed to write, derived from
 * the registry. Each entry carries the `imported_sources.source` string the row
 * should be tagged with and the contributor it feeds, so a new paste connector
 * is a registry edit only, with no route allowlist to maintain by hand.
 */
export interface PasteCaptureSource {
  /** Value to write into `imported_sources.source`. */
  source: string;
  /** Contributor this paste feeds. */
  contributorId: keyof ReadinessBreakdown;
  /** Human label, surfaced in capture UI and logs. */
  label: string;
}

/** Paste-capturable sources, in registry order. */
export function pasteCaptureSources(
  registry: readonly SignalContributor[] = SIGNAL_REGISTRY,
): PasteCaptureSource[] {
  const out: PasteCaptureSource[] = [];
  for (const c of registry) {
    const ds = c.dataSource;
    if (
      (ds.kind === "importRows" || ds.kind === "importSummaryCount") &&
      ds.capture === "paste"
    ) {
      out.push({ source: ds.source, contributorId: c.id, label: c.label });
    }
  }
  return out;
}

/** Coverage 0-100 for one contributor given its raw count. */
export function coverageFor(
  contributor: SignalContributor,
  count: number,
): number {
  if (contributor.normalize.kind === "binary") return count > 0 ? 100 : 0;
  const denom = contributor.normalize.denominator;
  if (denom <= 0) return 0;
  return Math.min(100, Math.round((count / denom) * 100));
}

/**
 * Default weights, normalized to sum to 1.0. With the shipped registry these
 * already sum to 1.0, so this is an identity; it exists so that adding a
 * contributor never forces a manual re-balance of every other weight.
 */
export function normalizedWeights(
  registry: readonly SignalContributor[] = SIGNAL_REGISTRY,
): Record<string, number> {
  const total = registry.reduce((sum, c) => sum + c.weight, 0);
  const out: Record<string, number> = {};
  for (const c of registry) {
    out[c.id] = total > 0 ? c.weight / total : 0;
  }
  return out;
}

/**
 * Confidence-weighted weights: each signal's weight is scaled by its confidence
 * (how predictive we believe that lane is for matching) and the result is
 * re-normalized to sum to 1.0. This leans the score toward the lanes we trust
 * most without deflating the overall scale. Off by default in scoring; the
 * founder turns it on through the brain control center, so day-one behavior is
 * preserved until then.
 */
export function confidenceWeightedWeights(
  baseWeights: Record<string, number>,
  registry: readonly SignalContributor[] = SIGNAL_REGISTRY,
): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const c of registry) {
    const base = baseWeights[c.id] ?? 0;
    const conf = Number.isFinite(c.confidence) ? c.confidence : 0;
    raw[c.id] = base * Math.max(0, conf);
  }
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const c of registry) {
    out[c.id] = total > 0 ? raw[c.id]! / total : 0;
  }
  return out;
}

/**
 * Lowest a freshness decay multiplier can drive a lane: stale signal fades but
 * never fully vanishes, because the user still did the work. Coverage is scaled
 * by a value in [DECAY_FLOOR, 1].
 */
export const DECAY_FLOOR = 0.3;

/**
 * Freshness multiplier for one lane given how many days have passed since its
 * most recent contribution and the lane's half-life. A signal halves its weight
 * every `halfLifeDays`, floored at DECAY_FLOOR. Fresh or future-dated activity
 * (ageDays <= 0) reads as full. Pure and deterministic.
 */
export function decayMultiplier(
  ageDays: number,
  halfLifeDays: number,
  floor: number = DECAY_FLOOR,
): number {
  if (!Number.isFinite(ageDays) || ageDays <= 0) return 1;
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) return 1;
  const m = Math.pow(0.5, ageDays / halfLifeDays);
  return Math.max(floor, Math.min(1, m));
}

/**
 * Apply freshness decay to a coverage breakdown. Only contributors that declare
 * a `decayHalfLifeDays` and have a known recency (days since last activity) are
 * faded; everything else passes through unchanged. Returns a new breakdown, so
 * the input is never mutated. The decayed breakdown is what both the score and
 * the "do this next" list read, so a faded lane re-surfaces as a next step.
 */
export function applyDecay(
  breakdown: ReadinessBreakdown,
  ageDaysById: Partial<Record<keyof ReadinessBreakdown, number | null>>,
  registry: readonly SignalContributor[] = SIGNAL_REGISTRY,
  floor: number = DECAY_FLOOR,
): ReadinessBreakdown {
  const out = { ...breakdown } as ReadinessBreakdown;
  for (const c of registry) {
    const halfLife = c.decayHalfLifeDays;
    if (!halfLife || halfLife <= 0) continue;
    const ageDays = ageDaysById[c.id];
    if (ageDays == null) continue;
    const coverage = out[c.id] ?? 0;
    if (coverage <= 0) continue;
    out[c.id] = Math.round(coverage * decayMultiplier(ageDays, halfLife, floor));
  }
  return out;
}

/**
 * Approximate readiness points one more unit of a contributor adds, used to
 * rank "do this next" actions.
 */
export function contributorStep(
  contributor: SignalContributor,
  weights: Record<string, number> = normalizedWeights(),
): number {
  const w = weights[contributor.id] ?? 0;
  if (contributor.normalize.kind === "binary") {
    return Math.max(1, Math.round(100 * w));
  }
  const denom = contributor.normalize.denominator;
  if (denom <= 0) return 1;
  return Math.max(1, Math.round((100 / denom) * w));
}

/**
 * Plain-English lines describing what the machine already knows about a user,
 * assembled from the registry for every signal with non-zero coverage. The
 * matching prompt is built from this, so a newly registered signal shows up in
 * the AI's reasoning automatically, with no prompt rewrite.
 */
export function describeActiveSignals(
  breakdown: ReadinessBreakdown,
  registry: readonly SignalContributor[] = SIGNAL_REGISTRY,
): string[] {
  const lines: string[] = [];
  for (const c of registry) {
    const coverage = breakdown[c.id] ?? 0;
    if (coverage > 0) lines.push(c.describe(coverage));
  }
  return lines;
}

/** Minimal outcome shape used to nudge weights; structurally OutcomeCounts. */
export interface OutcomeSignal {
  anotherDate: number;
  noMore: number;
  ghosted: number;
  unsure: number;
}

export interface WeightAdjustment {
  id: string;
  label: string;
  defaultWeight: number;
  adjustedWeight: number;
  reason: string;
}

/**
 * The "breathing" layer. Given a user's recent date outcomes, propose a bounded
 * re-weighting of the signals around their registry defaults: when dates keep
 * fizzling, lean harder on the signals that capture in-person fit and instinct
 * (post-date notes, compass); when dates are landing, leave the defaults alone.
 *
 * This is deterministic, bounded (no signal moves more than ADJUST_CAP of its
 * default), and re-normalized to sum to 1.0. It is intentionally NOT wired into
 * the live readiness score, so day-one behavior is unchanged. It exists so the
 * algorithm can be tuned by real outcomes once we choose to act on it, and so
 * the founder can see how a user's signals would re-weight.
 */
const ADJUST_CAP = 0.25;

export function proposeWeightAdjustments(
  outcome: OutcomeSignal,
  registry: readonly SignalContributor[] = SIGNAL_REGISTRY,
  baseWeights?: Record<string, number>,
): WeightAdjustment[] {
  // The base the tilt operates on. Defaults to the registry normalization, but
  // the founder control center can pass weight overrides so re-weighting tilts
  // around the founder's base instead of day-one defaults.
  const defaults = baseWeights ?? normalizedWeights(registry);
  const totalDates =
    outcome.anotherDate + outcome.noMore + outcome.ghosted + outcome.unsure;

  // No outcomes yet: nothing to learn from, defaults stand.
  const fizzleRate =
    totalDates > 0 ? (outcome.noMore + outcome.ghosted) / totalDates : 0;
  const tilt = totalDates >= 2 ? Math.min(ADJUST_CAP, fizzleRate * ADJUST_CAP) : 0;

  // Signals that capture in-person fit get nudged up when dates fizzle.
  const lean = new Set(["postDate", "compass"]);
  const raw: Record<string, number> = {};
  for (const c of registry) {
    const base = defaults[c.id] ?? 0;
    raw[c.id] = lean.has(c.id) ? base * (1 + tilt) : base;
  }
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);

  return registry.map((c) => {
    const adjusted = sum > 0 ? raw[c.id] / sum : 0;
    const def = defaults[c.id] ?? 0;
    let reason = "Default weight; outcomes have not moved this signal.";
    if (tilt > 0 && lean.has(c.id)) {
      reason =
        "Recent dates have been fizzling, so in-person fit signals carry more weight.";
    } else if (tilt > 0) {
      reason = "Re-normalized after leaning into in-person fit signals.";
    }
    return {
      id: c.id,
      label: c.label,
      defaultWeight: Number(def.toFixed(4)),
      adjustedWeight: Number(adjusted.toFixed(4)),
      reason,
    };
  });
}
