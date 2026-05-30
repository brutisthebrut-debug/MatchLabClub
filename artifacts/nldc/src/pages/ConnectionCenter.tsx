import { withAlpha } from "@/lib/brandColor";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import {
  Flame,
  Instagram,
  MessageSquare,
  Camera,
  HeartPulse,
  Mail,
  Wallet,
  CalendarDays,
  Music2,
  Activity,
  History,
  Lock,
  Shield,
  ArrowRight,
  CheckCircle,
  Wrench,
  FlaskConical,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type Status = "live" | "building" | "researching";

const STATUS_META: Record<Status, { label: string; color: string }> = {
  live:        { label: "Live",        color: "hsl(142 55% 60%)" },
  building:    { label: "Building",    color: "hsl(var(--brand-indigo))" },
  researching: { label: "Researching", color: "hsl(43 65% 65%)" },
};

type Connector = {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  blurb: string;
  returns: string;
  access?: string[];
  excludes?: string[];
  cta?: { href: string; label: string };
  comingNote?: string;
  /** How this source moves the Match Readiness meter, when it fills a lane. */
  readiness?: string;
};

// Sources you can plug in right now. Every CTA points to a real working page.
const LIVE: Connector[] = [
  {
    id: "hinge-zip",
    title: "Hinge GDPR ZIP",
    icon: Flame,
    color: "hsl(348 75% 60%)",
    blurb:
      "Drop in the ZIP from Hinge (Settings, Download My Data). We read your prompts, likes, and matches and build a pattern map you can actually use.",
    returns: "A pattern read of how you write, who you like, and where your tempo drops off.",
    cta: { href: "/imports", label: "Open Hinge import" },
    readiness: "Fills the Hinge import lane of your Match Readiness in a single drop.",
  },
  {
    id: "instagram-paste",
    title: "Instagram tone paste",
    icon: Instagram,
    color: "hsl(326 70% 60%)",
    blurb:
      "Paste your bio and your three most recent captions. We compare your IG voice to your dating-app voice and flag where the two are saying different things about you.",
    returns: "A side-by-side of your platform voice vs your real voice.",
    cta: { href: "/me", label: "Open in Self Hub" },
  },
  {
    id: "message-paste",
    title: "Message paste",
    icon: MessageSquare,
    color: "hsl(190 55% 60%)",
    blurb:
      "Paste any thread (Hinge, Bumble, Tinder, iMessage screenshot transcribed). Chemistry Lab returns five reply options scored on warmth, directness, and pace.",
    returns: "Five coached replies plus a read of how the thread is actually going.",
    cta: { href: "/coach", label: "Open Message Coach" },
  },
  {
    id: "photo-scan",
    title: "Photo scan",
    icon: Camera,
    color: "hsl(212 70% 55%)",
    blurb:
      "Upload one profile photo. We read composition, expression, group density, and what it says about the kind of person you read as.",
    returns: "A photo critique and a single specific change that lifts the read.",
    cta: { href: "/scan", label: "Open Photo Scan" },
  },
  {
    id: "wellness",
    title: "Wellness questionnaire",
    icon: HeartPulse,
    color: "hsl(var(--brand-green))",
    blurb:
      "Eighteen self-report dimensions across communication, conflict, attachment, values, and pace. The deepest signal you can give us without plugging in any third party.",
    returns: "A readiness map that sharpens every other tool in the product.",
    cta: { href: "/wellness", label: "Open Wellness Center" },
    readiness: "The single largest lane of your Match Readiness. The more you answer, the more the machine can match you.",
  },
  {
    id: "calendar-ics",
    title: "Calendar paste",
    icon: CalendarDays,
    color: "hsl(248 62% 60%)",
    blurb:
      "Paste the contents of your calendar's .ics export. We read event times and recurrence to surface your free nights, your weekend rhythm, and recurring rituals. Read only. We never write to your calendar and we never store the raw file.",
    returns: "A picture of when you are actually free and what your week tends to look like.",
    access: [
      "Event titles, times, and recurrence patterns from the .ics text you paste",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Google or Apple Calendar",
      "Any ability to create, edit, or delete events on your calendar",
    ],
    cta: { href: "/imports", label: "Open Calendar paste" },
  },
  {
    id: "matching-cohort",
    title: "Matching cohort",
    icon: Users,
    color: "hsl(326 100% 62%)",
    blurb:
      "Opt in to the private intro pool once your signals say you are ready. We hold your spot, count how many people near you are also building a profile, and route Wingman members to founder-curated intros. Off by default. One switch removes you and stops any future intro.",
    returns: "A spot in the intro pool plus a readiness read that shows what is still thin.",
    access: [
      "Your match preferences and the readiness score built from signals you already gave us",
      "Your city hint, used only to count how many nearby people are also in the pool",
    ],
    excludes: [
      "Any intro before your readiness clears the threshold",
      "Your identity shown to anyone without your yes",
      "Any swipe feed, public profile, or infinite scroll",
    ],
    cta: { href: "/matching", label: "Open Matching" },
    readiness: "The payoff lane. This is what every other source has been building toward.",
  },
];

// What we're actively building, in roughly the order we'll ship.
const BUILDING: Connector[] = [
  {
    id: "forwarding-inbox",
    title: "Forwarding inbox",
    icon: Mail,
    color: "hsl(326 100% 62%)",
    blurb:
      "Your own private address at receipts.matchlab.club. You forward Hinge renewals, OpenTable confirmations, DoorDash receipts, Airbnb bookings. We read subject lines, senders, and timestamps. Never the body.",
    returns:
      "An honest read of your subscription stack, travel rhythm, and dating-app cadence, refreshed automatically.",
    access: [
      "Subject lines and sender domains of mail you forward to us",
      "The date and time each forwarded message arrived",
    ],
    excludes: [
      "The body of any email, ever",
      "Anything in your inbox you do not explicitly forward",
      "Access to your Gmail or Outlook account",
    ],
    comingNote: "Beat 2 of the connection roadmap. Mailbox infrastructure standing up next.",
  },
  {
    id: "plaid",
    title: "Plaid spending signals",
    icon: Wallet,
    color: "hsl(142 55% 55%)",
    blurb:
      "Connect a bank or card through Plaid. We categorise spending into rhythm signals (food, travel, going out, gym, dating-app subscriptions) and return three things your spending says about how you actually date.",
    returns:
      "A second-brain read on spending tempo, subscription overlap, and the rhythm of your social vs solo nights.",
    access: [
      "Transaction categories and amounts on accounts you connect",
      "Merchant names where they help classify a signal",
    ],
    excludes: [
      "Your account balances or net worth",
      "Account or routing numbers",
      "Any transaction we cannot map to a category we already use",
    ],
    comingNote: "Beat 3 of the connection roadmap. Lands after the forwarding inbox.",
  },
  {
    id: "spotify",
    title: "Spotify",
    icon: Music2,
    color: "hsl(141 73% 42%)",
    blurb:
      "One-click Spotify connect. We read top artists, recently played, and saved tracks. Music taste turns out to predict conversation chemistry better than most prompt answers.",
    returns: "A vibe signal that feeds compatibility reads and date-prep suggestions.",
    access: [
      "Top artists and tracks across short, medium, and long-term windows",
      "Recently played tracks",
      "Your saved track and album library",
    ],
    excludes: [
      "Anything you have played in private listening sessions",
      "Your playlists you have not chosen to share",
      "Any ability to play, queue, or change what you are listening to",
    ],
    comingNote: "Sequenced behind the spending connector.",
  },
];

const RESEARCHING: Connector[] = [
  {
    id: "apple-health",
    title: "Apple Health export",
    icon: Activity,
    color: "hsl(348 70% 60%)",
    blurb:
      "Same drop-the-ZIP pattern as Hinge. Apple Health lets you export your data archive. Sleep, workouts, and step rhythm tell us a lot about energy and social cadence. Research question: which signals are durable and which are noise.",
    returns: "If it lands, an energy and rhythm read that informs date pacing.",
  },
  {
    id: "google-takeout",
    title: "Google Takeout history",
    icon: History,
    color: "hsl(207 70% 45%)",
    blurb:
      "Google lets you download Location History, Search History, and YouTube history as a ZIP. High signal if a user is willing to share it. Research question: how do we surface anything useful here without making it feel invasive.",
    returns: "Where you actually go, what you are actually curious about, and the rhythm of both.",
  },
  {
    id: "messaging-e2ee",
    title: "WhatsApp and iMessage",
    icon: MessageSquare,
    color: "hsl(142 55% 55%)",
    blurb:
      "End-to-end encrypted by design. We are researching on-device processing so message tone analysis happens without anything leaving your phone. Open question: can we deliver useful coaching while honouring the E2EE contract.",
    returns: "If it lands, the most accurate tone read in the product.",
  },
];

function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
      style={{
        background: withAlpha(meta.color, 0.12),
        color: meta.color,
        border: `1px solid ${withAlpha(meta.color, 0.3)}`,
      }}
      data-testid={`badge-status-${status}`}
    >
      {status === "live" && <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />}
      {meta.label}
    </span>
  );
}

