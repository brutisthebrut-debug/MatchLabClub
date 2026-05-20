import { useEffect, useState } from "react";
import { Loader2, ScanLine, AlertTriangle } from "lucide-react";
import {
  getOcrMismatches,
  type OcrMismatchesResponse,
  type OcrCorrectionFieldName,
} from "@/lib/apiClient";

const FIELD_LABELS: Record<OcrCorrectionFieldName, string> = {
  firstName: "First name",
  age: "Age",
  sourceApp: "Source app",
  bio: "Bio",
  prompts: "Prompts",
};

export function OcrMismatchesPanel({
  refreshKey,
  founderKey = "",
}: {
  refreshKey: number;
  founderKey?: string;
}) {
  const [data, setData] = useState<OcrMismatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    getOcrMismatches(founderKey)
      .then(setData)
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <div
      className="glass rounded-2xl p-6 space-y-4"
      data-testid="ocr-mismatches-panel"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <ScanLine className="w-4 h-4 text-[hsl(268_52%_78%)]" />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
              OCR Mismatches
            </p>
            <p className="text-base font-semibold text-foreground">
              Where the parser still gets it wrong
            </p>
          </div>
        </div>
        {loading && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60" />
        )}
      </div>

      {err && (
        <div className="rounded-xl p-3 border border-red-500/40 bg-red-500/10 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />
          <p className="text-xs text-red-300">
            Could not load OCR mismatches: {err}
          </p>
        </div>
      )}

      {data && (
        <>
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
            data-testid="ocr-mismatches-summary"
          >
            <SummaryCell
              label="Screenshot audits"
              value={data.summary.totalScreenshotAudits}
            />
            <SummaryCell
              label="Have raw OCR"
              value={data.summary.auditsWithRawOcr}
            />
            <SummaryCell
              label="Had corrections"
              value={data.summary.auditsWithCorrections}
            />
            <SummaryCell label="Sample size" value={data.summary.sampleSize} />
          </div>

          <div className="space-y-3" data-testid="ocr-mismatches-fields">
            <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
              Field rankings
            </p>
            {data.perField.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No corrections recorded yet.
              </p>
            )}
            <ol className="space-y-2">
              {data.perField.map((f, i) => (
                <li
                  key={f.field}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                  data-testid={`ocr-field-row-${f.field}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground/60 w-6">
                        #{i + 1}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {FIELD_LABELS[f.field]}
                      </span>
                    </div>
                    <span
                      className="text-sm font-mono text-[hsl(268_52%_78%)]"
                      data-testid={`ocr-field-count-${f.field}`}
                    >
                      {f.correctionsCount}
                    </span>
                  </div>
                  {f.topDiffs.length > 0 && (
                    <ul
                      className="mt-2 space-y-1"
                      data-testid={`ocr-field-diffs-${f.field}`}
                    >
                      {f.topDiffs.map((d) => (
                        <li
                          key={d.example}
                          className="text-xs text-muted-foreground/80 flex items-center justify-between gap-2"
                        >
                          <span className="font-mono truncate">{d.example}</span>
                          <span className="font-mono text-muted-foreground/60 shrink-0">
                            ×{d.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-2" data-testid="ocr-mismatches-recent">
            <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
              Recent corrections
            </p>
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent corrections.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {data.recent.map((r, i) => (
                  <li
                    key={`${r.auditId}-${r.field}-${i}`}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs flex items-center justify-between gap-3"
                    data-testid={`ocr-recent-row-${i}`}
                  >
                    <span className="text-muted-foreground/70 shrink-0">
                      #{r.auditId} · {FIELD_LABELS[r.field]}
                    </span>
                    <span className="font-mono text-muted-foreground/80 truncate">
                      {r.raw} → {r.corrected}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
        {label}
      </p>
      <p className="text-lg font-semibold text-foreground font-mono">{value}</p>
    </div>
  );
}
