import { useEffect, useState } from "react";
import { X, Loader2, AlertTriangle, ScanLine, FileText } from "lucide-react";
import {
  getOcrAuditDetail,
  type OcrAuditDetail,
  type OcrCorrectionFieldName,
} from "@/lib/apiClient";

const FIELD_LABELS: Record<OcrCorrectionFieldName, string> = {
  firstName: "First name",
  age: "Age",
  sourceApp: "Source app",
  bio: "Bio",
  prompts: "Prompts",
};

const ALL_FIELDS: OcrCorrectionFieldName[] = [
  "firstName",
  "age",
  "sourceApp",
  "bio",
  "prompts",
];

function asDisplayString(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.join(" | ");
  return String(v);
}

export function OcrAuditDetailDrawer({
  auditId,
  founderKey,
  onClose,
}: {
  auditId: number | null;
  founderKey: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<OcrAuditDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (auditId === null) {
      setData(null);
      setErr(null);
      return;
    }
    setLoading(true);
    setErr(null);
    setData(null);
    getOcrAuditDetail(founderKey, auditId)
      .then(setData)
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : "Failed to load audit"),
      )
      .finally(() => setLoading(false));
  }, [auditId, founderKey]);

  const open = auditId !== null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={[
          "fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-[hsl(260_20%_8%)] border-l border-white/10 flex flex-col transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label="Audit OCR detail"
        data-testid="ocr-audit-detail-drawer"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <ScanLine className="w-4 h-4 text-[hsl(268_52%_78%)]" />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
                OCR Audit Detail
              </p>
              <p className="text-base font-semibold text-foreground">
                {data ? `Audit #${data.id}` : auditId !== null ? `Audit #${auditId}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
            data-testid="ocr-detail-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/60" />
            </div>
          )}

          {err && (
            <div className="rounded-xl p-3 border border-red-500/40 bg-red-500/10 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">{err}</p>
            </div>
          )}

          {data && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <MetaCell label="Score" value={data.readinessScore !== null ? String(data.readinessScore) : "—"} />
                <MetaCell label="Source" value={data.source} />
                <MetaCell label="Status" value={data.status} />
              </div>

              <section data-testid="ocr-detail-corrections">
                <SectionHeading icon={<ScanLine className="w-3.5 h-3.5" />} title="OCR Corrections" />
                {!data.ocrCorrections || Object.keys(data.ocrCorrections).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No corrections recorded for this audit.</p>
                ) : (
                  <div className="space-y-3">
                    {ALL_FIELDS.filter((f) => data.ocrCorrections?.[f]).map((field) => {
                      const entry = data.ocrCorrections![field]!;
                      return (
                        <div
                          key={field}
                          className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2"
                          data-testid={`ocr-correction-${field}`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                            {FIELD_LABELS[field]}
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-widest text-red-400/70 font-semibold">Raw (OCR)</p>
                              <p className="text-sm font-mono text-red-300/90 break-all whitespace-pre-wrap">
                                {asDisplayString(entry.raw)}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-widest text-green-400/70 font-semibold">Corrected</p>
                              <p className="text-sm font-mono text-green-300/90 break-all whitespace-pre-wrap">
                                {asDisplayString(entry.corrected)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section data-testid="ocr-detail-profile">
                <SectionHeading icon={<FileText className="w-3.5 h-3.5" />} title="Parsed Profile Fields" />
                <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5">
                  <ProfileRow label="First name" value={data.profile.firstName} />
                  <ProfileRow label="Age" value={String(data.profile.age)} />
                  <ProfileRow label="Gender" value={data.profile.gender} />
                  {data.profile.orientation && (
                    <ProfileRow label="Orientation" value={data.profile.orientation} />
                  )}
                  <ProfileRow label="Dating goal" value={data.profile.datingGoal} />
                  {data.profile.currentApps.length > 0 && (
                    <ProfileRow label="Current apps" value={data.profile.currentApps.join(", ")} />
                  )}
                  {data.profile.sourceApp && (
                    <ProfileRow label="Source app" value={data.profile.sourceApp} />
                  )}
                  <ProfileRow label="Bio" value={data.profile.bio} multiline />
                  {data.profile.prompts && (
                    <ProfileRow label="Prompts" value={data.profile.prompts} multiline />
                  )}
                </div>
              </section>

              {data.rawOcrText && (
                <section data-testid="ocr-detail-raw-text">
                  <SectionHeading icon={<ScanLine className="w-3.5 h-3.5" />} title="Full Raw OCR Text" />
                  <pre className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs font-mono text-muted-foreground/80 whitespace-pre-wrap break-all overflow-x-auto">
                    {data.rawOcrText}
                  </pre>
                </section>
              )}

              {!data.rawOcrText && (
                <section>
                  <SectionHeading icon={<ScanLine className="w-3.5 h-3.5" />} title="Full Raw OCR Text" />
                  <p className="text-sm text-muted-foreground">No raw OCR text stored for this audit.</p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[hsl(268_52%_78%)]">{icon}</span>
      <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">{title}</p>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">{label}</p>
      <p className="text-sm font-mono text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function ProfileRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={["px-3 py-2.5", multiline ? "space-y-1" : "flex items-start justify-between gap-3"].join(" ")}>
      <p className="text-xs text-muted-foreground/60 shrink-0 font-medium">{label}</p>
      <p className={["text-xs text-foreground/90 font-mono", multiline ? "whitespace-pre-wrap break-all" : "text-right truncate"].join(" ")}>
        {value}
      </p>
    </div>
  );
}
