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
              <div className="flex flex-wrap gap-3 justify-center">
                <Button onClick={() => setDone(null)} variant="outline">
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
