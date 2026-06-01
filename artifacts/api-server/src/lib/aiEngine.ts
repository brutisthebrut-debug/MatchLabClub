// AI Engine, deterministic mock for MVP (no external API keys required)
// Returns realistic, coaching-quality output for every audit/report/coaching session.

// Bump this string whenever the deterministic engine's output changes in a
// user-visible way. Stored reports tagged with an older version will be
// flagged as stale on the client so the user can re-run with the latest.
import { SIGNAL_REGISTRY, type ReadinessBreakdown } from "./signalRegistry";
import type { ReadinessNextAction, OutcomeInsight } from "./readiness";

export const ENGINE_VERSION = "2026-05-22";

export interface PhotoObservation {
  aspect: string;
  assessment: "strong" | "okay" | "needs_work";
  detail: string;
}

export interface PhotoAnalysis {
  summary: string;
  observations: PhotoObservation[];
  topFix: string;
}

// Photo Lab: deterministic multi-photo ranking. This is the always-on baseline,
// it never looks at pixels. It ranks photos from the composition attributes the
// member declares per photo (what kind of shot it is, lighting, expression) and
// recommends a lead shot. Opt-in Claude vision layers depth on top in the route.
// Everything here is about composition and lineup strategy, never appearance.
export type PhotoShotType =
  | "solo_face"
  | "full_body"
  | "activity"
  | "group"
  | "candid"
  | "other";

export interface PhotoLabPhotoInput {
  /** Client-assigned id so the ranking maps back to the uploaded photo. */
  id: string;
  shotType: PhotoShotType;
  wellLit?: boolean;
  genuineExpression?: boolean;
}

export interface PhotoLabInput {
  photos: PhotoLabPhotoInput[];
  datingGoal?: string | null;
  sourceApp?: string | null;
}

export interface PhotoLabRankedPhoto {
  id: string;
  rank: number;
  score: number;
  role: string;
  isLead: boolean;
  notes: string[];
}

export interface PhotoLabChecklistItem {
  category: string;
  status: "good" | "needs_work" | "missing";
  advice: string;
}

export interface PhotoLabRanking {
  leadShotId: string;
  leadShotRationale: string;
  summary: string;
  ranked: PhotoLabRankedPhoto[];
  checklist: PhotoLabChecklistItem[];
}

const PHOTO_SHOT_META: Record<
  PhotoShotType,
  { base: number; role: string; label: string }
> = {
  // A clear solo shot of the face is the safest, highest-impact lead, so it
  // carries the strongest base. A great candid can still edge a flat solo shot.
  solo_face: { base: 75, role: "Lead shot", label: "clear solo shot" },
  candid: { base: 58, role: "Candid personality shot", label: "candid shot" },
  activity: {
    base: 54,
    role: "Lifestyle and conversation starter",
    label: "activity shot",
  },
  full_body: { base: 48, role: "Full-body trust shot", label: "full-body shot" },
  other: { base: 42, role: "Supporting shot", label: "supporting shot" },
  group: { base: 28, role: "Social proof, never the lead", label: "group shot" },
};

function joinHumanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function photoLabNotes(p: PhotoLabPhotoInput): string[] {
  const notes: string[] = [];
  switch (p.shotType) {
    case "solo_face":
      notes.push(
        "A clear solo shot is what people screen first. This is prime lead material.",
      );
      break;
    case "candid":
      notes.push(
        "Candid shots read as warm and real. A good change of pace between posed shots.",
      );
      break;
    case "activity":
      notes.push(
        "Activity shots give people something to ask about. Strong in slot two or three.",
      );
      break;
    case "full_body":
      notes.push(
        "Keep one honest full-body shot for trust. It rarely wins as the lead.",
      );
      break;
    case "group":
      notes.push(
        "Strong as social proof. Place it third or later, never as your first image.",
      );
      break;
    default:
      notes.push("A useful supporting shot to round out the lineup.");
  }
  if (!p.wellLit) {
    notes.push("Natural daylight would lift this shot. Soft, even light reads best.");
  }
  if (
    !p.genuineExpression &&
    (p.shotType === "solo_face" || p.shotType === "candid")
  ) {
    notes.push(
      "A relaxed, genuine expression reads warmer than a posed look.",
    );
  }
  return notes;
}

/**
 * Pure, deterministic photo ranking. Total over any input (empty included).
 * Group shots are penalized as a lead so a clear solo shot wins the first slot.
 */
export function rankPhotosDeterministic(input: PhotoLabInput): PhotoLabRanking {
  const photos = input.photos ?? [];
  const scored = photos.map((photo, index) => {
    const meta = PHOTO_SHOT_META[photo.shotType] ?? PHOTO_SHOT_META.other;
    let score = meta.base;
    if (photo.wellLit) score += 10;
    if (photo.genuineExpression) score += 12;
    if (photo.shotType === "group") score -= 12;
    score = Math.max(1, Math.min(100, score));
    return { photo, index, score, meta };
  });

  const order = [...scored].sort(
    (a, b) => b.score - a.score || a.index - b.index,
  );

  const ranked: PhotoLabRankedPhoto[] = order.map((entry, i) => ({
    id: entry.photo.id,
    rank: i + 1,
    score: entry.score,
    role: entry.meta.role,
    isLead: i === 0,
    notes: photoLabNotes(entry.photo),
  }));

  const has = (t: PhotoShotType) => scored.some((s) => s.photo.shotType === t);
  const litCount = scored.filter((s) => s.photo.wellLit).length;
  const wellLitSet =
    scored.length > 0 && litCount >= Math.ceil(scored.length / 2);

  const checklist: PhotoLabChecklistItem[] = [
    {
      category: "Clear solo lead shot",
      status: has("solo_face") ? "good" : "missing",
      advice: has("solo_face")
        ? "You have a clear solo shot to lead with. That is the single highest-impact slot."
        : "Add one clear, well-lit solo shot of your face. It makes the strongest lead.",
    },
    {
      category: "Full-body shot",
      status: has("full_body") ? "good" : "missing",
      advice: has("full_body")
        ? "An honest full-body shot is in the mix. It builds trust and avoids surprises."
        : "Add one honest full-body shot. It builds trust and prevents awkward first-meeting surprises.",
    },
    {
      category: "Activity or lifestyle shot",
      status: has("activity") ? "good" : "needs_work",
      advice: has("activity")
        ? "You have an activity shot. It gives people an easy opener."
        : "Add a shot of you doing something you love. Activity photos spark more openers than posed ones.",
    },
    {
      category: "Social proof shot",
      status: has("group") ? "good" : "needs_work",
      advice: has("group")
        ? "A group shot is present. Keep it later in the lineup, never as the lead."
        : "A photo with friends signals warmth and social value. Add one, but never lead with it.",
    },
    {
      category: "Lighting",
      status: wellLitSet ? "good" : "needs_work",
      advice: wellLitSet
        ? "Most of your shots read as well lit. Soft, even light keeps doing the work."
        : "Several shots could use better light. Natural daylight near a window is the easy win.",
    },
  ];

  if (scored.length === 0 || order.length === 0) {
    return {
      leadShotId: "",
      leadShotRationale:
        "Add at least one photo and tag what each one is, and the engine will pick your lead shot.",
      summary: "Add at least one photo to get a ranking.",
      ranked,
      checklist,
    };
  }

  const lead = order[0]!;
  const leadP = lead.photo;
  let leadShotRationale: string;
  if (
    leadP.shotType === "solo_face" ||
    leadP.shotType === "candid" ||
    leadP.shotType === "activity"
  ) {
    const extras = [
      leadP.wellLit ? "well lit" : null,
      leadP.genuineExpression ? "with a genuine expression" : null,
    ].filter((x): x is string => x !== null);
    const extraText = extras.length ? `, ${joinHumanList(extras)}` : "";
    leadShotRationale = `Lead with photo ${leadP.id}: a ${lead.meta.label}${extraText}. It is the version of you people meet first, so it earns the opening slot.`;
  } else {
    leadShotRationale = `Photo ${leadP.id} is your best of the set, but a clear, well-lit solo shot of your face beats a ${lead.meta.label} as a lead. Add one and it will likely take the first slot.`;
  }

  const missing = checklist
    .filter((c) => c.status === "missing")
    .map((c) => c.category.toLowerCase());
  const n = scored.length;
  const gap = missing.length
    ? ` Your set is thin on ${joinHumanList(missing)}. Filling those rounds out the lineup.`
    : " You have good variety across the lineup.";
  const summary = `Ranked ${n} ${n === 1 ? "photo" : "photos"}. Lead with photo ${leadP.id}.${gap}`;

  return {
    leadShotId: leadP.id,
    leadShotRationale,
    summary,
    ranked,
    checklist,
  };
}

export interface AuditReportOutput {
  readinessScore: number;
  overallGrade: string;
  strengths: string[];
  risks: string[];
  bioAudit: string;
  rewrittenBio: string;
  rewrittenPrompts: { original: string; rewritten: string; tip: string }[];
  photoGuidance: { category: string; status: "good" | "needs_work" | "missing"; advice: string }[];
  /**
   * Real AI vision read of the actual uploaded photo(s). Present only when a
   * signed-in user opted into the deep AI lane and the vision call succeeded.
   * Absent/null otherwise, the deterministic photoGuidance checklist is the
   * always-on fallback. The raw image is never persisted.
   */
  photoAnalysis?: PhotoAnalysis | null;
  actionPlan: { priority: number; title: string; description: string; timeframe: string }[];
  messagingStyle: string;
  coachingCta: string;
  engineVersion: string;
}

export interface MessageCoachingOutput {
  analysis: string;
  suggestedReplies: { style: string; text: string; rationale: string }[];
  tone: string;
  redFlags: string[];
  coachTip: string;
}

export interface EmailInsightOutput {
  communicationPatterns: { pattern: string; frequency: string; impact: string }[];
  attachmentStyle: string;
  strengths: string[];
  growthAreas: string[];
  datingProfileTips: string[];
  summary: string;
  sourceApp: string | null;
}

function scoreFromBio(bio: string, goal: string, apps: string[]): number {
  let score = 52;
  if (bio.length > 200) score += 8;
  if (bio.length > 400) score += 5;
  if (bio.toLowerCase().includes("love") || bio.toLowerCase().includes("passion")) score += 4;
  if (bio.toLowerCase().includes("gym") || bio.toLowerCase().includes("travel")) score += 3;
  if (apps.length >= 2) score += 4;
  if (goal === "find a relationship") score += 4;
  if (bio.toLowerCase().includes("looking for") || bio.toLowerCase().includes("hoping to")) score -= 6;
  if (bio.toLowerCase().includes("just ask") || bio.toLowerCase().includes("don't know what")) score -= 8;
  if (bio.toLowerCase().includes("sarcastic") || bio.toLowerCase().includes("dry humor")) score -= 3;
  return Math.min(94, Math.max(28, score));
}

function gradeFromScore(score: number): string {
  if (score >= 85) return "A";
  if (score >= 72) return "B";
  if (score >= 58) return "C";
  if (score >= 42) return "D";
  return "F";
}

type KnownApp = "Hinge" | "Bumble" | "Tinder";

function normalizeApp(raw?: string | null): KnownApp | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "hinge") return "Hinge";
  if (t === "bumble") return "Bumble";
  if (t === "tinder") return "Tinder";
  return null;
}

