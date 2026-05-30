/**
 * Quiz Lab, short, fun, archetype-based quizzes that double as a low-friction
 * way for people to surface their wellness dimensions without filling out a
 * questionnaire. Each result is a "badge" with a tagline + 2-3 sentences of
 * insight. Results persist to localStorage; when signed in (and consent on),
 * answers are also written to `wellness_answers` via the existing endpoint.
 *
 * Anonymous-first by design: no account required to take a quiz or see the
 * result. The whole funnel is: take quiz → see badge + AI-personalised
 * insight → "save this to your dating second-brain" upsell.
 */

export interface QuizOption {
  label: string;
  /** Score contribution per archetype key. Sparse map. */
  scores: Record<string, number>;
  /**
   * Wellness answer this option implies. Optional, when present and the
   * user has consented, we write a row into wellness_answers on completion.
   */
  wellness?: {
    questionId: string;
    dimension: string;
    category?: string;
    questionText: string;
    answer: string;
  };
}

export interface QuizQuestion {
  q: string;
  options: QuizOption[];
}

export interface QuizArchetype {
  name: string;
  emoji: string;
  tagline: string;
  /** 2-3 sentence insight body. */
  insight: string;
  /** One actionable next step. */
  nextStep: string;
  /** Where to send them next inside the product. */
  cta: { label: string; href: string };
  /** Brand color hsl triplet (without `hsl(...)` wrapper). */
  color: string;
}

export interface Quiz {
  slug: string;
  title: string;
  pitch: string;
  /** Estimated time-to-complete in seconds. */
  durationSec: number;
  emoji: string;
  /** Short wellness dimension(s) this quiz quietly maps to. Shown in the hub. */
  feeds: string[];
  questions: QuizQuestion[];
  archetypes: Record<string, QuizArchetype>;
}

// ── Quiz 1: How Do You Love? ────────────────────────────────────────────────
const LOVE_PACE: Quiz = {
  slug: "love-pace",
  title: "How do you love?",
  pitch: "Five questions to find your love-pace archetype, the speed and shape of how you actually fall.",
  durationSec: 90,
  emoji: "💗",
  feeds: ["intimacy.pace", "communication.tempo", "affection.style"],
  questions: [
    {
      q: "Three good dates in. How do you feel?",
      options: [
        { label: "Already picturing the next six months", scores: { freefaller: 2, devoted: 1 }, wellness: { questionId: "intimacy.pace", dimension: "intimacy", category: "pace", questionText: "How quickly do you tend to develop feelings in early dating?", answer: "Fast, I'm usually all-in by date three if it's right." } },
        { label: "Curious, optimistic, holding it lightly", scores: { steady: 2, observer: 1 }, wellness: { questionId: "intimacy.pace", dimension: "intimacy", category: "pace", questionText: "How quickly do you tend to develop feelings in early dating?", answer: "Steady, I let things unfold without forcing pace." } },
        { label: "Pleasantly surprised but waiting for proof", scores: { observer: 2, builder: 1 }, wellness: { questionId: "intimacy.pace", dimension: "intimacy", category: "pace", questionText: "How quickly do you tend to develop feelings in early dating?", answer: "Slow, I want to see consistency before I open up." } },
        { label: "It's nice. Let's see if they're real", scores: { builder: 2, observer: 1 }, wellness: { questionId: "intimacy.pace", dimension: "intimacy", category: "pace", questionText: "How quickly do you tend to develop feelings in early dating?", answer: "Cautious, I'm watching how they actually show up." } },
      ],
    },
    {
      q: "What's your texting tempo with someone you like?",
      options: [
        { label: "Constant. We're basically narrating our day to each other", scores: { freefaller: 2, devoted: 2 }, wellness: { questionId: "communication.tempo", dimension: "communication", category: "tempo", questionText: "What's your natural texting tempo?", answer: "High, frequent contact feels like connection to me." } },
        { label: "Daily, warm, but I don't sit on my phone", scores: { steady: 2, devoted: 1 }, wellness: { questionId: "communication.tempo", dimension: "communication", category: "tempo", questionText: "What's your natural texting tempo?", answer: "Daily but not constant, I have my own life going on." } },
        { label: "Bursts when there's something real to say", scores: { observer: 2, builder: 1 }, wellness: { questionId: "communication.tempo", dimension: "communication", category: "tempo", questionText: "What's your natural texting tempo?", answer: "Bursty, I prefer quality over constant pings." } },
        { label: "I'd rather see them in person than text", scores: { builder: 2, observer: 1 }, wellness: { questionId: "communication.tempo", dimension: "communication", category: "tempo", questionText: "What's your natural texting tempo?", answer: "Low, text is logistics, real talk happens in person." } },
      ],
    },
    {
      q: "Your favorite version of falling for someone is...",
      options: [
        { label: "The headfirst kind, chemistry that feels inevitable", scores: { freefaller: 2 } },
        { label: "The slow reveal, one detail at a time until you can't unsee them", scores: { steady: 2, builder: 1 } },
        { label: "The earned kind, proof, then trust, then feeling", scores: { builder: 2, observer: 1 } },
        { label: "The aligned kind, when your lives obviously fit", scores: { devoted: 2, steady: 1 } },
      ],
    },
    {
      q: "When you really like someone and they go quiet for a day...",
      options: [
        { label: "I notice it loudly. I'm reaching out by tomorrow", scores: { freefaller: 2, devoted: 1 } },
        { label: "I notice but assume their life is happening", scores: { steady: 2, observer: 1 } },
        { label: "I file it. Pattern over time matters more than one day", scores: { observer: 2, builder: 1 } },
        { label: "It's actually a small relief", scores: { builder: 2 } },
      ],
    },
    {
      q: "What's the move that makes you feel most seen?",
      options: [
        { label: "Real intensity, they say what they actually feel", scores: { freefaller: 2, devoted: 1 }, wellness: { questionId: "affection.style", dimension: "affection", category: "style", questionText: "What's your primary love language?", answer: "Verbal affirmation and emotional intensity." } },
        { label: "Consistency, they show up when they said they would", scores: { steady: 2, builder: 1 }, wellness: { questionId: "affection.style", dimension: "affection", category: "style", questionText: "What's your primary love language?", answer: "Quality time and reliable presence." } },
        { label: "Curiosity, they ask the second question, not just the first", scores: { observer: 2, devoted: 1 }, wellness: { questionId: "affection.style", dimension: "affection", category: "style", questionText: "What's your primary love language?", answer: "Curiosity and being deeply known." } },
        { label: "Plans, they make space for me in their actual life", scores: { builder: 2, devoted: 1 }, wellness: { questionId: "affection.style", dimension: "affection", category: "style", questionText: "What's your primary love language?", answer: "Acts of service and integrating me into their life." } },
      ],
    },
  ],
  archetypes: {
    freefaller: {
      name: "The Freefaller",
      emoji: "🌠",
      tagline: "You feel it fast and you don't apologize for it. Your superpower is presence; your edge is pacing.",
      insight: "You bring an intensity most people don't, which means when you land with the right person, the connection is electric early. The challenge is that fast-feeling people often partner with slow-feeling people, which can read as you being 'too much' when really you're just operating at a different speed. The work isn't dimming your wattage; it's giving them runway to catch up.",
      nextStep: "Try a 'one-day delay' before your most enthusiastic reply this week. Not to play games, but to see whether the urgency is yours or theirs.",
      cta: { label: "Map your full Connection Style", href: "/connection-style" },
      color: "326 100% 65%",
    },
    steady: {
      name: "The Steady",
      emoji: "🕊️",
      tagline: "You love at the pace of actual life. Real, reliable, unflashy, and rarer than you think.",
      insight: "You move at the speed of evidence. You're not avoiding intensity; you're earning it. People who date you describe it as 'easy', which is meant as a compliment but you sometimes hear as 'unexciting'. It's not. The right person will register your steadiness as safety, not absence.",
      nextStep: "Make one small move this week that's louder than feels natural: a specific compliment, an unprompted plan. Steady doesn't have to mean quiet.",
      cta: { label: "See how your messages land", href: "/coach" },
      color: "190 55% 60%",
    },
    observer: {
      name: "The Observer",
      emoji: "🔭",
      tagline: "You're the one watching the whole movie. You read patterns most people miss, and you let them play out before you decide.",
      insight: "You don't get fooled often. You log inconsistencies, you notice tone shifts, you wait for the third date because the third date tells the truth. This makes you a great partner to the right person and slightly terrifying to the wrong one. The shadow: sometimes the watching becomes a way to stay safe instead of a way to choose well.",
      nextStep: "On your next date, share one thing you usually wait three dates to mention. See what it changes.",
      cta: { label: "Run a Compatibility Compass read", href: "/compatibility-compass" },
      color: "248 62% 62%",
    },
    builder: {
      name: "The Builder",
      emoji: "🏗️",
      tagline: "You're not looking for fireworks. You're looking for someone you can build a life with, and you check the foundation first.",
      insight: "You think in terms of fit, not chemistry. This is mature and underrated and exactly what works long-term. The challenge in early dating is that the apps reward chemistry-forward profiles, so your kind of love can read as muted on first scroll. Once someone gets the full picture of you, they tend to stay.",
      nextStep: "Add one specific 'what I'm building' line to your profile this week. Not 'looking for partnership'. Say what the actual life looks like.",
      cta: { label: "Audit your profile for fit signals", href: "/start" },
      color: "43 65% 62%",
    },
    devoted: {
      name: "The Devoted",
      emoji: "🪢",
      tagline: "Once you choose someone, you choose them. Loyalty isn't a performance for you. It's the baseline.",
      insight: "You don't half-show-up. The person you're dating gets your attention, your effort, and your time. This is rare and the right person will recognize it within a month. The challenge: devoted people sometimes invest before someone has earned it, and then have a hard time recalibrating when the investment isn't being matched.",
      nextStep: "Pick one specific behavior you'd need from a partner to keep showing up the way you do. Name it before the next person you meet.",
      cta: { label: "Track date patterns over time", href: "/mirror/dates" },
      color: "326 100% 65%",
    },
  },
};

