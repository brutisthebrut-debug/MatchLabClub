export interface ArticleCta {
  title: string;
  body: string;
  href: string;
  label: string;
}

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readMin: number;
  date: string;
  color: string;
  cta?: ArticleCta;
}

const AUDIT_CTA: ArticleCta = {
  title: "Get your free Profile Signal Audit",
  body: "Find out exactly what your profile is communicating — Signal Score, bio critique, prompt rewrites, and a 7-day action plan.",
  href: "/start",
  label: "Start free audit — takes 3 minutes",
};

const COACH_CTA: ArticleCta = {
  title: "Run your next message through the coach",
  body: "Paste a thread and get three calibrated reply options — Playful, Direct, Warm — with the reasoning for each. Free to try.",
  href: "/coach",
  label: "Open the Chemistry Lab",
};

const COMPASS_CTA: ArticleCta = {
  title: "Run a Compatibility Compass read",
  body: "Drop in any profile or screenshot — see overall alignment, dimension-by-dimension fit, frictions to watch for, and three questions for date one.",
  href: "/compatibility-compass",
  label: "Try the Compass — no signup needed",
};

const CONNECTION_STYLE_CTA: ArticleCta = {
  title: "Find your connection style",
  body: "Five minutes, eighteen dimensions. See how you actually show up in early dating — and the patterns to watch.",
  href: "/connection-style",
  label: "Map your style",
};

const MIRROR_CTA: ArticleCta = {
  title: "Open Your Mirror",
  body: "Your second-brain for dating — journal entries, post-date debriefs, signal trends, and what they all say together.",
  href: "/your-mirror",
  label: "Step into the Mirror",
};

const DATES_CTA: ArticleCta = {
  title: "Log this date in 60 seconds",
  body: "Six questions that actually teach you something — not a diary. Pulls into your signal pattern over time.",
  href: "/mirror/dates",
  label: "Log a date debrief",
};

const INSIGHTS_CTA: ArticleCta = {
  title: "See your communication patterns",
  body: "Paste a few conversations — get your attachment lean, your repeating moves, and the profile tips that follow from them.",
  href: "/insights",
  label: "Pull my patterns",
};

const NEXT_MESSAGE_CTA: ArticleCta = {
  title: "Need the next message?",
  body: "Paste the thread, get a calibrated reply that matches their tone and moves the conversation forward — no canned lines.",
  href: "/next-message",
  label: "Draft my next message",
};

