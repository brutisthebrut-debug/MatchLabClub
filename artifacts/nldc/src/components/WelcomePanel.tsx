import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface WelcomePanelProps {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  testId: string;
  delay?: number;
}

export function WelcomePanel({
  icon,
  eyebrow,
  title,
  description,
  testId,
  delay = 0.03,
}: WelcomePanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6"
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