// ── Quiz 2: Conflict Instinct ───────────────────────────────────────────────
const CONFLICT_INSTINCT: Quiz = {
  slug: "conflict-instinct",
  title: "What's your conflict instinct?",
  pitch: "How you handle tension in early dating shapes whether real intimacy ever gets a chance. Six questions.",
  durationSec: 75,
  emoji: "⚡",
  feeds: ["conflict.style", "communication.repair", "boundaries.expression"],
  questions: [
    {
      q: "They said something that landed wrong. Your first move?",
      options: [
        { label: "Name it in the moment, calmly", scores: { confronter: 2, repairer: 1 }, wellness: { questionId: "conflict.style", dimension: "conflict", category: "style", questionText: "How do you typically handle tension in early dating?", answer: "Direct, I name what landed wrong in the moment." } },
        { label: "Sit with it. Bring it up next time if it still bothers me", scores: { processor: 2, repairer: 1 }, wellness: { questionId: "conflict.style", dimension: "conflict", category: "style", questionText: "How do you typically handle tension in early dating?", answer: "Process first, then talk, I need time before I can articulate it well." } },
        { label: "Make a mental note. Don't say anything", scores: { archiver: 2 }, wellness: { questionId: "conflict.style", dimension: "conflict", category: "style", questionText: "How do you typically handle tension in early dating?", answer: "I track it internally but don't usually surface it early on." } },
        { label: "Shift the energy, joke, change subject, move on", scores: { smoother: 2, archiver: 1 }, wellness: { questionId: "conflict.style", dimension: "conflict", category: "style", questionText: "How do you typically handle tension in early dating?", answer: "Smooth it over and keep the vibe, I bring it up later if at all." } },
      ],
    },
    {
      q: "You hurt their feelings and didn't mean to. What do you do?",
      options: [
        { label: "Apologize clearly and ask what you can do differently", scores: { repairer: 2, confronter: 1 } },
        { label: "Take a beat, think about it, come back with something real", scores: { processor: 2, repairer: 1 } },
        { label: "Explain what you meant, clear up the misunderstanding", scores: { confronter: 2 } },
        { label: "Find a sweet way to make it better. Soften the moment", scores: { smoother: 2 } },
      ],
    },
    {
      q: "Mid-argument, you can feel yourself getting flooded. What now?",
      options: [
        { label: "Say 'I need 20 minutes' and step away clearly", scores: { processor: 2, repairer: 2 }, wellness: { questionId: "communication.repair", dimension: "communication", category: "repair", questionText: "What do you do when a conversation gets emotionally activated?", answer: "I name that I'm flooded and take a clean pause." } },
        { label: "Push through, better to finish it than leave it hanging", scores: { confronter: 2, archiver: 1 }, wellness: { questionId: "communication.repair", dimension: "communication", category: "repair", questionText: "What do you do when a conversation gets emotionally activated?", answer: "I push through, I'd rather resolve than pause." } },
        { label: "Go quiet. The conversation usually ends itself", scores: { archiver: 2, smoother: 1 }, wellness: { questionId: "communication.repair", dimension: "communication", category: "repair", questionText: "What do you do when a conversation gets emotionally activated?", answer: "I tend to go quiet and let the moment pass." } },
        { label: "Move us off the topic. We can come back later", scores: { smoother: 2 }, wellness: { questionId: "communication.repair", dimension: "communication", category: "repair", questionText: "What do you do when a conversation gets emotionally activated?", answer: "I redirect to neutral ground and revisit when calm." } },
      ],
    },
    {
      q: "How do you bring up something that's bothering you?",
      options: [
        { label: "Straight. 'Hey, this thing, can we talk?'", scores: { confronter: 2, repairer: 1 } },
        { label: "Carefully, after I've figured out exactly what I want to say", scores: { processor: 2 } },
        { label: "Honestly? I usually don't. I assess instead", scores: { archiver: 2 } },
        { label: "Wrapped in a softer ask so it doesn't feel heavy", scores: { smoother: 2, repairer: 1 } },
      ],
    },
    {
      q: "After a hard conversation, your priority is...",
      options: [
        { label: "Knowing we're okay. I want the reconnect", scores: { repairer: 2, smoother: 1 } },
        { label: "Understanding what actually happened, for both of us", scores: { processor: 2, confronter: 1 } },
        { label: "Watching what they do next. Words are cheap", scores: { archiver: 2 } },
        { label: "Resetting the mood quickly so we can keep enjoying each other", scores: { smoother: 2 } },
      ],
    },
    {
      q: "What's the move from a partner that builds real trust with you?",
      options: [
        { label: "They tell me the hard thing directly", scores: { confronter: 2 } },
        { label: "They come back after a fight with a real apology and a change", scores: { repairer: 2, processor: 1 } },
        { label: "They keep their word over months, not days", scores: { archiver: 2 } },
        { label: "They protect the connection even when they're frustrated", scores: { smoother: 2 } },
      ],
    },
  ],
  archetypes: {
    confronter: {
      name: "The Direct Line",
      emoji: "🎯",
      tagline: "You'd rather have the awkward conversation now than the worse one later. People with you know where they stand.",
      insight: "You don't let things fester. Your style works beautifully with someone who can match the directness, and crushes someone who needs more runway. The skill to develop: noticing whether your directness is information or pressure, and using slightly more wrap when the other person is the cautious type.",
      nextStep: "Next hard convo, lead with what you want before what's wrong. 'I want this to keep working, which is why I'm bringing this up.'",
      cta: { label: "Test how a message will land", href: "/coach" },
      color: "248 62% 62%",
    },
    processor: {
      name: "The Slow Drafter",
      emoji: "📝",
      tagline: "You don't react, you respond, once you've actually thought it through. People with you get measured, accurate, true.",
      insight: "Your gift is that what you say is what you actually mean. Your edge: the processing time can read as withdrawal or punishment to someone who needs reassurance in the moment. Saying 'I want to think about this and come back in 20 minutes' is the move. It names the delay so they don't fill it with worst-case stories.",
      nextStep: "Practice the bridge sentence: 'I hear you. I want to think before I respond. Back in an hour.' Then actually come back in an hour.",
      cta: { label: "Log a date or hard convo", href: "/mirror/dates" },
      color: "190 55% 60%",
    },
    archiver: {
      name: "The Pattern Reader",
      emoji: "🗂️",
      tagline: "You don't make a thing of individual moments, you watch the trend. This makes you wise and, occasionally, withholding.",
      insight: "You collect data instead of confronting. Over months, this means you see things other people miss. In early dating, it can mean things go quietly stale because the other person didn't know there was anything to fix. The growth edge: one specific, low-stakes piece of feedback shared early changes the relationship's whole trajectory.",
      nextStep: "Pick one small thing you've quietly noted in your last 2 connections. Say it once, early, in a low-stakes moment. See what happens.",
      cta: { label: "See your patterns from messages", href: "/insights" },
      color: "228 18% 65%",
    },
    smoother: {
      name: "The Atmosphere",
      emoji: "🌅",
      tagline: "You keep the temperature right. You protect the connection. People feel safe and warm with you.",
      insight: "You're the reason fights don't spiral and dates don't curdle. The shadow: smoothing can become avoiding, and the things that didn't get said become resentments that show up months later disguised as something else. Real repair sometimes means letting it stay uncomfortable for an hour.",
      nextStep: "This week, when you'd usually shift the energy, try staying with the awkward for one extra minute. Watch what comes out of you.",
      cta: { label: "Find your connection style", href: "/connection-style" },
      color: "43 65% 62%",
    },
    repairer: {
      name: "The Repair Artist",
      emoji: "🧵",
      tagline: "You're the rare person who can both name what's wrong AND restitch the connection after. This is genuinely uncommon.",
      insight: "You don't avoid hard conversations and you don't get stuck in them. You can hold 'this hurt me' and 'I still want this' in the same sentence. This makes you the kind of partner relationships survive on. Watch for over-functioning: doing all the repair work yourself while the other person watches.",
      nextStep: "Next time something needs repair, wait 24 hours before you initiate it. See if they come to you. Their move tells you a lot.",
      cta: { label: "See how messages actually read", href: "/coach" },
      color: "326 100% 65%",
    },
  },
};

