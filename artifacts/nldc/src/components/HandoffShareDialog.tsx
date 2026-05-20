import { useEffect, useState } from "react";
import { Smartphone, Copy, Check, Loader2 } from "lucide-react";
import QRCode from "qrcode";
import { useIssueAnonymousClaimHandoff } from "@workspace/api-client-react";
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
  expiresAt: string;
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function HandoffShareDialog() {
  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
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

  async function handleOpenChange(next: boolean): Promise<void> {
    setOpen(next);
    if (!next) {
      setIssued(null);
      setCopied(false);
      return;
    }
    if (issued) return;
    try {
      const result = await issue.mutateAsync();
      const url = buildHandoffShareUrl(result.handoff);
      setIssued({ url, expiresAt: result.expiresAt });
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

  async function handleCopy(): Promise<void> {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.url);
      setCopied(true);
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

        {issued && (
          <div className="space-y-3">
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
            </div>
            <p className="text-[11px] text-muted-foreground">
              This link expires at {formatExpiry(issued.expiresAt)} and works
              only on the next sign-in. Don't share it with anyone else — it
              gives access to your anonymous audit.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
