import { useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ToolHandoff } from "@/components/ToolHandoff";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WelcomePanel } from "@/components/WelcomePanel";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Compass,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Check,
  History,
  ClipboardPaste,
  ImagePlus,
  Sparkles,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { ShareButton } from "@/components/echo/ShareButton";
import {
  useEnhanceAi,
  useSaveCompassRead,
  useListCompassReads,
  getListCompassReadsQueryKey,
  useGetAiContentConsent,
  getGetAiContentConsentQueryKey,
  useGetCompassSignalContext,
  getGetCompassSignalContextQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { FallbackNotice } from "@/components/FallbackNotice";
import { FallbackRateBadge } from "@/components/FallbackRateBadge";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const OWN_STYLES = [
  "Spark Chaser. I feel fast and act on it",
  "Slow Burn. I open gradually, invest deeply",
  "Quality Filter, high standards, early assessment",
  "Steady Seeker, consistent, want partnership",
  "Guarded Romantic, want depth, protect myself",
  "Anxious Confirmer, need reassurance, care deeply",
  "Secure Builder, comfortable with intimacy, steady",
  "Intensity Responder, alive in high-stakes moments",
  "Avoidant Editor, need space, withdraw when close",
  "Low-Trust Dater, careful with trust, earned slowly",
  "Not sure yet",
];

const PATTERNS = [
  "Attracted to unavailable people",
  "Great starts that slowly fizzle",
  "Getting close then pulling back (me)",
  "They pull back once I'm invested",
  "Moving too fast",
  "Moving too slow / never getting traction",
  "Attracting emotionally immature people",
  "Relationships that feel intense but unstable",
  "Nothing seems to land",
];

interface CompassResult {
  supportiveTraits: string[];
  commonPull: string;
  cautionDynamics: string[];
  bestDynamic: string;
  nonNegotiables: string[];
  falseSpark: string;
}

type InputMode = "reflection" | "paste" | "screenshot";

const ANON_FREE_READS = 1;
const ANON_STORAGE_KEY = "compass_anon_reads_used";

function readAnonUsed(): number {
  if (typeof window === "undefined") return 0;
  try {
  const raw = window.localStorage.getItem(ANON_STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
  return 0;
  }
}

function bumpAnonUsed() {
  if (typeof window === "undefined") return;
  try {
  const next = readAnonUsed() + 1;
  window.localStorage.setItem(ANON_STORAGE_KEY, String(next));
  } catch {
  // ignore storage errors
  }
}

function analyzeCompass(ownStyle: string, patterns: string[], notes: string): CompassResult {
  const isSparkChaser = ownStyle.startsWith("Spark");
  const isSlowBurn = ownStyle.startsWith("Slow");
  const isQuality = ownStyle.startsWith("Quality");
  const isSteady = ownStyle.startsWith("Steady");
  const isGuarded = ownStyle.startsWith("Guarded");
  const isAnxious = ownStyle.startsWith("Anxious");
  const isSecure = ownStyle.startsWith("Secure");
  const isIntensity = ownStyle.startsWith("Intensity");
  const isAvoidant = ownStyle.startsWith("Avoidant");
  const isLowTrust = ownStyle.startsWith("Low-Trust");

  const attractsUnavailable = patterns.includes(PATTERNS[0]);
  const fizzles = patterns.includes(PATTERNS[1]);
  const pullsBack = patterns.includes(PATTERNS[2]);
  const theyPullBack = patterns.includes(PATTERNS[3]);
  const tooFast = patterns.includes(PATTERNS[4]);
  const tooSlow = patterns.includes(PATTERNS[5]);

  const supportive: string[][] = [
  isSparkChaser ? ["Calm consistency, someone who holds steady when you're fluctuating", "Enough confidence that they don't require constant attention", "Someone who can match your enthusiasm without mirroring your anxiety"] : [],
  isSlowBurn ? ["Patient enough to let you arrive, not because they're passive, but because they're interested", "Real depth to discover, someone who gets more interesting, not less", "Low-pressure energy early on, they don't need you to perform"] : [],
  isQuality ? ["Someone who can hold their own, you need to respect them to be attracted", "Genuine substance (values, curiosity, self-awareness) over surface-level appeal", "Someone who also has standards, mutual selectivity creates real chemistry"] : [],
  isSteady ? ["Someone who's also genuinely trying, directness and availability should be met with the same", "Emotional reciprocity, they invest as things develop, not just receive", "Clarity about what they want, you're giving that, they should too"] : [],
  isGuarded ? ["Someone who earns trust through consistency, not declarations", "Patience without passivity, they stay interested without requiring you to arrive immediately", "Security in themselves, not someone who needs your openness to feel okay"] : [],
  isAnxious ? ["Someone who communicates clearly and proactively, not someone who makes you guess", "Consistency over time, the same person at day 1 and day 30", "Someone who can tolerate your care without finding it excessive"] : [],
  isSecure ? ["Someone who's doing their own work, matched self-awareness and willingness to grow", "Reciprocal investment, not someone who anchors to your stability without building toward it", "Real emotional presence, not just availability"] : [],
  isIntensity ? ["Someone who can handle your depth without needing to de-escalate it", "Someone with their own intense interior, you need to be met, not managed", "Capacity for both the peaks and the ordinary middle"] : [],
  isAvoidant ? ["Someone who doesn't require frequent reassurance, secure enough not to chase", "Respects your need for space without reading it as rejection", "Patience, without performing patience, it should be natural"] : [],
  isLowTrust ? ["Someone who shows consistency before asking for trust", "Actions that match words, over weeks, not days", "Someone who doesn't require you to open up before they've earned it"] : [],
  ];

  const supportiveTraits = supportive.flat().length > 0
  ? supportive.flat().slice(0, 3)
  : [
  "Someone who shows up consistently rather than intensely",
  "Genuine emotional availability, present, not just accessible",
  "Self-awareness, they understand their own patterns",
  ];

  const commonPulls: Record<string, string> = {
  Spark: "You tend to be pulled toward people who are exciting and slightly unpredictable, because the excitement registers as chemistry. The risk is that excitement and compatibility are different things, and the people who produce the most spark are often the ones with the least to offer over time.",
  Slow: "You tend to be pulled toward depth and substance, and sometimes toward people who seem to have more going on beneath the surface than they actually do. Real depth reveals itself slowly; projected depth is designed to attract.",
  Quality: "You tend to be pulled toward people who seem to meet your standard, high-performing, interesting, self-possessed. The risk is that performance and character aren't the same thing. Someone who looks like the right fit can still be the wrong person.",
  Steady: "You tend to be pulled toward people who seem to want what you want, which means you can overweight early declarations of interest. What someone says they want and what they do when they have it are different data.",
  Guarded: "You tend to be pulled toward people who are slightly out of reach, because they feel safer. If someone is fully available, something in you may question whether they're worth wanting. This is worth examining directly.",
  Anxious: "You tend to be pulled toward people who create just enough uncertainty that you have to work for the connection, because effort feels like love. The cost: the people who require the most work are often the ones who have the least to give.",
  Secure: "You tend to attract people who want your stability more than they want you, and the pull can go toward people who need rescuing or grounding. Watch for whether someone is investing in the relationship or anchoring to your groundedness.",
  Intensity: "You tend to be pulled toward situations that produce the most feeling, beginning energy, conflict, dramatic moments. The risk is that the intensity of the feeling becomes the measure of the connection's worth.",
  Avoidant: "You tend to be pulled toward people who create enough pressure to confirm your need for space, or toward people who are so easygoing they don't challenge your edges at all. Neither produces real growth.",
  "Low-Trust": "You tend to be pulled toward people who feel familiar, and familiar often means repeating a dynamic you already know. Safety and familiarity are not the same thing.",
  };

  const styleKey = ownStyle.split(" ")[0];
  const commonPull = commonPulls[styleKey] || "You tend to be pulled toward intensity and the feeling of chemistry, which is real information, and also not the whole picture. The people who produce the most feeling early on are not always the ones with the most to offer over time.";

  const cautionList: string[] = [];
  if (attractsUnavailable) cautionList.push("Emotionally unavailable people, where the distance creates the pull. Unavailability isn't depth. It's just distance.");
  if (fizzles) cautionList.push("People who are great at the beginning and unclear about the middle, the ones who can generate connection but not sustain it.");
  if (pullsBack || isGuarded || isAvoidant) cautionList.push("Dynamics where you have to manage someone else's discomfort with closeness while managing your own, this is exhausting and unsustainable.");
  if (theyPullBack || isAnxious) cautionList.push("Dynamics where you're consistently pursuing more than you're being pursued. Consistent asymmetry is data, not a temporary phase.");
  if (tooFast || isSparkChaser || isIntensity) cautionList.push("Connections that move very fast at the start, where the early intensity substitutes for the slower work of actually knowing someone.");
  if (cautionList.length === 0) cautionList.push("Dynamics where the exciting early stage doesn't develop into real substance, where chemistry was mistaken for compatibility.");

  const bestDynamics: Record<string, string> = {
  Spark: "Someone who is consistent enough to keep you grounded, interesting enough to keep you engaged, and secure enough not to need your validation. The best dynamic for you is one where the spark deepens into substance, not one where the spark is the whole thing.",
  Slow: "Someone patient enough to let you arrive, ideally someone who is also investing slowly and revealing themselves gradually. Mutual slow-burn dynamics tend to produce the most durable connections. The challenge is that neither person signals interest quickly enough; someone needs to go first.",
  Quality: "Someone who meets your standard and also challenges it slightly. A relationship that's genuinely equal, where you both respect each other's judgment and push each other's thinking. Admiration that goes both directions.",
  Steady: "Someone who matches your investment level naturally, who doesn't need to be chased or managed, who brings what you bring. The best dynamic is one where your consistency is met with equal consistency, not just appreciated and consumed.",
  Guarded: "Someone secure enough not to need you to be open before they've earned it, who earns trust through behavior rather than asking for it. Patience without pressure, investment without demand. This is rarer than it sounds.",
  Anxious: "Someone who communicates proactively and consistently, who doesn't leave you guessing, and who can handle your care without reading it as too much. Secure attachment style on their end tends to be the most stabilizing dynamic for you.",
  Secure: "Someone doing their own work, who isn't looking for stability from you but is building something alongside you. Genuine partnership with mutual investment and matched self-awareness.",
  Intensity: "Someone who can hold depth and be present for the ordinary, who makes the quiet moments feel like something, not just the peaks. The best dynamic for you is one with real emotional range, not just drama.",
  Avoidant: "Someone secure enough not to need frequent reassurance, who can give you space without interpreting it as abandonment, and who respects your need for room without enabling an endless retreat. This person exists; they're just also not going to chase you.",
  "Low-Trust": "Someone who is willing to earn it slowly, who shows up consistently before asking for your openness. Patient, clear, and not offended by your caution. They exist. The work is creating enough of a path for them to reach you.",
  };

  const bestDynamic = bestDynamics[styleKey] || "A dynamic with genuine reciprocity, both people investing, both people honest about what they want, both people willing to do the slower work of actually knowing each other.";

  const nonNegotiables: string[] = [];
  if (isAnxious || isLowTrust) nonNegotiables.push("Consistency, the same person at day 1 and day 30. Inconsistency creates the anxiety loop.");
  if (isGuarded || isAvoidant) nonNegotiables.push("Patience without pressure, someone who stays interested without requiring you to arrive immediately.");
  if (isSparkChaser || isIntensity) nonNegotiables.push("Substance beneath the chemistry, someone who gets more interesting, not less, as you know them better.");
  if (isQuality || isSteady) nonNegotiables.push("Genuine reciprocity, someone who invests at a level that directionally matches yours.");
  if (isSecure || isSlowBurn) nonNegotiables.push("Matched self-awareness, someone doing their own work, not just benefiting from yours.");
  if (tooSlow) nonNegotiables.push("Someone willing to signal interest clearly, not someone who leaves you guessing whether anything is there.");
  if (nonNegotiables.length === 0) nonNegotiables.push("Genuine presence, someone who's actually there, not performing being there.");
  nonNegotiables.push("Honesty about what they want, declarations are cheap; behavior over time is the real data.");
  nonNegotiables.push("The capacity to handle difficulty without exiting or exploding, relationships are tested in the uncomfortable moments.");

  const falseSparks: Record<string, string> = {
  Spark: "Unavailability mistaken for depth. When someone is just out of reach, it can produce a feeling that reads like intensity, but it's mostly anxiety. Real depth feels different: it settles you, not excites you.",
  Slow: "Intrigue mistaken for compatibility. Someone who seems to have layers, who seems mysterious or complex, can feel like a match for your depth-seeking nature. But mystery that never resolves isn't depth, it's withholding.",
  Quality: "Performance mistaken for character. Someone who presents very well, who is polished, interesting, accomplished, can seem to meet your standard. The filter catches performance before it catches character; give it time.",
  Steady: "Early enthusiasm mistaken for sustained interest. Someone who matches your energy in the first few weeks and then settles into receiving more than they give. The beginning is not the whole picture.",
  Guarded: "Unavailability mistaken for safety. When someone is partially out of reach, it can feel like a more manageable risk, if it doesn't fully develop, it can't fully hurt. The cost: you miss the connections that were actually safe.",
  Anxious: "Relief mistaken for love. When someone who usually produces anxiety suddenly gives you reassurance, the relief can feel like profound connection. It's not, it's the absence of a specific kind of pain.",
  Secure: "Neediness mistaken for passion. When someone is very invested in you very quickly, it can feel like evidence of real chemistry. Sometimes it is. Sometimes it's urgency that has nothing to do with you specifically.",
  Intensity: "Drama mistaken for aliveness. High-conflict, high-emotion dynamics can produce a feeling of being very present and very alive, but the aliveness is from the nervous system activation, not from genuine connection.",
  Avoidant: "Distance mistaken for self-respect. When someone doesn't need you, it can feel like they have something worth wanting. Sometimes they do. Sometimes it's just unavailability with good packaging.",
  "Low-Trust": "Familiarity mistaken for safety. When someone feels familiar, even if familiar means repeating a pattern that's hurt you before, it can register as comfort. Familiarity is not the same as safety.",
  };

  const falseSpark = falseSparks[styleKey] || "Intensity mistaken for compatibility. The feeling of strong early chemistry can overshadow the slower signals, consistency, honesty, reciprocity, that actually predict whether something will last.";

  return { supportiveTraits, commonPull, cautionDynamics: cautionList.slice(0, 3), bestDynamic, nonNegotiables: nonNegotiables.slice(0, 3), falseSpark };
}

const STYLE_KEYWORDS: Array<{ style: string; words: RegExp[] }> = [
  { style: OWN_STYLES[0], words: [/\bspark\b/, /\bexciting\b/, /\bspontane/, /\bimpulsive\b/, /\bbutterflies\b/] },
  { style: OWN_STYLES[1], words: [/\bslow burn\b/, /\btake.*time\b/, /\bgradually\b/, /\bopen up slowly\b/, /\bdeep\b/] },
  { style: OWN_STYLES[2], words: [/\bstandards\b/, /\bambitio/, /\bdriven\b/, /\bvalues\b/, /\bgoals\b/, /\bself.aware/] },
  { style: OWN_STYLES[3], words: [/\bpartner\b/, /\blong.?term\b/, /\bcommitted\b/, /\bserious\b/, /\bbuild\b/, /\bsteady\b/] },
  { style: OWN_STYLES[4], words: [/\bguarded\b/, /\bprotect\b/, /\bwall(s)?\b/, /\bhurt before\b/, /\btrust issues\b/] },
  { style: OWN_STYLES[5], words: [/\banxious\b/, /\banxiety\b/, /\boverthink/, /\breassur/, /\bworry\b/, /\bcare deeply\b/] },
  { style: OWN_STYLES[6], words: [/\bsecure\b/, /\bcomfortable\b/, /\bgrounded\b/, /\bstable\b/, /\bself.assured\b/] },
  { style: OWN_STYLES[7], words: [/\bintense\b/, /\bpassionate\b/, /\ball.?in\b/, /\bemotional\b/, /\bdrama\b/] },
  { style: OWN_STYLES[8], words: [/\bavoid/, /\bspace\b/, /\bwithdraw/, /\bdistance\b/, /\bsuffocat/, /\bindependent\b/] },
  { style: OWN_STYLES[9], words: [/\blow.?trust\b/, /\bskeptic/, /\bcareful\b/, /\bcautious\b/, /\bearned slowly\b/] },
];

const PATTERN_KEYWORDS: Array<{ pattern: string; words: RegExp[] }> = [
  { pattern: PATTERNS[0], words: [/\bunavailab/, /\btaken\b/, /\bnot ready\b/, /\bemotionally distant\b/] },
  { pattern: PATTERNS[1], words: [/\bfizzle/, /\bgreat start\b/, /\bdied down\b/, /\bcooled off\b/, /\bghost/] },
  { pattern: PATTERNS[2], words: [/\bi pull back\b/, /\bi withdraw\b/, /\bgetting too close\b/, /\boverwhelm/] },
  { pattern: PATTERNS[3], words: [/\bthey pull back\b/, /\bthey ghost/, /\bthey lost interest\b/, /\bonce i was invested\b/] },
  { pattern: PATTERNS[4], words: [/\btoo fast\b/, /\bmove fast\b/, /\bintense early\b/, /\bcame on strong\b/] },
  { pattern: PATTERNS[5], words: [/\btoo slow\b/, /\bnever moves\b/, /\bno traction\b/, /\bstagnant\b/] },
  { pattern: PATTERNS[6], words: [/\bimmature\b/, /\bchildish\b/, /\bcan't communicate\b/, /\bemotionally unavailable\b/] },
  { pattern: PATTERNS[7], words: [/\bintense but unstable\b/, /\bon and off\b/, /\bup and down\b/, /\bhot and cold\b/] },
  { pattern: PATTERNS[8], words: [/\bnothing lands\b/, /\bno chemistry\b/, /\bnothing clicks\b/, /\bcan't connect\b/] },
];

function deriveFromText(text: string): { ownStyle: string; patterns: string[] } {
  const lower = text.toLowerCase();
  let bestStyle = OWN_STYLES[OWN_STYLES.length - 1];
  let bestScore = 0;
  for (const { style, words } of STYLE_KEYWORDS) {
  const score = words.reduce((acc, rx) => acc + (rx.test(lower) ? 1 : 0), 0);
  if (score > bestScore) {
  bestScore = score;
  bestStyle = style;
  }
  }
  const matchedPatterns = PATTERN_KEYWORDS
.filter(({ words }) => words.some((rx) => rx.test(lower)))
.map(({ pattern }) => pattern);
  return { ownStyle: bestStyle, patterns: matchedPatterns };
}

const DEMO: CompassResult = {
  supportiveTraits: ["Calm consistency, someone who holds steady when you're fluctuating", "Enough confidence that they don't require constant attention", "Someone who can match your enthusiasm without mirroring your anxiety"],
  commonPull: "You tend to be pulled toward people who are exciting and slightly unpredictable, because the excitement registers as chemistry. The risk is that excitement and compatibility are different things, and the people who produce the most spark are often the ones with the least to offer over time.",
  cautionDynamics: ["Connections that move very fast at the start, where the early intensity substitutes for the slower work of actually knowing someone.", "People who are great at the beginning and unclear about the middle, who can generate connection but not sustain it."],
  bestDynamic: "Someone consistent enough to keep you grounded, interesting enough to keep you engaged, and secure enough not to need your validation. The best dynamic for you is one where the spark deepens into substance, not one where the spark is the whole thing.",
  nonNegotiables: ["Substance beneath the chemistry, someone who gets more interesting, not less", "Genuine reciprocity, both people investing at a comparable level", "Honesty about what they want, declarations are cheap; behavior over time is the real data"],
  falseSpark: "Unavailability mistaken for depth. When someone is just out of reach, it produces a feeling that reads like intensity, but it's mostly anxiety. Real depth feels different: it settles you, not excites you.",
};

const PROGRESS_STEPS = [
  { key: "read", label: "Reading inputs" },
  { key: "patterns", label: "Finding patterns" },
  { key: "writing", label: "Writing your read" },
] as const;

type ProgressStage = "idle" | "reading" | "patterns" | "writing";

function ProgressIndicator({ stage }: { stage: ProgressStage }) {
  if (stage === "idle") return null;
  const activeIdx = stage === "reading" ? 0 : stage === "patterns" ? 1 : 2;
  return (
  <div
  data-testid="compass-progress"
  className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2"
  >
  {PROGRESS_STEPS.map((step, i) => {
  const isActive = i === activeIdx;
  const isDone = i < activeIdx;
  return (
  <div key={step.key} className="flex items-center gap-2">
  <span
  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors ${
  isActive
  ? "border-[hsl(248_62%_52%/0.4)] bg-[hsl(248_62%_52%/0.12)] text-[hsl(248_62%_72%)]"
  : isDone
  ? "border-[hsl(142_55%_60%/0.3)] text-[hsl(142_55%_72%)]"
  : "border-white/10 text-muted-foreground/60"
  }`}
  >
  {isActive ? (
  <Loader2 className="w-3 h-3 animate-spin" />
  ) : isDone ? (
  <Check className="w-3 h-3" />
  ) : (
  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
  )}
  {step.label}
  </span>
  {i < PROGRESS_STEPS.length - 1 && (
  <span className="text-muted-foreground/40">{"\u2192"}</span>
  )}
  </div>
  );
  })}
  </div>
  );
}

const MODE_CHIP_LABEL: Record<InputMode, string> = {
  reflection: "from reflection",
  paste: "from paste",
  screenshot: "from screenshot",
};

export default function CompatibilityCompass() {
  useMeta("Compatibility Compass", "Reflect on yourself, paste a profile, or upload a screenshot. Get supportive traits to look for, caution dynamics, your best-fit dynamic, and the false-spark pattern to watch for.");
  const [ownStyle, setOwnStyle] = useState("");
  const [patterns, setPatterns] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [activeTab, setActiveTab] = useState<InputMode>("reflection");
  const [resultMode, setResultMode] = useState<InputMode>("reflection");
  const [result, setResult] = useState<CompassResult | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [progressStage, setProgressStage] = useState<ProgressStage>("idle");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showSignupCta, setShowSignupCta] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const enhance = useEnhanceAi();
  const queryClient = useQueryClient();
  const saveRead = useSaveCompassRead();
  const history = useListCompassReads({
  query: { queryKey: getListCompassReadsQueryKey() },
  });
  const { isAuthenticated, user } = useAuth();
  const consent = useGetAiContentConsent({
  query: { queryKey: getGetAiContentConsentQueryKey(), enabled: isAuthenticated },
  });
  const consentGranted = Boolean(consent.data?.granted);
  const userId = user?.id ?? null;

  const signalContext = useGetCompassSignalContext({
  query: { queryKey: getGetCompassSignalContextQueryKey(), enabled: isAuthenticated },
  });
  const ctx = signalContext.data?.available ? signalContext.data : null;

  const loading = enhance.isPending || ocrLoading;
  const isBrandNewUser = isAuthenticated && !result;

  function gateAnonOrProceed(): boolean {
  if (isAuthenticated) return true;
  if (readAnonUsed() >= ANON_FREE_READS) {
  setShowSignupCta(true);
  return false;
  }
  return true;
  }

  async function persistRead(
  deterministic: CompassResult,
  aiResult: CompassResult | null,
  style: string,
  pats: string[],
  note: string,
  ) {
  try {
  const saved = await saveRead.mutateAsync({
  data: {
  connectionStyle: style,
  patterns: pats,
  notes: note.trim() ? note.trim() : null,
  deterministicResult: deterministic as unknown as Record<string, unknown>,
  aiResult: aiResult as unknown as Record<string, unknown> | null,
  },
  });
  setSavedId(saved.id);
  await queryClient.invalidateQueries({ queryKey: getListCompassReadsQueryKey() });
  if (isAuthenticated) {
  await queryClient.invalidateQueries({ queryKey: getGetCompassSignalContextQueryKey() });
  }
  } catch {
  setSavedId(null);
  }
  }

  function togglePattern(p: string) {
  setPatterns(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  function tryParseCompass(raw: string): CompassResult | null {
  try {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  const parsed = JSON.parse(raw.slice(start, end + 1)) as {
  supportiveTraits?: unknown;
  commonPull?: unknown;
  cautionDynamics?: unknown;
  bestDynamic?: unknown;
  nonNegotiables?: unknown;
  falseSpark?: unknown;
  };
  const asArr = (v: unknown, min: number, max: number, minLen: number): string[] | null => {
  if (!Array.isArray(v)) return null;
  const arr = v.filter((x): x is string => typeof x === "string" && x.trim().length >= minLen).map(s => s.trim());
  if (arr.length < min) return null;
  return arr.slice(0, max);
  };
  const asStr = (v: unknown, minLen: number): string | null =>
  typeof v === "string" && v.trim().length >= minLen ? v.trim() : null;
  const supportiveTraits = asArr(parsed.supportiveTraits, 2, 3, 15);
  const cautionDynamics = asArr(parsed.cautionDynamics, 1, 3, 20);
  const nonNegotiables = asArr(parsed.nonNegotiables, 2, 3, 15);
  const commonPull = asStr(parsed.commonPull, 60);
  const bestDynamic = asStr(parsed.bestDynamic, 60);
  const falseSpark = asStr(parsed.falseSpark, 60);
  if (!supportiveTraits || !cautionDynamics || !nonNegotiables || !commonPull || !bestDynamic || !falseSpark) return null;
  return { supportiveTraits, commonPull, cautionDynamics, bestDynamic, nonNegotiables, falseSpark };
  } catch {
  return null;
  }
  }

  function buildPrompt(style: string, pats: string[], note: string, rawText: string | null) {
  // Aggregate, derived signal the machine already holds on this user (coverage
  // and readiness only, never raw content or PII). Threading it in lets the read
  // evolve with who they are becoming, not just this single input.
  const signalLines = ctx ? (ctx.activeSignals ?? []) : [];
  const signalBlock = ctx
  ? [
  "",
  "Context the app already holds on this user (aggregate signal only, do not quote it back):",
  typeof ctx.readinessScore === "number" ? `Match readiness: ${ctx.readinessScore} out of 100.` : "",
  ...signalLines.map(l => `- ${l}`),
  "Let this quietly inform the read so it reflects this person over time, not just this moment.",
  ].filter(Boolean)
  : [];
  return [
  "Given this person's connection style and recurring dating patterns, return ONLY a single JSON object:",
  '{ "supportiveTraits": string[], "commonPull": string, "cautionDynamics": string[], "bestDynamic": string, "nonNegotiables": string[], "falseSpark": string }',
  "supportiveTraits: 2-3 specific traits to look for (each 1-2 sentences).",
  "commonPull: 2-3 sentences naming their typical pull and its risk.",
  "cautionDynamics: 1-3 dynamics to watch for (each 1-2 sentences).",
  "bestDynamic: 2-3 sentences describing their best-supporting dynamic.",
  "nonNegotiables: 2-3 specific non-negotiables (each 1-2 sentences).",
  "falseSpark: 2-3 sentences naming the false-spark pattern.",
  "",
  `Connection style: ${style}`,
  pats.length ? `Recurring patterns: ${pats.join("; ")}` : "Recurring patterns: none specified",
  note.trim() ? `Notes: ${note}` : "",
  rawText ? `Source text the user shared about a person they're considering:\n"""\n${rawText.slice(0, 3500)}\n"""` : "",
  ...signalBlock,
  "",
  "Return ONLY the JSON object. No prose, no markdown.",
  ].filter(Boolean).join("\n");
  }

  async function runAnalysis(opts: {
  mode: InputMode;
  style: string;
  pats: string[];
  note: string;
  rawText: string | null;
  useAi: boolean;
  }) {
  const { mode, style, pats, note, rawText, useAi } = opts;
  setSavedId(null);
  setProgressStage("reading");
  const persistNote = rawText ? rawText : note;
  const deterministic = analyzeCompass(style, pats, note || rawText || "");
  setProgressStage("patterns");

  if (!useAi) {
  setProgressStage("writing");
  setUsedFallback(false);
  setResult(deterministic);
  setResultMode(mode);
  await persistRead(deterministic, null, style, pats, persistNote);
  setProgressStage("idle");
  if (!isAuthenticated) bumpAnonUsed();
  return;
  }

  try {
  const ai = await enhance.mutateAsync({
  data: {
  toolName: "Compatibility Compass",
  prompt: buildPrompt(style, pats, note, rawText),
  context: {
  toolName: "Compatibility Compass",
  formValues: { ownStyle: style, patterns: pats, notes: note, sourceText: rawText ?? "", mode },
  },
  },
  });
  setProgressStage("writing");
  const validationFailed = ai.validated === false;
  if (ai.isFallback || validationFailed || !ai.output.trim()) {
  setUsedFallback(true);
  setResult(deterministic);
  setResultMode(mode);
  void persistRead(deterministic, null, style, pats, persistNote);
  return;
  }
  const parsed = tryParseCompass(ai.output);
  setUsedFallback(parsed == null);
  setResult(parsed ?? deterministic);
  setResultMode(mode);
  void persistRead(deterministic, parsed, style, pats, persistNote);
  } catch {
  setUsedFallback(true);
  setResult(deterministic);
  setResultMode(mode);
  void persistRead(deterministic, null, style, pats, persistNote);
  } finally {
  setProgressStage("idle");
  if (!isAuthenticated) bumpAnonUsed();
  }
  }

  async function handleReflectionAnalyze() {
  if (!ownStyle) return;
  if (!gateAnonOrProceed()) return;
  await runAnalysis({
  mode: "reflection",
  style: ownStyle,
  pats: patterns,
  note: notes,
  rawText: null,
  useAi: true,
  });
  }

  async function handlePasteAnalyze() {
  const trimmed = pasteText.trim();
  if (trimmed.length < 50 || trimmed.length > 4000) return;
  if (!gateAnonOrProceed()) return;
  const derived = deriveFromText(trimmed);
  const useAi = Boolean(userId) && consentGranted;
  await runAnalysis({
  mode: "paste",
  style: derived.ownStyle,
  pats: derived.patterns,
  note: "",
  rawText: trimmed,
  useAi,
  });
  }

  async function handleScreenshotFile(file: File) {
  setOcrError(null);
  if (!gateAnonOrProceed()) return;
  if (file.size > 10 * 1024 * 1024) {
  setOcrError("Image is too large. Max 10MB.");
  return;
  }
  setOcrLoading(true);
  setProgressStage("reading");
  try {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/compass/extract-screenshot", {
  method: "POST",
  body: form,
  });
  if (!res.ok) {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  setOcrError(data?.error || "Couldn't read text from that screenshot.");
  setProgressStage("idle");
  return;
  }
  const data = (await res.json()) as { text: string };
  const text = (data.text || "").trim();
  if (text.length < 20) {
  setOcrError("Not enough readable text. Try a clearer screenshot.");
  setProgressStage("idle");
  return;
  }
  setOcrLoading(false);
  const derived = deriveFromText(text);
  const useAi = Boolean(userId) && consentGranted;
  await runAnalysis({
  mode: "screenshot",
  style: derived.ownStyle,
  pats: derived.patterns,
  note: "",
  rawText: text,
  useAi,
  });
  } catch {
  setOcrError("Upload failed. Check your connection and try again.");
  setProgressStage("idle");
  } finally {
  setOcrLoading(false);
  }
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (file) void handleScreenshotFile(file);
  e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
  e.preventDefault();
  setDragOver(false);
  const file = e.dataTransfer.files?.[0];
  if (file) void handleScreenshotFile(file);
  }

  function handleRetry() {
  // Re-run whichever mode produced the current result. Previously this
  // only re-ran reflection, which silently no-op'd retries from paste /
  // screenshot results. Screenshot mode needs the original File, which
  // we don't retain past upload, so we fall back to a noop there with a
  // friendly toast prompting re-upload.
  if (resultMode === "reflection") {
  void handleReflectionAnalyze();
  } else if (resultMode === "paste") {
  void handlePasteAnalyze();
  } else if (resultMode === "screenshot") {
  // Screenshot mode needs the original File object, which we drop after
  // upload. Surface a hint via the existing OCR error channel so the
  // user knows to re-pick the file.
  setActiveTab("screenshot");
  setOcrError("Re-upload the screenshot to retry this read.");
  }
  }

  function loadHistorical(read: {
  id: number;
  connectionStyle: string;
  patterns: string[];
  notes?: string | null;
  deterministicResult: Record<string, unknown>;
  aiResult?: Record<string, unknown> | null;
  }) {
  const ai = read.aiResult ?? null;
  const picked = (ai ?? read.deterministicResult) as unknown as CompassResult;
  setOwnStyle(read.connectionStyle);
  setPatterns(read.patterns ?? []);
  setNotes(read.notes ?? "");
  setResult(picked);
  setResultMode("reflection");
  setUsedFallback(ai == null);
  setSavedId(read.id);
  setActiveTab("reflection");
  if (typeof window !== "undefined") {
  window.scrollTo({ top: 0, behavior: "smooth" });
  }
  }

  const show = result ?? DEMO;
  const isDemo = !result;
  const pasteLen = pasteText.trim().length;
  const pasteValid = pasteLen >= 50 && pasteLen <= 4000;
  const anonOutOfReads = !isAuthenticated && readAnonUsed() >= ANON_FREE_READS;

  return (
  <AppLayout>
  <div className="min-h-screen mesh-bg py-10 px-4">
  <div className="orb orb-violet fixed w-[380px] h-[380px] top-10 right-0 opacity-25 pointer-events-none" />
  <div className="max-w-3xl mx-auto relative z-10">
  <motion.div {...fadeUp()} className="mb-8">
  <div className="flex items-center gap-2 mb-2">
  <Compass className="w-4 h-4 text-[hsl(248_62%_52%)]" />
  <p className="text-sm font-medium text-[hsl(248_62%_62%)]">Self-Insight</p>
  </div>
  <h1 className="text-3xl font-bold text-foreground">Compatibility Compass</h1>
  <FallbackRateBadge toolName="Compatibility Compass" className="mt-1" />

  <p className="text-muted-foreground mt-2 leading-relaxed">Three ways in. Reflect on yourself, paste a profile, or drop a screenshot. Get a read on the dynamics that tend to support you and the ones to watch.<br /><span className="text-xs text-muted-foreground/60">Suggests rather than dictates. Based on what you share, not a clinical assessment.</span></p>
  </motion.div>

  {isBrandNewUser && (
  <WelcomePanel
  icon={<Compass className="w-6 h-6 text-primary" />}
  eyebrow="Welcome to Compatibility Compass"
  title="Find the dynamics that fit you"
  description="Share your connection style, paste a profile you're considering, or drop a screenshot. I'll surface supportive traits to look for, dynamics to watch, and the false-spark pattern that pulls you off course."
  testId="compass-empty-state"
  />
  )}

  <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-3xl p-7 space-y-6 mb-6">
  <Tabs
  value={activeTab}
  onValueChange={(v) => setActiveTab(v as InputMode)}
  data-testid="compass-input-tabs"
  >
  <TabsList className="grid grid-cols-3 w-full mb-5">
  <TabsTrigger value="reflection" data-testid="tab-reflection">
  <Compass className="w-3.5 h-3.5 mr-1.5" />Reflect on yourself
  </TabsTrigger>
  <TabsTrigger value="paste" data-testid="tab-paste">
  <ClipboardPaste className="w-3.5 h-3.5 mr-1.5" />Paste their profile
  </TabsTrigger>
  <TabsTrigger value="screenshot" data-testid="tab-screenshot">
  <ImagePlus className="w-3.5 h-3.5 mr-1.5" />Upload a screenshot
  </TabsTrigger>
  </TabsList>

  <TabsContent value="reflection" className="space-y-6 mt-0">
  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">How would you describe your connection style?</Label>
  <div className="flex flex-wrap gap-2">
  {OWN_STYLES.map(s => (
  <button key={s} onClick={() => setOwnStyle(prev => prev === s ? "" : s)}
  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${ownStyle === s ? "bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_65%)] border-[hsl(248_62%_52%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
  {s}
  </button>
  ))}
  </div>
  </div>
  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Patterns that keep showing up <span className="font-normal normal-case text-muted-foreground/50">(select all that apply)</span></Label>
  <div className="flex flex-wrap gap-2">
  {PATTERNS.map(p => (
  <button key={p} onClick={() => togglePattern(p)}
  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${patterns.includes(p) ? "bg-[hsl(43_65%_65%/0.15)] text-[hsl(43_65%_80%)] border-[hsl(43_65%_65%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
  {p}
  </button>
  ))}
  </div>
  </div>
  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Anything else worth adding? <span className="font-normal normal-case text-muted-foreground/50">(optional)</span></Label>
  <Textarea placeholder="e.g. I tend to attract people who need a lot of reassurance. Or: I'm drawn to people I have to work for."
  value={notes} onChange={e => setNotes(e.target.value)}
  className="min-h-[72px] resize-none bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/40" />
  </div>
  <Button onClick={handleReflectionAnalyze} disabled={loading || !ownStyle}
  data-testid="button-compass-analyze"
  className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 glow-pulse disabled:opacity-50">
  {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Reading your compass</> : <><Compass className="mr-2 h-4 w-4" />Find My Compass</>}
  </Button>
  </TabsContent>

  <TabsContent value="paste" className="space-y-4 mt-0">
  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Paste a bio, prompts, or a few messages</Label>
  <p className="text-xs text-muted-foreground/70">
  Paste what you have from someone you're considering. Bio, prompt answers, a short message thread. The more there is to read, the more specific the read.
  </p>
  <Textarea
  value={pasteText}
  onChange={(e) => setPasteText(e.target.value)}
  placeholder="Paste their bio, prompts, or a few messages here."
  data-testid="compass-paste-textarea"
  className="min-h-[200px] resize-y bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/40"
  maxLength={4000}
  />
  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
  <span>
  {pasteLen < 50
  ? `${50 - pasteLen} more characters to enable Read`
  : `${pasteLen} / 4000`}
  </span>
  {isAuthenticated && (
  <span className={consentGranted ? "text-[hsl(142_55%_72%)]" : "text-muted-foreground/60"}>
  {consentGranted ? "AI enhance on" : "Deterministic only (turn on AI consent in Account to enhance)"}
  </span>
  )}
  </div>
  </div>
  <Button
  onClick={handlePasteAnalyze}
  disabled={loading || !pasteValid}
  data-testid="button-compass-paste-read"
  className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 disabled:opacity-50"
  >
  {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Reading</> : <><Sparkles className="mr-2 h-4 w-4" />Read this</>}
  </Button>
  </TabsContent>

  <TabsContent value="screenshot" className="space-y-4 mt-0">
  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Drop a profile or chat screenshot</Label>
  <p className="text-xs text-muted-foreground/70">
  PNG, JPG, or WEBP up to 10MB. We read the text and run the same compass on it. Nothing about the image is stored.
  </p>
  </div>
  <div
  onClick={() => fileInputRef.current?.click()}
  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
  onDragLeave={() => setDragOver(false)}
  onDrop={onDrop}
  data-testid="compass-screenshot-dropzone"
  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
  dragOver
  ? "border-[hsl(248_62%_52%/0.6)] bg-[hsl(248_62%_52%/0.08)]"
  : "border-white/15 hover:border-white/30 bg-[hsl(248_40%_95%/0.4)]"
  }`}
  >
  <ImagePlus className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
  <p className="text-sm font-medium text-foreground">
  {ocrLoading ? "Reading your screenshot" : "Drop an image or click to choose a file"}
  </p>
  <p className="text-xs text-muted-foreground/70 mt-1">
  {ocrLoading ? "This usually takes a few seconds." : "We extract the text and analyze it."}
  </p>
  <input
  ref={fileInputRef}
  type="file"
  accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
  className="hidden"
  onChange={onFilePicked}
  data-testid="compass-screenshot-input"
  />
  </div>
  {ocrError && (
  <p className="text-xs text-[hsl(348_75%_70%)] flex items-center gap-1.5">
  <AlertCircle className="w-3.5 h-3.5" />{ocrError}
  </p>
  )}
  {isAuthenticated && (
  <p className="text-[11px] text-muted-foreground">
  {consentGranted ? "AI enhance on for signed-in reads." : "Deterministic only. Turn on AI consent in Account to enhance."}
  </p>
  )}
  </TabsContent>
  </Tabs>

  {showSignupCta && anonOutOfReads && (
  <div
  data-testid="compass-anon-cta"
  className="rounded-2xl border border-[hsl(248_62%_52%/0.3)] bg-[hsl(248_62%_52%/0.07)] p-4 text-sm text-foreground space-y-2"
  >
  <p className="font-semibold">Your free read is used.</p>
  <p className="text-muted-foreground text-xs">
  Sign in to keep reading. Your past reads stay with you and AI enhance becomes available.
  </p>
  <Link
  href="/account"
  className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(248_62%_72%)] hover:text-foreground"
  >
  Sign in to continue
  </Link>
  </div>
  )}

  <ProgressIndicator stage={progressStage} />

  {!isDemo && result && (
  <div className="flex items-center justify-center pt-1">
  <ShareButton
  surface="compass-read"
  title="My Compatibility Compass read"
  text={`Just ran a Compatibility Compass read on MatchLab Club. The pattern read is real. Try one →`}
  path="/compatibility-compass"
  ref="compass-share"
  variant="pill"
  label="Share my compass"
  testId="button-share-compass"
  />
  </div>
  )}
  </motion.div>

  <AnimatePresence>
  <motion.div {...fadeUp(0.1)} className={isDemo ? "opacity-60" : ""}>
  {isDemo && (
  <div className="text-center mb-4">
  <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
  <AlertCircle className="w-3.5 h-3.5" />Example output. Pick a tab above to run your own.
  </p>
  </div>
  )}
  {!isDemo && usedFallback && (
  <FallbackNotice
  onRetry={handleRetry}
  loading={loading}
  label="compass read"
  testId="button-retry-compass"
  />
  )}
  {!isDemo && (
  <div className="flex items-center justify-between gap-2 mb-3">
  <span
  data-testid="compass-result-source-chip"
  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[hsl(248_62%_52%/0.12)] text-[hsl(248_62%_72%)] border border-[hsl(248_62%_52%/0.25)]"
  >
  {MODE_CHIP_LABEL[resultMode]}
  </span>
  {savedId !== null ? (
  <span
  data-testid="compass-saved-pill"
  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[hsl(142_55%_60%/0.12)] text-[hsl(142_55%_72%)] border border-[hsl(142_55%_60%/0.25)]"
  >
  <Check className="w-3 h-3" />Saved
  </span>
  ) : saveRead.isPending ? (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-muted-foreground border border-white/10">
  <Loader2 className="w-3 h-3 animate-spin" />Saving
  </span>
  ) : null}
  </div>
  )}
  {!isDemo && ctx?.movement && (
  <div
  className="mb-4 rounded-2xl p-4 border border-[hsl(142_55%_60%/0.25)] bg-[hsl(142_55%_60%/0.07)]"
  data-testid="compass-movement"
  >
  <div className="flex items-center gap-2 mb-1">
  <TrendingUp className="w-4 h-4 text-[hsl(142_55%_72%)]" />
  <p className="text-sm font-semibold text-foreground">Since your last read</p>
  <span
  className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${ctx.movement.delta >= 0 ? "text-[hsl(142_55%_72%)] bg-[hsl(142_55%_60%/0.12)]" : "text-[hsl(43_65%_75%)] bg-[hsl(43_65%_65%/0.12)]"}`}
  >
  {ctx.movement.delta > 0 ? `+${ctx.movement.delta}` : ctx.movement.delta} readiness
  </span>
  </div>
  <p className="text-sm text-muted-foreground leading-relaxed">{ctx.movement.note}</p>
  </div>
  )}
  <div className="space-y-4">
  <div className="glass border border-white/8 rounded-2xl p-6">
  <p className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
  <span className="w-2 h-2 rounded-full bg-[hsl(142_55%_60%)]" />Likely supportive traits
  </p>
  <ul className="space-y-2.5">
  {show.supportiveTraits.map((t, i) => <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[hsl(142_55%_60%)] mt-2 flex-shrink-0" />{t}</li>)}
  </ul>
  </div>

  <div className="glass border border-white/8 rounded-2xl p-6">
  <p className="font-semibold text-foreground text-sm mb-2 flex items-center gap-2">
  <span className="w-2 h-2 rounded-full bg-[hsl(43_65%_65%)]" />Your common pull
  </p>
  <p className="text-sm text-muted-foreground leading-relaxed">{show.commonPull}</p>
  </div>

  <div className="glass border border-white/8 rounded-2xl p-6">
  <p className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
  <span className="w-2 h-2 rounded-full bg-[hsl(348_55%_65%)]" />Caution dynamics
  </p>
  <ul className="space-y-2.5">
  {show.cautionDynamics.map((c, i) => <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[hsl(348_55%_65%)] mt-2 flex-shrink-0" />{c}</li>)}
  </ul>
  </div>

  <div className="rounded-2xl p-6 border border-[hsl(248_62%_52%/0.25)] bg-[hsl(248_62%_52%/0.07)]">
  <p className="font-semibold text-foreground text-sm mb-2">Best-supporting dynamic</p>
  <p className="text-sm text-muted-foreground leading-relaxed">{show.bestDynamic}</p>
  </div>

  <div className="glass border border-white/8 rounded-2xl p-6">
  <p className="font-semibold text-foreground text-sm mb-3">Non-negotiables to consider</p>
  <ul className="space-y-2.5">
  {show.nonNegotiables.map((n, i) => <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[hsl(190_55%_60%)] mt-2 flex-shrink-0" />{n}</li>)}
  </ul>
  </div>

  <div className="rounded-2xl p-6 border border-[hsl(43_65%_65%/0.25)] bg-[hsl(43_65%_65%/0.07)]">
  <p className="font-semibold text-foreground text-sm mb-2">False-spark pattern to watch for</p>
  <p className="text-sm text-muted-foreground leading-relaxed">{show.falseSpark}</p>
  </div>

  {!isDemo && ctx?.signalLayer && (
  <div className="glass border border-white/8 rounded-2xl p-6" data-testid="compass-signal-layer">
  <div className="flex items-center justify-between gap-2 mb-3">
  <p className="font-semibold text-foreground text-sm flex items-center gap-2">
  <span className="w-2 h-2 rounded-full bg-[hsl(248_62%_62%)]" />{ctx.signalLayer.headline}
  </p>
  {typeof ctx.readinessScore === "number" && (
  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-[hsl(248_62%_72%)] bg-[hsl(248_62%_52%/0.12)] border border-[hsl(248_62%_52%/0.25)] whitespace-nowrap">
  {ctx.stageLabel ? `${ctx.stageLabel}, ` : ""}{ctx.readinessScore}/100
  </span>
  )}
  </div>
  <ul className="space-y-2.5">
  {ctx.signalLayer.lines.map((l, i) => (
  <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(248_62%_62%)] mt-2 flex-shrink-0" />{l}
  </li>
  ))}
  </ul>
  </div>
  )}
  </div>
  {result && (
  <div className="mt-5 flex justify-center">
  <button onClick={() => { setResult(null); setOwnStyle(""); setPatterns([]); setNotes(""); setPasteText(""); setResultMode("reflection"); setActiveTab("reflection"); }}
  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
  data-testid="button-compass-reset"
  >
  <RefreshCw className="w-3.5 h-3.5" />Start over
  </button>
  </div>
  )}
  {!isDemo && ctx && (
  <div
  className="mt-6 rounded-2xl p-6 border border-[hsl(248_62%_52%/0.25)] bg-[hsl(248_62%_52%/0.07)] space-y-4"
  data-testid="compass-mirror-tiein"
  >
  <div>
  <p className="font-semibold text-foreground text-sm mb-1 flex items-center gap-2">
  <Compass className="w-3.5 h-3.5 text-[hsl(248_62%_72%)]" />This read feeds Your Mirror
  </p>
  <p className="text-sm text-muted-foreground leading-relaxed">{ctx.mirror?.line}</p>
  </div>
  {ctx.nextSignal && (
  <div className="rounded-xl p-4 bg-white/5 border border-white/10">
  <p className="text-[11px] uppercase tracking-wider text-[hsl(248_62%_72%)] font-semibold mb-1">Your next best signal</p>
  <p className="text-sm font-medium text-foreground">{ctx.nextSignal.label}</p>
  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ctx.nextSignal.detail}</p>
  <Link
  href={ctx.nextSignal.href}
  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[hsl(248_62%_72%)] hover:text-foreground"
  data-testid="link-compass-next-signal"
  >
  {ctx.nextSignal.label}<ArrowRight className="w-3 h-3" />
  </Link>
  </div>
  )}
  <Link
  href={ctx.mirror?.href ?? "/your-mirror"}
  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(248_62%_72%)] hover:text-foreground"
  data-testid="link-compass-mirror"
  >
  Open Your Mirror<ArrowRight className="w-3.5 h-3.5" />
  </Link>
  </div>
  )}
  {result && (
  <div className="mt-6">
  <ToolHandoff
  testId="compass-handoff"
  fedLine="This read sharpens what I know about your compatibility, which powers better matches near you."
  steps={[
  { label: "Open Your Mirror", href: "/your-mirror", desc: "See the full picture I keep of you." },
  { label: "See matching", href: "/matching", desc: "How readiness unlocks introductions." },
  { label: "Check your readiness", href: "/me", desc: "Watch your Match Readiness climb." },
  ]}
  />
  </div>
  )}
  </motion.div>
  </AnimatePresence>

  {(history.data?.reads.length ?? 0) > 0 && (
  <motion.section
  {...fadeUp(0.15)}
  className="mt-8 glass border border-white/8 rounded-2xl overflow-hidden"
  data-testid="compass-history"
  >
  <button
  type="button"
  onClick={() => setHistoryOpen(o => !o)}
  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
  aria-expanded={historyOpen}
  >
  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
  <History className="w-4 h-4 text-[hsl(248_62%_62%)]" />
  Your past compass reads
  <span className="text-xs font-normal text-muted-foreground">
  ({history.data?.reads.length ?? 0})
  </span>
  </span>
  <ChevronDown
  className={`w-4 h-4 text-muted-foreground transition-transform ${historyOpen ? "rotate-180" : ""}`}
  />
  </button>
  {historyOpen && (
  <>
  <div className="flex justify-end px-5 py-2 border-t border-white/5">
  <ShareButton
  surface="compass-read"
  variant="pill"
  title="My Compatibility Compass history"
  text={`Been tracking my compatibility patterns on MatchLab Club. ${history.data?.reads.length ?? 0} reads so far and the throughline is real. Try one.`}
  path="/compatibility-compass"
  ref="compass-history-share"
  label="Share my history"
  copiedLabel="Link copied"
  testId="button-share-compass-history"
  />
  </div>
  <ul className="divide-y divide-white/5 border-t border-white/5">
  {(history.data?.reads ?? []).slice(0, 10).map(r => {
  const d = new Date(r.createdAt);
  const dateLabel = Number.isFinite(d.getTime())
  ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  : "";
  const isCurrent = savedId === r.id;
  return (
  <li key={r.id}>
  <button
  type="button"
  onClick={() => loadHistorical(r)}
  className={`w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-white/5 transition-colors ${isCurrent ? "bg-white/5" : ""}`}
  data-testid={`compass-history-item-${r.id}`}
  >
  <div className="min-w-0">
  <p className="text-sm font-medium text-foreground truncate">
  {r.connectionStyle}
  </p>
  <p className="text-xs text-muted-foreground">{dateLabel}</p>
  </div>
  {isCurrent && (
  <span className="text-[10px] uppercase tracking-wider text-[hsl(142_55%_72%)]">
  viewing
  </span>
  )}
  </button>
  </li>
  );
  })}
  </ul>
  </>
  )}
  </motion.section>
  )}
  </div>
  </div>
  </AppLayout>
  );
}