// ── Quiz 3: What Lights You Up? ─────────────────────────────────────────────
const ENERGY_SOURCES: Quiz = {
  slug: "what-lights-you-up",
  title: "What lights you up?",
  pitch: "Find your aliveness signature, what genuinely energises you and what to put in your profile so the right people lean in.",
  durationSec: 60,
  emoji: "✨",
  feeds: ["lifestyle.energy_sources", "values.priorities", "social.style"],
  questions: [
    {
      q: "Free Saturday, no obligations. Best version of it looks like...",
      options: [
        { label: "Three plans, three friend groups, ending somewhere unexpected", scores: { kindler: 2, gatherer: 2 }, wellness: { questionId: "lifestyle.weekend", dimension: "lifestyle", category: "weekend", questionText: "What does your ideal Saturday look like?", answer: "Social and full, multiple plans, lots of energy." } },
        { label: "Long walk, good coffee, one person I really like", scores: { tender: 2, depthseeker: 1 }, wellness: { questionId: "lifestyle.weekend", dimension: "lifestyle", category: "weekend", questionText: "What does your ideal Saturday look like?", answer: "Slow and intimate, one person, quality time, simple pleasures." } },
        { label: "Trying something I've never done, class, neighbourhood, food", scores: { explorer: 2, kindler: 1 }, wellness: { questionId: "lifestyle.weekend", dimension: "lifestyle", category: "weekend", questionText: "What does your ideal Saturday look like?", answer: "Novelty and exploration, trying something new." } },
        { label: "Building something, a project, a meal, a plan for the year", scores: { maker: 2, depthseeker: 1 }, wellness: { questionId: "lifestyle.weekend", dimension: "lifestyle", category: "weekend", questionText: "What does your ideal Saturday look like?", answer: "Producing something, focused, generative time." } },
        { label: "Reading something dense and then thinking about it for hours", scores: { depthseeker: 2 }, wellness: { questionId: "lifestyle.weekend", dimension: "lifestyle", category: "weekend", questionText: "What does your ideal Saturday look like?", answer: "Quiet and intellectual, deep thought, no agenda." } },
      ],
    },
    {
      q: "Pick the compliment that would mean the most.",
      options: [
        { label: "'You make every room more fun.'", scores: { kindler: 2, gatherer: 1 } },
        { label: "'You're the easiest person to be with.'", scores: { tender: 2 } },
        { label: "'You're the most interesting person I've met this year.'", scores: { explorer: 2, depthseeker: 1 } },
        { label: "'I learn something from you every time.'", scores: { depthseeker: 2, maker: 1 } },
        { label: "'You actually do the things you say you'll do.'", scores: { maker: 2 } },
      ],
    },
    {
      q: "What recharges you when you're tapped out?",
      options: [
        { label: "Being around people who love me, no agenda", scores: { gatherer: 2, tender: 1 } },
        { label: "Solitude. A book. A walk. A quiet meal", scores: { depthseeker: 2, tender: 1 } },
        { label: "A workout that wrecks me", scores: { maker: 2, kindler: 1 } },
        { label: "Doing something brand new", scores: { explorer: 2, kindler: 1 } },
        { label: "A great conversation that goes somewhere", scores: { depthseeker: 1, tender: 2 } },
      ],
    },
    {
      q: "Which one would you actually put effort into for a partner?",
      options: [
        { label: "Planning experiences they'd never plan for themselves", scores: { explorer: 2, kindler: 1 } },
        { label: "Building real rituals, Sunday breakfast, monthly trip, etc.", scores: { maker: 2, tender: 1 } },
        { label: "Getting their people into my orbit and vice versa", scores: { gatherer: 2 } },
        { label: "Knowing them at depth, what shaped them, what scares them", scores: { depthseeker: 2, tender: 1 } },
        { label: "Showing up in the small ways every single day", scores: { tender: 2 } },
      ],
    },
    {
      q: "The thing you wish more people on apps led with is...",
      options: [
        { label: "What they actually do for fun, with detail", scores: { kindler: 1, explorer: 2 } },
        { label: "What they care about and why", scores: { depthseeker: 2, tender: 1 } },
        { label: "What they're building or working toward", scores: { maker: 2 } },
        { label: "Their people, what their friends and family are like", scores: { gatherer: 2 } },
        { label: "Specific moments. Real ones. Not vibes", scores: { depthseeker: 1, explorer: 1, tender: 1, maker: 1 } },
      ],
    },
  ],
  archetypes: {
    kindler: {
      name: "The Kindler",
      emoji: "🔥",
      tagline: "You bring the energy. Rooms turn up when you walk in. Your profile should sound the way you actually feel.",
      insight: "You're a high-output, high-warmth person and the apps usually underplay you because warmth doesn't photograph. The profile move: lead with a specific recent moment that shows the energy (not 'love to laugh', show what made you laugh hardest this week). Right people lean in immediately.",
      nextStep: "Rewrite your first line as a single recent moment. 'Yesterday I…' beats 'I love…' every time.",
      cta: { label: "Run a free 3-min Signal Check", href: "/signal-check" },
      color: "43 65% 62%",
    },
    tender: {
      name: "The Tender",
      emoji: "🌿",
      tagline: "You love quietly and well. The right person will recognise it the moment they meet you. Your profile just has to show it.",
      insight: "You're not a fireworks person and that's a feature. The trick: 'easy to be with' is great in person and invisible in text. Your profile should lean specific over breezy: one detail about how you actually like Sundays, what you cook on weeknights, the friend you've had since you were ten. Specifics radiate warmth.",
      nextStep: "Pick one sentence in your current bio that's a generic vibe. Replace it with a real detail from this week.",
      cta: { label: "Audit your bio for warmth signals", href: "/start" },
      color: "190 55% 60%",
    },
    explorer: {
      name: "The Explorer",
      emoji: "🧭",
      tagline: "You're alive when there's something new. The profile move is to make the next date feel like an adventure, even a small one.",
      insight: "You filter for novelty and depth: places, ideas, people. Your bio probably sounds like everyone else's because we're all told to mention travel. Stand out by getting specific about the kind of exploring: 'I read about Antarctic exploration before bed' or 'I cannot stop trying neighbourhood ramen places'.",
      nextStep: "Propose a first date that's slightly novel: a museum, an unfamiliar cuisine, a walk somewhere neither of you knows. Watch your response rate.",
      cta: { label: "Run a Compatibility Compass read on a match", href: "/compatibility-compass" },
      color: "248 62% 62%",
    },
    maker: {
      name: "The Maker",
      emoji: "🛠️",
      tagline: "You build things: projects, careers, routines, lives. Your profile should sound like someone going somewhere on purpose.",
      insight: "You filter for direction and discipline. People who match your energy are out there but won't recognise you in a profile that hides what you're building. Be honest about the project: 'I'm in year three of building a clinic / writing a book / training for an ultra'. Specifics like this attract aligned humans and filter out chaos.",
      nextStep: "Put one specific 'what I'm building' line in your profile this week. Not aspirational, just what you're actually doing right now.",
      cta: { label: "Log this week in 60 seconds", href: "/mirror/dates" },
      color: "228 18% 65%",
    },
    depthseeker: {
      name: "The Depthseeker",
      emoji: "🌊",
      tagline: "You want the real conversation, the second question, the why behind the what. Your profile should make that obvious.",
      insight: "You filter out small talk fast and you're hungry for people who can go deep. The risk: profiles full of philosophy quotes attract performers, not depth. The move is asking better questions in the bio itself: share something specific you've been thinking about, frame it like an invitation to disagree.",
      nextStep: "Replace one bio line with an actual question you've been turning over. The right person will answer it on the first date.",
      cta: { label: "See your communication patterns", href: "/insights" },
      color: "326 100% 65%",
    },
    gatherer: {
      name: "The Gatherer",
      emoji: "🪩",
      tagline: "Your life has a center of gravity. People come over. Plans happen. The right partner will be drawn into your orbit.",
      insight: "You're the connector. The challenge is that 'I have a great life and friends' reads as a humble brag in a bio. Better: show one ritual ('Sunday breakfasts with the same four friends for six years') instead of describing the abundance. Lets the right person picture themselves in it.",
      nextStep: "Replace 'I love my friends' with one specific recurring thing you do with them. Two sentences max.",
      cta: { label: "Map your full connection style", href: "/connection-style" },
      color: "326 100% 65%",
    },
  },
};

