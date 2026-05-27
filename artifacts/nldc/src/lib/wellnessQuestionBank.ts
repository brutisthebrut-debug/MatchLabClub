/**
 * Wellness Compatibility Question Bank
 *
 * 18 dimensions × multiple categories.
 * Each question has a stable `id` (dimension.slug) used as the DB questionId.
 * Sensitive sections are flagged with `sensitive: true` so the UI can offer a skip.
 */

export type WellnessQuestion = {
  id: string;
  dimension: string;
  category: string;
  text: string;
  sensitive?: boolean;
};

export const DIMENSION_META: Record<string, { label: string; color: string; blurb: string }> = {
  emotional:    { label: "Emotional",              color: "hsl(var(--brand-rose))",  blurb: "How you notice, name, and move through feelings." },
  physical:     { label: "Physical",               color: "hsl(var(--brand-green))",  blurb: "Energy, body awareness, health habits." },
  social:       { label: "Social",                 color: "hsl(190 55% 60%)",  blurb: "The people around you and how you connect." },
  intellectual: { label: "Intellectual",           color: "hsl(var(--brand-indigo))",  blurb: "Curiosity, learning, and the questions you carry." },
  spiritual:    { label: "Spiritual / Meaning",    color: "hsl(var(--brand-gold))",   blurb: "Values, meaning, and what keeps you grounded." },
  occupational: { label: "Occupational / Purpose", color: "hsl(220 50% 65%)",  blurb: "Work rhythm, ambition, and life direction." },
  financial:    { label: "Financial",              color: "hsl(155 50% 60%)",  blurb: "Money style, security needs, and shared lifestyle." },
  environmental:{ label: "Environmental / Home",   color: "hsl(160 45% 60%)",  blurb: "Spaces, routines, and home environment." },
  communication:{ label: "Communication",          color: "hsl(228 50% 68%)",  blurb: "How you speak, listen, and process together." },
  conflict:     { label: "Conflict & Repair",      color: "hsl(15 65% 62%)",   blurb: "How you handle disagreement and come back." },
  boundaries:   { label: "Boundaries",             color: "hsl(326 100% 65%)",  blurb: "What you protect and how you communicate it." },
  affection:    { label: "Affection & Touch",      color: "hsl(var(--brand-rose))",  blurb: "Physical closeness, warmth, and how you give care." },
  intimacy:     { label: "Intimacy",               color: "hsl(305 45% 62%)",  blurb: "Emotional and physical connection at depth.", },
  lifestyle:    { label: "Lifestyle Rhythm",       color: "hsl(35 65% 62%)",   blurb: "Daily patterns, energy, and how you like to live." },
  future_vision:{ label: "Future Vision",          color: "hsl(190 55% 60%)",  blurb: "Where you're heading and what you're building." },
  values:       { label: "Values & Character",     color: "hsl(var(--brand-gold))",   blurb: "What you stand for and how you want to live." },
  family:       { label: "Family & Community",     color: "hsl(var(--brand-green))",  blurb: "Roots, relationships, and who shaped you." },
  culture:      { label: "Culture & Background",   color: "hsl(var(--brand-indigo))",  blurb: "Heritage, traditions, and shared context." },
};

