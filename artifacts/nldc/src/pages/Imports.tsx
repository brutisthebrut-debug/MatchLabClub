import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileArchive, CheckCircle2, AlertCircle, Loader2, Clock, CalendarDays } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { ToolHandoff } from "@/components/ToolHandoff";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useMeta } from "@/hooks/useMeta";
import { ShareButton } from "@/components/echo/ShareButton";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMatchingStateQueryKey } from "@workspace/api-client-react";

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
  rhythm?: {
    eventsPerWeek: number;
    busiestDay: string | null;
    weekendShare: number;
    eveningShare: number;
    earliestEventAt: string | null;
    latestEventAt: string | null;
    spanDays: number;
  };
  dayBreakdown?: { day: string; count: number }[];
  topRecurring?: string[];
  reads?: string[];
}

interface ImportRow {
  id: number;
  source: string;
  status: ImportStatus;
  originalFilename: string | null;
  parsedSummary: ParsedSummary | null;
  uploadedAt: string;
  processedAt: string | null;
  permissions: {
    storage: "saved";
    echoUse: boolean;
    learningConfirmed: boolean;
    matchingUse: boolean;
  };
}

const MAX_BYTES = 50 * 1024 * 1024;

const DATING_APPS = [
  { key: "hinge", label: "Hinge" },
  { key: "tinder", label: "Tinder" },
  { key: "bumble", label: "Bumble" },
] as const;

type DatingAppKey = (typeof DATING_APPS)[number]["key"];

const APP_LABELS: Record<string, string> = {
  hinge: "Hinge",
  tinder: "Tinder",
  bumble: "Bumble",
};

function appLabel(source: string): string {
  return APP_LABELS[source] ?? source;
}

const DOWNLOAD_STEPS: Record<DatingAppKey, string[]> = {
  hinge: [
    "Open the Hinge app.",
    "Settings, then Download My Data.",
    "You'll receive an email with a ZIP file in 24 to 48 hours.",
    "Drag the ZIP here. No need to unzip first.",
  ],
  tinder: [
    "Open Tinder and go to Settings.",
    "Find Download My Data and request a copy.",
    "Tinder emails a download link, usually within a few days.",
    "Download the ZIP and drag it here. No need to unzip first.",
  ],
  bumble: [
    "Email a data request through Bumble Settings, Contact and FAQ.",
    "Ask for a copy of your account data under privacy options.",
    "Bumble sends your data back by email.",
    "Drag the ZIP or archive here. No need to unzip first.",
  ],
};

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