// ── Quiz 4: Boundary Blueprint ──────────────────────────────────────────────
const BOUNDARY_BLUEPRINT: Quiz = {
  slug: "boundary-blueprint",
  title: "Your boundary blueprint",
  pitch: "How you hold your edges shapes who actually gets close. Five questions, real answers.",
  durationSec: 75,
  emoji: "🛡️",
  feeds: ["boundaries.style", "values.non_negotiables", "communication.requests"],
  questions: [
    {
      q: "Someone you're dating asks for a level of contact that's a bit much for you. You...",
      options: [
        { label: "Name the mismatch directly, propose what works for you", scores: { architect: 2, voice: 1 }, wellness: { questionId: "boundaries.style", dimension: "boundaries", category: "style", questionText: "How do you typically communicate a boundary?", answer: "Direct, I name the mismatch and propose what works." } },
        { label: "Try to flex and see if you can adjust", scores: { adapter: 2, holder: 1 }, wellness: { questionId: "boundaries.style", dimension: "boundaries", category: "style", questionText: "How do you typically communicate a boundary?", answer: "I tend to adapt first and see if it works." } },
        { label: "Pull back slowly, hope they notice", scores: { retreater: 2 }, wellness: { questionId: "boundaries.style", dimension: "boundaries", category: "style", questionText: "How do you typically communicate a boundary?", answer: "I tend to pull back rather than say it directly." } },
        { label: "Find a soft way to say no without making it heavy", scores: { voice: 2, adapter: 1 }, wellness: { questionId: "boundaries.style", dimension: "boundaries", category: "style", questionText: "How do you typically communicate a boundary?", answer: "Softly, I say no but wrap it carefully." } },
        { label: "Hold the line and don't over-explain", scores: { holder: 2, architect: 1 }, wellness: { questionId: "boundaries.style", dimension: "boundaries", category: "style", questionText: "How do you typically communicate a boundary?", answer: "I hold the line and don't justify it." } },
      ],
    },
    {
      q: "You realise three weeks in that you've been showing up more than they have. What do you do?",
      options: [
        { label: "Match their effort. See what they do", scores: { holder: 2, architect: 1 } },
        { label: "Name the asymmetry directly and ask about it", scores: { voice: 2, architect: 2 } },
        { label: "Try harder for a week, maybe I'm misreading it", scores: { adapter: 2 } },
        { label: "Get quieter and let them feel the absence", scores: { retreater: 2, holder: 1 } },
        { label: "Tell a friend, journal it, watch it for one more week", scores: { adapter: 1, voice: 1 } },
      ],
    },
    {
      q: "What's the boundary you've been working on most lately?",
      options: [
        { label: "Saying no without justifying it", scores: { holder: 2, voice: 1 } },
        { label: "Naming things in the moment instead of after", scores: { voice: 2, architect: 1 } },
        { label: "Not over-functioning to keep someone interested", scores: { architect: 2, holder: 1 } },
        { label: "Leaving when something's clearly off, instead of explaining it away", scores: { retreater: 1, holder: 2 } },
        { label: "Letting people in faster, opening, not just allowing", scores: { adapter: 2 } },
      ],
    },
    {
      q: "How do you know a 'no' is real for you and not a defence?",
      options: [
        { label: "It feels clean, there's no story spinning underneath", scores: { holder: 2, architect: 1 } },
        { label: "I can articulate why without getting heated", scores: { voice: 2, architect: 1 } },
        { label: "It still feels like mine after I sleep on it", scores: { adapter: 1, retreater: 1, voice: 1 } },
        { label: "I'm not avoiding something, I'm choosing", scores: { architect: 2, holder: 2 } },
        { label: "Honestly? I sometimes can't tell", scores: { retreater: 2, adapter: 1 } },
      ],
    },
    {
      q: "Pick the line that fits you best.",
      options: [
        { label: "'I know what I need and I can say it cleanly.'", scores: { architect: 2, voice: 1 } },
        { label: "'My yeses are honest because my no is real.'", scores: { holder: 2 } },
        { label: "'I'd rather have the harder conversation than carry the resentment.'", scores: { voice: 2, architect: 1 } },
        { label: "'I'm working on saying things sooner instead of swallowing them.'", scores: { adapter: 1, retreater: 1, voice: 1 } },
        { label: "'I drop people who can't hear me, without drama.'", scores: { holder: 2, retreater: 1 } },
      ],
    },
  ],
  archetypes: {
    architect: {
      name: "The Architect",
      emoji: "📐",
      tagline: "You design your edges on purpose. People with you know exactly where they stand because you've actually thought it through.",
      insight: "You can articulate not just what your limits are but why they exist and what serves them. This is the rarest and most attractive boundary style, and it filters for partners who can do the same. The shadow: clarity can read as coldness to people who needed a soft entrance.",
      nextStep: "Pair one direct boundary this week with one specific reassurance: 'This is the limit. And here's what I'm still fully in for.'",
      cta: { label: "Map your connection style", href: "/connection-style" },
      color: "248 62% 62%",
    },
    holder: {
      name: "The Holder",
      emoji: "🗿",
      tagline: "Once you say no, it's no. Once you say yes, you mean it. People learn fast that your word is the thing.",
      insight: "Your yes is honest because your no is real. You don't get pulled into negotiations about your limits and that energy is, frankly, magnetic. The growth edge: holders sometimes go from 'no' to 'gone' too fast, missing chances to teach someone how to date you well.",
      nextStep: "Next time you hold a boundary, follow it with one specific 'here's what would work' instead of a clean no. See what shifts.",
      cta: { label: "See how your messages land", href: "/coach" },
      color: "228 18% 65%",
    },
    voice: {
      name: "The Voice",
      emoji: "📣",
      tagline: "You name things. In real time, with care, without softening so much that the message gets lost. This is the work most people are still trying to do.",
      insight: "You bring stuff up. Friends call you when they need help rehearsing a hard conversation. The skill is real; the trap is becoming the explainer in every relationship, doing the emotional naming for both of you. Make sure they're learning to name things too, not just learning to listen.",
      nextStep: "On your next mild discomfort, don't name it. See if they notice. Their noticing-rate tells you something important.",
      cta: { label: "Track date debriefs over time", href: "/mirror/dates" },
      color: "326 100% 65%",
    },
    adapter: {
      name: "The Adapter",
      emoji: "🌊",
      tagline: "You meet people where they are. Your range is enormous, and the work is learning when adapting becomes erasing.",
      insight: "You're flexible in ways most people aren't, which makes you great at the first month of a relationship and a real risk to yourself by month three. The pattern to watch: realising you've been the one accommodating, then resenting them for not noticing. Naming what you need earlier prevents that loop.",
      nextStep: "This week, identify one small preference you've been suppressing. Name it casually, low-stakes, see what happens.",
      cta: { label: "Find your communication style", href: "/insights" },
      color: "190 55% 60%",
    },
    retreater: {
      name: "The Retreater",
      emoji: "🚪",
      tagline: "When something's off, you pull back rather than push back. This protects you, but it also means people often don't know what happened.",
      insight: "Going quiet is a real boundary, just an invisible one. Which means the people who deserve to hear from you sometimes don't, and the people who don't deserve your time still get to wonder. The growth edge: one specific sentence at the point of pulling back changes the dynamic completely.",
      nextStep: "Next time you'd usually go quiet, try one sentence: 'I need some space, I'll be back in a few days.' Then actually come back.",
      cta: { label: "See what your messages reveal", href: "/coach" },
      color: "43 65% 62%",
    },
  },
};

