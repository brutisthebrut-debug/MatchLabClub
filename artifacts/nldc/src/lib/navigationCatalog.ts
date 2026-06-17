import { Sparkles, BookOpen, MessageSquare, TrendingUp, FlaskConical, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Tool = { name: string; href: string; desc?: string };

export type Package = {
  id: "start" | "blueprint" | "messages" | "growth" | "founder" | "trust";
  label: string;
  tagline: string;
  color: string;
  icon: LucideIcon;
  tools: Tool[];
  more: Tool[];
  hubHref: string;
  hubLabel: string;
  activeHrefs: string[];
};

export const PACKAGES: Package[] = [
  {
    id: "start",
    label: "Start Here",
    tagline: "Your first 3 minutes: get a real read",
    color: "hsl(var(--brand-indigo))",
    icon: Sparkles,
    tools: [
      { name: "Get your Signal Audit", href: "/start",         desc: "Begin here: 3-min intake wizard" },
      { name: "Signal Check",          href: "/signal-check",  desc: "Quick read: instant profile score" },
      { name: "Photo Scan",            href: "/scan",          desc: "Upload a photo, get a fast read" },
      { name: "Dating Signal Quiz",    href: "/quiz",          desc: "8 questions → your dating archetype" },
    ],
    more: [
      { name: "Profile Reader",   href: "/profile-reader" },
    ],
    hubHref: "/start",
    hubLabel: "Begin your Signal Audit",
    activeHrefs: ["/start", "/signal-check", "/scan", "/quiz", "/diagnosis", "/profile-reader"],
  },
  {
    id: "blueprint",
    label: "The Reset",
    tagline: "Build a profile that actually reads as you",
    color: "hsl(var(--brand-gold))",
    icon: BookOpen,
    tools: [
      { name: "Dating Blueprint",       href: "/blueprint", desc: "Your personalized dating action plan" },
      { name: "Profile Glow-Up",        href: "/glow-up",   desc: "10 bio rewrites for any platform" },
      { name: "Profile Reflection",         href: "/mirror",    desc: "See yourself the way others do" },
      { name: "Before & After Gallery", href: "/gallery",   desc: "Real before/after profile examples" },
    ],
    more: [
      { name: "Dating Archetype",      href: "/archetype" },
      { name: "Connection Style",      href: "/connection-style" },
      { name: "Care Dialect",          href: "/care-dialect" },
      { name: "Compatibility Compass", href: "/compatibility-compass" },
    ],
    hubHref: "/blueprint",
    hubLabel: "Build your Blueprint",
    activeHrefs: ["/blueprint", "/glow-up", "/mirror", "/gallery", "/archetype", "/connection-style", "/care-dialect", "/compatibility-compass"],
  },
  {
    id: "messages",
    label: "Message Tools",
    tagline: "Write better messages, connect faster",
    color: "hsl(190 55% 60%)",
    icon: MessageSquare,
    tools: [
      { name: "Message Coach",    href: "/coach",         desc: "Coached replies for any conversation" },
      { name: "Next Message",     href: "/next-message",  desc: "7 copy-ready options for any situation" },
      { name: "Flirt Coach",      href: "/copilot/flirt", desc: "Draft messages for any moment" },
      { name: "Style Map",        href: "/style-map",     desc: "9 dimensions of your communication style" },
      { name: "Import Patterns",  href: "/insights",      desc: "Analyse style from your message history" },
    ],
    more: [
      { name: "Chemistry Lab",      href: "/lab" },
      { name: "Help Me Reply",      href: "/copilot/reply" },
      { name: "Improve My Profile", href: "/copilot/profile" },
      { name: "Wingman Copilot",    href: "/copilot" },
    ],
    hubHref: "/lab",
    hubLabel: "View all Message tools",
    activeHrefs: ["/coach", "/lab", "/next-message", "/insights", "/style-map", "/copilot"],
  },
  {
    id: "growth",
    label: "Growth Tracker",
    tagline: "Track what's actually changing over time",
    color: "hsl(var(--brand-green))",
    icon: TrendingUp,
    tools: [
      { name: "Dating Wins Log",    href: "/progress/wins",            desc: "Log moments of courage and progress" },
      { name: "Pattern Breaker",    href: "/progress/pattern-breaker", desc: "5 actions to shift this week" },
      { name: "Weekly Growth Plan", href: "/copilot/weekly-plan",      desc: "A structured plan for the next 7 days" },
      { name: "Progress Scorecard", href: "/progress/scorecard",       desc: "7 growth dimensions with trend arrows" },
      { name: "Post-Date Reflect",  href: "/reflection",               desc: "Pursue / pause / pass read" },
    ],
    more: [
      { name: "My Timeline",         href: "/progress/timeline" },
      { name: "Pattern Board",       href: "/progress/patterns" },
      { name: "Weekly Experiments",  href: "/progress/experiments" },
      { name: "Follow-Up Check",     href: "/progress/followup" },
      { name: "Readiness Guide",     href: "/progress/readiness" },
      { name: "Companion Workspace", href: "/progress/companion" },
      { name: "What Changed?",       href: "/copilot/what-changed" },
      { name: "Debrief",             href: "/copilot/debrief" },
    ],
    hubHref: "/progress/timeline",
    hubLabel: "View all Growth tools",
    activeHrefs: ["/progress", "/copilot/weekly-plan", "/copilot/what-changed", "/copilot/debrief", "/reflection"],
  },
  {
    id: "founder",
    label: "Founder & Beta",
    tagline: "Plans, sample report, waitlist, and how to help us shape the beta",
    color: "hsl(326 100% 62%)",
    icon: FlaskConical,
    tools: [
      { name: "Plans & Pricing",    href: "/pricing",       desc: "Three tiers, launch perks, no surprises" },
      { name: "Sample Report",      href: "/sample-report", desc: "See a full Dating Reset Report before you decide" },
      { name: "The Journal",        href: "/blog",          desc: "Dating science and profile psychology articles" },
      { name: "Join the Waitlist",  href: "/waitlist",      desc: "Be first when new paid tiers open" },
      { name: "Beta Feedback",      href: "/feedback",      desc: "Tell us what's working and what isn't" },
    ],
    more: [
      { name: "Product Roadmap", href: "/roadmap" },
    ],
    hubHref: "/pricing",
    hubLabel: "See plans & founder offer",
    activeHrefs: ["/pricing", "/waitlist", "/sample-report", "/feedback", "/roadmap"],
  },
  {
    id: "trust",
    label: "Context & Trust",
    tagline: "What we know about you, and what you control",
    color: "hsl(228 30% 62%)",
    icon: Shield,
    tools: [
      { name: "Wellness Center",   href: "/wellness",      desc: "8 dimensions of your readiness" },
      { name: "Data Vault",        href: "/vault",         desc: "Preview, export, or delete your data" },
      { name: "Connection Center", href: "/connections",   desc: "Bring in context, on your terms" },
      { name: "Data Imports",      href: "/imports",       desc: "Bring in your Hinge history for a real read" },
      { name: "User Control",      href: "/user-control",  desc: "Approve, edit, export, or delete" },
      { name: "Privacy Policy",    href: "/privacy",       desc: "How we handle your data" },
    ],
    more: [
      { name: "Life Context", href: "/life-context" },
      { name: "Integrations", href: "/integrations" },
      { name: "Account",      href: "/account" },
    ],
    hubHref: "/wellness",
    hubLabel: "View all Settings & Trust",
    activeHrefs: ["/wellness", "/vault", "/connections", "/imports", "/life-context", "/user-control", "/integrations", "/privacy", "/feedback", "/account"],
  },
];
