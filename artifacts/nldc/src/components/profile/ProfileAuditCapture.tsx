import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  auditFailureDetails,
  createProfileProjectAudit,
} from "@/lib/profileAudit";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Loader2, ScanSearch, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const APPS = [
  "Hinge",
  "Bumble",
  "Tinder",
  "Feeld",
  "Grindr",
  "HER",
  "Coffee Meets Bagel",
  "The League",
  "OkCupid",
  "Other",
];

const GOALS = [
  { value: "find a relationship", label: "Find a relationship" },
  { value: "casual dating", label: "Casual dating" },
  { value: "heal from a breakup", label: "Heal and rediscover myself" },
  { value: "just curious", label: "Explore what is out there" },
];

const CHALLENGES = [
  "Not getting enough matches",
  "Getting matches but no responses",
  "Getting ghosted after a few messages",
  "Bad first dates that don't lead anywhere",
  "Not sure how I come across",
  "Just want to improve overall",
];

interface AuditDraft {
  firstName: string;
  age: string;
  app: string;
  goal: string;
  challenge: string;
  bio: string;
  prompts: string;
  recentMessage: string;
}

const EMPTY_DRAFT: AuditDraft = {
  firstName: "",
  age: "",
  app: "",
  goal: "",
  challenge: "",
  bio: "",
  prompts: "",
  recentMessage: "",
};

export function ProfileAuditCapture({
  photoCount,
  onComplete,
}: {
  photoCount: number;
  onComplete: (auditId: number) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<AuditDraft>(EMPTY_DRAFT);
  const [failure, setFailure] = useState<{
    title: string;
    reasons: string[];
  } | null>(null);
  const [completedId, setCompletedId] = useState<number | null>(null);
  const createAudit = useMutation({ mutationFn: createProfileProjectAudit });

  useEffect(() => {
    try {
      const carried = window.sessionStorage.getItem("matchlab.signalCheckBio");
      if (carried?.trim()) {
        setDraft((current) => ({ ...current, bio: carried.trim() }));
        window.sessionStorage.removeItem("matchlab.signalCheckBio");
      }
    } catch {
      // Session carry-over is optional; the durable service does not depend on it.
    }
  }, []);

  function patch(patchValue: Partial<AuditDraft>) {
    setDraft((current) => ({ ...current, ...patchValue }));
    setFailure(null);
    setCompletedId(null);
  }

  async function submit() {
    setFailure(null);
    setCompletedId(null);
    try {
      const result = await createAudit.mutateAsync({
        firstName: draft.firstName.trim(),
        age: Number(draft.age),
        gender: "Prefer not to say",
        orientation: "Prefer not to say",
        datingGoal: draft.goal,
        currentApps: [draft.app],
        bio: draft.bio.trim(),
        prompts: draft.prompts.trim() || null,
        recentMessageSample: draft.recentMessage.trim() || null,
        photoCount,
        relationshipHistory: null,
        biggestChallenge: draft.challenge || null,
      });
      setCompletedId(result.audit.id);
      await onComplete(result.audit.id);
    } catch (error) {
      setFailure(auditFailureDetails(error));
    }
  }

  const readyToSubmit =
    draft.firstName.trim().length > 0 &&
    draft.age.trim().length > 0 &&
    Number.isInteger(Number(draft.age)) &&
    Number(draft.age) >= 18 &&
    Number(draft.age) <= 100 &&
    draft.app.length > 0 &&
    draft.goal.length > 0 &&
    draft.bio.trim().length > 0;

  return (
    <section
      id="audit-capture"
      className="scroll-mt-6 rounded-[2rem] border border-foreground/10 bg-background/70 p-5 shadow-sm sm:p-7"
    >
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          New profile read
        </p>
        <h2 className="mt-2 font-serif text-2xl font-bold">
          Give Echo enough real evidence to work with
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This replaces the old multi-page audit and score teaser. Add the
          profile text a person can actually see; MatchLab saves that source and
          the generated read as part of this project.
        </p>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="audit-first-name">First name</Label>
          <Input
            id="audit-first-name"
            value={draft.firstName}
            onChange={(event) => patch({ firstName: event.target.value })}
            placeholder="Jordan"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-age">Age</Label>
          <Input
            id="audit-age"
            type="number"
            min={18}
            max={100}
            value={draft.age}
            onChange={(event) => patch({ age: event.target.value })}
            placeholder="31"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-app">Profile source</Label>
          <select
            id="audit-app"
            value={draft.app}
            onChange={(event) => patch({ app: event.target.value })}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Choose an app</option>
            {APPS.map((app) => (
              <option key={app} value={app}>{app}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-goal">What are you looking for?</Label>
          <select
            id="audit-goal"
            value={draft.goal}
            onChange={(event) => patch({ goal: event.target.value })}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Choose a goal</option>
            {GOALS.map((goal) => (
              <option key={goal.value} value={goal.value}>{goal.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <Label htmlFor="audit-bio">Profile bio</Label>
        <Textarea
          id="audit-bio"
          value={draft.bio}
          onChange={(event) => patch({ bio: event.target.value })}
          placeholder="Paste the bio exactly as it appears on your profile."
          className="min-h-36"
        />
        <p className="text-xs leading-5 text-muted-foreground">
          A reliable read needs at least a couple of specific sentences.
          Placeholder text, links, and contradictory details are rejected.
        </p>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="audit-prompts">Prompt answers (optional)</Label>
          <Textarea
            id="audit-prompts"
            value={draft.prompts}
            onChange={(event) => patch({ prompts: event.target.value })}
            placeholder="Put each prompt and answer on a new line."
            className="min-h-32"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-message">Recent message sample (optional)</Label>
          <Textarea
            id="audit-message"
            value={draft.recentMessage}
            onChange={(event) => patch({ recentMessage: event.target.value })}
            placeholder="Remove names or details you do not want saved."
            className="min-h-32"
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <Label htmlFor="audit-challenge">Current challenge (optional)</Label>
        <select
          id="audit-challenge"
          value={draft.challenge}
          onChange={(event) => patch({ challenge: event.target.value })}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="">No challenge selected</option>
          {CHALLENGES.map((challenge) => (
            <option key={challenge} value={challenge}>{challenge}</option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-foreground/10 bg-background/55 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(248_62%_52%)]" />
        <p className="text-sm leading-6 text-muted-foreground">
          Saving this source allows this one coaching read. The result remains a
          proposed observation: it is not confirmed Mirror learning and it
          cannot be used for matching unless you approve those separately.
        </p>
      </div>

      {failure && (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"
        >
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold">{failure.title}</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {failure.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                No result was displayed or substituted.
              </p>
            </div>
          </div>
        </div>
      )}

      {completedId && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm">
          <CheckCircle className="h-5 w-5 text-emerald-700" />
          Read #{completedId} was saved and opened in history below.
        </div>
      )}

      <Button
        type="button"
        onClick={() => void submit()}
        disabled={!readyToSubmit || createAudit.isPending}
        className="mt-6"
      >
        {createAudit.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ScanSearch className="mr-2 h-4 w-4" />
        )}
        Validate, generate, and save
      </Button>
    </section>
  );
}