export const WELLNESS_QUESTIONS: WellnessQuestion[] = [
  // ── Emotional ──────────────────────────────────────────────────────────────
  { id: "emotional.feel_like_yourself",    dimension: "emotional",    category: "self_awareness",  text: "When do you feel most like yourself?" },
  { id: "emotional.process_feelings",      dimension: "emotional",    category: "self_awareness",  text: "Is it easy or difficult for you to talk about feelings?" },
  { id: "emotional.support_when_stressed", dimension: "emotional",    category: "needs",           text: "How do you like someone to support you when you're stressed?" },
  { id: "emotional.feel_safe",             dimension: "emotional",    category: "safety",          text: "What helps you feel emotionally safe with someone?" },
  { id: "emotional.feel_understood",       dimension: "emotional",    category: "connection",      text: "How do you know when someone truly understands you?" },
  { id: "emotional.feel_guarded",          dimension: "emotional",    category: "patterns",        text: "When do you feel most guarded?", sensitive: true },
  { id: "emotional.shut_down",             dimension: "emotional",    category: "patterns",        text: "What tends to shut you down emotionally?", sensitive: true },
  { id: "emotional.hard_to_trust",         dimension: "emotional",    category: "trust",           text: "What makes it difficult to fully trust someone?", sensitive: true },
  { id: "emotional.insecure",              dimension: "emotional",    category: "vulnerability",   text: "What tends to make you feel insecure?", sensitive: true },
  { id: "emotional.shaped_by",             dimension: "emotional",    category: "history",         text: "What experiences have shaped how you think about attraction or closeness?" },
  { id: "emotional.deeply_connected",      dimension: "emotional",    category: "connection",      text: "What makes you feel deeply connected to someone?" },
  { id: "emotional.wish_understood",       dimension: "emotional",    category: "needs",           text: "What do you wish people understood about how you experience connection?" },

  // ── Physical ───────────────────────────────────────────────────────────────
  { id: "physical.confident",              dimension: "physical",     category: "body_experience", text: "What makes you feel most confident physically?" },
  { id: "physical.body_relationship",      dimension: "physical",     category: "body_experience", text: "What's your relationship with your body like?" },
  { id: "physical.energy_style",           dimension: "physical",     category: "energy",          text: "Do you feel energised by activity, or are you more low-key?" },
  { id: "physical.best_habits",            dimension: "physical",     category: "habits",          text: "What physical habits make you feel your best?" },
  { id: "physical.stress_physically",      dimension: "physical",     category: "stress",          text: "How do you usually handle stress physically — exercise, sleep, movement, quiet time?" },
  { id: "physical.chronic_health",         dimension: "physical",     category: "health",          text: "Do you manage any chronic health conditions?", sensitive: true },
  { id: "physical.mental_health",          dimension: "physical",     category: "health",          text: "Do you manage any mental health challenges?", sensitive: true },
  { id: "physical.energy_window",          dimension: "physical",     category: "energy",          text: "What time of day are you at your best for real conversation?" },
  { id: "physical.fitness_importance",     dimension: "physical",     category: "lifestyle",       text: "How important is fitness or health to your lifestyle?" },
  { id: "physical.ideal_relaxing_day",     dimension: "physical",     category: "lifestyle",       text: "What's your ideal relaxing day — adventure, couch, outdoors, travel?" },

  // ── Social ─────────────────────────────────────────────────────────────────
  { id: "social.circle_size",              dimension: "social",       category: "style",           text: "Would you describe yourself as someone with a small inner circle or a wide social network?" },
  { id: "social.recharge",                 dimension: "social",       category: "style",           text: "How much do you need alone time to recharge after being social?" },
  { id: "social.friends_role",             dimension: "social",       category: "community",       text: "What role do friends and family play in your life right now?" },
  { id: "social.offline_dating",           dimension: "social",       category: "dating_context",  text: "How do you currently meet new people — mostly apps, friends, events, or somewhere else?" },
  { id: "social.privacy",                  dimension: "social",       category: "privacy",         text: "Are you a private person or an open book?" },
  { id: "social.share_relationship",       dimension: "social",       category: "privacy",         text: "How much do you like sharing relationship details with others?" },
  { id: "social.support_network",          dimension: "social",       category: "community",       text: "Do you have people you can debrief with after dates?" },
  { id: "social.responsibility_others",    dimension: "social",       category: "values",          text: "What responsibility do you feel people have to help each other?" },

  // ── Intellectual ───────────────────────────────────────────────────────────
  { id: "intellectual.lose_time",          dimension: "intellectual", category: "curiosity",       text: "What topics or activities make you lose track of time?" },
  { id: "intellectual.curious_about",      dimension: "intellectual", category: "curiosity",       text: "What are you genuinely curious about right now?" },
  { id: "intellectual.learning_style",     dimension: "intellectual", category: "learning",        text: "How do you prefer to learn something new?" },
  { id: "intellectual.disagree_strongly",  dimension: "intellectual", category: "beliefs",         text: "What's something you believe strongly even if other people disagree?" },
  { id: "intellectual.conversation_style", dimension: "intellectual", category: "style",           text: "In conversation, do you tend to share ideas or ask questions first?" },
  { id: "intellectual.perspective_change", dimension: "intellectual", category: "growth",          text: "What experiences significantly changed your perspective?" },

  // ── Spiritual / Meaning ────────────────────────────────────────────────────
  { id: "spiritual.grounded",              dimension: "spiritual",    category: "grounding",       text: "What keeps you grounded when things are difficult?" },
  { id: "spiritual.values_guide",          dimension: "spiritual",    category: "values",          text: "What principles guide your biggest decisions?" },
  { id: "spiritual.faith_practice",        dimension: "spiritual",    category: "practice",        text: "Does spirituality, religion, or mindfulness play a role in your life?", sensitive: true },
  { id: "spiritual.good_person",           dimension: "spiritual",    category: "ethics",          text: "What qualities make someone a good person in your eyes?" },
  { id: "spiritual.ethics_complicated",    dimension: "spiritual",    category: "ethics",          text: "How do you decide what's right when things are complicated?" },
  { id: "spiritual.social_issues",         dimension: "spiritual",    category: "worldview",       text: "What social issues matter most to you?" },
  { id: "spiritual.owe_each_other",        dimension: "spiritual",    category: "worldview",       text: "What do you think people owe each other?" },
  { id: "spiritual.meaning_vs_pleasure",   dimension: "spiritual",    category: "meaning",         text: "How do you think about the difference between a meaningful life and a comfortable one?" },

  // ── Occupational / Purpose ─────────────────────────────────────────────────
  { id: "occupational.motivates",          dimension: "occupational", category: "work",            text: "What motivates you in your work or projects?" },
  { id: "occupational.success_means",      dimension: "occupational", category: "ambition",        text: "What does success mean to you?" },
  { id: "occupational.freedom_security",   dimension: "occupational", category: "values",          text: "Would you rather have freedom, security, achievement, influence, or balance?" },
  { id: "occupational.no_money",           dimension: "occupational", category: "purpose",         text: "What would you do with your time if money wasn't a factor?" },
  { id: "occupational.building_toward",    dimension: "occupational", category: "direction",       text: "What are you building toward in your life right now?" },
  { id: "occupational.work_spills",        dimension: "occupational", category: "work_life",       text: "How much does work spill into your personal time?" },
  { id: "occupational.dating_bandwidth",   dimension: "occupational", category: "work_life",       text: "How much weekly energy and time do you realistically have for dating?" },

  // ── Financial ─────────────────────────────────────────────────────────────
  { id: "financial.money_style",           dimension: "financial",    category: "style",           text: "Are you more of a saver, spender, investor, or experiencer?" },
  { id: "financial.stability_means",       dimension: "financial",    category: "security",        text: "What does financial stability mean to you?" },
  { id: "financial.worth_spending",        dimension: "financial",    category: "values",          text: "What kinds of things feel worth spending money on?" },
  { id: "financial.ideal_life",            dimension: "financial",    category: "lifestyle",       text: "What does your ideal day-to-day life look like financially?" },
  { id: "financial.hard_lesson",           dimension: "financial",    category: "history",         text: "What's something money or finances taught you the hard way?", sensitive: true },
  { id: "financial.talk_about",            dimension: "financial",    category: "communication",   text: "How comfortable are you talking about money with a partner?", sensitive: true },

  // ── Environmental / Home ──────────────────────────────────────────────────
  { id: "environmental.home_feels",        dimension: "environmental",category: "home",            text: "How would you describe your home environment — calm, social, minimal, cosy?" },
  { id: "environmental.live_anywhere",     dimension: "environmental",category: "location",        text: "Are you open to living somewhere new, or is location a strong preference?" },
  { id: "environmental.spaces_best",       dimension: "environmental",category: "environment",     text: "What kinds of spaces let you be most yourself?" },
  { id: "environmental.routines",          dimension: "environmental",category: "habits",          text: "What routines are important to your wellbeing?" },
  { id: "environmental.personal_space",    dimension: "environmental",category: "independence",    text: "How much personal space do you need at home?" },

  // ── Communication ─────────────────────────────────────────────────────────
  { id: "communication.process_style",     dimension: "communication",category: "style",           text: "Are you someone who processes thoughts out loud or internally?" },
  { id: "communication.direct_indirect",   dimension: "communication",category: "style",           text: "Do you usually communicate directly or more indirectly?" },
  { id: "communication.medium_preference", dimension: "communication",category: "style",           text: "Do you prefer texting, calls, or talking face to face?" },
  { id: "communication.bring_up_issues",   dimension: "communication",category: "timing",          text: "When something bothers you, do you bring it up quickly or sit with it first?" },
  { id: "communication.need_space",        dimension: "communication",category: "timing",          text: "Do you tend to need space before conversations or prefer talking things through immediately?" },
  { id: "communication.express_care",      dimension: "communication",category: "affection",       text: "How do you usually express care and affection?" },
  { id: "communication.good_listener",     dimension: "communication",category: "listening",       text: "When someone comes to you with a problem, do you solve it, listen, encourage, or ask questions?" },
  { id: "communication.frustrating_habits",dimension: "communication",category: "dealbreakers",    text: "What communication habits frustrate you most?" },
  { id: "communication.ideal_frequency",   dimension: "communication",category: "expectations",    text: "How much communication feels ideal in a relationship?" },
  { id: "communication.feel_heard",        dimension: "communication",category: "needs",           text: "What makes you feel heard?" },
  { id: "communication.feedback",          dimension: "communication",category: "self_awareness",  text: "What feedback have people given you about how you communicate?" },
  { id: "communication.partner_concerns",  dimension: "communication",category: "compatibility",   text: "How should a partner tell you when something isn't working?" },

  // ── Conflict & Repair ─────────────────────────────────────────────────────
  { id: "conflict.family_conflict",        dimension: "conflict",     category: "history",         text: "What did conflict look like in your family growing up?", sensitive: true },
  { id: "conflict.when_upset",             dimension: "conflict",     category: "response",        text: "How do you usually respond when you're upset?" },
  { id: "conflict.feel_misunderstood",     dimension: "conflict",     category: "needs",           text: "When you feel misunderstood, what do you need from the other person?" },
  { id: "conflict.productive_vs_harmful",  dimension: "conflict",     category: "values",          text: "What makes conflict feel productive versus harmful?" },
  { id: "conflict.repair_after",           dimension: "conflict",     category: "repair",          text: "How do you repair things after an argument?" },
  { id: "conflict.angry_closeness",        dimension: "conflict",     category: "response",        text: "When you're angry, do you want closeness or distance?" },
  { id: "conflict.healthy_disagreement",   dimension: "conflict",     category: "growth",          text: "What's the healthiest disagreement you've had with someone?" },
  { id: "conflict.handle_disagreement",    dimension: "conflict",     category: "compatibility",   text: "If we disagreed about something important, how would you want us to handle it?" },
  { id: "conflict.wont_tolerate",          dimension: "conflict",     category: "dealbreakers",    text: "What's something you won't tolerate in a relationship?" },
  { id: "conflict.crosses_line",           dimension: "conflict",     category: "dealbreakers",    text: "What behaviors cross a line for you?" },

  // ── Boundaries ────────────────────────────────────────────────────────────
  { id: "boundaries.important_to_you",     dimension: "boundaries",   category: "core",            text: "Are there boundaries that are especially important to you?" },
  { id: "boundaries.respected_sexually",   dimension: "boundaries",   category: "intimacy",        text: "What helps you feel respected in intimate situations?", sensitive: true },
  { id: "boundaries.comfortable_uncomfortable", dimension: "boundaries", category: "comfort",     text: "Are there things that consistently help you feel comfortable or uncomfortable?" },
  { id: "boundaries.consent_checkin",      dimension: "boundaries",   category: "intimacy",        text: "How do you approach consent and checking in with a partner?", sensitive: true },
  { id: "boundaries.taken_time_to_learn",  dimension: "boundaries",   category: "growth",          text: "What boundaries took you more time to learn?" },
  { id: "boundaries.stronger_with_age",    dimension: "boundaries",   category: "growth",          text: "What's a boundary you've become stronger about as you've gotten older?" },
  { id: "boundaries.taught_someone",       dimension: "boundaries",   category: "growth",          text: "Have you ever had to teach someone how to treat you?", sensitive: true },
  { id: "boundaries.trust_to_open",        dimension: "boundaries",   category: "trust",           text: "What makes you trust someone enough to become more open?" },
  { id: "boundaries.ignored",              dimension: "boundaries",   category: "response",        text: "How do you usually respond when someone ignores your limits?" },
  { id: "boundaries.misunderstood_needs",  dimension: "boundaries",   category: "self_awareness",  text: "What's something people often misunderstand about your needs?" },
  { id: "boundaries.communication_difficult", dimension: "boundaries",category: "communication",   text: "How do you like difficult conversations to happen?" },
  { id: "boundaries.unhealthy_habits",     dimension: "boundaries",   category: "dealbreakers",    text: "What communication habits feel unhealthy to you?" },
  { id: "boundaries.alone_time",           dimension: "boundaries",   category: "independence",    text: "How important is alone time to you?" },
  { id: "boundaries.togetherness_balance", dimension: "boundaries",   category: "independence",    text: "What balance feels right between togetherness and independence?" },

  // ── Affection & Touch ─────────────────────────────────────────────────────
  { id: "affection.naturally_physical",    dimension: "affection",    category: "style",           text: "Are you naturally physically affectionate?" },
  { id: "affection.touch_cared_for",       dimension: "affection",    category: "needs",           text: "What kinds of touch make you feel most cared for?" },
  { id: "affection.hand_holding_hugging",  dimension: "affection",    category: "style",           text: "Do you like hand-holding, hugs, cuddling, and physical closeness?" },
  { id: "affection.show_affection",        dimension: "affection",    category: "expression",      text: "How do you show physical affection when you care about someone?" },
  { id: "affection.comfort_discomfort",    dimension: "affection",    category: "communication",   text: "How do you usually communicate comfort or discomfort physically?" },
  { id: "affection.safe_physically",       dimension: "affection",    category: "safety",          text: "Are there things that help you feel safe physically?" },
  { id: "affection.pace",                  dimension: "affection",    category: "compatibility",   text: "What pace feels right to you when getting to know someone physically?" },
  { id: "affection.outside_bedroom",       dimension: "affection",    category: "relationship",    text: "How important is physical affection outside of intimate moments?" },

  // ── Intimacy ──────────────────────────────────────────────────────────────
  { id: "intimacy.emotionally_physically_safe", dimension: "intimacy", category: "safety",        text: "What helps you feel emotionally and physically safe with someone?", sensitive: true },
  { id: "intimacy.chemistry_means",        dimension: "intimacy",     category: "meaning",         text: "What does physical chemistry mean to you?", sensitive: true },
  { id: "intimacy.importance",             dimension: "intimacy",     category: "values",          text: "How important is physical intimacy in a relationship?", sensitive: true },
  { id: "intimacy.feel_desired",           dimension: "intimacy",     category: "needs",           text: "What makes you feel desired or appreciated?", sensitive: true },
  { id: "intimacy.partner_should_know",    dimension: "intimacy",     category: "communication",   text: "Are there things a partner should know about how you experience intimacy?", sensitive: true },
  { id: "intimacy.sexuality_role",         dimension: "intimacy",     category: "values",          text: "What role does sexuality play in your life?", sensitive: true },
  { id: "intimacy.great_connection",       dimension: "intimacy",     category: "meaning",         text: "What does a great sexual/intimate connection mean to you?", sensitive: true },
  { id: "intimacy.emotional_physical",     dimension: "intimacy",     category: "style",           text: "Do you see intimacy as emotional, physical, playful, spiritual, or something else?", sensitive: true },
  { id: "intimacy.compatibility_important",dimension: "intimacy",     category: "compatibility",   text: "How important is physical compatibility in a relationship?", sensitive: true },
  { id: "intimacy.meaningful",             dimension: "intimacy",     category: "meaning",         text: "What makes intimacy meaningful for you?", sensitive: true },
  { id: "intimacy.attraction_pace",        dimension: "intimacy",     category: "attraction",      text: "Does attraction build slowly or quickly for you?", sensitive: true },
  { id: "intimacy.attraction_beyond_appearance", dimension: "intimacy", category: "attraction",   text: "What qualities make someone attractive beyond appearance?", sensitive: true },
  { id: "intimacy.healthy_sexuality",      dimension: "intimacy",     category: "meaning",         text: "What does healthy sexuality mean to you?", sensitive: true },
  { id: "intimacy.changed_over_time",      dimension: "intimacy",     category: "growth",          text: "Has your relationship with intimacy changed over time?", sensitive: true },
  { id: "intimacy.shaped_by",              dimension: "intimacy",     category: "history",         text: "What experiences shaped how you think about intimacy?", sensitive: true },
  { id: "intimacy.fulfillment",            dimension: "intimacy",     category: "meaning",         text: "What does sexual/intimate fulfillment look like to you?", sensitive: true },

  // ── Lifestyle Rhythm ──────────────────────────────────────────────────────
  { id: "lifestyle.morning_night",         dimension: "lifestyle",    category: "rhythm",          text: "Are you an early riser or a night person?" },
  { id: "lifestyle.weekday_rhythm",        dimension: "lifestyle",    category: "rhythm",          text: "What does a typical weekday feel like for you?" },
  { id: "lifestyle.weekend_style",         dimension: "lifestyle",    category: "rhythm",          text: "What's your ideal weekend?" },
  { id: "lifestyle.adventure_vs_couch",    dimension: "lifestyle",    category: "preference",      text: "On a free day — adventure, couch, outdoors, or social?" },
  { id: "lifestyle.travel_importance",     dimension: "lifestyle",    category: "preference",      text: "How important is travel to you?" },
  { id: "lifestyle.health_fitness",        dimension: "lifestyle",    category: "habits",          text: "How does health and fitness fit into your daily life?" },
  { id: "lifestyle.spontaneous_planned",   dimension: "lifestyle",    category: "preference",      text: "Are you more spontaneous or do you prefer plans?" },
  { id: "lifestyle.location",              dimension: "lifestyle",    category: "location",        text: "How tied to your current location are you?" },

  // ── Future Vision ─────────────────────────────────────────────────────────
  { id: "future_vision.life_building",     dimension: "future_vision",category: "direction",       text: "What kind of life are you trying to create?" },
  { id: "future_vision.ten_years",         dimension: "future_vision",category: "direction",       text: "Where do you hope to be in ten years?" },
  { id: "future_vision.legacy",            dimension: "future_vision",category: "meaning",         text: "What do you hope people say about you after knowing you well?" },
  { id: "future_vision.family_intentions", dimension: "future_vision",category: "family",          text: "Do you want children, or are you open to a partner who does or doesn't?", sensitive: true },
  { id: "future_vision.partnership_style", dimension: "future_vision",category: "relationship",    text: "What does the ideal partnership look like for you long-term?" },
  { id: "future_vision.relationship_goals",dimension: "future_vision",category: "relationship",    text: "What are you looking for in a relationship right now?" },

  // ── Values & Character ────────────────────────────────────────────────────
  { id: "values.most_important",           dimension: "values",       category: "core",            text: "What principles are most important to you?" },
  { id: "values.lose_respect",             dimension: "values",       category: "dealbreakers",    text: "What makes you lose respect for someone?" },
  { id: "values.most_proud",               dimension: "values",       category: "self_awareness",  text: "What are you most proud of about who you are?" },
  { id: "values.difficult_because_right",  dimension: "values",       category: "integrity",       text: "When was a time you did something difficult because it felt right?" },
  { id: "values.relationship_healthy",     dimension: "values",       category: "relationship",    text: "What makes a relationship healthy?" },
  { id: "values.loyalty_means",            dimension: "values",       category: "relationship",    text: "What does loyalty mean to you?" },
  { id: "values.dealbreakers",             dimension: "values",       category: "dealbreakers",    text: "What relationship behaviors are deal breakers for you?" },
  { id: "values.hard_lesson",              dimension: "values",       category: "growth",          text: "What's something life taught you the hard way?" },
  { id: "values.working_on",               dimension: "values",       category: "growth",          text: "What are you working on improving about yourself?" },
  { id: "values.personal_growth_means",    dimension: "values",       category: "growth",          text: "What does personal growth mean to you?" },

  // ── Family & Community ────────────────────────────────────────────────────
  { id: "family.role",                     dimension: "family",       category: "family",          text: "What role does family play in your life?" },
  { id: "family.influenced_by",            dimension: "family",       category: "history",         text: "Who most influenced who you became?" },
  { id: "family.traditions",               dimension: "family",       category: "culture",         text: "What traditions matter to you?" },
  { id: "family.impact",                   dimension: "family",       category: "community",       text: "What kind of impact do you want to have on the people around you?" },
  { id: "family.future_role",              dimension: "family",       category: "future",          text: "How do you see family fitting into your future?", sensitive: true },
  { id: "family.community_involvement",    dimension: "family",       category: "community",       text: "How connected are you to a community outside of family and close friends?" },

  // ── Culture & Background ──────────────────────────────────────────────────
  { id: "culture.background",              dimension: "culture",      category: "identity",        text: "How does your cultural background show up in your daily life?" },
  { id: "culture.important_traditions",    dimension: "culture",      category: "traditions",      text: "What cultural or family traditions are important to you?" },
  { id: "culture.partner_background",      dimension: "culture",      category: "compatibility",   text: "How important is shared cultural background in a relationship?" },
  { id: "culture.identity",                dimension: "culture",      category: "identity",        text: "How do you describe your identity — race, ethnicity, religion, or other?" },
];

