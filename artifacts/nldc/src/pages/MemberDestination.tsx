import { AppLayout } from "@/components/layout/AppLayout";
import {
  destinationIdForPath,
  type MemberDestinationId,
} from "@/lib/memberDestinations";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookHeart,
  Brain,
  CalendarCheck,
  CircleUserRound,
  CloudUpload,
  Compass,
  Database,
  FileHeart,
  Gamepad2,
  HeartHandshake,
  Import,
  LockKeyhole,
  MessageCircleHeart,
  MessagesSquare,
  Orbit,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  UserRoundCog,
} from "lucide-react";
import { Link, useLocation } from "wouter";

type HubCard = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

type HubContent = {
  eyebrow: string;
  title: string;
  description: string;
  note: string;
  cards: readonly HubCard[];
};

const HUBS: Record<Exclude<MemberDestinationId, "matches">, HubContent> = {
  today: {
    eyebrow: "Today with Echo",
    title: "One clear place to begin.",
    description:
      "See what matters now, talk it through with Echo, and take the next honest step.",
    note: "Echo guides the work. Pages preserve the record.",
    cards: [
      {
        title: "Talk with Echo",
        description:
          "Bring the question, feeling, or situation that is actually on your mind.",
        href: "/echo",
        icon: MessagesSquare,
      },
      {
        title: "Continue getting known",
        description:
          "Add context or confirm what MatchLab is learning about you.",
        href: "/my-matchlab",
        icon: Brain,
      },
      {
        title: "Handle a conversation",
        description:
          "Think through a reply or rehearse before you send anything.",
        href: "/coach",
        icon: MessageCircleHeart,
      },
      {
        title: "Prepare or reflect",
        description:
          "Get ready for a date, record what happened, or notice what changed.",
        href: "/journey",
        icon: CalendarCheck,
      },
    ],
  },
  "my-matchlab": {
    eyebrow: "My MatchLab",
    title: "The understanding you choose to keep.",
    description:
      "See the portrait taking shape, add useful context, and confirm what belongs in your MatchLab.",
    note:
      "A proposed learning is not part of your MatchLab until you confirm it.",
    cards: [
      {
        title: "Your Mirror",
        description:
          "Review the clearest current picture of your patterns, strengths, and needs.",
        href: "/your-mirror",
        icon: CircleUserRound,
      },
      {
        title: "Profile Project",
        description:
          "Bring together your profile, photos, and the signals you want to send.",
        href: "/start",
        icon: ScanSearch,
      },
      {
        title: "Connection Style",
        description:
          "Explore how you tend to move toward closeness and navigate uncertainty.",
        href: "/connection-style",
        icon: Compass,
      },
      {
        title: "Care Dialect",
        description:
          "Name the ways care feels most recognizable and meaningful to you.",
        href: "/care-dialect",
        icon: HeartHandshake,
      },
      {
        title: "Personal context",
        description:
          "Add or revisit the information Echo can use to understand you.",
        href: "/wellness",
        icon: FileHeart,
      },
    ],
  },
  journey: {
    eyebrow: "Journey",
    title: "Keep the thread, not a score.",
    description:
      "Capture what happened, what you noticed, and what you want to try next.",
    note:
      "Your journey is a private record of learning. It is not a grade on your worth.",
    cards: [
      {
        title: "Journal",
        description:
          "Write what is true now and keep reflections in one dependable place.",
        href: "/mirror/journal",
        icon: BookHeart,
      },
      {
        title: "Dates",
        description:
          "Prepare for a date or record what you learned after meeting.",
        href: "/mirror/dates",
        icon: CalendarCheck,
      },
      {
        title: "Timeline",
        description:
          "Look back across moments, reflections, experiments, and changes.",
        href: "/progress/timeline",
        icon: Orbit,
      },
      {
        title: "Wins",
        description:
          "Keep the moments that felt brave, clear, kind, or genuinely different.",
        href: "/progress/wins",
        icon: Trophy,
      },
      {
        title: "Debrief with Echo",
        description:
          "Make sense of what happened without rushing to a verdict.",
        href: "/copilot/debrief",
        icon: MessagesSquare,
      },
      {
        title: "Weekly reflection",
        description:
          "Choose a small experiment and return to what it teaches you.",
        href: "/copilot/weekly-plan",
        icon: SlidersHorizontal,
      },
    ],
  },
  play: {
    eyebrow: "Play",
    title: "Learn through curiosity.",
    description:
      "Use small, low-pressure experiences to notice preferences, instincts, and surprises.",
    note:
      "Play can create a question or insight. You decide whether it becomes part of your MatchLab.",
    cards: [
      {
        title: "Quiz Lab",
        description:
          "Explore a question with a short guided quiz and save only the result.",
        href: "/quizzes",
        icon: Gamepad2,
      },
      {
        title: "This or That",
        description:
          "Choose quickly and notice the pattern behind your first instinct.",
        href: "/this-or-that",
        icon: Sparkles,
      },
      {
        title: "Would You Rather",
        description:
          "Compare tradeoffs and learn what matters when both choices have weight.",
        href: "/games/would-you-rather",
        icon: Compass,
      },
      {
        title: "Daily Spark",
        description:
          "Try one small prompt that makes room for curiosity today.",
        href: "/games/daily-spark",
        icon: Orbit,
      },
      {
        title: "Scenarios",
        description:
          "Explore how you might respond when a connection becomes more real.",
        href: "/games/scenarios",
        icon: MessageCircleHeart,
      },
      {
        title: "Time Capsule",
        description:
          "Leave a thought for your future self and return to it later.",
        href: "/games/time-capsule",
        icon: LockKeyhole,
      },
    ],
  },
  "trust-data": {
    eyebrow: "Trust & Data",
    title: "Your information stays under your control.",
    description:
      "Review what is stored, where it came from, and which uses you have allowed.",
    note:
      "Saving a source, allowing Echo use, confirming a learning, and allowing matching use are separate choices.",
    cards: [
      {
        title: "Connections",
        description:
          "See connected sources and choose what you want to bring into MatchLab.",
        href: "/connections",
        icon: CloudUpload,
      },
      {
        title: "Imports",
        description:
          "Review imported sources and set storage, Echo, learning, and matching permissions.",
        href: "/imports",
        icon: Import,
      },
      {
        title: "Data Vault",
        description:
          "See the information MatchLab is keeping for you.",
        href: "/vault",
        icon: Database,
      },
      {
        title: "User Control",
        description:
          "Review consent, privacy, and the controls connected to your experience.",
        href: "/user-control",
        icon: ShieldCheck,
      },
      {
        title: "Account",
        description:
          "Manage account details, exports, sessions, and deletion.",
        href: "/account",
        icon: UserRoundCog,
      },
    ],
  },
};

