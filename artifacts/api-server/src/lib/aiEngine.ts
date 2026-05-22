// AI Engine — deterministic mock for MVP (no external API keys required)
// Returns realistic, coaching-quality output for every audit/report/coaching session.

// Bump this string whenever the deterministic engine's output changes in a
// user-visible way. Stored reports tagged with an older version will be
// flagged as stale on the client so the user can re-run with the latest.
export const ENGINE_VERSION = "2026-05-20";

export interface AuditReportOutput {
  readinessScore: number;
  overallGrade: string;
  strengths: string[];
  risks: string[];
  bioAudit: string;
  rewrittenBio: string;
  rewrittenPrompts: { original: string; rewritten: string; tip: string }[];
  photoGuidance: { category: string; status: "good" | "needs_work" | "missing"; advice: string }[];
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
      return `On Hinge specifically, the prompts do most of the heavy lifting — so ${name}'s bio doesn't need to carry the whole personality on its own, but it does need to set a clear tone the prompts can build on.`;
    case "Bumble":
      return `Bumble readers skim bios fast — and women see hundreds a week. ${name}'s opening line has to earn the second sentence; without a sharp hook the rest of the profile never gets read.`;
    case "Tinder":
      return `Tinder bios are read in the half-second between photo swipes, so ${name} needs one punchy, specific line up top — not a paragraph. Density beats depth here.`;
    default:
      return "";
  }
}

