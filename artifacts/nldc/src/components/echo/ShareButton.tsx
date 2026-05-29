import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export type EchoSurface =
  | "quiz-result"
  | "audit-report"
  | "sample-report"
  | "compass-read"
  | "message-coach"
  | "self-hub"
  | "blog-post"
  | "landing"
  | "waitlist"
  | "insights-result"
  | "hinge-import"
  | "pricing-tier";

type Variant = "primary" | "ghost" | "pill";

interface ShareButtonProps {
  surface: EchoSurface;
  title: string;
  text: string;
  path: string;
  ref?: string;
  label?: string;
  copiedLabel?: string;
  variant?: Variant;
  className?: string;
  testId?: string;
  iconOnly?: boolean;
}

function buildShareUrl(path: string, surface: EchoSurface, ref?: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const url = new URL(path.startsWith("http") ? path : `${base}${path}`);
  url.searchParams.set("utm_source", "share");
  url.searchParams.set("utm_medium", "echo");
  url.searchParams.set("utm_campaign", surface);
  if (ref) url.searchParams.set("ref", ref);
  return url.toString();
}

export function ShareButton({
  surface,
  title,
  text,
  path,
  ref,
  label = "Share",
  copiedLabel = "Copied",
  variant = "ghost",
  className,
  testId = "button-echo-share",
  iconOnly = false,
}: ShareButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleClick() {
  const shareUrl = buildShareUrl(path, surface, ref);
  const fallbackText = `${text}\n\n${shareUrl}`;

  trackEvent("echo_share_clicked", { surface, ref: ref ?? null });

  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const canNativeShare =
  nav && typeof nav.share === "function" && typeof nav.canShare === "function"
  ? nav.canShare({ title, text, url: shareUrl })
  : nav && typeof nav.share === "function";

  if (canNativeShare && nav) {
  try {
  await nav.share({ title, text, url: shareUrl });
  trackEvent("echo_share_completed", { surface, channel: "native" });
  return;
  } catch (err) {
  if (err instanceof Error && err.name === "AbortError") {
  trackEvent("echo_share_cancelled", { surface });
  return;
  }
  // Fall through to clipboard.
  }
  }

  try {
  await nav?.clipboard?.writeText(fallbackText);
  setCopied(true);
  window.setTimeout(() => setCopied(false), 2200);
  trackEvent("echo_share_completed", { surface, channel: "clipboard" });
  toast({
  title: "Copied to clipboard",
  description: "Paste it anywhere. DMs, group chat, Notes, wherever.",
  });
  } catch {
  window.prompt("Copy this link to share:", fallbackText);
  trackEvent("echo_share_completed", { surface, channel: "prompt" });
  }
  }

  const Icon = copied ? Check : Share2;
  const displayLabel = copied ? copiedLabel : label;

  if (variant === "pill") {
  return (
  <button
  type="button"
  onClick={handleClick}
  className={cn(
  "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 bg-white/4 transition-colors",
  className,
  )}
  data-testid={testId}
  >
  <Icon className={cn("w-3.5 h-3.5", copied && "text-[hsl(142_55%_60%)]")} />
  {!iconOnly && <span>{displayLabel}</span>}
  </button>
  );
  }

  return (
  <Button
  type="button"
  variant={variant === "primary" ? "default" : "ghost"}
  onClick={handleClick}
  className={cn("rounded-full", className)}
  data-testid={testId}
  >
  <Icon className={cn("mr-1 w-4 h-4", copied && "text-[hsl(142_55%_60%)]")} />
  {!iconOnly && displayLabel}
  </Button>
  );
}