function DestinationCard({ card }: { card: HubCard }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      className="group flex min-h-44 flex-col rounded-3xl border border-foreground/10 bg-background/65 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[hsl(248_62%_52%/0.35)] hover:shadow-lg"
    >
      <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(248_62%_52%/0.1)] text-[hsl(248_62%_52%)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="font-serif text-xl font-bold tracking-tight text-foreground">
        {card.title}
      </h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
        {card.description}
      </p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(248_62%_52%)]">
        Open
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

export default function MemberDestination() {
  const [location] = useLocation();
  const id = destinationIdForPath(location);
  const hubId =
    id && id !== "matches" ? id : ("today" as const);
  const hub = HUBS[hubId];

  return (
    <AppLayout>
      <div className="relative isolate flex-1 overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-44 h-[34rem] w-[34rem] rounded-full bg-[hsl(326_100%_59%/0.09)] blur-3xl" />
        <div className="pointer-events-none absolute -left-48 top-48 h-[30rem] w-[30rem] rounded-full bg-[hsl(248_62%_52%/0.1)] blur-3xl" />

        <div className="relative mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <header className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[hsl(248_62%_52%)]">
              {hub.eyebrow}
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
              {hub.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              {hub.description}
            </p>
          </header>

          <div className="mt-9 rounded-2xl border border-[hsl(248_62%_52%/0.18)] bg-[hsl(248_62%_52%/0.06)] px-5 py-4 text-sm leading-6 text-foreground/75">
            {hub.note}
          </div>

          <section
            className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label={`${hub.eyebrow} actions`}
          >
            {hub.cards.map((card) => (
              <DestinationCard key={card.href} card={card} />
            ))}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
