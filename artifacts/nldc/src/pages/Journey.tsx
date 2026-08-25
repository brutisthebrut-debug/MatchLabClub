import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArchiveRestore, ArrowRight, BookHeart, CalendarCheck, Heart, Loader2, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import { useEnhanceAi } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getJourneyRecord,
  removeJourneyItem,
  restoreJourneyItem,
  saveDateDebrief,
  saveReflection,
  type DateOutcome,
  type JourneyRecordItem,
  type JourneyRecordResponse,
} from "@/lib/journeyRecord";
import { shouldOpenGuidedDebrief } from "@/lib/journeyRoutes";
import { rememberAnonymousId } from "@/lib/anonymousIds";

type Composer = { kind: "reflection" | "date" | "guided-date"; item?: JourneyRecordItem };

const FELT_GOOD = ["Good chemistry", "Easy conversation", "Mutual curiosity", "Real connection", "I felt like myself", "They were engaged", "Physical attraction"];
const FELT_OFF = ["Forced conversation", "Felt one-sided", "Wasn't present", "Mixed signals", "Felt judged", "Too much pressure", "Something felt off"];
const GUIDED_OUTCOMES: Array<{ label: string; value: DateOutcome }> = [
  { label: "Another date", value: "another_date" },
  { label: "No more dates", value: "no_more" },
  { label: "No response", value: "ghosted" },
  { label: "Still deciding", value: "unsure" },
];

interface GuidedResult { patternRead: string; coachInsight: string }

function guidedFallback(good: string[], off: string[], outcome: DateOutcome | null): GuidedResult {
  const patternRead = good.length > off.length
    ? "There is real signal in what felt easy, mutual, or true to you. Keep noticing whether that quality stays consistent as the connection gets more specific."
    : good.length > 0
      ? "This sounds mixed rather than simply good or bad. Hold both sides of the experience; the useful question is whether the difficult parts were situational or part of the fit."
      : "Not every interaction gives a clean answer. What felt absent or effortful is still useful information about the conditions where you connect best.";
  const coachInsight = outcome === "another_date"
    ? "Stay curious and consistent without turning one promising interaction into proof of the whole relationship."
    : outcome === "no_more" || outcome === "ghosted"
      ? "Let the ending be information, not a verdict on your worth. Keep the clearest lesson and release the rest."
      : "Give yourself a little room before deciding what this meant or what you should do next.";
  return { patternRead, coachInsight };
}

function parseGuidedResult(raw: string | undefined, fallback: GuidedResult): GuidedResult {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<GuidedResult>;
    return {
      patternRead: typeof parsed.patternRead === "string" && parsed.patternRead.length > 10 ? parsed.patternRead : fallback.patternRead,
      coachInsight: typeof parsed.coachInsight === "string" && parsed.coachInsight.length > 10 ? parsed.coachInsight : fallback.coachInsight,
    };
  } catch { return fallback; }
}

