import { motion, type Variants } from "framer-motion";
import { Ban, Loader2, ShieldCheck, UserX } from "lucide-react";
import {
  useListSafetyBlocks,
  useUnblockUser,
  getListSafetyBlocksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { reasonLabel } from "./ReportBlockMenu";

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

function formatBlockedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BlockedMembersSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const blocksQuery = useListSafetyBlocks();
  const unblockUser = useUnblockUser();

  const blocks = [...(blocksQuery.data?.blocks ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const handleUnblock = (blockedUserId: string) => {
    unblockUser.mutate(
      { blockedUserId },
      {
        onSuccess: () => {
          toast({
            title: "Block removed",
            description: "You can be matched with each other again.",
          });
          void queryClient.invalidateQueries({
            queryKey: getListSafetyBlocksQueryKey(),
          });
        },
        onError: () => {
          toast({
            title: "Could not unblock",
            description: "Please try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <motion.div
      variants={itemVariants}
      className="glass rounded-[2rem] p-8 md:p-10 space-y-6 border border-border/50 shadow-sm"
      data-testid="card-blocked-members"
    >
      <div className="flex flex-col md:flex-row items-start gap-6">
        <div className="h-14 w-14 rounded-[1.5rem] bg-[hsl(348_55%_65%/0.12)] flex items-center justify-center flex-shrink-0 shadow-sm border border-[hsl(348_55%_65%/0.2)]">
          <Ban className="h-6 w-6 text-[hsl(348_55%_55%)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-2xl font-bold text-foreground tracking-tight">
            Blocked members
          </h3>
          <p className="text-base text-muted-foreground mt-3 leading-relaxed">
            Everyone you've blocked, newest first. Blocked people can't be matched
            with you. Unblock anyone here to allow matching again.
          </p>
        </div>
      </div>

      {blocksQuery.isLoading ? (
        <div className="grid gap-3 md:ml-[5rem]" data-testid="blocked-members-loading">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 p-5 rounded-[1.5rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04]"
            >
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40 rounded-full" />
                <Skeleton className="h-4 w-28 rounded-full" />
              </div>
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          ))}
        </div>
      ) : blocksQuery.isError ? (
        <p
          className="text-base text-[hsl(348_55%_55%)] p-5 bg-[hsl(348_55%_65%/0.1)] rounded-[1.5rem] md:ml-[5rem]"
          data-testid="blocked-members-error"
        >
          Couldn't load your blocked members. Please refresh and try again.
        </p>
      ) : blocks.length === 0 ? (
        <div
          className="flex flex-col items-center text-center gap-3 p-8 rounded-[1.5rem] bg-black/[0.02] dark:bg-white/[0.02] border border-dashed border-border/60 md:ml-[5rem]"
          data-testid="blocked-members-empty"
        >
          <div className="h-12 w-12 rounded-full bg-[hsl(160_50%_45%/0.12)] flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-[hsl(160_50%_40%)]" />
          </div>
          <p className="text-base font-semibold text-foreground">
            You haven't blocked anyone
          </p>
          <p className="text-sm text-muted-foreground max-w-sm">
            When you block someone, they'll show up here so you can review or
            reverse it any time.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:ml-[5rem]" data-testid="blocked-members-list">
          {blocks.map((block) => {
            const pending =
              unblockUser.isPending &&
              unblockUser.variables?.blockedUserId === block.blockedUserId;
            const blockedDate = formatBlockedDate(block.createdAt);
            return (
              <div
                key={block.blockedUserId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-[1.5rem] bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                data-testid={`blocked-member-${block.blockedUserId}`}
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className="h-11 w-11 rounded-full bg-[hsl(348_55%_65%/0.12)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <UserX className="h-5 w-5 text-[hsl(348_55%_55%)]" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-base font-semibold text-foreground"
                      data-testid={`blocked-member-reason-${block.blockedUserId}`}
                    >
                      {reasonLabel(block.reason)}
                    </p>
                    {blockedDate ? (
                      <p
                        className="text-sm text-muted-foreground mt-1"
                        data-testid={`blocked-member-date-${block.blockedUserId}`}
                      >
                        Blocked {blockedDate}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleUnblock(block.blockedUserId)}
                  disabled={pending}
                  className="w-full sm:w-auto rounded-full h-10 px-5 text-sm font-semibold border-border hover:bg-black/5 hover:text-foreground flex-shrink-0"
                  data-testid={`button-unblock-${block.blockedUserId}`}
                >
                  {pending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Unblock
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
