import { useEffect, useState } from "react";
import {
  Smartphone,
  Copy,
  Check,
  Loader2,
  Download,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import QRCode from "qrcode";
import {
  useIssueAnonymousClaimHandoff,
  getAnonymousClaimHandoffStatus,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { buildHandoffShareUrl } from "@/lib/handoffLink";

interface IssuedLink {
  url: string;
  /** Raw signed token, needed to poll the status endpoint. */
  handoff: string;
  expiresAt: string;
  /** True once this link has been shared at least once (copy or download). */
  wasShared: boolean;
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isExpired(iso: string): boolean {
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

export function HandoffShareDialog() {
  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);
  const issue = useIssueAnonymousClaimHandoff();

  useEffect(() => {
    if (!issued) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(issued.url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 192,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [issued]);

  // Poll the status endpoint while the dialog is open and the link has been
  // shared, so the originating device can surface a "transfer complete" state
  // as soon as the other device redeems. We only poll after the user has
  // actually shared the link — polling sooner would burn requests for a state
  // that can't change yet. We also stop polling once we see `redeemed: true`
  // or the link expires.
  useEffect(() => {
    if (!open) return;
    if (!issued) return;
    if (!issued.wasShared) return;
    if (redeemed) return;
    if (isExpired(issued.expiresAt)) return;

    let cancelled = false;
    const handoff = issued.handoff;

    async function checkOnce(): Promise<void> {
      try {
        const status = await getAnonymousClaimHandoffStatus({ handoff });
        if (cancelled) return;
        if (status.redeemed) setRedeemed(true);
      } catch {
        // Swallow — status polling is best-effort. The dialog still works.
      }
    }

    void checkOnce();
    const id = window.setInterval(checkOnce, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, issued, redeemed]);

  async function generateLink(): Promise<void> {
    try {
      const result = await issue.mutateAsync();
      const url = buildHandoffShareUrl(result.handoff);
      setIssued({
        url,
        handoff: result.handoff,
        expiresAt: result.expiresAt,
        wasShared: false,
      });
      setCopied(false);
      setRedeemed(false);
    } catch {
      toast({
        title: "Couldn't generate link",
        description:
          "We couldn't create a continue-on-another-device link. Try again in a moment.",
        variant: "destructive",
      });
      setOpen(false);
    }
  }

  async function handleOpenChange(next: boolean): Promise<void> {
    setOpen(next);
    if (!next) {
      // Keep `issued` so re-opening shows the same link rather than silently
      // minting a new token. The user must explicitly ask for a fresh one.
      setCopied(false);
      return;
    }
    // If there's no link yet, or the previous one has expired, generate one.
    if (!issued || isExpired(issued.expiresAt)) {
      await generateLink();
    }
  }

  async function handleGenerateNew(): Promise<void> {
    setIssued(null);
    setRedeemed(false);
    await generateLink();
  }

  function handleDownload(): void {
    if (!qrDataUrl) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23);
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `handoff-qr-${timestamp}.png`;
    a.click();
    setIssued((prev) => (prev ? { ...prev, wasShared: true } : prev));
  }

  async function handleCopy(): Promise<void> {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.url);
      setCopied(true);
      setIssued((prev) => (prev ? { ...prev, wasShared: true } : prev));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Select the link and copy it manually.",
        variant: "destructive",
      });
    }
  }

  const loading = issue.isPending && !issued;
  const expired = issued ? isExpired(issued.expiresAt) : false;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          data-testid="button-handoff-open"
        >
          <Smartphone className="w-3.5 h-3.5 mr-1.5" />
          Continue on another device
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Continue on another device</DialogTitle>
          <DialogDescription>
            Open this link on the device where you'll sign in. After you sign
            in there, your audit will be waiting for you.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div
            className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
            data-testid="handoff-loading"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating a secure link…
          </div>
        )}

        {issued && !expired && redeemed && (
          <div
            className="space-y-3 py-2 text-center"
            data-testid="handoff-redeemed"
          >
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                Transfer succeeded — check your dashboard
              </p>
              <p className="text-[12px] text-muted-foreground">
                Your audit is now waiting on the other device. You can close
                this window — no need to send the link again.
              </p>
            </div>
          </div>
        )}

        {issued && !expired && !redeemed && (
          <div className="space-y-3">
            {issued.wasShared && (
              <p
                className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800"
                data-testid="handoff-already-shared-notice"
              >
                You already shared this link. Each link works only once — if
                device C already used it, generate a fresh one below.
              </p>
            )}
            <div className="flex justify-center">
              <div
                className="rounded-lg bg-white p-3"
                data-testid="handoff-qr"
                aria-label="QR code for the continue-on-another-device link"
              >
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR code"
                    width={192}
                    height={192}
                    className="block h-48 w-48"
                  />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}
              </div>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Point your phone camera at the code, or copy the link below.
            </p>
            <div
              className="rounded-lg border border-white/10 bg-background/60 p-3 break-all text-xs font-mono"
              data-testid="handoff-url"
            >
              {issued.url}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleCopy}
                size="sm"
                className="flex-1"
                data-testid="button-handoff-copy"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy link
                  </>
                )}
              </Button>
              <Button
                onClick={handleDownload}
                size="sm"
                variant="outline"
                disabled={!qrDataUrl}
                data-testid="button-handoff-download-qr"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download QR
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              This link expires at {formatExpiry(issued.expiresAt)} and works
              only on the next sign-in. Don't share it with anyone else — it
              gives access to your anonymous audit.
            </p>
            {issued.wasShared && (
              <Button
                onClick={handleGenerateNew}
                size="sm"
                variant="ghost"
                disabled={issue.isPending}
                className="w-full text-muted-foreground"
                data-testid="button-handoff-generate-new"
              >
                {issue.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Generate a fresh link
              </Button>
            )}
          </div>
        )}

        {issued && expired && (
          <div className="space-y-3 text-center py-2">
            <p className="text-sm text-muted-foreground" data-testid="handoff-expired-notice">
              That link expired. Generate a new one to continue.
            </p>
            <Button
              onClick={handleGenerateNew}
              size="sm"
              disabled={issue.isPending}
              data-testid="button-handoff-generate-new"
            >
              {issue.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Generate a new link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