function when(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function detailString(item: JourneyRecordItem, key: string): string {
  const value = item.details[key];
  return typeof value === "string" ? value : "";
}

function ReflectionComposer({ item, onCancel, onSaved }: { item?: JourneyRecordItem; onCancel: () => void; onSaved: () => void }) {
  const [prompt, setPrompt] = useState(item ? detailString(item, "prompt") : "");
  const [body, setBody] = useState(item?.body ?? "");
  const [tags, setTags] = useState(item && Array.isArray(item.details.tags) ? item.details.tags.join(", ") : "");
  const [mood, setMood] = useState(item && typeof item.details.mood === "number" ? String(item.details.mood) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveReflection({
        prompt: prompt.trim() || null,
        body: body.trim(),
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20),
        mood: mood ? Number(mood) : null,
      }, item?.source.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "This reflection could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 rounded-3xl border border-[hsl(248_62%_52%/0.25)] bg-[hsl(248_62%_52%/0.05)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[hsl(248_62%_52%)]">Reflection</p><h2 className="mt-1 font-serif text-2xl font-bold">{item ? "Edit this moment" : "What do you want to remember?"}</h2></div><Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button></div>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-bold">Optional prompt<Input value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={500} placeholder="What changed, surprised you, or became clearer?" /></label>
        <label className="grid gap-2 text-sm font-bold">Your reflection<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={20000} required rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal leading-6 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Write it in your own words." /></label>
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <label className="grid gap-2 text-sm font-bold">Tags<Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="growth, boundaries" /><span className="text-xs font-normal text-muted-foreground">Separate tags with commas.</span></label>
          <label className="grid gap-2 text-sm font-bold">Mood<select value={mood} onChange={(event) => setMood(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal"><option value="">Not set</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>
        </div>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-5 flex justify-end"><Button type="submit" disabled={saving || !body.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{item ? "Save changes" : "Keep reflection"}</Button></div>
    </form>
  );
}

function DateComposer({ item, onCancel, onSaved }: { item?: JourneyRecordItem; onCancel: () => void; onSaved: () => void }) {
  const savedDate = item ? detailString(item, "dateAt") : "";
  const [dateAt, setDateAt] = useState(savedDate ? savedDate.slice(0, 10) : "");
  const [personLabel, setPersonLabel] = useState(item ? detailString(item, "personLabel") : "");
  const [platform, setPlatform] = useState(item ? detailString(item, "platform") : "");
  const [summary, setSummary] = useState(item?.body ?? "");
  const [whatWentWell, setWhatWentWell] = useState(item ? detailString(item, "whatWentWell") : "");
  const [whatDidnt, setWhatDidnt] = useState(item ? detailString(item, "whatDidnt") : "");
  const [followUpPlanned, setFollowUpPlanned] = useState(Boolean(item?.details.followUpPlanned));
  const [outcome, setOutcome] = useState<DateOutcome | "">((item?.details.outcome as DateOutcome | null) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!summary.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveDateDebrief({
        dateAt: dateAt ? new Date(`${dateAt}T12:00:00`).toISOString() : null,
        personLabel: personLabel.trim() || null,
        platform: platform.trim() || null,
        summary: summary.trim(),
        whatWentWell: whatWentWell.trim(),
        whatDidnt: whatDidnt.trim(),
        followUpPlanned,
        outcome: outcome || null,
      }, item?.source.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "This date debrief could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 rounded-3xl border border-[hsl(248_62%_52%/0.25)] bg-[hsl(248_62%_52%/0.05)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[hsl(248_62%_52%)]">Date debrief</p><h2 className="mt-1 font-serif text-2xl font-bold">{item ? "Edit this debrief" : "Capture the date while it is fresh"}</h2></div><Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button></div>
      <div className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold">Date<Input type="date" value={dateAt} onChange={(event) => setDateAt(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-bold">First name or label<Input value={personLabel} onChange={(event) => setPersonLabel(event.target.value)} maxLength={120} placeholder="Optional" /></label>
          <label className="grid gap-2 text-sm font-bold">Where you met<Input value={platform} onChange={(event) => setPlatform(event.target.value)} maxLength={40} placeholder="Optional" /></label>
        </div>
        <label className="grid gap-2 text-sm font-bold">What happened?<textarea value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={20000} required rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal leading-6 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="The short version, in your own words." /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">What felt good?<textarea value={whatWentWell} onChange={(event) => setWhatWentWell(event.target.value)} maxLength={20000} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal leading-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
          <label className="grid gap-2 text-sm font-bold">What felt difficult?<textarea value={whatDidnt} onChange={(event) => setWhatDidnt(event.target.value)} maxLength={20000} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal leading-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">Where it stands<select value={outcome} onChange={(event) => setOutcome(event.target.value as DateOutcome | "")} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal"><option value="">Not sure yet</option><option value="another_date">Another date</option><option value="no_more">No more dates</option><option value="unsure">Unsure</option><option value="ghosted">No response</option></select></label>
          <label className="mt-7 flex h-10 items-center gap-3 rounded-md border border-input bg-background px-3 text-sm font-bold"><input type="checkbox" checked={followUpPlanned} onChange={(event) => setFollowUpPlanned(event.target.checked)} className="h-4 w-4" />I plan to follow up</label>
        </div>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-5 flex justify-end"><Button type="submit" disabled={saving || !summary.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{item ? "Save changes" : "Keep debrief"}</Button></div>
    </form>
  );
}

function GuidedDateComposer({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [what, setWhat] = useState("");
  const [dateAt, setDateAt] = useState("");
  const [personLabel, setPersonLabel] = useState("");
  const [platform, setPlatform] = useState("");
  const [good, setGood] = useState<string[]>([]);
  const [off, setOff] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<DateOutcome | null>(null);
  const [followUpPlanned, setFollowUpPlanned] = useState(false);
  const [result, setResult] = useState<GuidedResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enhance = useEnhanceAi();

  function toggle(value: string, selected: string[], setSelected: (values: string[]) => void) {
    setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  async function generate() {
    if (!what.trim() && good.length === 0 && off.length === 0) return;
    setSaving(true);
    setError(null);
    const fallback = guidedFallback(good, off, outcome);
    try {
      const note = await saveDateDebrief({
        dateAt: dateAt ? new Date(`${dateAt}T12:00:00`).toISOString() : null,
        personLabel: personLabel.trim() || null,
        platform: platform.trim() || null,
        summary: what.trim() || "Debrief captured from the moments I selected.",
        whatWentWell: good.join(", "),
        whatDidnt: off.join(", "),
        followUpPlanned,
        outcome,
      });
      rememberAnonymousId("postDateNotes", note.id);
      setResult(fallback);
      onSaved();
      const prompt = [
        what.trim() && `What happened: ${what.trim()}`,
        good.length > 0 && `What felt good: ${good.join(", ")}`,
        off.length > 0 && `What felt difficult or confusing: ${off.join(", ")}`,
        outcome && `Current outcome: ${outcome}`,
        "Return JSON with patternRead and coachInsight. Be warm, direct, specific, non-clinical, and avoid certainty beyond the evidence.",
      ].filter(Boolean).join("\n\n");
      enhance.mutate({ data: { toolName: "Journey date debrief", prompt, expectJson: true } }, {
        onSuccess: (data) => setResult(parseGuidedResult((data as { output?: string } | undefined)?.output, fallback)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your debrief could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (result) return (
    <section className="mt-7 rounded-3xl border border-[hsl(348_55%_65%/0.25)] bg-[hsl(348_55%_65%/0.05)] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[hsl(348_55%_55%)]"><Heart className="h-4 w-4" /><p className="text-xs font-bold uppercase tracking-[0.16em]">Saved to Journey</p></div>
      {enhance.isPending && <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Echo is reading the pattern…</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-foreground/10 bg-background/70 p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pattern read</p><p className="mt-3 text-sm leading-6 text-muted-foreground">{result.patternRead}</p></div><div className="rounded-2xl border border-foreground/10 bg-background/70 p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What to carry forward</p><p className="mt-3 text-sm leading-6 text-muted-foreground">{result.coachInsight}</p></div></div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><Link href="/coach" className="inline-flex items-center text-sm font-bold text-[hsl(248_62%_52%)] hover:underline">Ask Echo about your next message <ArrowRight className="ml-1.5 h-4 w-4" /></Link><Button type="button" variant="outline" onClick={onCancel}>Back to Journey</Button></div>
    </section>
  );

  return (
    <section className="mt-7 rounded-3xl border border-[hsl(348_55%_65%/0.25)] bg-[hsl(348_55%_65%/0.05)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[hsl(348_55%_55%)]">Guided date debrief</p><h2 className="mt-1 font-serif text-2xl font-bold">What happened, and what did you notice?</h2><p className="mt-2 text-sm text-muted-foreground">Save the facts first. Echo will offer a grounded pattern read without turning one date into a verdict.</p></div><Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="grid gap-2 text-sm font-bold">Date<Input type="date" value={dateAt} onChange={(event) => setDateAt(event.target.value)} /></label><label className="grid gap-2 text-sm font-bold">First name or label<Input value={personLabel} onChange={(event) => setPersonLabel(event.target.value)} maxLength={120} placeholder="Optional" /></label><label className="grid gap-2 text-sm font-bold">Where you met<Input value={platform} onChange={(event) => setPlatform(event.target.value)} maxLength={40} placeholder="Optional" /></label></div>
      <label className="mt-4 grid gap-2 text-sm font-bold">What happened?<textarea value={what} onChange={(event) => setWhat(event.target.value)} maxLength={20000} rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal leading-6 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="A date, a conversation, or a message exchange. Brief is fine." /></label>
      <div className="mt-5"><p className="text-sm font-bold">What felt good?</p><div className="mt-2 flex flex-wrap gap-2">{FELT_GOOD.map((value) => <button type="button" key={value} onClick={() => toggle(value, good, setGood)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${good.includes(value) ? "border-[hsl(142_45%_42%/0.5)] bg-[hsl(142_45%_42%/0.12)]" : "border-foreground/10 bg-background"}`}>{value}</button>)}</div></div>
      <div className="mt-5"><p className="text-sm font-bold">What felt difficult or confusing?</p><div className="mt-2 flex flex-wrap gap-2">{FELT_OFF.map((value) => <button type="button" key={value} onClick={() => toggle(value, off, setOff)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${off.includes(value) ? "border-[hsl(348_55%_55%/0.5)] bg-[hsl(348_55%_55%/0.12)]" : "border-foreground/10 bg-background"}`}>{value}</button>)}</div></div>
      <div className="mt-5"><p className="text-sm font-bold">Where does it stand?</p><div className="mt-2 flex flex-wrap gap-2">{GUIDED_OUTCOMES.map(({ label, value }) => <button type="button" key={label} onClick={() => setOutcome(outcome === value ? null : value)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${outcome === value ? "border-[hsl(248_62%_52%/0.5)] bg-[hsl(248_62%_52%/0.12)]" : "border-foreground/10 bg-background"}`}>{label}</button>)}</div></div>
      <label className="mt-5 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={followUpPlanned} onChange={(event) => setFollowUpPlanned(event.target.checked)} className="h-4 w-4" />I plan to follow up</label>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-6 flex justify-end"><Button type="button" onClick={() => { void generate(); }} disabled={saving || (!what.trim() && good.length === 0 && off.length === 0)}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Save and read the pattern</Button></div>
    </section>
  );
}

function JourneyItem({ item, removed, busy, onEdit, onRemove, onRestore }: { item: JourneyRecordItem; removed: boolean; busy: boolean; onEdit: () => void; onRemove: () => void; onRestore: () => void }) {
  const Icon = item.kind === "date" ? CalendarCheck : BookHeart;
  const positive = detailString(item, "whatWentWell");
  const difficult = detailString(item, "whatDidnt");
  return (
    <article className="rounded-3xl border border-foreground/10 bg-background/70 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-2 font-bold text-[hsl(248_62%_52%)]"><Icon className="h-4 w-4" /> {item.source.label}</span><span>{when(item.occurredAt)}</span></div>
      <h2 className="mt-3 font-serif text-xl font-bold">{item.title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.body}</p>
      {positive && <p className="mt-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">What felt good:</strong> {positive}</p>}
      {difficult && <p className="mt-1 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">What felt difficult:</strong> {difficult}</p>}
      <div className="mt-4 flex flex-wrap gap-4">
        {removed ? <button type="button" disabled={busy} onClick={onRestore} className="inline-flex items-center text-xs font-bold text-[hsl(248_62%_52%)] hover:underline disabled:opacity-50"><ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />Restore</button> : <><button type="button" onClick={onEdit} className="inline-flex items-center text-xs font-bold text-[hsl(248_62%_52%)] hover:underline"><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit here</button><button type="button" disabled={busy} onClick={onRemove} className="inline-flex items-center text-xs font-bold text-muted-foreground hover:text-destructive hover:underline disabled:opacity-50"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove</button><Link href={item.href} className="text-xs font-bold text-muted-foreground hover:underline">Open source record</Link></>}
      </div>
    </article>
  );
}

export default function Journey() {
  const [location] = useLocation();
  const [record, setRecord] = useState<JourneyRecordResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "reflection" | "date">("all");
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState<Composer | null>(() => shouldOpenGuidedDebrief(location, typeof window === "undefined" ? "" : window.location.search) ? { kind: "guided-date" } : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recordView, setRecordView] = useState<"active" | "trash">("active");
  const [busyItem, setBusyItem] = useState<string | null>(null);

  const load = useCallback((view: "active" | "trash" = recordView) => {
    setLoading(true);
    setError(null);
    void getJourneyRecord(view).then(setRecord).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, [recordView]);
  useEffect(() => { load(recordView); }, [load, recordView]);

  function saved(kind: "reflection" | "date") {
    setComposer(null);
    setNotice(kind === "reflection" ? "Reflection saved to your Journey." : "Date debrief saved to your Journey.");
    setRecordView("active");
    load("active");
  }

  function guidedSaved() {
    setNotice("Date debrief saved to your Journey.");
    setRecordView("active");
    load("active");
  }

  async function remove(item: JourneyRecordItem) {
    if (!window.confirm("Remove this moment from your Journey? You can restore it later.")) return;
    setBusyItem(item.id);
    setError(null);
    try {
      await removeJourneyItem(item);
      setNotice("Moment removed. It is still available under Recently removed.");
      load("active");
    } catch (err) {
      setError(err instanceof Error ? err.message : "This moment could not be removed.");
    } finally {
      setBusyItem(null);
    }
  }

  async function restore(item: JourneyRecordItem) {
    setBusyItem(item.id);
    setError(null);
    try {
      await restoreJourneyItem(item);
      setNotice("Moment restored to your Journey.");
      load("trash");
    } catch (err) {
      setError(err instanceof Error ? err.message : "This moment could not be restored.");
    } finally {
      setBusyItem(null);
    }
  }

  const records = useMemo(() => (record?.records ?? []).filter((item) => {
    if (filter !== "all" && item.kind !== filter) return false;
    const q = query.trim().toLowerCase();
    return !q || `${item.title} ${item.body} ${item.source.label}`.toLowerCase().includes(q);
  }), [record, filter, query]);

  return (
    <AppLayout>
      <main className="relative mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[hsl(248_62%_52%)]">Journey</p>
        <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight sm:text-5xl">Keep the thread, not a score.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">One private record of what happened, what you noticed, and what you want to try next.</p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => { setNotice(null); setComposer({ kind: "guided-date" }); }} className="flex items-center rounded-2xl border border-foreground/10 p-4 text-left text-sm font-bold hover:border-[hsl(248_62%_52%/0.35)]"><Plus className="mr-2 h-4 w-4" />Debrief a date</button>
          <button type="button" onClick={() => { setNotice(null); setComposer({ kind: "reflection" }); }} className="flex items-center rounded-2xl border border-foreground/10 p-4 text-left text-sm font-bold hover:border-[hsl(248_62%_52%/0.35)]"><Plus className="mr-2 h-4 w-4" />Add a reflection</button>
          <Link href="/copilot/weekly-plan" className="rounded-2xl border border-foreground/10 p-4 text-sm font-bold hover:border-[hsl(248_62%_52%/0.35)]">Choose a weekly experiment</Link>
        </div>

        {composer?.kind === "reflection" && <ReflectionComposer key={`reflection-${composer.item?.id ?? "new"}`} item={composer.item} onCancel={() => setComposer(null)} onSaved={() => saved("reflection")} />}
        {composer?.kind === "date" && <DateComposer key={`date-${composer.item?.id ?? "new"}`} item={composer.item} onCancel={() => setComposer(null)} onSaved={() => saved("date")} />}
        {composer?.kind === "guided-date" && <GuidedDateComposer onCancel={() => setComposer(null)} onSaved={guidedSaved} />}
        {notice && <p className="mt-5 rounded-2xl border border-[hsl(150_45%_45%/0.25)] bg-[hsl(150_45%_45%/0.08)] px-4 py-3 text-sm font-bold">{notice}</p>}

        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your Journey</div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">{error}<Button size="sm" variant="outline" className="ml-3" onClick={() => load()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div>
        ) : record ? (
          <section className="mt-10">
            <div className="rounded-3xl border border-[hsl(248_62%_52%/0.18)] bg-[hsl(248_62%_52%/0.06)] p-5"><p className="font-bold">{record.summary.headline}</p><p className="mt-2 text-sm text-muted-foreground">{record.summary.reflections} reflections · {record.summary.dates} date debriefs</p></div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2"><Button size="sm" variant={recordView === "active" ? "default" : "outline"} onClick={() => setRecordView("active")}>Journey</Button><Button size="sm" variant={recordView === "trash" ? "default" : "outline"} onClick={() => setRecordView("trash")}>Recently removed</Button><span className="mx-1 hidden h-8 border-l border-foreground/10 sm:block" />{(["all", "reflection", "date"] as const).map((value) => <Button key={value} size="sm" variant={filter === value ? "secondary" : "outline"} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "date" ? "Dates" : "Reflections"}</Button>)}</div><div className="relative sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your Journey" /></div></div>
            {records.length > 0 ? <div className="mt-5 space-y-4">{records.map((item) => <JourneyItem key={item.id} item={item} removed={recordView === "trash"} busy={busyItem === item.id} onRemove={() => { void remove(item); }} onRestore={() => { void restore(item); }} onEdit={() => { setNotice(null); setComposer({ kind: item.kind, item }); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}</div> : <div className="mt-5 rounded-3xl border border-foreground/10 p-10 text-center"><Sparkles className="mx-auto h-6 w-6 text-[hsl(248_62%_52%)]" /><p className="mt-3 font-serif text-xl font-bold">{recordView === "trash" ? "Nothing is waiting to be restored." : "No saved moments match this view."}</p><p className="mt-2 text-sm text-muted-foreground">{recordView === "trash" ? "Removed moments will stay recoverable here." : "Change the filter or capture the next moment you want to keep."}</p></div>}
          </section>
        ) : null}
      </main>
    </AppLayout>
  );
}