function appBioFlavor(app: KnownApp | null, name: string): string {
  switch (app) {
    case "Hinge":
      return `On Hinge specifically, the prompts do most of the heavy lifting, so ${name}'s bio doesn't need to carry the whole personality on its own, but it does need to set a clear tone the prompts can build on.`;
    case "Bumble":
      return `Bumble readers skim bios fast, and the people seeing yours have hundreds of options a week. ${name}'s opening line has to earn the second sentence; without a sharp hook the rest of the profile never gets read.`;
    case "Tinder":
      return `Tinder bios are read in the half-second between photo swipes, so ${name} needs one punchy, specific line up top, not a paragraph. Density beats depth here.`;
    default:
      return "";
  }
}

function appPromptTips(app: KnownApp | null): { tip: string; rewriteHint: string } {
  switch (app) {
    case "Hinge":
      return {
        tip: "Hinge weights prompts heavily in recommendations, make each one a distinct, responsive hook, not three variations of the same vibe.",
        rewriteHint: "Hinge favors specificity. Pick one weird, true detail per prompt, that's what gets likes attached.",
      };
    case "Bumble":
      return {
        tip: "On Bumble, prompts (and the question prompt at the top) are conversation seeds, leave an obvious opening for them to send the first message.",
        rewriteHint: "On Bumble the first move is restricted, give the other person something obvious and easy to react to, not abstract values statements.",
      };
    case "Tinder":
      return {
        tip: "Tinder doesn't have prompts the way Hinge does, fold these answers into a tight 2-line bio with a clear hook and an implicit question.",
        rewriteHint: "Tinder reads in seconds. Use prompt rewrites as raw material for a short, specific bio rather than a full prompt section.",
      };
    default:
      return {
        tip: "Specificity beats sincerity every time. Readers fill in the blanks with their own version of you.",
        rewriteHint: "",
      };
  }
}

function appPhotoFlavor(app: KnownApp | null): string | null {
  switch (app) {
    case "Hinge":
      return "Hinge surfaces individual photos with likes, every single photo needs to stand on its own, since matches may comment on just one.";
    case "Bumble":
      return "Bumble shows the lead photo at a larger crop than other apps, a slightly tighter framing on your face usually outperforms a wide shot here.";
    case "Tinder":
      return "Tinder is photo-first and swipe-fast. The lead photo isn't 'a' factor, it's almost the entire decision. Treat it accordingly.";
    default:
      return null;
  }
}

export function generateAuditReport(params: {
  firstName: string;
  bio: string;
  prompts?: string | null;
  datingGoal: string;
  currentApps: string[];
  biggestChallenge?: string | null;
  recentMessageSample?: string | null;
  sourceApp?: string | null;
}): AuditReportOutput {
  const score = scoreFromBio(params.bio, params.datingGoal, params.currentApps);
  const grade = gradeFromScore(score);
  const app =
    normalizeApp(params.sourceApp) ??
    normalizeApp(params.currentApps[0]) ??
    null;
  const appLabel = app ?? params.currentApps[0] ?? "dating apps";
  const name = params.firstName?.trim() || "your match";

  const appFlavor = appBioFlavor(app, name);
  const bioAudits = [
    `${name}'s bio has genuine personality but is underselling the depth beneath the surface. The opening line doesn't create immediate intrigue, it reads like a summary rather than a hook. Several phrases are common on ${appLabel} to the point of being invisible: "love to travel," "big on authenticity," and "looking for my person" appear in roughly 1 in 3 profiles. The bio doesn't answer the only question that matters: why would someone who has options choose ${name} specifically? There's potential here, it just needs a sharper lens.${appFlavor ? " " + appFlavor : ""}`,
    `${name}'s current bio tries to cover too much ground and ends up owning none of it. Rather than creating a vivid, specific picture of who ${name} is on their best Tuesday, it lists attributes that could apply to thousands of people. The tone is earnest, which is a strength, but earnest without specific detail reads as generic. The real ${name} is more interesting than this bio suggests. We need to surface that.${appFlavor ? " " + appFlavor : ""}`,
    `There's a buried lede in ${name}'s profile. The most compelling detail appears in sentence four, that's where the reader's attention should land first. The profile structure is inverted: it starts with abstractions (values, personality descriptors) and saves the specifics for the end, when many readers have already moved on. ${appLabel} profiles reward novelty and specificity in the first eight words.${appFlavor ? " " + appFlavor : ""}`,
  ];

  const rewrittenBios = [
    `I make a genuinely great first date, I'll pick somewhere unexpected, I'll actually be listening, and I'll probably make you laugh at something you didn't expect to laugh at. I'm the kind of person who takes ${params.datingGoal === "find a relationship" ? "connection seriously" : "good moments seriously"}, which means I'm not here to waste either of our time. Currently: too invested in my sourdough starter, rewatching things I've already seen, and trying to find someone worth getting off the couch for. If any of that sounds appealing, let's find out.`,
    `Professionally: I make things happen. Personally: I make breakfast for people I like and take forever to leave a bookshop. I'm ${params.datingGoal === "casual dating" ? "not looking for anything heavy, just someone worth actually spending time with" : "looking for something real, not the Instagram version of a relationship, the actual thing"}. I'm easy to talk to, terrible at small talk, and very good at the second date. Let's skip the awkward stuff and get to the good part.`,
    `The facts: I'm someone who shows up, follows through, and genuinely enjoys other people, which, it turns out, is rarer than it should be. I'll plan the date, bring the energy, and remember what you told me three conversations ago. I'm ${params.currentApps.includes("Hinge") ? "on Hinge" : "on here"} because I'm actually trying, not just bored. If you're the same, we should probably talk.`,
  ];

  const promptTips = appPromptTips(app);
  const promptRewrites = params.prompts
    ? [
        {
          original: params.prompts.split("\n")[0] || "The way to win me over is...",
          rewritten:
            "Remembering the weird specific thing I mentioned once. That's it. That's the whole thing.",
          tip: promptTips.tip,
        },
        {
          original: params.prompts.split("\n")[1] || "I'm looking for...",
          rewritten:
            "Someone who laughs before the punchline lands. We'll get along immediately.",
          tip: promptTips.rewriteHint || "Prompts are conversation starters, end with something they can respond to.",
        },
        {
          original: params.prompts.split("\n")[2] || "A green flag I look for...",
          rewritten:
            "When someone admits they don't know something. Confidence without ego is wildly attractive.",
          tip: "This reveals values without sounding like a therapist. Attractive people have standards.",
        },
      ]
    : [
        {
          original: "(No prompts provided)",
          rewritten: app === "Tinder"
            ? "I'll show you rather than tell you, first message gets a real response. (Tinder: keep this as the bio, no prompts needed.)"
            : "I'll show you rather than tell you, first message gets a real response.",
          tip: app === "Tinder"
            ? "Tinder doesn't surface prompts the way Hinge does, a single sharp bio line does more work."
            : `Add 2-3 prompts to dramatically increase ${name}'s match-to-conversation conversion rate on ${appLabel}.`,
        },
      ];

  const photoGuidanceItems = [
    {
      category: "Lead photo",
      status: "needs_work" as const,
      advice:
        "Your first photo should be a clear, well-lit face shot where you're visibly enjoying yourself, not posing. Squinting at the sun or a blurry group shot loses matches before they read a word.",
    },
    {
      category: "Social proof shot",
      status: score > 65 ? ("good" as const) : ("missing" as const),
      advice:
        score > 65
          ? "Good, you have a photo showing you with other people. This signals that others enjoy your company."
          : "Add one photo of you with friends or family. It signals social value and warmth, two of the top three traits people screen for.",
    },
    {
      category: "Action/lifestyle shot",
      status: score > 70 ? ("good" as const) : ("needs_work" as const),
      advice:
        "Show yourself doing something you actually love, not a gym mirror selfie. Cooking, hiking, playing music, traveling. Activity photos generate 3x more openers than static poses.",
    },
    {
      category: "Full-body photo",
      status: score > 75 ? ("good" as const) : ("missing" as const),
      advice:
        "Including one honest full-body photo builds trust and prevents awkward first-meeting surprises. It signals confidence.",
    },
    {
      category: "Quality and lighting",
      status: "needs_work" as const,
      advice:
        "At least 3 of your photos should be taken in natural daylight. Avoid heavy filters, they read as insecure. Phone cameras in good light beat DSLR cameras in bad light.",
    },
    ...(appPhotoFlavor(app)
      ? [
          {
            category: `${app} platform fit`,
            status: "needs_work" as const,
            advice: appPhotoFlavor(app) as string,
          },
        ]
      : []),
  ];

  const actionPlanItems = [
    {
      priority: 1,
      title: "Rewrite your opening line",
      description:
        "Replace the current bio opening with a specific, scene-setting hook. Make the reader picture you in a moment, not list your traits.",
      timeframe: "Today",
    },
    {
      priority: 2,
      title: "Update your lead photo",
      description:
        "Swap your lead photo for your most natural, well-lit face shot. Run it through Photofeeler for objective feedback before publishing.",
      timeframe: "This week",
    },
    {
      priority: 3,
      title: "Add two specific prompts",
      description:
        "Choose prompts that end with an implicit invitation to respond, avoid lists and abstract values statements.",
      timeframe: "This week",
    },
    {
      priority: 4,
      title: "Audit your opener strategy",
      description:
        `Your messaging data suggests ${params.recentMessageSample ? "some patterns worth addressing" : "openers are likely a weak point"}. Move away from "Hey" and compliment-only openers. Reference something specific from their profile in every first message.`,
      timeframe: "Ongoing",
    },
    {
      priority: 5,
      title: "Run a 2-week profile experiment",
      description:
        "Implement all changes, then pause for 14 days to gather data. Track: matches per week, response rate, date conversion rate. Bring that data to your next coaching session.",
      timeframe: "2 weeks",
    },
  ];

  return {
    readinessScore: score,
    overallGrade: grade,
    strengths: [
      "Genuine warmth comes through, you don't read as transactional or performative",
      "Clear sense of what you're looking for, intention is attractive",
      `Active on ${params.currentApps.length} ${params.currentApps.length === 1 ? "platform" : "platforms"}, giving yourself real chances`,
      "Openness and self-awareness present in your writing voice",
    ],
    risks: [
      "Generic phrases dilute the profile, several lines appear in thousands of other bios",
      "Not enough specificity to stand out in a high-volume pool",
      "Opening line doesn't create immediate intrigue or curiosity",
      ...(params.biggestChallenge === "not getting matches"
        ? ["Profile optimization likely needed before increasing swipe volume"]
        : params.biggestChallenge === "ghosted"
        ? ["Messaging strategy needs attention, matches converting poorly to conversations"]
        : []),
    ],
    bioAudit: bioAudits[Math.floor(score % 3)],
    rewrittenBio: rewrittenBios[Math.floor(score % 3)],
    rewrittenPrompts: promptRewrites,
    photoGuidance: photoGuidanceItems,
    actionPlan: actionPlanItems,
    messagingStyle:
      params.recentMessageSample && params.recentMessageSample.length > 50
        ? `Based on your message sample, your communication style leans ${score > 65 ? "warm and genuine" : "cautious and surface-level"}. ${score > 65 ? "You ask good questions but sometimes wait too long to suggest escalating to a date, the window closes faster than most people think." : "You're holding back, your messages are safe but not memorable. The goal isn't to be impressive, it's to be interesting. Specificity and light playfulness dramatically improve response rates."}`
        : "No message sample provided. Add a conversation snippet in your next audit to unlock personalized messaging analysis. In the meantime: the single highest-ROI change most people can make is in the first message, it should reference something specific from their profile, ask one question, and land in 2 sentences or less.",
    coachingCta:
      "Ready to go deeper? Book a 1:1 coaching session and we'll rebuild your entire dating strategy, from photos to first messages to closing for dates. Most clients see a 2-3x improvement in meaningful matches within 30 days.",
    engineVersion: ENGINE_VERSION,
  };
}

