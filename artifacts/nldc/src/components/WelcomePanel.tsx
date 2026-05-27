import { motion } from "framer-motion";
import type { ReactNode } from "react";

export type ShimmerTint =
  | "violet"
  | "purple"
  | "violet-green"
  | "gold"
  | "violet-teal";

interface TintConfig {
  gradient: string;
  borderColor: string;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  eyebrowColor: string;
}

const TINT_CONFIGS: Record<ShimmerTint, TintConfig> = {
  violet: {
    gradient:
      "linear-gradient(135deg, hsl(var(--brand-indigo) / 0.12), hsl(var(--brand-pink) / 0.08), hsl(var(--brand-gold) / 0.06))",
    borderColor: "hsl(var(--brand-indigo) / 0.2)",
    iconBg: "hsl(var(--brand-indigo) / 0.15)",
    iconBorder: "hsl(var(--brand-indigo) / 0.25)",
    iconColor: "hsl(248 62% 62%)",
    eyebrowColor: "hsl(248 62% 65%)",
  },
  purple: {
    gradient:
      "linear-gradient(135deg, hsl(var(--brand-indigo) / 0.12), hsl(var(--brand-pink) / 0.08))",
    borderColor: "hsl(var(--brand-indigo) / 0.2)",
    iconBg: "hsl(326 100% 62% / 0.15)",
    iconBorder: "hsl(326 100% 62% / 0.25)",
    iconColor: "hsl(326 100% 62%)",
    eyebrowColor: "hsl(326 100% 65%)",
  },
  "violet-green": {
    gradient:
      "linear-gradient(135deg, hsl(var(--brand-indigo) / 0.12), hsl(var(--brand-green) / 0.08))",
    borderColor: "hsl(var(--brand-indigo) / 0.2)",
    iconBg: "hsl(var(--brand-green) / 0.15)",
    iconBorder: "hsl(var(--brand-green) / 0.25)",
    iconColor: "hsl(142 55% 70%)",
    eyebrowColor: "hsl(142 60% 78%)",
  },
  gold: {
    gradient:
      "linear-gradient(135deg, hsl(var(--brand-gold) / 0.12), hsl(var(--brand-indigo) / 0.08))",
    borderColor: "hsl(var(--brand-gold) / 0.2)",
    iconBg: "hsl(var(--brand-gold) / 0.15)",
    iconBorder: "hsl(var(--brand-gold) / 0.25)",
    iconColor: "hsl(43 65% 72%)",
    eyebrowColor: "hsl(43 65% 72%)",
  },
  "violet-teal": {
    gradient:
      "linear-gradient(135deg, hsl(var(--brand-indigo) / 0.12), hsl(190 55% 60% / 0.08))",
    borderColor: "hsl(var(--brand-indigo) / 0.2)",
    iconBg: "hsl(var(--brand-indigo) / 0.15)",
    iconBorder: "hsl(var(--brand-indigo) / 0.25)",
    iconColor: "hsl(248 62% 62%)",
    eyebrowColor: "hsl(248 62% 65%)",
  },
};

interface WelcomePanelProps {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  testId: string;
  delay?: number;
  variant?: "default" | "shimmer";
  tint?: ShimmerTint;
  size?: "md" | "lg";
  showOrb?: boolean;
  wrapperClassName?: string;
  children?: ReactNode;
}

export function WelcomePanel({
  icon,
  eyebrow,
  title,
  description,
  testId,
  delay = 0.03,
  variant = "default",
  tint = "violet",
  size = "md",
  showOrb = false,
  wrapperClassName,
  children,
}: WelcomePanelProps) {
  const wrapperCls = wrapperClassName ?? "mb-6";

  if (variant === "shimmer") {
    const cfg = TINT_CONFIGS[tint];
    const padding = size === "lg" ? "p-6 sm:p-10" : "p-6 sm:p-8";
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
        className={wrapperCls}
        data-testid={testId}
      >
        <div
          className={`relative rounded-3xl ${padding} text-center overflow-hidden shimmer`}
          style={{ background: cfg.gradient }}
        >
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{ border: `1px solid ${cfg.borderColor}` }}
          />
          {showOrb && (
            <div className="orb orb-violet absolute w-64 h-64 -right-20 -top-20 opacity-50 pointer-events-none" />
          )}
          <div className="relative z-10">
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{
                background: cfg.iconBg,
                border: `1px solid ${cfg.iconBorder}`,
              }}
            >
              <span style={{ color: cfg.iconColor }}>{icon}</span>
            </div>
            <p
              className="text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: cfg.eyebrowColor }}
            >
              {eyebrow}
            </p>
            <h2
              className={`${size === "lg" ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"} font-bold text-foreground mb-2`}
            >
              {title}
            </h2>
            <p
              className={`text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed${children ? " mb-6" : ""}`}
            >
              {description}
            </p>
            {children}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={wrapperCls}
      data-testid={testId}
    >
      <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mx-auto mb-4 flex items-center justify-center">
          {icon}
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">{eyebrow}</p>
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}
