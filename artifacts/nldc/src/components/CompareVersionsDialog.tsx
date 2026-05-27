import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowRight, Plus, Minus, ArrowUp, ArrowDown, GitCompare } from "lucide-react";

type VersionReport = {
  readinessScore: number;
  strengths: string[];
  risks: string[];
  rewrittenBio?: string;
  bioAudit?: string;
};

type VersionEntry = {
  id: number;
  readinessScore: number;
  generatedAt: string;
  report?: unknown;
};

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "earlier";
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function scoreColor(s: number) {
  return s >= 75 ? "hsl(142 55% 62%)" : s >= 55 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)";
}

function computeDiff(a: string[], b: string[]): { text: string; status: "added" | "removed" | "kept" }[] {
  const setA = new Set(a);
  const setB = new Set(b);
  const all = Array.from(new Set([...a, ...b]));
  return all.map((text) => {
    if (setA.has(text) && setB.has(text)) return { text, status: "kept" as const };
    if (!setA.has(text) && setB.has(text)) return { text, status: "added" as const };
    return { text, status: "removed" as const };
  });
}

type WordToken = { word: string; status: "added" | "removed" | "kept" };

function wordDiff(textA: string, textB: string): WordToken[] {
  const wordsA = textA.match(/\S+/g) ?? [];
  const wordsB = textB.match(/\S+/g) ?? [];
  const m = wordsA.length;
  const n = wordsB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = wordsA[i - 1] === wordsB[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const tokens: WordToken[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      tokens.unshift({ word: wordsA[i - 1], status: "kept" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({ word: wordsB[j - 1], status: "added" });
      j--;
    } else {
      tokens.unshift({ word: wordsA[i - 1], status: "removed" });
      i--;
    }
  }
  return tokens;
}

function WordDiffView({ tokens }: { tokens: WordToken[] }) {
  return (
    <p className="text-sm leading-relaxed" data-testid="bio-word-diff">
      {tokens.map((token, i) => {
        const space = i < tokens.length - 1 ? " " : "";
        if (token.status === "added") {
          return (
            <span key={i}>
              <mark className="bg-[hsl(142_55%_60%/0.22)] text-[hsl(142_55%_72%)] rounded px-0.5 not-italic">
                {token.word}
              </mark>
              {space}
            </span>
          );
        }
        if (token.status === "removed") {
          return (
            <span key={i}>
              <mark className="bg-[hsl(348_55%_65%/0.22)] text-[hsl(348_55%_75%)] line-through rounded px-0.5 not-italic">
                {token.word}
              </mark>
              {space}
            </span>
          );
        }
        return (
          <span key={i} className="text-muted-foreground">
            {token.word}
            {space}
          </span>
        );
      })}
    </p>
  );
}

function DiffItem({ item }: { item: { text: string; status: "added" | "removed" | "kept" } }) {
  if (item.status === "added") {
    return (
      <li className="flex items-start gap-2 text-xs text-foreground" data-testid="diff-item-added">
        <Plus className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[hsl(142_55%_60%)]" />
        <span className="text-[hsl(142_55%_72%)]">{item.text}</span>
      </li>
    );
  }
  if (item.status === "removed") {
    return (
      <li className="flex items-start gap-2 text-xs text-muted-foreground line-through" data-testid="diff-item-removed">
        <Minus className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[hsl(348_55%_65%)]" />
        <span>{item.text}</span>
      </li>
    );
  }
  return (
    <li className="flex items-start gap-2 text-xs text-muted-foreground" data-testid="diff-item-kept">
      <span className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-center opacity-30">·</span>
      <span>{item.text}</span>
    </li>
  );
}

export function CompareVersionsDialog({
  open,
  onOpenChange,
  versionA,
  versionB,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionA: VersionEntry | null;
  versionB: VersionEntry | null;
}) {
  if (!versionA || !versionB) return null;

  const repA = versionA.report as VersionReport | undefined;
  const repB = versionB.report as VersionReport | undefined;

  const scoreA = versionA.readinessScore;
  const scoreB = versionB.readinessScore;
  const scoreDelta = scoreB - scoreA;

  const strengthsDiff = computeDiff(repA?.strengths ?? [], repB?.strengths ?? []);
  const risksDiff = computeDiff(repA?.risks ?? [], repB?.risks ?? []);

  const bioA = repA?.rewrittenBio ?? repA?.bioAudit ?? null;
  const bioB = repB?.rewrittenBio ?? repB?.bioAudit ?? null;
  const bioTokens = (bioA || bioB) ? wordDiff(bioA ?? "", bioB ?? "") : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[hsl(248_40%_96%)] border-white/10"
        data-testid="dialog-compare-versions"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <GitCompare className="w-5 h-5 text-[hsl(248_62%_62%)]" />
            Version comparison
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {formatGeneratedAt(versionA.generatedAt)} → {formatGeneratedAt(versionB.generatedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* ── Score comparison ── */}
          <div
            className="rounded-2xl border border-white/10 bg-[hsl(248_40%_160%)] p-5"
            data-testid="compare-score-section"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Signal Score
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center" data-testid="compare-score-a">
                <p className="text-xs text-muted-foreground mb-1">{formatGeneratedAt(versionA.generatedAt)}</p>
                <span className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(scoreA) }}>
                  {scoreA}
                </span>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
              <div className="text-center" data-testid="compare-score-b">
                <p className="text-xs text-muted-foreground mb-1">{formatGeneratedAt(versionB.generatedAt)}</p>
                <span className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(scoreB) }}>
                  {scoreB}
                </span>
              </div>
              {scoreDelta !== 0 ? (
                <span
                  className={`ml-auto inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full ${
                    scoreDelta > 0
                      ? "bg-[hsl(142_55%_60%/0.15)] text-[hsl(142_55%_70%)] border border-[hsl(142_55%_60%/0.3)]"
                      : "bg-[hsl(348_55%_65%/0.15)] text-[hsl(348_55%_75%)] border border-[hsl(348_55%_65%/0.3)]"
                  }`}
                  data-testid="compare-score-delta"
                >
                  {scoreDelta > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  {scoreDelta > 0 ? "+" : ""}{scoreDelta} pts
                </span>
              ) : (
                <span
                  className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-full bg-white/5 text-muted-foreground border border-white/10"
                  data-testid="compare-score-delta"
                >
                  Score unchanged
                </span>
              )}
            </div>
          </div>

          {/* ── Strengths diff ── */}
          <div
            className="rounded-2xl border border-white/10 bg-[hsl(248_40%_160%)] p-5"
            data-testid="compare-strengths-section"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-[hsl(248_62%_58%)] mb-3">
              Strengths
            </p>
            {strengthsDiff.length > 0 ? (
              <ul className="space-y-2">
                {strengthsDiff.map((item, i) => (
                  <DiffItem key={`str-${i}`} item={item} />
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No strength data available for these versions.</p>
            )}
          </div>

          {/* ── Risks diff ── */}
          <div
            className="rounded-2xl border border-white/10 bg-[hsl(248_40%_160%)] p-5"
            data-testid="compare-risks-section"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-[hsl(43_65%_67%)] mb-3">
              Risks
            </p>
            {risksDiff.length > 0 ? (
              <ul className="space-y-2">
                {risksDiff.map((item, i) => (
                  <DiffItem key={`risk-${i}`} item={item} />
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No risk data available for these versions.</p>
            )}
          </div>

          {/* ── Bio word-level diff ── */}
          {bioTokens ? (
            <div
              className="rounded-2xl border border-white/10 bg-[hsl(248_40%_160%)] p-5"
              data-testid="compare-bio-section"
            >
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Rewritten bio
                </p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <mark className="bg-[hsl(348_55%_65%/0.22)] text-[hsl(348_55%_75%)] rounded px-1 not-italic line-through">removed</mark>
                  </span>
                  <span className="flex items-center gap-1">
                    <mark className="bg-[hsl(142_55%_60%/0.22)] text-[hsl(142_55%_72%)] rounded px-1 not-italic">added</mark>
                  </span>
                </div>
              </div>
              <WordDiffView tokens={bioTokens} />
            </div>
          ) : null}

          {/* ── Legend ── */}
          <div className="flex flex-wrap gap-4 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Plus className="w-3 h-3 text-[hsl(142_55%_60%)]" /> Added in newer version
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground line-through">
              <Minus className="w-3 h-3 text-[hsl(348_55%_65%)]" /> Removed in newer version
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="opacity-40">·</span> Unchanged
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
