import { Bookmark, Gauge, HeartHandshake, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Single source of truth for "what signing in unlocks". Used by the Account
 * signed-out card and any other sign-in prompt so the value proposition stays
 * consistent everywhere. The product is anonymous-first: people can use the
 * core tools without an account. Signing in is framed as keeping that work and
 * turning it into the readiness-to-matching payoff, never as a wall.
 */
export const SIGN_IN_UNLOCKS: {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: Bookmark,
    title: "Save your progress",
    body: "Every audit, rewrite, and answer stays in one place and follows you to any device.",
  },
  {
    icon: Gauge,
    title: "Build your Match Readiness",
    body: "Your readiness climbs as the machine learns what makes you a strong match.",
  },
  {
    icon: HeartHandshake,
    title: "Unlock matching",
    body: "Once your readiness is there, get introduced to people near you that you would not find on your own.",
  },
];

export function SignInUnlocksList({ className }: { className?: string }) {
  return (
    <ul className={cn("space-y-4 text-left", className)} data-testid="signin-unlocks">
      {SIGN_IN_UNLOCKS.map((unlock) => {
        const Icon = unlock.icon;
        return (
          <li key={unlock.title} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[hsl(248_62%_52%/0.2)] bg-[hsl(248_62%_52%/0.1)]">
              <Icon className="h-5 w-5 text-[hsl(248_62%_62%)]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{unlock.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{unlock.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