// ── Quiz 5: Attachment Style ────────────────────────────────────────────────
const ATTACHMENT_STYLE: Quiz = {
  slug: "attachment-style",
  title: "What's your dating attachment style?",
  pitch: "Five questions to surface the pattern you actually run when someone starts to matter. Built on real attachment research, no horoscope vibes.",
  durationSec: 75,
  emoji: "🧷",
  feeds: ["attachment.style", "attachment.activation", "attachment.deactivation"],
  questions: [
    {
      q: "Three days of light texting, then they go quiet for a day. Your head goes where first?",
      options: [
        { label: "Probably busy. I'll get back to my day.", scores: { secure: 2 }, wellness: { questionId: "attachment.activation", dimension: "attachment", category: "activation", questionText: "How do you respond to a normal delay in early dating?", answer: "I assume normal life and stay regulated." } },
        { label: "Did I say something off? I reread the thread.", scores: { anxious: 2 }, wellness: { questionId: "attachment.activation", dimension: "attachment", category: "activation", questionText: "How do you respond to a normal delay in early dating?", answer: "I scan for what I might have done wrong." } },
        { label: "Cool. Less pressure. I get more done.", scores: { avoidant: 2 }, wellness: { questionId: "attachment.activation", dimension: "attachment", category: "activation", questionText: "How do you respond to a normal delay in early dating?", answer: "I feel relief at the space." } },
        { label: "Part of me wants more, part of me wants out. Both loud.", scores: { fearful: 2 } },
      ],
    },
    {
      q: "Second date went well. They want to lock plans in for next week. You feel...",
      options: [
        { label: "Good. I like clarity.", scores: { secure: 2 } },
        { label: "Relieved, and a little watchful. Don't want to seem too eager.", scores: { anxious: 1, secure: 1 } },
        { label: "A flicker of pressure. The week felt open a second ago.", scores: { avoidant: 2 } },
        { label: "Excited and weirdly nervous at the same time.", scores: { fearful: 2, anxious: 1 } },
      ],
    },
    {
      q: "They share something vulnerable on date three. What's your honest first move?",
      options: [
        { label: "Listen, ask one real question, share something back that fits.", scores: { secure: 2 } },
        { label: "Hold it carefully. Reassure them. Track how I'm doing later.", scores: { anxious: 2 } },
        { label: "Acknowledge it, then steer us somewhere lighter.", scores: { avoidant: 2 } },
        { label: "Match their depth, then panic a little about what I just shared.", scores: { fearful: 2 } },
      ],
    },
    {
      q: "Things are going well for a month. What's the thought you don't say out loud?",
      options: [
        { label: "Honestly, no big secret thought. I'm just present.", scores: { secure: 2 }, wellness: { questionId: "attachment.deactivation", dimension: "attachment", category: "deactivation", questionText: "When things are going well, what's your private inner experience?", answer: "I'm regulated and present." } },
        { label: "Waiting for the moment they pull back so I can prepare.", scores: { anxious: 2 }, wellness: { questionId: "attachment.deactivation", dimension: "attachment", category: "deactivation", questionText: "When things are going well, what's your private inner experience?", answer: "I'm bracing for the pullback." } },
        { label: "Noticing little things about them that bother me more than they should.", scores: { avoidant: 2 }, wellness: { questionId: "attachment.deactivation", dimension: "attachment", category: "deactivation", questionText: "When things are going well, what's your private inner experience?", answer: "I start finding flaws as things deepen." } },
        { label: "Wanting to disappear for a few days, then immediately wanting them close.", scores: { fearful: 2 }, wellness: { questionId: "attachment.deactivation", dimension: "attachment", category: "deactivation", questionText: "When things are going well, what's your private inner experience?", answer: "I swing between wanting space and wanting closeness." } },
      ],
    },
    {
      q: "Hard conversation needed. They go quiet for an evening to process. You...",
      options: [
        { label: "Give them the evening. Pick it up tomorrow.", scores: { secure: 2 } },
        { label: "Send one follow-up message to check we're okay.", scores: { anxious: 2 } },
        { label: "Quietly enjoy the quiet, even if I know we still need to talk.", scores: { avoidant: 2 } },
        { label: "Spiral, then send something, then wish I hadn't.", scores: { fearful: 2, anxious: 1 } },
      ],
    },
  ],
  archetypes: {
    secure: {
      name: "Secure Base",
      emoji: "🌳",
      tagline: "You can want closeness without needing it to prove something. People feel steadier around you, often without knowing why.",
      insight: "Secure attachment in dating doesn't mean nothing rattles you. It means your nervous system has a wide window and a soft landing. Your edge is patience with people who don't have your baseline yet. The growth move: notice when someone's wobble pulls you into managing them, and let them have their own process without absorbing it.",
      nextStep: "On your next date, share something that's actually true about you instead of the version that's easy to like. Watch how that lands.",
      cta: { label: "Read about attachment on the apps", href: "/blog/attachment-styles-on-dating-apps" },
      color: "150 45% 55%",
    },
    anxious: {
      name: "The Tuner",
      emoji: "🎻",
      tagline: "You feel people. You catch the small shifts. Your superpower is attunement, and your tax is overreading.",
      insight: "Anxious attachment in early dating sounds like you giving someone else's silence a script. The cost: you're often soothing a story that isn't happening. The skill: noticing the activation, naming it to yourself, and waiting one full day before acting on it. Most of what you're reading as warning signal turns out to be their normal life.",
      nextStep: "Next time their reply takes longer than feels comfortable, write what you want to send. Save it. Reread it tomorrow. Send only what still feels true.",
      cta: { label: "Read about attachment on the apps", href: "/blog/attachment-styles-on-dating-apps" },
      color: "326 75% 65%",
    },
    avoidant: {
      name: "The Independent",
      emoji: "🪨",
      tagline: "You like your own space and you keep your own counsel. Closeness is welcome, but never at the cost of your sovereignty.",
      insight: "Avoidant patterns in dating look like noticing flaws right when things get good, going quiet right when they ask for more, wanting the space more than the person sometimes. None of that means you're broken. It means closeness reads as a small threat to your system. The growth edge: name the pullback out loud instead of just doing it. 'I'm noticing I want some space this week' is a complete sentence.",
      nextStep: "When you feel the urge to ghost or fade, send one honest sentence about needing a beat. Then take the beat. Don't disappear without the sentence.",
      cta: { label: "Read about attachment on the apps", href: "/blog/attachment-styles-on-dating-apps" },
      color: "228 22% 60%",
    },
    fearful: {
      name: "The Push-Pull",
      emoji: "🌊",
      tagline: "You want closeness and you're scared of it, often in the same hour. Your inner world is louder than most people guess.",
      insight: "Fearful avoidant patterns mean closeness and threat live close together in your nervous system. Wanting it and bolting from it isn't contradiction, it's the wiring. The work isn't to pick a side. It's to slow down enough that you can feel both, name both to the person if it's safe, and let the relationship metabolise both. The right partner can hold this. Many can't. That's information.",
      nextStep: "Next time you feel both pulls at once, write 'I want closer and I want space' in your phone. Don't act on either for 24 hours. See which one survives a night's sleep.",
      cta: { label: "Read about attachment on the apps", href: "/blog/attachment-styles-on-dating-apps" },
      color: "270 50% 65%",
    },
  },
};