/** Questions grouped by dimension for use in the Progressive Profile Builder */
export function getQuestionsByDimension(dimension: string): WellnessQuestion[] {
  return WELLNESS_QUESTIONS.filter(q => q.dimension === dimension);
}

/** A curated set of "starter" questions for the onboarding module — 3 questions, one per key area */
export const STARTER_MODULE: WellnessQuestion[] = [
  WELLNESS_QUESTIONS.find(q => q.id === "communication.process_style")!,
  WELLNESS_QUESTIONS.find(q => q.id === "lifestyle.morning_night")!,
  WELLNESS_QUESTIONS.find(q => q.id === "values.most_important")!,
];

/** Module definitions for the Progressive Profile Builder UI */
export const PROFILE_MODULES = [
  {
    id: "starter",
    label: "Quick start",
    subtitle: "3 questions to begin your profile",
    questions: STARTER_MODULE,
    sensitive: false,
  },
  {
    id: "communication_style",
    label: "Your communication style",
    subtitle: "How you speak, listen, and process",
    questions: WELLNESS_QUESTIONS.filter(q => q.dimension === "communication").slice(0, 5),
    sensitive: false,
  },
  {
    id: "lifestyle_rhythm",
    label: "Lifestyle rhythm",
    subtitle: "Daily patterns and how you like to live",
    questions: WELLNESS_QUESTIONS.filter(q => q.dimension === "lifestyle"),
    sensitive: false,
  },
  {
    id: "values_character",
    label: "Values & character",
    subtitle: "What you stand for and how you move through the world",
    questions: WELLNESS_QUESTIONS.filter(q => q.dimension === "values"),
    sensitive: false,
  },
  {
    id: "conflict_repair",
    label: "Conflict & repair",
    subtitle: "How you handle disagreement and come back",
    questions: WELLNESS_QUESTIONS.filter(q => q.dimension === "conflict"),
    sensitive: false,
  },
  {
    id: "financial_lens",
    label: "Your financial lens",
    subtitle: "Money style and what security means to you",
    questions: WELLNESS_QUESTIONS.filter(q => q.dimension === "financial"),
    sensitive: false,
  },
  {
    id: "future_vision",
    label: "Future vision",
    subtitle: "Where you're heading and what you're building",
    questions: WELLNESS_QUESTIONS.filter(q => q.dimension === "future_vision"),
    sensitive: false,
  },
  {
    id: "boundaries_independence",
    label: "Boundaries & independence",
    subtitle: "What you protect and how you communicate it",
    questions: WELLNESS_QUESTIONS.filter(q => q.dimension === "boundaries" && !q.sensitive),
    sensitive: false,
  },
  {
    id: "affection_touch",
    label: "Affection & touch",
    subtitle: "Physical closeness and how you give care",
    questions: WELLNESS_QUESTIONS.filter(q => q.dimension === "affection"),
    sensitive: false,
  },
  {
    id: "intimacy_preferences",
    label: "Intimacy preferences",
    subtitle: "You can skip this entirely — always optional",
    questions: WELLNESS_QUESTIONS.filter(q => q.dimension === "intimacy"),
    sensitive: true,
  },
];

