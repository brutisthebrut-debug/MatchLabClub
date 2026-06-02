import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

// The felt "watch the machine learn you" moment. Given a before and after
// readiness score, it animates the number counting up and the meter filling so
// a new user sees the gain happen rather than reading a static figure. It does
// not compute readiness; it only animates the values it is handed. When there
// is no gain (a skip, or a returning view) it simply shows the current score
// with no celebratory pill, so it is safe to render in every case.
export function ReadinessClimbReveal({
  from,
  to,
  className,
}: {
  from: number;
  to: number;
  className?: string;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const safeFrom = clamp(from);
  const safeTo = clamp(to);
  const delta = Math.max(0, safeTo - safeFrom);
  const [display, setDisplay] = useState(safeFrom);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (safeTo <= safeFrom) {
      setDisplay(safeTo);
      return;
    }
    const duration = 1100;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(safeFrom + (safeTo - safeFrom) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [safeFrom, safeTo]);

  return (
    <div
      className={className}
      data-testid="readiness-climb-reveal"
      data-delta={delta}
    >
      <div className="flex items-end justify-between">
        <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Match Readiness
        </span>
        <span
          className="font-serif text-3xl font-bold gradient-text"
          data-testid="readiness-climb-value"
        >
          {display}%
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B]"
          initial={{ width: `${safeFrom}%` }}
          animate={{ width: `${safeTo}%` }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </div>
      {delta > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[hsl(326_100%_50%/0.1)] px-3 py-1 text-sm font-semibold text-[hsl(326_100%_45%)]"
          data-testid="readiness-climb-delta"
        >
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
          +{delta} readiness from your first signal
        </motion.div>
      ) : (
        <p className="mt-3 text-left text-xs text-muted-foreground">
          Keep going on your Mirror to climb toward matching.
        </p>
      )}
    </div>
  );
}
