import { useState } from "react";
import { Flag, Ban, MoreVertical, ShieldAlert } from "lucide-react";
import { useReportUser, useBlockUser, useUnblockUser } from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

// The closed set of reasons, mirroring SAFETY_REASONS on the server. Kept short
// and plain so the picker is fast and the founder review list reads clearly.
export const REASONS: { value: string; label: string }[] = [
  { value: "fake_profile", label: "Fake profile" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "scam", label: "Scam or money request" },
  { value: "underage", label: "Looks underage" },
  { value: "safety", label: "Safety concern" },
  { value: "other", label: "Something else" },
];

// Human-readable label for a stored block reason. Unknown or null reasons fall
// back to a neutral phrase so the blocked-members list always reads cleanly.
export function reasonLabel(reason: string | null | undefined): string {
  if (!reason) return "No reason given";
  return REASONS.find((r) => r.value === reason)?.label ?? "Other";
}

type Mode = "report" | "block";

export function ReportBlockMenu({
  targetUserId,
  context,
  onBlocked,
  label = "Safety options",
}: {
  targetUserId: string;
  context?: "match" | "conversation" | "profile";
  onBlocked?: (userId: string) => void;
  label?: string;
}) {
  const { toast } = useToast();
  const reportUser = useReportUser();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState<string>("");

  const reset = () => {
    setMode(null);
    setReason("");
  };

  const submit = () => {
    if (!reason) return;
    if (mode === "report") {
      reportUser.mutate(
        {
          data: {
            reportedUserId: targetUserId,
            reason: reason as never,
            context: context ?? null,
          },
        },
        {
          onSuccess: () => {
            toast({
              title: "Report sent",
              description:
                "Thank you. Our team reviews every report. This does not block them, you can block separately.",
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
    } else if (mode === "block") {
      blockUser.mutate(
        {
          data: { blockedUserId: targetUserId, reason: reason as never },
        },
        {
          onSuccess: () => {
            const t = toast({
              title: "Blocked",
              description:
                "You will not be matched with each other again.",
              action: (
                <ToastAction
                  altText="Undo block"
                  data-testid={`safety-undo-block-${targetUserId}`}
                  onClick={() => {
                    unblockUser.mutate(
                      { blockedUserId: targetUserId },
                      {
                        onSuccess: () =>
                          toast({
                            title: "Block removed",
                            description: "You can be matched again.",
                          }),
                        onError: () =>
                          toast({
                            title: "Could not undo",
                            description: "Please try again in a moment.",
                            variant: "destructive",
                          }),
                      },
                    );
                    t.dismiss();
                  }}
                >
                  Undo
                </ToastAction>
              ),
            });
            onBlocked?.(targetUserId);
            reset();
          },
          onError: () => {
            toast({
              title: "Could not block",
              description: "Please try again in a moment.",
              variant: "destructive",
            });
          },
        },
      );
    }
  };

  const pending = reportUser.isPending || blockUser.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            aria-label={label}
            data-testid={`safety-menu-${targetUserId}`}
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setReason("");
              setMode("report");
            }}
            data-testid={`safety-report-${targetUserId}`}
          >
            <Flag className="mr-2 h-4 w-4" aria-hidden="true" />
            Report
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setReason("");
              setMode("block");
            }}
            data-testid={`safety-block-${targetUserId}`}
          >
            <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
            Block
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mode !== null} onOpenChange={(o) => (!o ? reset() : null)}>
        <DialogContent data-testid="safety-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[hsl(var(--brand-rose))]" aria-hidden="true" />
              {mode === "block" ? "Block this person" : "Report this person"}
            </DialogTitle>
            <DialogDescription>
              {mode === "block"
                ? "Blocking removes any existing match and prevents the two of you from ever being matched again. You can undo it later from your account."
                : "Tell us what happened. Reports go to our team for review and never act on an account automatically."}
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
                data-testid={`safety-reason-${r.value}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={reset} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!reason || pending}
              variant={mode === "block" ? "destructive" : "default"}
              data-testid="safety-submit"
            >
              {mode === "block" ? "Block" : "Send report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
