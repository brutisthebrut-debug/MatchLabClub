import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  Copy,
  Check,
  Share2,
  MessageSquare,
  MapPin,
  Clock,
  User,
  PhoneCall,
  Eye,
  Car,
  Wine,
  HeartHandshake,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  hasPendingDate,
  markReflectionPending,
} from "@/lib/onboardingState";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

const CHECK_IN_TIPS: { icon: typeof Eye; title: string; body: string }[] = [
  {
    icon: MapPin,
    title: "Meet in public, first few times",
    body: "A busy cafe, bar, or restaurant. Skip a private home or a remote spot until trust is earned over several meetings.",
  },
  {
    icon: Car,
    title: "Arrange your own transport",
    body: "Drive yourself or use a ride app so you can leave whenever you want, on your own terms, without depending on them.",
  },
  {
    icon: PhoneCall,
    title: "Set a check-in time",
    body: "Ask a friend to text you mid-date. Agree on a quiet phrase that means 'come get me' if anything feels off.",
  },
  {
    icon: Wine,
    title: "Watch your drink",
    body: "Order it yourself, keep it in sight, and never leave it unattended. Trust the feeling if something seems wrong.",
  },
  {
    icon: Eye,
    title: "Trust your gut",
    body: "You owe no one a full evening. If you feel uneasy, it is always okay to end things early and head home.",
  },
  {
    icon: HeartHandshake,
    title: "Keep details private at first",
    body: "Hold back your home address, workplace, and full last name until you genuinely know and trust the person.",
  },
];

export default function DateSafety() {
  useMeta(
    "Date Safety",
    "Plan a safe first date. Share the details with someone you trust and set a check-in, in under a minute.",
  );
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [time, setTime] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [copied, setCopied] = useState(false);
  const [journeyDate] = useState(() => hasPendingDate());

  const message = useMemo(() => {
    const who = name.trim() || "someone I met on a dating app";
    const where = place.trim();
    const when = time.trim();
    const back = checkIn.trim();
    const lines = [
      `Heads up, I'm going on a date with ${who}.`,
      where ? `Where: ${where}` : null,
      when ? `When: ${when}` : null,
      back ? `I'll check in with you by ${back}.` : null,
      "If you don't hear from me by then, please give me a call.",
    ].filter(Boolean);
    return lines.join("\n");
  }, [name, place, time, checkIn]);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Paste it to whoever you trust most.",
      });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({
        title: "Could not copy",
        description: "Select the text and copy it manually.",
        variant: "destructive",
      });
    }
  };

  const shareMessage = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Date plan", text: message });
        return;
      } catch {
        // user dismissed the share sheet, fall through to copy
      }
    }
    copyMessage();
  };

  const smsHref = `sms:?&body=${encodeURIComponent(message)}`;

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <motion.div {...fadeUp(0)} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert
              className="w-6 h-6 text-[hsl(var(--brand-rose))]"
              aria-hidden="true"
            />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Date safety
            </h1>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Meeting someone new is exciting. A 60-second plan keeps it that way.
            Tell a person you trust where you'll be, set a check-in, and go enjoy
            yourself. Nothing here is stored on our side, this lives only on your
            screen.
          </p>
        </motion.div>

        {journeyDate && (
          <motion.section
            {...fadeUp(0.04)}
            className="mb-6 rounded-[2rem] border border-[hsl(var(--brand-gold)/0.28)] bg-[hsl(var(--brand-gold)/0.08)] p-6"
            data-testid="date-safety-journey"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--brand-gold))]">
              Chapter 7 of 8 · Date
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Make the plan, then go be present. MatchLab does not need a
              play-by-play. What matters afterward is how the date actually felt
              to you.
            </p>
            <Link
              href="/reflection"
              onClick={markReflectionPending}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-foreground/15 px-4 py-2 text-sm font-bold text-foreground"
              data-testid="date-safety-reflect"
            >
              Reflect after the date
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </motion.section>
        )}

        <motion.div
          {...fadeUp(0.08)}
          className="glass border border-white/8 rounded-3xl p-6 mb-6"
          data-testid="card-share-plan"
        >
          <div className="flex items-center gap-2 mb-5">
            <MessageSquare
              className="w-5 h-5 text-[hsl(248_62%_62%)]"
              aria-hidden="true"
            />
            <h2 className="font-semibold text-foreground">
              Share your plan with someone you trust
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="ds-name"
                className="flex items-center gap-1.5 text-xs"
              >
                <User className="w-3.5 h-3.5" aria-hidden="true" />
                Who you're meeting
              </Label>
              <Input
                id="ds-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name or handle"
                data-testid="input-date-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="ds-place"
                className="flex items-center gap-1.5 text-xs"
              >
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                Where
              </Label>
              <Input
                id="ds-place"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="Cafe name, neighborhood"
                data-testid="input-date-place"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="ds-time"
                className="flex items-center gap-1.5 text-xs"
              >
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                When
              </Label>
              <Input
                id="ds-time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="Fri 7pm"
                data-testid="input-date-time"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="ds-checkin"
                className="flex items-center gap-1.5 text-xs"
              >
                <PhoneCall className="w-3.5 h-3.5" aria-hidden="true" />
                Check in by
              </Label>
              <Input
                id="ds-checkin"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                placeholder="10pm"
                data-testid="input-date-checkin"
              />
            </div>
          </div>

          <div className="space-y-1.5 mb-4">
            <Label className="text-xs text-muted-foreground">
              Preview, edit before you send if you like
            </Label>
            <Textarea
              value={message}
              readOnly
              rows={6}
              className="resize-none text-sm"
              data-testid="text-share-message"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={shareMessage}
              className="rounded-full"
              data-testid="button-share-plan"
            >
              <Share2 className="mr-1.5 w-4 h-4" aria-hidden="true" />
              Share
            </Button>
            <Button
              variant="outline"
              onClick={copyMessage}
              className="rounded-full"
              data-testid="button-copy-plan"
            >
              {copied ? (
                <Check className="mr-1.5 w-4 h-4" aria-hidden="true" />
              ) : (
                <Copy className="mr-1.5 w-4 h-4" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              asChild
              variant="ghost"
              className="rounded-full"
              data-testid="link-sms-plan"
            >
              <a href={smsHref}>
                <MessageSquare className="mr-1.5 w-4 h-4" aria-hidden="true" />
                Text it
              </a>
            </Button>
          </div>
        </motion.div>

        <motion.div {...fadeUp(0.16)}>
          <h2 className="font-semibold text-foreground mb-4">
            First-date basics
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {CHECK_IN_TIPS.map((tip, i) => {
              const Icon = tip.icon;
              return (
                <div
                  key={i}
                  className="glass border border-white/8 rounded-2xl p-5"
                  data-testid={`tip-${i}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon
                      className="w-4 h-4 text-[hsl(248_62%_62%)]"
                      aria-hidden="true"
                    />
                    <p className="font-medium text-sm text-foreground">
                      {tip.title}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {tip.body}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.p
          {...fadeUp(0.24)}
          className="text-xs text-muted-foreground text-center mt-8"
        >
          If you ever feel in danger, contact your local emergency number right
          away. Trust yourself first.
        </motion.p>
      </div>
    </AppLayout>
  );
}
