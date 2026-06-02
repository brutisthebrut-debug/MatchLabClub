import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetReceiptsInbox,
  useActivateReceiptsInbox,
  useAddReceipts,
  getGetReceiptsInboxQueryKey,
  getGetMatchingStateQueryKey,
  type ReceiptsInbox,
  type ReceiptInputEntry,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMeta } from "@/hooks/useMeta";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";

const ACCENT = "hsl(326 100% 62%)";

// Shown to signed-out visitors and while a real inbox loads, so the surface is
// never empty. Clearly labelled as a sample where it is rendered. Real accounts
// always get their own inbox from the API.
const DEMO_INBOX: ReceiptsInbox = {
  handle: null,
  address: null,
  count: 6,
  recent: [
    {
      sender: "OpenTable",
      subject: "Your table for two is confirmed",
      receivedAt: "2026-05-28T19:10:00.000Z",
    },
    {
      sender: "Hinge",
      subject: "Your subscription renews soon",
      receivedAt: "2026-05-26T08:00:00.000Z",
    },
    {
      sender: "Airbnb",
      subject: "Your weekend trip is booked",
      receivedAt: "2026-05-21T14:42:00.000Z",
    },
    {
      sender: "ClassPass",
      subject: "See you at climbing on Thursday",
      receivedAt: "2026-05-19T17:30:00.000Z",
    },
  ],
};

const ACCESS = [
  "The sender and subject line of confirmations you forward or paste in",
  "The date and time each one arrived",
  "A simple running count, used to fill the receipts lane",
];

const EXCLUDES = [
  "The body of any email, ever",
  "Anything in your inbox you do not explicitly forward",
  "OAuth access to your Gmail, Outlook, or any account",
  "Your raw items are never sent to any AI prompt, only the count moves your readiness",
];

function ConsentList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "see" | "never";
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <span
              className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background:
                  tone === "see"
                    ? "hsl(142 55% 60%)"
                    : "hsl(var(--muted-foreground))",
              }}
            />
            <span className={tone === "see" ? "" : "text-muted-foreground"}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatReceivedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Each non-empty line is one confirmation. "Sender | Subject" splits into the
// two fields; a bare line is treated as the subject with no sender.
function parseEntries(raw: string): ReceiptInputEntry[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 50)
    .map((line) => {
      const sep = line.indexOf("|");
      if (sep === -1) {
        return { subject: line.slice(0, 300) };
      }
      const sender = line.slice(0, sep).trim();
      const subject = line.slice(sep + 1).trim();
      return {
        subject: (subject || line).slice(0, 300),
        sender: sender ? sender.slice(0, 200) : undefined,
      };
    })
    .filter((e) => e.subject.length > 0);
}

