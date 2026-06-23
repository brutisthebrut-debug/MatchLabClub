import {
  Activity,
  ImageUp,
  ScanSearch,
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
  Beaker,
  ListChecks,
  MessagesSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type HubTab = { name: string; href: string; icon: LucideIcon };
export type HubId = "audit" | "mirror" | "messages" | "growth";
export type HubDef = { id: HubId; label: string; tabs: HubTab[] };

// One unified sub-nav per cluster. Legacy routes stay live as tabs (orphan
// nothing). The sidebar keeps the full index; this strip is the curated,
// in-context way to move between sibling tools so a cluster reads as one hub.
export const HUBS: Record<HubId, HubDef> = {
  audit: {
    id: "audit",
    label: "Signal Audit",
    tabs: [
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
      { name: "Journal", href: "/mirror/journal", icon: BookOpen },
      { name: "Post-Date Notes", href: "/mirror/dates", icon: CalendarHeart },
    ],
  },
  messages: {
    id: "messages",
    label: "Message Studio",
    tabs: [
      { name: "Coach", href: "/coach", icon: MessageCircle },
      { name: "Next Message", href: "/next-message", icon: PenLine },
      { name: "Chemistry Lab", href: "/lab", icon: FlaskConical },
      { name: "Wingman Studio", href: "/copilot", icon: Bot },
      { name: "Rehearsal", href: "/rehearsal", icon: Theater },
      { name: "Wingman", href: "/wingman", icon: Users },
    ],
  },
  growth: {
    id: "growth",
    label: "Growth Center",
    tabs: [
      { name: "Readiness", href: "/progress/readiness", icon: Gauge },
      { name: "Scorecard", href: "/progress/scorecard", icon: ClipboardCheck },
      { name: "Wins", href: "/progress/wins", icon: Trophy },
      { name: "Timeline", href: "/progress/timeline", icon: History },
      { name: "Patterns", href: "/progress/patterns", icon: Layers },
      { name: "Experiments", href: "/progress/experiments", icon: Beaker },
      { name: "Follow-Up", href: "/progress/followup", icon: ListChecks },
      { name: "Companion", href: "/progress/companion", icon: MessagesSquare },
    ],
  },
};
