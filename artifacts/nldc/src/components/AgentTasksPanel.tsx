import { withAlpha } from "@/lib/brandColor";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { CheckCircle2, Circle, ArrowRight, RotateCcw } from "lucide-react";

export interface AgentTask {
  id: string;
  title: string;
  desc: string;
  href?: string;
  status: "suggested" | "accepted" | "done" | "skipped";
  addedAt: string;
}

const DEFAULT_TASKS: Omit<AgentTask, "addedAt">[] = [
  { id: "t1", title: "Complete your Signal Audit", desc: "3-min baseline, sets your starting score", href: "/start", status: "suggested" },
  { id: "t2", title: "Rewrite one profile prompt", desc: "Swap a generic line for something specific to you", href: "/glow-up", status: "suggested" },
  { id: "t3", title: "Try one message opener", desc: "Use Next Message → pick the option that fits", href: "/next-message", status: "suggested" },
  { id: "t4", title: "Log a win or observation", desc: "Small notes build patterns you can actually use", href: "/progress/timeline", status: "suggested" },
  { id: "t5", title: "Run a post-date debrief", desc: "Capture what felt good or off while it's still fresh", href: "/copilot/debrief", status: "suggested" },
  { id: "t6", title: "Check your Wellness profile", desc: "8 readiness dimensions, usually takes about 4 minutes", href: "/wellness", status: "suggested" },
  { id: "t7", title: "Review your next best action", desc: "Your dashboard surfaces the move with the most leverage", href: "/dashboard", status: "suggested" },
];

const STATUS_COLOR: Record<AgentTask["status"], string> = {
  suggested: "hsl(228 18% 55%)",
  accepted: "hsl(var(--brand-indigo))",
  done: "hsl(var(--brand-green))",
  skipped: "hsl(228 18% 38%)",
};
const STATUS_LABEL: Record<AgentTask["status"], string> = {
  suggested: "Suggested",
  accepted: "Accepted",
  done: "Done",
  skipped: "Skipped",
};

function freshTasks(): AgentTask[] {
  const now = new Date().toISOString();
  return DEFAULT_TASKS.map(t => ({...t, addedAt: now }));
}
function loadTasks(): AgentTask[] {
  try {
  const raw = localStorage.getItem("nldc_agent_tasks");
  if (raw) return JSON.parse(raw) as AgentTask[];
  } catch { /**/ }
  return freshTasks();
}
function save(tasks: AgentTask[]) {
  try { localStorage.setItem("nldc_agent_tasks", JSON.stringify(tasks)); } catch { /**/ }
}

export function AgentTasksPanel() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [filter, setFilter] = useState<"active" | "all">("active");

  useEffect(() => { setTasks(loadTasks()); }, []);

  function update(id: string, status: AgentTask["status"]) {
  setTasks(prev => { const next = prev.map(t => t.id === id ? {...t, status } : t); save(next); return next; });
  }
  function reset() {
  const t = freshTasks(); setTasks(t); save(t);
  }

  const active = tasks.filter(t => t.status === "suggested" || t.status === "accepted");
  const doneN = tasks.filter(t => t.status === "done").length;
  const shown = filter === "active" ? active : tasks;

  return (
  <div className="glass border border-white/8 rounded-2xl overflow-hidden">
  {/* Header */}
  <div className="px-4 py-3.5 border-b border-white/6">
  <div className="flex items-center justify-between mb-0.5">
  <p className="text-sm font-semibold text-foreground">Your Next Moves</p>
  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[hsl(248_62%_52%/0.15)] text-[hsl(248_62%_62%)]">
  {doneN}/{tasks.length} done
  </span>
  </div>
  <p className="text-[11px] text-muted-foreground/55">You decide what to act on, not the app</p>
  <div className="flex gap-1.5 mt-2.5">
  {(["active", "all"] as const).map(f => (
  <button key={f} onClick={() => setFilter(f)}
  className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full transition-colors ${filter === f ? "bg-white/8 text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground"}`}>
  {f === "active" ? `Active (${active.length})` : "All"}
  </button>
  ))}
  </div>
  </div>

  {/* Task list */}
  <div className="divide-y divide-white/4 max-h-[440px] overflow-y-auto">
  {shown.length === 0 ? (
  <div className="px-4 py-8 text-center">
  <CheckCircle2 className="w-8 h-8 text-[hsl(142_55%_60%)] mx-auto mb-2" />
  <p className="text-sm font-semibold text-foreground mb-1">All caught up!</p>
  <p className="text-xs text-muted-foreground mb-3">You've cleared all the active tasks.</p>
  <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto">
  <RotateCcw className="w-3 h-3" /> Reset suggestions
  </button>
  </div>
  ) : shown.map(task => (
  <div key={task.id} className={`p-3 transition-opacity ${task.status === "done" || task.status === "skipped" ? "opacity-40" : ""}`}>
  <div className="flex items-start gap-2.5">
  <button onClick={() => update(task.id, task.status === "done" ? "accepted" : "done")} className="mt-0.5 flex-shrink-0">
  {task.status === "done"
  ? <CheckCircle2 className="w-4 h-4 text-[hsl(142_55%_60%)]" />
  : <Circle className="w-4 h-4 text-muted-foreground/25 hover:text-muted-foreground/60 transition-colors" />
  }
  </button>
  <div className="flex-1 min-w-0">
  <div className="flex items-start justify-between gap-2 mb-0.5">
  <p className="text-xs font-semibold text-foreground leading-snug">{task.title}</p>
  <span className="text-[9px] font-bold uppercase tracking-wide flex-shrink-0 px-1.5 py-0.5 rounded-full"
  style={{ background: `${withAlpha(STATUS_COLOR[task.status], 0.15)}`, color: STATUS_COLOR[task.status] }}>
  {STATUS_LABEL[task.status]}
  </span>
  </div>
  <p className="text-[11px] text-muted-foreground/55 leading-snug">{task.desc}</p>
  {(task.status === "suggested" || task.status === "accepted") && (
  <div className="flex items-center gap-2 mt-1.5">
  {task.status === "suggested" && (
  <button onClick={() => update(task.id, "accepted")}
  className="text-[10px] font-semibold text-[hsl(248_62%_62%)] hover:text-[hsl(248_62%_88%)] transition-colors">
  Accept
  </button>
  )}
  {task.href && (
  <Link href={task.href} className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground/40 hover:text-muted-foreground transition-colors">
  Open <ArrowRight className="w-2.5 h-2.5" />
  </Link>
  )}
  <button onClick={() => update(task.id, "skipped")}
  className="text-[10px] text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors ml-auto">
  Skip
  </button>
  </div>
  )}
  </div>
  </div>
  </div>
  ))}
  </div>
  </div>
  );
}