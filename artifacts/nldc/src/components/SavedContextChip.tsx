import { BookOpen } from "lucide-react";
import { Link } from "wouter";

interface SavedContextChipProps {
  summary: string;
  className?: string;
}

export function SavedContextChip({ summary, className = "" }: SavedContextChipProps) {
  return (
  <div className={`flex items-center gap-2 text-xs text-muted-foreground/70 ${className}`}>
  <BookOpen className="w-3.5 h-3.5 flex-shrink-0 text-[hsl(248_62%_52%)]" />
  <span>
  Using your saved profile context, {" "}
  <span className="text-[hsl(248_62%_62%)]">{summary}</span>
  </span>
  </div>
  );
}

interface NoContextHintProps {
  toolName?: string;
  className?: string;
}

export function NoContextHint({ toolName, className = "" }: NoContextHintProps) {
  return (
  <p className={`text-xs text-muted-foreground/50 ${className}`}>
  <Link href="/blueprint" className="text-[hsl(248_62%_52%)] hover:underline">
  Complete your Blueprint
  </Link>{" "}
  to add personalised context for {toolName ?? "this tool"}.
  </p>
  );
}