function appPromptTips(app: KnownApp | null): { tip: string; rewriteHint: string } {
  switch (app) {
    case "Hinge":
      return {
        tip: "Hinge weights prompts heavily in recommendations — make each one a distinct, responsive hook, not three variations of the same vibe.",
        rewriteHint: "Hinge favors specificity. Pick one weird, true detail per prompt — that's what gets likes attached.",
      };
    case "Bumble":
      return {
        tip: "On Bumble, prompts (and the question prompt at the top) are conversation seeds — leave an opening for her to send the first message.",
        rewriteHint: "Bumble women open conversations — give them something obvious and easy to react to, not abstract values statements.",
      };
    case "Tinder":
      return {
        tip: "Tinder doesn't have prompts the way Hinge does — fold these answers into a tight 2-line bio with a clear hook and an implicit question.",
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
      return "Hinge surfaces individual photos with likes — every single photo needs to stand on its own, since matches may comment on just one.";
    case "Bumble":
      return "Bumble shows the lead photo at a larger crop than other apps — a slightly tighter framing on your face usually outperforms a wide shot here.";
    case "Tinder":
      return "Tinder is photo-first and swipe-fast. The lead photo isn't 'a' factor — it's almost the entire decision. Treat it accordingly.";
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
    `${name}'s bio has genuine personality but is underselling the depth beneath the surface. The opening line doesn't create immediate intrigue — it reads like a summary rather than a hook. Several phrases are common on ${appLabel} to the point of being invisible: "love to travel," "big on authenticity," and "looking for my person" appear in roughly 1 in 3 profiles. The bio doesn't answer the only question that matters: why would someone who has options choose ${name} specifically? There's potential here — it just needs a sharper lens.${appFlavor ? " " + appFlavor : ""}`,
    `${name}'s current bio tries to cover too much ground and ends up owning none of it. Rather than creating a vivid, specific picture of who ${name} is on their best Tuesday, it lists attributes that could apply to thousands of people. The tone is earnest — which is a strength — but earnest without specific detail reads as generic. The real ${name} is more interesting than this bio suggests. We need to surface that.${appFlavor ? " " + appFlavor : ""}`,
    `There's a buried lede in ${name}'s profile. The most compelling detail appears in sentence four — that's where the reader's attention should land first. The profile structure is inverted: it starts with abstractions (values, personality descriptors) and saves the specifics for the end, when many readers have already moved on. ${appLabel} profiles reward novelty and specificity in the first eight words.${appFlavor ? " " + appFlavor : ""}`,
  ];

  const rewrittenBios = [
    `I make a genuinely great first date — I'll pick somewhere unexpected, I'll actually be listening, and I'll probably make you laugh at something you didn't expect to laugh at. I'm the kind of person who takes ${params.datingGoal === "find a relationship" ? "connection seriously" : "good moments seriously"} — which means I'm not here to waste either of our time. Currently: too invested in my sourdough starter, rewatching things I've already seen, and trying to find someone worth getting off the couch for. If any of that sounds appealing, let's find out.`,
    `Professionally: I make things happen. Personally: I make breakfast for people I like and take forever to leave a bookshop. I'm ${params.datingGoal === "casual dating" ? "not looking for anything heavy — just someone worth actually spending time with" : "looking for something real — not the Instagram version of a relationship, the actual thing"}. I'm easy to talk to, terrible at small talk, and very good at the second date. Let's skip the awkward stuff and get to the good part.`,
    `The facts: I'm someone who shows up, follows through, and genuinely enjoys other people — which, it turns out, is rarer than it should be. I'll plan the date, bring the energy, and remember what you told me three conversations ago. I'm ${params.currentApps.includes("Hinge") ? "on Hinge" : "on here"} because I'm actually trying, not just bored. If you're the same, we should probably talk.`,
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
          tip: promptTips.rewriteHint || "Prompts are conversation starters — end with something they can respond to.",
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
            ? "I'll show you rather than tell you — first message gets a real response. (Tinder: keep this as the bio, no prompts needed.)"
            : "I'll show you rather than tell you — first message gets a real response.",
          tip: app === "Tinder"
            ? "Tinder doesn't surface prompts the way Hinge does — a single sharp bio line does more work."
            : `Add 2-3 prompts to dramatically increase ${name}'s match-to-conversation conversion rate on ${appLabel}.`,
        },
      ];

  const photoGuidanceItems = [
    {
      category: "Lead photo",
      status: "needs_work" as const,
      advice:
        "Your first photo should be a clear, well-lit face shot where you're visibly enjoying yourself — not posing. Squinting at the sun or a blurry group shot loses matches before they read a word.",
    },
    {
      category: "Social proof shot",
      status: score > 65 ? ("good" as const) : ("missing" as const),
      advice:
        score > 65
          ? "Good — you have a photo showing you with other people. This signals that others enjoy your company."
          : "Add one photo of you with friends or family. It signals social value and warmth — two of the top three traits people screen for.",
    },
    {
      category: "Action/lifestyle shot",
      status: score > 70 ? ("good" as const) : ("needs_work" as const),
      advice:
        "Show yourself doing something you actually love — not a gym mirror selfie. Cooking, hiking, playing music, traveling. Activity photos generate 3x more openers than static poses.",
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
        "At least 3 of your photos should be taken in natural daylight. Avoid heavy filters — they read as insecure. Phone cameras in good light beat DSLR cameras in bad light.",
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
        "Choose prompts that end with an implicit invitation to respond — avoid lists and abstract values statements.",
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
      "Genuine warmth comes through — you don't read as transactional or performative",
      "Clear sense of what you're looking for — intention is attractive",
      `Active on ${params.currentApps.length} ${params.currentApps.length === 1 ? "platform" : "platforms"} — giving yourself real chances`,
      "Openness and self-awareness present in your writing voice",
    ],
    risks: [
      "Generic phrases dilute the profile — several lines appear in thousands of other bios",
      "Not enough specificity to stand out in a high-volume pool",
      "Opening line doesn't create immediate intrigue or curiosity",
      ...(params.biggestChallenge === "not getting matches"
        ? ["Profile optimization likely needed before increasing swipe volume"]
        : params.biggestChallenge === "ghosted"
        ? ["Messaging strategy needs attention — matches converting poorly to conversations"]
        : []),
    ],
    bioAudit: bioAudits[Math.floor(score % 3)],
    rewrittenBio: rewrittenBios[Math.floor(score % 3)],
    rewrittenPrompts: promptRewrites,
    photoGuidance: photoGuidanceItems,
    actionPlan: actionPlanItems,
    messagingStyle:
      params.recentMessageSample && params.recentMessageSample.length > 50
        ? `Based on your message sample, your communication style leans ${score > 65 ? "warm and genuine" : "cautious and surface-level"}. ${score > 65 ? "You ask good questions but sometimes wait too long to suggest escalating to a date — the window closes faster than most people think." : "You're holding back — your messages are safe but not memorable. The goal isn't to be impressive, it's to be interesting. Specificity and light playfulness dramatically improve response rates."}`
        : "No message sample provided. Add a conversation snippet in your next audit to unlock personalized messaging analysis. In the meantime: the single highest-ROI change most people can make is in the first message — it should reference something specific from their profile, ask one question, and land in 2 sentences or less.",
    coachingCta:
      "Ready to go deeper? Book a 1:1 coaching session and we'll rebuild your entire dating strategy — from photos to first messages to closing for dates. Most clients see a 2-3x improvement in meaningful matches within 30 days.",
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
      return `${base} Hinge conversations reward referencing something specific from their prompts — it signals you actually read the profile.`;
    case "Bumble":
      return `${base} On Bumble the 24-hour clock matters — don't let momentum die between sessions, but don't overreact to a slow reply either.`;
    case "Tinder":
      return `${base} Tinder conversations get stale fast — move toward concrete plans within the first dozen messages or the thread dies.`;
    default:
      return base;
  }
}

