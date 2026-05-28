import { PLAYBOOK, type PlaybookEntry } from "@workspace/echo";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function titleFromId(id: string): string {
  return id
    .split("-")
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}

function PlaybookCard({ entry }: { entry: PlaybookEntry }) {
  return (
    <div
      className="glass rounded-2xl p-5 space-y-3"
      data-testid={`echo-playbook-card-${entry.id}`}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-serif font-bold text-base text-foreground leading-tight">
          {titleFromId(entry.id)}
        </h3>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60">
          {formatDate(entry.date)}
        </span>
      </div>
      <p className="text-sm text-foreground/85 leading-relaxed">{entry.decision}</p>
      <div className="pt-1">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] italic bg-white/5 border border-white/10 text-muted-foreground/80">
          <span className="font-semibold not-italic text-muted-foreground/60">
            Revisit when:
          </span>
          <span className="italic">{entry.revisitWhen}</span>
        </span>
      </div>
    </div>
  );
}

export function EchoPlaybookPanel() {
  return (
    <section className="space-y-4" data-testid="echo-playbook-panel">
      <div className="space-y-1">
        <h2 className="font-serif font-bold text-xl text-foreground">Echo's playbook</h2>
        <p className="text-sm text-muted-foreground/70">
          The strategic decisions on the table right now.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLAYBOOK.map((entry) => (
          <PlaybookCard key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
}