function detectAppFromText(text: string): KnownApp | null {
  const t = text.toLowerCase();
  if (/\bhinge\b/.test(t)) return "Hinge";
  if (/\bbumble\b/.test(t)) return "Bumble";
  if (/\btinder\b/.test(t)) return "Tinder";
  return null;
}

function appCoachTone(app: KnownApp | null, base: string): string {
  switch (app) {
    case "Hinge":
      return `${base} Hinge conversations reward referencing something specific from their prompts, it signals you actually read the profile.`;
    case "Bumble":
      return `${base} On Bumble the 24-hour clock matters, don't let momentum die between sessions, but don't overreact to a slow reply either.`;
    case "Tinder":
      return `${base} Tinder conversations get stale fast, move toward concrete plans within the first dozen messages or the thread dies.`;
    default:
      return base;
  }
}

function appCoachRedFlags(app: KnownApp | null): string[] {
  switch (app) {
    case "Hinge":
      return ["On Hinge, ignoring the prompt they liked is a missed hook, anchor your next reply to it"];
    case "Bumble":
      return ["On Bumble, letting an opening thread go cold past 24 hours often resets the dynamic entirely"];
    case "Tinder":
      return ["On Tinder, staying in the chat past two days without suggesting plans usually kills the match"];
    default:
      return [];
  }
}

function appCoachTip(app: KnownApp | null, goal: string, name: string): string {
  const baseDate =
    "a warm-up, not an interview, but they also end with plans, not just good vibes. After 5-7 messages of solid rapport, it's time to ask. The cost of asking is almost always lower than people think.";
  const baseKeep =
    "tennis, both people bringing something to every exchange. Make sure you're returning with energy, not just keeping it alive.";
  const base = `The best conversations feel like ${goal === "get a date" ? baseDate : baseKeep}`;
  switch (app) {
    case "Hinge":
      return `${base} With ${name} on Hinge, tie your date suggestion back to whatever prompt or photo you originally liked, it makes the ask feel earned, not random.`;
    case "Bumble":
      return `${base} On Bumble, ${name} expects you to bring some energy back quickly, concise, specific replies outperform long thoughtful essays here.`;
    case "Tinder":
      return `${base} On Tinder, ${name} is talking to a lot of people, a confident, low-friction plan ("drinks Thursday, I'll pick the spot") usually beats an open-ended "what do you like to do?"`;
    default:
      return base;
  }
}

export function generateMessageCoaching(params: {
  matchName: string;
  conversationContext: string;
  yourLastMessage: string;
  goal?: string | null;
  sourceApp?: string | null;
}): MessageCoachingOutput {
  const goal = params.goal || "keep the conversation going";
  const isShortMessage = params.yourLastMessage.length < 30;
  const isQuestion = params.yourLastMessage.includes("?");
  const name = params.matchName?.trim() || "your match";
  const app =
    normalizeApp(params.sourceApp) ??
    detectAppFromText(`${params.conversationContext}\n${params.yourLastMessage}`);
  const appPhrase = app ? ` on ${app}` : "";

  const baseTone =
    params.conversationContext.toLowerCase().includes("haha") ||
    params.conversationContext.toLowerCase().includes("lol")
      ? "Light and playful, this is working. Don't overthink it, just keep the energy up and steer toward a date."
      : "Measured and thoughtful. There's mutual interest here but neither person has broken the surface yet. Someone needs to go first, let it be you.";

  const baseRedFlags =
    isShortMessage && !isQuestion
      ? [
          "One-word or very short replies slow momentum and signal low investment",
          "Lack of a question puts 100% of the conversational burden on them",
        ]
      : params.yourLastMessage.toLowerCase().includes("haha") && params.yourLastMessage.length < 20
      ? [
          "'Haha' as a standalone response signals you read it but had nothing to add, it deflates energy",
          "Reactive messages (laughing at what they said without building on it) stall conversations",
        ]
      : [];

  return {
    analysis: `This conversation with ${name}${appPhrase} has ${params.conversationContext.length > 200 ? "solid momentum, there's genuine back-and-forth happening" : "potential, but it needs a boost"}. Your last message ${isShortMessage ? "is a bit brief, it doesn't give them much to work with and puts the conversational weight entirely on them" : "shows effort, which is good"}. ${isQuestion ? "Asking a question is smart, but make sure it's specific enough that there's no 'safe' one-word answer" : "Consider adding a question or prompt to make it easy for them to respond"}. The goal of ${goal} is achievable, here's how to get there.`,
    suggestedReplies: [
      {
        style: "Playful",
        text: `Okay but real question, ${name}, what's your actual unpopular opinion? I'm collecting them.`,
        rationale:
          "Creates an easy, low-stakes reply opportunity. Playful challenge generates more response than a sincere question.",
      },
      {
        style: "Direct",
        text: `I'd rather show you than keep describing it. Are you free this week, ${name}?`,
        rationale: `If the goal is to get a date, asking directly after establishing rapport converts at 3x the rate of waiting. ${name} will respect the directness${app ? `, and${appPhrase} that kind of clarity is rare` : ""}.`,
      },
      {
        style: "Warm",
        text: `That's actually one of the more interesting things anyone's said to me${appPhrase ? appPhrase : " on here"}, ${name}. What's behind that?`,
        rationale:
          "Validates their contribution while opening a deeper thread. Use this if the conversation has been surface-level and you want to go somewhere real.",
      },
      {
        style: "Date Ask",
        text: `${name}, I'd genuinely love to meet you. Want to grab coffee or a drink this week? I'll pick somewhere good.`,
        rationale: `After solid rapport, asking directly converts far better than hinting${appPhrase ? `, and${appPhrase}, plans-first messages beat more chat almost every time` : ""}. Moving to real life is the whole point, the cost of asking is almost always lower than people think.`,
      },
      {
        style: "Graceful Exit",
        text: `${name}, it's been genuinely nice chatting. I think we might be in different places right now, but I'm really glad we connected.`,
        rationale: `Sometimes the kindest move is a clear, warm close. This ends things with dignity for both people, no ambiguity, no hard feelings, no bridge burned.`,
      },
    ],
    tone: appCoachTone(app, baseTone),
    redFlags: [...baseRedFlags, ...appCoachRedFlags(app)],
    coachTip: appCoachTip(app, goal, name),
  };
}

type InsightSource = "Hinge" | "Bumble" | "Tinder" | "iMessage" | "Email";

function normalizeInsightSource(raw?: string | null): InsightSource | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "hinge") return "Hinge";
  if (t === "bumble") return "Bumble";
  if (t === "tinder") return "Tinder";
  if (t === "imessage" || t === "messages" || t === "sms" || t === "text") return "iMessage";
  if (t === "email" || t === "gmail" || t === "outlook") return "Email";
  return null;
}

function detectInsightSource(text: string): InsightSource | null {
  const t = text.toLowerCase();
  if (/\bhinge\b/.test(t)) return "Hinge";
  if (/\bbumble\b/.test(t)) return "Bumble";
  if (/\btinder\b/.test(t)) return "Tinder";
  if (/\bimessage\b|\bsms\b|\btexts?\b/.test(t)) return "iMessage";
  if (/\bemail\b|\bgmail\b|\boutlook\b|@\w+\.\w+/.test(t)) return "Email";
  return null;
}

function insightSourcePatternImpact(source: InsightSource | null, isLongMessages: boolean): string | null {
  switch (source) {
    case "Hinge":
      return isLongMessages
        ? "On Hinge, long messages early can outpace the conversational rhythm, readers expect punchy, prompt-anchored replies in the first few exchanges."
        : "On Hinge, concise replies work, but make sure each one anchors back to a prompt or photo so the conversation stays specific.";
    case "Bumble":
      return isLongMessages
        ? "On Bumble the opener is restricted to one side, long replies can feel like pressure, so keep early messages snappy and let them pick the thread."
        : "On Bumble the 24-hour clock rewards your concise style, just make sure replies still bring fresh energy, not just acknowledgement.";
    case "Tinder":
      return isLongMessages
        ? "On Tinder, multi-paragraph messages get skimmed, the platform rewards quick, sharp exchanges that move toward a plan fast."
        : "On Tinder, your concise style fits the platform, just don't let so many short turns pass that the thread dies before you suggest plans.";
    case "iMessage":
      return "Once you're in iMessage, you've already cleared the hardest bar, protect that by keeping pacing relaxed and not over-texting between days.";
    case "Email":
      return "Email is a slower, more deliberate medium, your tone here will read more carefully than on apps, so word choice matters more than usual.";
    default:
      return null;
  }
}

function insightSourceGrowthArea(source: InsightSource | null): string | null {
  switch (source) {
    case "Hinge":
      return "On Hinge, tie at least one reply back to whatever prompt or photo originally got the like, it consistently lifts response quality.";
    case "Bumble":
      return "On Bumble, when they open, your reply within the first few hours sets the tone, concise specifics beat long appreciative essays.";
    case "Tinder":
      return "On Tinder, set a soft deadline in your head, if you're past a dozen messages without suggesting plans, the thread is dying.";
    case "iMessage":
      return "Once you're texting, stop performing, the conversation should feel lighter and more spontaneous, not more polished, than the app phase.";
    case "Email":
      return "Email rewards brevity even more than apps, most threads die from length, not from being too direct.";
    default:
      return null;
  }
}

function insightSourceProfileTip(source: InsightSource | null): string | null {
  switch (source) {
    case "Hinge":
      return "Your Hinge prompts are doing most of the matchmaking, rotate one every two weeks and watch which versions actually pull likes.";
    case "Bumble":
      return "On Bumble, the lead photo and first bio line do nearly all the work, make sure both can stand on their own in under two seconds.";
    case "Tinder":
      return "On Tinder, a two-line bio with one specific hook will outperform a thoughtful paragraph almost every time, density beats depth.";
    case "iMessage":
      return "Since you're getting numbers, your profile is converting, the next leverage point is upgrading the app-to-text transition, not the bio.";
    case "Email":
      return "If conversations are moving to email, your profile is doing fine, focus coaching on tightening replies, not rewriting the bio.";
    default:
      return null;
  }
}

function insightSourceSummaryAddendum(source: InsightSource | null): string {
  switch (source) {
    case "Hinge":
      return " Tuned to Hinge conventions, prompt-anchored replies and individual-photo specificity weighted heavily.";
    case "Bumble":
      return " Tuned to Bumble dynamics, opener-restricted timing and lead-photo weight factored in.";
    case "Tinder":
      return " Tuned to Tinder pacing, fast-decay thread expectations and plans-first asks weighted in.";
    case "iMessage":
      return " Calibrated for iMessage, you've already cleared the app, so the leverage is now in pacing and tone, not pitch.";
    case "Email":
      return " Calibrated for email, slower cadence, more deliberate phrasing, and brevity over polish.";
    default:
      return "";
  }
}

