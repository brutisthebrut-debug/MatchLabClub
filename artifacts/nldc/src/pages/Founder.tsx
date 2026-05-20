import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import {
  getFounderStats, getLeads, getPurchaseInterestList,
  type FounderStats, type Lead, type PurchaseInterest
} from "@/lib/apiClient";
import { useListAudits, useGetWaitlistStats } from "@workspace/api-client-react";
import { Lock, Users, ShoppingBag, BarChart3, Inbox, ListChecks, RefreshCw } from "lucide-react";

const FOUNDER_KEY =
  (import.meta.env as Record<string, string>).VITE_FOUNDER_KEY || "nldc2024";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="glass rounded-2xl p-5 flex items-center gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}20`, border: `1px solid ${color}40` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TableShell({ headers, rows }: { headers: string[]; rows: (string | number | null | undefined)[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground/60 italic py-6 text-center">No records yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-white/8">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8 bg-white/3">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                  {cell ?? <span className="text-muted-foreground/30 italic">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function LockedView({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === FOUNDER_KEY) {
      onSubmit(value);
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="glass rounded-2xl p-10 max-w-sm w-full text-center space-y-6">
        <div className="w-14 h-14 rounded-full bg-[hsl(268_52%_68%/0.15)] flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7 text-[hsl(268_52%_68%)]" />
        </div>
        <div>
          <h1 className="font-serif text-xl font-bold text-foreground">Founder Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-2">Enter your founder key to continue.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            placeholder="Founder key"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm outline-none focus:border-[hsl(268_52%_68%/0.5)] transition-colors"
          />
          {error && <p className="text-xs text-red-400">Incorrect key.</p>}
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            Unlock Dashboard
          </button>
        </form>
        <p className="text-xs text-muted-foreground/40">
          Default key: <code className="font-mono">nldc2024</code> — set <code className="font-mono">VITE_FOUNDER_KEY</code> to change it.
        </p>
      </div>
    </div>
  );
}

type Tab = "overview" | "leads" | "audits" | "purchases" | "waitlist";

function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<FounderStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: audits } = useListAudits();
  const { data: waitlistStats } = useGetWaitlistStats();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getFounderStats().then(setStats).catch(() => {}),
      getLeads().then(setLeads).catch(() => {}),
      getPurchaseInterestList().then(setPurchases).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [refreshKey]);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "leads", label: `Leads (${leads.length})`, icon: Inbox },
    { id: "audits", label: `Audits (${audits?.length ?? 0})`, icon: ListChecks },
    { id: "purchases", label: `Purchase Interest (${purchases.length})`, icon: ShoppingBag },
    { id: "waitlist", label: `Waitlist (${waitlistStats?.totalCount ?? 0})`, icon: Users },
  ];

  return (
    <div className="container mx-auto px-4 md:px-6 py-12 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Founder Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Live data — your app, your numbers.</p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              tab === id
                ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_52%_78%)] border border-[hsl(268_52%_68%/0.3)]"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Leads captured" value={stats?.leads ?? "—"} icon={Inbox} color="hsl(268 52% 68%)" />
            <StatCard label="Purchase interest" value={stats?.purchaseInterest ?? "—"} icon={ShoppingBag} color="hsl(348 55% 58%)" />
            <StatCard label="Audits completed" value={stats?.audits ?? "—"} icon={ListChecks} color="hsl(142 55% 50%)" />
            <StatCard label="Waitlist signups" value={stats?.waitlist ?? "—"} icon={Users} color="hsl(43 65% 52%)" />
            <StatCard label="Message sessions" value={stats?.messages ?? "—"} icon={BarChart3} color="hsl(190 55% 52%)" />
          </div>

          <div className="glass rounded-2xl p-6 space-y-3">
            <h2 className="font-semibold text-sm text-foreground">Recent leads</h2>
            <TableShell
              headers={["Name", "Email", "Source", "Interest", "Date"]}
              rows={leads.slice(0, 5).map((l) => [l.firstName, l.email, l.source, l.interest, fmtDate(l.createdAt)])}
            />
          </div>
        </div>
      )}

      {/* Leads */}
      {tab === "leads" && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">All leads ({leads.length})</h2>
          <TableShell
            headers={["ID", "Name", "Email", "Source", "Interest", "Date"]}
            rows={leads.map((l) => [l.id, l.firstName, l.email, l.source, l.interest, fmtDate(l.createdAt)])}
          />
        </div>
      )}

      {/* Audits */}
      {tab === "audits" && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">All audits ({audits?.length ?? 0})</h2>
          <TableShell
            headers={["ID", "Name", "Age", "Goal", "Score", "Status", "Date"]}
            rows={(audits ?? []).map((a) => [
              a.id, a.firstName, a.age, a.datingGoal,
              a.readinessScore ?? "—", a.status, fmtDate(a.createdAt),
            ])}
          />
        </div>
      )}

      {/* Purchase interest */}
      {tab === "purchases" && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Purchase interest ({purchases.length})</h2>
          <TableShell
            headers={["ID", "Name", "Email", "Product", "Amount", "Source", "Status", "Date"]}
            rows={purchases.map((p) => [
              p.id, p.firstName, p.email, p.product,
              p.amountCents ? `$${(p.amountCents / 100).toFixed(0)}` : "Free",
              p.source, p.status, fmtDate(p.createdAt),
            ])}
          />
        </div>
      )}

      {/* Waitlist */}
      {tab === "waitlist" && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Waitlist ({waitlistStats?.totalCount ?? 0} signups)</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{waitlistStats?.totalCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total signups</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{waitlistStats?.spotsRemaining ?? 0}</p>
              <p className="text-xs text-muted-foreground">Spots remaining</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{waitlistStats?.nextMilestone ?? 0}</p>
              <p className="text-xs text-muted-foreground">Next milestone</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/50 italic">Detailed waitlist list view coming soon.</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground/30 mt-12 text-center">
        Founder demo mode · Full auth + multi-user coming in V3
      </p>
    </div>
  );
}

export default function Founder() {
  useMeta("Founder Dashboard", "NLDC Founder Dashboard — live app data.");

  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const keyParam = params.get("key");
  const [authenticated, setAuthenticated] = useState(keyParam === FOUNDER_KEY);

  if (!authenticated) {
    return (
      <AppLayout>
        <LockedView onSubmit={() => setAuthenticated(true)} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  );
}
