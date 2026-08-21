/**
 * Quiz Lab, short, fun, archetype-based quizzes that double as a low-friction
 * way for people to surface their wellness dimensions without filling out a
 * questionnaire. Each result is a "badge" with a tagline + 2-3 sentences of
 * insight. A browser cache keeps the reveal responsive, while the derived
 * result is also written to the server for signed-in and anonymous owners. The
 * raw choices never enter that record. When signed in, the member may separately
 * choose to write the quiz's mapped details into `wellness_answers`.
 *
 * Anonymous-first by design: no account is required to take a quiz or see the
 * result. The whole funnel is: take quiz → see badge + AI-personalised insight →
 * carry the derived result into the member record → optionally save deeper
 * wellness mappings.
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
  icon: string;
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
  icon: string;
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
  icon: "Heart",
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
      icon: "Star",
      tagline: "You feel it fast and you don't apologize for it. Your superpower is presence; your edge is pacing.",
      insight: "You bring an intensity most people don't, which means when you land with the right person, the connection is electric early. The challenge is that fast-feeling people often partner with slow-feeling people, which can read as you being 'too much' when really you're just operating at a different speed. The work isn't dimming your wattage; it's giving them runway to catch up.",
      nextStep: "Try a 'one-day delay' before your most enthusiastic reply this week. Not to play games, but to see whether the urgency is yours or theirs.",
      cta: { label: "Map your full Connection Style", href: "/connection-style" },
      color: "326 100% 65%",
    },
    steady: {
      name: "The Steady",
      icon: "Bird",
      tagline: "You love at the pace of actual life. Real, reliable, unflashy, and rarer than you think.",
      insight: "You move at the speed of evidence. You're not avoiding intensity; you're earning it. People who date you describe it as 'easy', which is meant as a compliment but you sometimes hear as 'unexciting'. It's not. The right person will register your steadiness as safety, not absence.",
      nextStep: "Make one small move this week that's louder than feels natural: a specific compliment, an unprompted plan. Steady doesn't have to mean quiet.",
      cta: { label: "See how your messages land", href: "/coach" },
      color: "190 55% 60%",
    },
    observer: {
      name: "The Observer",
      icon: "Telescope",
      tagline: "You're the one watching the whole movie. You read patterns most people miss, and you let them play out before you decide.",
      insight: "You don't get fooled often. You log inconsistencies, you notice tone shifts, you wait for the third date because the third date tells the truth. This makes you a great partner to the right person and slightly terrifying to the wrong one. The shadow: sometimes the watching becomes a way to stay safe instead of a way to choose well.",
      nextStep: "On your next date, share one thing you usually wait three dates to mention. See what it changes.",
      cta: { label: "Run a Compatibility Compass read", href: "/compatibility-compass" },
      color: "248 62% 62%",
    },
    builder: {
      name: "The Builder",
      icon: "Construction",
      tagline: "You're not looking for fireworks. You're looking for someone you can build a life with, and you check the foundation first.",
      insight: "You think in terms of fit, not chemistry. This is mature and underrated and exactly what works long-term. The challenge in early dating is that the apps reward chemistry-forward profiles, so your kind of love can read as muted on first scroll. Once someone gets the full picture of you, they tend to stay.",
      nextStep: "Add one specific 'what I'm building' line to your profile this week. Not 'looking for partnership'. Say what the actual life looks like.",
      cta: { label: "Audit your profile for fit signals", href: "/start" },
      color: "43 65% 62%",
    },
    devoted: {
      name: "The Devoted",
      icon: "Layers",
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
  icon: "Zap",
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
      icon: "Target",
      tagline: "You'd rather have the awkward conversation now than the worse one later. People with you know where they stand.",
      insight: "You don't let things fester. Your style works beautifully with someone who can match the directness, and crushes someone who needs more runway. The skill to develop: noticing whether your directness is information or pressure, and using slightly more wrap when the other person is the cautious type.",
      nextStep: "Next hard convo, lead with what you want before what's wrong. 'I want this to keep working, which is why I'm bringing this up.'",
      cta: { label: "Test how a message will land", href: "/coach" },
      color: "248 62% 62%",
    },
    processor: {
      name: "The Slow Drafter",
      icon: "PencilLine",
      tagline: "You don't react, you respond, once you've actually thought it through. People with you get measured, accurate, true.",
      insight: "Your gift is that what you say is what you actually mean. Your edge: the processing time can read as withdrawal or punishment to someone who needs reassurance in the moment. Saying 'I want to think about this and come back in 20 minutes' is the move. It names the delay so they don't fill it with worst-case stories.",
      nextStep: "Practice the bridge sentence: 'I hear you. I want to think before I respond. Back in an hour.' Then actually come back in an hour.",
      cta: { label: "Log a date or hard convo", href: "/mirror/dates" },
      color: "190 55% 60%",
    },
    archiver: {
      name: "The Pattern Reader",
      icon: "FolderOpen",
      tagline: "You don't make a thing of individual moments, you watch the trend. This makes you wise and, occasionally, withholding.",
      insight: "You collect data instead of confronting. Over months, this means you see things other people miss. In early dating, it can mean things go quietly stale because the other person didn't know there was anything to fix. The growth edge: one specific, low-stakes piece of feedback shared early changes the relationship's whole trajectory.",
      nextStep: "Pick one small thing you've quietly noted in your last 2 connections. Say it once, early, in a low-stakes moment. See what happens.",
      cta: { label: "See your patterns from messages", href: "/insights" },
      color: "228 18% 65%",
    },
    smoother: {
      name: "The Atmosphere",
      icon: "Sunrise",
      tagline: "You keep the temperature right. You protect the connection. People feel safe and warm with you.",
      insight: "You're the reason fights don't spiral and dates don't curdle. The shadow: smoothing can become avoiding, and the things that didn't get said become resentments that show up months later disguised as something else. Real repair sometimes means letting it stay uncomfortable for an hour.",
      nextStep: "This week, when you'd usually shift the energy, try staying with the awkward for one extra minute. Watch what comes out of you.",
      cta: { label: "Find your connection style", href: "/connection-style" },
      color: "43 65% 62%",
    },
    repairer: {
      name: "The Repair Artist",
      icon: "Wrench",
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
  icon: "Sparkles",
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
      icon: "Flame",
      tagline: "You bring the energy. Rooms turn up when you walk in. Your profile should sound the way you actually feel.",
      insight: "You're a high-output, high-warmth person and the apps usually underplay you because warmth doesn't photograph. The profile move: lead with a specific recent moment that shows the energy (not 'love to laugh', show what made you laugh hardest this week). Right people lean in immediately.",
      nextStep: "Rewrite your first line as a single recent moment. 'Yesterday I…' beats 'I love…' every time.",
      cta: { label: "Run a free 3-min Signal Check", href: "/signal-check" },
      color: "43 65% 62%",
    },
    tender: {
      name: "The Tender",
      icon: "Sprout",
      tagline: "You love quietly and well. The right person will recognise it the moment they meet you. Your profile just has to show it.",
      insight: "You're not a fireworks person and that's a feature. The trick: 'easy to be with' is great in person and invisible in text. Your profile should lean specific over breezy: one detail about how you actually like Sundays, what you cook on weeknights, the friend you've had since you were ten. Specifics radiate warmth.",
      nextStep: "Pick one sentence in your current bio that's a generic vibe. Replace it with a real detail from this week.",
      cta: { label: "Audit your bio for warmth signals", href: "/start" },
      color: "190 55% 60%",
    },
    explorer: {
      name: "The Explorer",
      icon: "Compass",
      tagline: "You're alive when there's something new. The profile move is to make the next date feel like an adventure, even a small one.",
      insight: "You filter for novelty and depth: places, ideas, people. Your bio probably sounds like everyone else's because we're all told to mention travel. Stand out by getting specific about the kind of exploring: 'I read about Antarctic exploration before bed' or 'I cannot stop trying neighbourhood ramen places'.",
      nextStep: "Propose a first date that's slightly novel: a museum, an unfamiliar cuisine, a walk somewhere neither of you knows. Watch your response rate.",
      cta: { label: "Run a Compatibility Compass read on a match", href: "/compatibility-compass" },
      color: "248 62% 62%",
    },
    maker: {
      name: "The Maker",
      icon: "Hammer",
      tagline: "You build things: projects, careers, routines, lives. Your profile should sound like someone going somewhere on purpose.",
      insight: "You filter for direction and discipline. People who match your energy are out there but won't recognise you in a profile that hides what you're building. Be honest about the project: 'I'm in year three of building a clinic / writing a book / training for an ultra'. Specifics like this attract aligned humans and filter out chaos.",
      nextStep: "Put one specific 'what I'm building' line in your profile this week. Not aspirational, just what you're actually doing right now.",
      cta: { label: "Log this week in 60 seconds", href: "/mirror/dates" },
      color: "228 18% 65%",
    },
    depthseeker: {
      name: "The Depthseeker",
      icon: "Waves",
      tagline: "You want the real conversation, the second question, the why behind the what. Your profile should make that obvious.",
      insight: "You filter out small talk fast and you're hungry for people who can go deep. The risk: profiles full of philosophy quotes attract performers, not depth. The move is asking better questions in the bio itself: share something specific you've been thinking about, frame it like an invitation to disagree.",
      nextStep: "Replace one bio line with an actual question you've been turning over. The right person will answer it on the first date.",
      cta: { label: "See your communication patterns", href: "/insights" },
      color: "326 100% 65%",
    },
    gatherer: {
      name: "The Gatherer",
      icon: "Disc",
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
  icon: "Shield",
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
      icon: "Ruler",
      tagline: "You design your edges on purpose. People with you know exactly where they stand because you've actually thought it through.",
      insight: "You can articulate not just what your limits are but why they exist and what serves them. This is the rarest and most attractive boundary style, and it filters for partners who can do the same. The shadow: clarity can read as coldness to people who needed a soft entrance.",
      nextStep: "Pair one direct boundary this week with one specific reassurance: 'This is the limit. And here's what I'm still fully in for.'",
      cta: { label: "Map your connection style", href: "/connection-style" },
      color: "248 62% 62%",
    },
    holder: {
      name: "The Holder",
      icon: "Landmark",
      tagline: "Once you say no, it's no. Once you say yes, you mean it. People learn fast that your word is the thing.",
      insight: "Your yes is honest because your no is real. You don't get pulled into negotiations about your limits and that energy is, frankly, magnetic. The growth edge: holders sometimes go from 'no' to 'gone' too fast, missing chances to teach someone how to date you well.",
      nextStep: "Next time you hold a boundary, follow it with one specific 'here's what would work' instead of a clean no. See what shifts.",
      cta: { label: "See how your messages land", href: "/coach" },
      color: "228 18% 65%",
    },
    voice: {
      name: "The Voice",
      icon: "Megaphone",
      tagline: "You name things. In real time, with care, without softening so much that the message gets lost. This is the work most people are still trying to do.",
      insight: "You bring stuff up. Friends call you when they need help rehearsing a hard conversation. The skill is real; the trap is becoming the explainer in every relationship, doing the emotional naming for both of you. Make sure they're learning to name things too, not just learning to listen.",
      nextStep: "On your next mild discomfort, don't name it. See if they notice. Their noticing-rate tells you something important.",
      cta: { label: "Track date debriefs over time", href: "/mirror/dates" },
      color: "326 100% 65%",
    },
    adapter: {
      name: "The Adapter",
      icon: "Waves",
      tagline: "You meet people where they are. Your range is enormous, and the work is learning when adapting becomes erasing.",
      insight: "You're flexible in ways most people aren't, which makes you great at the first month of a relationship and a real risk to yourself by month three. The pattern to watch: realising you've been the one accommodating, then resenting them for not noticing. Naming what you need earlier prevents that loop.",
      nextStep: "This week, identify one small preference you've been suppressing. Name it casually, low-stakes, see what happens.",
      cta: { label: "Find your communication style", href: "/insights" },
      color: "190 55% 60%",
    },
    retreater: {
      name: "The Retreater",
      icon: "DoorOpen",
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
  icon: "Link",
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
      icon: "TreePine",
      tagline: "You can want closeness without needing it to prove something. People feel steadier around you, often without knowing why.",
      insight: "Secure attachment in dating doesn't mean nothing rattles you. It means your nervous system has a wide window and a soft landing. Your edge is patience with people who don't have your baseline yet. The growth move: notice when someone's wobble pulls you into managing them, and let them have their own process without absorbing it.",
      nextStep: "On your next date, share something that's actually true about you instead of the version that's easy to like. Watch how that lands.",
      cta: { label: "Read about attachment on the apps", href: "/blog/attachment-styles-on-dating-apps" },
      color: "150 45% 55%",
    },
    anxious: {
      name: "The Tuner",
      icon: "Music",
      tagline: "You feel people. You catch the small shifts. Your superpower is attunement, and your tax is overreading.",
      insight: "Anxious attachment in early dating sounds like you giving someone else's silence a script. The cost: you're often soothing a story that isn't happening. The skill: noticing the activation, naming it to yourself, and waiting one full day before acting on it. Most of what you're reading as warning signal turns out to be their normal life.",
      nextStep: "Next time their reply takes longer than feels comfortable, write what you want to send. Save it. Reread it tomorrow. Send only what still feels true.",
      cta: { label: "Read about attachment on the apps", href: "/blog/attachment-styles-on-dating-apps" },
      color: "326 75% 65%",
    },
    avoidant: {
      name: "The Independent",
      icon: "Gem",
      tagline: "You like your own space and you keep your own counsel. Closeness is welcome, but never at the cost of your sovereignty.",
      insight: "Avoidant patterns in dating look like noticing flaws right when things get good, going quiet right when they ask for more, wanting the space more than the person sometimes. None of that means you're broken. It means closeness reads as a small threat to your system. The growth edge: name the pullback out loud instead of just doing it. 'I'm noticing I want some space this week' is a complete sentence.",
      nextStep: "When you feel the urge to ghost or fade, send one honest sentence about needing a beat. Then take the beat. Don't disappear without the sentence.",
      cta: { label: "Read about attachment on the apps", href: "/blog/attachment-styles-on-dating-apps" },
      color: "228 22% 60%",
    },
    fearful: {
      name: "The Push-Pull",
      icon: "Waves",
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
  icon: "CircleUser",
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
      icon: "Wind",
      tagline: "You know how a date went before your brain finishes the sentence. Your body keeps the receipts.",
      insight: "Somatic processors are usually the most accurate readers in the room, and the most likely to second-guess what they already know. Your work isn't sharper analysis. It's learning to trust the first signal and then check it against the second date, not against your friend's opinion of the texts.",
      nextStep: "After your next date, write one sentence about how your body felt at minute thirty. Before any analysis. Keep the note and reread it after date two.",
      cta: { label: "Read the post-date reflection guide", href: "/blog/post-date-reflection-questions" },
      color: "190 60% 60%",
    },
    thinker: {
      name: "The Analyst",
      icon: "Search",
      tagline: "You don't move until you understand. You collect details others miss and pattern them later.",
      insight: "Analytical processors catch things early. The cost: sometimes you over-investigate a person before you've actually been around them enough for the data to mean anything. Three dates of presence beats thirty hours of forensics on three messages.",
      nextStep: "After your next date, write your usual analysis. Then write one sentence about what you'd do if you only trusted the feel of the evening. Both are real.",
      cta: { label: "Read the post-date reflection guide", href: "/blog/post-date-reflection-questions" },
      color: "248 62% 62%",
    },
    narrator: {
      name: "The Storyteller",
      icon: "Mic",
      tagline: "The version you tell your friend becomes the version that's real. You make sense of people by giving them a shape.",
      insight: "Story-making is how you metabolise dating, and that's a real strength. The catch: the framing locks in fast, and the friend you tell sometimes votes louder than the actual evening did. The skill is noticing which details you left out of the telling, because that's usually where the truth is hiding.",
      nextStep: "After your next date, before the friend recap, write the version you'd tell yourself if no one else was listening. Compare them later.",
      cta: { label: "Read the post-date reflection guide", href: "/blog/post-date-reflection-questions" },
      color: "326 75% 65%",
    },
    forecaster: {
      name: "The Forward Planner",
      icon: "Compass",
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
  icon: "MessageCircle",
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
      icon: "Zap",
      tagline: "You open hot and you don't believe in long text relationships. You want the actual person, fast.",
      insight: "Sprinters convert matches into dates better than most. The cost: the people who need more runway never get a fair shot with you, and you can come across as more intense than you actually are. The skill: noticing whether someone's slower pace is disinterest or just a different rhythm, and giving the rhythm one more beat before you decide.",
      nextStep: "Next match where you'd usually push for a date by day four, hold for one extra day. See what they bring when you stop carrying the tempo.",
      cta: { label: "Read the three-message test", href: "/blog/three-message-test" },
      color: "0 78% 60%",
    },
    pacer: {
      name: "The Pacer",
      icon: "Target",
      tagline: "You match what's in front of you. Effort meets effort, depth meets depth. People feel met by you because they actually are.",
      insight: "Pacers are the most replicable kind of dater. Your edge is calibration. Your edge case: when someone is a slow starter, your perfect matching can feel like indifference because you give back exactly what they give. Sometimes the move is to slightly outpace them in one specific way that says you're paying attention.",
      nextStep: "On your next thread, send one message a little warmer than what they last gave you. Notice what comes back.",
      cta: { label: "Read the three-message test", href: "/blog/three-message-test" },
      color: "150 45% 55%",
    },
    slowStarter: {
      name: "The Slow Starter",
      icon: "Sprout",
      tagline: "You warm up. Your early messages are not your best ones, and that's fine because your real self shows up around day five.",
      insight: "Slow starters often miss out on people who needed a stronger early signal to stay invested. The good news: your stamina is high once a thread takes. The skill: front-loading one specific, real, slightly riskier message in the first three exchanges so the people who would love your full self get a reason to wait for it.",
      nextStep: "In your next opening exchange, share one specific true thing that isn't easy to say in three words. Watch which people lean in.",
      cta: { label: "Read the three-message test", href: "/blog/three-message-test" },
      color: "190 60% 60%",
    },
    stayer: {
      name: "The Stayer",
      icon: "Square",
      tagline: "You bring sustained warmth. People feel held by you for longer than they're used to. This is rare and worth protecting.",
      insight: "Stayers are who people remember and miss. The shadow: you can outstay your own interest because leaving feels worse than continuing, and you can over-invest in threads that aren't reciprocating because consistency is your default. The growth edge: noticing when sustained warmth is care and when it's avoidance of the harder move of ending it.",
      nextStep: "Audit your last three fading threads. Was the right move to keep showing up, or to send one clean closing message? Practice the closing message next time.",
      cta: { label: "Read the three-message test", href: "/blog/three-message-test" },
      color: "43 65% 62%",
    },
  },
};

// ── Quiz: Your Love Language ─────────────────────────────────────────────────
const LOVE_LANGUAGE: Quiz = {
  slug: "love-language",
  title: "What's your love language?",
  pitch: "Five questions to find how you most naturally give and receive love, the currency that makes you feel actually wanted.",
  durationSec: 90,
  icon: "HeartHandshake",
  feeds: ["affection.style", "affection.expression", "connection.repair"],
  questions: [
    {
      q: "A partner does one small thing this week and you feel genuinely loved. It's...",
      options: [
        { label: "They tell you, in words, exactly what you mean to them", scores: { words: 2, touch: 1 }, wellness: { questionId: "affection.receive", dimension: "affection", category: "style", questionText: "How do you most naturally receive love?", answer: "Words of affirmation, hearing it said plainly." } },
        { label: "They clear their evening to just be with you", scores: { time: 2, words: 1 }, wellness: { questionId: "affection.receive", dimension: "affection", category: "style", questionText: "How do you most naturally receive love?", answer: "Quality time, undivided attention." } },
        { label: "They quietly handle something off your plate", scores: { acts: 2, time: 1 }, wellness: { questionId: "affection.receive", dimension: "affection", category: "style", questionText: "How do you most naturally receive love?", answer: "Acts of service, being taken care of practically." } },
        { label: "They reach for your hand without thinking about it", scores: { touch: 2, time: 1 }, wellness: { questionId: "affection.receive", dimension: "affection", category: "style", questionText: "How do you most naturally receive love?", answer: "Physical touch, closeness and contact." } },
      ],
    },
    {
      q: "When you want to show someone you care, your instinct is to...",
      options: [
        { label: "Tell them what you admire about them", scores: { words: 2 }, wellness: { questionId: "affection.express", dimension: "affection", category: "expression", questionText: "How do you most naturally express love?", answer: "Through words, naming what I value out loud." } },
        { label: "Carve out real, unhurried time together", scores: { time: 2 } },
        { label: "Do something useful they didn't ask for", scores: { acts: 2 }, wellness: { questionId: "affection.express", dimension: "affection", category: "expression", questionText: "How do you most naturally express love?", answer: "Through acts of service, doing for them." } },
        { label: "Bring them a small thing that made you think of them", scores: { gifts: 2 } },
      ],
    },
    {
      q: "The compliment that actually lands for you is...",
      options: [
        { label: "\"I love the way your mind works\"", scores: { words: 2 } },
        { label: "\"I always feel calmer around you\"", scores: { time: 2, touch: 1 } },
        { label: "\"I don't know how I'd manage without you\"", scores: { acts: 2 } },
        { label: "\"You give the most thoughtful gifts\"", scores: { gifts: 2 } },
      ],
    },
    {
      q: "After a hard week, the gesture that resets you is...",
      options: [
        { label: "A long, honest conversation", scores: { words: 2, time: 1 }, wellness: { questionId: "connection.repair", dimension: "connection", category: "repair", questionText: "What helps you reconnect after a hard stretch?", answer: "Talking it through, words and reassurance." } },
        { label: "A whole evening with no agenda but each other", scores: { time: 2 }, wellness: { questionId: "connection.repair", dimension: "connection", category: "repair", questionText: "What helps you reconnect after a hard stretch?", answer: "Time together, presence over fixing." } },
        { label: "Someone just handling dinner so you can breathe", scores: { acts: 2 }, wellness: { questionId: "connection.repair", dimension: "connection", category: "repair", questionText: "What helps you reconnect after a hard stretch?", answer: "Practical help that lightens the load." } },
        { label: "Being held, no words needed", scores: { touch: 2 }, wellness: { questionId: "connection.repair", dimension: "connection", category: "repair", questionText: "What helps you reconnect after a hard stretch?", answer: "Physical closeness, touch over talk." } },
      ],
    },
    {
      q: "What stings most when it's missing?",
      options: [
        { label: "They stop saying how they feel", scores: { words: 2 } },
        { label: "They're around but never really present", scores: { time: 2 } },
        { label: "I'm always the one carrying the load", scores: { acts: 2 } },
        { label: "The easy physical closeness fades", scores: { touch: 2 } },
      ],
    },
  ],
  archetypes: {
    words: {
      name: "Spoken Warmth",
      icon: "Speech",
      tagline: "You feel loved when it's said out loud. Naming the feeling is the feeling.",
      insight: "You read care through language, so a partner who says what they appreciate keeps you secure, while one who 'shows not tells' can leave you guessing. The trick isn't needing constant praise; it's needing the relationship narrated honestly. When you know where you stand in words, you give your best self back.",
      nextStep: "Tell a partner, or a future one, the exact sentence you most want to hear. Specificity beats hinting.",
      cta: { label: "Map your full Care Dialect", href: "/care-dialect" },
      color: "326 80% 62%",
    },
    time: {
      name: "Undivided Time",
      icon: "Clock",
      tagline: "Presence is the gift. You measure love in undivided attention.",
      insight: "You feel most wanted when someone chooses to be fully with you, phone down, no rush. Distraction reads as distance to you even when none is meant. Naming this early saves a lot of quiet hurt, because the fix is rarely more hours, it's more presence in the hours you have.",
      nextStep: "Protect one device-free window with someone this week. Notice how different it feels from time that's only technically shared.",
      cta: { label: "See your readiness picture", href: "/your-mirror" },
      color: "248 62% 62%",
    },
    acts: {
      name: "Helping Hands",
      icon: "Hand",
      tagline: "Love is a verb to you. Showing up beats saying so.",
      insight: "You trust what people do more than what they declare, so a partner who notices and lightens your load earns deep loyalty. Your risk is over-giving and quietly resenting it when it isn't matched. The work is letting yourself receive, and asking plainly instead of waiting to be read.",
      nextStep: "Let someone do one thing for you this week without insisting you're fine. Receiving is part of the language too.",
      cta: { label: "Map your full Care Dialect", href: "/care-dialect" },
      color: "141 60% 45%",
    },
    touch: {
      name: "Close Contact",
      icon: "Handshake",
      tagline: "Closeness regulates you. Contact says what words can't.",
      insight: "You feel safest and most connected through warmth and proximity, so touch is how you both give and read affection. When it fades you can feel the distance before anything is said. Pairing well here is about naming the need out loud, since touch-led people often partner with words-led people and both have to learn the other's dialect.",
      nextStep: "Name how you most like to be close, and ask what feels good to them. Calibration matters more than frequency.",
      cta: { label: "See your readiness picture", href: "/your-mirror" },
      color: "12 75% 60%",
    },
    gifts: {
      name: "Thoughtful Tokens",
      icon: "Gift",
      tagline: "It's not the object, it's the proof you were thought of when apart.",
      insight: "For you a well-chosen thing is shorthand for 'I notice what you love,' so it's the attention behind it that lands, not the price. The misread is that this looks materialistic when it's really about being held in mind. Pairs best with someone willing to pay attention to the small details you drop.",
      nextStep: "Tell a partner the kind of thoughtful gesture that lands for you, so it never has to be guessed.",
      cta: { label: "Map your full Care Dialect", href: "/care-dialect" },
      color: "43 70% 55%",
    },
  },
};

// ── Quiz: Future Vision ──────────────────────────────────────────────────────
const FUTURE_VISION: Quiz = {
  slug: "future-vision",
  title: "Where are you headed?",
  pitch: "Five questions on the life you're actually building, so matching reads direction, not just chemistry.",
  durationSec: 90,
  icon: "Compass",
  feeds: ["values.direction", "lifestyle.pace", "values.commitment"],
  questions: [
    {
      q: "Picture your life three years out. The word that fits best is...",
      options: [
        { label: "Rooted, a home and a rhythm I've built", scores: { builder: 2, grower: 1 }, wellness: { questionId: "values.direction", dimension: "values", category: "direction", questionText: "What does your ideal near future look like?", answer: "Settled and rooted, building a stable home base." } },
        { label: "Open, room to move, travel, and change my mind", scores: { explorer: 2, grower: 1 }, wellness: { questionId: "values.direction", dimension: "values", category: "direction", questionText: "What does your ideal near future look like?", answer: "Open and mobile, keeping options and freedom." } },
        { label: "Steady, growing the things already in motion", scores: { grower: 2, builder: 1 }, wellness: { questionId: "values.direction", dimension: "values", category: "direction", questionText: "What does your ideal near future look like?", answer: "Gradual growth, deepening what I've already started." } },
        { label: "Partnered, a shared life at the center", scores: { anchor: 2, builder: 1 }, wellness: { questionId: "values.direction", dimension: "values", category: "direction", questionText: "What does your ideal near future look like?", answer: "Partnership-centered, building a shared life." } },
      ],
    },
    {
      q: "When you imagine the right relationship, it mostly...",
      options: [
        { label: "Gives me a stable base to build from", scores: { builder: 2 }, wellness: { questionId: "values.commitment", dimension: "values", category: "commitment", questionText: "What role does a relationship play in your bigger plan?", answer: "A stable foundation to build the rest of life on." } },
        { label: "Adds a partner in adventure, not an anchor", scores: { explorer: 2 }, wellness: { questionId: "values.commitment", dimension: "values", category: "commitment", questionText: "What role does a relationship play in your bigger plan?", answer: "A companion for adventure, freedom preserved." } },
        { label: "Grows slowly alongside everything else", scores: { grower: 2 }, wellness: { questionId: "values.commitment", dimension: "values", category: "commitment", questionText: "What role does a relationship play in your bigger plan?", answer: "Something that grows steadily alongside my life." } },
        { label: "Becomes the thing I organize my life around", scores: { anchor: 2 }, wellness: { questionId: "values.commitment", dimension: "values", category: "commitment", questionText: "What role does a relationship play in your bigger plan?", answer: "The center, what I organize the rest around." } },
      ],
    },
    {
      q: "A free Saturday with no plans. You're most likely...",
      options: [
        { label: "Working on the home, the garden, a long project", scores: { builder: 2 } },
        { label: "Booking a last-minute trip or saying yes to something new", scores: { explorer: 2 } },
        { label: "Chipping away at a goal that's slowly taking shape", scores: { grower: 2 } },
        { label: "Doing whatever it is, as long as it's together", scores: { anchor: 2 } },
      ],
    },
    {
      q: "The pace of change you're most comfortable with is...",
      options: [
        { label: "Slow and deliberate, I like things to last", scores: { builder: 2, grower: 1 }, wellness: { questionId: "lifestyle.pace", dimension: "lifestyle", category: "pace", questionText: "What pace of life suits you best?", answer: "Slow and deliberate, durability over novelty." } },
        { label: "Fast and varied, I get restless when things settle", scores: { explorer: 2 }, wellness: { questionId: "lifestyle.pace", dimension: "lifestyle", category: "pace", questionText: "What pace of life suits you best?", answer: "Fast and varied, novelty keeps me alive." } },
        { label: "Measured, steady forward motion", scores: { grower: 2 }, wellness: { questionId: "lifestyle.pace", dimension: "lifestyle", category: "pace", questionText: "What pace of life suits you best?", answer: "Measured, consistent forward motion." } },
        { label: "Whatever keeps the two of us in step", scores: { anchor: 2 }, wellness: { questionId: "lifestyle.pace", dimension: "lifestyle", category: "pace", questionText: "What pace of life suits you best?", answer: "Synced to a partner, moving in step." } },
      ],
    },
    {
      q: "A dealbreaker for you would be a partner who...",
      options: [
        { label: "Never wants to put down roots", scores: { builder: 2 } },
        { label: "Needs everything mapped years ahead", scores: { explorer: 2 } },
        { label: "Wants it all fast or not at all", scores: { grower: 2 } },
        { label: "Keeps the relationship at the edge of their life", scores: { anchor: 2 } },
      ],
    },
  ],
  archetypes: {
    builder: {
      name: "The Builder",
      icon: "Home",
      tagline: "You're building something to last. Roots, not options.",
      insight: "You're drawn to permanence, a home, a rhythm, a base you can count on, which makes you a steadying force for the right person. The friction shows up with partners who read stability as confinement. Knowing your direction early lets you screen for someone who wants to build, not just visit.",
      nextStep: "Name one concrete thing you're building toward. Direction is attractive when it's specific.",
      cta: { label: "See your readiness picture", href: "/your-mirror" },
      color: "141 55% 45%",
    },
    explorer: {
      name: "The Explorer",
      icon: "Mountain",
      tagline: "You're built for motion. The right partner is a co-adventurer.",
      insight: "Freedom and novelty keep you alive, so you thrive with someone who travels light alongside you rather than anchoring you down. The risk is reading every plan as a cage when sometimes it's just care. Your best matches want a shared adventure with enough structure that neither of you drifts.",
      nextStep: "Get honest about the one form of commitment that wouldn't feel like a cage. That's your real green light.",
      cta: { label: "Map your full Connection Style", href: "/connection-style" },
      color: "207 70% 50%",
    },
    grower: {
      name: "The Grower",
      icon: "Sprout",
      tagline: "You move steady. Love is something you compound over time.",
      insight: "You trust gradual, you'd rather deepen than rush, which makes you a safe bet for someone wary of intensity that burns out. Your edge is partners who want fast certainty. When you find someone content to grow in step, you build the kind of thing that quietly outlasts the flashy versions.",
      nextStep: "Tell a new connection the pace that actually works for you. The right person will exhale, not pull back.",
      cta: { label: "See your readiness picture", href: "/your-mirror" },
      color: "43 70% 55%",
    },
    anchor: {
      name: "The Anchor",
      icon: "Anchor",
      tagline: "Partnership is the center, not a side plot.",
      insight: "You organize your life around the people you love, which makes you devoted and present in a way that's increasingly rare. The caution is losing your own edges inside a relationship. Your strongest match wants the same closeness back, so the togetherness feels chosen by both, never carried by one.",
      nextStep: "Keep one thing that's fully yours, even at your most partnered. It makes the closeness sustainable.",
      cta: { label: "Map your full Connection Style", href: "/connection-style" },
      color: "326 80% 62%",
    },
  },
};

// ── Quiz 10: Dealbreaker Radar ──────────────────────────────────────────────
const DEALBREAKER_RADAR: Quiz = {
  slug: "dealbreaker-radar",
  title: "What are your real dealbreakers?",
  pitch: "Five questions to separate your true non-negotiables from the preferences you can flex on. The output doubles as your matching filter.",
  durationSec: 90,
  icon: "Gauge",
  feeds: ["values.nonNegotiables", "standards.clarity", "matching.filters"],
  questions: [
    {
      q: "A person you like is great company but cancels plans last-minute, twice. You...",
      options: [
        { label: "Name it once. If it keeps happening, I'm out", scores: { clearList: 2, fastLearner: 1 }, wellness: { questionId: "values.dealbreaker.effort", dimension: "values", category: "dealbreakers", questionText: "How firm are you about reliability and effort early on?", answer: "Reliability is a hard line. Repeated flakiness ends it for me." } },
        { label: "Give grace, life is busy, but I'm watching", scores: { flexibleCore: 2 }, wellness: { questionId: "values.dealbreaker.effort", dimension: "values", category: "dealbreakers", questionText: "How firm are you about reliability and effort early on?", answer: "I extend grace on effort but track the pattern." } },
        { label: "Honestly I'd talk myself out of minding", scores: { softEdges: 2 }, wellness: { questionId: "values.dealbreaker.effort", dimension: "values", category: "dealbreakers", questionText: "How firm are you about reliability and effort early on?", answer: "I tend to minimize effort issues to avoid conflict." } },
        { label: "I'd test it on purpose before deciding", scores: { fastLearner: 2, clearList: 1 }, wellness: { questionId: "values.dealbreaker.effort", dimension: "values", category: "dealbreakers", questionText: "How firm are you about reliability and effort early on?", answer: "I learn my dealbreakers by watching how people actually behave." } },
      ],
    },
    {
      q: "You catch a small, pointless lie early on. Your gut says...",
      options: [
        { label: "That's the whole answer. Trust is the floor", scores: { clearList: 2 }, wellness: { questionId: "values.dealbreaker.honesty", dimension: "values", category: "dealbreakers", questionText: "Where does honesty sit in your dealbreakers?", answer: "Honesty is non-negotiable. Even small lies end it." } },
        { label: "Depends what it was about and why", scores: { flexibleCore: 2, fastLearner: 1 }, wellness: { questionId: "values.dealbreaker.honesty", dimension: "values", category: "dealbreakers", questionText: "Where does honesty sit in your dealbreakers?", answer: "I weigh context before deciding a lie is disqualifying." } },
        { label: "I'd probably let it slide and hope", scores: { softEdges: 2 }, wellness: { questionId: "values.dealbreaker.honesty", dimension: "values", category: "dealbreakers", questionText: "Where does honesty sit in your dealbreakers?", answer: "I tend to overlook early dishonesty." } },
        { label: "One data point. I need two before I call it", scores: { fastLearner: 2 }, wellness: { questionId: "values.dealbreaker.honesty", dimension: "values", category: "dealbreakers", questionText: "Where does honesty sit in your dealbreakers?", answer: "I look for a pattern before treating dishonesty as a dealbreaker." } },
      ],
    },
    {
      q: "How clear are you on what you will not compromise on?",
      options: [
        { label: "Crystal. I could list five right now", scores: { clearList: 2 } },
        { label: "I have two or three hard lines, the rest flexes", scores: { flexibleCore: 2 } },
        { label: "I find out the moment something crosses one", scores: { fastLearner: 2 } },
        { label: "Honestly my lines move depending on how I feel about them", scores: { softEdges: 2 } },
      ],
    },
    {
      q: "Different life goals (kids, location, ambition) show up. You...",
      options: [
        { label: "If the big ones clash, I end it kindly and early", scores: { clearList: 2, fastLearner: 1 }, wellness: { questionId: "values.dealbreaker.lifegoals", dimension: "values", category: "dealbreakers", questionText: "How do you handle clashing long-term life goals?", answer: "Core life-goal mismatches are dealbreakers I act on early." } },
        { label: "I'll explore whether there's a real middle", scores: { flexibleCore: 2 }, wellness: { questionId: "values.dealbreaker.lifegoals", dimension: "values", category: "dealbreakers", questionText: "How do you handle clashing long-term life goals?", answer: "I look for genuine compromise before walking on life goals." } },
        { label: "I'd stay and quietly hope they change", scores: { softEdges: 2 }, wellness: { questionId: "values.dealbreaker.lifegoals", dimension: "values", category: "dealbreakers", questionText: "How do you handle clashing long-term life goals?", answer: "I sometimes stay despite goal mismatches, hoping they shift." } },
        { label: "I'd want to see how they handle the conversation first", scores: { fastLearner: 2, flexibleCore: 1 }, wellness: { questionId: "values.dealbreaker.lifegoals", dimension: "values", category: "dealbreakers", questionText: "How do you handle clashing long-term life goals?", answer: "How someone discusses a goal gap matters as much as the gap itself." } },
      ],
    },
    {
      q: "When a dealbreaker gets crossed, how fast do you actually act on it?",
      options: [
        { label: "Quickly. I'd rather lose weeks than months", scores: { clearList: 2, fastLearner: 1 } },
        { label: "After a fair conversation, then I move", scores: { flexibleCore: 2 } },
        { label: "Slowly. I talk myself in circles first", scores: { softEdges: 2 } },
        { label: "I act fast once, then second-guess it", scores: { fastLearner: 2, softEdges: 1 } },
      ],
    },
  ],
  archetypes: {
    clearList: {
      name: "The Clear List",
      icon: "ClipboardList",
      tagline: "You know your non-negotiables and you hold them. That clarity saves you months other people lose.",
      insight: "You can name your dealbreakers without flinching, which means you waste very little time on connections that were never going to work. The risk is that a list held too rigidly can screen out a good person over a fixable thing. Keep the hard lines hard and let the small stuff be small.",
      nextStep: "Turn your top three lines into your matching filters so the machine stops surfacing people who fail them.",
      cta: { label: "Set your matching filters", href: "/matching" },
      color: "8 80% 60%",
    },
    flexibleCore: {
      name: "The Flexible Core",
      icon: "Compass",
      tagline: "A few hard lines, everything else negotiable. You filter on what matters and stay open on the rest.",
      insight: "You hold a small set of true non-negotiables and treat the rest as preferences, which is the healthiest place to be. You rarely lose a good match over something cosmetic. The watch-out is letting the negotiable list quietly absorb things that should have been hard lines.",
      nextStep: "Write down which two or three lines are actually hard. Naming them protects them.",
      cta: { label: "Map this in Your Mirror", href: "/your-mirror" },
      color: "190 55% 58%",
    },
    fastLearner: {
      name: "The Fast Learner",
      icon: "Microscope",
      tagline: "You discover your dealbreakers by watching real behavior, not by guessing in advance.",
      insight: "You trust evidence over theory, so your standards get sharper with every person you date. That makes you hard to fool. The cost is that learning live can mean a few extra weeks invested before the lesson lands. Logging what you notice speeds the loop up.",
      nextStep: "After your next date, write one thing that moved your standards. Patterns build fast when you track them.",
      cta: { label: "Log a post-date debrief", href: "/copilot/debrief" },
      color: "248 62% 62%",
    },
    softEdges: {
      name: "The Soft Edges",
      icon: "Cloud",
      tagline: "You feel your lines but struggle to hold them. The work is not stricter rules, it is trusting the ones you have.",
      insight: "You sense when something is off, then talk yourself out of it to keep the peace or keep the person. This is common and it is workable. The shift is treating your first quiet no as information, not as you being difficult. Your standards are probably more reliable than you give them credit for.",
      nextStep: "Pick one line you keep letting slide and decide it is firm before the next person tests it.",
      cta: { label: "Strengthen your boundaries", href: "/quizzes/boundary-blueprint" },
      color: "280 45% 64%",
    },
  },
};

// ── Quiz 11: Readiness Self-Check ───────────────────────────────────────────
const READINESS_CHECK: Quiz = {
  slug: "readiness-check",
  title: "Are you actually ready to date right now?",
  pitch: "An honest five-question read on your real capacity for a new connection. No shame either way, just a clearer picture.",
  durationSec: 90,
  icon: "Sprout",
  feeds: ["readiness.self", "emotional.availability", "intent.clarity"],
  questions: [
    {
      q: "When you picture dating right now, the honest feeling is...",
      options: [
        { label: "Genuine excitement, I have room for someone", scores: { readyOpen: 2 }, wellness: { questionId: "readiness.bandwidth", dimension: "readiness", category: "bandwidth", questionText: "What is your real emotional bandwidth for dating right now?", answer: "High. I feel open and have room for someone new." } },
        { label: "Curious but a little guarded", scores: { curiousGuarded: 2 }, wellness: { questionId: "readiness.bandwidth", dimension: "readiness", category: "bandwidth", questionText: "What is your real emotional bandwidth for dating right now?", answer: "Cautiously open. Interested but protecting myself." } },
        { label: "Tired just thinking about it", scores: { stretchedThin: 2 }, wellness: { questionId: "readiness.bandwidth", dimension: "readiness", category: "bandwidth", questionText: "What is your real emotional bandwidth for dating right now?", answer: "Low. My capacity is stretched thin right now." } },
        { label: "A pull toward someone specific from my past", scores: { stillHealing: 2 }, wellness: { questionId: "readiness.bandwidth", dimension: "readiness", category: "bandwidth", questionText: "What is your real emotional bandwidth for dating right now?", answer: "Divided. Part of me is still attached to someone before." } },
      ],
    },
    {
      q: "Your most recent relationship or situationship feels...",
      options: [
        { label: "Fully closed. I learned from it and moved on", scores: { readyOpen: 2 }, wellness: { questionId: "readiness.closure", dimension: "readiness", category: "closure", questionText: "How resolved is your most recent connection?", answer: "Resolved. I have closure and have processed it." } },
        { label: "Mostly closed, the odd pang", scores: { curiousGuarded: 2, readyOpen: 1 }, wellness: { questionId: "readiness.closure", dimension: "readiness", category: "closure", questionText: "How resolved is your most recent connection?", answer: "Mostly closed with occasional residual feeling." } },
        { label: "Still raw, I think about it a lot", scores: { stillHealing: 2 }, wellness: { questionId: "readiness.closure", dimension: "readiness", category: "closure", questionText: "How resolved is your most recent connection?", answer: "Still raw. It occupies a lot of my headspace." } },
        { label: "Honestly not over it", scores: { stillHealing: 2, stretchedThin: 1 }, wellness: { questionId: "readiness.closure", dimension: "readiness", category: "closure", questionText: "How resolved is your most recent connection?", answer: "Not over it yet." } },
      ],
    },
    {
      q: "Do you have the time and energy for someone else's needs right now?",
      options: [
        { label: "Yes, my life has real space in it", scores: { readyOpen: 2 } },
        { label: "Some, if it is the right person", scores: { curiousGuarded: 2 } },
        { label: "Not much, I'm running close to empty", scores: { stretchedThin: 2 } },
        { label: "I'd make space I don't really have", scores: { stretchedThin: 2, stillHealing: 1 } },
      ],
    },
    {
      q: "Why do you want to date right now?",
      options: [
        { label: "I'm content alone and want to share that", scores: { readyOpen: 2 }, wellness: { questionId: "intent.why", dimension: "intent", category: "motivation", questionText: "What is driving your desire to date right now?", answer: "I am secure on my own and want to share a good life." } },
        { label: "I'm curious what is out there", scores: { curiousGuarded: 2 }, wellness: { questionId: "intent.why", dimension: "intent", category: "motivation", questionText: "What is driving your desire to date right now?", answer: "Curiosity and openness to possibility." } },
        { label: "I don't love being alone", scores: { stretchedThin: 1, stillHealing: 1 }, wellness: { questionId: "intent.why", dimension: "intent", category: "motivation", questionText: "What is driving your desire to date right now?", answer: "Discomfort with being alone is part of the pull." } },
        { label: "Partly to move on from someone", scores: { stillHealing: 2 }, wellness: { questionId: "intent.why", dimension: "intent", category: "motivation", questionText: "What is driving your desire to date right now?", answer: "Partly to get over a previous person." } },
      ],
    },
    {
      q: "When a date does not work out, how do you tend to take it?",
      options: [
        { label: "It rolls off. Not every fit is the fit", scores: { readyOpen: 2 } },
        { label: "A small sting, then I'm fine", scores: { curiousGuarded: 2, readyOpen: 1 } },
        { label: "It lands hard and lingers", scores: { stillHealing: 2 } },
        { label: "I don't have the reserves for the letdown", scores: { stretchedThin: 2 } },
      ],
    },
  ],
  archetypes: {
    readyOpen: {
      name: "Ready and Open",
      icon: "Sun",
      tagline: "You have closure, capacity, and a clear reason. This is the strongest place to date from.",
      insight: "You are not dating to fill a hole, you are dating to add to a life that already works. That shows up as steadiness and low neediness, which the right person reads as safety. The only caution is not to let a busy stretch quietly erode the space you have made.",
      nextStep: "Pour this readiness into the meter. The more the machine knows, the better it matches you.",
      cta: { label: "Build your Match Readiness", href: "/your-mirror" },
      color: "190 60% 58%",
    },
    curiousGuarded: {
      name: "Curious but Guarded",
      icon: "DoorOpen",
      tagline: "Open enough to look, careful enough to protect yourself. A reasonable place to start.",
      insight: "You are interested and a little self-protective at the same time, which is healthy after anything that did not end well. You will do better with slow, low-pressure connection than with anything intense up front. Let trust build at the speed of evidence rather than forcing it.",
      nextStep: "Start with low-stakes signal: a quiz or two, a profile audit. Momentum lowers the guard naturally.",
      cta: { label: "See where you stand", href: "/me" },
      color: "248 55% 62%",
    },
    stillHealing: {
      name: "Still Healing",
      icon: "HeartPulse",
      tagline: "Part of you is still with someone before. That is not a failing, it is just real, and worth honoring.",
      insight: "Dating to get over someone usually means carrying the last person into the next, which is unfair to you and to them. There is no shame here, only timing. A little more closure now will make the eventual connection far better than rushing it would.",
      nextStep: "Be honest about the pull backward before you take the next date. Naming it loosens its grip.",
      cta: { label: "Work it through in Your Mirror", href: "/your-mirror" },
      color: "8 70% 62%",
    },
    stretchedThin: {
      name: "Stretched Thin",
      icon: "Wind",
      tagline: "Your capacity is low right now, and a new person needs capacity. Worth knowing before you start.",
      insight: "When you are running close to empty, dating tends to feel like one more obligation, and good people can get the tired version of you. This is about bandwidth, not desire. Topping yourself back up first will change the whole experience.",
      nextStep: "Pick one thing draining you this month and ease it before you add dating on top.",
      cta: { label: "Check your readiness honestly", href: "/me" },
      color: "280 40% 64%",
    },
  },
};

// ── Quiz 12: Money in Love ──────────────────────────────────────────────────
const MONEY_IN_LOVE: Quiz = {
  slug: "money-in-love",
  title: "What's your money style in love?",
  pitch: "Money is one of the quietest compatibility signals there is. Five questions to name yours before it ever comes up on a date.",
  durationSec: 90,
  icon: "Wallet",
  feeds: ["values.money", "lifestyle.spending", "compatibility.finance"],
  questions: [
    {
      q: "First date. The check lands. Your instinct is...",
      options: [
        { label: "I offered to pay and I'd plan within a budget", scores: { planner: 2 }, wellness: { questionId: "values.money.firstdate", dimension: "values", category: "finance", questionText: "How do you approach money on early dates?", answer: "I plan within a budget and am happy to pay thoughtfully." } },
        { label: "I'd happily treat, generosity is how I show care", scores: { generous: 2 }, wellness: { questionId: "values.money.firstdate", dimension: "values", category: "finance", questionText: "How do you approach money on early dates?", answer: "I show care through generosity and like to treat." } },
        { label: "Split it, clean and equal", scores: { securitySeeker: 1, planner: 1 }, wellness: { questionId: "values.money.firstdate", dimension: "values", category: "finance", questionText: "How do you approach money on early dates?", answer: "I prefer splitting evenly to keep things fair." } },
        { label: "I picked somewhere memorable, cost aside", scores: { experienceSeeker: 2 }, wellness: { questionId: "values.money.firstdate", dimension: "values", category: "finance", questionText: "How do you approach money on early dates?", answer: "I prioritize a memorable experience over the cost." } },
      ],
    },
    {
      q: "An unexpected windfall hits your account. You...",
      options: [
        { label: "Straight to savings and the plan", scores: { planner: 2, securitySeeker: 1 }, wellness: { questionId: "values.money.windfall", dimension: "values", category: "finance", questionText: "What do you do with unexpected money?", answer: "Save it and stick to the long-term plan." } },
        { label: "Treat the people I love", scores: { generous: 2 }, wellness: { questionId: "values.money.windfall", dimension: "values", category: "finance", questionText: "What do you do with unexpected money?", answer: "Spend it on the people I care about." } },
        { label: "Book the trip I've been wanting", scores: { experienceSeeker: 2 }, wellness: { questionId: "values.money.windfall", dimension: "values", category: "finance", questionText: "What do you do with unexpected money?", answer: "Spend it on an experience I have wanted." } },
        { label: "Build the emergency cushion higher", scores: { securitySeeker: 2 }, wellness: { questionId: "values.money.windfall", dimension: "values", category: "finance", questionText: "What do you do with unexpected money?", answer: "Strengthen my safety net first." } },
      ],
    },
    {
      q: "When does money become fair to talk about with a partner?",
      options: [
        { label: "Early. Aligned plans matter to me", scores: { planner: 2 }, wellness: { questionId: "values.money.transparency", dimension: "values", category: "finance", questionText: "When are you comfortable discussing money in a relationship?", answer: "Early. Financial alignment is a priority for me." } },
        { label: "Once it is serious, no rush", scores: { generous: 1, experienceSeeker: 1 }, wellness: { questionId: "values.money.transparency", dimension: "values", category: "finance", questionText: "When are you comfortable discussing money in a relationship?", answer: "When it gets serious, not before." } },
        { label: "Only when something practical forces it", scores: { experienceSeeker: 2 }, wellness: { questionId: "values.money.transparency", dimension: "values", category: "finance", questionText: "When are you comfortable discussing money in a relationship?", answer: "Only when a practical decision requires it." } },
        { label: "Before anything serious. I want to know we match", scores: { securitySeeker: 2, planner: 1 }, wellness: { questionId: "values.money.transparency", dimension: "values", category: "finance", questionText: "When are you comfortable discussing money in a relationship?", answer: "Before committing. I want to confirm we are compatible." } },
      ],
    },
    {
      q: "What does money mostly represent to you?",
      options: [
        { label: "A plan coming together over time", scores: { planner: 2 } },
        { label: "A way to take care of people", scores: { generous: 2 } },
        { label: "Freedom and good memories", scores: { experienceSeeker: 2 } },
        { label: "Safety and peace of mind", scores: { securitySeeker: 2 } },
      ],
    },
    {
      q: "A partner spends very differently from you. You...",
      options: [
        { label: "Want a shared system we both agree on", scores: { planner: 2, securitySeeker: 1 } },
        { label: "Can flex, as long as the care is there", scores: { generous: 2 } },
        { label: "Don't mind, money is for living", scores: { experienceSeeker: 2 } },
        { label: "Need to know my base is protected first", scores: { securitySeeker: 2 } },
      ],
    },
  ],
  archetypes: {
    planner: {
      name: "The Planner",
      icon: "BarChart3",
      tagline: "You think in systems and timelines. Money is a tool you steer on purpose.",
      insight: "You bring stability and foresight, which makes you a reassuring partner for the long game. The friction shows up with someone more spontaneous, who can read your planning as control. The fix is naming the why behind the plan so it feels like shared security, not a leash.",
      nextStep: "When this gets serious with someone, share the goal behind your habits, not just the rules.",
      cta: { label: "See your money signal grow", href: "/connections" },
      color: "210 60% 58%",
    },
    generous: {
      name: "The Generous",
      icon: "Gift",
      tagline: "Giving is how you love. Money, in your hands, is mostly about taking care of people.",
      insight: "Your warmth is obvious and people feel cared for around you. The watch-out is over-investing financially before someone has earned it, then feeling unmatched. Generosity lands best when it is a choice you can sustain, not a way to secure affection.",
      nextStep: "Notice whether your giving is mutual. The right person gives back in their own currency.",
      cta: { label: "Reflect on this in Your Mirror", href: "/your-mirror" },
      color: "326 70% 64%",
    },
    experienceSeeker: {
      name: "The Experience Seeker",
      icon: "Briefcase",
      tagline: "Money is for living. You'd rather have the memory than the balance.",
      insight: "You bring adventure and a refusal to let life get joyless, which is genuinely attractive. The tension comes with a security-minded partner who needs a cushion to feel safe. Compatibility here is less about the number and more about respecting each other's relationship to risk.",
      nextStep: "Ask a serious partner early how safe they need to feel. It prevents a quiet recurring fight.",
      cta: { label: "Map your compatibility", href: "/compatibility-compass" },
      color: "40 70% 58%",
    },
    securitySeeker: {
      name: "The Security Seeker",
      icon: "Shield",
      tagline: "Peace of mind comes first. A solid base is what lets you relax into anything else.",
      insight: "You value steadiness and you are clear-eyed about risk, which protects a partnership from a lot of stress. With a spender or a free spirit, the gap can feel like distrust if it is not named. Framed as a need for safety rather than a judgment, it usually lands fine.",
      nextStep: "Tell a serious partner what safety actually looks like to you in concrete terms.",
      cta: { label: "Check your readiness signals", href: "/me" },
      color: "160 45% 50%",
    },
  },
};

// ── Quiz 13: Ick Radar ──────────────────────────────────────────────────────
const ICK_RADAR: Quiz = {
  slug: "ick-radar",
  title: "What's your ick threshold?",
  pitch: "Some icks protect you. Some cost you good people. Five questions to tell which is which.",
  durationSec: 90,
  icon: "EyeOff",
  feeds: ["standards.filters", "attraction.triggers", "self.awareness"],
  questions: [
    {
      q: "A great date does one small cringe thing. Your reaction?",
      options: [
        { label: "It's over in my head almost instantly", scores: { quickFilter: 2 }, wellness: { questionId: "standards.ick.speed", dimension: "standards", category: "filters", questionText: "How quickly does a small turn-off end your interest?", answer: "Very fast. A single ick can end it for me." } },
        { label: "I note it but give the whole picture weight", scores: { benefitDoubt: 2 }, wellness: { questionId: "standards.ick.speed", dimension: "standards", category: "filters", questionText: "How quickly does a small turn-off end your interest?", answer: "Slowly. I weigh one moment against the whole person." } },
        { label: "Depends if it points to something real", scores: { valuesFilter: 2 }, wellness: { questionId: "standards.ick.speed", dimension: "standards", category: "filters", questionText: "How quickly does a small turn-off end your interest?", answer: "It depends whether the ick reflects a real value gap." } },
        { label: "Honestly I forget it by the next day", scores: { forgiving: 2 }, wellness: { questionId: "standards.ick.speed", dimension: "standards", category: "filters", questionText: "How quickly does a small turn-off end your interest?", answer: "I rarely let small turn-offs stick." } },
      ],
    },
    {
      q: "Be honest, most of your icks are about...",
      options: [
        { label: "Tiny mannerisms and vibes", scores: { quickFilter: 2 }, wellness: { questionId: "standards.ick.source", dimension: "standards", category: "filters", questionText: "What are most of your icks actually about?", answer: "Mostly small mannerisms and surface vibes." } },
        { label: "A mix, but I try to look deeper", scores: { benefitDoubt: 2 }, wellness: { questionId: "standards.ick.source", dimension: "standards", category: "filters", questionText: "What are most of your icks actually about?", answer: "A mix of surface and substance, leaning toward substance." } },
        { label: "How they treat people and what they value", scores: { valuesFilter: 2 }, wellness: { questionId: "standards.ick.source", dimension: "standards", category: "filters", questionText: "What are most of your icks actually about?", answer: "Mostly how they treat others and what they value." } },
        { label: "I don't really get icks", scores: { forgiving: 2 }, wellness: { questionId: "standards.ick.source", dimension: "standards", category: "filters", questionText: "What are most of your icks actually about?", answer: "I rarely experience icks at all." } },
      ],
    },
    {
      q: "Looking back, have your icks ever cost you someone good?",
      options: [
        { label: "Probably more than once", scores: { quickFilter: 2, benefitDoubt: 1 } },
        { label: "Maybe once, I learned from it", scores: { benefitDoubt: 2 } },
        { label: "No, my icks tend to be right", scores: { valuesFilter: 2 } },
        { label: "Not that I can think of", scores: { forgiving: 2 } },
      ],
    },
    {
      q: "An ick hits mid-date. What do you do with the rest of the night?",
      options: [
        { label: "I check out and wind it down", scores: { quickFilter: 2 } },
        { label: "I stay present and reassess after", scores: { benefitDoubt: 2 } },
        { label: "I test whether it was a one-off or a pattern", scores: { valuesFilter: 2, benefitDoubt: 1 } },
        { label: "I let it go and keep enjoying myself", scores: { forgiving: 2 } },
      ],
    },
    {
      q: "What would actually make you override an ick?",
      options: [
        { label: "Almost nothing, the feeling is the feeling", scores: { quickFilter: 2 } },
        { label: "Seeing a genuinely good person underneath", scores: { benefitDoubt: 2 } },
        { label: "Proof their values are solid", scores: { valuesFilter: 2 } },
        { label: "I don't need much, I override easily", scores: { forgiving: 2 } },
      ],
    },
  ],
  archetypes: {
    quickFilter: {
      name: "The Quick Filter",
      icon: "Zap",
      tagline: "You decide fast. Efficient, and occasionally a little ruthless on the small stuff.",
      insight: "Your instincts are quick and they save you from forcing chemistry that is not there. The honest risk is that surface icks sometimes screen out people who would have grown on you by date three. Worth asking whether the ick is about them or about an old pattern of yours.",
      nextStep: "Next ick, pause and name what it is really pointing at before you decide. It might surprise you.",
      cta: { label: "Unpack your patterns", href: "/your-mirror" },
      color: "48 90% 58%",
    },
    benefitDoubt: {
      name: "The Benefit of the Doubt",
      icon: "Handshake",
      tagline: "You weigh the whole person against the moment. Fair, and rarely unfairly harsh.",
      insight: "You give people room to be human, which means you do not lose good matches over a nervous laugh or a bad outfit. The flip side is making sure real red flags still get the same attention as small icks. Keep the grace, just do not extend it past your actual lines.",
      nextStep: "Sort your last few icks into surface versus substance. The substance ones deserve more weight.",
      cta: { label: "Clarify your dealbreakers", href: "/quizzes/dealbreaker-radar" },
      color: "190 55% 58%",
    },
    valuesFilter: {
      name: "The Values Filter",
      icon: "Target",
      tagline: "Your icks are wired to substance. When something turns you off, it usually means something.",
      insight: "You react less to mannerisms and more to how someone treats a waiter or talks about an ex, which makes your icks genuinely useful data. The only caution is that a values-led filter can be quietly demanding, so make sure your standards are ones you also meet. Mostly, trust this instinct.",
      nextStep: "Keep logging what triggers it. Your icks are a clean signal worth feeding the machine.",
      cta: { label: "Feed this into matching", href: "/your-mirror" },
      color: "260 55% 64%",
    },
    forgiving: {
      name: "The Forgiving",
      icon: "Waves",
      tagline: "Very little throws you off. Easygoing, with one thing to keep an eye on.",
      insight: "You are not derailed by small stuff, which makes dating you feel relaxed and unjudged. The watch-out is the opposite of everyone else's: make sure forgiving the small things is not how you also wave past the real ones. A low ick threshold is a gift as long as your dealbreakers still hold.",
      nextStep: "Double-check that your easygoing nature is not quietly skipping past actual red flags.",
      cta: { label: "Pressure-test your boundaries", href: "/quizzes/boundary-blueprint" },
      color: "200 60% 56%",
    },
  },
};

// ── Quiz: Your Growth Edge ───────────────────────────────────────────────────
const GROWTH_EDGE: Quiz = {
  slug: "growth-edge",
  title: "What's your dating growth edge?",
  pitch: "The one pattern that, if you worked on it, would change your dating life most. Five honest questions to name yours.",
  durationSec: 90,
  icon: "Sprout",
  feeds: ["growth.edge", "self.awareness", "patterns.recognition"],
  questions: [
    {
      q: "The pattern you fall into most when you really like someone is...",
      options: [
        { label: "I start doing too much, fast, before they have earned it", scores: { overGiver: 2, pleaser: 1 }, wellness: { questionId: "growth.pattern.likeness", dimension: "growth", category: "patterns", questionText: "What is your default pattern when you really like someone?", answer: "I over-give early, before the other person has earned it." } },
        { label: "I pull my real feelings back so I don't look too keen", scores: { guarded: 2 }, wellness: { questionId: "growth.pattern.likeness", dimension: "growth", category: "patterns", questionText: "What is your default pattern when you really like someone?", answer: "I hide my real feelings to avoid looking too interested." } },
        { label: "I want them more the less available they seem", scores: { chaser: 2 }, wellness: { questionId: "growth.pattern.likeness", dimension: "growth", category: "patterns", questionText: "What is your default pattern when you really like someone?", answer: "I am most drawn to people who feel out of reach." } },
        { label: "I get excited, then somehow let it cool without deciding to", scores: { drifter: 2 }, wellness: { questionId: "growth.pattern.likeness", dimension: "growth", category: "patterns", questionText: "What is your default pattern when you really like someone?", answer: "I let promising connections fade without a real decision." } },
        { label: "I become whatever I think they want me to be", scores: { pleaser: 2, overGiver: 1 }, wellness: { questionId: "growth.pattern.likeness", dimension: "growth", category: "patterns", questionText: "What is your default pattern when you really like someone?", answer: "I shapeshift into what I think the other person wants." } },
      ],
    },
    {
      q: "When something bothers you early in dating, you tend to...",
      options: [
        { label: "Say nothing and quietly file it away", scores: { guarded: 2 } },
        { label: "Talk myself out of it so I stay easy to be with", scores: { pleaser: 2 } },
        { label: "Work harder to fix the mood myself", scores: { overGiver: 2 } },
        { label: "Push for reassurance until it settles", scores: { chaser: 2 } },
        { label: "Let it ride and slowly lose interest instead", scores: { drifter: 2 } },
      ],
    },
    {
      q: "Honestly, the people you chase hardest are usually...",
      options: [
        { label: "A little out of reach, and that is the pull", scores: { chaser: 2 }, wellness: { questionId: "growth.attraction.pull", dimension: "growth", category: "attraction", questionText: "Who are you most drawn to pursue?", answer: "People who feel slightly unavailable." } },
        { label: "People who let me take care of them", scores: { overGiver: 2 }, wellness: { questionId: "growth.attraction.pull", dimension: "growth", category: "attraction", questionText: "Who are you most drawn to pursue?", answer: "People who let me do the caretaking." } },
        { label: "Safe enough that I never have to fully open up", scores: { guarded: 2 }, wellness: { questionId: "growth.attraction.pull", dimension: "growth", category: "attraction", questionText: "Who are you most drawn to pursue?", answer: "People safe enough that I never have to be vulnerable." } },
        { label: "Whoever seems to like me first", scores: { pleaser: 2 } },
        { label: "Whoever is easy, until easy gets boring", scores: { drifter: 2 } },
      ],
    },
    {
      q: "When a connection ends, the version of you that you regret is the one who...",
      options: [
        { label: "Gave far more than I got and called it love", scores: { overGiver: 2 } },
        { label: "Never let them actually see me", scores: { guarded: 2 } },
        { label: "Hung on long after I knew", scores: { chaser: 2 } },
        { label: "Shrunk myself to keep the peace", scores: { pleaser: 2 } },
        { label: "Went quiet instead of being honest", scores: { drifter: 2 } },
      ],
    },
    {
      q: "If one thing changed in how you date, the biggest unlock would be...",
      options: [
        { label: "Letting someone in before I am certain", scores: { guarded: 2 }, wellness: { questionId: "growth.unlock", dimension: "growth", category: "edge", questionText: "What would change your dating life most if you worked on it?", answer: "Letting people in before I feel certain." } },
        { label: "Letting myself receive without earning it", scores: { overGiver: 2 }, wellness: { questionId: "growth.unlock", dimension: "growth", category: "edge", questionText: "What would change your dating life most if you worked on it?", answer: "Receiving care without feeling I have to earn it." } },
        { label: "Wanting people who actually want me back", scores: { chaser: 2 }, wellness: { questionId: "growth.unlock", dimension: "growth", category: "edge", questionText: "What would change your dating life most if you worked on it?", answer: "Wanting people who are available and want me back." } },
        { label: "Staying present when things get real", scores: { drifter: 2 }, wellness: { questionId: "growth.unlock", dimension: "growth", category: "edge", questionText: "What would change your dating life most if you worked on it?", answer: "Staying present instead of drifting when it gets real." } },
        { label: "Telling the truth about what I want", scores: { pleaser: 2 }, wellness: { questionId: "growth.unlock", dimension: "growth", category: "edge", questionText: "What would change your dating life most if you worked on it?", answer: "Being honest about what I actually want." } },
      ],
    },
  ],
  archetypes: {
    overGiver: {
      name: "The Over-Giver",
      icon: "Gift",
      tagline: "You love by pouring out. Your growth edge is letting yourself receive without earning it first.",
      insight: "You show up early and generously, which makes people feel cared for fast. The cost is a quiet scoreboard where you give far more than you get and call the imbalance love. The work is not giving less, it is letting someone prove they will meet you before you empty yourself out.",
      nextStep: "On your next few dates, give a little less than your instinct says and watch who steps toward you anyway.",
      cta: { label: "Map this in Your Mirror", href: "/your-mirror" },
      color: "326 70% 64%",
    },
    guarded: {
      name: "The Guarded One",
      icon: "Shield",
      tagline: "You protect yourself well. Your growth edge is letting someone in before you are certain.",
      insight: "You keep your real feelings back until safety is proven, which spares you a lot of small hurts. The trade is that the people who could love you never quite get to meet you. Vulnerability shared a beat earlier than feels comfortable is usually what turns interest into closeness.",
      nextStep: "Pick one real thing you would normally hold back and say it out loud on your next date.",
      cta: { label: "Check where you stand", href: "/me" },
      color: "210 55% 60%",
    },
    chaser: {
      name: "The Chaser",
      icon: "Footprints",
      tagline: "Distance reads as desire to you. Your growth edge is wanting people who actually want you back.",
      insight: "You feel most alive when someone is a little out of reach, so availability can register as boring even when it is exactly what you say you want. The pattern is not romance, it is a nervous system that confuses uncertainty for chemistry. Steadiness is not the absence of spark, it is the ground real spark grows on.",
      nextStep: "Next time someone is clearly into you, stay curious instead of cooling off. The calm is the point.",
      cta: { label: "Work it through in Your Mirror", href: "/your-mirror" },
      color: "8 75% 62%",
    },
    drifter: {
      name: "The Drifter",
      icon: "Leaf",
      tagline: "You start strong, then let things fade. Your growth edge is staying present when it gets real.",
      insight: "You get genuinely excited at the start, then somehow let promising connections cool without ever deciding to. Often that drift is avoidance wearing a calm face, a way to leave without the hard conversation. Naming the pull to fade, instead of acting on it, is what keeps a good thing alive.",
      nextStep: "When you next feel a connection starting to drift, say one honest sentence about it rather than going quiet.",
      cta: { label: "Log a post-date debrief", href: "/copilot/debrief" },
      color: "150 45% 52%",
    },
    pleaser: {
      name: "The Pleaser",
      icon: "CircleUser",
      tagline: "You are easy to be with by design. Your growth edge is telling the truth about what you want.",
      insight: "You read the room and become the version of you that is easiest to like, which makes early dating smooth and you well-liked. The cost is that nobody is actually choosing you, they are choosing the shape you took for them. Your real preferences are not too much, they are the thing that lets the right person pick the real you.",
      nextStep: "State one genuine preference this week, even a small one, instead of saying you don't mind.",
      cta: { label: "Clarify what you want", href: "/quizzes/boundary-blueprint" },
      color: "275 50% 64%",
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
  LOVE_LANGUAGE,
  FUTURE_VISION,
  DEALBREAKER_RADAR,
  READINESS_CHECK,
  MONEY_IN_LOVE,
  ICK_RADAR,
  GROWTH_EDGE,
];

/**
 * Explicit per-article quiz overrides. Use this only when an article needs a
 * different quiz than its category would pick. Most articles should rely on the
 * category fallback below, so the funnel stays repeatable.
 */