export function generateEmailInsightAnalysis(params: {
  pastedContent: string;
  sourceLabel: string;
  sourceApp?: string | null;
}): EmailInsightOutput {
  const content = params.pastedContent.toLowerCase();
  const wordCount = content.split(" ").length;
  const source =
    normalizeInsightSource(params.sourceApp) ??
    normalizeInsightSource(params.sourceLabel) ??
    detectInsightSource(`${params.sourceLabel}\n${params.pastedContent}`);

  const isLongMessages =
    content.length / Math.max(1, (content.match(/\n/g) || []).length) > 80;
  const hasQuestions = (content.match(/\?/g) || []).length;
  const hasEmotional =
    content.includes("feel") ||
    content.includes("miss") ||
    content.includes("hurt") ||
    content.includes("sorry");
  const hasHumor =
    content.includes("haha") ||
    content.includes("lol") ||
    content.includes("jk") ||
    content.includes("kidding");

  const attachmentStyles = [
    "Secure, you communicate directly and recover well from tension",
    "Anxiously attached, you seek reassurance and sometimes over-explain",
    "Avoidant, you pull back when conversations get emotionally heavy",
    "Fearful-avoidant, you want closeness but protect yourself from it",
  ];

  const styleIndex = hasEmotional
    ? isLongMessages
      ? 1
      : 3
    : hasHumor
    ? 0
    : 2;

  return {
    communicationPatterns: [
      {
        pattern: isLongMessages ? "Extended message length" : "Concise messaging style",
        frequency: isLongMessages ? "High, most messages are multi-paragraph" : "Consistent, you tend to keep messages short",
        impact: (() => {
          const base = isLongMessages
            ? "Long messages signal investment but can create pressure, the other person may feel they owe an equivalent response, which is exhausting over time."
            : "Concise messages are easy to respond to, but may read as low investment. Try occasionally matching their energy by going a little longer.";
          const flavor = insightSourcePatternImpact(source, isLongMessages);
          return flavor ? `${base} ${flavor}` : base;
        })(),
      },
      {
        pattern: hasQuestions > 5 ? "Question-heavy style" : "Statement-forward style",
        frequency:
          hasQuestions > 5
            ? `High, ${hasQuestions} questions detected in this sample`
            : "Low, fewer than expected questions in your messages",
        impact:
          hasQuestions > 5
            ? "Asking questions is a strong instinct, it shows curiosity. But too many in a row can feel like an interview. Balance questions with statements that reveal something about you."
            : "More questions would give the other person more ways to engage. Try ending more messages with a genuine question about them.",
      },
      {
        pattern: hasHumor ? "Humor as a connector" : "Earnest/direct communication",
        frequency: hasHumor ? "Present, humor appears naturally throughout" : "Low, limited use of levity",
        impact: hasHumor
          ? "Great. Humor is one of the strongest accelerants of attraction and trust. Keep it calibrated to their response, mirror their energy."
          : "Adding occasional lightness can lower defenses and make conversations feel more alive. You don't have to be funny, just human.",
      },
      {
        pattern: hasEmotional ? "Emotionally expressive" : "Emotionally restrained",
        frequency: hasEmotional
          ? "High, emotional language appears frequently"
          : "Low, emotional language is largely absent",
        impact: hasEmotional
          ? "Emotional openness builds deep connection quickly, but it needs to be paced. If it appears very early, it can feel intense. Let it emerge naturally."
          : "Some emotional expression helps others feel safe to open up with you. Try naming how you feel occasionally, it's a signal that you're paying attention.",
      },
    ],
    attachmentStyle: attachmentStyles[styleIndex],
    strengths: [
      hasHumor
        ? "Natural use of humor to create warmth and ease"
        : "Clear and direct, people know where they stand with you",
      isLongMessages
        ? "Demonstrable investment, you take conversations seriously"
        : "Efficient communicator, easy to keep up with",
      hasQuestions > 3
        ? "Genuine curiosity about the other person"
        : "Calm, assured presence in written communication",
      "Self-awareness in how you present yourself",
    ],
    growthAreas: [
      isLongMessages
        ? "Practice the 'one breath' edit, if a message takes more than one breath to read aloud, shorten it"
        : "Try occasionally matching someone's energy by elaborating when they go deep",
      hasEmotional && styleIndex === 1
        ? "Notice patterns of seeking reassurance, the goal is to self-soothe first, then communicate"
        : "Practice naming one specific emotion per conversation thread",
      hasQuestions < 3
        ? "Ask more questions, curiosity is irresistible when it feels genuine"
        : "Balance questions with personal disclosures, reciprocity matters",
      ...(insightSourceGrowthArea(source) ? [insightSourceGrowthArea(source) as string] : []),
    ],
    datingProfileTips: [
      hasHumor
        ? "Bring the humor into your profile, it's one of your strongest assets. One specific, funny detail beats three generic lines."
        : "Your profile likely reads as earnest. Add one line with lightness, it will disarm readers who are on defense.",
      isLongMessages
        ? "Your bio may be too long. Cut it by 30% and see if it gets more matches, less is almost always more."
        : "You might be under-writing your bio. Give readers something specific to respond to.",
      styleIndex === 1
        ? "Lead with who you are, not what you're looking for. Profiles that open with needs signal low confidence."
        : "Your restraint can read as confidence, lean into that. Be direct about what you want.",
      ...(insightSourceProfileTip(source)
        ? [insightSourceProfileTip(source) as string]
        : ["Add at least one prompt that ends with an implicit question, it converts profile views to messages far better than static statements."]),
    ],
    summary: `Based on ${wordCount} words of conversation from ${params.sourceLabel}, your communication fingerprint is: ${attachmentStyles[styleIndex].split(",")[0].trim()}. ${hasHumor ? "Your natural humor is a real asset, it's the kind of thing people remember and seek out." : "You communicate with clarity and intention."} ${hasEmotional ? "You're emotionally present, which creates depth quickly, the growth edge is pacing that openness." : "Your restraint creates calm, but sometimes people need a little more warmth to feel safe opening up."} The patterns in this sample suggest your dating profile and conversation style could be better aligned, the coaching recommendations above will help bridge that gap.${insightSourceSummaryAddendum(source)}`,
    sourceApp: source,
  };
}

// ============================================================================
// Cross-audit trend analysis ("Build the Mirror"), task #547
//
// Deterministic aggregate of the user's audit history, send-through stats, and
// life-pulses into a single TrendReport. No external AI. Output shape is part
// of the API contract (see MirrorTrendReport in openapi.yaml).
// ============================================================================

export interface AuditTrendInputAudit {
  id?: number | null;
  readinessScore: number | null;
  strengths?: string[] | null;
  risks?: string[] | null;
  createdAt: string;
  currentApps?: string[] | null;
  biggestChallenge?: string | null;
}

export interface TrendReportTheme {
  key: string;
  label: string;
  count: number;
  firstSeenAuditId: number | null;
  lastSeenAuditId: number | null;
}

export interface TrendReportThemeShift {
  key: string;
  label: string;
  from: number;
  to: number;
  direction: "emerged" | "faded" | "steady";
}

export interface TrendReportScoreDelta {
  first: number | null;
  latest: number | null;
  previous: number | null;
  delta: number;
  currentVsPrevious: number;
  rolling30Delta: number;
  direction: "up" | "down" | "flat";
}

export interface TrendReportEngagement {
  firstAuditAt: string | null;
  latestAuditAt: string | null;
  avgGapDays: number | null;
  mostActiveDay: string | null;
  daysSinceLatest: number | null;
  auditsPerMonth: number;
  dormancyGapCount: number;
}

export interface TrendReportSignal {
  label: string;
  tone: "positive" | "watch" | "neutral";
}

export interface TrendReportScorePoint {
  auditId: number | null;
  score: number;
  createdAt: string;
}

export interface TrendReportOutcomeStreak {
  /** Consecutive most-recent post-date notes whose outcome is "another_date". */
  positiveStreak: number;
  /** Most recent recorded outcome, or null if no notes have one. */
  latestOutcome: string | null;
  /** Total post-date notes with a recorded outcome. */
  totalWithOutcome: number;
}

export interface TrendReportMoodTrend {
  /** Recent journal entries considered (last ~14 days, capped at 7). */
  recentCount: number;
  /** Mean mood across recent entries, rounded to 0.1; null if no moods. */
  averageMood: number | null;
  /** "rising" | "falling" | "steady" | "unknown" based on recent vs older avg. */
  direction: "rising" | "falling" | "steady" | "unknown";
}

export interface TrendReportJournalingStreak {
  /** Consecutive UTC days with at least one journal entry, ending today/yesterday. */
  currentStreakDays: number;
  /** Distinct UTC days journaled within the last 14 days. */
  daysInLast14: number;
  /** Total journal entries. */
  totalEntries: number;
}

export interface TrendReport {
  hasEnoughData: boolean;
  totalAudits: number;
  spanDays: number;
  repeatedStrengths: TrendReportTheme[];
  recurringRisks: TrendReportTheme[];
  scoreDelta: TrendReportScoreDelta;
  themeShifts: TrendReportThemeShift[];
  engagementWindow: TrendReportEngagement;
  readinessSignals: TrendReportSignal[];
  readinessScore: number;
  scoreHistory: TrendReportScorePoint[];
  outcomeStreak: TrendReportOutcomeStreak;
  journalingStreak: TrendReportJournalingStreak;
  moodTrend: TrendReportMoodTrend;
  headlineInsight: string;
  engineVersion: string;
}

export interface JournalTrendInput {
  createdAt: string;
  mood?: number | null;
}

export interface PostDateNoteTrendInput {
  dateAt?: string | null;
  createdAt: string;
  outcome?: string | null;
}

const TREND_THEMES: { key: string; label: string; words: string[] }[] = [
  { key: "warmth", label: "Warmth", words: ["warm", "warmth", "genuine", "kind"] },
  { key: "specificity", label: "Specificity", words: ["specific", "vivid", "detail", "concrete", "particular"] },
  { key: "intention", label: "Clarity of intention", words: ["intent", "clear sense", "purpose", "direct", "looking for"] },
  { key: "playfulness", label: "Playfulness", words: ["playful", "fun", "humor", "humour", "laugh", "wit", "light"] },
  { key: "depth", label: "Emotional depth", words: ["depth", "vulnerab", "honest", "open ", "real "] },
  { key: "generic", label: "Generic phrasing", words: ["generic", "vague", "common", "cliché", "cliche", "platitude", "dilute"] },
  { key: "opener", label: "Opener strength", words: ["opener", "opening", "first message", "hook"] },
  { key: "photos", label: "Photo set", words: ["photo", "picture", "image"] },
  { key: "consistency", label: "Follow-through", words: ["consisten", "follow-through", "reliab", "steady"] },
  { key: "confidence", label: "Confidence", words: ["confiden", "self-assur"] },
];

function tagThemes(lines: string[]): Set<string> {
  const matched = new Set<string>();
  for (const raw of lines) {
    const text = (raw || "").toLowerCase();
    if (!text.trim()) continue;
    for (const t of TREND_THEMES) {
      if (t.words.some((w) => text.includes(w))) matched.add(t.key);
    }
  }
  return matched;
}

function themeLabel(key: string): string {
  return TREND_THEMES.find((t) => t.key === key)?.label ?? key;
}