function ConnectorCard({
  card,
  status,
  index,
}: {
  card: Connector;
  status: Status;
  index: number;
}) {
  const testId = `connector-${status}-${card.id}`;
  const Icon = card.icon;
  return (
    <motion.div
      {...fadeUp(0.04 + index * 0.04)}
      className="glass border border-white/8 rounded-2xl p-5 flex flex-col gap-3 hover:border-white/15 transition-colors"
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: withAlpha(card.color, 0.14),
            border: `1px solid ${withAlpha(card.color, 0.25)}`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: card.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-semibold text-foreground text-sm leading-snug">{card.title}</p>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{card.blurb}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white/3 border border-white/6 px-3 py-2.5 flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--brand-gold))] flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground/85 leading-relaxed">
          <strong className="text-foreground/80">What you get back: </strong>
          {card.returns}
        </p>
      </div>

      {(card.access || card.excludes) && (
        <div className="grid sm:grid-cols-2 gap-2.5">
          {card.access && (
            <div className="rounded-xl border border-[hsl(142_55%_60%/0.2)] bg-[hsl(142_55%_45%/0.06)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(142_55%_62%)] mb-1.5 flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3" /> What we'll see
              </p>
              <ul className="space-y-1">
                {card.access.map((item) => (
                  <li key={item} className="text-[11px] text-muted-foreground leading-snug flex gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[hsl(142_55%_60%)] mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {card.excludes && (
            <div className="rounded-xl border border-[hsl(348_55%_65%/0.2)] bg-[hsl(348_55%_55%/0.06)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(348_55%_72%)] mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> What we'll never touch
              </p>
              <ul className="space-y-1">
                {card.excludes.map((item) => (
                  <li key={item} className="text-[11px] text-muted-foreground leading-snug flex gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[hsl(348_55%_65%)] mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {card.readiness && (
        <div
          className="rounded-xl px-3 py-2.5 flex items-start gap-2"
          style={{
            background: withAlpha("hsl(var(--brand-green))", 0.08),
            border: `1px solid ${withAlpha("hsl(var(--brand-green))", 0.22)}`,
          }}
          data-testid={`readiness-${card.id}`}
        >
          <Activity className="w-3.5 h-3.5 text-[hsl(var(--brand-green))] flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground/85 leading-relaxed">
            <strong className="text-[hsl(var(--brand-green))]">Match Readiness: </strong>
            {card.readiness}
          </p>
        </div>
      )}

      {card.comingNote && (
        <p className="text-[11px] text-[hsl(var(--brand-indigo))] leading-relaxed italic">
          {card.comingNote}
        </p>
      )}

      {card.cta && (
        <Link
          href={card.cta.href}
          className="inline-flex items-center gap-1 self-start text-xs font-semibold text-[hsl(248_62%_62%)] hover:text-[hsl(248_62%_72%)]"
          data-testid={`link-${testId}`}
        >
          {card.cta.label} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </motion.div>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  accent,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: withAlpha(accent, 0.14), border: `1px solid ${withAlpha(accent, 0.25)}` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
          {eyebrow}
        </p>
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>
    </div>
  );
}

export default function ConnectionCenter() {
  useMeta(
    "Connection Center",
    "Plug things in. Every connection returns an insight you weren't expecting. Subject lines only, never the body. Read only, never write. Your data, your control.",
  );

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[420px] h-[420px] -top-24 -right-16 opacity-30 pointer-events-none" />
        <div className="orb orb-gold fixed w-[300px] h-[300px] bottom-10 -left-20 opacity-25 pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10">
          {/* Hero */}
          <motion.div {...fadeUp(0)} className="mb-8 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-[hsl(248_62%_52%/0.25)] mb-4">
              <Sparkles className="w-3.5 h-3.5 text-[hsl(248_62%_62%)]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(248_62%_62%)]">
                Connection Center
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              Plug things in. Get back what you didn't expect.
            </h1>
            <p className="text-base text-muted-foreground mt-3 max-w-2xl leading-relaxed">
              Every source you plug in returns a small read of who you actually are when no one is watching, and feeds one rising Match Readiness meter. Some sources fill a readiness lane directly, all of them sharpen the reads matching runs on. The more the machine knows you, the better it matches you. Each one is opt-in, each one shows you exactly what we'll see and what we'll never touch, each one can be removed in one click.
            </p>
          </motion.div>

          {/* Privacy promise */}
          <motion.div
            {...fadeUp(0.04)}
            className="mb-10 flex items-start gap-3 px-4 py-3.5 rounded-xl glass border border-white/8"
            data-testid="connections-privacy-promise"
          >
            <Shield className="w-4 h-4 text-[hsl(142_55%_60%)] flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">Your data, your control</p>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                Read only on every source. We never post, write, or send anything from your accounts. Sensitive surfaces (mail, bank) are subject-line and category-level only, never the underlying content. One toggle removes any source and purges its data.
              </p>
            </div>
          </motion.div>

          {/* Quick legend */}
          <motion.div {...fadeUp(0.06)} className="flex flex-wrap items-center gap-2 mb-10">
            <StatusBadge status="live" />
            <span className="text-[11px] text-muted-foreground">Working today.</span>
            <span className="text-white/15">·</span>
            <StatusBadge status="building" />
            <span className="text-[11px] text-muted-foreground">In active build, sequenced.</span>
            <span className="text-white/15">·</span>
            <StatusBadge status="researching" />
            <span className="text-[11px] text-muted-foreground">Open question, real research in progress.</span>
          </motion.div>

          {/* Plugged in today */}
          <section className="mb-12">
            <SectionHeader
              icon={CheckCircle}
              eyebrow="Plugged in today"
              title="Sources you can use right now"
              subtitle="Each of these returns a real read in the product today. No API gate, no waitlist."
              accent="hsl(142 55% 60%)"
            />
            <div className="grid gap-4 md:grid-cols-2">
              {LIVE.map((card, i) => (
                <ConnectorCard key={card.id} card={card} status="live" index={i} />
              ))}
            </div>
          </section>

          {/* Building */}
          <section className="mb-12">
            <SectionHeader
              icon={Wrench}
              eyebrow="In active build"
              title="What's coming, in order"
              subtitle="The roadmap, with the full data contract upfront. Each one ships standing alone. You'll see them light up here as they land."
              accent="hsl(var(--brand-indigo))"
            />
            <div className="grid gap-4">
              {BUILDING.map((card, i) => (
                <ConnectorCard key={card.id} card={card} status="building" index={i} />
              ))}
            </div>
          </section>

          {/* Researching */}
          <section className="mb-12">
            <SectionHeader
              icon={FlaskConical}
              eyebrow="Researching"
              title="Open questions we're still answering"
              subtitle="Sources where the signal is real but the privacy contract or the API shape isn't there yet. We won't ship anything we can't honour."
              accent="hsl(43 65% 65%)"
            />
            <div className="grid gap-4 md:grid-cols-3">
              {RESEARCHING.map((card, i) => (
                <ConnectorCard key={card.id} card={card} status="researching" index={i} />
              ))}
            </div>
          </section>

          {/* Footer pointers */}
          <motion.div
            {...fadeUp(0.1)}
            className="rounded-2xl p-5 sm:p-6 mb-10"
            style={{
              background: "linear-gradient(135deg, hsl(248 62% 52% / 0.07), hsl(43 65% 62% / 0.05))",
              border: "1px solid hsl(248 62% 52% / 0.2)",
            }}
          >
            <p className="text-sm text-foreground font-semibold mb-2">Where to go next</p>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <Link
                href="/integrations"
                className="inline-flex items-center gap-1 text-[hsl(248_62%_62%)] hover:text-[hsl(248_62%_72%)] font-semibold"
                data-testid="link-platform-map"
              >
                Full platform map <ArrowRight className="w-3 h-3" />
              </Link>
              <span className="text-white/15">·</span>
              <Link
                href="/vault"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                data-testid="link-data-vault"
              >
                <Lock className="w-3 h-3" /> View Data Vault
              </Link>
              <span className="text-white/15">·</span>
              <Link
                href="/user-control"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                data-testid="link-user-control"
              >
                Privacy and data settings
              </Link>
              <span className="text-white/15">·</span>
              <Link
                href="/me"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                data-testid="link-self-hub"
              >
                Open Self Hub
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
