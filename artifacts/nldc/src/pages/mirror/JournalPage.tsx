import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListJournalEntries,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
  useRestoreJournalEntry,
  getListJournalEntriesQueryKey,
  type JournalEntry,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  ArrowLeft,
  BookOpen,
  Search,
  Trash2,
  Pencil,
  RotateCcw,
  Inbox,
} from "lucide-react";

function fmtWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function useUrlState() {
  const [location, setLocation] = useLocation();
  const params = useMemo(() => {
    const idx = location.indexOf("?");
    return new URLSearchParams(idx >= 0 ? location.slice(idx) : "");
  }, [location]);
  const setParams = useCallback(
    (next: URLSearchParams) => {
      const base = location.split("?")[0];
      const s = next.toString();
      setLocation(s ? `${base}?${s}` : base);
    },
    [location, setLocation],
  );
  return { params, setParams };
}

export default function JournalPage() {
  useMeta(
    "Journal",
    "Read, search, and edit your reflections. Soft-deleted entries can be restored from the trash view.",
  );
  const { params, setParams } = useUrlState();
  const view: "trash" | "active" = params.get("view") === "trash" ? "trash" : "active";
  const q = params.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const listParams = useMemo(
    () => ({
      view,
      ...(q ? { q } : {}),
      limit: 100,
    }),
    [view, q],
  );
  const { data, isLoading, isError } = useListJournalEntries(listParams);
  const update = useUpdateJournalEntry();
  const del = useDeleteJournalEntry();
  const restore = useRestoreJournalEntry();

  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftTags, setDraftTags] = useState("");

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
  }, [queryClient]);

  function openEdit(entry: JournalEntry) {
    setEditing(entry);
    setDraftBody(entry.body);
    setDraftPrompt(entry.prompt ?? "");
    setDraftTags((entry.tags ?? []).join(", "));
  }

  function saveEdit() {
    if (!editing) return;
    const body = draftBody.trim();
    if (!body) return;
    const tags = draftTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
    update.mutate(
      {
        id: editing.id,
        data: {
          body,
          prompt: draftPrompt.trim() || null,
          tags,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setEditing(null);
          toast({ title: "Saved", description: "Your reflection was updated." });
        },
        onError: () =>
          toast({
            title: "Couldn't save",
            description: "Please try again in a moment.",
            variant: "destructive",
          }),
      },
    );
  }

  function softDelete(entry: JournalEntry) {
    del.mutate(
      { id: entry.id },
      {
        onSuccess: () => {
          invalidate();
          const t = toast({
            title: "Reflection moved to trash",
            description: "It will be permanently deleted after 30 days.",
            duration: 8000,
            action: (
              <ToastAction
                altText="Undo delete"
                onClick={() => {
                  restore.mutate(
                    { id: entry.id },
                    { onSuccess: () => invalidate() },
                  );
                  t.dismiss();
                }}
              >
                Undo
              </ToastAction>
            ),
          });
        },
        onError: () =>
          toast({
            title: "Couldn't delete",
            description: "Please try again in a moment.",
            variant: "destructive",
          }),
      },
    );
  }

  function handleRestore(entry: JournalEntry) {
    restore.mutate(
      { id: entry.id },
      {
        onSuccess: () => {
          invalidate();
          toast({
            title: "Restored",
            description: "Your reflection is back in your journal.",
          });
        },
        onError: () =>
          toast({
            title: "Couldn't restore",
            description: "Please try again in a moment.",
            variant: "destructive",
          }),
      },
    );
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params);
    const value = searchInput.trim();
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next);
  }

  function setView(v: "active" | "trash") {
    const next = new URLSearchParams(params);
    if (v === "trash") next.set("view", "trash");
    else next.delete("view");
    setParams(next);
  }

  const entries = data?.entries ?? [];

  return (
    <AppLayout>
      <div className="container mx-auto max-w-3xl px-4 py-10 md:py-12">
        <Link
          href="/your-mirror"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          data-testid="link-back-mirror"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Your Mirror
        </Link>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                Journal
              </span>
            </div>
            <h1 className="font-serif text-3xl font-bold md:text-4xl">
              Your reflections
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Every reflection you've saved — from weekly plans, debriefs, and
              freeform notes. Search, edit, or move one to the trash; restore
              within 30 days.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            variant={view === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("active")}
            data-testid="tab-journal-active"
          >
            Active
          </Button>
          <Button
            variant={view === "trash" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("trash")}
            data-testid="tab-journal-trash"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Trash
          </Button>
        </div>

        <form onSubmit={submitSearch} className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search reflections…"
              className="pl-9"
              data-testid="input-search-journal"
            />
          </div>
          <Button type="submit" variant="secondary" data-testid="button-search-journal">
            Search
          </Button>
        </form>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
            Couldn't load your reflections. Please refresh in a moment.
          </div>
        ) : entries.length === 0 ? (
          <div
            className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center"
            data-testid="empty-journal"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-serif text-lg font-semibold">
              {view === "trash"
                ? "Nothing in the trash"
                : q
                  ? "No matches"
                  : "No reflections yet"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              {view === "trash"
                ? "Deleted reflections show up here for 30 days."
                : q
                  ? "Try a different search term."
                  : "Build a Weekly Growth Plan or run a Debrief to start your journal."}
            </p>
            {view === "active" && !q ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link href="/copilot/weekly-plan">
                  <Button size="sm" variant="secondary">
                    Build a weekly plan
                  </Button>
                </Link>
                <Link href="/copilot/debrief">
                  <Button size="sm" variant="outline">
                    Debrief a date
                  </Button>
                </Link>
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-3" data-testid="list-journal">
            {entries.map((entry) => (
              <li
                key={entry.id}
                data-testid={`row-journal-${entry.id}`}
                className="rounded-2xl border border-white/10 bg-card/40 p-5"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{fmtWhen(entry.createdAt)}</span>
                    {entry.tags?.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                    {typeof entry.mood === "number" ? (
                      <Badge variant="outline" className="text-[10px]">
                        mood {entry.mood}/5
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    {view === "trash" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRestore(entry)}
                        data-testid={`button-restore-journal-${entry.id}`}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(entry)}
                          data-testid={`button-edit-journal-${entry.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => softDelete(entry)}
                          data-testid={`button-delete-journal-${entry.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {entry.prompt ? (
                  <p className="mb-2 text-sm font-semibold text-foreground">
                    {entry.prompt}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {entry.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent data-testid="dialog-edit-journal" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit reflection</DialogTitle>
            <DialogDescription>
              Update the prompt, body, or tags. Your edits are saved
              immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-prompt">Prompt (optional)</Label>
              <Input
                id="edit-prompt"
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                placeholder="What were you reflecting on?"
                data-testid="input-edit-prompt"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-body">Reflection</Label>
              <Textarea
                id="edit-body"
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={8}
                data-testid="input-edit-body"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-tags"
                value={draftTags}
                onChange={(e) => setDraftTags(e.target.value)}
                placeholder="weekly, intention"
                data-testid="input-edit-tags"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              data-testid="button-edit-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={update.isPending || !draftBody.trim()}
              data-testid="button-edit-save"
            >
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

export { getListJournalEntriesQueryKey };
