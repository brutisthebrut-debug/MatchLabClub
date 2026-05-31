import { DEFAULT_OG_IMAGE } from "@/lib/seo";

export interface ArticleCta {
  title: string;
  body: string;
  href: string;
  label: string;
}

/**
 * Adding a new article is a two-step, repeatable flow:
 *   1. Add an `Article` entry to `ARTICLES` (below). Only `slug`, `title`,
 *      `excerpt`, `category`, `readMin`, `date`, and `color` are required.
 *      Everything else is optional and has a sensible fallback:
 *        - SEO: `metaTitle`/`metaDescription`/`ogImage` fall back to the
 *          title, excerpt, and the default share image (see `getArticleMeta`).
 *        - Funnel: `relatedQuizSlug` overrides the category-based quiz match;
 *          when omitted, `resolveQuizForArticle` picks a relevant quiz from the
 *          category, so every post still leads into a quiz then first run.
 *        - `cta` overrides the generic "free audit" call to action.
 *   2. Add the article body to `ARTICLE_CONTENT[slug]` in `pages/BlogPost.tsx`.
 * No other files need editing: meta, social previews, structured data, and the
 * quiz hook all derive from this entry.
 */
export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readMin: number;
  date: string;
  color: string;
  cta?: ArticleCta;
  /** SEO <title> override. Falls back to `title`. */
  metaTitle?: string;
  /** Meta description / OG description override. Falls back to `excerpt`. */
  metaDescription?: string;
  /** Social share image (root-relative or absolute). Falls back to the default. */
  ogImage?: string;
  /** Comma-free keyword list for the article (optional, used in structured data). */
  keywords?: string[];
  /** ISO date the article was last updated. Falls back to `date`. */
  updated?: string;
  /** Explicit related-quiz slug. Overrides the category-based match. */
  relatedQuizSlug?: string;
}

export interface ArticleMeta {
  title: string;
  description: string;
  ogImage: string;
}

/** Resolve the SEO-ready meta for an article, applying all fallbacks. */
export function getArticleMeta(article: Article): ArticleMeta {
  return {
    title: article.metaTitle ?? article.title,
    description: article.metaDescription ?? article.excerpt,
    ogImage: article.ogImage ?? DEFAULT_OG_IMAGE,
  };
}

const AUDIT_CTA: ArticleCta = {
  title: "Get your free Profile Signal Audit",
  body: "Find out exactly what your profile is communicating: Signal Score, bio critique, prompt rewrites, and a 7-day action plan.",
  href: "/start",
  label: "Start free audit, 3 minutes",
};

const COACH_CTA: ArticleCta = {
  title: "Run your next message through the coach",
  body: "Paste a thread and get three calibrated reply options (Playful, Direct, Warm) with the reasoning for each. Free to try.",
  href: "/coach",
  label: "Open the Chemistry Lab",
};

const COMPASS_CTA: ArticleCta = {
  title: "Run a Compatibility Compass read",
  body: "Drop in any profile or screenshot: see overall alignment, dimension-by-dimension fit, frictions to watch for, and three questions for date one.",
  href: "/compatibility-compass",
  label: "Try the Compass, no signup needed",
};

const CONNECTION_STYLE_CTA: ArticleCta = {
  title: "Find your connection style",
  body: "Five minutes, eighteen dimensions. See how you actually show up in early dating, and the patterns to watch.",
  href: "/connection-style",
  label: "Map your style",
};

const MIRROR_CTA: ArticleCta = {
  title: "Open Your Mirror",
  body: "Your second-brain for dating: journal entries, post-date debriefs, signal trends, and what they all say together.",
  href: "/your-mirror",
  label: "Step into the Mirror",
};

const DATES_CTA: ArticleCta = {
  title: "Log this date in 60 seconds",
  body: "Six questions that actually teach you something, not a diary. Pulls into your signal pattern over time.",
  href: "/mirror/dates",
  label: "Log a date debrief",
};

const INSIGHTS_CTA: ArticleCta = {
  title: "See your communication patterns",
  body: "Paste a few conversations: get your attachment lean, your repeating moves, and the profile tips that follow from them.",
  href: "/insights",
  label: "Pull my patterns",
};

const NEXT_MESSAGE_CTA: ArticleCta = {
  title: "Need the next message?",
  body: "Paste the thread, get a calibrated reply that matches their tone and moves the conversation forward. No canned lines.",
  href: "/next-message",
  label: "Draft my next message",
};

