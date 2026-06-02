import { useRef, useState, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Mic,
  Square,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateVoiceIntro,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMeta } from "@/hooks/useMeta";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";

const ACCENT = "hsl(285 65% 62%)";

const ACCESS = [
  "A handful of derived numbers about how you sound: length, energy, expressiveness, pace, and how much of the take was speech",
  "A single count that fills the voice lane of your readiness",
];
const EXCLUDES = [
  "The recording itself, which never leaves your device and is never uploaded or stored",
  "Any transcript, words, or content of what you said",
  "Only the derived numbers move your readiness, never audio",
];

const MIN_SECONDS = 5;
const MAX_SECONDS = 60;

type Metrics = {
  durationSec: number;
  energy: number;
  dynamics: number;
  pace: number;
  speechRatio: number;
};

/**
 * Analyse the recording entirely in the browser and return only derived
 * acoustic metrics. The AudioBuffer is read in the moment and discarded; the
 * recording is never uploaded. We compute short-window RMS frames, then derive:
 *  - energy: mean loudness of speech frames, normalized
 *  - dynamics: spread of loudness across speech frames, normalized
 *  - pace: speech onsets per second (rising edges over the silence threshold)
 *  - speechRatio: fraction of frames above the silence threshold
 */
function deriveMetrics(buffer: AudioBuffer): Metrics {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const durationSec = buffer.duration;

  const frameSize = Math.max(1, Math.floor(sampleRate * 0.03)); // 30ms frames
  const frames: number[] = [];
  for (let i = 0; i < data.length; i += frameSize) {
    let sum = 0;
    const end = Math.min(i + frameSize, data.length);
    for (let j = i; j < end; j += 1) {
      sum += data[j]! * data[j]!;
    }
    frames.push(Math.sqrt(sum / (end - i)));
  }

  if (frames.length === 0) {
    return { durationSec, energy: 0, dynamics: 0, pace: 0, speechRatio: 0 };
  }

  const peak = Math.max(...frames, 1e-6);
  // Silence threshold relative to the loudest frame, with a small floor so a
  // near-silent take does not read as all speech.
  const threshold = Math.max(peak * 0.18, 0.01);

  const speechFrames = frames.filter((f) => f >= threshold);
  const speechRatio = speechFrames.length / frames.length;

  const meanSpeech =
    speechFrames.length > 0
      ? speechFrames.reduce((a, b) => a + b, 0) / speechFrames.length
      : 0;
  // Normalize loudness against the peak so energy is a 0-1 read independent of
  // mic gain.
  const energy = Math.min(1, meanSpeech / peak);

  const variance =
    speechFrames.length > 0
      ? speechFrames.reduce((a, b) => a + (b - meanSpeech) ** 2, 0) /
        speechFrames.length
      : 0;
  const stdDev = Math.sqrt(variance);
  const dynamics = Math.min(1, peak > 0 ? (stdDev / peak) * 2.5 : 0);

  // Onsets: rising edges where a frame crosses from below to above threshold.
  let onsets = 0;
  for (let i = 1; i < frames.length; i += 1) {
    if (frames[i]! >= threshold && frames[i - 1]! < threshold) {
      onsets += 1;
    }
  }
  const pace = durationSec > 0 ? Math.min(10, onsets / durationSec) : 0;

  return {
    durationSec: Math.round(durationSec * 10) / 10,
    energy: Math.round(energy * 100) / 100,
    dynamics: Math.round(dynamics * 100) / 100,
    pace: Math.round(pace * 100) / 100,
    speechRatio: Math.round(speechRatio * 100) / 100,
  };
}

function ConsentList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "see" | "never";
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <span
              className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background:
                  tone === "see"
                    ? "hsl(142 55% 60%)"
                    : "hsl(var(--muted-foreground))",
              }}
            />
            <span className={tone === "see" ? "" : "text-muted-foreground"}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Phase = "idle" | "recording" | "ready";

