import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPostDateNotes,
  useUpdatePostDateNote,
  useDeletePostDateNote,
  useRestorePostDateNote,
  type PostDateNote,
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
  Heart,
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

const OUTCOME_LABELS: Record<string, string> = {
  another_date: "Another date planned",
  no_more: "Not continuing",
  unsure: "Still figuring out",
  ghosted: "Ghosted",
};

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

export default function DatesPage() {
  useMeta(
  "Dates",
  "Read, search, and edit your post-date notes. Soft-deleted notes can be restored from trash.",
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
  const { data, isLoading, isError } = useListPostDateNotes(listParams);
  const update = useUpdatePostDateNote();
  const del = useDeletePostDateNote();
  const restore = useRestorePostDateNote();

  const [editing, setEditing] = useState<PostDateNote | null>(null);
  const [draftSummary, setDraftSummary] = useState("");
  const [draftWell, setDraftWell] = useState("");
  const [draftDidnt, setDraftDidnt] = useState("");
  const [draftPerson, setDraftPerson] = useState("");

  const invalidate = useCallback(() => {
  void queryClient.invalidateQueries({ queryKey: ["/api/post-date-notes"] });
  }, [queryClient]);

  function openEdit(n: PostDateNote) {
  setEditing(n);
  setDraftSummary(n.summary);
  setDraftWell(n.whatWentWell);
  setDraftDidnt(n.whatDidnt);
  setDraftPerson(n.personLabel ?? "");
  }

  function saveEdit() {
  if (!editing) return;
  const summary = draftSummary.trim();
  if (!summary) return;
  update.mutate(
  {
  id: editing.id,
  data: {
  summary,
  whatWentWell: draftWell,
  whatDidnt: draftDidnt,
  personLabel: draftPerson.trim() || null,
  },
  },
  {
  onSuccess: () => {
  invalidate();
  setEditing(null);
  toast({ title: "Saved", description: "Your note was updated." });
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

  function softDelete(n: PostDateNote) {
  del.mutate(
  { id: n.id },
  {
  onSuccess: () => {
  invalidate();
  const t = toast({
  title: "Note moved to trash",
  description: "It will be permanently deleted after 30 days.",
  duration: 8000,
  action: (
  <ToastAction
  altText="Undo delete"
  onClick={() => {
  restore.mutate(
  { id: n.id },
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

  function handleRestore(n: PostDateNote) {
  restore.mutate(
  { id: n.id },
  {
  onSuccess: () => {
  invalidate();
  toast({
  title: "Restored",
  description: "Your note is back in your dates list.",
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

  const notes = data?.notes ?? [];

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
  <Heart className="h-4 w-4 text-rose-400" />
  <span className="text-xs font-semibold uppercase tracking-wider text-rose-300">
  Dates
  </span>
  </div>
  <h1 className="font-serif text-3xl font-bold md:text-4xl">
  Your post-date notes
  </h1>
  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
  The full record of what you debriefed after each date, what went
  well, what didn't, and what came next.
  </p>
  </div>
  </div>

  <div className="mb-4 flex flex-wrap items-center gap-2">
  <Button
  variant={view === "active" ? "default" : "outline"}
  size="sm"
  onClick={() => setView("active")}
  data-testid="tab-dates-active"
  >
  Active
  </Button>
  <Button
  variant={view === "trash" ? "default" : "outline"}
  size="sm"
  onClick={() => setView("trash")}
  data-testid="tab-dates-trash"
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
  placeholder="Search notes…"
  className="pl-9"
  data-testid="input-search-dates"
  />
  </div>
  <Button type="submit" variant="secondary" data-testid="button-search-dates">
  Search
  </Button>
  </form>

  {isLoading ? (
  <div className="space-y-3">
  <Skeleton className="h-32 w-full" />
  <Skeleton className="h-32 w-full" />
  <Skeleton className="h-32 w-full" />
  </div>
  ) : isError ? (
  <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
  Couldn't load your notes. Please refresh in a moment.
  </div>
  ) : notes.length === 0 ? (
  <div
  className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center"
  data-testid="empty-dates"
  >
  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
  <Inbox className="h-6 w-6 text-muted-foreground" />
  </div>
  <p className="font-serif text-lg font-semibold">
  {view === "trash"
  ? "Nothing in the trash"
  : q
  ? "No matches"
  : "No post-date notes yet"}
  </p>
  <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
  {view === "trash"
  ? "Deleted notes show up here for 30 days."
  : q
  ? "Try a different search term."
  : "After your next date, run a Debrief to capture what happened while it's fresh."}
  </p>
  {view === "active" && !q ? (
  <div className="mt-5 flex justify-center">
  <Link href="/copilot/debrief">
  <Button size="sm">Run a Debrief</Button>
  </Link>
  </div>
  ) : null}
  </div>
  ) : (
  <ul className="space-y-3" data-testid="list-dates">
  {notes.map((n) => (
  <li
  key={n.id}
  data-testid={`row-date-${n.id}`}
  className="rounded-2xl border border-white/10 bg-card/40 p-5"
  >
  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
  <span>{fmtWhen(n.dateAt ?? n.createdAt)}</span>
  {n.personLabel ? (
  <Badge variant="secondary" className="text-[10px]">
  {n.personLabel}
  </Badge>
  ) : null}
  {n.platform ? (
  <Badge variant="outline" className="text-[10px]">
  {n.platform}
  </Badge>
  ) : null}
  {n.outcome ? (
  <Badge variant="outline" className="text-[10px]">
  {OUTCOME_LABELS[n.outcome] ?? n.outcome}
  </Badge>
  ) : null}
  </div>
  <div className="flex gap-1">
  {view === "trash" ? (
  <Button
  size="sm"
  variant="secondary"
  onClick={() => handleRestore(n)}
  data-testid={`button-restore-date-${n.id}`}
  >
  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
  </Button>
  ) : (
  <>
  <Button
  size="sm"
  variant="ghost"
  onClick={() => openEdit(n)}
  data-testid={`button-edit-date-${n.id}`}
  >
  <Pencil className="h-3.5 w-3.5" />
  </Button>
  <Button
  size="sm"
  variant="ghost"
  onClick={() => softDelete(n)}
  data-testid={`button-delete-date-${n.id}`}
  >
  <Trash2 className="h-3.5 w-3.5" />
  </Button>
  </>
  )}
  </div>
  </div>
  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
  {n.summary}
  </p>
  {n.whatWentWell ? (
  <p className="mt-3 text-xs text-muted-foreground">
  <span className="font-semibold text-emerald-400">What went well · </span>
  {n.whatWentWell}
  </p>
  ) : null}
  {n.whatDidnt ? (
  <p className="mt-1.5 text-xs text-muted-foreground">
  <span className="font-semibold text-rose-400">What didn't · </span>
  {n.whatDidnt}
  </p>
  ) : null}
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
  <DialogContent data-testid="dialog-edit-date" className="max-w-lg">
  <DialogHeader>
  <DialogTitle>Edit post-date note</DialogTitle>
  <DialogDescription>
  Update what happened, what went well, and what didn't.
  </DialogDescription>
  </DialogHeader>
  <div className="space-y-3">
  <div className="space-y-1.5">
  <Label htmlFor="edit-person">Person (optional)</Label>
  <Input
  id="edit-person"
  value={draftPerson}
  onChange={(e) => setDraftPerson(e.target.value)}
  placeholder="First name or a nickname"
  data-testid="input-edit-person"
  />
  </div>
  <div className="space-y-1.5">
  <Label htmlFor="edit-summary">What happened</Label>
  <Textarea
  id="edit-summary"
  value={draftSummary}
  onChange={(e) => setDraftSummary(e.target.value)}
  rows={6}
  data-testid="input-edit-summary"
  />
  </div>
  <div className="space-y-1.5">
  <Label htmlFor="edit-well">What went well</Label>
  <Textarea
  id="edit-well"
  value={draftWell}
  onChange={(e) => setDraftWell(e.target.value)}
  rows={3}
  data-testid="input-edit-well"
  />
  </div>
  <div className="space-y-1.5">
  <Label htmlFor="edit-didnt">What didn't</Label>
  <Textarea
  id="edit-didnt"
  value={draftDidnt}
  onChange={(e) => setDraftDidnt(e.target.value)}
  rows={3}
  data-testid="input-edit-didnt"
  />
  </div>
  </div>
  <DialogFooter>
  <Button
  variant="outline"
  onClick={() => setEditing(null)}
  data-testid="button-edit-cancel-date"
  >
  Cancel
  </Button>
  <Button
  onClick={saveEdit}
  disabled={update.isPending || !draftSummary.trim()}
  data-testid="button-edit-save-date"
  >
  {update.isPending ? "Saving…" : "Save"}
  </Button>
  </DialogFooter>
  </DialogContent>
  </Dialog>
  </AppLayout>
  );
}
