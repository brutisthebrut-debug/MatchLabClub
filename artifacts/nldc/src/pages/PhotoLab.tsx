import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  useRankPhotoLab,
  type PhotoLabRankResult,
  type PhotoLabRankedPhoto,
} from "@workspace/api-client-react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Crown,
  Eye,
  ImageUp,
  Layers,
  Loader2,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMeta } from "@/hooks/useMeta";

type ShotType =
  | "solo_face"
  | "full_body"
  | "activity"
  | "group"
  | "candid"
  | "other";

const SHOT_OPTIONS: { value: ShotType; label: string }[] = [
  { value: "solo_face", label: "Solo shot of your face" },
  { value: "candid", label: "Candid moment" },
  { value: "activity", label: "Doing an activity" },
  { value: "full_body", label: "Full-body shot" },
  { value: "group", label: "With friends (group)" },
  { value: "other", label: "Something else" },
];

interface LabPhoto {
  id: string;
  dataUrl: string;
  base64: string;
  mediaType: string;
  shotType: ShotType;
  wellLit: boolean;
  genuineExpression: boolean;
}

const MAX_PHOTOS = 6;

const DEMO_RESULT: PhotoLabRankResult = {
  leadShotId: "demo-1",
  leadShotRationale:
    "Lead with photo demo-1: a clear solo shot, well lit, with a genuine expression. It is the version of you people meet first, so it earns the opening slot.",
  summary:
    "Ranked 4 photos. Lead with photo demo-1. You have good variety across the lineup.",
  ranked: [
    {
      id: "demo-1",
      rank: 1,
      score: 97,
      role: "Lead shot",
      isLead: true,
      notes: [
        "A clear solo shot is what people screen first. This is prime lead material.",
      ],
    },
    {
      id: "demo-2",
      rank: 2,
      score: 76,
      role: "Lifestyle and conversation starter",
      isLead: false,
      notes: [
        "Activity shots give people something to ask about. Strong in slot two or three.",
      ],
    },
    {
      id: "demo-3",
      rank: 3,
      score: 60,
      role: "Full-body trust shot",
      isLead: false,
      notes: [
        "Keep one honest full-body shot for trust. It rarely wins as the lead.",
      ],
    },
    {
      id: "demo-4",
      rank: 4,
      score: 26,
      role: "Social proof, never the lead",
      isLead: false,
      notes: [
        "Strong as social proof. Place it third or later, never as your first image.",
      ],
    },
  ],
  checklist: [
    {
      category: "Clear solo lead shot",
      status: "good",
      advice:
        "You have a clear solo shot to lead with. That is the single highest-impact slot.",
    },
    {
      category: "Full-body shot",
      status: "good",
      advice:
        "An honest full-body shot is in the mix. It builds trust and avoids surprises.",
    },
    {
      category: "Activity or lifestyle shot",
      status: "good",
      advice: "You have an activity shot. It gives people an easy opener.",
    },
    {
      category: "Social proof shot",
      status: "good",
      advice:
        "A group shot is present. Keep it later in the lineup, never as the lead.",
    },
    {
      category: "Lighting",
      status: "needs_work",
      advice:
        "Several shots could use better light. Natural daylight near a window is the easy win.",
    },
  ],
  visionMode: "fallback",
  visionFallbackReason: null,
  visionAnalysis: null,
  nextSignal: {
    label: "Run a Signal Check",
    detail: "A two-minute readiness pulse sharpens what the machine knows about you.",
    href: "/signal-check",
    points: 8,
  },
  mirror: {
    href: "/your-mirror",
    line: "This ranking feeds Your Mirror, the full picture the machine keeps of you.",
  },
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

function fileToBase64(
  file: File,
): Promise<{ dataUrl: string; base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected file reader result"));
        return;
      }
      const comma = result.indexOf(",");
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({ dataUrl: result, base64, mediaType: file.type || "image/jpeg" });
    };
    reader.readAsDataURL(file);
  });
}

let photoSeq = 0;
function nextPhotoId(): string {
  photoSeq += 1;
  return `photo-${Date.now()}-${photoSeq}`;
}

const STATUS_STYLE: Record<string, string> = {
  good: "text-emerald-600",
  needs_work: "text-amber-600",
  missing: "text-rose-600",
};

const STATUS_LABEL: Record<string, string> = {
  good: "Covered",
  needs_work: "Could be stronger",
  missing: "Missing",
};