function appCoachRedFlags(app: KnownApp | null): string[] {
  switch (app) {
    case "Hinge":
      return ["On Hinge, ignoring the prompt they liked is a missed hook — anchor your next reply to it"];
    case "Bumble":
      return ["On Bumble, letting a women-message-first thread go cold past 24 hours often resets the dynamic entirely"];
    case "Tinder":
      return ["On Tinder, staying in the chat past two days without suggesting plans usually kills the match"];
    default:
      return [];
  }
}

function appCoachTip(app: KnownApp | null, goal: string, name: string): string {
  const baseDate =
    "a warm-up, not an interview — but they also end with plans, not just good vibes. After 5-7 messages of solid rapport, it's time to ask. The cost of asking is almost always lower than people think.";
  const baseKeep =
    "tennis — both people bringing something to every exchange. Make sure you're returning with energy, not just keeping it alive.";
  const base = `The best conversations feel like ${goal === "get a date" ? baseDate : baseKeep}`;
  switch (app) {
    case "Hinge":
      return `${base} With ${name} on Hinge, tie your date suggestion back to whatever prompt or photo you originally liked — it makes the ask feel earned, not random.`;
    case "Bumble":
      return `${base} On Bumble, ${name} expects you to bring some energy back quickly — concise, specific replies outperform long thoughtful essays here.`;
    case "Tinder":
      return `${base} On Tinder, ${name} is talking to a lot of people — a confident, low-friction plan ("drinks Thursday, I'll pick the spot") usually beats an open-ended "what do you like to do?"`;
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
      ? "Light and playful — this is working. Don't overthink it, just keep the energy up and steer toward a date."
      : "Measured and thoughtful. There's mutual interest here but neither person has broken the surface yet. Someone needs to go first — let it be you.";

  const baseRedFlags =
    isShortMessage && !isQuestion
      ? [
          "One-word or very short replies slow momentum and signal low investment",
          "Lack of a question puts 100% of the conversational burden on them",
        ]
      : params.yourLastMessage.toLowerCase().includes("haha") && params.yourLastMessage.length < 20
      ? [
          "'Haha' as a standalone response signals you read it but had nothing to add — it deflates energy",
          "Reactive messages (laughing at what they said without building on it) stall conversations",
        ]
      : [];

  return {
    analysis: `This conversation with ${name}${appPhrase} has ${params.conversationContext.length > 200 ? "solid momentum — there's genuine back-and-forth happening" : "potential, but it needs a boost"}. Your last message ${isShortMessage ? "is a bit brief — it doesn't give them much to work with and puts the conversational weight entirely on them" : "shows effort, which is good"}. ${isQuestion ? "Asking a question is smart, but make sure it's specific enough that there's no 'safe' one-word answer" : "Consider adding a question or prompt to make it easy for them to respond"}. The goal of ${goal} is achievable — here's how to get there.`,
    suggestedReplies: [
      {
        style: "Playful",
        text: `Okay but real question — ${name}, what's your actual unpopular opinion? I'm collecting them.`,
        rationale:
          "Creates an easy, low-stakes reply opportunity. Playful challenge generates more response than a sincere question.",
      },
      {
        style: "Direct",
        text: `I'd rather show you than keep describing it. Are you free this week, ${name}?`,
        rationale: `If the goal is to get a date, asking directly after establishing rapport converts at 3x the rate of waiting. ${name} will respect the directness${app ? ` — and${appPhrase} that kind of clarity is rare` : ""}.`,
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
        rationale: `After solid rapport, asking directly converts far better than hinting${appPhrase ? ` — and${appPhrase}, plans-first messages beat more chat almost every time` : ""}. Moving to real life is the whole point — the cost of asking is almost always lower than people think.`,
      },
      {
        style: "Graceful Exit",
        text: `${name}, it's been genuinely nice chatting. I think we might be in different places right now, but I'm really glad we connected.`,
        rationale: `Sometimes the kindest move is a clear, warm close. This ends things with dignity for both people — no ambiguity, no hard feelings, no bridge burned.`,
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
        ? "On Hinge, long messages early can outpace the conversational rhythm — readers expect punchy, prompt-anchored replies in the first few exchanges."
        : "On Hinge, concise replies work — but make sure each one anchors back to a prompt or photo so the conversation stays specific.";
    case "Bumble":
      return isLongMessages
        ? "On Bumble where women open, long replies can feel like pressure — keep early messages snappy and let them pick the thread."
        : "On Bumble the 24-hour clock rewards your concise style — just make sure replies still bring fresh energy, not just acknowledgement.";
    case "Tinder":
      return isLongMessages
        ? "On Tinder, multi-paragraph messages get skimmed — the platform rewards quick, sharp exchanges that move toward a plan fast."
        : "On Tinder, your concise style fits the platform — just don't let so many short turns pass that the thread dies before you suggest plans.";
    case "iMessage":
      return "Once you're in iMessage, you've already cleared the hardest bar — protect that by keeping pacing relaxed and not over-texting between days.";
    case "Email":
      return "Email is a slower, more deliberate medium — your tone here will read more carefully than on apps, so word choice matters more than usual.";
    default:
      return null;
  }
}

function insightSourceGrowthArea(source: InsightSource | null): string | null {
  switch (source) {
    case "Hinge":
      return "On Hinge, tie at least one reply back to whatever prompt or photo originally got the like — it consistently lifts response quality.";
    case "Bumble":
      return "On Bumble, when she opens, your reply within the first few hours sets the tone — concise specifics beat long appreciative essays.";
    case "Tinder":
      return "On Tinder, set a soft deadline in your head — if you're past a dozen messages without suggesting plans, the thread is dying.";
    case "iMessage":
      return "Once you're texting, stop performing — the conversation should feel lighter and more spontaneous, not more polished, than the app phase.";
    case "Email":
      return "Email rewards brevity even more than apps — most threads die from length, not from being too direct.";
    default:
      return null;
  }
}

function insightSourceProfileTip(source: InsightSource | null): string | null {
  switch (source) {
    case "Hinge":
      return "Your Hinge prompts are doing most of the matchmaking — rotate one every two weeks and watch which versions actually pull likes.";
    case "Bumble":
      return "On Bumble, the lead photo and first bio line do nearly all the work — make sure both can stand on their own in under two seconds.";
    case "Tinder":
      return "On Tinder, a two-line bio with one specific hook will outperform a thoughtful paragraph almost every time — density beats depth.";
    case "iMessage":
      return "Since you're getting numbers, your profile is converting — the next leverage point is upgrading the app-to-text transition, not the bio.";
    case "Email":
      return "If conversations are moving to email, your profile is doing fine — focus coaching on tightening replies, not rewriting the bio.";
    default:
      return null;
  }
}

function insightSourceSummaryAddendum(source: InsightSource | null): string {
  switch (source) {
    case "Hinge":
      return " Tuned to Hinge conventions — prompt-anchored replies and individual-photo specificity weighted heavily.";
    case "Bumble":
      return " Tuned to Bumble dynamics — women-open timing and lead-photo weight factored in.";
    case "Tinder":
      return " Tuned to Tinder pacing — fast-decay thread expectations and plans-first asks weighted in.";
    case "iMessage":
      return " Calibrated for iMessage — you've already cleared the app, so the leverage is now in pacing and tone, not pitch.";
    case "Email":
      return " Calibrated for email — slower cadence, more deliberate phrasing, and brevity over polish.";
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
    "Secure — you communicate directly and recover well from tension",
    "Anxiously attached — you seek reassurance and sometimes over-explain",
    "Avoidant — you pull back when conversations get emotionally heavy",
    "Fearful-avoidant — you want closeness but protect yourself from it",
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
        frequency: isLongMessages ? "High — most messages are multi-paragraph" : "Consistent — you tend to keep messages short",
        impact: (() => {
          const base = isLongMessages
            ? "Long messages signal investment but can create pressure — the other person may feel they owe an equivalent response, which is exhausting over time."
            : "Concise messages are easy to respond to, but may read as low investment. Try occasionally matching their energy by going a little longer.";
          const flavor = insightSourcePatternImpact(source, isLongMessages);
          return flavor ? `${base} ${flavor}` : base;
        })(),
      },
      {
        pattern: hasQuestions > 5 ? "Question-heavy style" : "Statement-forward style",
        frequency:
          hasQuestions > 5
            ? `High — ${hasQuestions} questions detected in this sample`
            : "Low — fewer than expected questions in your messages",
        impact:
          hasQuestions > 5
            ? "Asking questions is a strong instinct — it shows curiosity. But too many in a row can feel like an interview. Balance questions with statements that reveal something about you."
            : "More questions would give the other person more ways to engage. Try ending more messages with a genuine question about them.",
      },
      {
        pattern: hasHumor ? "Humor as a connector" : "Earnest/direct communication",
        frequency: hasHumor ? "Present — humor appears naturally throughout" : "Low — limited use of levity",
        impact: hasHumor
          ? "Great. Humor is one of the strongest accelerants of attraction and trust. Keep it calibrated to their response — mirror their energy."
          : "Adding occasional lightness can lower defenses and make conversations feel more alive. You don't have to be funny — just human.",
      },
      {
        pattern: hasEmotional ? "Emotionally expressive" : "Emotionally restrained",
        frequency: hasEmotional
          ? "High — emotional language appears frequently"
          : "Low — emotional language is largely absent",
        impact: hasEmotional
          ? "Emotional openness builds deep connection quickly — but it needs to be paced. If it appears very early, it can feel intense. Let it emerge naturally."
          : "Some emotional expression helps others feel safe to open up with you. Try naming how you feel occasionally — it's a signal that you're paying attention.",
      },
    ],
    attachmentStyle: attachmentStyles[styleIndex],
    strengths: [
      hasHumor
        ? "Natural use of humor to create warmth and ease"
        : "Clear and direct — people know where they stand with you",
      isLongMessages
        ? "Demonstrable investment — you take conversations seriously"
        : "Efficient communicator — easy to keep up with",
      hasQuestions > 3
        ? "Genuine curiosity about the other person"
        : "Calm, assured presence in written communication",
      "Self-awareness in how you present yourself",
    ],
    growthAreas: [
      isLongMessages
        ? "Practice the 'one breath' edit — if a message takes more than one breath to read aloud, shorten it"
        : "Try occasionally matching someone's energy by elaborating when they go deep",
      hasEmotional && styleIndex === 1
        ? "Notice patterns of seeking reassurance — the goal is to self-soothe first, then communicate"
        : "Practice naming one specific emotion per conversation thread",
      hasQuestions < 3
        ? "Ask more questions — curiosity is irresistible when it feels genuine"
        : "Balance questions with personal disclosures — reciprocity matters",
      ...(insightSourceGrowthArea(source) ? [insightSourceGrowthArea(source) as string] : []),
    ],
    datingProfileTips: [
      hasHumor
        ? "Bring the humor into your profile — it's one of your strongest assets. One specific, funny detail beats three generic lines."
        : "Your profile likely reads as earnest. Add one line with lightness — it will disarm readers who are on defense.",
      isLongMessages
        ? "Your bio may be too long. Cut it by 30% and see if it gets more matches — less is almost always more."
        : "You might be under-writing your bio. Give readers something specific to respond to.",
      styleIndex === 1
        ? "Lead with who you are, not what you're looking for. Profiles that open with needs signal low confidence."
        : "Your restraint can read as confidence — lean into that. Be direct about what you want.",
      ...(insightSourceProfileTip(source)
        ? [insightSourceProfileTip(source) as string]
        : ["Add at least one prompt that ends with an implicit question — it converts profile views to messages far better than static statements."]),
    ],
    summary: `Based on ${wordCount} words of conversation from ${params.sourceLabel}, your communication fingerprint is: ${attachmentStyles[styleIndex].split("—")[0].trim()}. ${hasHumor ? "Your natural humor is a real asset — it's the kind of thing people remember and seek out." : "You communicate with clarity and intention."} ${hasEmotional ? "You're emotionally present, which creates depth quickly — the growth edge is pacing that openness." : "Your restraint creates calm, but sometimes people need a little more warmth to feel safe opening up."} The patterns in this sample suggest your dating profile and conversation style could be better aligned — the coaching recommendations above will help bridge that gap.${insightSourceSummaryAddendum(source)}`,
    sourceApp: source,
  };
}

// ============================================================================
// Cross-audit trend analysis ("Build the Mirror") — task #547
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
  headlineInsight: string;
  engineVersion: string;
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
        label: `${delta} point dip since your first audit — worth a closer look`,
        tone: "watch",
      });
    } else {
      signals.push({
        label: `Score is steady within ${Math.abs(delta)} pt — small wins still count`,
        tone: "neutral",
      });
    }
  }
  if (params.sendStats && params.sendStats.totalPrompts >= 3) {
    const rate = params.sendStats.sentCount / params.sendStats.totalPrompts;
    const pct = Math.round(rate * 100);
    if (rate >= 0.6) {
      signals.push({
        label: `${pct}% send-through on coached replies — momentum is real`,
        tone: "positive",
      });
    } else if (rate <= 0.25) {
      signals.push({
        label: `${pct}% send-through — drafts piling up faster than they go out`,
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
        label: `Showing up every ~${Math.round(avgGapDays)} days — consistent rhythm`,
        tone: "positive",
      });
    } else if (avgGapDays > 30) {
      signals.push({
        label: `~${Math.round(avgGapDays)}-day gaps between audits — easy to lose the thread`,
        tone: "watch",
      });
    }
  }
  if (daysSinceLatest !== null && daysSinceLatest > 45 && total >= 2) {
    signals.push({
      label: `Last audit was ${daysSinceLatest} days ago — time for a fresh read`,
      tone: "watch",
    });
  }
  if (recurringRisks.length > 0 && recurringRisks[0].count >= 2) {
    signals.push({
      label: `"${recurringRisks[0].label}" keeps coming up — that's the one to fix first`,
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
        label: "Energy is trending steady — good fuel for the work",
        tone: "positive",
      });
    }
    if (avgHeadspace <= 2.5) {
      signals.push({
        label: "Headspace is running low — keep moves small this week",
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
      "Your Mirror will start filling in once you complete your first audit — patterns need at least one data point to begin.";
  } else if (!hasEnoughData) {
    headlineInsight =
      "One audit in. Run a second pass after you've made a change or two — that's when patterns start to show.";
  } else {
    const pieces: string[] = [];
    pieces.push(
      `${total} audit${total === 1 ? "" : "s"}${spanDays > 0 ? ` across ${spanDays} day${spanDays === 1 ? "" : "s"}` : ""}.`,
    );
    if (direction === "up") {
      pieces.push(
        `Your score is up ${delta} points since you started — that's real movement.`,
      );
    } else if (direction === "down") {
      pieces.push(
        `Your score has slipped ${Math.abs(delta)} points — worth understanding why before pushing harder.`,
      );
    } else if (firstScore !== null && latestScore !== null && scored.length >= 2) {
      pieces.push(
        "Your score is holding steady — the next move is sharpening one specific thing.",
      );
    }
    if (repeatedStrengths.length > 0) {
      pieces.push(
        `${repeatedStrengths[0].label} keeps showing up as a real strength — lean into it.`,
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
          `${emerged.label} has started to emerge — keep building on it.`,
        );
      }
    }
    headlineInsight = pieces.join(" ");
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
    headlineInsight,
    engineVersion: ENGINE_VERSION,
  };
}
