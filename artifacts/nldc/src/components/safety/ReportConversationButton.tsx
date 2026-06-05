import { useState } from "react";
import { Flag, ShieldAlert } from "lucide-react";
import { useReportUser } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { REASONS } from "@/components/safety/ReportBlockMenu";

// Report affordance for the message coach. The person being discussed lives on
// another dating app and has no account here, so this files an off-platform
// report (no reportedUserId). We send only the derived context the user already
// sees on screen (app name, the name they gave, and the flagged signals), never
// the raw conversation they pasted in.
export function ReportConversationButton({
  sourceApp,
  matchName,
  signals,
  risk,
}: {
  sourceApp: string | null;
  matchName: string;
  signals: string[];
  risk: string;
}) {
  const { toast } = useToast();
  const reportUser = useReportUser();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("scam");

  const reset = () => {
    setOpen(false);
    setReason("scam");
  };

  const submit = () => {
    if (!reason) return;
    const flagged = signals.slice(0, 6).join("; ");
    const note = [`Coach flagged a ${risk} romance-scam pattern.`, flagged]
      .filter(Boolean)
      .join(" ")
      .slice(0, 1000);
    reportUser.mutate(
      {
        data: {
          subjectType: "off_platform",
          reason: reason as never,
          context: "conversation",
          externalApp: sourceApp || null,
          externalLabel: matchName?.trim() ? matchName.trim() : null,
          note,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Report sent",
            description:
              "Thank you. Our team reviews every report. Stay safe and trust your read.",
          });
          reset();
        },
        onError: () => {
          toast({
            title: "Could not send report",
            description: "Please try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setReason("scam");
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 text-xs font-medium mt-3 ml-4 text-[hsl(var(--brand-rose))] hover:underline"
        data-testid="button-report-conversation"
      >
        <Flag className="w-3.5 h-3.5" aria-hidden="true" />
        Report this conversation
      </button>

      <Dialog open={open} onOpenChange={(o) => (!o ? reset() : null)}>
        <DialogContent data-testid="report-conversation-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert
                className="h-5 w-5 text-[hsl(var(--brand-rose))]"
                aria-hidden="true"
              />
              Report this conversation
            </DialogTitle>
            <DialogDescription>
              This person is on another app, so there is no account to block
              here. Your report goes to our team for review and helps us spot
              patterns. We only send the app name, the name you gave, and the
              flags above, never the conversation itself.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={`text-left rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                  reason === r.value
                    ? "border-[hsl(248_62%_52%/0.5)] bg-[hsl(248_62%_52%/0.12)] text-foreground"
                    : "border-foreground/10 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]"
                }`}
                data-testid={`report-conversation-reason-${r.value}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={reset}
              disabled={reportUser.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!reason || reportUser.isPending}
              data-testid="report-conversation-submit"
            >
              Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
