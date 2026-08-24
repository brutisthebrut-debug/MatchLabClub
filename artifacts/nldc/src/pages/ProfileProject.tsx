import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMeta } from "@/hooks/useMeta";
import { useToast } from "@/hooks/use-toast";
import {
  buildProfileVersionInput,
  buildRewriteVersionInput,
  draftFromSavedProfile,
  emptyProfileProjectDraft,
  type ProfileProjectDraft,
} from "@/lib/profileProject";
import {
  currentAuditRecord,
  reportSections,
  versionedAuditRecord,
} from "@/lib/profileProjectRecords";
import {
  getGetMyPhotosQueryKey,
  getListProfilesQueryKey,
  useAddMyPhoto,
  useCreateProfile,
  useDeleteMyPhoto,
  useGetMyPhotos,
  useListAuditReportVersions,
  useListAudits,
  useListProfiles,
  useRequestUploadUrl,
  useRewriteProfileBio,
  type DatingProfile,
  type ProfileRewrite,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Copy,
  FileClock,
  ImageUp,
  Loader2,
  Plus,
  Save,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function photoSrc(url: string): string {
  if (url.startsWith("http") || url.startsWith("/")) return url;
  return `/api/${url}`;
}

const PLATFORMS = [
  "Hinge",
  "Bumble",
  "Tinder",
  "Feeld",
  "Grindr",
  "HER",
  "Lex",
  "Sniffies",
  "The League",
  "Other",
];

function formatSavedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved profile";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? (
        <Check className="mr-1.5 h-4 w-4" />
      ) : (
        <Copy className="mr-1.5 h-4 w-4" />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export default function ProfileProject() {
  useMeta(
    "Profile Project",
    "Build, revise, and preserve your dating profile as a traceable project instead of a collection of disconnected tools.",
  );

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profilesQuery = useListProfiles();
  const auditsQuery = useListAudits();
  const photosQuery = useGetMyPhotos({
    query: {
      queryKey: getGetMyPhotosQueryKey(),
      retry: false,
    },
  });
  const createProfile = useCreateProfile();
  const rewriteProfile = useRewriteProfileBio();
  const requestUploadUrl = useRequestUploadUrl();
  const addPhoto = useAddMyPhoto();
  const deletePhoto = useDeleteMyPhoto();

  const [draft, setDraft] = useState<ProfileProjectDraft>(
    emptyProfileProjectDraft,
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rewrite, setRewrite] = useState<ProfileRewrite | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null);
  const [selectedAuditVersionId, setSelectedAuditVersionId] = useState<
    number | null
  >(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const profiles = useMemo(
    () =>
      [...(profilesQuery.data ?? [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [profilesQuery.data],
  );

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedId) ?? null;

  const audits = useMemo(
    () =>
      [...(auditsQuery.data ?? [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [auditsQuery.data],
  );
  const selectedAudit =
    audits.find((audit) => audit.id === selectedAuditId) ?? audits[0] ?? null;
  const auditVersionsQuery = useListAuditReportVersions(
    selectedAudit?.id ?? 0,
    {
      query: {
        enabled: selectedAudit !== null,
        retry: false,
      },
    },
  );
  const auditVersions = auditVersionsQuery.data?.versions ?? [];
  const selectedAuditVersion =
    auditVersions.find(
      (version) => version.id === selectedAuditVersionId,
    ) ?? null;
  const activeAuditRecord = selectedAudit
    ? selectedAuditVersion
      ? versionedAuditRecord(selectedAudit, selectedAuditVersion)
      : currentAuditRecord(selectedAudit)
    : null;
  const activeAuditSections = reportSections(activeAuditRecord?.report ?? null);
  const photos = photosQuery.data ?? [];

  function patchDraft(patch: Partial<ProfileProjectDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setRewrite(null);
  }

  function startNewVersion() {
    setSelectedId(null);
    setDraft(emptyProfileProjectDraft());
    setRewrite(null);
  }

  function reopenVersion(profile: DatingProfile) {
    setSelectedId(profile.id);
    setDraft(draftFromSavedProfile(profile));
    setRewrite(null);
  }

  async function saveVersion() {
    const data = buildProfileVersionInput(draft);
    if (!data) {
      toast({
        title: "Add a platform and bio",
        description: "Those two fields are needed before this version can be saved.",
        variant: "destructive",
      });
      return;
    }

    try {
      const saved = await createProfile.mutateAsync({ data });
      await queryClient.invalidateQueries({
        queryKey: getListProfilesQueryKey(),
      });
      setSelectedId(saved.id);
      setDraft(draftFromSavedProfile(saved));
      setRewrite(null);
      toast({
        title: "Profile version saved",
        description:
          "The earlier versions remain available. This one is now part of your Profile Project.",
      });
    } catch {
      toast({
        title: "Could not save this version",
        description: "Nothing was overwritten. Try again in a moment.",
        variant: "destructive",
      });
    }
  }

  async function generateRewrite() {
    if (!selectedProfile) {
      toast({
        title: "Save this version first",
        description:
          "Profile Project keeps the original before Echo creates a rewrite.",
      });
      return;
    }

    try {
      const result = await rewriteProfile.mutateAsync({
        id: selectedProfile.id,
      });
      setRewrite(result);
    } catch {
      toast({
        title: "Could not create the rewrite",
        description: "Your saved profile is still safe. Try again in a moment.",
        variant: "destructive",
      });
    }
  }

  async function saveRewriteVersion() {
    if (!selectedProfile || !rewrite) return;

    try {
      const saved = await createProfile.mutateAsync({
        data: buildRewriteVersionInput(selectedProfile, rewrite),
      });
      await queryClient.invalidateQueries({
        queryKey: getListProfilesQueryKey(),
      });
      setSelectedId(saved.id);
      setDraft(draftFromSavedProfile(saved));
      setRewrite(null);
      toast({
        title: "Rewrite saved as a new version",
        description:
          "The source version remains intact so you can always compare or return to it.",
      });
    } catch {
      toast({
        title: "Could not save the rewrite",
        description: "The source version was not changed.",
        variant: "destructive",
      });
    }
  }

  async function uploadPhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast({
        title: "That image is too large",
        description: "Keep profile photos under 8 MB.",
        variant: "destructive",
      });
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      toast({ title: `You can keep up to ${MAX_PHOTOS} profile photos.` });
      return;
    }

    setUploadingPhoto(true);
    try {
      const presigned = await requestUploadUrl.mutateAsync({
        data: {
          name: file.name,
          size: file.size,
          contentType: file.type,
        },
      });
      const uploaded = await fetch(presigned.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploaded.ok) throw new Error("upload failed");
      await addPhoto.mutateAsync({ data: { uploadURL: presigned.uploadURL } });
      await queryClient.invalidateQueries({
        queryKey: getGetMyPhotosQueryKey(),
      });
      toast({
        title: "Photo added to Profile Project",
        description: "It remains private unless you separately enable reveal.",
      });
    } catch {
      toast({
        title: "Could not add that photo",
        description: "Nothing was changed. Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function removePhoto(photoId: number) {
    try {
      await deletePhoto.mutateAsync({ id: photoId });
      await queryClient.invalidateQueries({
        queryKey: getGetMyPhotosQueryKey(),
      });
      toast({ title: "Photo removed" });
    } catch {
      toast({
        title: "Could not remove that photo",
        variant: "destructive",
      });
    }
  }

  const saving = createProfile.isPending;
  const rewriting = rewriteProfile.isPending;

  return (
    <AppLayout>
      <div className="relative isolate flex-1 overflow-hidden">
        <div className="pointer-events-none absolute -right-52 -top-48 h-[36rem] w-[36rem] rounded-full bg-[hsl(326_100%_59%/0.08)] blur-3xl" />
        <div className="pointer-events-none absolute -left-52 top-80 h-[32rem] w-[32rem] rounded-full bg-[hsl(248_62%_52%/0.1)] blur-3xl" />

        <div className="relative mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
          <Link
            href="/my-matchlab"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            My MatchLab
          </Link>

          <header className="mt-7 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[hsl(248_62%_52%)]">
              My MatchLab
            </p>
            <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight sm:text-5xl">
              Profile Project
            </h1>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              One place for the profile you have now, the versions you try, and
              the rewrite you decide to keep. Saving a new version never
              overwrites the one before it.
            </p>
          </header>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <main className="space-y-6">
              <section className="rounded-[2rem] border border-foreground/10 bg-background/70 p-5 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {selectedProfile
                        ? `Working from version #${selectedProfile.id}`
                        : "New profile version"}
                    </p>
                    <h2 className="mt-2 font-serif text-2xl font-bold">
                      Your current profile
                    </h2>
                  </div>
                  <Button type="button" variant="outline" onClick={startNewVersion}>
                    <Plus className="mr-2 h-4 w-4" />
                    Start blank
                  </Button>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-platform">Platform</Label>
                    <select
                      id="profile-platform"
                      value={draft.platform}
                      onChange={(event) =>
                        patchDraft({ platform: event.target.value })
                      }
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Choose a platform</option>
                      {PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {platform}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-photo-count">Photos in this version</Label>
                    <Input
                      id="profile-photo-count"
                      inputMode="numeric"
                      min={0}
                      type="number"
                      value={draft.photoCount}
                      onChange={(event) =>
                        patchDraft({ photoCount: event.target.value })
                      }
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <Label htmlFor="profile-bio">Bio</Label>
                  <Textarea
                    id="profile-bio"
                    value={draft.bio}
                    onChange={(event) => patchDraft({ bio: event.target.value })}
                    placeholder="Paste the profile bio you are using or drafting."
                    className="min-h-36"
                  />
                </div>

                <div className="mt-5 space-y-2">
                  <Label htmlFor="profile-prompts">Prompt answers</Label>
                  <Textarea
                    id="profile-prompts"
                    value={draft.prompts}
                    onChange={(event) =>
                      patchDraft({ prompts: event.target.value })
                    }
                    placeholder="Keep each prompt and answer on its own line."
                    className="min-h-32"
                  />
                </div>

                <div className="mt-5 space-y-2">
                  <Label htmlFor="profile-notes">Version note</Label>
                  <Input
                    id="profile-notes"
                    value={draft.notes}
                    onChange={(event) => patchDraft({ notes: event.target.value })}
                    placeholder="For example: live version before August rewrite"
                  />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={saveVersion}
                    disabled={saving}
                    className="bg-[hsl(248_62%_52%)] text-white hover:bg-[hsl(248_62%_45%)]"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save as new version
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateRewrite}
                    disabled={rewriting || !selectedProfile}
                  >
                    {rewriting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    Ask Echo for a rewrite
                  </Button>
                </div>

                {!selectedProfile && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Save the source version first. Echo will never replace it
                    behind your back.
                  </p>
                )}
              </section>

              {rewrite && selectedProfile && (
                <section className="rounded-[2rem] border border-[hsl(248_62%_52%/0.25)] bg-[hsl(248_62%_52%/0.06)] p-5 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[hsl(248_62%_52%)]">
                        <Sparkles className="h-4 w-4" />
                        Draft from Echo
                      </p>
                      <h2 className="mt-2 font-serif text-2xl font-bold">
                        A possible next version
                      </h2>
                    </div>
                    <CopyButton text={rewrite.rewrittenBio} />
                  </div>

                  <p className="mt-5 whitespace-pre-wrap rounded-2xl border border-foreground/10 bg-background/75 p-5 leading-7">
                    {rewrite.rewrittenBio}
                  </p>

                  {rewrite.rewrittenPrompts.length > 0 && (
                    <div className="mt-5 space-y-3">
                      {rewrite.rewrittenPrompts.map((prompt, index) => (
                        <div
                          key={`${prompt.original}-${index}`}
                          className="rounded-2xl border border-foreground/10 bg-background/65 p-4"
                        >
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {prompt.original}
                          </p>
                          <p className="mt-2 leading-6">{prompt.rewritten}</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {prompt.tip}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {rewrite.tips.length > 0 && (
                    <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                      {rewrite.tips.map((tip) => (
                        <li key={tip} className="flex gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(248_62%_52%)]" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button
                    type="button"
                    onClick={saveRewriteVersion}
                    disabled={saving}
                    className="mt-6 bg-foreground text-background hover:bg-foreground/90"
                  >
                    <FileClock className="mr-2 h-4 w-4" />
                    Save rewrite as a new version
                  </Button>
                </section>
              )}

              <section className="rounded-[2rem] border border-foreground/10 bg-background/70 p-5 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Saved profile reads
                    </p>
                    <h2 className="mt-2 font-serif text-2xl font-bold">
                      Audit history
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Reopen the substance of every saved read here. Numeric
                      grades remain in the legacy record for compatibility, but
                      Profile Project does not use them to grade you.
                    </p>
                  </div>
                  <Link href="/start">
                    <Button type="button" variant="outline">
                      <ScanSearch className="mr-2 h-4 w-4" />
                      Start a new read
                    </Button>
                  </Link>
                </div>

                {auditsQuery.isLoading ? (
                  <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading saved reads
                  </div>
                ) : audits.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-foreground/15 p-5 text-sm leading-6 text-muted-foreground">
                    No saved profile reads yet. Starting one still uses the
                    existing capture flow until that final step is absorbed.
                  </div>
                ) : (
                  <div className="mt-6 grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
                    <div className="space-y-2">
                      {audits.map((audit) => (
                        <button
                          key={audit.id}
                          type="button"
                          onClick={() => {
                            setSelectedAuditId(audit.id);
                            setSelectedAuditVersionId(null);
                          }}
                          className={
                            "w-full rounded-2xl border p-4 text-left transition-colors " +
                            (selectedAudit?.id === audit.id
                              ? "border-[hsl(248_62%_52%/0.45)] bg-[hsl(248_62%_52%/0.08)]"
                              : "border-foreground/10 bg-background/55 hover:border-foreground/20")
                          }
                        >
                          <span className="block font-bold">
                            {audit.sourceApp || audit.currentApps[0] || "Profile"}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {formatSavedAt(audit.createdAt)} · Read #{audit.id}
                          </span>
                        </button>
                      ))}
                    </div>

                    {selectedAudit && activeAuditRecord ? (
                      <div className="min-w-0 rounded-2xl border border-foreground/10 bg-background/55 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                              {activeAuditRecord.provenance}
                            </p>
                            <h3 className="mt-2 font-serif text-xl font-bold">
                              {selectedAudit.sourceApp ||
                                selectedAudit.currentApps[0] ||
                                "Profile"}{" "}
                              read
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {activeAuditRecord.generatedAt
                                ? `Generated ${formatSavedAt(
                                    activeAuditRecord.generatedAt,
                                  )}`
                                : "Report not generated yet"}
                            </p>
                          </div>
                          <Link href={`/report/${selectedAudit.id}`}>
                            <Button type="button" variant="outline" size="sm">
                              Compatibility view
                            </Button>
                          </Link>
                        </div>

                        {auditVersions.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                selectedAuditVersionId === null
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => setSelectedAuditVersionId(null)}
                            >
                              Current
                            </Button>
                            {auditVersions.map((version) => (
                              <Button
                                key={version.id}
                                type="button"
                                size="sm"
                                variant={
                                  selectedAuditVersionId === version.id
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() =>
                                  setSelectedAuditVersionId(version.id)
                                }
                              >
                                {formatSavedAt(version.generatedAt)}
                              </Button>
                            ))}
                          </div>
                        )}

                        {!activeAuditRecord.report ? (
                          <p className="mt-5 text-sm leading-6 text-muted-foreground">
                            This older record has no stored report yet. Open the
                            compatibility view to generate it without replacing
                            the source.
                          </p>
                        ) : (
                          <div className="mt-5 space-y-5">
                            {activeAuditSections.bioRead && (
                              <div>
                                <h4 className="font-bold">How it reads</h4>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  {activeAuditSections.bioRead}
                                </p>
                              </div>
                            )}
                            {activeAuditSections.strengths.length > 0 && (
                              <div>
                                <h4 className="font-bold">What is working</h4>
                                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                                  {activeAuditSections.strengths.map((item) => (
                                    <li key={item} className="flex gap-2">
                                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {activeAuditSections.cautions.length > 0 && (
                              <div>
                                <h4 className="font-bold">What to reconsider</h4>
                                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                                  {activeAuditSections.cautions.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {activeAuditSections.suggestedBio && (
                              <div className="rounded-2xl border border-foreground/10 bg-background/70 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <h4 className="font-bold">Suggested bio</h4>
                                  <CopyButton
                                    text={activeAuditSections.suggestedBio}
                                  />
                                </div>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                                  {activeAuditSections.suggestedBio}
                                </p>
                              </div>
                            )}
                            {activeAuditSections.actions.length > 0 && (
                              <div>
                                <h4 className="font-bold">Practical next moves</h4>
                                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                                  {activeAuditSections.actions.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="rounded-[2rem] border border-foreground/10 bg-background/70 p-5 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Persistent photo collection
                    </p>
                    <h2 className="mt-2 font-serif text-2xl font-bold">
                      Your profile photos
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      These are the actual private photos attached to your
                      account. Adding or removing one updates the durable member
                      record, not a temporary Photo Lab session.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={
                      uploadingPhoto || photos.length >= MAX_PHOTOS
                    }
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ImageUp className="mr-2 h-4 w-4" />
                    )}
                    Add photo
                  </Button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPhoto(file);
                    }}
                  />
                </div>

                {photosQuery.isLoading ? (
                  <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading photos
                  </div>
                ) : photos.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-foreground/15 p-5 text-sm text-muted-foreground">
                    No persistent profile photos yet. Add up to {MAX_PHOTOS}.
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photos.map((photo, index) => (
                      <div
                        key={photo.id}
                        className="group relative aspect-square overflow-hidden rounded-2xl border border-foreground/10 bg-muted"
                      >
                        <img
                          src={photoSrc(photo.url)}
                          alt={index === 0 ? "Current lead profile photo" : "Profile photo"}
                          className="h-full w-full object-cover"
                        />
                        {index === 0 && (
                          <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-1 text-xs font-bold">
                            Lead
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void removePhoto(photo.id)}
                          className="absolute right-2 top-2 rounded-full bg-black/65 p-2 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label="Remove photo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-foreground/10 bg-background/55 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(248_62%_52%)]" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    Storage and reveal are separate. These photos remain private
                    unless you separately enable mutual-match reveal. Photo Lab
                    analysis still runs in memory and is not yet durable, so its
                    route remains available until analysis history is built.
                  </p>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <Link
                  href="/start"
                  className="rounded-3xl border border-foreground/10 bg-background/65 p-5 transition-colors hover:border-[hsl(248_62%_52%/0.3)]"
                >
                  <ScanSearch className="h-5 w-5 text-[hsl(248_62%_52%)]" />
                  <h2 className="mt-4 font-serif text-xl font-bold">
                    Capture a new profile read
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Saved reports now reopen here. The legacy route remains only
                    for capture and generation until those steps move in too.
                  </p>
                </Link>
                <Link
                  href="/photo-lab"
                  className="rounded-3xl border border-foreground/10 bg-background/65 p-5 transition-colors hover:border-[hsl(248_62%_52%/0.3)]"
                >
                  <ImageUp className="h-5 w-5 text-[hsl(326_100%_50%)]" />
                  <h2 className="mt-4 font-serif text-xl font-bold">
                    Analyze a temporary lineup
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Ranking still runs in a non-persistent session. This route
                    will not retire until its results can be saved and reopened
                    inside Profile Project.
                  </p>
                </Link>
              </section>
            </main>

            <aside className="lg:sticky lg:top-6 lg:self-start">
              <section className="rounded-[2rem] border border-foreground/10 bg-background/75 p-5 shadow-sm">
                <h2 className="font-serif text-2xl font-bold">Version history</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Every saved version is reopenable. Nothing here is a score.
                </p>

                {profilesQuery.isLoading ? (
                  <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading saved versions
                  </div>
                ) : profiles.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-foreground/15 p-5 text-sm leading-6 text-muted-foreground">
                    Your first saved profile version will appear here.
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {profiles.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => reopenVersion(profile)}
                        className={
                          "w-full rounded-2xl border p-4 text-left transition-colors " +
                          (selectedId === profile.id
                            ? "border-[hsl(248_62%_52%/0.45)] bg-[hsl(248_62%_52%/0.08)]"
                            : "border-foreground/10 bg-background/55 hover:border-foreground/20")
                        }
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-bold">{profile.platform}</span>
                          <span className="text-xs text-muted-foreground">
                            #{profile.id}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {formatSavedAt(profile.createdAt)}
                        </span>
                        <span className="mt-2 block line-clamp-2 text-sm leading-5 text-foreground/80">
                          {profile.bio}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