// ── Quiz 6: Post-Date Instinct ──────────────────────────────────────────────
const POST_DATE_INSTINCT: Quiz = {
  slug: "post-date-instinct",
  title: "How do you actually process a date?",
  pitch: "What you do in the hour after a date predicts more than the date itself. Find your processing pattern.",
  durationSec: 60,
  emoji: "🪞",
  feeds: ["reflection.style", "reflection.recall", "reflection.action"],
  questions: [
    {
      q: "You walk away from the date. First instinct in the next ten minutes?",
      options: [
        { label: "Body check. Am I lighter or heavier than when I arrived?", scores: { feeler: 2 }, wellness: { questionId: "reflection.style", dimension: "reflection", category: "style", questionText: "How do you process a date in the first ten minutes after?", answer: "I check my body before my thoughts." } },
        { label: "Rebuild the conversation in my head. What did they actually say?", scores: { thinker: 2 }, wellness: { questionId: "reflection.style", dimension: "reflection", category: "style", questionText: "How do you process a date in the first ten minutes after?", answer: "I replay the conversation analytically." } },
        { label: "Text the friend who's waiting for the recap.", scores: { narrator: 2 }, wellness: { questionId: "reflection.style", dimension: "reflection", category: "style", questionText: "How do you process a date in the first ten minutes after?", answer: "I narrate it to someone immediately." } },
        { label: "Already imagining the next date. Or the next person.", scores: { forecaster: 2 }, wellness: { questionId: "reflection.style", dimension: "reflection", category: "style", questionText: "How do you process a date in the first ten minutes after?", answer: "I jump straight to what's next." } },
      ],
    },
    {
      q: "Two days later, what part of the date do you actually remember?",
      options: [
        { label: "How I felt sitting across from them. The mood of it.", scores: { feeler: 2 } },
        { label: "Three specific things they said and what I thought about each one.", scores: { thinker: 2 } },
        { label: "The version I told my friend. Whatever I left in becomes the date.", scores: { narrator: 2 } },
        { label: "Whether it moved us toward a second one. The trajectory.", scores: { forecaster: 2 } },
      ],
    },
    {
      q: "They text the morning after: 'Had a great time.' Your first move?",
      options: [
        { label: "Sit with my reaction for a minute. See what comes up.", scores: { feeler: 2 } },
        { label: "Read it twice. Notice the punctuation. Then respond.", scores: { thinker: 2, narrator: 1 } },
        { label: "Screenshot it to a friend first, then write back.", scores: { narrator: 2 } },
        { label: "Reply quick and start thinking about when to suggest the next one.", scores: { forecaster: 2 } },
      ],
    },
    {
      q: "Something in the date felt off but you can't name it. You...",
      options: [
        { label: "Trust the feeling. I usually know before I know.", scores: { feeler: 2 }, wellness: { questionId: "reflection.recall", dimension: "reflection", category: "recall", questionText: "What do you do with an unnamed bad feeling about a date?", answer: "I trust the gut signal and let it inform me." } },
        { label: "Try to find the moment that caused it. Forensics mode.", scores: { thinker: 2 }, wellness: { questionId: "reflection.recall", dimension: "reflection", category: "recall", questionText: "What do you do with an unnamed bad feeling about a date?", answer: "I analyse for the specific moment." } },
        { label: "Talk it out with a friend until I find the words.", scores: { narrator: 2 }, wellness: { questionId: "reflection.recall", dimension: "reflection", category: "recall", questionText: "What do you do with an unnamed bad feeling about a date?", answer: "I talk it out until language lands." } },
        { label: "Wait and see if it changes by the next interaction.", scores: { forecaster: 2 }, wellness: { questionId: "reflection.recall", dimension: "reflection", category: "recall", questionText: "What do you do with an unnamed bad feeling about a date?", answer: "I park it and let the next data point decide." } },
      ],
    },
    {
      q: "If you wrote one note about each date the night of, you'd most naturally capture...",
      options: [
        { label: "How my body felt across the evening. Energy, tension, ease.", scores: { feeler: 2 }, wellness: { questionId: "reflection.action", dimension: "reflection", category: "action", questionText: "If you logged one post-date note, what would it capture?", answer: "Somatic and emotional read." } },
        { label: "What they revealed about themselves and what I'm still unsure about.", scores: { thinker: 2 }, wellness: { questionId: "reflection.action", dimension: "reflection", category: "action", questionText: "If you logged one post-date note, what would it capture?", answer: "Insight about them and open questions." } },
        { label: "The story version. The moments that became the moments.", scores: { narrator: 2 }, wellness: { questionId: "reflection.action", dimension: "reflection", category: "action", questionText: "If you logged one post-date note, what would it capture?", answer: "Narrative beats and memorable lines." } },
        { label: "Whether I want a second date and why. One sentence, decision-shaped.", scores: { forecaster: 2 }, wellness: { questionId: "reflection.action", dimension: "reflection", category: "action", questionText: "If you logged one post-date note, what would it capture?", answer: "A clear next-step verdict." } },
      ],
    },
  ],
  archetypes: {
    feeler: {
      name: "The Body Reader",
      emoji: "🫧",
      tagline: "You know how a date went before your brain finishes the sentence. Your body keeps the receipts.",
      insight: "Somatic processors are usually the most accurate readers in the room, and the most likely to second-guess what they already know. Your work isn't sharper analysis. It's learning to trust the first signal and then check it against the second date, not against your friend's opinion of the texts.",
      nextStep: "After your next date, write one sentence about how your body felt at minute thirty. Before any analysis. Keep the note and reread it after date two.",
      cta: { label: "Read the post-date reflection guide", href: "/blog/post-date-reflection-questions" },
      color: "190 60% 60%",
    },
    thinker: {
      name: "The Analyst",
      emoji: "🔍",
      tagline: "You don't move until you understand. You collect details others miss and pattern them later.",
      insight: "Analytical processors catch things early. The cost: sometimes you over-investigate a person before you've actually been around them enough for the data to mean anything. Three dates of presence beats thirty hours of forensics on three messages.",
      nextStep: "After your next date, write your usual analysis. Then write one sentence about what you'd do if you only trusted the feel of the evening. Both are real.",
      cta: { label: "Read the post-date reflection guide", href: "/blog/post-date-reflection-questions" },
      color: "248 62% 62%",
    },
    narrator: {
      name: "The Storyteller",
      emoji: "🎙️",
      tagline: "The version you tell your friend becomes the version that's real. You make sense of people by giving them a shape.",
      insight: "Story-making is how you metabolise dating, and that's a real strength. The catch: the framing locks in fast, and the friend you tell sometimes votes louder than the actual evening did. The skill is noticing which details you left out of the telling, because that's usually where the truth is hiding.",
      nextStep: "After your next date, before the friend recap, write the version you'd tell yourself if no one else was listening. Compare them later.",
      cta: { label: "Read the post-date reflection guide", href: "/blog/post-date-reflection-questions" },
      color: "326 75% 65%",
    },
    forecaster: {
      name: "The Forward Planner",
      emoji: "🧭",
      tagline: "You don't dwell. You decide. Dates are inputs to a question you're already answering.",
      insight: "Forecasters keep dating moving and they don't get stuck. The shadow: the decision-orientation can skip past the present moment, and you can end up choosing the trajectory you can already see instead of the one this person could actually become. Slow down for date two and three even when your gut wants to call it.",
      nextStep: "After your next date, before you decide anything about a second, list three things you noticed that weren't about whether to see them again. Then decide.",
      cta: { label: "Read the post-date reflection guide", href: "/blog/post-date-reflection-questions" },
      color: "43 65% 62%",
    },
  },
};