export const ARTICLES: Article[] = [
  {
    slug: "what-your-dating-profile-is-actually-communicating",
    title: "What Your Dating Profile Is Actually Communicating (And Why It's Not What You Think)",
    excerpt:
      "Your bio says you love hiking and good coffee. But what it's communicating is something entirely different — and that gap is exactly why you're not getting the matches you want.",
    category: "Profile Science",
    readMin: 7,
    date: "May 2026",
    color: "hsl(var(--brand-indigo))",
    cta: AUDIT_CTA,
  },
  {
    slug: "the-science-of-message-coaching",
    title: "The Science Behind Why Some Messages Get Replies and Others Don't",
    excerpt:
      "Researchers have analysed millions of dating app conversations. The patterns are surprisingly consistent — and almost none of them are about being clever or funny.",
    category: "Message Coaching",
    readMin: 8,
    date: "May 2026",
    color: "hsl(190 75% 50%)",
    cta: COACH_CTA,
  },
  {
    slug: "red-flags-in-your-own-profile",
    title: "The 7 Subtle Red Flags in Your Own Profile You Can't See Yourself",
    excerpt:
      "These aren't the obvious ones. They're the quiet signals that make someone feel vaguely uneasy and swipe left before they can even articulate why.",
    category: "Profile Audit",
    readMin: 6,
    date: "April 2026",
    color: "hsl(var(--brand-rose))",
    cta: AUDIT_CTA,
  },
  {
    slug: "photo-psychology-dating-apps",
    title: "Photo Psychology: What Your Dating App Photos Are Really Saying",
    excerpt:
      "Photo order, solo vs. group shots, eye contact, smile type — every choice in your photo lineup sends a signal. Here's what the research actually says.",
    category: "Photo Psychology",
    readMin: 9,
    date: "April 2026",
    color: "hsl(var(--brand-gold))",
    cta: AUDIT_CTA,
  },
  {
    slug: "matching-with-the-wrong-people",
    title: "Why You Keep Matching With the Wrong People (And How to Stop)",
    excerpt:
      "If your last three matches have all blurred into the same disappointment, the problem usually isn't them. It's a pattern your filters are quietly running on autopilot.",
    category: "Pattern Recognition",
    readMin: 7,
    date: "May 2026",
    color: "hsl(280 70% 60%)",
    cta: COMPASS_CTA,
  },
  {
    slug: "attachment-styles-on-dating-apps",
    title: "Attachment Styles on Dating Apps: How Yours Is Quietly Sabotaging Your Matches",
    excerpt:
      "The behaviours you read as 'just being yourself' on dating apps are often your attachment style on display. Here's what each one looks like in the wild — and what to watch for.",
    category: "Attachment Theory",
    readMin: 8,
    date: "May 2026",
    color: "hsl(160 60% 50%)",
    cta: CONNECTION_STYLE_CTA,
  },
  {
    slug: "first-date-question-predicts-second-date",
    title: "The First Date Question That Predicts the Second Date",
    excerpt:
      "It's not 'what do you do.' It's not 'where are you from.' It's the question that signals you can actually hold a conversation past the small-talk layer.",
    category: "Date Strategy",
    readMin: 6,
    date: "April 2026",
    color: "hsl(340 75% 60%)",
    cta: NEXT_MESSAGE_CTA,
  },
  {
    slug: "good-vibes-only-bio",
    title: "What 'Good Vibes Only' Actually Communicates on a Dating Profile",
    excerpt:
      "Generic affirmations feel safe to write but they're doing the opposite of what you think — they're filtering out exactly the people you'd actually want to meet.",
    category: "Profile Audit",
    readMin: 5,
    date: "April 2026",
    color: "hsl(var(--brand-rose))",
    cta: AUDIT_CTA,
  },
  {
    slug: "three-message-test",
    title: "The Three-Message Test: Why Most Dating App Conversations Die By Message Five",
    excerpt:
      "There's a predictable spot where conversations stop building momentum and start coasting on politeness. Catch it by message three and you change the trajectory entirely.",
    category: "Message Coaching",
    readMin: 7,
    date: "May 2026",
    color: "hsl(190 75% 50%)",
    cta: COACH_CTA,
  },
  {
    slug: "read-a-profile-like-a-compatibility-analyst",
    title: "How to Read a Dating Profile Like a Compatibility Analyst",
    excerpt:
      "Not 'do I like them' — but 'what specific signals are they sending, and what do those signals predict about how we'd actually fit together?'",
    category: "Compatibility",
    readMin: 9,
    date: "May 2026",
    color: "hsl(280 70% 60%)",
    cta: COMPASS_CTA,
  },
  {
    slug: "dating-app-burnout-reset",
    title: "The Dating App Burnout Pattern Nobody Names (And the Reset That Actually Works)",
    excerpt:
      "It's not that you're 'over' dating apps. It's that you've trained yourself into a numbed, transactional loop — and the only way out is to break the loop, not the app.",
    category: "Mindset",
    readMin: 7,
    date: "April 2026",
    color: "hsl(40 80% 55%)",
    cta: MIRROR_CTA,
  },
  {
    slug: "voice-notes-on-dating-apps",
    title: "Voice Notes Are Eating Dating Apps: What Yours Is Really Communicating",
    excerpt:
      "Sending a voice note is now a status move on dating apps — and depending on what's in yours, it's either accelerating things massively or sinking them quietly.",
    category: "Communication",
    readMin: 6,
    date: "May 2026",
    color: "hsl(190 75% 50%)",
    cta: COACH_CTA,
  },
  {
    slug: "post-date-reflection-questions",
    title: "Post-Date Reflection: The 6 Questions That Actually Teach You Something",
    excerpt:
      "Most post-date thinking is either 'do they like me' anxiety or instant verdicts. Neither teaches you anything. These six questions actually do.",
    category: "Self-Awareness",
    readMin: 6,
    date: "April 2026",
    color: "hsl(40 80% 55%)",
    cta: DATES_CTA,
  },
  {
    slug: "what-your-message-history-reveals",
    title: "What Your Dating App Message History Reveals About How You Actually Date",
    excerpt:
      "Your conversations are the most honest data you have. Patterns repeat — initiation style, energy pacing, the questions you never ask — and most of it is invisible until you look across all of them at once.",
    category: "Communication Patterns",
    readMin: 8,
    date: "April 2026",
    color: "hsl(220 70% 60%)",
    cta: INSIGHTS_CTA,
  },
  {
    slug: "love-pace-mismatch",
    title: "The Love-Pace Mismatch: Why Two People Who Like Each Other Still Can't Make It Work",
    excerpt:
      "Fast-feeling people partner with slow-feeling people more than chance alone would predict. The mismatch isn't the killer — it's the silence about the mismatch that ends it by week six.",
    category: "Attachment Theory",
    readMin: 7,
    date: "May 2026",
    color: "hsl(326 100% 65%)",
    cta: CONNECTION_STYLE_CTA,
  },
  {
    slug: "conflict-instinct-says-everything",
    title: "Your Conflict Instinct Says More About You Than Your Bio Ever Will",
    excerpt:
      "Confronter, processor, smoother, archiver, repairer — the way you handle the first tense moment with someone you like is the single best predictor of whether the third month happens.",
    category: "Communication",
    readMin: 8,
    date: "May 2026",
    color: "hsl(248 62% 62%)",
    cta: COACH_CTA,
  },
  {
    slug: "soft-boundary-trap",
    title: "The Soft Boundary Trap: Why Your Polite Nos Keep Becoming Resentments",
    excerpt:
      "Wrapping every limit in apology, hedge, and a backdoor exit teaches the other person that your no is negotiable. It also teaches you that your needs are a burden. The fix isn't bluntness — it's clarity.",
    category: "Boundaries",
    readMin: 7,
    date: "May 2026",
    color: "hsl(228 18% 65%)",
    cta: MIRROR_CTA,
  },
  // ── Cluster 1: Profile signal & specificity ────────────────────────────
  {
    slug: "specificity-beats-clever",
    title: "Specificity Beats Clever Every Time",
    excerpt:
      "Clever bios feel like effort. Specific bios feel like a person. Only one of them earns replies from the right kind of stranger.",
    category: "Profile Audit",
    readMin: 6,
    date: "2026-05-28",
    color: "hsl(var(--brand-indigo))",
    cta: AUDIT_CTA,
  },
  {
    slug: "photo-order-on-hinge",
    title: "Photo Order on Hinge Is Doing More Work Than Your Bio",
    excerpt:
      "The order of your photos is a tiny narrative most people post without thinking about. It is also the single fastest way to fix a profile that is matching with the wrong people.",
    category: "Photo Psychology",
    readMin: 7,
    date: "2026-05-21",
    color: "hsl(var(--brand-gold))",
    cta: AUDIT_CTA,
  },
  {
    slug: "what-your-prompts-actually-say",
    title: "What Your Hinge Prompts Actually Say About You",
    excerpt:
      "Prompt answers are not a quiz. They are a tone of voice. Read yours back the way a stranger would and you will hear what is actually coming through.",
    category: "Prompt Strategy",
    readMin: 7,
    date: "2026-05-14",
    color: "hsl(190 75% 50%)",
    cta: AUDIT_CTA,
  },
  {
    slug: "bio-anti-patterns-i-keep-seeing",
    title: "Bio Anti-Patterns I Keep Seeing on Every App",
    excerpt:
      "Six bio moves that feel safe to write and read as forgettable. If two of them are in your profile you are probably blending into the scroll.",
    category: "Profile Audit",
    readMin: 8,
    date: "2026-05-07",
    color: "hsl(var(--brand-rose))",
    cta: AUDIT_CTA,
  },
  {
    slug: "the-everything-profile-attracts-nobody",
    title: "The Everything-To-Everyone Profile Attracts Nobody Specific",
    excerpt:
      "Trying to appeal to a wide audience is the most common profile mistake I see. The fix is not narrower. It is more particular.",
    category: "Profile Strategy",
    readMin: 7,
    date: "2026-04-30",
    color: "hsl(280 70% 60%)",
    cta: COMPASS_CTA,
  },
  {
    slug: "when-good-photos-still-fail",
    title: "When Good Photos Still Fail: Why Lighting Is Not the Problem",
    excerpt:
      "Sharp photos in soft light still die in the queue when the lineup is telling the wrong story. The lie of good lighting is that it is enough on its own.",
    category: "Photo Psychology",
    readMin: 8,
    date: "2026-04-23",
    color: "hsl(var(--brand-gold))",
    cta: AUDIT_CTA,
  },
  {
    slug: "one-prompt-to-pre-filter-everyone-wrong",
    title: "The One Prompt That Pre-Filters Everyone Wrong For You",
    excerpt:
      "If you only change one line in your profile this month, make it this one. Done well, it does the work of three first dates in two sentences.",
    category: "Prompt Strategy",
    readMin: 6,
    date: "2026-04-16",
    color: "hsl(190 75% 50%)",
    cta: COACH_CTA,
  },
  {
    slug: "profile-as-invitation-not-resume",
    title: "Your Profile Is an Invitation, Not a Resume",
    excerpt:
      "Most profiles read like a credentials list. The ones that get replied to read like a doorway someone is being invited to walk through.",
    category: "Profile Strategy",
    readMin: 7,
    date: "2026-04-09",
    color: "hsl(248 62% 62%)",
    cta: AUDIT_CTA,
  },
  {
    slug: "second-brain-for-dating",
    title: "What a 'Second Brain for Your Dating Life' Actually Looks Like",
    excerpt:
      "Not another app to swipe on. A private layer on top of the apps you already use — that remembers what you noticed, surfaces the patterns you're not tracking, and tells you what your last six dates have in common.",
    category: "Product",
    readMin: 6,
    date: "May 2026",
    color: "hsl(190 75% 50%)",
    cta: MIRROR_CTA,
  },
];
