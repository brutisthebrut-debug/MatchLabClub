import { learnFromCorrections } from "./ocrLearning";
import { logger } from "./logger";

const DEFAULT_INTERVAL_HOURS = 24;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function runOcrLearningOnce(): Promise<void> {
  try {
    const { scannedAudits, candidates, persisted } =
      await learnFromCorrections();
    logger.info(
      { scannedAudits, candidates: candidates.length, persisted },
      "OCR learning run complete",
    );
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "OCR learning run failed",
    );
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

export function startOcrLearningJob(): void {
  if (scheduledTimer) return;
  const intervalHours = readPositiveNumberEnv(
    "OCR_LEARNING_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * 60 * 60 * 1000;

  void runOcrLearningOnce();

  scheduledTimer = setInterval(() => {
    void runOcrLearningOnce();
  }, intervalMs);
  if (typeof scheduledTimer.unref === "function") scheduledTimer.unref();

  logger.info({ intervalHours }, "Started OCR learning job");
}

export function stopOcrLearningJob(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
