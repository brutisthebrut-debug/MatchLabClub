import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { BookHeart, CalendarCheck, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getJourneyRecord, type JourneyRecordItem, type JourneyRecordResponse } from "@/lib/journeyRecord";

function when(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function JourneyItem({ item }: { item: JourneyRecordItem }) {
  const Icon = item.kind === "date" ? CalendarCheck : BookHeart;
  const positive = typeof item.details.whatWentWell === "string" ? item.details.whatWentWell : "";
  const difficult = typeof item.details.whatDidnt === "string" ? item.details.whatDidnt : "";
  return (
    <article className="rounded-3xl border border-foreground/10 bg-background/70 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2 font-bold text-[hsl(248_62%_52%)]"><Icon className="h-4 w-4" /> {item.source.label}</span>
        <span>{when(item.occurredAt)}</span>
      </div>
      <h2 className="mt-3 font-serif text-xl font-bold">{item.title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.body}</p>
      {positive && <p className="mt-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">What felt good:</strong> {positive}</p>}
      {difficult && <p className="mt-1 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">What felt difficult:</strong> {difficult}</p>}
      <Link href={item.href} className="mt-4 inline-flex text-xs font-bold text-[hsl(248_62%_52%)] hover:underline">Open source record</Link>
    </article>
  );
}

export default function Journey() {
  const [record, setRecord] = useState<JourneyRecordResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "reflection" | "date">("all");
  const [query, setQuery] = useState("");

  function load() {
    setLoading(true);
    setError(null);
    void getJourneyRecord().then(setRecord).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }
  useEffect(load, []);

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
          <Link href="/copilot/debrief" className="rounded-2xl border border-foreground/10 p-4 text-sm font-bold hover:border-[hsl(248_62%_52%/0.35)]">Debrief a date</Link>
          <Link href="/mirror/journal" className="rounded-2xl border border-foreground/10 p-4 text-sm font-bold hover:border-[hsl(248_62%_52%/0.35)]">Write or edit a reflection</Link>
          <Link href="/copilot/weekly-plan" className="rounded-2xl border border-foreground/10 p-4 text-sm font-bold hover:border-[hsl(248_62%_52%/0.35)]">Choose a weekly experiment</Link>
        </div>

        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your Journey</div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">{error}<Button size="sm" variant="outline" className="ml-3" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div>
        ) : record ? (
          <section className="mt-10">
            <div className="rounded-3xl border border-[hsl(248_62%_52%/0.18)] bg-[hsl(248_62%_52%/0.06)] p-5">
              <p className="font-bold">{record.summary.headline}</p>
              <p className="mt-2 text-sm text-muted-foreground">{record.summary.reflections} reflections · {record.summary.dates} date debriefs</p>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                {(["all", "reflection", "date"] as const).map((value) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "date" ? "Dates" : "Reflections"}</Button>)}
              </div>
              <div className="relative sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your Journey" /></div>
            </div>
            {records.length > 0 ? <div className="mt-5 space-y-4">{records.map((item) => <JourneyItem key={item.id} item={item} />)}</div> : <div className="mt-5 rounded-3xl border border-foreground/10 p-10 text-center"><Sparkles className="mx-auto h-6 w-6 text-[hsl(248_62%_52%)]" /><p className="mt-3 font-serif text-xl font-bold">No saved moments match this view.</p><p className="mt-2 text-sm text-muted-foreground">Change the filter or capture the next moment you want to keep.</p></div>}
          </section>
        ) : null}
      </main>
    </AppLayout>
  );
}