export default function PhotoLab() {
  useMeta(
    "Photo Lab",
    "Add several photos, get a clear ranking, and find out which one should lead your dating profile.",
  );

  const [photos, setPhotos] = useState<LabPhoto[]>([]);
  const [result, setResult] = useState<PhotoLabRankResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [chosenLeadId, setChosenLeadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  const rank = useRankPhotoLab();

  async function addFiles(files: FileList | File[] | null | undefined) {
    if (!files) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      setErrorMsg("Those don't look like images. Try photo files instead.");
      return;
    }
    setErrorMsg(null);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setErrorMsg(`You can compare up to ${MAX_PHOTOS} photos at once.`);
      return;
    }
    const take = list.slice(0, room);
    try {
      const loaded = await Promise.all(
        take.map(async (file) => {
          const img = await fileToBase64(file);
          return {
            id: nextPhotoId(),
            dataUrl: img.dataUrl,
            base64: img.base64,
            mediaType: img.mediaType,
            shotType: "solo_face" as ShotType,
            wellLit: true,
            genuineExpression: true,
          };
        }),
      );
      setPhotos((prev) => [...prev, ...loaded]);
      setResult(null);
      setChosenLeadId(null);
    } catch {
      setErrorMsg("Couldn't read one of those files. Try different photos.");
    }
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      const found: File[] = [];
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) found.push(file);
        }
      }
      if (found.length > 0) {
        e.preventDefault();
        void addFiles(found);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  function onDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  }
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    void addFiles(e.dataTransfer?.files);
  }

  function updatePhoto(id: string, patch: Partial<LabPhoto>) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }
  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setResult(null);
    setChosenLeadId(null);
  }

  async function runRanking() {
    if (photos.length === 0) {
      setErrorMsg("Add at least one photo to rank.");
      return;
    }
    setErrorMsg(null);
    try {
      const res = await rank.mutateAsync({
        data: {
          photos: photos.map((p) => ({
            id: p.id,
            shotType: p.shotType,
            wellLit: p.wellLit,
            genuineExpression: p.genuineExpression,
            // Sent only so the opt-in Claude vision pass can read it in the
            // moment. The server ignores it unless the deep AI lane is on, and
            // it is never stored.
            imageBase64: p.base64,
            imageMediaType: p.mediaType,
          })),
        },
      });
      setResult(res);
      setChosenLeadId(res.leadShotId || null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Couldn't rank those photos. Try again in a moment.",
      );
    }
  }

  const active = result ?? (photos.length === 0 ? DEMO_RESULT : null);
  const isDemo = active === DEMO_RESULT;
  const ranked = active?.ranked ?? [];
  // A/B lead picker: the engine's pick plus the runner-up.
  const leadCandidates = ranked.slice(0, 2);
  const previewById = (id: string) => photos.find((p) => p.id === id)?.dataUrl;
  const photoLabel = (rankedPhoto: PhotoLabRankedPhoto) =>
    `Photo ${rankedPhoto.rank}`;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <motion.div {...fadeUp(0)} className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <ImageUp className="h-4 w-4" />
            Photo Lab
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Find your lead shot
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Add the photos you are weighing up, tell us what each one is, and get
            a clear ranking with the single best shot to lead your profile. The
            checklist is always on. Turn on the deep AI lane in your account for a
            vision read that looks at the photos in the moment and never stores
            them.
          </p>
        </motion.div>

        {errorMsg && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Uploader */}
        <motion.div {...fadeUp(0.05)} className="mb-8">
          <div
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/30"
            }`}
          >
            <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              Drag photos here, paste them, or
            </p>
            <div className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={photos.length >= MAX_PHOTOS}
              >
                Choose photos
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Up to {MAX_PHOTOS} photos. {photos.length} added.
            </p>
          </div>
        </motion.div>

        {/* Photo tagging grid */}
        {photos.length > 0 && (
          <motion.div {...fadeUp(0.1)} className="mb-8">
            <h2 className="mb-4 font-display text-xl font-semibold">
              Tell us about each photo
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="relative aspect-[4/3] w-full bg-muted">
                    <img
                      src={p.dataUrl}
                      alt="Photo to rank"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                      aria-label="Remove photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <Label className="mb-1.5 block text-xs">
                        What kind of shot is this?
                      </Label>
                      <Select
                        value={p.shotType}
                        onValueChange={(v) =>
                          updatePhoto(p.id, { shotType: v as ShotType })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SHOT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Well lit</Label>
                      <Switch
                        checked={p.wellLit}
                        onCheckedChange={(c) =>
                          updatePhoto(p.id, { wellLit: c })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Genuine expression</Label>
                      <Switch
                        checked={p.genuineExpression}
                        onCheckedChange={(c) =>
                          updatePhoto(p.id, { genuineExpression: c })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Button
                type="button"
                size="lg"
                onClick={() => void runRanking()}
                disabled={rank.isPending}
              >
                {rank.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ranking your photos
                  </>
                ) : (
                  <>
                    Rank my photos
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Results */}
        {active && (
          <motion.div {...fadeUp(0.15)} className="space-y-8">
            {isDemo && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Sample view. Add your own photos above to get a ranking built
                just for you.
              </div>
            )}

            {/* Lead shot pick */}
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                <Crown className="h-3.5 w-3.5" />
                Lead shot
              </div>
              <p className="text-base font-medium">{active.leadShotRationale}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {active.summary}
              </p>
            </div>

            {/* A/B lead picker */}
            {leadCandidates.length > 1 && (
              <div>
                <h2 className="mb-2 font-display text-xl font-semibold">
                  A/B your lead shot
                </h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  The engine picks the strongest opener, but you know your
                  audience. Compare the top two and choose the one you would lead
                  with.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {leadCandidates.map((candidate) => {
                    const chosen = chosenLeadId === candidate.id;
                    const preview = previewById(candidate.id);
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setChosenLeadId(candidate.id)}
                        className={`rounded-xl border-2 p-4 text-left transition-colors ${
                          chosen
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            {photoLabel(candidate)}
                          </span>
                          {chosen ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                              <Check className="h-3.5 w-3.5" />
                              Your pick
                            </span>
                          ) : candidate.isLead ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              <Star className="h-3.5 w-3.5" />
                              Engine pick
                            </span>
                          ) : null}
                        </div>
                        {preview && (
                          <div className="mb-3 aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
                            <img
                              src={preview}
                              alt={photoLabel(candidate)}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <p className="text-sm font-medium">{candidate.role}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Lead-shot score {candidate.score} / 100
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full ranking */}
            <div>
              <h2 className="mb-4 font-display text-xl font-semibold">
                The full lineup
              </h2>
              <div className="space-y-3">
                {ranked.map((r) => {
                  const preview = previewById(r.id);
                  return (
                    <div
                      key={r.id}
                      className="flex gap-4 rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                        {r.rank}
                      </div>
                      {preview && (
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <img
                            src={preview}
                            alt={photoLabel(r)}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{r.role}</span>
                          {r.isLead && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              <Crown className="h-3 w-3" />
                              Lead
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Score {r.score} / 100
                          </span>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {r.notes.map((note, i) => (
                            <li
                              key={i}
                              className="text-sm text-muted-foreground"
                            >
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vision depth */}
            {active.visionAnalysis && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="h-4 w-4" />
                  Deep AI read
                </div>
                <p className="text-sm">{active.visionAnalysis.summary}</p>
                {active.visionAnalysis.leadShotReason && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {active.visionAnalysis.leadShotReason}
                  </p>
                )}
                {active.visionAnalysis.photos.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {active.visionAnalysis.photos.map((vp) => (
                      <li key={vp.id} className="text-sm">
                        <span
                          className={`font-medium ${
                            STATUS_STYLE[vp.assessment] ?? ""
                          }`}
                        >
                          {STATUS_LABEL[vp.assessment] ?? vp.assessment}:
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {vp.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Checklist */}
            <div>
              <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
                <Layers className="h-5 w-5" />
                Lineup checklist
              </h2>
              <div className="space-y-2">
                {active.checklist.map((item) => (
                  <div
                    key={item.category}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.category}</span>
                        <span
                          className={`text-xs font-medium ${
                            STATUS_STYLE[item.status] ?? ""
                          }`}
                        >
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.advice}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mirror + next signal handoff */}
            <div className="grid gap-4 sm:grid-cols-2">
              {active.mirror && (
                <Link href={active.mirror.href}>
                  <div className="group flex h-full cursor-pointer flex-col justify-between rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50">
                    <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      <Eye className="h-4 w-4" />
                      Your Mirror
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {active.mirror.line}
                    </p>
                    <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                      Open Your Mirror
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              )}
              {active.nextSignal && (
                <Link href={active.nextSignal.href}>
                  <div className="group flex h-full cursor-pointer flex-col justify-between rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50">
                    <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      <Sparkles className="h-4 w-4" />
                      Next best signal
                    </div>
                    <div>
                      <p className="font-medium">{active.nextSignal.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {active.nextSignal.detail}
                      </p>
                    </div>
                    <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                      {active.nextSignal.points
                        ? `Add this signal (+${active.nextSignal.points})`
                        : "Add this signal"}
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              )}
            </div>

            {!active.mirror && !active.nextSignal && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="text-sm text-muted-foreground">
                  Sign in to feed this ranking into Your Mirror and unlock your
                  next best signal.
                </p>
                <Link href="/me">
                  <Button variant="outline" className="mt-4">
                    Sign in
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
