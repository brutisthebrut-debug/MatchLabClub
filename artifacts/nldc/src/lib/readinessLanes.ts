import {
  Activity,
  BookOpen,
  Brain,
  Calendar,
  CalendarDays,
  Camera,
  Clapperboard,
  Compass,
  Download,
  Film,
  Flag,
  Flame,
  Footprints,
  Globe,
  Heart,
  HelpCircle,
  History,
  Instagram,
  Mail,
  MessageCircle,
  Music2,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import type { MatchReadinessBreakdown } from "@workspace/api-client-react";

export interface BreakdownRow {
  key: keyof MatchReadinessBreakdown;
  label: string;
  blurb: string;
  href: string;
  cta: string;
  icon: typeof Compass;
}

// Every readiness/matching lane, in display order. Single source of truth for
// the matching breakdown and the Match Path explainer so a lane is described
// the same way everywhere. The drift guard below keeps this in lockstep with
// the OpenAPI MatchReadinessBreakdown (which mirrors the server signal registry).
export const BREAKDOWN_ROWS = [
  {
    key: "compass",
    label: "Compass reads",
    blurb: "Five compass reads sharpens what you actually respond to.",
    href: "/compatibility-compass",
    cta: "Run a compass read",
    icon: Compass,
  },
  {
    key: "wellness",
    label: "Wellness map",
    blurb: "Eighteen dimensions covered. The more, the more honest the match.",
    href: "/wellness",
    cta: "Answer a wellness prompt",
    icon: Brain,
  },
  {
    key: "hingeImport",
    label: "Dating app import",
    blurb:
      "A Hinge, Tinder, or Bumble export tells us how you swipe and who swipes back.",
    href: "/imports",
    cta: "Import dating app data",
    icon: Download,
  },
  {
    key: "journal",
    label: "Journal cadence",
    blurb: "Ten entries shows us your patterns, not just one moment.",
    href: "/mirror/journal",
    cta: "Add a journal entry",
    icon: BookOpen,
  },
  {
    key: "postDate",
    label: "Post-date notes",
    blurb: "Three notes after dates is enough to spot what you keep choosing.",
    href: "/mirror/dates",
    cta: "Log a post-date note",
    icon: Calendar,
  },
  {
    key: "wins",
    label: "Dating wins",
    blurb: "Small wins you log show momentum and how you keep showing up.",
    href: "/progress/wins",
    cta: "Log a win",
    icon: Trophy,
  },
  {
    key: "calendar",
    label: "Calendar rhythm",
    blurb:
      "Paste your calendar so we see how full your week is and when you have room to date.",
    href: "/imports",
    cta: "Paste your calendar",
    icon: CalendarDays,
  },
  {
    key: "receipts",
    label: "Receipts inbox",
    blurb:
      "Forward order, booking, and ticket emails so we can read your real-world rhythm. Sender and subject only, never the body.",
    href: "/receipts",
    cta: "Forward a few receipts",
    icon: Mail,
  },
  {
    key: "audits",
    label: "Profile audits",
    blurb: "Each profile audit teaches the engine how you actually show up.",
    href: "/scan",
    cta: "Run a profile audit",
    icon: Camera,
  },
  {
    key: "coaching",
    label: "Message coaching",
    blurb:
      "Coaching a real conversation shows us how you communicate, not just how you describe it.",
    href: "/coach",
    cta: "Coach a conversation",
    icon: MessageCircle,
  },
  {
    key: "instagram",
    label: "Instagram tone",
    blurb:
      "A few captions give us your public-facing voice beyond the dating apps.",
    href: "/me",
    cta: "Share your Instagram tone",
    icon: Instagram,
  },
  {
    key: "lifePulse",
    label: "Life pulse",
    blurb:
      "Quick check-ins on energy and headspace show when you have room to date.",
    href: "/mirror",
    cta: "Log a life pulse",
    icon: Heart,
  },
  {
    key: "taste",
    label: "Taste paste",
    blurb: "Paste what you are into so the machine reads your vibe beyond a bio.",
    href: "/connections/add/taste",
    cta: "Add your taste",
    icon: Sparkles,
  },
  {
    key: "lifestyle",
    label: "Lifestyle paste",
    blurb: "A picture of your week reads as a fuller life to match around.",
    href: "/connections/add/lifestyle",
    cta: "Add your lifestyle",
    icon: Footprints,
  },
  {
    key: "quizzes",
    label: "Quizzes",
    blurb:
      "Each quiz you finish teaches the machine something a profile never shows.",
    href: "/quizzes",
    cta: "Take a quiz",
    icon: HelpCircle,
  },
  {
    key: "music",
    label: "Music taste",
    blurb:
      "Your top artists and tracks read mood and chemistry better than most prompts.",
    href: "/connections/add/music",
    cta: "Add your music",
    icon: Music2,
  },
  {
    key: "film",
    label: "Film taste",
    blurb:
      "The films and shows you love say a lot about your humour and your nights in.",
    href: "/connections/add/film",
    cta: "Add your film taste",
    icon: Film,
  },
  {
    key: "reading",
    label: "Reading taste",
    blurb: "A fuller shelf reads as a fuller inner life to match around.",
    href: "/connections/add/reading",
    cta: "Add your reading",
    icon: BookOpen,
  },
  {
    key: "curiosity",
    label: "Curiosity trail",
    blurb:
      "The rabbit holes that hold your attention show what you would actually talk about.",
    href: "/connections/add/curiosity",
    cta: "Add your interests",
    icon: History,
  },
  {
    key: "vitality",
    label: "Vitality rhythm",
    blurb:
      "The rhythms that keep your energy up help pace a real connection around your week.",
    href: "/connections/add/vitality",
    cta: "Add your rhythm",
    icon: Activity,
  },
  {
    key: "communities",
    label: "Communities you're in",
    blurb:
      "The scenes you gather around, GitHub, Reddit, or Discord, read what you actually care about.",
    href: "/connections",
    cta: "Connect a community",
    icon: Users,
  },
  {
    key: "wyr",
    label: "Would You Rather",
    blurb:
      "Forced two-way tradeoffs reveal what you actually value, faster than any questionnaire.",
    href: "/games/would-you-rather",
    cta: "Answer today's tradeoff",
    icon: Scale,
  },
  {
    key: "dailySpark",
    label: "Daily Spark",
    blurb:
      "One small question a day, answered in your own pace, reveals how you actually move through dating over time.",
    href: "/games/daily-spark",
    cta: "Answer today's spark",
    icon: Sparkles,
  },
  {
    key: "flags",
    label: "Green and red flags",
    blurb:
      "Naming what you bring and what you look for is its own read on your standards and self-awareness.",
    href: "/flags",
    cta: "Pick your flags",
    icon: Flag,
  },
  {
    key: "consistency",
    label: "Daily consistency",
    blurb:
      "Showing up across days, not in one burst, is its own read on follow-through.",
    href: "/your-mirror",
    cta: "Keep your streak going",
    icon: Flame,
  },
  {
    key: "scenarioReels",
    label: "Scenario reels",
    blurb:
      "Real relationship moments reveal how you communicate and handle friction when it actually shows up.",
    href: "/games/scenarios",
    cta: "Play a scenario",
    icon: Clapperboard,
  },
  {
    key: "selfAwareness",
    label: "Predict yourself",
    blurb:
      "Predicting how you will answer, then checking yourself, reveals how well your self-image matches reality.",
    href: "/games/predict",
    cta: "Play a round",
    icon: Target,
  },
  {
    key: "timeCapsule",
    label: "Time capsule",
    blurb:
      "Short notes toward a future partner reveal, in your own words, how clearly you can name what you are looking for.",
    href: "/games/time-capsule",
    cta: "Write a note",
    icon: Mail,
  },
  {
    key: "externalCalibration",
    label: "Wingman perspectives",
    blurb:
      "How friends who know you actually see you, and where that lines up with or diverges from your own self-image.",
    href: "/wingman",
    cta: "Ask a friend",
    icon: Users,
  },
  {
    key: "cosmicProfile",
    label: "Cosmic Compass",
    blurb:
      "A birth chart read as a mirror, not a verdict. What you recognise and reject in it is a soft, gently weighted read on how you see yourself.",
    href: "/cosmic",
    cta: "Open your compass",
    icon: Sparkles,
  },
  {
    key: "relocationOpen",
    label: "Open to meeting further afield",
    blurb:
      "Telling us you are open to people beyond your usual radius lets matching gently widen toward your love-line cities. It only ever adds matches, never narrows them.",
    href: "/cosmic",
    cta: "Set your openness",
    icon: Globe,
  },
  {
    key: "verification",
    label: "Verified profile",
    blurb:
      "Confirming a real phone, selfie, or ID earns a trust badge. Verified profiles rank higher in matching, as a boost and never a gate.",
    href: "/verification",
    cta: "Get verified",
    icon: ShieldCheck,
  },
] satisfies readonly BreakdownRow[];

// Compile-time drift guard: BREAKDOWN_ROWS must cover every readiness lane in
// MatchReadinessBreakdown. Add a lane to the signal registry plus OpenAPI without
// a row here and this stops compiling, so the matching breakdown can never
// silently drop a lane.
type BreakdownRowKey = (typeof BREAKDOWN_ROWS)[number]["key"];
const _allLanesHaveRows: keyof MatchReadinessBreakdown extends BreakdownRowKey
  ? true
  : never = true;
void _allLanesHaveRows;