// ── Quiz 7: Message Stamina ─────────────────────────────────────────────────
const MESSAGE_STAMINA: Quiz = {
  slug: "message-stamina",
  title: "What's your message stamina?",
  pitch: "Some people open hot and fade. Some warm up slow. Five questions to find out what kind of texter you actually are.",
  durationSec: 60,
  emoji: "💬",
  feeds: ["messaging.opener", "messaging.pace", "messaging.fade"],
  questions: [
    {
      q: "Match. First message goes out. When?",
      options: [
        { label: "Within an hour. Strike while it's hot.", scores: { sprinter: 2 }, wellness: { questionId: "messaging.opener", dimension: "messaging", category: "opener", questionText: "When do you typically send the first message after a match?", answer: "Within the hour." } },
        { label: "Same day, when I have something specific to say.", scores: { pacer: 2 }, wellness: { questionId: "messaging.opener", dimension: "messaging", category: "opener", questionText: "When do you typically send the first message after a match?", answer: "Same day, when I have a real opener." } },
        { label: "Two or three days in. I like to see who's still around.", scores: { slowStarter: 2 }, wellness: { questionId: "messaging.opener", dimension: "messaging", category: "opener", questionText: "When do you typically send the first message after a match?", answer: "After a few days." } },
        { label: "I usually wait for them to open.", scores: { stayer: 1, slowStarter: 1 } },
      ],
    },
    {
      q: "Day three of messaging. The energy from your side is...",
      options: [
        { label: "Honestly, lower. I'm ready to move it offline or move on.", scores: { sprinter: 2 } },
        { label: "Steady. Same effort as day one.", scores: { pacer: 2, stayer: 1 } },
        { label: "Warmer than day one. I open up slowly.", scores: { slowStarter: 2 } },
        { label: "More invested. The longer it builds, the more I bring.", scores: { stayer: 2 } },
      ],
    },
    {
      q: "They reply less often than you'd like but still engaged. You...",
      options: [
        { label: "Match their pace down. I'm not chasing.", scores: { sprinter: 1, pacer: 1 } },
        { label: "Keep my pace. Their rhythm is theirs.", scores: { pacer: 2 } },
        { label: "Read it as space and lean back further.", scores: { slowStarter: 2 } },
        { label: "Stay warm and consistent. The drop isn't on me.", scores: { stayer: 2 } },
      ],
    },
    {
      q: "Honest read on when you tend to lose interest in a thread?",
      options: [
        { label: "Fast. If we don't get a date set in a week, I'm gone.", scores: { sprinter: 2 }, wellness: { questionId: "messaging.fade", dimension: "messaging", category: "fade", questionText: "When do you typically lose interest in a messaging thread?", answer: "Within a week if no date is set." } },
        { label: "When the conversation goes circular. Effort matters more than time.", scores: { pacer: 2 }, wellness: { questionId: "messaging.fade", dimension: "messaging", category: "fade", questionText: "When do you typically lose interest in a messaging thread?", answer: "When effort drops, not on a clock." } },
        { label: "When I realise I'm putting in more than they are.", scores: { slowStarter: 2, stayer: 1 } },
        { label: "Slowly. I'll stay longer than I should.", scores: { stayer: 2 }, wellness: { questionId: "messaging.fade", dimension: "messaging", category: "fade", questionText: "When do you typically lose interest in a messaging thread?", answer: "Slowly. I tend to overstay." } },
      ],
    },
    {
      q: "When you ask someone out, it usually happens...",
      options: [
        { label: "Quickly. I'd rather meet than text forever.", scores: { sprinter: 2, pacer: 1 } },
        { label: "When the conversation has hit a moment that earns it.", scores: { pacer: 2 } },
        { label: "Later than feels normal. I want to feel comfortable first.", scores: { slowStarter: 2 } },
        { label: "When they ask me, usually. I'd rather they decide.", scores: { stayer: 1, slowStarter: 1 } },
      ],
    },
  ],
  archetypes: {
    sprinter: {
      name: "The Sprinter",
      emoji: "⚡",
      tagline: "You open hot and you don't believe in long text relationships. You want the actual person, fast.",
      insight: "Sprinters convert matches into dates better than most. The cost: the people who need more runway never get a fair shot with you, and you can come across as more intense than you actually are. The skill: noticing whether someone's slower pace is disinterest or just a different rhythm, and giving the rhythm one more beat before you decide.",
      nextStep: "Next match where you'd usually push for a date by day four, hold for one extra day. See what they bring when you stop carrying the tempo.",
      cta: { label: "Read the three-message test", href: "/blog/three-message-test" },
      color: "0 78% 60%",
    },
    pacer: {
      name: "The Pacer",
      emoji: "🎯",
      tagline: "You match what's in front of you. Effort meets effort, depth meets depth. People feel met by you because they actually are.",
      insight: "Pacers are the most replicable kind of dater. Your edge is calibration. Your edge case: when someone is a slow starter, your perfect matching can feel like indifference because you give back exactly what they give. Sometimes the move is to slightly outpace them in one specific way that says you're paying attention.",
      nextStep: "On your next thread, send one message a little warmer than what they last gave you. Notice what comes back.",
      cta: { label: "Read the three-message test", href: "/blog/three-message-test" },
      color: "150 45% 55%",
    },
    slowStarter: {
      name: "The Slow Starter",
      emoji: "🌱",
      tagline: "You warm up. Your early messages are not your best ones, and that's fine because your real self shows up around day five.",
      insight: "Slow starters often miss out on people who needed a stronger early signal to stay invested. The good news: your stamina is high once a thread takes. The skill: front-loading one specific, real, slightly riskier message in the first three exchanges so the people who would love your full self get a reason to wait for it.",
      nextStep: "In your next opening exchange, share one specific true thing that isn't easy to say in three words. Watch which people lean in.",
      cta: { label: "Read the three-message test", href: "/blog/three-message-test" },
      color: "190 60% 60%",
    },
    stayer: {
      name: "The Stayer",
      emoji: "🪵",
      tagline: "You bring sustained warmth. People feel held by you for longer than they're used to. This is rare and worth protecting.",
      insight: "Stayers are who people remember and miss. The shadow: you can outstay your own interest because leaving feels worse than continuing, and you can over-invest in threads that aren't reciprocating because consistency is your default. The growth edge: noticing when sustained warmth is care and when it's avoidance of the harder move of ending it.",
      nextStep: "Audit your last three fading threads. Was the right move to keep showing up, or to send one clean closing message? Practice the closing message next time.",
      cta: { label: "Read the three-message test", href: "/blog/three-message-test" },
      color: "43 65% 62%",
    },
  },
};