export default function Receipts() {
  useMeta(
    "Receipts inbox | MatchLab Club",
    "Forward order, booking, and ticket confirmations to your private address. We read the sender, subject, and timestamp. Never the body.",
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const climb = useReadinessClimb();

  const inboxQuery = useGetReceiptsInbox();
  const activate = useActivateReceiptsInbox();
  const add = useAddReceipts();

  const [raw, setRaw] = useState("");
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  // Real inbox when we have it, sample otherwise so the page is never empty.
  const live = inboxQuery.data;
  const inbox = live ?? DEMO_INBOX;
  const isSample = !live;

  const entries = parseEntries(raw);
  const entryCount = entries.length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetReceiptsInboxQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
  };

  const handleActivate = () => {
    activate.mutate(undefined, {
      onSuccess: (result) => {
        invalidate();
        toast({
          title: "Your forwarding address is live",
          description: result.address
            ? `Forward confirmations to ${result.address}.`
            : "Forward confirmations to your new address.",
        });
      },
      onError: () => {
        toast({
          title: "Could not set up your address",
          description: "Something went wrong on our end. Try again in a moment.",
          variant: "destructive",
        });
      },
    });
  };

  const handleCopy = async () => {
    if (!inbox.address) return;
    try {
      await navigator.clipboard.writeText(inbox.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Could not copy",
        description: "Copy the address by hand instead.",
        variant: "destructive",
      });
    }
  };

  const handleAdd = () => {
    if (entries.length === 0) {
      toast({
        title: "Add at least one confirmation",
        description:
          "Paste a few subject lines, one per line, so we have something to read.",
        variant: "destructive",
      });
      return;
    }
    climb.snapshot();
    add.mutate(
      { data: { entries } },
      {
        onSuccess: (result) => {
          setAdded(entries.length);
          setRaw("");
          invalidate();
          toast({
            title: "Receipts added",
            description: `Your inbox now holds ${result.count} ${
              result.count === 1 ? "confirmation" : "confirmations"
            }. A busier real-world rhythm reads as a fuller life outside dating.`,
          });
        },
        onError: () => {
          toast({
            title: "Could not add your receipts",
            description:
              "Something went wrong on our end. Try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/connections"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Connection Center
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span
              className="w-11 h-11 rounded-xl grid place-items-center"
              style={{ background: `${ACCENT} / 0.15`, color: ACCENT }}
            >
              <Mail className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-semibold">Receipts inbox</h1>
          </div>
          <p className="text-muted-foreground mb-8">
            Forward your order, booking, and ticket confirmations to a private
            address, or paste a few in by hand. We read the sender, the subject,
            and the time it arrived. We never read the body.
          </p>
        </motion.div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4" style={{ color: ACCENT }} />
                Your forwarding address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inbox.address ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-foreground/10 bg-muted/40 px-3 py-2 text-sm font-mono break-all">
                    {inbox.address}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    aria-label="Copy forwarding address"
                  >
                    {copied ? (
                      <Check className="w-4 h-4" style={{ color: "hsl(142 55% 60%)" }} />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {isSample
                      ? "Sign in and activate to get your own private address. Until then this is a sample view."
                      : "Activate your inbox to get a private address you can forward confirmations to."}
                  </p>
                  <Button
                    onClick={handleActivate}
                    disabled={activate.isPending || isSample}
                  >
                    {activate.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Activate my inbox
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Confirmations you forward to this address land here
                automatically. Headers only, never the body.
              </p>
            </CardContent>
          </Card>

          {added !== null ? (
            <Card>
              <CardContent className="py-10 text-center">
                <CheckCircle2
                  className="w-12 h-12 mx-auto mb-4"
                  style={{ color: "hsl(142 55% 60%)" }}
                />
                <h2 className="text-xl font-semibold mb-2">
                  {added} {added === 1 ? "confirmation" : "confirmations"} added
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  A busier real-world rhythm reads as a fuller life outside
                  dating. This fills the receipts lane of your Match Readiness.
                </p>
                {climb.before !== null && (
                  <ReadinessClimbReveal
                    from={climb.before}
                    to={climb.current}
                    className="max-w-sm mx-auto mb-6 rounded-2xl border border-foreground/10 p-6 text-left"
                  />
                )}
                <Button
                  onClick={() => {
                    setAdded(null);
                    climb.reset();
                  }}
                  variant="outline"
                >
                  Add more
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Or paste a few confirmations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  One confirmation per line. Use "Sender | Subject" to record who
                  sent it, or just paste the subject on its own.
                </p>
                <Textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder={
                    "OpenTable | Your table for two is confirmed\nHinge | Your subscription renews soon\nYour weekend trip is booked"
                  }
                  rows={6}
                  className="resize-y font-mono text-sm"
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {entryCount} {entryCount === 1 ? "confirmation" : "confirmations"}{" "}
                    ready
                  </span>
                  <Button
                    onClick={handleAdd}
                    disabled={add.isPending || entryCount === 0}
                  >
                    {add.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Add to my readiness
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
                  Recent confirmations
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {inbox.count} total{isSample ? " (sample)" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inbox.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing here yet. Forward your first confirmation or paste a
                  few in above.
                </p>
              ) : (
                <ul className="divide-y divide-foreground/10">
                  {inbox.recent.map((entry, i) => (
                    <li
                      key={`${entry.subject}-${entry.receivedAt}-${i}`}
                      className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {entry.subject}
                        </p>
                        {entry.sender && (
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.sender}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatReceivedAt(entry.receivedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" style={{ color: ACCENT }} />
                Before you forward
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-6">
              <ConsentList title="What we'll see" items={ACCESS} tone="see" />
              <ConsentList
                title="What we'll never touch"
                items={EXCLUDES}
                tone="never"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
