import { withAlpha } from "@/lib/brandColor";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion, type Variants } from "framer-motion";
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
  Film,
  Footprints,
  BookOpen,
  Images,
  UtensilsCrossed,
  Palette,
  Clapperboard,
  Video,
  Headphones,
  Gamepad2,
  MapPin,
  Smartphone,
  Shuffle,
  Mic,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const fadeUpVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const containerVariants: Variants = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

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
    title: "Dating app data export",
    icon: Flame,
    color: "hsl(348 75% 60%)",
    blurb:
      "Drop in the data export ZIP from Hinge, Tinder, or Bumble (Settings, Download My Data). We read your prompts, likes, and matches and build a pattern map you can actually use.",
    returns: "A pattern read of how you write, who you like, and where your tempo drops off.",
    cta: { href: "/imports", label: "Open dating app import" },
    readiness: "Fills the dating app import lane of your Match Readiness in a single drop.",
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
      "Paste any thread (Hinge, Bumble, Tinder, Grindr, Feeld, HER, Facebook Dating, iMessage screenshot transcribed). Chemistry Lab returns five reply options scored on warmth, directness, and pace.",
    returns: "Five coached replies plus a read of how the thread is actually going.",
    cta: { href: "/coach", label: "Open Message Coach" },
  },
  {
    id: "photo-scan",
    title: "Photo scan",
    icon: Camera,
    color: "hsl(212 70% 55%)",
    blurb:
      "Upload a profile screenshot. With the deep AI lane on, AI vision reads your actual photo for lighting, framing, expression, and variety. With it off, you still get a structured photo checklist. Your image is read in the moment and never stored.",
    returns: "A real photo critique with a single highest-impact fix when the AI lane is on, or a guidance checklist otherwise.",
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
    readiness:
      "Fills the calendar rhythm lane of your Match Readiness. A fuller week reads as a fuller life outside dating.",
  },
  {
    id: "receipts-inbox",
    title: "Receipts inbox",
    icon: Mail,
    color: "hsl(326 100% 62%)",
    blurb:
      "Your own private address at receipts.matchlab.club. Forward Hinge renewals, OpenTable confirmations, DoorDash receipts, Airbnb bookings, or paste a few in by hand. We read the sender, subject, and timestamp. Never the body.",
    returns:
      "An honest read of your subscription stack, travel rhythm, and dating-app cadence that keeps building as you forward.",
    access: [
      "Subject lines and sender of mail you forward to us or paste in",
      "The date and time each forwarded message arrived",
    ],
    excludes: [
      "The body of any email, ever",
      "Anything in your inbox you do not explicitly forward",
      "OAuth access to your Gmail, Outlook, or any account",
    ],
    cta: { href: "/receipts", label: "Open Receipts inbox" },
    readiness:
      "Fills the receipts lane of your Match Readiness. A busier real-world rhythm reads as a fuller life outside dating.",
  },
  {
    id: "taste-paste",
    title: "Taste paste",
    icon: Sparkles,
    color: "hsl(326 70% 60%)",
    blurb:
      "Paste the films, shows, music, books, and places you keep coming back to, one per line. Taste says a lot about mood, humour, and what a good night in actually looks like for you.",
    returns: "A taste read that grounds your profile in what you genuinely love.",
    access: [
      "The list of taste items you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Spotify, Netflix, Letterboxd, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    cta: { href: "/connections/add/taste", label: "Add taste" },
    readiness:
      "Fills the taste lane of your Match Readiness. The more honest the list, the better the machine reads what a night with you feels like.",
  },
  {
    id: "lifestyle-paste",
    title: "Lifestyle paste",
    icon: Footprints,
    color: "hsl(248 62% 60%)",
    blurb:
      "Paste the rhythms and habits that make up your week, one per line. Morning runs, a dog, early nights, a side project, time with family. How you actually spend your energy.",
    returns: "A lifestyle read that grounds your profile in how you really live.",
    access: [
      "The list of lifestyle items you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to your calendar, fitness apps, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    cta: { href: "/connections/add/lifestyle", label: "Add lifestyle" },
    readiness:
      "Fills the lifestyle lane of your Match Readiness. A fuller picture of your week reads as a fuller life to match around.",
  },
  {
    id: "music-paste",
    title: "Music taste",
    icon: Music2,
    color: "hsl(141 73% 42%)",
    blurb:
      "Paste your top artists and tracks, one per line, or drop in the export Spotify hands you. Music taste reads mood and conversation chemistry better than most prompt answers. No login, no OAuth.",
    returns: "A music read that grounds your profile in the sound you actually live in.",
    access: [
      "The list of artists and tracks you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Spotify or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    cta: { href: "/connections/add/music", label: "Add music" },
    readiness:
      "Fills the music lane of your Match Readiness. The truer the list, the better we read your mood and the kind of night you light up on.",
  },
  {
    id: "film-paste",
    title: "Film taste",
    icon: Film,
    color: "hsl(28 80% 55%)",
    blurb:
      "Paste the films and shows you love, one per line, or drop in your Letterboxd diary export. What you watch says a lot about your humour and what a good night in looks like for you. No login, no OAuth.",
    returns: "A film read that sharpens date ideas and conversation openers.",
    access: [
      "The list of films and shows you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Letterboxd, Netflix, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    cta: { href: "/connections/add/film", label: "Add film" },
    readiness:
      "Fills the film lane of your Match Readiness. The more honest the list, the better the machine reads your humour and taste.",
  },
  {
    id: "reading-paste",
    title: "Reading taste",
    icon: BookOpen,
    color: "hsl(38 90% 50%)",
    blurb:
      "Paste the books and authors you return to, one per line, or drop in your Goodreads export. What you read is a quiet window into curiosity and values a bio rarely shows. No login, no OAuth.",
    returns: "A reading read that deepens how the machine reasons about fit.",
    access: [
      "The list of books and authors you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Goodreads, Amazon, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    cta: { href: "/connections/add/reading", label: "Add reading" },
    readiness:
      "Fills the reading lane of your Match Readiness. A fuller shelf reads as a fuller inner life to match around.",
  },
  {
    id: "curiosity-paste",
    title: "Curiosity trail",
    icon: History,
    color: "hsl(207 70% 45%)",
    blurb:
      "Paste the interests and rabbit holes that hold your attention, one per line, or distil a Google Takeout summary into a list. The things you search, watch, and follow when no one is choosing for you. No login, no OAuth.",
    returns: "An interests read that grounds your profile in what you would actually talk about.",
    access: [
      "The list of interests and topics you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Google, YouTube, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    cta: { href: "/connections/add/curiosity", label: "Add interests" },
    readiness:
      "Fills the curiosity lane of your Match Readiness. The more we see of what holds your attention, the better we match the things you would actually talk about.",
  },
  {
    id: "vitality-paste",
    title: "Vitality rhythm",
    icon: Activity,
    color: "hsl(348 70% 60%)",
    blurb:
      "Paste the rhythms that keep your energy up, one per line, or distil an Apple Health summary into a list. Workouts, rest, walks, sleep habits. We read the cadence, never any health record. No login, no OAuth.",
    returns: "An energy read that helps pace a real connection around your week.",
    access: [
      "The list of activities and rhythms you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "Any underlying health record, vitals, or medical detail",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    cta: { href: "/connections/add/vitality", label: "Add vitality" },
    readiness:
      "Fills the vitality lane of your Match Readiness. A clearer rhythm helps the machine pace a real connection around your energy.",
  },
  {
    id: "podcasts-paste",
    title: "Podcast lineup",
    icon: Headphones,
    color: "hsl(265 60% 60%)",
    blurb:
      "Paste the shows you keep subscribed to, one per line, or drop in your OPML export. The ideas and voices you come back to read curiosity and humour better than a bio line. No login, no OAuth.",
    returns: "A read on the ideas and voices that hold your attention.",
    access: [
      "The list of shows you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Spotify, Apple Podcasts, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    cta: { href: "/connections/add/podcasts", label: "Add podcasts" },
    readiness:
      "Fills the podcasts lane of your Match Readiness. The truer the lineup, the better we match on curiosity.",
  },
  {
    id: "gaming-paste",
    title: "Gaming signature",
    icon: Gamepad2,
    color: "hsl(190 60% 50%)",
    blurb:
      "Paste the games you keep returning to, one per line, or drop in your Steam list. How you unwind and play is a real read on shared-leisure fit. We read the overlap, never the playtime. No login, no OAuth.",
    returns: "A read on how you unwind and the kind of play you share.",
    access: [
      "The list of games you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Steam, Xbox, PlayStation, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    cta: { href: "/connections/add/gaming", label: "Add games" },
    readiness:
      "Fills the gaming lane of your Match Readiness. The truer the list, the better we match on shared-leisure fit.",
  },
  {
    id: "places-paste",
    title: "Places rhythm",
    icon: MapPin,
    color: "hsl(160 55% 45%)",
    blurb:
      "Paste the kinds of places you spend time, one per line (gym, trails, cafes, travel), or distil a Maps Timeline category summary into a list. Where life happens is a real read on shared-activity fit. We read the categories, never a single location. No login, no OAuth.",
    returns: "A read on the kinds of places your life actually happens in.",
    access: [
      "The kinds of places you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Any location, address, or coordinate, ever",
      "OAuth access to Google Maps, your timeline, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    cta: { href: "/connections/add/places", label: "Add places" },
    readiness:
      "Fills the places lane of your Match Readiness. A fuller map of where you spend time reads as a fuller life to match around.",
  },
  {
    id: "screen-rhythm-paste",
    title: "Screen rhythm",
    icon: Smartphone,
    color: "hsl(220 50% 58%)",
    blurb:
      "Paste how your day splits across kinds of apps, one per line (social, reading, work, rest), or distil a Screen Time category summary into a list. How attention and rest balance out helps pace a real connection. We read the balance, never an app or message. No login, no OAuth.",
    returns: "A read on how attention and rest split across your day.",
    access: [
      "The kinds of app time you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Any specific app, message, notification, or usage record",
      "OAuth or device access to your phone or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    cta: { href: "/connections/add/screen-rhythm", label: "Add screen rhythm" },
    readiness:
      "Fills the screen rhythm lane of your Match Readiness. A clearer daily balance helps pace a real connection.",
  },
  {
    id: "preferences-this-or-that",
    title: "This or That",
    icon: Shuffle,
    color: "hsl(326 70% 58%)",
    blurb:
      "Tap through quick either-or choices. Each round reads the small instinctive preferences that quietly shape day-to-day fit. No typing, no login, no OAuth.",
    returns: "A read on the instincts that shape what a good day-to-day fit feels like.",
    access: [
      "Which side you picked on each pair",
      "A simple count of how many you answered, used to fill the lane",
    ],
    excludes: [
      "Anything you do not tap through",
      "Your choices are never tied back to any sensitive attribute or sold",
      "Your raw choices are never sent to any AI prompt, only the count moves your readiness",
    ],
    cta: { href: "/this-or-that", label: "Play This or That" },
    readiness:
      "Fills the rapid-fire preferences lane of your Match Readiness. Each round adds a read on day-to-day fit.",
  },
  {
    id: "voice-intro",
    title: "Voice intro",
    icon: Mic,
    color: "hsl(285 65% 62%)",
    blurb:
      "Record a few words about what you are looking for. We read only how you sound, the warmth, energy, and pace, never the words. The recording is analysed on your device in the moment and never uploaded. No login, no OAuth.",
    returns: "A read on how you come across out loud, from derived sound alone.",
    access: [
      "A handful of derived numbers about how you sound: length, energy, expressiveness, pace, and speech ratio",
      "A single count that fills the voice lane of your readiness",
    ],
    excludes: [
      "The recording itself, which never leaves your device or gets uploaded",
      "Any transcript, words, or content of what you said",
      "Only the derived numbers move your readiness, never audio",
    ],
    cta: { href: "/voice-intro", label: "Record voice intro" },
    readiness:
      "Fills the voice lane of your Match Readiness. How you sound is a real read that text never captures.",
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
];

const RESEARCHING: Connector[] = [
  {
    id: "messaging-e2ee",
    title: "WhatsApp and iMessage",
    icon: MessageSquare,
    color: "hsl(142 55% 55%)",
    blurb:
      "End-to-end encrypted by design. We are researching on-device processing so message tone analysis happens without anything leaving your phone. Open question: can we deliver useful coaching while honouring the E2EE contract.",
    returns: "If it lands, the most accurate tone read in the product.",
  },
  {
    id: "strava",
    title: "Strava rhythm",
    icon: Footprints,
    color: "hsl(18 90% 55%)",
    blurb:
      "Strava exposes activity types, times, and frequency through its API. Movement rhythm is a strong honest signal of energy and weekly cadence. Research question: how to read the rhythm of when and how you move without ever touching exact routes or locations.",
    returns: "If it lands, an energy and cadence read that informs date pacing and timing.",
    access: [
      "Activity types, durations, and the days and times you tend to move",
      "Weekly frequency and rough volume of activity",
    ],
    excludes: [
      "GPS routes, start points, or any precise location",
      "Heart rate, pace, or performance metrics",
      "Any ability to post, kudos, or change your activities",
    ],
  },
  {
    id: "photo-library-vibe",
    title: "Photo library vibe",
    icon: Images,
    color: "hsl(280 55% 60%)",
    blurb:
      "Your camera roll is the most honest record of how you actually spend your time. We are researching fully on-device vibe reads (outdoors versus indoors, social versus solo, the settings you gravitate to) so nothing but a small derived summary ever leaves your phone. Open question: can we surface a useful read while keeping every photo on-device.",
    returns: "If it lands, a lifestyle read that grounds your profile in how you really live.",
    access: [
      "A small on-device summary of scene types and social patterns, computed locally",
    ],
    excludes: [
      "Any actual photo leaving your device",
      "Faces, names, or who is in your pictures",
      "Exact locations or timestamps",
    ],
  },
  {
    id: "pinterest",
    title: "Pinterest aesthetic",
    icon: Palette,
    color: "hsl(348 80% 55%)",
    blurb:
      "Pinterest lets you export your boards and pins as an archive. What you save is the clearest picture of the life you are reaching for: the home, the trips, the style, the table you want to sit at. Research question: how much of who someone is living toward shows up in what they pin.",
    returns: "If it lands, an aesthetic and aspiration read that grounds your profile in the life you actually want.",
    access: [
      "Board names and the pins inside the archive you export and drop in",
    ],
    excludes: [
      "Your Pinterest login",
      "Secret boards you do not export",
      "Anything outside the file you choose to share",
    ],
  },
  {
    id: "netflix-history",
    title: "Netflix viewing history",
    icon: Clapperboard,
    color: "hsl(0 72% 50%)",
    blurb:
      "Netflix lets you download your viewing activity as a CSV. What you watch, and when, is a quiet read of your humour, your comfort genres, and what a real night in looks like. Research question: which viewing signals are taste and which are just background noise.",
    returns: "If it lands, a story-taste and mood read that sharpens conversation openers and date-night ideas.",
    access: [
      "Titles and dates from the viewing-activity CSV you export and drop in",
    ],
    excludes: [
      "Your Netflix login",
      "Other profiles on your account",
      "Anything outside the file you choose to share",
    ],
  },
  {
    id: "tiktok-taste",
    title: "TikTok taste",
    icon: Video,
    color: "hsl(190 90% 50%)",
    blurb:
      "TikTok lets you request your data, including the videos you have liked and saved. Your For You taste is one of the most honest mirrors of what actually holds your attention. Research question: how to read interests and humour from a feed without storing anything tied to a creator or a person.",
    returns: "If it lands, an interests-and-humour read that makes your profile and openers feel like you.",
    access: [
      "The liked and saved video topics in the data archive you request and drop in",
    ],
    excludes: [
      "Your TikTok login",
      "Your private messages or drafts",
      "Anything you have not put in the file yourself",
    ],
  },
  {
    id: "resy-opentable",
    title: "Resy and OpenTable history",
    icon: UtensilsCrossed,
    color: "hsl(348 60% 58%)",
    blurb:
      "Reservation apps hold a clean record of where you go out, how often, and the kind of places you pick. Research question: how to read going-out rhythm and taste from confirmations without storing anything tied to a specific person or party.",
    returns: "If it lands, a going-out cadence and taste read that powers date-spot suggestions.",
    access: [
      "Venue type, neighbourhood, and the dates and times of bookings you forward or export",
    ],
    excludes: [
      "Names of anyone you dined with",
      "Payment details or bill amounts",
      "Your reservation app login",
    ],
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
      variants={fadeUpVariants}
      className="glass rounded-[2rem] p-6 flex flex-col gap-4 border border-white/10 hover:border-white/20 hover:shadow-lg transition-all"
      data-testid={testId}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center flex-shrink-0"
          style={{
            background: withAlpha(card.color, 0.14),
            border: `1px solid ${withAlpha(card.color, 0.25)}`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: card.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="font-serif font-bold text-foreground text-lg leading-snug">{card.title}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{card.blurb}</p>
        </div>
      </div>

      <div className="rounded-[1.25rem] bg-white/40 dark:bg-black/10 border border-white/20 dark:border-white/5 px-4 py-3 flex items-start gap-3 mt-1">
        <Sparkles className="w-4 h-4 text-[hsl(var(--brand-gold))] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">What you get back: </strong>
          {card.returns}
        </p>
      </div>

      {(card.access || card.excludes) && (
        <div className="grid sm:grid-cols-2 gap-3 mt-1">
          {card.access && (
            <div className="rounded-[1.25rem] border border-[hsl(142_55%_60%/0.2)] bg-[hsl(142_55%_45%/0.04)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(142_55%_55%)] mb-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> What we'll see
              </p>
              <ul className="space-y-2">
                {card.access.map((item) => (
                  <li key={item} className="text-xs text-muted-foreground leading-snug flex gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(142_55%_55%)] mt-1 flex-shrink-0 opacity-80" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {card.excludes && (
            <div className="rounded-[1.25rem] border border-[hsl(348_55%_65%/0.2)] bg-[hsl(348_55%_55%/0.04)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(348_55%_65%)] mb-2 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> What we'll never touch
              </p>
              <ul className="space-y-2">
                {card.excludes.map((item) => (
                  <li key={item} className="text-xs text-muted-foreground leading-snug flex gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(348_55%_65%)] mt-1 flex-shrink-0 opacity-80" />
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
          className="rounded-[1.25rem] px-4 py-3 flex items-start gap-3 mt-1"
          style={{
            background: withAlpha("hsl(var(--brand-green))", 0.06),
            border: `1px solid ${withAlpha("hsl(var(--brand-green))", 0.2)}`,
          }}
          data-testid={`readiness-${card.id}`}
        >
          <Activity className="w-4 h-4 text-[hsl(var(--brand-green))] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-[hsl(var(--brand-green))]">Match Readiness: </strong>
            {card.readiness}
          </p>
        </div>
      )}

      {card.comingNote && (
        <p className="text-xs text-[hsl(var(--brand-indigo))] leading-relaxed italic px-1 mt-1">
          {card.comingNote}
        </p>
      )}

      {card.cta && (
        <div className="mt-2 pt-1 border-t border-white/5">
          <Link
            href={card.cta.href}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(248_62%_55%)] hover:text-[hsl(326_100%_59%)] transition-colors"
            data-testid={`link-${testId}`}
          >
            {card.cta.label} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
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
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center"
          style={{ background: withAlpha(accent, 0.14), border: `1px solid ${withAlpha(accent, 0.25)}` }}
        >
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
          {eyebrow}
        </p>
      </div>
      <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground tracking-tight">{title}</h2>
      <p className="text-base text-muted-foreground mt-2 leading-relaxed max-w-2xl">{subtitle}</p>
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
      <div className="min-h-screen mesh-bg py-12 px-4 sm:px-6 overflow-hidden">
        <div className="orb orb-violet fixed w-[500px] h-[500px] -top-32 -right-24 opacity-30 pointer-events-none" />
        <div className="orb orb-gold fixed w-[400px] h-[400px] bottom-10 -left-32 opacity-20 pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10">
          {/* Hero */}
          <motion.div variants={fadeUpVariants} initial="initial" animate="whileInView" className="mb-12 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-[hsl(248_62%_52%/0.25)] mb-6 shadow-sm">
              <Sparkles className="w-4 h-4 text-[hsl(248_62%_62%)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[hsl(248_62%_62%)]">
                Connection Center
              </span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight leading-tight">
              Plug things in.<br className="hidden sm:block" /> Get back what you didn't expect.
            </h1>
            <p className="text-lg text-muted-foreground mt-5 max-w-2xl leading-relaxed">
              Every source you plug in returns a small read of who you actually are when no one is watching, and feeds one rising Match Readiness meter. Some sources fill a readiness lane directly, all of them sharpen the reads matching runs on. The more the machine knows you, the better it matches you. Each one is opt-in, each one shows you exactly what we'll see and what we'll never touch, each one can be removed in one click.
            </p>
          </motion.div>

          {/* Privacy promise */}
          <motion.div
            variants={fadeUpVariants}
            initial="initial"
            animate="whileInView"
            className="mb-12 flex items-start gap-4 px-6 py-5 rounded-[2rem] glass border border-white/10 shadow-sm"
            data-testid="connections-privacy-promise"
          >
            <div className="w-10 h-10 rounded-[1.25rem] bg-[hsl(142_55%_60%/0.15)] flex items-center justify-center flex-shrink-0 border border-[hsl(142_55%_60%/0.2)]">
              <Shield className="w-5 h-5 text-[hsl(142_55%_55%)]" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground uppercase tracking-wide">Your data, your control</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Read only on every source. We never post, write, or send anything from your accounts. Sensitive surfaces (mail, bank) are subject-line and category-level only, never the underlying content. One toggle removes any source and purges its data.
              </p>
            </div>
          </motion.div>

          {/* Quick legend */}
          <motion.div variants={fadeUpVariants} initial="initial" animate="whileInView" className="flex flex-wrap items-center gap-3 mb-12">
            <StatusBadge status="live" />
            <span className="text-xs text-muted-foreground">Working today.</span>
            <span className="text-white/15 px-1">·</span>
            <StatusBadge status="building" />
            <span className="text-xs text-muted-foreground">In active build, sequenced.</span>
            <span className="text-white/15 px-1">·</span>
            <StatusBadge status="researching" />
            <span className="text-xs text-muted-foreground">Open question, real research in progress.</span>
          </motion.div>

          <motion.div variants={containerVariants} initial="initial" whileInView="whileInView" viewport={{ once: true }}>
            {/* Plugged in today */}
            <section className="mb-16">
              <SectionHeader
                icon={CheckCircle}
                eyebrow="Plugged in today"
                title="Sources you can use right now"
                subtitle="Each of these returns a real read in the product today. No API gate, no waitlist."
                accent="hsl(142 55% 60%)"
              />
              <div className="grid gap-6 md:grid-cols-2">
                {LIVE.map((card, i) => (
                  <ConnectorCard key={card.id} card={card} status="live" index={i} />
                ))}
              </div>
            </section>

            {/* Building */}
            <section className="mb-16">
              <SectionHeader
                icon={Wrench}
                eyebrow="In active build"
                title="What's coming, in order"
                subtitle="The roadmap, with the full data contract upfront. Each one ships standing alone. You'll see them light up here as they land."
                accent="hsl(var(--brand-indigo))"
              />
              <div className="grid gap-6">
                {BUILDING.map((card, i) => (
                  <ConnectorCard key={card.id} card={card} status="building" index={i} />
                ))}
              </div>
            </section>

            {/* Researching */}
            <section className="mb-16">
              <SectionHeader
                icon={FlaskConical}
                eyebrow="Researching"
                title="Open questions we're still answering"
                subtitle="Sources where the signal is real but the privacy contract or the API shape isn't there yet. We won't ship anything we can't honour."
                accent="hsl(43 65% 65%)"
              />
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {RESEARCHING.map((card, i) => (
                  <ConnectorCard key={card.id} card={card} status="researching" index={i} />
                ))}
              </div>
            </section>
          </motion.div>

          {/* Footer pointers */}
          <motion.div
            variants={fadeUpVariants}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            className="rounded-[2rem] p-8 mb-12 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, hsl(248 62% 52% / 0.08), hsl(43 65% 62% / 0.05))",
              border: "1px solid hsl(248 62% 52% / 0.15)",
            }}
          >
            <div className="absolute inset-0 bg-white/5 backdrop-blur-3xl -z-10" />
            <h3 className="text-xl font-serif font-bold text-foreground mb-4">Where to go next</h3>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link
                href="/integrations"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(248_62%_55%)] hover:text-[hsl(326_100%_59%)] transition-colors"
                data-testid="link-platform-map"
              >
                Full platform map <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="h-4 w-px bg-white/10 hidden sm:block" />
              <Link
                href="/vault"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-data-vault"
              >
                <Lock className="w-4 h-4" /> View Data Vault
              </Link>
              <div className="h-4 w-px bg-white/10 hidden sm:block" />
              <Link
                href="/user-control"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-user-control"
              >
                Privacy and data settings
              </Link>
              <div className="h-4 w-px bg-white/10 hidden lg:block" />
              <Link
                href="/me"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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
