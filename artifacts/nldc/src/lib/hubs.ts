import {
  Activity,
  ImageUp,
  ScanSearch,
  ClipboardList,
  Eye,
  Brain,
  Aperture,
  BookOpen,
  CalendarHeart,
  MessageCircle,
  PenLine,
  FlaskConical,
  Bot,
  Theater,
  Users,
  Gauge,
  ClipboardCheck,
  Trophy,
  History,
  Layers,
  LineChart,
  Compass,
  NotebookPen,
  Flag,
  Rss,
  Settings2,
  Route,
  CalendarDays,
  GitCompare,
  Lightbulb,
  Shapes,
  HeartHandshake,
  HandHeart,
  Gamepad2,
  Split,
  Scale,
  Flame,
  Target,
  Drama,
  Hourglass,
  Sparkles,
  Network,
  Map,
  Upload,
  Receipt,
  NotebookText,
  Mic,
  Lock,
  SlidersHorizontal,
  HeartPulse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type HubTab = { name: string; href: string; icon: LucideIcon };
export type HubId =
  | "audit"
  | "mirror"
  | "messages"
  | "growth"
  | "journal"
  | "games"
  | "connections";
export type HubDef = { id: HubId; label: string; tabs: HubTab[] };

// One unified sub-nav per cluster. Legacy routes stay live as tabs (orphan
// nothing). The sidebar keeps the full index; this strip is the curated,
// in-context way to move between sibling tools so a cluster reads as one hub.
// HubId values are stable internal keys (they feed tests/telemetry); the
// `label` is the only user-facing name and is safe to relabel. The "growth"
// id intentionally keeps its key while presenting as "Progress".
export const HUBS: Record<HubId, HubDef> = {
  audit: {
    id: "audit",
    label: "Signal Audit",
    tabs: [
      { name: "Full Audit", href: "/start", icon: ClipboardList },
      { name: "Signal Check", href: "/signal-check", icon: Activity },
      { name: "Photo Scan", href: "/scan", icon: ImageUp },
      { name: "Profile Reader", href: "/profile-reader", icon: ScanSearch },
    ],
  },
  mirror: {
    id: "mirror",
    label: "Your Mirror",
    tabs: [
      { name: "Overview", href: "/your-mirror", icon: Eye },
      { name: "Self Hub", href: "/me", icon: Brain },
      { name: "Profile Reflection", href: "/mirror", icon: Aperture },
      { name: "Archetype", href: "/archetype", icon: Shapes },
      { name: "Connection Style", href: "/connection-style", icon: HeartHandshake },
      { name: "Care Dialect", href: "/care-dialect", icon: HandHeart },
    ],
  },
  messages: {
    id: "messages",
    label: "Message Studio",
    tabs: [
      { name: "Coach", href: "/coach", icon: MessageCircle },
      { name: "Next Message", href: "/next-message", icon: PenLine },
      { name: "Insights", href: "/insights", icon: LineChart },
      { name: "Style Map", href: "/style-map", icon: Compass },
      { name: "Chemistry Lab", href: "/lab", icon: FlaskConical },
      { name: "Rehearsal", href: "/rehearsal", icon: Theater },
      { name: "Wingman Studio", href: "/copilot", icon: Bot },
      { name: "Wingman", href: "/wingman", icon: Users },
    ],
  },
  growth: {
    id: "growth",
    label: "Progress",
    tabs: [
      { name: "Readiness", href: "/progress/readiness", icon: Gauge },
      { name: "Scorecard", href: "/progress/scorecard", icon: ClipboardCheck },
      { name: "Milestones", href: "/milestones", icon: Flag },
      { name: "Timeline", href: "/progress/timeline", icon: History },
      { name: "Patterns", href: "/progress/patterns", icon: Layers },
      { name: "Feed", href: "/progress/feed", icon: Rss },
      { name: "Control", href: "/progress/control", icon: Settings2 },
      { name: "Insights Roadmap", href: "/progress/insights-roadmap", icon: Route },
      { name: "Weekly Plan", href: "/copilot/weekly-plan", icon: CalendarDays },
      { name: "What Changed", href: "/copilot/what-changed", icon: GitCompare },
      { name: "Reflection", href: "/reflection", icon: Lightbulb },
    ],
  },
  journal: {
    id: "journal",
    label: "Journal",
    tabs: [
      { name: "Journal", href: "/mirror/journal", icon: BookOpen },
      { name: "Post-Date Notes", href: "/mirror/dates", icon: CalendarHeart },
      { name: "Wins Log", href: "/progress/wins", icon: Trophy },
      { name: "Debrief", href: "/copilot/debrief", icon: NotebookPen },
    ],
  },
  games: {
    id: "games",
    label: "Games",
    tabs: [
      { name: "Quiz", href: "/quiz", icon: Gamepad2 },
      { name: "This or That", href: "/this-or-that", icon: Split },
      { name: "Would You Rather", href: "/games/would-you-rather", icon: Scale },
      { name: "Daily Spark", href: "/play?game=daily-spark", icon: Flame },
      { name: "Predict", href: "/play?game=predict", icon: Target },
      { name: "Scenarios", href: "/play?game=scenarios", icon: Drama },
      { name: "Time Capsule", href: "/games/time-capsule", icon: Hourglass },
      { name: "Cosmic", href: "/cosmic", icon: Sparkles },
    ],
  },
  connections: {
    id: "connections",
    label: "Connection Center",
    tabs: [
      { name: "Overview", href: "/connections", icon: Network },
      { name: "Platform Map", href: "/integrations", icon: Map },
      { name: "Imports", href: "/imports", icon: Upload },
      { name: "Receipts", href: "/receipts", icon: Receipt },
      { name: "Life Context", href: "/life-context", icon: NotebookText },
      { name: "Voice Intro", href: "/voice-intro", icon: Mic },
      { name: "Vault", href: "/vault", icon: Lock },
      { name: "Controls", href: "/user-control", icon: SlidersHorizontal },
      { name: "Wellness", href: "/wellness", icon: HeartPulse },
    ],
  },
};
