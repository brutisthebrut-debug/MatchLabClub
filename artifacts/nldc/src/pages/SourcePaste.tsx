import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import {
  Sparkles,
  Compass,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Music2,
  Film,
  BookOpen,
  History,
  Activity,
  Headphones,
  Gamepad2,
  MapPin,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateSourcePaste,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMeta } from "@/hooks/useMeta";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";

type SourceConfig = {
  /** Value written into imported_sources.source by the backend. */
  source: string;
  title: string;
  icon: LucideIcon;
  color: string;
  lead: string;
  prompt: string;
  placeholder: string;
  /** What we'll see / never touch, surfaced before the user pastes anything. */
  access: string[];
  excludes: string[];
  readiness: string;
};

// Keyed by the :source route param. Each entry maps a friendly URL slug to the
// registry source key the backend expects and the consent-first copy.
const CONFIG: Record<string, SourceConfig> = {
  taste: {
    source: "taste-paste",
    title: "Taste paste",
    icon: Sparkles,
    color: "hsl(326 70% 60%)",
    lead: "The films, shows, music, books, and places you keep coming back to. Taste says a lot about mood, humour, and what a good night actually looks like for you.",
    prompt:
      "List the things you love, one per line. Films, artists, shows, books, a venue, a dish, a ritual. Whatever feels like you.",
    placeholder:
      "Past Lives\nPhoebe Bridgers\nSunday morning bouldering\nThe little Sichuan place on 9th\nCormac McCarthy",
    access: [
      "The list of taste items you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Spotify, Netflix, Letterboxd, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    readiness:
      "Fills the taste lane of your Match Readiness. The more honest the list, the better the machine reads what a night with you feels like.",
  },
  lifestyle: {
    source: "lifestyle-paste",
    title: "Lifestyle paste",
    icon: Compass,
    color: "hsl(248 62% 60%)",
    lead: "How you actually spend your time and energy. The rhythms, habits, and non-negotiables that shape a week in your life.",
    prompt:
      "List the things that make up your everyday, one per line. Morning runs, a dog, early nights, travel, a side project, time with family.",
    placeholder:
      "5k most mornings\nDog named Biscuit\nCook most nights\nClimbing twice a week\nVisit my parents on Sundays\nEarly to bed",
    access: [
      "The list of lifestyle items you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to your calendar, fitness apps, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    readiness:
      "Fills the lifestyle lane of your Match Readiness. A fuller picture of your week reads as a fuller life to match around.",
  },
  music: {
    source: "music-paste",
    title: "Music taste",
    icon: Music2,
    color: "hsl(141 73% 42%)",
    lead: "The sound you keep coming back to. Music taste turns out to read mood and conversation chemistry better than most prompt answers.",
    prompt:
      "List your top artists and tracks, one per line. Paste from your Spotify export, or just type the ones that feel like you.",
    placeholder:
      "Phoebe Bridgers\nFred again..\nThe National\nSunday morning jazz\nFrank Ocean, Blonde\nLittle Simz",
    access: [
      "The list of artists and tracks you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Spotify or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    readiness:
      "Fills the music lane of your Match Readiness. The truer the list, the better we read your mood and the kind of night you light up on.",
  },
  film: {
    source: "film-paste",
    title: "Film taste",
    icon: Film,
    color: "hsl(28 80% 55%)",
    lead: "The films and shows you love say a lot about your humour, your mood, and what a good night in actually looks like for you.",
    prompt:
      "List the films and shows you love, one per line. Paste from your Letterboxd export, or just type the ones that stuck.",
    placeholder:
      "Past Lives\nPortrait of a Lady on Fire\nThe Bear\nPaddington 2\nIn the Mood for Love\nFleabag",
    access: [
      "The list of films and shows you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Letterboxd, Netflix, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    readiness:
      "Fills the film lane of your Match Readiness. The more honest the list, the better the machine reads your humour and taste.",
  },
  reading: {
    source: "reading-paste",
    title: "Reading taste",
    icon: BookOpen,
    color: "hsl(38 90% 50%)",
    lead: "What you read, and what you return to, is a quiet window into curiosity and values that a bio rarely shows.",
    prompt:
      "List the books and authors you love, one per line. Paste from your Goodreads export, or just type the ones that shaped you.",
    placeholder:
      "Cormac McCarthy\nThe Overstory\nElena Ferrante\nDune\nBraiding Sweetgrass\nKazuo Ishiguro",
    access: [
      "The list of books and authors you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Goodreads, Amazon, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    readiness:
      "Fills the reading lane of your Match Readiness. A fuller shelf reads as a fuller inner life to match around.",
  },
  curiosity: {
    source: "curiosity-paste",
    title: "Curiosity trail",
    icon: History,
    color: "hsl(207 70% 45%)",
    lead: "The interests, rabbit holes, and topics that actually hold your attention. The things you search, watch, and follow when no one is choosing for you.",
    prompt:
      "List what you are curious about, one per line. Topics, channels, hobbies, the things you fall down a rabbit hole on. Paste from a Google Takeout summary, or just type them.",
    placeholder:
      "Urban planning\nFermentation\nFormula 1\nMid-century design\nMarine biology\nStandup comedy",
    access: [
      "The list of interests and topics you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Google, YouTube, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    readiness:
      "Fills the curiosity lane of your Match Readiness. The more we see of what holds your attention, the better we match the things you would actually talk about.",
  },
  vitality: {
    source: "vitality-paste",
    title: "Vitality rhythm",
    icon: Activity,
    color: "hsl(348 70% 60%)",
    lead: "How you keep your energy up across a week. The movement, rest, and rhythms that shape how you actually show up.",
    prompt:
      "List the rhythms that keep you going, one per line. Workouts, walks, sleep habits, rest days. Paste from an Apple Health summary, or just type them.",
    placeholder:
      "Run three mornings a week\nYoga on Sundays\nEarly to bed\nLong walks after work\nClimbing on Tuesdays\nRest day Fridays",
    access: [
      "The list of activities and rhythms you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "Any underlying health record, vitals, or medical detail",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    readiness:
      "Fills the vitality lane of your Match Readiness. A clearer rhythm helps the machine pace a real connection around your energy.",
  },
  podcasts: {
    source: "podcasts-paste",
    title: "Podcast lineup",
    icon: Headphones,
    color: "hsl(265 60% 60%)",
    lead: "The shows you keep subscribed to. The ideas and voices you come back to read curiosity and humour better than most prompt answers.",
    prompt:
      "List the shows you keep subscribed to, one per line. Paste from your OPML export, or just type the ones you never skip.",
    placeholder:
      "The Rest Is History\nNormal Gossip\n99% Invisible\nIf Books Could Kill\nOlogies\nHeavyweight",
    access: [
      "The list of shows you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Spotify, Apple Podcasts, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    readiness:
      "Fills the podcasts lane of your Match Readiness. The truer the lineup, the better we match on curiosity.",
  },
  gaming: {
    source: "gaming-paste",
    title: "Gaming signature",
    icon: Gamepad2,
    color: "hsl(190 60% 50%)",
    lead: "The games you keep returning to. How you unwind and play is a real read on shared-leisure fit that a bio rarely shows.",
    prompt:
      "List the games you keep returning to, one per line. Paste from your Steam list, or just type the ones you always come back to.",
    placeholder:
      "Stardew Valley\nElden Ring\nMario Kart with friends\nBaldur's Gate 3\nTetris\nCatan night",
    access: [
      "The list of games you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Anything you do not paste in",
      "OAuth access to Steam, Xbox, PlayStation, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    readiness:
      "Fills the gaming lane of your Match Readiness. The truer the list, the better we match on shared-leisure fit.",
  },
  places: {
    source: "places-paste",
    title: "Places rhythm",
    icon: MapPin,
    color: "hsl(160 55% 45%)",
    lead: "The kinds of places your life actually happens in. Where you spend time is a real read on lifestyle and shared-activity fit.",
    prompt:
      "List the kinds of places you spend time, one per line (gym, trails, cafes, travel). Distil a Maps Timeline category summary into a list, or just type them. We read the categories, never a single location.",
    placeholder:
      "Climbing gym\nWeekend hikes\nNeighbourhood cafes\nLive music venues\nFarmers markets\nTravel a few times a year",
    access: [
      "The kinds of places you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Any location, address, or coordinate, ever",
      "OAuth access to Google Maps, your timeline, or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    readiness:
      "Fills the places lane of your Match Readiness. A fuller map of where you spend time reads as a fuller life to match around.",
  },
  "screen-rhythm": {
    source: "screen-rhythm-paste",
    title: "Screen rhythm",
    icon: Smartphone,
    color: "hsl(220 50% 58%)",
    lead: "How your day splits across kinds of apps. The balance of attention and rest helps pace a real connection around your week.",
    prompt:
      "List how your day splits across kinds of apps, one per line (social, reading, work, rest). Distil a Screen Time category summary into a list, or just type them. We read the balance, never an app or message.",
    placeholder:
      "Mostly reading apps at night\nSocial in short bursts\nLong stretches off the phone on weekends\nMaps and music when out\nWork apps nine to five\nNo phone first hour of the day",
    access: [
      "The kinds of app time you paste in, one per line",
      "A simple count of how many you gave us, used to fill the lane",
    ],
    excludes: [
      "Any specific app, message, notification, or usage record",
      "OAuth or device access to your phone or any account",
      "Your raw items are never sent to any AI prompt, only the count moves your readiness",
    ],
    readiness:
      "Fills the screen rhythm lane of your Match Readiness. A clearer daily balance helps pace a real connection.",
  },
};

function ConsentList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "see" | "never";
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <span
              className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background:
                  tone === "see"
                    ? "hsl(142 55% 60%)"
                    : "hsl(var(--muted-foreground))",
              }}
            />
            <span
              className={
                tone === "see" ? "" : "text-muted-foreground"
              }
            >
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SourcePaste() {
  const [, params] = useRoute("/connections/add/:source");
  const slug = params?.source ?? "";
  const config = CONFIG[slug];

  useMeta(
    config ? `${config.title} | MatchLab Club` : "Add a source | MatchLab Club",
    config?.lead ??
      "Plug a consent-first source into your Match Readiness.",
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const paste = useCreateSourcePaste();
  const climb = useReadinessClimb();
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<number | null>(null);

  if (!config) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold mb-3">Source not found</h1>
          <p className="text-muted-foreground mb-6">
            We do not have a paste connector at this address yet.
          </p>
          <Button asChild>
            <Link href="/connections">Back to Connection Center</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const Icon = config.icon;

  const parseItems = () =>
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 30);

  const itemCount = parseItems().length;

  const handleSubmit = () => {
    const items = parseItems();
    if (items.length === 0) {
      toast({
        title: "Add at least one item",
        description: "Paste a few things, one per line, so we have something to read.",
        variant: "destructive",
      });
      return;
    }
    // Snapshot readiness before the paste lands so the success card can animate
    // the real climb these items produced.
    climb.snapshot();
    paste.mutate(
      {
        data: {
          source: config.source,
          items: items.map((item) => item.slice(0, 280)),
          note: note.trim() ? note.trim().slice(0, 1000) : undefined,
        },
      },
      {
        onSuccess: (result) => {
          setDone(result.itemCount);
          setRaw("");
          setNote("");
          queryClient.invalidateQueries({
            queryKey: getGetMatchingStateQueryKey(),
          });
          toast({
            title: `${config.title} saved`,
            description: `${result.itemCount} ${
              result.itemCount === 1 ? "item" : "items"
            } added to your readiness. ${config.readiness}`,
          });
        },
        onError: () => {
          toast({
            title: "Could not save your paste",
            description: "Something went wrong on our end. Try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/connections"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Connection Center
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span
              className="w-11 h-11 rounded-xl grid place-items-center"
              style={{ background: `${config.color} / 0.15`, color: config.color }}
            >
              <Icon className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-semibold">{config.title}</h1>
          </div>
          <p className="text-muted-foreground mb-8">{config.lead}</p>
        </motion.div>

        {done !== null ? (
          <Card>
            <CardContent className="py-10 text-center">
              <CheckCircle2
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: "hsl(142 55% 60%)" }}
              />
              <h2 className="text-xl font-semibold mb-2">
                {done} {done === 1 ? "item" : "items"} added
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                {config.readiness}
              </p>
              {climb.before !== null && (
                <ReadinessClimbReveal
                  from={climb.before}
                  to={climb.current}
                  className="max-w-sm mx-auto mb-6 rounded-2xl border border-foreground/10 p-6 text-left"
                />
              )}
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  onClick={() => {
                    setDone(null);
                    climb.reset();
                  }}
                  variant="outline"
                >
                  Add more
                </Button>
                <Button asChild>
                  <Link href="/connections">Back to Connection Center</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{config.prompt}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder={config.placeholder}
                  rows={8}
                  className="resize-y"
                />
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional: a line of context (not required)"
                  maxLength={1000}
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {itemCount} {itemCount === 1 ? "item" : "items"} ready
                  </span>
                  <Button
                    onClick={handleSubmit}
                    disabled={paste.isPending || itemCount === 0}
                  >
                    {paste.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Save to my readiness
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" style={{ color: config.color }} />
                  Before you paste
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-6">
                <ConsentList
                  title="What we'll see"
                  items={config.access}
                  tone="see"
                />
                <ConsentList
                  title="What we'll never touch"
                  items={config.excludes}
                  tone="never"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