export const ARTICLES: Article[] = [
  {
    slug: "what-your-dating-profile-is-actually-communicating",
    title: "What Your Dating Profile Is Actually Communicating (And Why It's Not What You Think)",
    excerpt:
      "Your bio says you love hiking and good coffee. But what it's communicating is something entirely different, and that gap is exactly why you're not getting the matches you want.",
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
      "Researchers have analysed millions of dating app conversations. The patterns are surprisingly consistent, and almost none of them are about being clever or funny.",
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
      "Photo order, solo vs. group shots, eye contact, smile type: every choice in your photo lineup sends a signal. Here's what the research actually says.",
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
      "The behaviours you read as 'just being yourself' on dating apps are often your attachment style on display. Here's what each one looks like in the wild, and what to watch for.",
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
      "Generic affirmations feel safe to write but they're doing the opposite of what you think. They're filtering out exactly the people you'd actually want to meet.",
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
      "Not 'do I like them', but 'what specific signals are they sending, and what do those signals predict about how we'd actually fit together?'",
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
      "It's not that you're 'over' dating apps. It's that you've trained yourself into a numbed, transactional loop, and the only way out is to break the loop, not the app.",
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
      "Sending a voice note is now a status move on dating apps, and depending on what's in yours, it's either accelerating things massively or sinking them quietly.",
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
      "Your conversations are the most honest data you have. Patterns repeat (initiation style, energy pacing, the questions you never ask) and most of it is invisible until you look across all of them at once.",
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
      "Fast-feeling people partner with slow-feeling people more than chance alone would predict. The mismatch isn't the killer. It's the silence about the mismatch that ends it by week six.",
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
      "Confronter, processor, smoother, archiver, repairer: the way you handle the first tense moment with someone you like is the single best predictor of whether the third month happens.",
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
      "Wrapping every limit in apology, hedge, and a backdoor exit teaches the other person that your no is negotiable. It also teaches you that your needs are a burden. The fix isn't bluntness. It's clarity.",
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
      "Not another app to swipe on. A private layer on top of the apps you already use, one that remembers what you noticed, surfaces the patterns you're not tracking, and tells you what your last six dates have in common.",
    category: "Product",
    readMin: 6,
    date: "May 2026",
    color: "hsl(190 75% 50%)",
    cta: MIRROR_CTA,
  },
  // ── Cluster 2: Messaging & coaching ────────────────────────────────────
  {
    slug: "the-death-of-hey",
    title: "The Death of 'Hey'",
    excerpt:
      "The most common opener on every app is also the one that almost never starts a conversation that goes anywhere. The reason is not laziness. It is math the receiver does without thinking.",
    category: "Message Coaching",
    readMin: 6,
    date: "2026-04-02",
    color: "hsl(190 75% 50%)",
    cta: COACH_CTA,
  },
  {
    slug: "reply-rhythm-and-when-silence-means-something",
    title: "Reply Rhythm, and When Silence Actually Means Something",
    excerpt:
      "Most of what people read into response times is noise. But across the arc of a week, three specific cadence patterns reliably tell you something true. Here is how to spot them without going crazy.",
    category: "Message Coaching",
    readMin: 7,
    date: "2026-03-26",
    color: "hsl(248 62% 62%)",
    cta: NEXT_MESSAGE_CTA,
  },
  {
    slug: "how-to-rescue-a-dead-thread",
    title: "How to Rescue a Dead Thread Without Sounding Like You Are Rescuing Anything",
    excerpt:
      "A conversation that went quiet three weeks ago is recoverable more often than you think. The move is not the apology re-entry. It is a specific kind of message that pretends the silence never happened.",
    category: "Message Coaching",
    readMin: 7,
    date: "2026-03-19",
    color: "hsl(340 75% 60%)",
    cta: NEXT_MESSAGE_CTA,
  },
  {
    slug: "when-to-ask-them-out",
    title: "When to Actually Ask Them Out",
    excerpt:
      "There is no day-count rule. There is a moment. The people who consistently move from text to date have trained themselves to feel the moment instead of counting messages.",
    category: "Date Strategy",
    readMin: 7,
    date: "2026-03-12",
    color: "hsl(40 80% 55%)",
    cta: COACH_CTA,
  },
  {
    slug: "voice-notes-are-a-cheat-code",
    title: "Voice Notes Are a Cheat Code, Used Sparingly",
    excerpt:
      "Done well, a voice note gives the receiver more information in thirty seconds than a week of texts could. Done badly, it confirms every fear they had about voice notes. Here is the difference.",
    category: "Communication",
    readMin: 6,
    date: "2026-03-05",
    color: "hsl(280 70% 60%)",
    cta: COACH_CTA,
  },
  {
    slug: "the-question-that-actually-tells-you-something",
    title: "The Question That Actually Tells You Something About a Person",
    excerpt:
      "Most questions on dating apps collect facts. The better ones produce thinking. Here is the shape of a question that gives you more information in two sentences than a week of small talk would.",
    category: "Conversation",
    readMin: 7,
    date: "2026-02-26",
    color: "hsl(160 60% 50%)",
    cta: COACH_CTA,
  },
  {
    slug: "wyd-and-other-conversational-dead-ends",
    title: "'wyd' and Other Conversational Dead Ends",
    excerpt:
      "A small tour of the messages that almost always kill conversations, why they fail in the same structural way, and what to send instead that costs you twenty seconds and changes the reply rate dramatically.",
    category: "Message Coaching",
    readMin: 6,
    date: "2026-02-19",
    color: "hsl(var(--brand-rose))",
    cta: COACH_CTA,
  },
  {
    slug: "small-talk-to-real-talk-in-three-moves",
    title: "Small Talk to Real Talk in Three Moves",
    excerpt:
      "The threads that turn into dates almost always have a specific moment where the conversation moved from the surface to a layer below. The shift is not random. It is a three-move sequence.",
    category: "Conversation",
    readMin: 7,
    date: "2026-02-12",
    color: "hsl(var(--brand-indigo))",
    cta: NEXT_MESSAGE_CTA,
  },
  // ── Cluster 3: Attachment, wellness, self-knowledge ────────────────────
  {
    slug: "attachment-styles-without-the-tiktok",
    title: "Attachment Styles Without the TikTok Flatness",
    excerpt:
      "Attachment is a gravity you feel under stress, not a four-letter label you wear at brunch. Used properly it explains a lot. Used like a personality test it explains nothing and ends conversations.",
    category: "Attachment Theory",
    readMin: 8,
    date: "2026-02-05",
    color: "hsl(160 60% 50%)",
    cta: CONNECTION_STYLE_CTA,
  },
  {
    slug: "the-im-bad-at-dating-reframe",
    title: "The 'I'm Bad at Dating' Reframe",
    excerpt:
      "When someone says they are bad at dating they usually mean they have a pattern they cannot see and a verdict they have already filed. The reframe is not pep talk. It is changing the noun.",
    category: "Mindset",
    readMin: 7,
    date: "2026-01-29",
    color: "hsl(40 80% 55%)",
    cta: MIRROR_CTA,
  },
  {
    slug: "self-knowledge-is-the-pressure-point",
    title: "Self-Knowledge Is the Pressure Point Everyone Skips",
    excerpt:
      "People spend years getting better at reading other people. The smaller, less glamorous move is getting accurate about yourself. Done honestly it outperforms every dating tactic stacked together.",
    category: "Self-Awareness",
    readMin: 8,
    date: "2026-01-22",
    color: "hsl(248 62% 62%)",
    cta: MIRROR_CTA,
  },
  {
    slug: "healing-and-avoidance-look-the-same-from-the-outside",
    title: "Healing and Avoidance Look the Same From the Outside",
    excerpt:
      "Same app break. Same journal. Same therapist. The difference is internal and almost no one tells you what to listen for. Here is the test that actually works.",
    category: "Self-Awareness",
    readMin: 8,
    date: "2026-01-15",
    color: "hsl(228 18% 65%)",
    cta: MIRROR_CTA,
  },
  {
    slug: "what-wellness-actually-means-when-youre-dating",
    title: "What Wellness Actually Means When You're Dating",
    excerpt:
      "Not green smoothies. Not silent retreats. Wellness in a dating context is your capacity to feel a thing and still be legible to another person. Sleep counts. Friends count. Rage counts.",
    category: "Wellness",
    readMin: 7,
    date: "2026-01-08",
    color: "hsl(160 60% 50%)",
    cta: CONNECTION_STYLE_CTA,
  },
  {
    slug: "the-question-you-keep-not-asking-yourself",
    title: "The Question You Keep Not Asking Yourself",
    excerpt:
      "There is one question most people dodge every time they get into something new. It is not about them. It is about the slot they are filling for you. Answering it honestly changes who you swipe on.",
    category: "Self-Awareness",
    readMin: 7,
    date: "2026-01-01",
    color: "hsl(280 70% 60%)",
    cta: DATES_CTA,
  },
  {
    slug: "you-are-not-your-pattern",
    title: "You Are Not Your Pattern",
    excerpt:
      "Knowing your pattern is useful. Becoming your pattern is a trap. The difference between describing a habit and prescribing an identity is most of what self-help gets wrong.",
    category: "Mindset",
    readMin: 7,
    date: "2025-12-25",
    color: "hsl(326 100% 65%)",
    cta: INSIGHTS_CTA,
  },
  {
    slug: "picking-right-is-not-the-skill",
    title: "Picking Right Is Not the Skill",
    excerpt:
      "The culture sells dating as selection. As if the entire game is sorting. The people who actually end up in good relationships are not better at picking. They are better at calibrating once they have picked.",
    category: "Mindset",
    readMin: 8,
    date: "2025-12-18",
    color: "hsl(var(--brand-indigo))",
    cta: CONNECTION_STYLE_CTA,
  },
  {
    slug: "what-actually-predicts-second-dates",
    title: "What Actually Predicts Second Dates",
    excerpt:
      "It is not chemistry in the usual sense. It is not how funny you were. The cleanest signal across hundreds of post-date debriefs is whether both people felt slightly more themselves at the end of the date than at the start.",
    category: "Compatibility",
    readMin: 7,
    date: "2025-12-11",
    color: "hsl(326 100% 65%)",
    cta: DATES_CTA,
  },
  {
    slug: "values-mismatch-shows-up-early",
    title: "Values Mismatches Show Up Earlier Than You Think",
    excerpt:
      "The cliché is that values reveal themselves over time. In practice they show up by date three. The reason people miss them is that values rarely announce themselves in the language of values. They show up as small frictions you talk yourself out of.",
    category: "Compatibility",
    readMin: 8,
    date: "2025-12-04",
    color: "hsl(280 70% 60%)",
    cta: COMPASS_CTA,
  },
  {
    slug: "conflict-instinct-is-a-compatibility-signal",
    title: "Conflict Instinct Is a Compatibility Signal",
    excerpt:
      "Most people audition partners on a calm Tuesday. That tells you almost nothing. What predicts the relationship is what each of you does on the third bad Wednesday in a row. The instinct under pressure is the data.",
    category: "Compatibility",
    readMin: 7,
    date: "2025-11-27",
    color: "hsl(12 90% 60%)",
    cta: INSIGHTS_CTA,
  },
  {
    slug: "the-love-pace-conversation",
    title: "The Love-Pace Conversation Nobody Has",
    excerpt:
      "Two people can want the same thing and still tear each other apart because one of them wants it in six months and the other wants it in three years. Pace is a compatibility dimension hiding in plain sight.",
    category: "Compatibility",
    readMin: 8,
    date: "2025-11-20",
    color: "hsl(190 75% 50%)",
    cta: COMPASS_CTA,
  },
  {
    slug: "chemistry-is-not-compatibility",
    title: "Chemistry Is Not Compatibility (And Confusing Them Costs You Years)",
    excerpt:
      "Chemistry is what makes the first three dates feel like a movie. Compatibility is what determines whether you are still in the same room on a Wednesday in February two years later. They feel similar from the inside. They are not the same thing.",
    category: "Compatibility",
    readMin: 8,
    date: "2025-11-13",
    color: "hsl(var(--brand-indigo))",
    cta: CONNECTION_STYLE_CTA,
  },
  {
    slug: "money-family-kids-the-conversations-everyone-delays",
    title: "Money, Family, Kids: The Conversations Everyone Delays",
    excerpt:
      "The four heavy topics, money, family, kids, ambition, are the ones most people defer until they are already attached. Then the answers feel like betrayals. Earlier is kinder. Earlier is also more honest.",
    category: "Compatibility",
    readMin: 9,
    date: "2025-11-06",
    color: "hsl(160 60% 50%)",
    cta: MIRROR_CTA,
  },
  {
    slug: "fixable-vs-structural-mismatch",
    title: "Fixable vs Structural Mismatches",
    excerpt:
      "Some incompatibilities resolve. Some never do. Most people cannot tell the difference in the moment, so they either bail on workable problems or grind for years against unworkable ones. The categories are clearer than they look.",
    category: "Compatibility",
    readMin: 8,
    date: "2025-10-30",
    color: "hsl(280 70% 60%)",
    cta: COMPASS_CTA,
  },
  {
    slug: "compatibility-is-mostly-about-defaults",
    title: "Compatibility Is Mostly About Defaults",
    excerpt:
      "When people talk about compatibility they usually describe shared interests. The actual thing that predicts whether a couple lasts is whether their unconscious defaults line up. What each of you does on autopilot is most of the relationship.",
    category: "Compatibility",
    readMin: 8,
    date: "2025-10-23",
    color: "hsl(326 100% 65%)",
    cta: CONNECTION_STYLE_CTA,
  },
  {
    slug: "dating-fatigue-is-real-and-its-fixable",
    title: "Dating Fatigue Is Real, and It's Fixable",
    excerpt:
      "Dating fatigue is not a moral failure. It is a bandwidth problem. The brain you brought to the apps was not built to grade a thousand faces a month with no end state. The fixes are structural, not motivational.",
    category: "Rituals",
    readMin: 9,
    date: "2025-10-16",
    color: "hsl(40 85% 60%)",
    cta: MIRROR_CTA,
  },
  {
    slug: "the-reset-week-and-why-it-works",
    title: "The Reset Week, and Why It Works",
    excerpt:
      "Seven days off the apps, off the threads, off the planning. Sounds like permission to do nothing. It is actually maintenance. Five specific things move during a reset week, in roughly this order, and most of them are not what you expect.",
    category: "Rituals",
    readMin: 9,
    date: "2025-10-09",
    color: "hsl(180 60% 55%)",
    cta: MIRROR_CTA,
  },
  {
    slug: "journaling-without-making-it-homework",
    title: "Journaling Without Making It Homework",
    excerpt:
      "Most journaling advice tells you to write every day for thirty minutes. None of that works for normal humans. The version that does work is much smaller and built around the specific texture of dating, which is fast and forgets itself.",
    category: "Rituals",
    readMin: 9,
    date: "2025-10-02",
    color: "hsl(280 55% 60%)",
    cta: MIRROR_CTA,
  },
  {
    slug: "post-date-reflection-without-the-spiral",
    title: "Post-Date Reflection Without the Spiral",
    excerpt:
      "The hour after a date is the most dangerous hour of the week, if you are the kind of person who reflects. The question is not whether to reflect. It is when, and how, without warping the date in your memory for weeks.",
    category: "Rituals",
    readMin: 8,
    date: "2025-09-25",
    color: "hsl(210 65% 60%)",
    cta: DATES_CTA,
  },
  {
    slug: "when-to-delete-the-apps-actually",
    title: "When to Delete the Apps, Actually",
    excerpt:
      "Most 'I deleted the apps' announcements are theatre. That is fine. But you should know which version you are doing, because the real delete and the performance one require different reasons, and only one of them helps.",
    category: "Rituals",
    readMin: 9,
    date: "2025-09-18",
    color: "hsl(0 65% 60%)",
    cta: CONNECTION_STYLE_CTA,
  },
  {
    slug: "taking-a-real-break-vs-avoiding",
    title: "Taking a Real Break vs Avoiding",
    excerpt:
      "Resting from dating and hiding from it look identical from the outside, and feel identical from the inside, for about two weeks. Then they diverge. One question separates them. Honest answer required.",
    category: "Rituals",
    readMin: 9,
    date: "2025-09-11",
    color: "hsl(160 55% 50%)",
    cta: MIRROR_CTA,
  },
  {
    slug: "micro-rituals-between-dates",
    title: "Micro-Rituals Between Dates",
    excerpt:
      "Dating is full of high-stakes moments and almost no infrastructure between them. Small grooves in the week hold the dating part of your life from sloshing into the rest. Four properties make one work. Most fail because they are too big.",
    category: "Rituals",
    readMin: 8,
    date: "2025-09-04",
    color: "hsl(326 60% 60%)",
    cta: MIRROR_CTA,
  },
  {
    slug: "the-sunday-night-wind-down-with-yourself",
    title: "The Sunday-Night Wind-Down With Yourself",
    excerpt:
      "Sunday night is the most underrated hour in a dater's week. Most people waste it on dread about Monday. The ones who use it well get something back no other time offers. Four questions, in a specific order, doing quiet work.",
    category: "Rituals",
    readMin: 9,
    date: "2025-08-28",
    color: "hsl(250 60% 60%)",
    cta: MIRROR_CTA,
  },
];
