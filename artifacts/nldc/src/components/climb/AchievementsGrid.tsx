import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Layers,
  BookOpen,
  Flame,
  Wrench,
  Compass,
  Telescope,
  TrendingUp,
  Heart,
  Lock,
  Check,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { UserAchievements, Achievement } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

// String name from the API to a concrete icon. Kept explicit (no dynamic import)
// so the bundle stays predictable and an unknown name degrades to a sensible
// default rather than crashing the board.
const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Layers,
  BookOpen,
  Flame,
  Wrench,
  Compass,
  Telescope,
  TrendingUp,
  Heart,
};

const TIER_RING: Record<Achievement["tier"], string> = {
  bronze: "hsl(28 60% 48%)",
  silver: "hsl(220 9% 60%)",
  gold: "hsl(43 90% 55%)",
};

const TIER_LABEL: Record<Achievement["tier"], string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

const SEEN_KEY = "matchlab.unlocks.seen";

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeen(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    /* storage is best-effort; a failure just means we may re-toast later */
  }
}

export function AchievementsGrid({
  data,
  isDemo = false,
}: {
  data: UserAchievements;
  isDemo?: boolean;
}) {
  const { toast } = useToast();
  // Guard so the celebration only fires once per real change, not on every
  // re-render. Demo boards never celebrate.
  const celebrated = useRef(false);

  useEffect(() => {
    if (isDemo || celebrated.current) return;
    const unlockedIds = data.achievements
      .filter((a) => a.unlocked)
      .map((a) => a.id);
    const seen = readSeen();
    const fresh = data.achievements.filter(
      (a) => a.unlocked && !seen.has(a.id),
    );
    // On a brand-new browser with nothing stored, treat the current board as the
    // baseline rather than firing a toast for every already-earned unlock.
    if (seen.size > 0 && fresh.length > 0) {
      celebrated.current = true;
      const first = fresh[0];
      toast({
        title:
          fresh.length === 1
            ? `Unlocked: ${first.title}`
            : `${fresh.length} new unlocks`,
        description:
          fresh.length === 1
            ? first.description
            : `Including ${first.title}. See them all on your climb.`,
      });
    }
    writeSeen(unlockedIds);
  }, [data, isDemo, toast]);

  return (
    <div data-testid="achievements-grid">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy
            className="w-5 h-5 text-[hsl(43_90%_50%)]"
            aria-hidden="true"
          />
          <h2 className="font-serif text-2xl font-bold">Your unlocks</h2>
        </div>
        <span
          className="rounded-full bg-[hsl(248_62%_52%/0.1)] px-3 py-1 text-sm font-bold text-[hsl(248_62%_52%)]"
          data-testid="achievements-count"
        >
          {data.unlockedCount} of {data.totalCount}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground max-w-xl">
        Every signal you feed and every day you show up earns a badge. The more
        the machine knows you, the more of these open.
        {isDemo ? " This is a sample, sign in for your own." : ""}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {data.achievements.map((a, i) => {
          const Icon = ICONS[a.icon] ?? Sparkles;
          const pct =
            a.target > 0
              ? Math.min(100, Math.round((a.progress / a.target) * 100))
              : 0;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.03 * i }}
              data-testid={`achievement-${a.id}`}
              data-unlocked={a.unlocked}
              className={`rounded-2xl border p-4 ${
                a.unlocked
                  ? "border-foreground/10 bg-foreground/[0.02]"
                  : "border-foreground/8"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className="relative grid place-items-center w-11 h-11 rounded-full shrink-0 border"
                  style={{
                    background: a.unlocked
                      ? TIER_RING[a.tier]
                      : "hsl(var(--muted))",
                    borderColor: a.unlocked
                      ? TIER_RING[a.tier]
                      : "hsl(var(--border))",
                    color: a.unlocked ? "#fff" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {a.unlocked ? (
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Lock className="w-4 h-4" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold leading-tight">{a.title}</h3>
                    <span
                      className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground shrink-0"
                      style={{ color: a.unlocked ? TIER_RING[a.tier] : undefined }}
                    >
                      {TIER_LABEL[a.tier]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {a.description}
                  </p>

                  {a.unlocked ? (
                    <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-[hsl(326_100%_45%)]">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      Unlocked
                    </p>
                  ) : (
                    <div className="mt-2">
                      <span className="relative block h-1.5 w-full rounded-full bg-foreground/10 overflow-hidden">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-[hsl(326_100%_55%)]"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.progress} of {a.target} {a.unit}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
