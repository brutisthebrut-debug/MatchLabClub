import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileArchive, CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { ShareButton } from "@/components/echo/ShareButton";

type ImportStatus = "pending" | "complete" | "fallback" | string;

interface HingeAiRead {
  narrativeRead: string;
  patterns: string[];
  strengths: string[];
  blindspots: string[];
  coachingPrompts: string[];
}

interface ParsedSummary {
  counts?: {
    matches: number;
    conversations: number;
    messagesSent: number;
    mediaFiles: number;
    jsonFiles: number;
  };
  derivedStats?: {
    totalMatches: number;
    totalConversations: number;
    totalMessagesSent: number;
    oldestMatchAt: string | null;
    newestMatchAt: string | null;
    topConversationLength: number;
    messageToMatchRatio: number;
    rawJsonFileCount: number;
    mediaFileCount: number;
  };
  aiRead?: HingeAiRead;
  aiError?: string;
}

interface ImportRow {
  id: number;
  source: string;
  status: ImportStatus;
  originalFilename: string | null;
  parsedSummary: ParsedSummary | null;
  uploadedAt: string;
  processedAt: string | null;
}

const MAX_BYTES = 50 * 1024 * 1024;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/4 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function SummaryView({ row }: { row: ImportRow }) {
  const s = row.parsedSummary ?? {};
  const counts = s.counts;
  const stats = s.derivedStats;
  const aiRead = s.aiRead;

  return (
    <div className="space-y-4">
      {counts && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatChip label="Matches" value={counts.matches} />
          <StatChip label="Conversations" value={counts.conversations} />
          <StatChip label="Messages sent" value={counts.messagesSent} />
          <StatChip label="Msgs per match" value={stats.messageToMatchRatio} />
          <StatChip label="Longest thread" value={`${stats.topConversationLength} msgs`} />
          <StatChip label="Media files" value={stats.mediaFileCount} />
          <StatChip label="Oldest match" value={formatDate(stats.oldestMatchAt)} />
          <StatChip label="Newest match" value={formatDate(stats.newestMatchAt)} />
        </div>
      )}

      {aiRead ? (
        <div className="rounded-2xl border border-white/10 bg-white/4 p-5 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Echo's read</div>
            <p className="leading-relaxed">{aiRead.narrativeRead}</p>
          </div>
          {aiRead.patterns.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Patterns</div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {aiRead.patterns.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {aiRead.strengths.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Strengths</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {aiRead.strengths.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            {aiRead.blindspots.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Worth examining</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {aiRead.blindspots.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
          </div>
          {aiRead.coachingPrompts.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Questions to sit with</div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {aiRead.coachingPrompts.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          <ShareButton
            surface="hinge-import"
            title="Echo read my Hinge history"
            text="I uploaded my Hinge export to MatchLab. Here's what Echo saw."
            path="/imports"
            variant="pill"
          />
        </div>
      ) : row.status === "pending" ? (
        <div className="rounded-2xl border border-white/10 bg-white/4 p-5 flex items-center gap-3">
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Loader2 className="w-5 h-5 animate-spin" />
          </motion.div>
          <span>Reading your patterns...</span>
        </div>
      ) : row.status === "fallback" ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <div className="font-semibold">Counts are in. Narrative read is not.</div>
            <p className="text-sm text-muted-foreground mt-1">
              {s.aiError === "consent_not_granted"
                ? "Echo needs your AI content consent to write a narrative read. Enable it in settings and re-upload."
                : "We could not generate the narrative read this time. Your numbers are still saved above."}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Imports() {
  const { toast } = useToast();
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pollExhausted, setPollExhausted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<number | null>(null);
  const pollStartRef = useRef<number>(0);

  const loadImports = useCallback(async () => {
    try {
      const res = await fetch("/api/imports", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setImports(Array.isArray(data.imports) ? data.imports : []);
    } catch {
      // network error; silent
    }
  }, []);

  useEffect(() => {
    void loadImports();
  }, [loadImports]);

  const pollActive = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`/api/imports/${id}`, { credentials: "include" });
        if (!res.ok) return;
        const row: ImportRow = await res.json();
        setImports((prev) => {
          const i = prev.findIndex((r) => r.id === row.id);
          if (i < 0) return [row, ...prev];
          const next = prev.slice();
          next[i] = row;
          return next;
        });
        if (row.status !== "pending") {
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          return;
        }
        if (Date.now() - pollStartRef.current > 60_000) {
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setPollExhausted(true);
        }
      } catch {
        // ignore transient errors
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, []);

  function startPolling(id: number) {
    setPollExhausted(false);
    pollStartRef.current = Date.now();
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = window.setInterval(() => {
      void pollActive(id);
    }, 4000);
  }

  function handleUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast({
        title: "ZIP files only",
        description: "Upload the original .zip from your Hinge export, no need to unzip it first.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({
        title: "File too large",
        description: "Maximum upload size is 50MB.",
        variant: "destructive",
      });
      return;
    }

    const form = new FormData();
    form.append("file", file);

    setUploading(true);
    setProgress(0);
    setActiveId(null);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/imports/hinge");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      setUploading(false);
      setProgress(100);
      if (xhr.status === 201) {
        try {
          const row: ImportRow = JSON.parse(xhr.responseText);
          setImports((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
          setActiveId(row.id);
          setExpandedId(row.id);
          if (row.status === "pending") startPolling(row.id);
          toast({
            title: "Upload received",
            description: "Reading your patterns now. This usually takes under a minute.",
          });
        } catch {
          toast({ title: "Upload accepted", description: "Could not read server response." });
        }
      } else {
        let message = "Upload failed.";
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.error) message = body.error;
        } catch {
          // ignore
        }
        toast({ title: "Upload failed", description: message, variant: "destructive" });
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      toast({ title: "Upload failed", description: "Network error.", variant: "destructive" });
    };
    xhr.send(form);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  async function onDelete(id: number) {
    try {
      const res = await fetch(`/api/imports/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setImports((prev) => prev.filter((r) => r.id !== id));
        if (activeId === id) setActiveId(null);
        if (expandedId === id) setExpandedId(null);
        toast({ title: "Import removed" });
      }
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  const activeRow = activeId ? imports.find((r) => r.id === activeId) ?? null : null;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-10 w-full space-y-10">
        <section className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Bring your Hinge history into the light.
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Upload your GDPR export. We'll show you what your match patterns actually say about you.
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          <Card
            className={`border-2 transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-white/10"
            }`}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="w-5 h-5" /> Hinge
              </CardTitle>
              <p className="text-xs text-muted-foreground">Live. Drop your ZIP.</p>
            </CardHeader>
            <CardContent>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className="border-2 border-dashed border-white/15 rounded-xl p-6 text-center cursor-pointer hover:border-white/30 transition-colors"
                data-testid="hinge-dropzone"
              >
                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <div className="text-sm font-medium">Drop ZIP here</div>
                <div className="text-xs text-muted-foreground mt-1">or click to choose a file</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={onPickFile}
                data-testid="hinge-file-input"
              />
              <Button
                variant="secondary"
                className="w-full mt-3"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                data-testid="button-choose-hinge-zip"
              >
                {uploading ? "Uploading..." : "Choose file"}
              </Button>
              {uploading && (
                <div className="mt-3">
                  <Progress value={progress} />
                  <div className="text-xs text-muted-foreground mt-1">{progress}%</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="w-5 h-5" /> Tinder
              </CardTitle>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full" disabled>
                Not yet supported
              </Button>
            </CardContent>
          </Card>

          <Card className="border-white/10 opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="w-5 h-5" /> Bumble
              </CardTitle>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full" disabled>
                Not yet supported
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <Accordion type="single" collapsible className="border border-white/10 rounded-2xl">
            <AccordionItem value="how" className="border-none">
              <AccordionTrigger className="px-5">
                How to download your Hinge data
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Open the Hinge app.</li>
                  <li>Settings, then Download My Data.</li>
                  <li>You'll receive an email with a ZIP file in 24 to 48 hours.</li>
                  <li>Drag the ZIP here. No need to unzip first.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {activeRow && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Latest upload</h2>
            <Card className="border-white/10">
              <CardContent className="p-5">
                <SummaryView row={activeRow} />
                {pollExhausted && activeRow.status === "pending" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" /> Still processing. Refresh later to see the read.
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Past imports</h2>
          {imports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No imports yet. Upload your first Hinge export above.
            </p>
          ) : (
            <div className="space-y-3">
              {imports.map((row) => {
                const expanded = expandedId === row.id;
                return (
                  <Card key={row.id} className="border-white/10">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <button
                          type="button"
                          className="flex-1 text-left"
                          onClick={() => setExpandedId(expanded ? null : row.id)}
                          data-testid={`import-row-${row.id}`}
                        >
                          <div className="font-medium capitalize">
                            {row.source} export
                            <span className="text-xs text-muted-foreground ml-2">
                              {row.originalFilename ?? "uploaded.zip"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <span>{formatDate(row.uploadedAt)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              {row.status === "complete" ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              ) : row.status === "fallback" ? (
                                <AlertCircle className="w-3 h-3 text-amber-400" />
                              ) : (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              )}
                              {row.status}
                            </span>
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(row.id)}
                          data-testid={`button-delete-import-${row.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                      {expanded && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <SummaryView row={row} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
