import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Heart, MessageCircle, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useGetConnections,
  getGetConnectionsQueryKey,
  type Connection,
} from "@workspace/api-client-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.45,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

// A signed-out visitor sees a real, filled-in list instead of an empty one. The
// demo never touches the server and is clearly labelled as a sample.
const DEMO_CONNECTIONS: Connection[] = [
  {
    id: "demo-1",
    counterpartUserId: "demo-a",
    status: "active",
    closedReason: null,
    closedByYou: false,
    unreadCount: 2,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    lastMessageAt: new Date(Date.now() - 3_600_000).toISOString(),
    lastMessagePreview: "That hiking spot looks unreal, when are you free?",
  },
  {
    id: "demo-2",
    counterpartUserId: "demo-b",
    status: "active",
    closedReason: null,
    closedByYou: false,
    unreadCount: 0,
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
    lastMessageAt: new Date(Date.now() - 7_200_000).toISOString(),
    lastMessagePreview: "Same, I could talk about that for hours.",
  },
];

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function ConnectionRow({
  connection,
  isDemo,
}: {
  connection: Connection;
  isDemo: boolean;
}) {
  const closed = connection.status === "closed";
  const body = (
    <div
      className="glass border border-white/10 rounded-2xl p-4 flex items-center gap-4 transition-colors hover:border-white/25"
      data-testid={`connection-row-${connection.id}`}
    >
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(326_100%_62%)] flex items-center justify-center flex-shrink-0">
        <Heart className="w-5 h-5 text-white" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">
            A mutual match
          </p>
          {closed && (
            <Badge variant="secondary" className="text-[10px]">
              Closed
            </Badge>
          )}
          {connection.unreadCount > 0 && (
            <span
              className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[hsl(326_100%_62%)] text-[10px] font-bold text-white"
              data-testid={`connection-unread-${connection.id}`}
            >
              {connection.unreadCount}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
          {connection.lastMessagePreview ??
            "You matched. Say hello to start the conversation."}
        </p>
      </div>
      <div className="text-[10px] text-muted-foreground/50 flex-shrink-0">
        {relativeTime(connection.lastMessageAt ?? connection.createdAt)}
      </div>
    </div>
  );

  if (isDemo) return body;
  return (
    <Link href={`/matches/${connection.id}`} className="block">
      {body}
    </Link>
  );
}

export default function Matches() {
  useMeta(
    "Your matches",
    "Every mutual match lives here. Open one to start a real, safe conversation.",
  );

  const { isAuthenticated, login } = useAuth();
  const isDemo = !isAuthenticated;

  const { data: serverData, isLoading } = useGetConnections({
    query: {
      queryKey: getGetConnectionsQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });

  const connections = isDemo ? DEMO_CONNECTIONS : (serverData ?? []);

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-indigo fixed w-[400px] h-[400px] -top-20 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] flex items-center justify-center shadow-[0_0_16px_hsl(245_58%_62%/0.4)]">
                <Users className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-[hsl(245_70%_78%)]">
                Mutual matches
              </p>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Your matches
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              When you and someone both say yes, the conversation opens here.
              This is the payoff of the readiness climb: real people, near you,
              ready to talk.
            </p>
          </motion.div>

          {isDemo && (
            <motion.div
              {...fadeUp(0.03)}
              className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              data-testid="banner-matches-sample"
            >
              <p className="text-sm text-muted-foreground">
                This is a sample. Sign in to see your real matches and start
                talking.
              </p>
              <Button
                onClick={() => login()}
                size="sm"
                className="rounded-full"
                data-testid="button-matches-signin"
              >
                Sign in
              </Button>
            </motion.div>
          )}

          {!isDemo && isLoading && (
            <p className="text-sm text-muted-foreground/60">
              Loading your matches...
            </p>
          )}

          {!isDemo && !isLoading && connections.length === 0 && (
            <motion.div
              {...fadeUp(0.05)}
              className="glass border border-white/10 rounded-2xl p-8 text-center"
              data-testid="matches-empty"
            >
              <MessageCircle
                className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-foreground mb-1">
                No matches yet
              </p>
              <p className="text-xs text-muted-foreground/70 mb-4 max-w-sm mx-auto">
                Keep building your Match Readiness and respond to proposals. The
                more the machine knows you, the better it matches you.
              </p>
              <Link href="/matching">
                <Button size="sm" className="rounded-full">
                  Go to matching
                  <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
                </Button>
              </Link>
            </motion.div>
          )}

          <div className="space-y-3">
            {connections.map((c, i) => (
              <motion.div key={c.id} {...fadeUp(0.05 + i * 0.03)}>
                <ConnectionRow connection={c} isDemo={isDemo} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