export default function VoiceIntro() {
  useMeta(
    "Voice intro | MatchLab Club",
    "Record a short spoken intro. We read only how you sound, never the words, and the recording never leaves your device.",
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const create = useCreateVoiceIntro();
  const climb = useReadinessClimb();

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stopTracks, [stopTracks]);

  const handleStop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleStart = useCallback(async () => {
    setError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(
        "Recording is not available in this browser. Try a recent Chrome, Safari, or Firefox.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const ctx = new AudioCtx();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          const derived = deriveMetrics(audioBuffer);
          await ctx.close();
          // Drop the captured audio parts the instant we have the derived
          // numbers. The blob and audioBuffer go out of scope here too; nothing
          // is uploaded or persisted. Only the derived numbers live on.
          chunksRef.current = [];
          if (derived.durationSec < MIN_SECONDS) {
            setPhase("idle");
            setMetrics(null);
            setError(
              `That was only ${derived.durationSec.toFixed(
                0,
              )} seconds. Give us at least ${MIN_SECONDS} so there is enough to read.`,
            );
            return;
          }
          setMetrics(derived);
          setPhase("ready");
        } catch {
          setPhase("idle");
          setError(
            "We could not read that recording. Try again in a quiet spot.",
          );
        }
      };

      recorder.start();
      startedAtRef.current = Date.now();
      setElapsed(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        const secs = (Date.now() - startedAtRef.current) / 1000;
        setElapsed(secs);
        if (secs >= MAX_SECONDS) handleStop();
      }, 100);
    } catch {
      setError(
        "We could not reach your microphone. Check your browser permissions and try again.",
      );
      stopTracks();
    }
  }, [stopTracks, handleStop]);

  const handleReset = useCallback(() => {
    setMetrics(null);
    setPhase("idle");
    setElapsed(0);
    setError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!metrics) return;
    climb.snapshot();
    create.mutate(
      { data: metrics },
      {
        onSuccess: () => {
          setDone(true);
          queryClient.invalidateQueries({
            queryKey: getGetMatchingStateQueryKey(),
          });
          toast({
            title: "Voice intro saved",
            description:
              "Your voice lane is filled. The more the machine knows you, the better it matches you.",
          });
        },
        onError: () => {
          toast({
            title: "Could not save your voice intro",
            description: "Something went wrong on our end. Try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  }, [metrics, climb, create, queryClient, toast]);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/connections"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Connection Center
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span
              className="w-11 h-11 rounded-xl grid place-items-center"
              style={{ background: `${ACCENT} / 0.15`, color: ACCENT }}
            >
              <Mic className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-semibold">Voice intro</h1>
          </div>
          <p className="text-muted-foreground mb-8">
            Say a few words about what you are looking for. We read only how you
            sound, the warmth, energy, and pace, never the words. The recording
            is analysed on your device in the moment and never uploaded.
          </p>
        </motion.div>

        {done ? (
          <Card>
            <CardContent className="py-10 text-center">
              <CheckCircle2
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: "hsl(142 55% 60%)" }}
              />
              <h2 className="text-xl font-semibold mb-2">Voice intro added</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Your voice lane is filled. If your Deep AI lane is on, we will
                turn how you sound into a short read you can revisit in Self Hub.
              </p>
              {climb.before !== null && (
                <ReadinessClimbReveal
                  from={climb.before}
                  to={climb.current}
                  className="max-w-sm mx-auto mb-6 rounded-2xl border border-foreground/10 p-6 text-left"
                />
              )}
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDone(false);
                    handleReset();
                    climb.reset();
                  }}
                >
                  Record again
                </Button>
                <Button asChild>
                  <Link href="/connections">Back to Connection Center</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="py-10">
                <div className="flex flex-col items-center text-center">
                  <motion.div
                    animate={
                      phase === "recording"
                        ? { scale: [1, 1.08, 1] }
                        : { scale: 1 }
                    }
                    transition={{
                      duration: 1.4,
                      repeat: phase === "recording" ? Infinity : 0,
                      ease: "easeInOut",
                    }}
                    className="w-24 h-24 rounded-full grid place-items-center mb-5"
                    style={{
                      background:
                        phase === "recording"
                          ? "hsl(348 70% 60% / 0.15)"
                          : `${ACCENT} / 0.12`,
                      color: phase === "recording" ? "hsl(348 70% 60%)" : ACCENT,
                    }}
                  >
                    <Mic className="w-10 h-10" />
                  </motion.div>

                  {phase === "recording" ? (
                    <>
                      <p className="text-2xl font-semibold tabular-nums mb-1">
                        {elapsed.toFixed(0)}s
                      </p>
                      <p className="text-sm text-muted-foreground mb-6">
                        Recording. Aim for {MIN_SECONDS} to {MAX_SECONDS}{" "}
                        seconds.
                      </p>
                      <Button onClick={handleStop} variant="destructive">
                        <Square className="w-4 h-4 mr-2" />
                        Stop
                      </Button>
                    </>
                  ) : phase === "ready" && metrics ? (
                    <>
                      <p className="text-base font-medium mb-1">
                        Got it, {metrics.durationSec.toFixed(0)} seconds read.
                      </p>
                      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                        We derived how you sound below. The recording is already
                        gone. Save it to fill your voice lane, or record again.
                      </p>
                      <div className="flex flex-wrap gap-3 justify-center">
                        <Button
                          variant="outline"
                          onClick={handleReset}
                          disabled={create.isPending}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Record again
                        </Button>
                        <Button
                          onClick={handleSubmit}
                          disabled={create.isPending}
                        >
                          {create.isPending && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          Save to my readiness
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                        Tap to record. Your browser will ask for microphone
                        access. Nothing is sent until you choose to save.
                      </p>
                      <Button onClick={handleStart}>
                        <Mic className="w-4 h-4 mr-2" />
                        Start recording
                      </Button>
                    </>
                  )}

                  {error && (
                    <p className="text-sm text-destructive mt-5 max-w-sm">
                      {error}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {phase === "ready" && metrics && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">What we read</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Length", value: `${metrics.durationSec}s` },
                    {
                      label: "Energy",
                      value: `${Math.round(metrics.energy * 100)}%`,
                    },
                    {
                      label: "Expressiveness",
                      value: `${Math.round(metrics.dynamics * 100)}%`,
                    },
                    {
                      label: "Pace",
                      value: `${metrics.pace.toFixed(1)}/s`,
                    },
                    {
                      label: "Speech",
                      value: `${Math.round(metrics.speechRatio * 100)}%`,
                    },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        {m.label}
                      </p>
                      <p className="text-lg font-semibold tabular-nums">
                        {m.value}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" style={{ color: ACCENT }} />
                  Before you record
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-6">
                <ConsentList title="What we'll see" items={ACCESS} tone="see" />
                <ConsentList
                  title="What we'll never touch"
                  items={EXCLUDES}
                  tone="never"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