function CalendarSummaryView({ row }: { row: ImportRow }) {
  const s = row.parsedSummary ?? {};
  const counts = s.counts as { totalEvents?: number } | undefined;
  const rhythm = s.rhythm;
  const reads = s.reads ?? [];
  const days = s.dayBreakdown ?? [];
  const maxDay = days.reduce((m, d) => Math.max(m, d.count), 0) || 1;

  return (
    <div className="space-y-4">
      {rhythm && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatChip label="Events read" value={counts?.totalEvents ?? 0} />
          <StatChip label="Per week" value={rhythm.eventsPerWeek} />
          <StatChip label="Busiest day" value={rhythm.busiestDay ?? "No clear day yet"} />
          <StatChip label="Weekend share" value={`${rhythm.weekendShare}%`} />
        </div>
      )}

      {days.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
            Your week at a glance
          </div>
          <div className="flex items-end gap-2 h-28">
            {days.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-primary/70"
                    style={{ height: `${Math.round((d.count / maxDay) * 100)}%` }}
                    title={`${d.count} events`}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground">{d.day.slice(0, 3)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reads.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/4 p-5 space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Echo's read
          </div>
          <ul className="list-disc list-inside space-y-1 text-sm leading-relaxed">
            {reads.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SummaryView({ row }: { row: ImportRow }) {
  if (row.source === "calendar-ics") {
    return <CalendarSummaryView row={row} />;
  }
  const s = row.parsedSummary ?? {};
  const counts = s.counts;
  const stats = s.derivedStats;
  const aiRead = row.permissions.echoUse ? s.aiRead : undefined;

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
            title="Echo read my dating history"
            text="I uploaded my dating app export to MatchLab. Here's what Echo saw."
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
                : "I could not generate the narrative read this time. Your numbers are still saved above."}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Imports() {
  useMeta(
    "Save your dating data",
    "Bring in a Hinge, Tinder, Bumble, or calendar source, then choose separately what Echo and matching may use.",
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pollExhausted, setPollExhausted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedApp, setSelectedApp] = useState<DatingAppKey>("hinge");
  const [updatingPermission, setUpdatingPermission] = useState<string | null>(null);
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
        description: `Upload the original .zip from your ${appLabel(selectedApp)} export, no need to unzip it first.`,
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
    xhr.open("POST", `/api/imports/${selectedApp}`);
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
            title: "Upload saved",
            description: "It stays storage-only until you choose Echo, learning, or matching permissions below.",
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

  async function updatePermission(
    row: ImportRow,
    key: "echoUse" | "learningConfirmed" | "matchingUse",
    value: boolean,
  ) {
    const pendingKey = `${row.id}:${key}`;
    setUpdatingPermission(pendingKey);
    try {
      const res = await fetch(`/api/imports/${row.id}/permissions`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        throw new Error(body?.error ?? "Permission update failed.");
      }
      const updated = body as ImportRow;
      setImports((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (activeId === updated.id) setActiveId(updated.id);
      if (key === "matchingUse") {
        void queryClient.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
      }
      if (updated.status === "pending") startPolling(updated.id);
      toast({
        title: "Permission updated",
        description:
          key === "echoUse"
            ? value
              ? "Echo can now process this source."
              : "Echo use is off; the source remains saved."
            : key === "learningConfirmed"
              ? value
                ? "Learning from this source is confirmed."
                : "Learning confirmation was removed."
              : value
                ? "Matching can now use this source's derived signal."
                : "Matching use is off; other permissions are unchanged.",
      });
    } catch (error) {
      toast({
        title: "Could not update permission",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingPermission(null);
    }
  }

  const [icsText, setIcsText] = useState("");
  const [calSubmitting, setCalSubmitting] = useState(false);

  async function handleCalendarPaste() {
    const trimmed = icsText.trim();
    if (!trimmed) {
      toast({
        title: "Nothing to read",
        description: "Paste the contents of your .ics calendar file first.",
        variant: "destructive",
      });
      return;
    }
    setCalSubmitting(true);
    try {
      const res = await fetch("/api/imports/calendar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsContent: trimmed }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 201 && body) {
        const row: ImportRow = body;
        setImports((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
        setActiveId(row.id);
        setExpandedId(row.id);
        setIcsText("");
        toast({
          title: "Calendar saved",
          description: "Its derived rhythm stays storage-only until you choose how it may be used.",
        });
      } else {
        toast({
          title: "Could not read that",
          description: body?.error ?? "Make sure you pasted a full .ics file.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setCalSubmitting(false);
    }
  }

  const activeRow = activeId ? imports.find((r) => r.id === activeId) ?? null : null;

  return (
    <AppLayout>
      <HubTabs hub="connections" />
      <div className="max-w-5xl mx-auto px-4 py-10 w-full space-y-10">
        <section className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Bring your history into the light.
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Drop your Hinge, Tinder, or Bumble data export or paste your calendar.
            Saving it does not authorize Echo, My MatchLab learning, or matching;
            you control each use separately below.
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
                <FileArchive className="w-5 h-5" /> Dating app export
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Live for Hinge, Tinder, and Bumble. Drop your ZIP.
              </p>
            </CardHeader>
            <CardContent>
              <div
                className="grid grid-cols-3 gap-1.5 mb-3"
                role="tablist"
                aria-label="Choose your dating app"
              >
                {DATING_APPS.map((app) => (
                  <Button
                    key={app.key}
                    type="button"
                    role="tab"
                    aria-selected={selectedApp === app.key}
                    variant={selectedApp === app.key ? "default" : "secondary"}
                    size="sm"
                    className="text-xs"
                    onClick={() => setSelectedApp(app.key)}
                    disabled={uploading}
                    data-testid={`select-app-${app.key}`}
                  >
                    {app.label}
                  </Button>
                ))}
              </div>
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

          <Card className="border-white/10 md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" /> Calendar
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Live. Paste your .ics export. Read only, never stored as raw text.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={icsText}
                onChange={(e) => setIcsText(e.target.value)}
                placeholder="Paste the contents of your .ics calendar file here..."
                className="min-h-[120px] font-mono text-xs"
                data-testid="calendar-ics-input"
              />
              <Button
                className="w-full"
                onClick={handleCalendarPaste}
                disabled={calSubmitting}
                data-testid="button-read-calendar"
              >
                {calSubmitting ? "Reading..." : "Read my rhythm"}
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <Accordion type="single" collapsible className="border border-white/10 rounded-2xl">
            <AccordionItem value="how" className="border-none">
              <AccordionTrigger className="px-5">
                How to download your {appLabel(selectedApp)} data
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  {DOWNLOAD_STEPS[selectedApp].map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
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
              No imports yet. Upload your first dating app export above.
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
                          <div className="font-medium">
                            {row.source === "calendar-ics"
                              ? "Calendar import"
                              : `${appLabel(row.source)} export`}
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
                        <div className="mt-4 pt-4 border-t border-white/10 space-y-5">
                          <SummaryView row={row} />
                          <div className="rounded-xl border border-white/10 p-4 space-y-3">
                            <div>
                              <p className="text-sm font-medium">How this source may be used</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Saved, Echo use, confirmed learning, and matching are independent.
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-sm">
                              <div>
                                <p>Store this source</p>
                                <p className="text-xs text-muted-foreground">On until you delete it.</p>
                              </div>
                              <span className="text-xs font-medium text-emerald-400">Saved</span>
                            </div>
                            {([
                              ["echoUse", "Let Echo process it", "Creates coaching reads from this source."],
                              ["learningConfirmed", "Confirm its learning", "Accepts proposed learning into My MatchLab."],
                              ["matchingUse", "Allow matching use", "Lets matching use only its derived signal."],
                            ] as const).map(([key, label, detail]) => (
                              <div key={key} className="flex items-center justify-between gap-4 text-sm">
                                <div>
                                  <p>{label}</p>
                                  <p className="text-xs text-muted-foreground">{detail}</p>
                                </div>
                                <Switch
                                  checked={row.permissions[key]}
                                  disabled={updatingPermission === `${row.id}:${key}`}
                                  onCheckedChange={(checked) => void updatePermission(row, key, checked)}
                                  aria-label={`${label} for ${appLabel(row.source)}`}
                                  data-testid={`permission-${key}-${row.id}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {imports.length > 0 && (
          <ToolHandoff
            testId="imports-handoff"
            fedLine="Your sources stay saved until you remove them. You choose separately what Echo may process, what becomes confirmed learning, and what matching may use."
            steps={[
              { label: "Read your patterns", href: "/insights", desc: "See the communication style behind your history." },
              { label: "Map your wellness", href: "/wellness", desc: "Cover more dimensions to raise your readiness." },
              { label: "Check your readiness", href: "/me", desc: "Watch your Match Readiness climb." },
            ]}
          />
        )}
      </div>
    </AppLayout>
  );
}