export const QUIZZES: Quiz[] = [
  LOVE_PACE,
  CONFLICT_INSTINCT,
  ENERGY_SOURCES,
  BOUNDARY_BLUEPRINT,
  ATTACHMENT_STYLE,
  POST_DATE_INSTINCT,
  MESSAGE_STAMINA,
];

export const QUIZ_BY_BLOG_SLUG: Record<string, string> = {
  "attachment-styles-on-dating-apps": "attachment-style",
  "post-date-reflection-questions": "post-date-instinct",
  "three-message-test": "message-stamina",
};

export function getQuizBySlug(slug: string): Quiz | undefined {
  return QUIZZES.find(q => q.slug === slug);
}

export function scoreQuiz(quiz: Quiz, answers: number[]): string {
  const scores: Record<string, number> = {};
  answers.forEach((ai, qi) => {
    if (ai < 0) return;
    const opt = quiz.questions[qi]?.options[ai];
    if (!opt) return;
    Object.entries(opt.scores).forEach(([k, v]) => {
      scores[k] = (scores[k] ?? 0) + v;
    });
  });
  const archetypeKeys = Object.keys(quiz.archetypes);
  if (archetypeKeys.length === 0) return "";
  let best = archetypeKeys[0]!;
  let bestScore = -Infinity;
  archetypeKeys.forEach((k) => {
    const v = scores[k] ?? 0;
    if (v > bestScore) { bestScore = v; best = k; }
  });
  return best;
}

const STORAGE_KEY = "nldc:quiz:results:v1";

export interface SavedQuizResult {
  slug: string;
  archetypeKey: string;
  archetypeName: string;
  takenAt: string;
}

export function saveQuizResult(result: SavedQuizResult): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr: SavedQuizResult[] = raw ? JSON.parse(raw) : [];
    const filtered = arr.filter(r => r.slug !== result.slug);
    filtered.push(result);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // localStorage unavailable, silently swallow.
  }
}

export function readQuizResults(): SavedQuizResult[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Extract the wellness answers a user implied by their quiz answers. Used when
 * the user is signed in (and has consent) to write them into wellness_answers
 * via the existing endpoint.
 */
export function extractWellnessAnswers(
  quiz: Quiz,
  answers: number[],
): NonNullable<QuizOption["wellness"]>[] {
  const out: NonNullable<QuizOption["wellness"]>[] = [];
  answers.forEach((ai, qi) => {
    if (ai < 0) return;
    const opt = quiz.questions[qi]?.options[ai];
    if (opt?.wellness) out.push(opt.wellness);
  });
  // Deduplicate by questionId, keep the last (most-recent) answer.
  const seen = new Set<string>();
  return out
    .slice()
    .reverse()
    .filter(w => {
      if (seen.has(w.questionId)) return false;
      seen.add(w.questionId);
      return true;
    })
    .reverse();
}
