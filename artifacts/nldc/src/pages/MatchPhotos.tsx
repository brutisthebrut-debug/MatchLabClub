import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Eye, ImageUp, Shield, Trash2, X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyPhotos,
  getGetMyPhotosQueryKey,
  useAddMyPhoto,
  useDeleteMyPhoto,
  useRequestUploadUrl,
  useSetRevealConsent,
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  type ProfilePhoto,
} from "@workspace/api-client-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.45,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

const MAX_PHOTOS = 6;
const MAX_BYTES = 8 * 1024 * 1024;

function photoSrc(url: string): string {
  if (url.startsWith("http") || url.startsWith("/")) return url;
  return `/api/${url}`;
}

const DEMO_PHOTOS: ProfilePhoto[] = [
  {
    id: 1,
    url: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=60",
    ordinal: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=60",
    ordinal: 1,
    createdAt: new Date().toISOString(),
  },
];

export default function MatchPhotos() {
  useMeta(
    "Your match photos",
    "Add the photos a mutual match sees on your reveal card. You control whether they are shown.",
  );

  const { isAuthenticated, login } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isDemo = !isAuthenticated;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const photosQuery = useGetMyPhotos({
    query: {
      queryKey: getGetMyPhotosQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const matchingQuery = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });

  const requestUrl = useRequestUploadUrl();
  const addPhoto = useAddMyPhoto();
  const deletePhoto = useDeleteMyPhoto();
  const setReveal = useSetRevealConsent();

  const photos = isDemo ? DEMO_PHOTOS : (photosQuery.data ?? []);
  const revealConsent = isDemo
    ? true
    : (matchingQuery.data?.revealConsent ?? false);

  const invalidatePhotos = () => {
    void queryClient.invalidateQueries({ queryKey: getGetMyPhotosQueryKey() });
  };

  async function handleFile(file: File) {
    if (isDemo) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file." });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "That image is too large. Keep it under 8 MB." });
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      toast({ title: `You can add up to ${MAX_PHOTOS} photos.` });
      return;
    }
    setUploading(true);
    try {
      const presigned = await requestUrl.mutateAsync({
        data: {
          name: file.name,
          size: file.size,
          contentType: file.type,
        },
      });
      const put = await fetch(presigned.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("upload failed");
      await addPhoto.mutateAsync({ data: { uploadURL: presigned.uploadURL } });
      invalidatePhotos();
      toast({ title: "Photo added." });
    } catch {
      toast({ title: "Couldn't upload that photo. Try again." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const handleDelete = (photoId: number) => {
    if (isDemo) return;
    deletePhoto.mutate(
      { id: photoId },
      {
        onSuccess: () => {
          invalidatePhotos();
          toast({ title: "Photo removed." });
        },
      },
    );
  };

  const handleToggleReveal = (next: boolean) => {
    if (isDemo) return;
    setReveal.mutate(
      { data: { revealConsent: next } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getGetMatchingStateQueryKey(),
          });
          toast({
            title: next
              ? "Your matches can now see your name and photos."
              : "Your name and photos are hidden again.",
          });
        },
      },
    );
  };

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-indigo fixed w-[400px] h-[400px] -top-20 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] flex items-center justify-center shadow-[0_0_16px_hsl(245_58%_62%/0.4)]">
                <ImageUp className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-[hsl(245_70%_78%)]">
                Your reveal card
              </p>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Your match photos
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              These photos appear on the reveal card a mutual match sees, but
              only when you turn reveal on. They never affect matching, and you
              can remove any of them at any time.
            </p>
          </motion.div>

          {isDemo && (
            <motion.div
              {...fadeUp(0.03)}
              className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              data-testid="banner-photos-sample"
            >
              <p className="text-sm text-muted-foreground">
                This is a sample. Sign in to add your own photos.
              </p>
              <Button
                onClick={() => login()}
                size="sm"
                className="rounded-full"
                data-testid="button-photos-signin"
              >
                Sign in
              </Button>
            </motion.div>
          )}

          <motion.div
            {...fadeUp(0.05)}
            className="glass border border-white/10 rounded-2xl p-5 mb-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Eye
                  className="w-4 h-4 text-[hsl(245_70%_78%)] flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <Label
                    htmlFor="reveal-toggle"
                    className="text-sm font-semibold text-foreground"
                  >
                    Show my name and photos to mutual matches
                  </Label>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    Off by default. When off, a match sees only your aggregate
                    readiness summary, never your name or photos.
                  </p>
                </div>
              </div>
              <Switch
                id="reveal-toggle"
                checked={revealConsent}
                onCheckedChange={handleToggleReveal}
                disabled={isDemo || setReveal.isPending}
                data-testid="switch-reveal-consent"
              />
            </div>
          </motion.div>

          <motion.div
            {...fadeUp(0.08)}
            className="glass border border-white/10 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-foreground">
                Photos ({photos.length}/{MAX_PHOTOS})
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full"
                onClick={() => fileRef.current?.click()}
                disabled={isDemo || uploading || photos.length >= MAX_PHOTOS}
                data-testid="button-add-photo"
              >
                <ImageUp className="w-4 h-4 mr-1.5" aria-hidden="true" />
                {uploading ? "Uploading..." : "Add photo"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
                data-testid="input-photo-file"
              />
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-10">
                <ImageUp
                  className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground/70">
                  No photos yet. Add up to {MAX_PHOTOS}.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-white/8"
                    data-testid={`photo-${p.id}`}
                  >
                    <img
                      src={photoSrc(p.url)}
                      alt="Your match photo"
                      className="w-full h-full object-cover"
                    />
                    {!isDemo && (
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove photo"
                        data-testid={`button-delete-photo-${p.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            {...fadeUp(0.12)}
            className="mt-6 glass border border-white/5 rounded-2xl p-4 flex items-start gap-3"
          >
            <Shield className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/45 leading-relaxed">
              <strong className="text-muted-foreground/60">
                Your photos are private to you
              </strong>{" "}
              until you turn reveal on, and even then only a mutual match can see
              them. We never use them for matching and you can delete everything
              from your account at any time.
            </p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