function dayOfWeek(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
}

export function analyzeAuditTrends(params: {
  audits: AuditTrendInputAudit[];
  sendStats?: { totalPrompts: number; sentCount: number } | null;
  lifePulses?: { energy: number; headspace: number; createdAt: string }[] | null;
  journalEntries?: JournalTrendInput[] | null;
  postDateNotes?: PostDateNoteTrendInput[] | null;
  now?: Date;
}): TrendReport {
  const now = params.now ?? new Date();
  const audits = [...(params.audits ?? [])]
    .filter((a) => a && !Number.isNaN(Date.parse(a.createdAt)))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  const total = audits.length;
  const scored = audits.filter(
    (a): a is AuditTrendInputAudit & { readinessScore: number } =>
      typeof a.readinessScore === "number",
  );

  const firstAuditAt = audits[0]?.createdAt ?? null;
  const latestAuditAt = audits[audits.length - 1]?.createdAt ?? null;
  const spanDays =
    firstAuditAt && latestAuditAt
      ? Math.max(
          0,
          Math.round(
            (Date.parse(latestAuditAt) - Date.parse(firstAuditAt)) / 86_400_000,
          ),
        )
      : 0;

  const gaps: number[] = [];
  for (let i = 1; i < audits.length; i++) {
    const d =
      (Date.parse(audits[i].createdAt) - Date.parse(audits[i - 1].createdAt)) /
      86_400_000;
    if (Number.isFinite(d) && d >= 0) gaps.push(d);
  }
  const avgGapDays = gaps.length
    ? Math.round((gaps.reduce((s, x) => s + x, 0) / gaps.length) * 10) / 10
    : null;

  const dayCounts = new Map<string, number>();
  for (const a of audits) {
    const dow = dayOfWeek(a.createdAt);
    if (!dow) continue;
    dayCounts.set(dow, (dayCounts.get(dow) ?? 0) + 1);
  }
  let mostActiveDay: string | null = null;
  let mostActiveCount = 0;
  for (const [day, c] of dayCounts.entries()) {
    if (c > mostActiveCount) {
      mostActiveDay = day;
      mostActiveCount = c;
    }
  }
  const daysSinceLatest = latestAuditAt
    ? Math.max(
        0,
        Math.round((now.getTime() - Date.parse(latestAuditAt)) / 86_400_000),
      )
    : null;

  const strengthCounts = new Map<string, number>();
  const riskCounts = new Map<string, number>();
  const strengthFirstSeen = new Map<string, number | null>();
  const strengthLastSeen = new Map<string, number | null>();
  const riskFirstSeen = new Map<string, number | null>();
  const riskLastSeen = new Map<string, number | null>();
  const auditThemes: { strengths: Set<string>; risks: Set<string> }[] = [];
  for (const a of audits) {
    const auditId = typeof a.id === "number" ? a.id : null;
    const sTags = tagThemes(a.strengths ?? []);
    const rTags = tagThemes(a.risks ?? []);
    auditThemes.push({ strengths: sTags, risks: rTags });
    for (const k of sTags) {
      strengthCounts.set(k, (strengthCounts.get(k) ?? 0) + 1);
      if (!strengthFirstSeen.has(k)) strengthFirstSeen.set(k, auditId);
      strengthLastSeen.set(k, auditId);
    }
    for (const k of rTags) {
      riskCounts.set(k, (riskCounts.get(k) ?? 0) + 1);
      if (!riskFirstSeen.has(k)) riskFirstSeen.set(k, auditId);
      riskLastSeen.set(k, auditId);
    }
  }
  const minRepeat = 2;
  const toList = (
    m: Map<string, number>,
    firstSeen: Map<string, number | null>,
    lastSeen: Map<string, number | null>,
  ): TrendReportTheme[] =>
    [...m.entries()]
      .filter(([, c]) => c >= minRepeat)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([key, count]) => ({
        key,
        label: themeLabel(key),
        count,
        firstSeenAuditId: firstSeen.get(key) ?? null,
        lastSeenAuditId: lastSeen.get(key) ?? null,
      }));
  const repeatedStrengths = toList(
    strengthCounts,
    strengthFirstSeen,
    strengthLastSeen,
  );
  const recurringRisks = toList(riskCounts, riskFirstSeen, riskLastSeen);

  const themeShifts: TrendReportThemeShift[] = [];
  if (audits.length >= 2) {
    const mid = Math.ceil(audits.length / 2);
    const firstHalf = auditThemes.slice(0, mid);
    const secondHalf = auditThemes.slice(mid);
    const tally = (slice: typeof auditThemes, kind: "strengths" | "risks") => {
      const m = new Map<string, number>();
      for (const t of slice) for (const k of t[kind]) m.set(k, (m.get(k) ?? 0) + 1);
      return m;
    };
    const fhS = tally(firstHalf, "strengths");
    const shS = tally(secondHalf, "strengths");
    const fhR = tally(firstHalf, "risks");
    const shR = tally(secondHalf, "risks");
    const keys = new Set<string>([
      ...fhS.keys(), ...shS.keys(), ...fhR.keys(), ...shR.keys(),
    ]);
    for (const key of keys) {
      const from = (fhS.get(key) ?? 0) + (fhR.get(key) ?? 0);
      const to = (shS.get(key) ?? 0) + (shR.get(key) ?? 0);
      if (from === to) continue;
      const dir: TrendReportThemeShift["direction"] =
        from === 0 ? "emerged" : to === 0 ? "faded" : "steady";
      themeShifts.push({ key, label: themeLabel(key), from, to, direction: dir });
    }
    themeShifts.sort(
      (a, b) =>
        Math.abs(b.to - b.from) - Math.abs(a.to - a.from) ||
        a.key.localeCompare(b.key),
    );
  }

  const firstScore = scored[0]?.readinessScore ?? null;
  const latestScore = scored[scored.length - 1]?.readinessScore ?? null;
  const previousScore =
    scored.length >= 2 ? scored[scored.length - 2].readinessScore : null;
  const delta =
    firstScore !== null && latestScore !== null ? latestScore - firstScore : 0;
  const currentVsPrevious =
    previousScore !== null && latestScore !== null
      ? latestScore - previousScore
      : 0;
  const cutoff30 = now.getTime() - 30 * 86_400_000;
  const inWindow30 = scored.filter((a) => Date.parse(a.createdAt) >= cutoff30);
  const olderBeforeWindow = scored.filter(
    (a) => Date.parse(a.createdAt) < cutoff30,
  );
  const rolling30Delta =
    inWindow30.length >= 1 && olderBeforeWindow.length >= 1
      ? inWindow30[inWindow30.length - 1].readinessScore -
        olderBeforeWindow[olderBeforeWindow.length - 1].readinessScore
      : inWindow30.length >= 2
      ? inWindow30[inWindow30.length - 1].readinessScore -
        inWindow30[0].readinessScore
      : 0;
  const direction: TrendReportScoreDelta["direction"] =
    delta >= 5 ? "up" : delta <= -5 ? "down" : "flat";

  const auditsPerMonth =
    spanDays > 0
      ? Math.round((total / Math.max(spanDays, 1)) * 30 * 10) / 10
      : total > 0
      ? total
      : 0;
  const dormancyGapCount = gaps.filter((g) => g > 30).length;

  const scoreHistory: TrendReportScorePoint[] = scored.map((a) => ({
    auditId: typeof a.id === "number" ? a.id : null,
    score: a.readinessScore,
    createdAt: a.createdAt,
  }));

  const signals: TrendReportSignal[] = [];
  if (firstScore !== null && latestScore !== null && scored.length >= 2) {
    if (direction === "up") {
      signals.push({
        label: `+${delta} point score lift since your first audit`,
        tone: "positive",
      });
    } else if (direction === "down") {
      signals.push({
        label: `${delta} point dip since your first audit, worth a closer look`,
        tone: "watch",
      });
    } else {
      signals.push({
        label: `Score is steady within ${Math.abs(delta)} pt, small wins still count`,
        tone: "neutral",
      });
    }
  }
  if (params.sendStats && params.sendStats.totalPrompts >= 3) {
    const rate = params.sendStats.sentCount / params.sendStats.totalPrompts;
    const pct = Math.round(rate * 100);
    if (rate >= 0.6) {
      signals.push({
        label: `${pct}% send-through on coached replies, momentum is real`,
        tone: "positive",
      });
    } else if (rate <= 0.25) {
      signals.push({
        label: `${pct}% send-through, drafts piling up faster than they go out`,
        tone: "watch",
      });
    } else {
      signals.push({
        label: `${pct}% send-through on coached replies`,
        tone: "neutral",
      });
    }
  }
  if (avgGapDays !== null) {
    if (avgGapDays <= 14) {
      signals.push({
        label: `Showing up every ~${Math.round(avgGapDays)} days, consistent rhythm`,
        tone: "positive",
      });
    } else if (avgGapDays > 30) {
      signals.push({
        label: `~${Math.round(avgGapDays)}-day gaps between audits, easy to lose the thread`,
        tone: "watch",
      });
    }
  }
  if (daysSinceLatest !== null && daysSinceLatest > 45 && total >= 2) {
    signals.push({
      label: `Last audit was ${daysSinceLatest} days ago, time for a fresh read`,
      tone: "watch",
    });
  }
  if (recurringRisks.length > 0 && recurringRisks[0].count >= 2) {
    signals.push({
      label: `"${recurringRisks[0].label}" keeps coming up, that's the one to fix first`,
      tone: "watch",
    });
  }
  if (params.lifePulses && params.lifePulses.length >= 3) {
    const recent = params.lifePulses.slice(0, 7);
    const avgEnergy =
      recent.reduce((s, p) => s + (p.energy ?? 0), 0) / recent.length;
    const avgHeadspace =
      recent.reduce((s, p) => s + (p.headspace ?? 0), 0) / recent.length;
    if (avgEnergy >= 4) {
      signals.push({
        label: "Energy is trending steady, good fuel for the work",
        tone: "positive",
      });
    }
    if (avgHeadspace <= 2.5) {
      signals.push({
        label: "Headspace is running low, keep moves small this week",
        tone: "watch",
      });
    }
  }

  const hasEnoughData =
    total >= 2 ||
    (total >= 1 &&
      ((params.sendStats?.totalPrompts ?? 0) >= 3 ||
        (params.lifePulses?.length ?? 0) >= 3));

  let headlineInsight: string;
  if (total === 0) {
    headlineInsight =
      "Your Mirror will start filling in once you complete your first audit, patterns need at least one data point to begin.";
  } else if (!hasEnoughData) {
    headlineInsight =
      "One audit in. Run a second pass after you've made a change or two, that's when patterns start to show.";
  } else {
    const pieces: string[] = [];
    pieces.push(
      `${total} audit${total === 1 ? "" : "s"}${spanDays > 0 ? ` across ${spanDays} day${spanDays === 1 ? "" : "s"}` : ""}.`,
    );
    if (direction === "up") {
      pieces.push(
        `Your score is up ${delta} points since you started, that's real movement.`,
      );
    } else if (direction === "down") {
      pieces.push(
        `Your score has slipped ${Math.abs(delta)} points, worth understanding why before pushing harder.`,
      );
    } else if (firstScore !== null && latestScore !== null && scored.length >= 2) {
      pieces.push(
        "Your score is holding steady, the next move is sharpening one specific thing.",
      );
    }
    if (repeatedStrengths.length > 0) {
      pieces.push(
        `${repeatedStrengths[0].label} keeps showing up as a real strength, lean into it.`,
      );
    }
    if (recurringRisks.length > 0) {
      pieces.push(
        `The pattern to break: ${recurringRisks[0].label.toLowerCase()}.`,
      );
    } else {
      const emerged = themeShifts.find((s) => s.direction === "emerged");
      if (emerged) {
        pieces.push(
          `${emerged.label} has started to emerge, keep building on it.`,
        );
      }
    }
    headlineInsight = pieces.join(" ");
  }

  const postDateNotes = [...(params.postDateNotes ?? [])]
    .map((n) => {
      const refIso = n.dateAt ?? n.createdAt;
      const ref = Date.parse(refIso);
      return { ref, outcome: n.outcome ?? null };
    })
    .filter((n) => Number.isFinite(n.ref))
    .sort((a, b) => b.ref - a.ref);
  let positiveStreak = 0;
  let latestOutcome: string | null = null;
  let totalWithOutcome = 0;
  for (const n of postDateNotes) {
    if (n.outcome) {
      totalWithOutcome += 1;
      if (latestOutcome === null) latestOutcome = n.outcome;
    }
  }
  for (const n of postDateNotes) {
    if (!n.outcome) continue;
    if (n.outcome === "another_date") positiveStreak += 1;
    else break;
  }
  const outcomeStreak: TrendReportOutcomeStreak = {
    positiveStreak,
    latestOutcome,
    totalWithOutcome,
  };

  const journalEntries = [...(params.journalEntries ?? [])]
    .map((j) => ({
      ts: Date.parse(j.createdAt),
      mood: typeof j.mood === "number" ? j.mood : null,
    }))
    .filter((j) => Number.isFinite(j.ts))
    .sort((a, b) => b.ts - a.ts);
  const dayKey = (ts: number): string => {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  };
  const todayKey = dayKey(now.getTime());
  const yesterdayKey = dayKey(now.getTime() - 86_400_000);
  const journaledDays = new Set<string>();
  for (const j of journalEntries) journaledDays.add(dayKey(j.ts));
  let currentStreakDays = 0;
  if (journaledDays.has(todayKey) || journaledDays.has(yesterdayKey)) {
    const startOffset = journaledDays.has(todayKey) ? 0 : 1;
    for (let i = startOffset; i < 365; i++) {
      if (journaledDays.has(dayKey(now.getTime() - i * 86_400_000))) {
        currentStreakDays += 1;
      } else {
        break;
      }
    }
  }
  // "Last 14 days" = today + the 13 prior UTC days (max 14 distinct days),
  // matching the contract's `daysInLast14 <= 14` cap.
  const cutoff14 = now.getTime() - 13 * 86_400_000;
  const recent14Days = new Set<string>();
  for (const j of journalEntries) {
    if (j.ts >= cutoff14) recent14Days.add(dayKey(j.ts));
  }
  const daysInLast14 = Math.min(14, recent14Days.size);
  const journalingStreak: TrendReportJournalingStreak = {
    currentStreakDays,
    daysInLast14,
    totalEntries: journalEntries.length,
  };

  const recentMoodEntries = journalEntries
    .filter((j) => j.ts >= cutoff14 && j.mood !== null)
    .slice(0, 7) as { ts: number; mood: number }[];
  const olderMoodEntries = journalEntries
    .filter((j) => j.ts < cutoff14 && j.mood !== null)
    .slice(0, 7) as { ts: number; mood: number }[];
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  const recentMoodAvg = avg(recentMoodEntries.map((j) => j.mood));
  const olderMoodAvg = avg(olderMoodEntries.map((j) => j.mood));
  let moodDirection: TrendReportMoodTrend["direction"] = "unknown";
  if (recentMoodAvg !== null && olderMoodAvg !== null) {
    const diff = recentMoodAvg - olderMoodAvg;
    moodDirection = diff >= 0.5 ? "rising" : diff <= -0.5 ? "falling" : "steady";
  } else if (recentMoodAvg !== null) {
    moodDirection = "steady";
  }
  const moodTrend: TrendReportMoodTrend = {
    recentCount: recentMoodEntries.length,
    averageMood:
      recentMoodAvg !== null ? Math.round(recentMoodAvg * 10) / 10 : null,
    direction: moodDirection,
  };

  if (journalingStreak.currentStreakDays >= 3) {
    signals.push({
      label: `Journaling ${journalingStreak.currentStreakDays} days in a row, reflection is compounding`,
      tone: "positive",
    });
  } else if (
    journalingStreak.totalEntries >= 2 &&
    journalingStreak.daysInLast14 === 0
  ) {
    signals.push({
      label: "Journaling has gone quiet, a short entry resets the rhythm",
      tone: "watch",
    });
  }
  if (moodTrend.recentCount >= 2 && moodTrend.averageMood !== null) {
    if (moodTrend.direction === "rising") {
      signals.push({
        label: `Mood is trending up (avg ${moodTrend.averageMood.toFixed(1)}/5), ride it`,
        tone: "positive",
      });
    } else if (moodTrend.direction === "falling") {
      signals.push({
        label: `Mood is sliding (avg ${moodTrend.averageMood.toFixed(1)}/5), protect headspace this week`,
        tone: "watch",
      });
    }
  }
  if (outcomeStreak.positiveStreak >= 2) {
    signals.push({
      label: `${outcomeStreak.positiveStreak} dates in a row led to another, something is clicking`,
      tone: "positive",
    });
  } else if (
    outcomeStreak.latestOutcome === "ghosted" &&
    outcomeStreak.totalWithOutcome >= 2
  ) {
    signals.push({
      label: "Last date ended in a ghost, pattern worth revisiting in Coach",
      tone: "watch",
    });
  }

  let readinessScore = latestScore ?? 50;
  readinessScore +=
    direction === "up" ? 5 : direction === "down" ? -5 : 0;
  if (params.sendStats && params.sendStats.totalPrompts >= 3) {
    const rate = params.sendStats.sentCount / params.sendStats.totalPrompts;
    readinessScore += rate >= 0.6 ? 5 : rate <= 0.25 ? -5 : 0;
  }
  if (avgGapDays !== null) {
    if (avgGapDays <= 14) readinessScore += 3;
    else if (avgGapDays > 30) readinessScore -= 3;
  }
  if (daysSinceLatest !== null && daysSinceLatest > 45 && total >= 2) {
    readinessScore -= 5;
  }
  if (dormancyGapCount >= 2) readinessScore -= 3;
  if (params.lifePulses && params.lifePulses.length >= 3) {
    const recent = params.lifePulses.slice(0, 7);
    const avgHeadspace =
      recent.reduce((s, p) => s + (p.headspace ?? 0), 0) / recent.length;
    if (avgHeadspace <= 2.5) readinessScore -= 3;
  }
  readinessScore = Math.max(0, Math.min(100, Math.round(readinessScore)));

  return {
    hasEnoughData,
    totalAudits: total,
    spanDays,
    repeatedStrengths,
    recurringRisks,
    scoreDelta: {
      first: firstScore,
      latest: latestScore,
      previous: previousScore,
      delta,
      currentVsPrevious,
      rolling30Delta,
      direction,
    },
    themeShifts,
    engagementWindow: {
      firstAuditAt,
      latestAuditAt,
      avgGapDays,
      mostActiveDay,
      daysSinceLatest,
      auditsPerMonth,
      dormancyGapCount,
    },
    readinessSignals: signals,
    readinessScore,
    scoreHistory,
    outcomeStreak,
    journalingStreak,
    moodTrend,
    headlineInsight,
    engineVersion: ENGINE_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Rehearsal Room: deterministic baseline for practicing the conversations that
// actually decide a relationship (the define-the-relationship talk, the first
// vulnerable thing, a boundary, a repair, asking for a need, a kind ending).
// The other person is played back to the user so they can rehearse before they
// live it. This is the always-on baseline; the Claude layer in
// routes/rehearsal.ts deepens it when the account has granted content consent.
// ---------------------------------------------------------------------------

export type RehearsalRole = "you" | "them";

export interface RehearsalTurn {
  role: RehearsalRole;
  text: string;
}

export interface RehearsalTurnInput {
  scenario: string;
  theirStyle?: string;
  transcript: RehearsalTurn[];
}

export interface RehearsalTurnOutput {
  reply: string;
  note: string;
  tone: string;
}

interface RehearsalScenarioDef {
  label: string;
  opening: string[];
  engaged: string[];
  guarded: string[];
  warm: string[];
  note: string;
}

export const REHEARSAL_SCENARIOS: Record<string, RehearsalScenarioDef> = {
  define_the_relationship: {
    label: "Define the relationship",
    opening: [
      "I've had a really good time with you. Can I ask where your head is at with this, with us?",
      "Before this goes any further, I want to be honest about what I'm looking for. Where are you at?",
    ],
    engaged: [
      "Okay. I appreciate you saying that. I think I want something real too, I just get scared to say it out loud.",
      "That's good to hear. I've been wanting to talk about this for a while and didn't know how to start.",
    ],
    guarded: [
      "That's a lot to put on the table right now. I don't know if I'm ready to call it anything yet.",
      "I like you, I just don't want to rush into deciding what this is.",
    ],
    warm: [
      "Thank you for being straight with me. It actually makes me trust this more.",
      "I'm glad you said it first. I feel the same way, I was just nervous to be the one to bring it up.",
    ],
    note: "Name what you actually want before you ask what they want. Clarity is a gift here, not pressure.",
  },
  first_vulnerable: {
    label: "Say something real",
    opening: [
      "You seem like you've got something on your mind. You can tell me, I mean it.",
      "I feel like we've been keeping things light. I'd like to know the real you.",
    ],
    engaged: [
      "Thank you for trusting me with that. It means more than you know.",
      "I'm really glad you told me. I want to know this side of you, not just the easy parts.",
    ],
    guarded: [
      "Oh. That's heavier than I expected. I'm not totally sure what to do with it yet.",
      "I wasn't ready for that. Give me a second to take it in.",
    ],
    warm: [
      "That took guts to say. I'm here, I'm not going anywhere.",
      "I feel closer to you right now than I have this whole time.",
    ],
    note: "Vulnerability lands when it's specific. Share the actual thing, not a tidy summary of it.",
  },
  set_a_boundary: {
    label: "Set a boundary",
    opening: [
      "Hey, you said you wanted to talk. What's going on?",
      "You wanted to bring something up? I'm listening.",
    ],
    engaged: [
      "Okay, I hear you. I honestly didn't realize that was bothering you.",
      "That's fair. I can work with that.",
    ],
    guarded: [
      "Wow, okay. I didn't think it was that big of a deal.",
      "That kind of feels like you're making me the bad guy here.",
    ],
    warm: [
      "Thank you for telling me instead of just pulling away. I respect that.",
      "I want you to feel comfortable with me. Let's figure this out together.",
    ],
    note: "State the boundary as a request, not an accusation. 'I need' opens the conversation; 'you always' starts a fight.",
  },
  repair_after_misstep: {
    label: "Repair after a misstep",
    opening: [
      "I'm honestly still a little hurt about earlier.",
      "I wasn't going to say anything, but what happened earlier didn't sit right with me.",
    ],
    engaged: [
      "I appreciate you owning it. That actually helps more than you'd think.",
      "Okay. Thank you for saying that. I was waiting to see if you would.",
    ],
    guarded: [
      "I mean, okay, but it felt like more than a small thing to me.",
      "I want to believe you, I just need to see it, not only hear it.",
    ],
    warm: [
      "That means a lot. We're okay. Really.",
      "Thank you. That's honestly all I needed.",
    ],
    note: "A real apology has no 'but' in it. Own your part first, explain second, if at all.",
  },
  express_a_need: {
    label: "Ask for what you need",
    opening: [
      "What's going on? You've seemed a little off lately.",
      "You can tell me what you need from me. I'd rather know than guess.",
    ],
    engaged: [
      "I want to give you that. Thank you for telling me instead of expecting me to read your mind.",
      "Okay, that's doable. I'm glad you actually asked.",
    ],
    guarded: [
      "That feels like a lot to ask of me right now.",
      "I'm trying, it just feels like nothing I do is ever enough.",
    ],
    warm: [
      "I love that you can ask for what you need. Not everyone can do that.",
      "Done. I want you to feel taken care of in this.",
    ],
    note: "Ask for the need directly. People cannot meet a need they have to decode first.",
  },
  end_it_kindly: {
    label: "End it kindly",
    opening: [
      "You've been quiet. Is everything okay with us?",
      "I get the feeling you've got something hard to say.",
    ],
    engaged: [
      "I figured this might be coming. Thank you for telling me to my face.",
      "That hurts, but I appreciate you being honest instead of just disappearing.",
    ],
    guarded: [
      "So that's it? Just like that?",
      "Did I do something wrong, or is this just where you are?",
    ],
    warm: [
      "I'm sad, but I'm grateful for the time we had. Take care of yourself.",
      "Thank you for being kind about it. That's rarer than it should be.",
    ],
    note: "Be clear and be kind at the same time. Don't leave the door cracked to soften it; that is harder on both of you than a clean goodbye.",
  },
};

function rehearsalSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function rehearsalPick<T>(bank: T[], seed: number): T {
  return bank[seed % bank.length] as T;
}

export function generateRehearsalTurn(input: RehearsalTurnInput): RehearsalTurnOutput {
  const scenario =
    REHEARSAL_SCENARIOS[input.scenario] ?? REHEARSAL_SCENARIOS.define_the_relationship!;
  const turns = Array.isArray(input.transcript) ? input.transcript : [];
  const youTurns = turns.filter((t) => t.role === "you");
  const seed = rehearsalSeed(
    (youTurns[youTurns.length - 1]?.text ?? "") + ":" + String(turns.length),
  );

  // No user turns yet: the other person opens the scene.
  if (youTurns.length === 0) {
    return {
      reply: rehearsalPick(scenario.opening, seed),
      note: scenario.note,
      tone: "opening the door",
    };
  }

  const last = (youTurns[youTurns.length - 1]?.text ?? "").toLowerCase();
  const hasApology = /\b(sorry|my fault|i was wrong|apolog)/.test(last);
  const hasAbsolute = /\b(always|never|every time|constantly|nothing|everything)\b/.test(last);
  const hasQuestion = last.includes("?");
  const hedging = /\b(maybe|i guess|kind of|kinda|sort of|i don'?t know|idk)\b/.test(last);
  const harsh = /\b(whatever|you don'?t|you never|your fault|grow up|over it)\b/.test(last);

  let reply: string;
  let tone: string;
  if (harsh || hasAbsolute) {
    reply = rehearsalPick(scenario.guarded, seed);
    tone = "guarded, a little defensive";
  } else if (hasApology) {
    reply = rehearsalPick(scenario.warm, seed);
    tone = "softening";
  } else {
    reply = rehearsalPick(scenario.engaged, seed);
    tone = "engaged and listening";
  }

  let note: string;
  if (harsh) {
    note =
      "That landed sharp. You can be honest without the edge. Lead with how you feel, not with what they did wrong.";
  } else if (hasAbsolute) {
    note =
      "Watch the absolutes. 'Always' and 'never' make people defend instead of listen. Name the one specific moment instead.";
  } else if (hedging) {
    note =
      "You hedged. 'Maybe' and 'I guess' hide what you actually want. Say the real thing, plainly.";
  } else if (hasApology) {
    note =
      "Good repair. A clean apology with no 'but' after it is one of the hardest and most powerful moves there is.";
  } else if (hasQuestion) {
    note =
      "Nice, you opened a real door with that question. Now hold the silence and let them actually answer.";
  } else {
    note = scenario.note;
  }

  return { reply, note, tone };
}

// ───────────────────────────────────────────────────────────────────────────
// Your Mirror: the brain you can talk to.
//
// Every tool, quiz, import, and reflection feeds one evolving model of the
// user. This is the deterministic synthesis layer over that model. It turns the
// readiness breakdown (real per-lane coverage gathered from the database) into
// a plain-English self-portrait, names what the machine cannot see yet, and
// points at the single highest-leverage thing to feed it next. This is the
// always-on baseline. The route layers Claude on top for richer phrasing when
// the account has opted into the deep AI lane. It never calls out and never
// throws on empty input, so the Mirror is never blank.
// ───────────────────────────────────────────────────────────────────────────

export interface MirrorKnownDimension {
  key: string;
  label: string;
  coverage: number;
  confidence: number;
  insight: string;
  dimensions: string[];
}

export interface MirrorBlindSpot {
  key: string;
  label: string;
  why: string;
  actionLabel: string;
  href: string;
}

export interface MirrorNextSignal {
  key: string;
  label: string;
  detail: string;
  href: string;
  points: number;
}

export type MirrorStage = "outline" | "forming" | "sharp" | "vivid";

export interface MirrorPortrait {
  readinessScore: number;
  stage: MirrorStage;
  stageLabel: string;
  stageBlurb: string;
  coveragePercent: number;
  headline: string;
  known: MirrorKnownDimension[];
  blindSpots: MirrorBlindSpot[];
  nextSignal: MirrorNextSignal | null;
  outcomeHeadline: string;
  totalDates: number;
  eligible: boolean;
  threshold: number;
  engineVersion: string;
}

export interface MirrorPortraitInput {
  breakdown: ReadinessBreakdown;
  score: number;
  eligible: boolean;
  threshold: number;
  nextActions: ReadinessNextAction[];
  outcome: OutcomeInsight;
}

const MIRROR_THIN_COVERAGE = 34;

function mirrorStage(
  score: number,
  threshold: number,
): { stage: MirrorStage; stageLabel: string; stageBlurb: string } {
  if (score >= 80) {
    return {
      stage: "vivid",
      stageLabel: "Vivid model",
      stageBlurb:
        "The machine has a detailed read on who you are and what fits you. Keep feeding it and the matches get sharper.",
    };
  }
  if (score >= threshold) {
    return {
      stage: "sharp",
      stageLabel: "Sharp picture",
      stageBlurb:
        "The picture is clear enough to start matching you with people you would not find on your own.",
    };
  }
  if (score >= 20) {
    return {
      stage: "forming",
      stageLabel: "Coming into focus",
      stageBlurb:
        "You are taking shape. A couple more signals and the machine can start matching you.",
    };
  }
  return {
    stage: "outline",
    stageLabel: "Faint outline",
    stageBlurb:
      "Right now the machine only has a faint outline of you. Every tool you use fills it in.",
  };
}

/**
 * Build the deterministic self-portrait from a user's real signal coverage.
 * Pure and total: every field is populated even when the user has fed nothing
 * yet, so the Mirror page is never empty.
 */
export function buildMirrorPortrait(input: MirrorPortraitInput): MirrorPortrait {
  const { breakdown, score, eligible, threshold, nextActions, outcome } = input;

  const known: MirrorKnownDimension[] = SIGNAL_REGISTRY.filter(
    (c) => (breakdown[c.id] ?? 0) > 0,
  )
    .map((c) => {
      const coverage = Math.round(breakdown[c.id] ?? 0);
      return {
        key: c.id,
        label: c.label,
        coverage,
        confidence: Math.round(c.confidence * 100),
        insight: c.describe(coverage),
        dimensions: [...c.dimensions],
      };
    })
    .sort((a, b) => b.coverage * b.confidence - a.coverage * a.confidence);

  const blindSpots: MirrorBlindSpot[] = SIGNAL_REGISTRY.filter(
    (c) => (breakdown[c.id] ?? 0) < MIRROR_THIN_COVERAGE,
  )
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((c) => {
      const coverage = Math.round(breakdown[c.id] ?? 0);
      return {
        key: c.id,
        label: c.label,
        why:
          coverage === 0
            ? `The machine has nothing here yet. ${c.action.detail}`
            : `The machine only has a thin read here. ${c.action.detail}`,
        actionLabel: c.action.label,
        href: c.action.href,
      };
    });

  const totalLanes = SIGNAL_REGISTRY.length;
  const lanesWithSignal = SIGNAL_REGISTRY.filter(
    (c) => (breakdown[c.id] ?? 0) > 0,
  ).length;
  const coveragePercent =
    totalLanes === 0 ? 0 : Math.round((100 * lanesWithSignal) / totalLanes);

  const top = nextActions[0] ?? null;
  const nextSignal: MirrorNextSignal | null = top
    ? {
        key: top.key,
        label: top.label,
        detail: top.detail,
        href: top.href,
        points: top.points,
      }
    : null;

  let headline: string;
  if (known.length === 0) {
    headline =
      "The machine does not know you yet. Run a tool, answer a quiz, or import a profile and this fills in fast.";
  } else {
    const lead = known[0]!.label.toLowerCase();
    const second = known[1]?.label.toLowerCase();
    const through = second ? `${lead} and ${second}` : lead;
    const gap = blindSpots[0]?.label.toLowerCase();
    headline = gap
      ? `So far the machine reads you most through your ${through}. The biggest gap is ${gap}.`
      : `The machine reads you across your ${through}, with a fairly complete picture.`;
  }

  const stageInfo = mirrorStage(score, threshold);

  return {
    readinessScore: score,
    stage: stageInfo.stage,
    stageLabel: stageInfo.stageLabel,
    stageBlurb: stageInfo.stageBlurb,
    coveragePercent,
    headline,
    known,
    blindSpots,
    nextSignal,
    outcomeHeadline: outcome.headline,
    totalDates: outcome.totalDates,
    eligible,
    threshold,
    engineVersion: ENGINE_VERSION,
  };
}

export interface CompassSignalLayer {
  headline: string;
  stage: MirrorStage;
  stageLabel: string;
  readinessScore: number;
  activeLaneCount: number;
  totalLaneCount: number;
  lines: string[];
}

/**
 * The compass "evolves with you" layer. Given a user's real readiness coverage,
 * it explains, in plain language, how much signal this particular read is built
 * on and how it will keep shifting as the user feeds the machine more. Pure and
 * deterministic: the lines genuinely change as coverage and readiness grow, so a
 * read run today reads differently from the same read run after a few more tools.
 */
export function buildCompassSignalLayer(input: {
  breakdown: ReadinessBreakdown;
  score: number;
  threshold: number;
  nextSignalLabel?: string | null;
}): CompassSignalLayer {
  const { breakdown, score, threshold, nextSignalLabel } = input;
  const totalLaneCount = SIGNAL_REGISTRY.length;
  const activeLaneCount = SIGNAL_REGISTRY.filter(
    (c) => (breakdown[c.id] ?? 0) > 0,
  ).length;
  const stageInfo = mirrorStage(score, threshold);

  const lines: string[] = [];
  if (activeLaneCount === 0) {
    lines.push(
      "This read is built only from what you just shared. The machine has no other signal on you yet, so it is reading a single moment, not a pattern.",
    );
    lines.push(
      "Feed it more and this stops being a snapshot. It starts tracking the real you, and each return shows how the picture is moving.",
    );
  } else {
    lines.push(
      `Right now ${activeLaneCount} of ${totalLaneCount} signal lanes are feeding this read, putting your readiness at ${score} out of 100.`,
    );
    if (score < threshold) {
      lines.push(
        "As you add signal, this read keeps shifting. Come back after your next few tools and watch which dynamics sharpen and which fade.",
      );
    } else {
      lines.push(
        "Your signal is rich enough that this read reflects a pattern, not a mood. Each time you return, you can see how the picture has moved.",
      );
    }
    if (nextSignalLabel && nextSignalLabel.trim()) {
      lines.push(
        `The fastest way to sharpen your next read: ${nextSignalLabel.trim().toLowerCase()}.`,
      );
    }
  }

  return {
    headline:
      activeLaneCount === 0
        ? "What your signal adds to this read: nothing yet"
        : "What your signal adds to this read",
    stage: stageInfo.stage,
    stageLabel: stageInfo.stageLabel,
    readinessScore: score,
    activeLaneCount,
    totalLaneCount,
    lines,
  };
}

export type MirrorDigestMode = "progress" | "stall" | "cold";

export interface MirrorDigestInput {
  portrait: MirrorPortrait;
  /** Readiness score captured at the last digest send, or null for the first. */
  previousScore: number | null;
  /** Lane breakdown captured at the last digest send, keyed by lane id. */
  previousBreakdown: Record<string, number> | null;
  /** Human cadence phrase, e.g. "this week" or "in the last two weeks". */
  cadenceLabel: string;
}

export interface MirrorDigest {
  subject: string;
  intro: string;
  scoreLine: string;
  changed: string[];
  nextSignal: { label: string; detail: string; href: string } | null;
  nudge: string | null;
  mode: MirrorDigestMode;
  engineVersion: string;
}

/**
 * Deterministic "what changed about you" digest, built from the user's real
 * portrait plus the score and lane coverage captured at the last send. Pure and
 * total: it always returns a complete, voice-clean digest, including a cold
 * first-send and a stall variant that doubles as the nudge. This is the
 * always-on baseline; Claude may rewrite only `intro` when the deep AI lane is
 * on, grounded in this same aggregate (never raw content or PII).
 */
export function buildMirrorDigest(input: MirrorDigestInput): MirrorDigest {
  const { portrait, previousScore, previousBreakdown, cadenceLabel } = input;
  const score = portrait.readinessScore;
  const delta = previousScore === null ? null : score - previousScore;

  let mode: MirrorDigestMode;
  if (previousScore === null) mode = "cold";
  else if ((delta ?? 0) > 0) mode = "progress";
  else mode = "stall";

  const poolLine = portrait.eligible
    ? "You are in the match pool."
    : `You are ${Math.max(1, portrait.threshold - score)} from the match pool.`;

  let scoreLine: string;
  if (mode === "progress") {
    scoreLine = `Your Match Readiness climbed ${delta} to ${score} out of 100. ${poolLine}`;
  } else if (mode === "stall") {
    scoreLine = `Your Match Readiness is holding at ${score} out of 100. ${poolLine}`;
  } else {
    scoreLine = `Your Match Readiness sits at ${score} out of 100. ${poolLine}`;
  }

  const changed: string[] = [];
  if (mode === "cold") {
    for (const lane of portrait.known.slice(0, 4)) {
      changed.push(`The machine can already read your ${lane.label.toLowerCase()}.`);
    }
  } else {
    const gains = portrait.known
      .map((lane) => ({
        lane,
        prior: previousBreakdown?.[lane.key] ?? 0,
      }))
      .filter((g) => g.lane.coverage > g.prior)
      .sort((a, b) => b.lane.coverage - b.prior - (a.lane.coverage - a.prior));
    for (const { lane, prior } of gains.slice(0, 4)) {
      changed.push(
        prior <= 0
          ? `The machine started reading your ${lane.label.toLowerCase()}.`
          : `Your ${lane.label.toLowerCase()} read got stronger.`,
      );
    }
  }

  const nextSignal = portrait.nextSignal
    ? {
        label: portrait.nextSignal.label,
        detail: portrait.nextSignal.detail,
        href: portrait.nextSignal.href,
      }
    : null;

  const topGap = portrait.blindSpots[0] ?? null;
  let nudge: string | null = null;
  if (mode === "stall") {
    nudge = nextSignal
      ? `You did not feed the machine new signal ${cadenceLabel}. One move changes that: ${nextSignal.label.toLowerCase()}.`
      : `You did not feed the machine new signal ${cadenceLabel}. Open your Mirror and pick one thing to add.`;
  } else if (topGap) {
    nudge = `The biggest gap is your ${topGap.label.toLowerCase()}. ${topGap.actionLabel}.`;
  }

  let subject: string;
  if (mode === "progress") {
    subject = `Your Mirror grew ${cadenceLabel} (+${delta} readiness)`;
  } else if (mode === "stall") {
    subject = `One signal moves your Mirror ${cadenceLabel}`;
  } else {
    subject = "Your MatchLab Mirror is taking shape";
  }

  let intro: string;
  if (mode === "progress") {
    intro = `Here is what changed about you ${cadenceLabel}. The machine sees you a little more clearly than it did before.`;
  } else if (mode === "stall") {
    intro = `Your Mirror is waiting on you. Nothing new reached it ${cadenceLabel}, and one signal is all it takes to move.`;
  } else {
    intro = `This is your Mirror, the evolving model of who you are. Here is what the machine can see so far, and the fastest way to sharpen it.`;
  }

  return {
    subject,
    intro,
    scoreLine,
    changed,
    nextSignal,
    nudge,
    mode,
    engineVersion: ENGINE_VERSION,
  };
}

export interface MirrorAnswer {
  answer: string;
  grounding: string[];
  followUp: string;
}

function dedupe(labels: string[]): string[] {
  return labels.filter((l, i) => l.length > 0 && labels.indexOf(l) === i);
}

/**
 * Deterministic answer from the Mirror, grounded in the portrait. Routes the
 * question to the most relevant facet of the model and always returns something
 * specific and non-empty. The grounding list names the real signals the answer
 * leans on, so citations are never invented.
 */
export function answerMirrorQuestion(
  portrait: MirrorPortrait,
  question: string,
): MirrorAnswer {
  const q = question.toLowerCase();
  const topKnown = portrait.known.slice(0, 3);
  const knownLabels = topKnown.map((k) => k.label);
  const next = portrait.nextSignal;

  // Are you / am I ready?
  if (/\bready\b|eligible|matchable|match me|start matching|join the pool/.test(q)) {
    const lead = portrait.eligible
      ? `You are at a readiness of ${portrait.readinessScore}, past the ${portrait.threshold} the matching pool needs. You can opt in whenever you want.`
      : `You are at a readiness of ${portrait.readinessScore}. The matching pool opens at ${portrait.threshold}.`;
    const push = next
      ? ` The fastest way to raise it: ${next.label.toLowerCase()}, worth about ${next.points} points.`
      : "";
    return {
      answer: `${lead}${push}`,
      grounding: dedupe(["Match Readiness", ...(next ? [next.label] : [])]),
      followUp: next
        ? `What does ${next.label.toLowerCase()} tell you about me?`
        : "Who should I be looking for?",
    };
  }

  // What do you know about me / who am I?
  if (
    /know about me|learned|who am i|what do you see|see in me|read on me|sum me up|describe me/.test(
      q,
    )
  ) {
    if (topKnown.length === 0) {
      return {
        answer:
          "Honestly, not much yet. You have not fed me anything I can read. Start with a profile audit or a wellness pass and I will have something real to tell you.",
        grounding: [],
        followUp: "What should I do first?",
      };
    }
    const lines = topKnown.map((k) => `- ${k.insight}`).join("\n");
    return {
      answer: `${portrait.headline}\n\nHere is what I can actually see:\n${lines}`,
      grounding: dedupe(knownLabels),
      followUp: "Where am I still a blind spot to you?",
    };
  }

  // Blind spots / what to work on / what is missing / next
  if (
    /blind spot|missing|don.?t know|gap|work on|improve|next|what should i do|do first/.test(
      q,
    )
  ) {
    if (portrait.blindSpots.length === 0) {
      return {
        answer:
          "You have fed me across the board. There is no obvious blind spot left. Keep logging real outcomes and I keep getting sharper.",
        grounding: dedupe(["Match Readiness"]),
        followUp: "Who should I be looking for?",
      };
    }
    const spots = portrait.blindSpots
      .slice(0, 3)
      .map((b) => `- ${b.label}: ${b.why}`)
      .join("\n");
    const push = next ? `\n\nIf you do one thing: ${next.label.toLowerCase()}.` : "";
    return {
      answer: `The places I cannot see you yet:\n${spots}${push}`,
      grounding: dedupe(portrait.blindSpots.slice(0, 3).map((b) => b.label)),
      followUp: next
        ? `Take me to ${next.label.toLowerCase()}.`
        : "What do you already know about me?",
    };
  }

  // Who should I look for / matching / partner
  if (/look for|should i date|\bmatch\b|partner|right person|my type|compatible|who fits/.test(q)) {
    const datesLine =
      portrait.totalDates > 0
        ? portrait.outcomeHeadline
        : "You have not logged any real date outcomes yet, so I am reasoning from your profile, not your track record.";
    const strengthLine =
      topKnown.length > 0
        ? `Your clearest signal right now is your ${topKnown[0]!.label.toLowerCase()}. The more date outcomes you log, the more I can tell you about who actually fits you, not just who looks good on paper.`
        : "Feed me a few signals first and I can start telling you who actually fits you.";
    return {
      answer: `${datesLine}\n\n${strengthLine}`,
      grounding: dedupe([
        ...(portrait.totalDates > 0 ? ["Date outcomes"] : []),
        ...(topKnown[0] ? [topKnown[0].label] : []),
      ]),
      followUp: "What am I still not showing you?",
    };
  }

  // Self-sabotage / patterns
  if (/sabotage|pattern|keep doing|what.?s wrong|fizzle|ghost/.test(q)) {
    const line =
      portrait.totalDates > 0
        ? `${portrait.outcomeHeadline} That pattern is real signal, not a verdict on you.`
        : "I cannot call a pattern yet because you have not logged real date outcomes. Add a post-date note or two and I will show you what keeps repeating.";
    return {
      answer: line,
      grounding: dedupe(portrait.totalDates > 0 ? ["Date outcomes"] : []),
      followUp: "How do I log a date outcome?",
    };
  }

  // Default: orient them.
  const orient =
    topKnown.length > 0
      ? `${portrait.headline}${next ? ` The next thing that would teach me the most about you is to ${next.label.toLowerCase()}.` : ""}`
      : "I am the model the app is building of you. Right now I am mostly blank. Use a tool or two and ask me again.";
  return {
    answer: orient.trim(),
    grounding: dedupe(knownLabels),
    followUp: "What do you know about me so far?",
  };
}
