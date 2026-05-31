import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  useAuditFromScreenshot,
  useExtractScreenshot,
} from "@workspace/api-client-react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMeta } from "@/hooks/useMeta";

interface PickedImage {
  dataUrl: string;
  base64: string;
  mediaType: string;
}

interface ExtractedDraft {
  firstName: string;
  age: string;
  sourceApp: string;
  bio: string;
  prompts: string[];
}

interface ScanResult {
  auditId: number;
  extractedBio: string;
  extractedPrompts: string[];
  report: {
  readinessScore: number;
  overallGrade: string;
  strengths: string[];
  risks: string[];
  bioAudit: string;
  rewrittenBio: string;
  messagingStyle: string;
  coachingCta: string;
  photoAnalysis?: {
  summary: string;
  observations: { aspect: string; assessment: "strong" | "okay" | "needs_work"; detail: string }[];
  topFix: string;
  } | null;
  };
}

const DEMO_RESULT: ScanResult = {
  auditId: 0,
  extractedBio:
  "29 · designer in Brooklyn. Sourdough hobbyist, big into film photography, recovering perfectionist. Looking for someone curious and kind.",
  extractedPrompts: [
  "The way to win me over is… remembering the weird specific thing I mentioned once.",
  "I'm looking for… someone who laughs before the punchline lands.",
  ],
  report: {
  readinessScore: 78,
  overallGrade: "B+",
  strengths: [
  "Bio shows specific personality, not just adjectives",
  "Mentions hobbies that make for easy openers",
  "Tone reads warm and self-aware",
  ],
  risks: [
  "'Recovering perfectionist' is a common phrase, risks reading generic",
  "No prompt about future plans or values",
  ],
  bioAudit:
  "Strong opening with concrete details (Brooklyn, sourdough, film). The closing line is the weakest part, 'curious and kind' is what everyone says. Replace it with one specific behavior you actually want.",
  rewrittenBio:
  "29 · designer in Brooklyn. I bake sourdough on Sundays, shoot film I never develop fast enough, and laugh too loud at my own jokes. Looking for someone who'd rather wander than plan.",
  messagingStyle:
  "Open with the film photography, ask what camera they shoot on.",
  coachingCta: "Open Message Coach to draft a first message that actually lands.",
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

function fileToBase64(file: File): Promise<PickedImage> {
  return new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
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

export default function Scan() {
  useMeta(
  "Scan a Profile",
  "Upload a screenshot of a dating profile, correct any OCR mistakes, and get an instant audit + opener.",
  );

  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [draft, setDraft] = useState<ExtractedDraft | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  const extract = useExtractScreenshot();
  const scan = useAuditFromScreenshot();

  async function onFileChosen(file: File | null | undefined) {
  if (!file) return;
  setErrorMsg(null);
  if (!file.type.startsWith("image/")) {
  setErrorMsg("That doesn't look like an image. Try a screenshot instead.");
  return;
  }
  try {
  const img = await fileToBase64(file);
  setPicked(img);
  setDraft(null);
  setResult(null);
  } catch {
  setErrorMsg("Couldn't read that file. Try a different screenshot.");
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
  for (const item of items) {
  if (item.kind === "file" && item.type.startsWith("image/")) {
  const file = item.getAsFile();
  if (file) {
  e.preventDefault();
  void onFileChosen(file);
  return;
  }
  }
  }
  }
  window.addEventListener("paste", onPaste);
  return () => window.removeEventListener("paste", onPaste);
  }, []);

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
  const file = e.dataTransfer?.files?.[0];
  if (file) void onFileChosen(file);
  }

  async function extractFromImage() {
  if (!picked) return;
  setErrorMsg(null);
  try {
  const res = await extract.mutateAsync({
  data: { imageBase64: picked.base64 },
  });
  setDraft({
  firstName: res.firstName ?? "",
  age: res.age != null ? String(res.age) : "",
  sourceApp: res.sourceApp ?? "",
  bio: res.bio ?? "",
  prompts: res.prompts ?? [],
  });
  } catch (err) {
  setErrorMsg(
  err instanceof Error
  ? err.message
  : "Couldn't read that screenshot. Try a clearer image.",
  );
  }
  }

  async function runAudit() {
  if (!draft) return;
  setErrorMsg(null);
  const trimmedPrompts = draft.prompts
.map((p) => p.trim())
.filter((p) => p.length > 0);
  if (draft.bio.trim().length === 0 && trimmedPrompts.length === 0) {
  setErrorMsg(
  "Add their bio (or at least one prompt) before we can audit it.",
  );
  return;
  }
  const parsedAge = parseInt(draft.age, 10);
  try {
  const res = await scan.mutateAsync({
  data: {
  bio: draft.bio,
  prompts: trimmedPrompts,
  firstName: draft.firstName.trim() || null,
  age: Number.isFinite(parsedAge) ? parsedAge : null,
  sourceApp: draft.sourceApp.trim() || null,
  // Pass the original image so the opt-in AI vision photo critique can run.
  // The server only sends it to the model when the user enabled the deep AI
  // lane; otherwise it is ignored and never leaves our server.
  imageBase64: picked?.base64 ?? null,
  imageMediaType: picked?.mediaType ?? null,
  },
  });
  setResult({
  auditId: res.auditId,
  extractedBio: res.extractedBio,
  extractedPrompts: res.extractedPrompts,
  report: {
  readinessScore: res.report.readinessScore,
  overallGrade: res.report.overallGrade,
  strengths: res.report.strengths,
  risks: res.report.risks,
  bioAudit: res.report.bioAudit,
  rewrittenBio: res.report.rewrittenBio,
  messagingStyle: res.report.messagingStyle,
  coachingCta: res.report.coachingCta,
  photoAnalysis: res.report.photoAnalysis ?? null,
  },
  });
  } catch (err) {
  setErrorMsg(
  err instanceof Error
  ? err.message
  : "Couldn't audit that screenshot. Try again in a moment.",
  );
  }
  }

  function updateDraft(patch: Partial<ExtractedDraft>) {
  setDraft((d) => (d ? {...d,...patch } : d));
  }

  function updatePrompt(index: number, value: string) {
  setDraft((d) => {
  if (!d) return d;
  const next = [...d.prompts];
  next[index] = value;
  return {...d, prompts: next };
  });
  }

  function addPrompt() {
  setDraft((d) => (d ? {...d, prompts: [...d.prompts, ""] } : d));
  }

  function removePrompt(index: number) {
  setDraft((d) => {
  if (!d) return d;
  return {...d, prompts: d.prompts.filter((_, i) => i !== index) };
  });
  }

  function reset() {
  setPicked(null);
  setDraft(null);
  setResult(null);
  setErrorMsg(null);
  if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const display = result ?? DEMO_RESULT;
  const showingDemo = result === null;

  return (
  <AppLayout>
  <div className="container mx-auto px-4 py-10 max-w-3xl">
  <motion.div {...fadeUp(0)} className="mb-8">
  <div className="text-xs uppercase tracking-[0.2em] text-[hsl(326_100%_70%)] font-semibold mb-2">
  Scan a Profile
  </div>
  <h1 className="font-display text-4xl md:text-5xl leading-tight mb-3">
  Audit a match in 10 seconds
  </h1>
  <p className="text-muted-foreground text-base max-w-2xl">
  Upload a screenshot of their profile. We'll read the bio and
  prompts, let you fix any OCR mistakes, then score it and tell you
  exactly how to open.
  </p>
  </motion.div>

  {/* Upload card */}
  <motion.div
  {...fadeUp(0.05)}
  className={`glass border rounded-2xl p-6 mb-6 transition-colors ${
  isDragging
  ? "border-[hsl(326_100%_70%)] bg-[hsl(326_100%_70%)]/10 ring-2 ring-[hsl(326_100%_70%)]/40"
  : "border-white/8"
  }`}
  data-testid="card-upload"
  onDragEnter={onDragEnter}
  onDragOver={onDragOver}
  onDragLeave={onDragLeave}
  onDrop={onDrop}
  >
  {picked ? (
  <div className="flex flex-col items-center gap-4">
  <img
  src={picked.dataUrl}
  alt="Screenshot preview"
  className="w-full max-h-[420px] object-contain rounded-xl border border-white/8 bg-black/30"
  data-testid="img-preview"
  />
  <div className="flex flex-wrap gap-2 justify-center">
  <Button
  variant="outline"
  size="sm"
  onClick={reset}
  data-testid="button-replace"
  >
  <X className="h-4 w-4 mr-1.5" />
  Replace
  </Button>
  {!draft ? (
  <Button
  size="sm"
  onClick={extractFromImage}
  disabled={extract.isPending}
  data-testid="button-extract"
  >
  {extract.isPending ? (
  <>
  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
  Reading screenshot…
  </>
  ) : (
  <>
  <Eye className="h-4 w-4 mr-1.5" />
  Read this screenshot
  </>
  )}
  </Button>
  ) : null}
  </div>
  </div>
  ) : (
  <div className="flex flex-col items-center text-center gap-4 py-6">
  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[hsl(326_100%_62%)] to-[hsl(248_62%_58%)] flex items-center justify-center">
  <Upload className="h-7 w-7 text-white" />
  </div>
  <div className="space-y-1">
  <div className="font-semibold text-lg">
  Upload a profile screenshot
  </div>
  <p className="text-sm text-muted-foreground max-w-md">
  Works best on Hinge, Bumble, or Tinder screenshots where
  the bio and prompts are visible. The image is processed on
  our server, never stored.
  </p>
  <p
  className="text-xs text-muted-foreground/80"
  data-testid="text-paste-hint"
  >
  Drop an image here, or press{" "}
  <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 font-mono text-[10px]">
  ⌘/Ctrl + V
  </kbd>{" "}
  to paste a screenshot.
  </p>
  </div>
  <input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  className="hidden"
  onChange={(e) => onFileChosen(e.target.files?.[0])}
  data-testid="input-file"
  />
  <div className="flex flex-wrap gap-2 justify-center">
  <Button
  onClick={() => fileInputRef.current?.click()}
  data-testid="button-choose-file"
  >
  <Upload className="h-4 w-4 mr-1.5" />
  Choose screenshot
  </Button>
  <Button
  variant="outline"
  onClick={() => {
  const input = fileInputRef.current;
  if (!input) return;
  input.setAttribute("capture", "environment");
  input.click();
  setTimeout(() => input.removeAttribute("capture"), 0);
  }}
  data-testid="button-take-photo"
  >
  <Camera className="h-4 w-4 mr-1.5" />
  Take a photo
  </Button>
  </div>
  </div>
  )}

  {errorMsg ? (
  <div
  className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
  data-testid="text-error"
  >
  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
  <span>{errorMsg}</span>
  </div>
  ) : null}
  </motion.div>

  {/* Editable OCR draft */}
  {draft ? (
  <motion.div
  {...fadeUp(0.1)}
  className="glass border border-white/8 rounded-2xl p-6 mb-6"
  data-testid="card-draft"
  >
  <div className="flex items-center gap-2 mb-1">
  <Edit3 className="h-4 w-4 text-[hsl(326_100%_70%)]" />
  <div className="font-semibold">
  We read this from your screenshot
  </div>
  </div>
  <p className="text-sm text-muted-foreground mb-5">
  Fix anything that looks wrong, then we'll audit the corrected
  text.
  </p>

  <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3 mb-3">
  <div className="space-y-1.5">
  <Label htmlFor="scan-first-name">First name</Label>
  <Input
  id="scan-first-name"
  value={draft.firstName}
  onChange={(e) => updateDraft({ firstName: e.target.value })}
  placeholder="Match"
  data-testid="input-first-name"
  />
  </div>
  <div className="space-y-1.5">
  <Label htmlFor="scan-age">Age</Label>
  <Input
  id="scan-age"
  inputMode="numeric"
  value={draft.age}
  onChange={(e) =>
  updateDraft({ age: e.target.value.replace(/[^0-9]/g, "") })
  }
  placeholder=", "
  data-testid="input-age"
  />
  </div>
  </div>

  <div className="space-y-1.5 mb-3">
  <Label htmlFor="scan-app">App</Label>
  <Input
  id="scan-app"
  value={draft.sourceApp}
  onChange={(e) => updateDraft({ sourceApp: e.target.value })}
  placeholder="Hinge"
  data-testid="input-source-app"
  />
  </div>

  <div className="space-y-1.5 mb-4">
  <Label htmlFor="scan-bio">Bio</Label>
  <Textarea
  id="scan-bio"
  value={draft.bio}
  onChange={(e) => updateDraft({ bio: e.target.value })}
  placeholder="Their bio text…"
  rows={5}
  data-testid="input-bio"
  />
  </div>

  <div className="space-y-2 mb-5">
  <div className="flex items-center justify-between">
  <Label>Prompts</Label>
  <Button
  variant="ghost"
  size="sm"
  onClick={addPrompt}
  data-testid="button-add-prompt"
  >
  <Plus className="h-3.5 w-3.5 mr-1" />
  Add
  </Button>
  </div>
  {draft.prompts.length === 0 ? (
  <p className="text-xs text-muted-foreground">
  No prompts detected. Tap Add to enter one.
  </p>
  ) : (
  <div className="space-y-2">
  {draft.prompts.map((p, i) => (
  <div
  key={`prompt-${i}`}
  className="flex items-start gap-2"
  data-testid={`row-prompt-${i}`}
  >
  <Textarea
  value={p}
  onChange={(e) => updatePrompt(i, e.target.value)}
  placeholder="Prompt text…"
  rows={2}
  className="flex-1"
  data-testid={`input-prompt-${i}`}
  />
  <Button
  variant="ghost"
  size="icon"
  onClick={() => removePrompt(i)}
  aria-label="Remove prompt"
  data-testid={`button-remove-prompt-${i}`}
  >
  <X className="h-4 w-4" />
  </Button>
  </div>
  ))}
  </div>
  )}
  </div>

  <Button
  className="w-full"
  size="lg"
  onClick={runAudit}
  disabled={scan.isPending}
  data-testid="button-audit"
  >
  {scan.isPending ? (
  <>
  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  Running audit…
  </>
  ) : (
  <>
  <Zap className="h-4 w-4 mr-2" />
  Looks right, audit it
  </>
  )}
  </Button>
  </motion.div>
  ) : null}

  {/* Results */}
  <motion.div {...fadeUp(0.15)} className="space-y-4">
  <div className="flex items-center gap-2">
  <h2 className="font-display text-2xl">
  {showingDemo ? "Sample mini-report" : "Mini-report"}
  </h2>
  {showingDemo ? (
  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[hsl(43_65%_65%)] text-[hsl(43_65%_70%)] bg-[hsl(43_65%_65%/0.12)]">
  Demo
  </span>
  ) : null}
  </div>

  <div className="glass border border-white/8 rounded-2xl p-6 flex items-center gap-5">
  <div
  className="h-20 w-20 rounded-full flex items-center justify-center border-4 border-[hsl(326_100%_62%/0.4)] bg-[hsl(326_100%_62%/0.08)]"
  data-testid="score-ring"
  >
  <div className="text-2xl font-display font-bold">
  {display.report.readinessScore}
  </div>
  </div>
  <div>
  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
  Readiness
  </div>
  <div className="font-display text-2xl">
  Grade {display.report.overallGrade}
  </div>
  </div>
  </div>

  {display.extractedBio ? (
  <Section title="What we read" icon={<FileText className="h-4 w-4" />}>
  <p className="text-foreground/90">{display.extractedBio}</p>
  {display.extractedPrompts.length > 0 ? (
  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
  {display.extractedPrompts.map((p, i) => (
  <li key={`p-${i}`}>• {p}</li>
  ))}
  </ul>
  ) : null}
  </Section>
  ) : null}

  <Section
  title="Strengths"
  icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
  >
  <ul className="space-y-1.5">
  {display.report.strengths.map((s, i) => (
  <li key={`s-${i}`} className="flex gap-2 text-sm">
  <Check className="h-4 w-4 mt-0.5 text-emerald-400 shrink-0" />
  <span>{s}</span>
  </li>
  ))}
  </ul>
  </Section>

  <Section
  title="Risks to watch"
  icon={<AlertCircle className="h-4 w-4 text-rose-400" />}
  >
  <ul className="space-y-1.5">
  {display.report.risks.map((r, i) => (
  <li key={`r-${i}`} className="flex gap-2 text-sm">
  <AlertCircle className="h-4 w-4 mt-0.5 text-rose-400 shrink-0" />
  <span>{r}</span>
  </li>
  ))}
  </ul>
  </Section>

  <Section
  title="Bio audit"
  icon={<Edit3 className="h-4 w-4 text-[hsl(326_100%_70%)]" />}
  >
  <p className="text-sm leading-relaxed">{display.report.bioAudit}</p>
  <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3">
  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
  Rewritten bio
  </div>
  <p className="text-sm leading-relaxed">
  {display.report.rewrittenBio}
  </p>
  </div>
  </Section>

  {display.report.photoAnalysis ? (
  <Section
  title="Photo critique"
  icon={<Eye className="h-4 w-4 text-[hsl(248_62%_70%)]" />}
  >
  <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
  A real read of your actual photos, not a checklist. Runs only because the deep AI lane is on. Your image is read in the moment and never stored.
  </p>
  <p className="text-sm leading-relaxed mb-3">{display.report.photoAnalysis.summary}</p>
  <ul className="space-y-1.5">
  {display.report.photoAnalysis.observations.map((ob, i) => {
  const cls = ob.assessment === "strong"
  ? "text-emerald-400"
  : ob.assessment === "okay"
  ? "text-[hsl(43_65%_65%)]"
  : "text-rose-400";
  const Icon = ob.assessment === "strong" ? CheckCircle2 : AlertCircle;
  return (
  <li key={`pa-${i}`} className="flex gap-2 text-sm">
  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cls}`} />
  <span><span className="font-medium">{ob.aspect}:</span> {ob.detail}</span>
  </li>
  );
  })}
  </ul>
  <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3">
  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
  Highest-impact fix
  </div>
  <p className="text-sm leading-relaxed">{display.report.photoAnalysis.topFix}</p>
  </div>
  </Section>
  ) : null}

  <Section
  title="How to open"
  icon={<MessageCircle className="h-4 w-4 text-[hsl(43_65%_65%)]" />}
  >
  <p className="text-sm leading-relaxed mb-3">
  {display.report.messagingStyle}
  </p>
  <Button variant="outline" size="sm" asChild>
  <Link href="/coach" data-testid="link-coach">
  <Sparkles className="h-4 w-4 mr-1.5" />
  {display.report.coachingCta}
  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
  </Link>
  </Button>
  </Section>

  {!showingDemo ? (
  <div className="flex flex-wrap gap-2 pt-2">
  <Button variant="outline" size="sm" onClick={reset}>
  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
  Scan another
  </Button>
  {result?.auditId ? (
  <Button size="sm" asChild>
  <Link
  href={`/report/${result.auditId}`}
  data-testid="link-full-report"
  >
  See full report
  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
  </Link>
  </Button>
  ) : null}
  </div>
  ) : null}
  </motion.div>
  </div>
  </AppLayout>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
  <div className="glass border border-white/8 rounded-2xl p-5">
  <div className="flex items-center gap-2 mb-3">
  {icon}
  <div className="font-semibold">{title}</div>
  </div>
  {children}
  </div>
  );
}