/** Derived compatibility tags from answered dimensions */
export type InsightTag = {
  tag: string;
  label: string;
  category: string;
};

export const POSSIBLE_TAGS: InsightTag[] = [
  { tag: "direct-communicator",     label: "Direct communicator",      category: "communication" },
  { tag: "needs-processing-time",   label: "Needs processing time",    category: "communication" },
  { tag: "security-oriented",       label: "Security-oriented",        category: "values" },
  { tag: "experience-oriented",     label: "Experience-oriented",      category: "values" },
  { tag: "routine-driven",          label: "Routine-driven",           category: "lifestyle" },
  { tag: "flexible-planner",        label: "Flexible planner",         category: "lifestyle" },
  { tag: "small-circle-social",     label: "Small-circle social style",category: "social" },
  { tag: "adventure-oriented",      label: "Adventure-oriented",       category: "lifestyle" },
  { tag: "touch-forward",           label: "Touch-forward",            category: "affection" },
  { tag: "space-sensitive",         label: "Space-sensitive",          category: "boundaries" },
  { tag: "repair-focused",          label: "Repair-focused",           category: "conflict" },
  { tag: "conflict-avoidant-stress",label: "Conflict-avoidant under stress", category: "conflict" },
  { tag: "future-family-oriented",  label: "Future-family-oriented",   category: "future_vision" },
  { tag: "location-flexible",       label: "Location-flexible",        category: "lifestyle" },
  { tag: "intellectually-driven",   label: "Intellectually-driven",    category: "intellectual" },
  { tag: "emotionally-reflective",  label: "Emotionally reflective",   category: "emotional" },
  { tag: "independent-by-nature",   label: "Independent by nature",    category: "boundaries" },
  { tag: "affectionate-expressor",  label: "Affectionate expressor",   category: "affection" },
  { tag: "values-aligned-first",    label: "Values-aligned first",     category: "values" },
  { tag: "financially-intentional", label: "Financially intentional",  category: "financial" },
];
