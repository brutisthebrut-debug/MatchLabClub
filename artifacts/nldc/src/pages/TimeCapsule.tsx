import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { motion, AnimatePresence } from "framer-motion";
import { Mailbox, Flame, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WelcomePanel } from "@/components/WelcomePanel";
import {
  useGetTimeCapsules,
  useCreateTimeCapsule,
  getGetTimeCapsulesQueryKey,
  getGetMatchingStateQueryKey,
  type TimeCapsule as TimeCapsuleDto,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  todayPrompt,
  computeDayStreak,
  deriveThemes,
} from "@/lib/timeCapsule";
import { updateTimeCapsulePermissions, type TimeCapsulePermissions } from "@/lib/timeCapsulePermissions";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

const MAX = 280;

interface SavedNote extends TimeCapsuleDto {
  echoUseAllowed: boolean;
  learningConfirmed: boolean;
  matchingUseAllowed: boolean;
}

// A couple of pre-written notes so a signed-out visitor sees a real, played
// board instead of an empty one. The demo never writes to the server.
const DEMO_NOTES: SavedNote[] = [
  {
    id: -1,
    body: "I am learning to slow down so I can actually be there when you arrive.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    echoUseAllowed: false,
    learningConfirmed: false,
    matchingUseAllowed: false,
  },
  {
    id: -2,
    body: "I hope we can disagree and still feel close by the end of the night.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    echoUseAllowed: false,
    learningConfirmed: false,
    matchingUseAllowed: false,
  },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TimeCapsuleExperience({ embedded = false }: { embedded?: boolean }) {
  useMeta(
    "Time capsule",
    "Write one private note to the person you have not met yet, then separately control learning, Echo, and matching permissions.",
  );

  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: notesData, isLoading: notesLoading, isError: notesFailed } = useGetTimeCapsules({
    query: {
      queryKey: getGetTimeCapsulesQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const createNote = useCreateTimeCapsule();
  const [permissionBusy, setPermissionBusy] = useState<number | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const savedNotes = (notesData ?? []) as SavedNote[];

  const isDemo = !isAuthenticated;

  const [demoNotes, setDemoNotes] = useState<SavedNote[]>(DEMO_NOTES);
  const [draft, setDraft] = useState("");

  const notes = isDemo ? demoNotes : savedNotes;
  const prompt = useMemo(() => todayPrompt(), []);

  const streak = useMemo(
    () => (isDemo ? 2 : computeDayStreak(notes.map((n) => n.createdAt))),
    [isDemo, notes],
  );

  const isBrandNewUser = isAuthenticated && notes.length === 0;
  const trimmed = draft.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX;

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetTimeCapsulesQueryKey(),
    });
  };

  const submit = () => {
    if (!canSubmit) return;
    if (isDemo) {
      setDemoNotes((prev) => [
        { id: -Date.now(), body: trimmed, createdAt: new Date().toISOString(), echoUseAllowed: false, learningConfirmed: false, matchingUseAllowed: false },
        ...prev,
      ]);
      setDraft("");
      return;
    }
    if (createNote.isPending) return;
    createNote.mutate(
      { data: { body: trimmed } },
      {
        onSuccess: () => {
          setDraft("");
          invalidate();
        },
      },
    );
  };

  async function changePermission(note: SavedNote, patch: TimeCapsulePermissions) {
    setPermissionBusy(note.id);
    setPermissionError(null);
    try {
      await updateTimeCapsulePermissions(note.id, patch);
      await queryClient.invalidateQueries({ queryKey: getGetTimeCapsulesQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : "Permission update failed.");
    } finally {
      setPermissionBusy(null);
    }
  }

  const content = (
      <div id="play-time-capsule" className={embedded ? "scroll-mt-24" : "min-h-screen mesh-bg py-10 px-4"}>
        <div className="orb orb-indigo fixed w-[400px] h-[400px] -top-20 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          {/* Hero */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] flex items-center justify-center shadow-[0_0_16px_hsl(245_58%_62%/0.4)]">
                <Mailbox className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-[hsl(245_70%_78%)]">
                Daily play
              </p>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Time capsule
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              Write one line to the person you have not met yet. It saves as
              private owner-only text; you decide separately whether the note may
              become confirmed learning, Echo context, or matching context.
            </p>
          </motion.div>

          {/* Streak + count */}
          <motion.div {...fadeUp(0.04)} className="mb-6 grid grid-cols-2 gap-3">
            <div className="glass border border-white/8 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[hsl(20_80%_55%/0.14)] flex items-center justify-center flex-shrink-0">
                <Flame className="w-5 h-5 text-[hsl(20_85%_62%)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">
                  {streak}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  day{streak === 1 ? "" : "s"} in a row
                </p>
              </div>
            </div>
            <div className="glass border border-white/8 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[hsl(245_58%_62%/0.14)] flex items-center justify-center flex-shrink-0">
                <Mailbox className="w-5 h-5 text-[hsl(245_70%_72%)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">
                  {notes.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  note{notes.length === 1 ? "" : "s"} written
                </p>
              </div>
            </div>
          </motion.div>

          {isBrandNewUser && (
            <WelcomePanel
              icon={<Mailbox className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to your time capsule"
              title="Write your first note"
              description="One honest line to the person you have not met yet. It saves privately, and every downstream permission stays closed until you change it."
              testId="capsule-empty-state"
            />
          )}

          {isAuthenticated && notesLoading && <p className="mb-4 glass border border-white/10 rounded-2xl p-4 text-sm text-muted-foreground">Loading your private notes…</p>}
          {isAuthenticated && notesFailed && <p className="mb-4 glass border border-destructive/30 rounded-2xl p-4 text-sm text-destructive">Your private notes could not load. No sample history has been substituted, and capture is paused.</p>}

          {/* Write */}
          <motion.div
            {...fadeUp(0.06)}
            className="glass border border-white/10 rounded-2xl p-6 mb-6"
          >
            <p className="text-base font-semibold text-foreground mb-3 leading-snug">
              {prompt.text}
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
              placeholder={prompt.placeholder}
              rows={3}
              disabled={isAuthenticated && (notesLoading || notesFailed)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-[hsl(245_58%_62%/0.5)]"
              data-testid="capsule-input"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground/50">
                {trimmed.length} / {MAX}
              </span>
              <button
                onClick={submit}
                disabled={!canSubmit || (!isDemo && (createNote.isPending || notesLoading || notesFailed))}
                className="rounded-2xl bg-gradient-to-r from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                data-testid="capsule-submit"
              >
                Seal this note
              </button>
            </div>
            {isDemo && (
              <p className="text-xs text-muted-foreground/50 mt-3">
                Sign in to save notes to your private account history.
              </p>
            )}
          </motion.div>

          {createNote.isError && <p className="mb-4 text-sm text-destructive">This note could not be saved. Your account history was not changed.</p>}

          {/* Replay */}
          {notes.length > 0 && (
            <motion.div {...fadeUp(0.08)} className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-3 px-1">
                Replay your notes
              </p>
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {notes.map((note) => {
                    const themes = deriveThemes(note.body);
                    return (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="glass border border-white/8 rounded-2xl p-4"
                        data-testid="capsule-note"
                      >
                        <p className="text-sm text-foreground leading-relaxed">
                          {note.body}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-xs text-muted-foreground/50">
                            {formatDate(note.createdAt)}
                          </span>
                          {themes.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {themes.map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-muted-foreground"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-[hsl(245_70%_72%)]" />
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {!isDemo && (
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/8 pt-3">
                            <Button size="sm" variant={note.learningConfirmed ? "default" : "outline"} disabled={permissionBusy === note.id} onClick={() => void changePermission(note, { learningConfirmed: !note.learningConfirmed })}>{note.learningConfirmed ? "Learning confirmed" : "Confirm learning"}</Button>
                            <Button size="sm" variant={note.echoUseAllowed ? "default" : "outline"} disabled={permissionBusy === note.id} onClick={() => void changePermission(note, { echoUse: !note.echoUseAllowed })}>{note.echoUseAllowed ? "Echo allowed" : "Allow Echo"}</Button>
                            <Button size="sm" variant={note.matchingUseAllowed ? "default" : "outline"} disabled={permissionBusy === note.id} onClick={() => void changePermission(note, { matchingUse: !note.matchingUseAllowed })}>{note.matchingUseAllowed ? "Matching allowed" : "Allow matching"}</Button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {permissionError && <p className="mb-4 text-sm text-destructive">{permissionError}</p>}

          {/* Trust note */}
          <motion.div
            {...fadeUp(0.45)}
            className="mt-8 glass border border-white/5 rounded-2xl p-4 flex items-start gap-3"
          >
            <Shield className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/45 leading-relaxed">
              <strong className="text-muted-foreground/60">
                Your words stay yours.
              </strong>{" "}
              The raw note stays owner-only. The theme chips above are computed in
              your browser for replay; matching receives only the count of notes
              you explicitly allow, never the text or those displayed themes.
            </p>
          </motion.div>
        </div>
      </div>
  );

  return embedded ? content : (
    <AppLayout>
      <HubTabs hub="games" />
      {content}
    </AppLayout>
  );
}

export default function TimeCapsule() {
  return <TimeCapsuleExperience />;
}