export const QUIZ_BY_BLOG_SLUG: Record<string, string> = {
  "attachment-styles-on-dating-apps": "attachment-style",
  "post-date-reflection-questions": "post-date-instinct",
  "three-message-test": "message-stamina",
};

/**
 * Category-level fallback so every article leads into a relevant quiz without a
 * per-slug entry. Keys are blog `category` values; values are quiz slugs.
 */
export const QUIZ_BY_BLOG_CATEGORY: Record<string, string> = {
  "Message Coaching": "message-stamina",
  "Communication": "conflict-instinct",
  "Communication Patterns": "message-stamina",
  "Conversation": "message-stamina",
  "Attachment Theory": "attachment-style",
  "Pattern Recognition": "attachment-style",
  "Self-Awareness": "attachment-style",
  "Boundaries": "boundary-blueprint",
  "Date Strategy": "post-date-instinct",
  "Compatibility": "love-pace",
  "Mindset": "what-lights-you-up",
  "Profile Science": "what-lights-you-up",
  "Profile Audit": "what-lights-you-up",
  "Profile Strategy": "what-lights-you-up",
  "Prompt Strategy": "what-lights-you-up",
  "Photo Psychology": "what-lights-you-up",
  "Product": "what-lights-you-up",
};

/** Quiz used when neither an explicit nor a category match is found. */
const DEFAULT_QUIZ_SLUG = "what-lights-you-up";

export function getQuizBySlug(slug: string): Quiz | undefined {
  return QUIZZES.find(q => q.slug === slug);
}

/**
 * Resolve the related quiz for an article. Preference order:
 *   1. an explicit `relatedQuizSlug` on the article
 *   2. the per-slug override map (`QUIZ_BY_BLOG_SLUG`)
 *   3. the category fallback (`QUIZ_BY_BLOG_CATEGORY`)
 *   4. a sensible default quiz
 * This guarantees every post has a quiz to lead into, so the post -> quiz ->
 * first-run funnel never dead-ends.
 */
export function resolveQuizForArticle(article: {
  slug: string;
  category: string;
  relatedQuizSlug?: string;
}): Quiz | undefined {
  const candidate =
    article.relatedQuizSlug ??
    QUIZ_BY_BLOG_SLUG[article.slug] ??
    QUIZ_BY_BLOG_CATEGORY[article.category] ??
    DEFAULT_QUIZ_SLUG;
  return getQuizBySlug(candidate);
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
